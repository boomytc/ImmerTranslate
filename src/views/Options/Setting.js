import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Link from "@mui/material/Link";
import { useSetting } from "../../hooks/Setting";
import { useI18n } from "../../hooks/I18n";
import { useAlert } from "../../hooks/Alert";
import { isAutoTranslateClipboardSupported, isExt } from "../../libs/client";
import { browser } from "../../libs/browser";
import {
  CLIPBOARD_READ_PERMISSION,
  hasClipboardReadPermission,
  requestClipboardReadPermission,
} from "../../libs/clipboard";
import {
  OPT_LANGDETECTOR_ALL,
  DEFAULT_BLACKLIST,
  DEFAULT_CSPLIST,
  DEFAULT_ORILIST,
  OPT_POPUP_DEFAULT_VIEW_PAGE,
  OPT_POPUP_DEFAULT_VIEW_TEXT,
  OPT_POPUP_DEFAULT_VIEW_ALL,
  MSG_CONTEXT_MENUS,
  MSG_UPDATE_CSP,
  CURRENT_SETTINGS_VERSION,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  APP_LCNAME,
} from "../../config";
import { useFab } from "../../hooks/Fab";
import { normalizeFabConfig } from "../../config/fab";
import { sendBgMsg } from "../../libs/msg";
import { tryClearCaches } from "../../libs/cache";
import { kissLog, LogLevel } from "../../libs/log";
import UploadButton from "./UploadButton";
import DownloadButton from "./DownloadButton";
import OverviewHero from "./OverviewHero";
import FabAppearanceSetting from "./FabAppearanceSetting";
import {
  SettingsAdvanced,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
  SettingsSelect,
  SettingsSwitch,
  ShortcutKeys,
} from "./SettingsCard";

export function openExtensionsShortcutsPage() {
  let url = "chrome://extensions/shortcuts";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) {
    url = "edge://extensions/shortcuts";
  } else if (ua.includes("OPR/")) {
    url = "opera://extensions/shortcuts";
  } else if (ua.includes("Brave/")) {
    url = "brave://extensions/shortcuts";
  }

  if (browser?.tabs?.create) {
    browser.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * 展示扩展版快捷键的组件 (仅 Extension 模式)
 */
export function ExtCommands() {
  const [commands, setCommands] = useState([]);
  const i18n = useI18n();

  useEffect(() => {
    if (browser?.commands?.getAll) {
      browser.commands
        .getAll()
        .then((cmds) => {
          if (cmds) {
            setCommands(cmds.filter((c) => c.description));
          }
        })
        .catch((err) => {
          kissLog("fetch commands", err);
        });
    }
  }, []);

  if (!commands || commands.length === 0) return null;

  return (
    <SettingsSection title={i18n("options_shortcuts")}>
      <SettingsCard>
        {commands.map((cmd) => {
          const editLabel = `${i18n("edit")} ${cmd.description}`;
          const keys = cmd.shortcut ? cmd.shortcut.split("+") : [];
          return (
            <SettingsRow key={cmd.name} label={cmd.description}>
              <ShortcutKeys keys={keys} />
              <IconButton
                size="small"
                onClick={openExtensionsShortcutsPage}
                aria-label={editLabel}
                title={editLabel}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </SettingsRow>
          );
        })}
      </SettingsCard>
    </SettingsSection>
  );
}

export function AutoTranslateClipboardSetting({ value, onChange }) {
  const i18n = useI18n();
  const alert = useAlert();
  const [hasPermission, setHasPermission] = useState(null);

  const refreshPermission = useCallback(async () => {
    setHasPermission(await hasClipboardReadPermission());
  }, []);

  useEffect(() => {
    refreshPermission();

    const handlePermissionChange = (permissions) => {
      if (permissions?.permissions?.includes(CLIPBOARD_READ_PERMISSION)) {
        refreshPermission();
      }
    };
    browser?.permissions?.onAdded?.addListener?.(handlePermissionChange);
    browser?.permissions?.onRemoved?.addListener?.(handlePermissionChange);

    return () => {
      browser?.permissions?.onAdded?.removeListener?.(handlePermissionChange);
      browser?.permissions?.onRemoved?.removeListener?.(handlePermissionChange);
    };
  }, [refreshPermission]);

  const enableAutoTranslate = async () => {
    const granted = await requestClipboardReadPermission();
    setHasPermission(granted);
    if (granted) {
      onChange(true);
      alert.success(i18n("clipboard_permission_granted"));
    } else {
      onChange(false);
      alert.warning(i18n("clipboard_permission_denied"));
    }
  };

  const handleToggle = async (checked) => {
    if (checked) {
      await enableAutoTranslate();
    } else {
      onChange(false);
    }
  };

  return (
    <SettingsRow
      label={i18n("auto_translate_clipboard")}
      description={
        value && hasPermission === false ? (
          <Link component="button" type="button" onClick={enableAutoTranslate}>
            {i18n("clipboard_permission_required")}
          </Link>
        ) : (
          i18n("auto_translate_clipboard_helper")
        )
      }
    >
      <SettingsSwitch
        checked={Boolean(value)}
        label={i18n("auto_translate_clipboard")}
        onChange={handleToggle}
      />
    </SettingsRow>
  );
}

/**
 * 基本查词/运行设置中心页面 (Settings)
 */
export default function Settings() {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const alert = useAlert();
  const { fab, updateFab } = useFab();

  const updateField = (name, value) => {
    switch (name) {
      case "contextMenuType":
        isExt && sendBgMsg(MSG_CONTEXT_MENUS, value);
        break;
      case "csplist":
        isExt && sendBgMsg(MSG_UPDATE_CSP, { csplist: value });
        break;
      case "orilist":
        isExt && sendBgMsg(MSG_UPDATE_CSP, { orilist: value });
        break;
      default:
    }
    updateSetting({
      [name]: value,
    });
  };

  const handleClearCache = async () => {
    if (await tryClearCaches()) {
      alert.success(i18n("clear_success"));
    } else {
      alert.error(i18n("clear_failed"));
    }
  };

  const handleImport = async (data) => {
    try {
      const imported = JSON.parse(data);
      if (
        !imported ||
        typeof imported !== "object" ||
        Array.isArray(imported)
      ) {
        alert.error(i18n("import_failed"));
        return;
      }
      await updateSetting({ ...imported, version: CURRENT_SETTINGS_VERSION });
      if (isExt) {
        if (imported.contextMenuType !== undefined) {
          sendBgMsg(MSG_CONTEXT_MENUS, imported.contextMenuType);
        }
        const cspPayload = {};
        if (imported.csplist !== undefined) {
          cspPayload.csplist = imported.csplist;
        }
        if (imported.orilist !== undefined) {
          cspPayload.orilist = imported.orilist;
        }
        if (Object.keys(cspPayload).length > 0) {
          sendBgMsg(MSG_UPDATE_CSP, cspPayload);
        }
      }
      alert.success(i18n("import_success"));
    } catch (err) {
      kissLog("import setting", err);
      alert.error(i18n("import_failed"));
    }
  };

  const {
    clearCache = false,
    contextMenuType = 1,
    blacklist = DEFAULT_BLACKLIST.join(",\n"),
    csplist = DEFAULT_CSPLIST.join(",\n"),
    orilist = DEFAULT_ORILIST.join(",\n"),
    langDetector = "-",
    logLevel = 1,
    skipLangs = [],
    translateVariants = true,
    parseLatex = false,
    autoTranslateClipboard = false,
    popupDefaultView = OPT_POPUP_DEFAULT_VIEW_PAGE,
  } = setting;
  const normalizedPopupDefaultView = OPT_POPUP_DEFAULT_VIEW_ALL.includes(
    popupDefaultView
  )
    ? popupDefaultView
    : OPT_POPUP_DEFAULT_VIEW_PAGE;
  const [blacklistDraft, setBlacklistDraft] = useState(null);
  const blacklistValue = blacklistDraft ?? blacklist;
  const commitBlacklist = (value) => {
    setBlacklistDraft(null);
    if (value !== blacklist) updateSetting({ blacklist: value });
  };

  // 悬浮球显隐：全局开关只改 isHide，两个名单各自保持含义。
  const {
    isHide,
    hiddenSites,
    shownSites,
    halfHide,
    fabClickAction = 0,
  } = normalizeFabConfig(fab);

  return (
    <Box>
      <OverviewHero />
      <Stack spacing={3}>
        {/* 数据导入导出控制条 */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          useFlexGap
          flexWrap="wrap"
        >
          <UploadButton text={i18n("import")} handleImport={handleImport} />
          <DownloadButton
            handleData={() => JSON.stringify(setting, null, 2)}
            text={i18n("export")}
            fileName={`${APP_LCNAME}-setting_${Date.now()}.json`}
          />
        </Stack>

        {/* 通用设置 */}
        <SettingsSection title={i18n("general")}>
          <SettingsCard>
            {isExt && (
              <SettingsRow label={i18n("popup_default_view")}>
                <SettingsSegmented
                  value={normalizedPopupDefaultView}
                  label={i18n("popup_default_view")}
                  onChange={(value) => updateField("popupDefaultView", value)}
                  items={[
                    {
                      value: OPT_POPUP_DEFAULT_VIEW_PAGE,
                      label: i18n("popup_default_view_page"),
                    },
                    {
                      value: OPT_POPUP_DEFAULT_VIEW_TEXT,
                      label: i18n("popup_default_view_text"),
                    },
                  ]}
                />
              </SettingsRow>
            )}
            {isAutoTranslateClipboardSupported && (
              <AutoTranslateClipboardSetting
                value={autoTranslateClipboard}
                onChange={(value) =>
                  updateSetting({ autoTranslateClipboard: value })
                }
              />
            )}
            <SettingsRow label={i18n("context_menus")}>
              <SettingsSelect
                value={contextMenuType}
                label={i18n("context_menus")}
                onChange={(value) => updateField("contextMenuType", value)}
                options={[
                  { value: 0, label: i18n("hide_context_menus") },
                  { value: 1, label: i18n("simple_context_menus") },
                  { value: 2, label: i18n("secondary_context_menus") },
                ]}
              />
            </SettingsRow>
            <SettingsRow label={i18n("detected_lang")}>
              <SettingsSelect
                value={langDetector}
                label={i18n("detected_lang")}
                onChange={(value) => updateField("langDetector", value)}
                options={[
                  { value: "-", label: i18n("disable") },
                  ...OPT_LANGDETECTOR_ALL.map((item) => ({
                    value: item,
                    label: item,
                  })),
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("translate_variants")}
              description={i18n("translate_variants_helper")}
            >
              <SettingsSwitch
                checked={Boolean(translateVariants)}
                label={i18n("translate_variants")}
                onChange={(checked) =>
                  updateField("translateVariants", checked)
                }
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("parse_latex")}
              description={i18n("parse_latex_helper")}
            >
              <SettingsSwitch
                checked={Boolean(parseLatex)}
                label={i18n("parse_latex")}
                onChange={(checked) => updateField("parseLatex", checked)}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("skip_langs")}
              description={i18n("skip_langs_helper")}
            >
              <SettingsSelect
                multiple
                value={skipLangs}
                label={i18n("skip_langs")}
                onChange={(value) => updateField("skipLangs", value)}
                options={OPT_LANGS_TO}
              />
            </SettingsRow>
            <SettingsRow label={i18n("log_level")}>
              <SettingsSelect
                value={logLevel}
                label={i18n("log_level")}
                onChange={(value) => updateField("logLevel", value)}
                options={Object.values(LogLevel).map(({ value, name }) => ({
                  value,
                  label: name,
                }))}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        {/* 悬浮球 */}
        <SettingsSection title={i18n("settings_group_fab")}>
          <SettingsCard>
            <SettingsRow label={i18n("hide_fab_button")}>
              <SettingsSegmented
                value={Boolean(isHide)}
                label={i18n("hide_fab_button")}
                onChange={(value) => updateFab({ isHide: value })}
                items={[
                  { value: false, label: i18n("show") },
                  { value: true, label: i18n("hide") },
                ]}
              />
            </SettingsRow>
            <SettingsRow label={i18n("fab_click_action")}>
              <SettingsSegmented
                value={fabClickAction}
                label={i18n("fab_click_action")}
                onChange={(value) => updateFab({ fabClickAction: value })}
                items={[
                  { value: 0, label: i18n("fab_click_menu") },
                  { value: 1, label: i18n("fab_click_translate") },
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("fab_half_hide")}
              description={i18n("fab_half_hide_helper")}
            >
              <SettingsSwitch
                checked={Boolean(halfHide)}
                label={i18n("fab_half_hide")}
                onChange={(checked) => updateFab({ halfHide: checked })}
              />
            </SettingsRow>
          </SettingsCard>
          <Box sx={{ mt: 2 }}>
            <FabAppearanceSetting fab={fab} onChange={updateFab} />
          </Box>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={10}
              name="hiddenSites"
              value={hiddenSites}
              label={i18n("fab_hidden_sites")}
              helperText={i18n("fab_exception_list_helper")}
              onChange={(e) => updateFab({ hiddenSites: e.target.value })}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={10}
              name="shownSites"
              value={shownSites}
              label={i18n("fab_shown_sites")}
              helperText={i18n("fab_exception_list_helper")}
              onChange={(e) => updateFab({ shownSites: e.target.value })}
            />
          </Stack>
        </SettingsSection>

        {/* 黑名单与缓存 */}
        <SettingsSection title={i18n("settings_group_blacklist_cache")}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label={i18n("translate_blacklist")}
              helperText={i18n("pattern_helper")}
              name="blacklist"
              value={blacklistValue}
              onChange={(event) => setBlacklistDraft(event.target.value)}
              onBlur={(event) => commitBlacklist(event.target.value)}
              maxRows={10}
              multiline
            />
            <SettingsCard>
              <SettingsRow
                label={i18n("if_clear_cache")}
                description={
                  <Link
                    component="button"
                    type="button"
                    onClick={handleClearCache}
                  >
                    {i18n("clear_all_cache_now")}
                  </Link>
                }
              >
                <SettingsSegmented
                  value={Boolean(clearCache)}
                  label={i18n("if_clear_cache")}
                  onChange={(value) => updateField("clearCache", value)}
                  items={[
                    { value: false, label: i18n("clear_cache_never") },
                    { value: true, label: i18n("clear_cache_restart") },
                  ]}
                />
              </SettingsRow>
            </SettingsCard>
            <SettingsAdvanced label={i18n("settings_detailed_controls")}>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={i18n("disabled_orilist")}
                  helperText={i18n("pattern_helper")}
                  name="orilist"
                  value={orilist}
                  onChange={(e) => updateField("orilist", e.target.value)}
                  multiline
                />
                <TextField
                  fullWidth
                  size="small"
                  label={i18n("disabled_csplist")}
                  helperText={`${i18n("pattern_helper")} ${i18n("disabled_csplist_helper")}`}
                  name="csplist"
                  value={csplist}
                  onChange={(e) => updateField("csplist", e.target.value)}
                  multiline
                />
              </Stack>
            </SettingsAdvanced>
          </Stack>
        </SettingsSection>

        <ExtCommands />
      </Stack>
    </Box>
  );
}

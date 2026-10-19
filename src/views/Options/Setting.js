import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
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
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

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

/**
 * 展示扩展版快捷键的组件 (仅 Extension 模式)
 */
export function ExtCommands() {
  const [commands, setCommands] = useState([]);
  const i18n = useI18n();
  const alert = useAlert();

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
          console.error("fetch commands error:", err);
        });
    }
  }, []);

  if (!commands || commands.length === 0) return null;

  const handleEdit = () => {
    let url = "chrome://extensions/shortcuts";
    const ua = navigator.userAgent;
    if (ua.includes("Firefox/")) {
      alert.info(i18n("firefox_shortcut_edit_hint"));
      return;
    }
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
      window.open(url, "_blank");
    }
  };

  return (
    <Box>
      <Grid container spacing={2} columns={12}>
        {commands.map((cmd) => (
          <Grid item xs={12} sm={12} md={6} lg={6} key={cmd.name}>
            <Stack direction="row" alignItems="flex-start">
              <TextField
                size="small"
                label={cmd.description}
                value={cmd.shortcut || ""}
                fullWidth
                disabled
              />
              <IconButton
                onClick={handleEdit}
                aria-label={i18n("edit")}
                title={i18n("edit")}
              >
                <EditIcon />
              </IconButton>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Box>
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

  const handleChange = async (event) => {
    if (event.target.value) {
      await enableAutoTranslate();
    } else {
      onChange(false);
    }
  };

  return (
    <Grid item xs={12} sm={12} md={6} lg={3}>
      <TextField
        select
        fullWidth
        size="small"
        name="autoTranslateClipboard"
        value={value}
        label={i18n("auto_translate_clipboard")}
        onChange={handleChange}
        helperText={
          value && hasPermission === false ? (
            <Link
              component="button"
              type="button"
              onClick={enableAutoTranslate}
            >
              {i18n("clipboard_permission_required")}
            </Link>
          ) : (
            i18n("auto_translate_clipboard_helper")
          )
        }
      >
        <MenuItem value={true}>{i18n("enable")}</MenuItem>
        <MenuItem value={false}>{i18n("disable")}</MenuItem>
      </TextField>
    </Grid>
  );
}

/**
 * 基本查词/运行设置中心页面 (Settings)
 */
export default function Settings() {
  const i18n = useI18n();
  // 设置 Hook
  const { setting, updateSetting } = useSetting();
  const alert = useAlert();
  // 悬浮查词 FAB 浮球设置 Hook
  const { fab, updateFab } = useFab();

  // 基础表单输入状态更改回调
  const handleChange = (e) => {
    e.preventDefault();
    let { name, value } = e.target;

    // 特定联动：若是浏览器扩展模式，且修改了右键菜单或CSP规则列表，立即向后台 content script / background 发送同步消息
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

  // Report cache clearing only after the local or background operation completes.
  const handleClearCache = async () => {
    if (await tryClearCaches()) {
      alert.success(i18n("clear_success"));
    } else {
      alert.error(i18n("clear_failed"));
    }
  };

  // Imported settings are stored as the current schema.
  const handleImport = async (data) => {
    try {
      const imported = JSON.parse(data);
      updateSetting({ ...imported, version: CURRENT_SETTINGS_VERSION });
    } catch (err) {
      kissLog("import setting", err);
    }
  };

  // 解构当前基础查词偏好设置
  const {
    clearCache,
    contextMenuType = 1,
    touchModes = [2],
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

        {/* 基础参数网格配置区 */}
        <Box className="kt-overview-settings">
          <Typography className="kt-options-section-title">
            {i18n("general")}
          </Typography>
          <Grid container columns={12}>
            {/* 工具栏弹窗打开时默认显示的界面 (仅 Extension 模式) */}
            {isExt && (
              <Grid item xs={12} sm={12} md={6} lg={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  name="popupDefaultView"
                  value={normalizedPopupDefaultView}
                  label={i18n("popup_default_view")}
                  onChange={handleChange}
                >
                  <MenuItem value={OPT_POPUP_DEFAULT_VIEW_PAGE}>
                    {i18n("popup_default_view_page")}
                  </MenuItem>
                  <MenuItem value={OPT_POPUP_DEFAULT_VIEW_TEXT}>
                    {i18n("popup_default_view_text")}
                  </MenuItem>
                </TextField>
              </Grid>
            )}
            {isAutoTranslateClipboardSupported && (
              <AutoTranslateClipboardSetting
                value={autoTranslateClipboard}
                onChange={(value) =>
                  updateSetting({ autoTranslateClipboard: value })
                }
              />
            )}
            {/* 点击悬浮球时触发的行为 (直接展示菜单或立即启动全文双语翻译) */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="fabClickAction"
                value={fabClickAction}
                label={i18n("fab_click_action")}
                onChange={(e) => updateFab({ fabClickAction: e.target.value })}
              >
                <MenuItem value={0}>{i18n("fab_click_menu")}</MenuItem>
                <MenuItem value={1}>{i18n("fab_click_translate")}</MenuItem>
              </TextField>
            </Grid>
            {/* 移动端/触屏端特定的触摸手势快捷翻译触发方式 */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="touchModes"
                value={touchModes}
                label={i18n("touch_translate_shortcut")}
                onChange={handleChange}
                SelectProps={{
                  multiple: true,
                }}
              >
                {[0, 2, 3, 4, 5, 6, 7].map((item) => (
                  <MenuItem key={item} value={item}>
                    {i18n(`touch_tap_${item}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {/* 浏览器右键上下文菜单的展示层级 */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="contextMenuType"
                value={contextMenuType}
                label={i18n("context_menus")}
                onChange={handleChange}
              >
                <MenuItem value={0}>{i18n("hide_context_menus")}</MenuItem>
                <MenuItem value={1}>{i18n("simple_context_menus")}</MenuItem>
                <MenuItem value={2}>{i18n("secondary_context_menus")}</MenuItem>
              </TextField>
            </Grid>
            {/* 网页首选的语言自动检测服务组件 (如 Chrome Builtin, FastText 或 API) */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="langDetector"
                value={langDetector}
                label={i18n("detected_lang")}
                onChange={handleChange}
              >
                <MenuItem value={"-"}>{i18n("disable")}</MenuItem>
                {OPT_LANGDETECTOR_ALL.map((item) => (
                  <MenuItem value={item} key={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {/* Translate variants of the same language, such as Simplified and Traditional Chinese. */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="translateVariants"
                value={translateVariants}
                label={i18n("translate_variants")}
                helperText={i18n("translate_variants_helper")}
                onChange={handleChange}
              >
                <MenuItem value={true}>{i18n("enable")}</MenuItem>
                <MenuItem value={false}>{i18n("disable")}</MenuItem>
              </TextField>
            </Grid>
            {/* Render inline LaTeX as Unicode only when explicitly enabled. */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="parseLatex"
                value={parseLatex}
                label={i18n("parse_latex")}
                helperText={i18n("parse_latex_helper")}
                onChange={handleChange}
              >
                <MenuItem value={true}>{i18n("enable")}</MenuItem>
                <MenuItem value={false}>{i18n("disable")}</MenuItem>
              </TextField>
            </Grid>
            {/* 日志记录详细层级 (Error/Info/Debug 等) */}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="logLevel"
                value={logLevel}
                label={i18n("log_level")}
                onChange={handleChange}
              >
                {Object.values(LogLevel).map(({ value, name }) => (
                  <MenuItem value={value} key={value}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Box>

        {/* 翻译跳过语言：遇到选中的目标语言时跳过自动网页翻译 */}
        <TextField
          select
          size="small"
          label={i18n("skip_langs")}
          helperText={i18n("skip_langs_helper")}
          name="skipLangs"
          value={skipLangs}
          onChange={handleChange}
          SelectProps={{
            multiple: true,
          }}
        >
          {OPT_LANGS_TO.map(([langKey, langName]) => (
            <MenuItem key={langKey} value={langKey}>
              {langName}
            </MenuItem>
          ))}
        </TextField>

        {/* 是否全局隐藏内容页面右侧的悬浮查词小图标 FAB */}
        <TextField
          select
          fullWidth
          size="small"
          name="isHide"
          value={isHide}
          label={i18n("hide_fab_button")}
          onChange={(e) => {
            updateFab({ isHide: e.target.value });
          }}
        >
          <MenuItem value={false}>{i18n("show")}</MenuItem>
          <MenuItem value={true}>{i18n("hide")}</MenuItem>
        </TextField>

        <TextField
          select
          fullWidth
          size="small"
          name="halfHide"
          value={halfHide}
          label={i18n("fab_half_hide")}
          helperText={i18n("fab_half_hide_helper")}
          onChange={(e) => updateFab({ halfHide: e.target.value })}
        >
          <MenuItem value={true}>{i18n("enable")}</MenuItem>
          <MenuItem value={false}>{i18n("disable")}</MenuItem>
        </TextField>

        <FabAppearanceSetting fab={fab} onChange={updateFab} />

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

        {/* 网页翻译的黑名单域名正则排除列表 (一行一条) */}
        <TextField
          size="small"
          label={i18n("translate_blacklist")}
          helperText={i18n("pattern_helper")}
          name="blacklist"
          value={blacklistValue}
          onChange={(event) => setBlacklistDraft(event.target.value)}
          onBlur={(event) => commitBlacklist(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            commitBlacklist(event.target.value);
          }}
          maxRows={10}
          multiline
        />

        {/* 扩展专属的高级网络设置 (只在 Extension 模式下展示) */}
        <>
          {/* 是否在浏览器关闭/重启时自动清空网页翻译的已缓存译文 */}
          <TextField
            select
            fullWidth
            size="small"
            name="clearCache"
            value={clearCache}
            label={i18n("if_clear_cache")}
            onChange={handleChange}
            helperText={
              <Link component="button" onClick={handleClearCache}>
                {i18n("clear_all_cache_now")}
              </Link>
            }
          >
            <MenuItem value={false}>{i18n("clear_cache_never")}</MenuItem>
            <MenuItem value={true}>{i18n("clear_cache_restart")}</MenuItem>
          </TextField>

          {/* 跨域安全 CSP 旁路加载白名单与 Ori 白名单 */}
          <TextField
            size="small"
            label={i18n("disabled_orilist")}
            helperText={i18n("pattern_helper")}
            name="orilist"
            value={orilist}
            onChange={handleChange}
            multiline
          />
          <TextField
            size="small"
            label={i18n("disabled_csplist")}
            helperText={
              i18n("pattern_helper") + " " + i18n("disabled_csplist_helper")
            }
            name="csplist"
            value={csplist}
            onChange={handleChange}
            multiline
          />

          <ExtCommands />
        </>
      </Stack>
    </Box>
  );
}

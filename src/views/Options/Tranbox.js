import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Grid";
import EditIcon from "@mui/icons-material/Edit";
import { useI18n } from "../../hooks/I18n";
import {
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  OPT_TRANBOX_TRIGGER_CLICK,
  OPT_TRANBOX_TRIGGER_ALL,
  OPT_TRANBOX_BTN_POSITION_FIXED,
  OPT_TRANBOX_BTN_POSITION_ALL,
  OPT_TRANBOX_INTERACT_CLICK,
  OPT_TRANBOX_INTERACT_DBLCLICK,
  OPT_DICT_BING,
  OPT_DICT_ALL,
  OPT_SUG_ALL,
  OPT_SUG_YOUDAO,
  PROMPT_MODE_FOLLOW_API,
  getDictionaryPromptOptions,
  getPromptDisplayName,
  OPT_SKIPLANGS_SELECTION,
} from "../../config";
import ShortcutInput from "./ShortcutInput";
import { useCallback, useMemo, useState } from "react";
import { limitNumber } from "../../libs/utils";
import { useTranbox } from "../../hooks/Tranbox";
import { isExt } from "../../libs/client";
import { useApiList, getApiDisplayName } from "../../hooks/Api";
import ValidationInput from "../../hooks/ValidationInput";
import { usePromptList } from "../../hooks/Prompt";
import { useOverviewShortcuts } from "../../hooks/Commands";
import { openExtensionsShortcutsPage } from "./Setting";
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

const INTERACT_MODES = [
  "-",
  OPT_TRANBOX_INTERACT_CLICK,
  OPT_TRANBOX_INTERACT_DBLCLICK,
];

/**
 * 划词翻译框 (Tranbox) 样式与交互配置面板组件
 */
export default function Tranbox() {
  const i18n = useI18n();
  const { tranboxSetting, updateTranbox } = useTranbox();
  const [blacklistDraft, setBlacklistDraft] = useState(null);
  const shortcutMap = useOverviewShortcuts({ tranboxSetting });
  const { enabledApis, aiEnabledApis } = useApiList();
  const { prompts } = usePromptList();
  const dictionaryPromptOptions = useMemo(
    () => getDictionaryPromptOptions(prompts),
    [prompts]
  );

  const handleChange = (e) => {
    e.preventDefault();
    let { name, value } = e.target;
    switch (name) {
      case "btnOffsetX":
      case "btnOffsetY":
      case "boxOffsetX":
      case "boxOffsetY":
        value = limitNumber(value, -200, 200);
        break;
      default:
    }
    updateTranbox({
      [name]: value,
    });
  };

  const handleShortcutInput = useCallback(
    (val) => {
      updateTranbox({ tranboxShortcut: val });
    },
    [updateTranbox]
  );

  const {
    transOpen,
    apiSlugs = [],
    singleWordNoTrans = false,
    fromLang,
    toLang,
    toLang2 = "en",
    tranboxShortcut,
    btnOffsetX,
    btnOffsetY,
    boxOffsetX = 0,
    boxOffsetY = 10,
    hideTranBtn = false,
    hideClickAway = false,
    simpleStyle = false,
    followSelection = false,
    autoHeight = false,
    triggerMode = OPT_TRANBOX_TRIGGER_CLICK,
    tranboxInteractMode = "-",
    btnPositionMode = OPT_TRANBOX_BTN_POSITION_FIXED,
    enDict = OPT_DICT_BING,
    enSug = OPT_SUG_YOUDAO,
    aiDictApiSlug = "-",
    aiDictPromptSlug = PROMPT_MODE_FOLLOW_API,
    blacklist = "",
    skipLangs = [],
  } = tranboxSetting;

  // 失效下拉值兜底，避免指向已禁用服务或已删除提示词时触发 MUI out-of-range 警告
  const safeApiSlugs = (Array.isArray(apiSlugs) ? apiSlugs : []).filter(
    (slug) => enabledApis.some((api) => api.apiSlug === slug)
  );
  const safeAiDictApiSlug =
    aiDictApiSlug === "-" ||
    aiEnabledApis.some((api) => api.apiSlug === aiDictApiSlug)
      ? aiDictApiSlug
      : "-";
  const safeAiDictPromptSlug =
    aiDictPromptSlug === PROMPT_MODE_FOLLOW_API ||
    dictionaryPromptOptions.some((prompt) => prompt.slug === aiDictPromptSlug)
      ? aiDictPromptSlug
      : PROMPT_MODE_FOLLOW_API;
  const safeEnDict =
    enDict === "-" || OPT_DICT_ALL.includes(enDict) ? enDict : "-";
  const safeEnSug = enSug === "-" || OPT_SUG_ALL.includes(enSug) ? enSug : "-";
  const safeFromLang = OPT_LANGS_FROM.some(([lang]) => lang === fromLang)
    ? fromLang
    : OPT_LANGS_FROM[0]?.[0] || "auto";
  const safeToLang = OPT_LANGS_TO.some(([lang]) => lang === toLang)
    ? toLang
    : OPT_LANGS_TO[0]?.[0] || "zh-CN";
  const safeToLang2 =
    toLang2 === "-" || OPT_LANGS_TO.some(([lang]) => lang === toLang2)
      ? toLang2
      : "-";
  const safeBtnPositionMode = OPT_TRANBOX_BTN_POSITION_ALL.includes(
    btnPositionMode
  )
    ? btnPositionMode
    : OPT_TRANBOX_BTN_POSITION_FIXED;
  const safeInteractMode = INTERACT_MODES.includes(tranboxInteractMode)
    ? tranboxInteractMode
    : "-";
  const editShortcutLabel = `${i18n("edit")} ${i18n("trigger_tranbox_shortcut")}`;

  return (
    <Box>
      <Stack spacing={3}>
        <SettingsSection title={i18n("settings_trigger_group")}>
          <SettingsCard>
            <SettingsRow label={i18n("selection_translate")}>
              <SettingsSwitch
                checked={transOpen}
                label={i18n("selection_translate")}
                onChange={(checked) => updateTranbox({ transOpen: checked })}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("selection_skip_langs")}
              description={i18n("selection_skip_langs_helper")}
            >
              <SettingsSelect
                multiple
                value={skipLangs}
                label={i18n("selection_skip_langs")}
                onChange={(value) => updateTranbox({ skipLangs: value })}
                options={OPT_SKIPLANGS_SELECTION}
              />
            </SettingsRow>
            <SettingsRow
              stacked
              className="kt-settings-row--trigger"
              label={i18n("trigger_mode")}
            >
              <SettingsSegmented
                className="kt-settings-segmented--trigger"
                value={triggerMode}
                label={i18n("trigger_mode")}
                onChange={(value) => updateTranbox({ triggerMode: value })}
                items={OPT_TRANBOX_TRIGGER_ALL.map((value) => ({
                  value,
                  label: i18n(`trigger_${value}`),
                }))}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("follow_selection")}
              description={i18n("settings_follow_selection_description")}
            >
              <SettingsSwitch
                checked={followSelection}
                label={i18n("follow_selection")}
                onChange={(checked) =>
                  updateTranbox({ followSelection: checked })
                }
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("trigger_tranbox_shortcut")}
              description={i18n("settings_selection_shortcut_description")}
            >
              {isExt ? (
                <>
                  <ShortcutKeys keys={shortcutMap.selection} />
                  <IconButton
                    size="small"
                    onClick={openExtensionsShortcutsPage}
                    aria-label={editShortcutLabel}
                    title={editShortcutLabel}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <ShortcutInput
                  compact
                  value={tranboxShortcut}
                  onChange={handleShortcutInput}
                  label={i18n("trigger_tranbox_shortcut")}
                />
              )}
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={i18n("dictionary")}>
          <SettingsCard>
            <SettingsRow
              label={i18n("single_word_no_trans")}
              description={i18n("settings_single_word_dictionary_description")}
            >
              <SettingsSwitch
                checked={singleWordNoTrans}
                label={i18n("single_word_no_trans")}
                onChange={(checked) =>
                  updateTranbox({ singleWordNoTrans: checked })
                }
              />
            </SettingsRow>
            <SettingsRow label={i18n("english_dict")}>
              <SettingsSelect
                value={safeEnDict}
                label={i18n("english_dict")}
                onChange={(value) => updateTranbox({ enDict: value })}
                options={[
                  { value: "-", label: i18n("disable") },
                  ...OPT_DICT_ALL.map((value) => ({ value, label: value })),
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("ai_dict_api", "AI Dictionary API")}
              description={i18n("settings_ai_dictionary_description")}
            >
              <SettingsSelect
                value={safeAiDictApiSlug}
                label={i18n("ai_dict_api", "AI Dictionary API")}
                onChange={(value) => updateTranbox({ aiDictApiSlug: value })}
                options={[
                  { value: "-", label: i18n("disable") },
                  ...aiEnabledApis.map((api) => ({
                    value: api.apiSlug,
                    label: getApiDisplayName(api),
                  })),
                ]}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={i18n("settings_appearance_group")}>
          <SettingsCard>
            <SettingsRow
              label={i18n("use_simple_style")}
              description={i18n("settings_simple_style_description")}
            >
              <SettingsSwitch
                checked={simpleStyle}
                label={i18n("use_simple_style")}
                onChange={(checked) => updateTranbox({ simpleStyle: checked })}
              />
            </SettingsRow>
            <SettingsRow label={i18n("hide_click_away")}>
              <SettingsSwitch
                checked={Boolean(hideClickAway)}
                label={i18n("hide_click_away")}
                onChange={(checked) =>
                  updateTranbox({ hideClickAway: checked })
                }
              />
            </SettingsRow>
            <SettingsRow label={i18n("tranbox_auto_height")}>
              <SettingsSwitch
                checked={Boolean(autoHeight)}
                label={i18n("tranbox_auto_height")}
                onChange={(checked) => updateTranbox({ autoHeight: checked })}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsAdvanced rows label={i18n("settings_detailed_controls")}>
          <SettingsRow label={i18n("translate_service_multiple")}>
            <SettingsSelect
              multiple
              value={safeApiSlugs}
              label={i18n("translate_service_multiple")}
              onChange={(value) => updateTranbox({ apiSlugs: value })}
              options={enabledApis.map((api) => ({
                value: api.apiSlug,
                label: getApiDisplayName(api),
              }))}
            />
          </SettingsRow>
          <SettingsRow label={i18n("from_lang")}>
            <SettingsSelect
              value={safeFromLang}
              label={i18n("from_lang")}
              onChange={(value) => updateTranbox({ fromLang: value })}
              options={OPT_LANGS_FROM}
            />
          </SettingsRow>
          <SettingsRow label={i18n("to_lang")}>
            <SettingsSelect
              value={safeToLang}
              label={i18n("to_lang")}
              onChange={(value) => updateTranbox({ toLang: value })}
              options={OPT_LANGS_TO}
            />
          </SettingsRow>
          <SettingsRow
            label={i18n("to_lang2")}
            description={i18n("to_lang2_helper")}
          >
            <SettingsSelect
              value={safeToLang2}
              label={i18n("to_lang2")}
              onChange={(value) => updateTranbox({ toLang2: value })}
              options={[
                { value: "-", label: i18n("disable") },
                ...OPT_LANGS_TO,
              ]}
            />
          </SettingsRow>
          <SettingsRow label={i18n("ai_dict_prompt")}>
            <SettingsSelect
              value={safeAiDictPromptSlug}
              label={i18n("ai_dict_prompt")}
              onChange={(value) => updateTranbox({ aiDictPromptSlug: value })}
              options={[
                {
                  value: PROMPT_MODE_FOLLOW_API,
                  label: i18n("follow_api_prompt"),
                },
                ...dictionaryPromptOptions.map((prompt) => ({
                  value: prompt.slug,
                  label: getPromptDisplayName(prompt, i18n),
                })),
              ]}
            />
          </SettingsRow>
          <SettingsRow label={i18n("english_suggest")}>
            <SettingsSelect
              value={safeEnSug}
              label={i18n("english_suggest")}
              onChange={(value) => updateTranbox({ enSug: value })}
              options={[
                { value: "-", label: i18n("disable") },
                ...OPT_SUG_ALL.map((item) => ({
                  value: item,
                  label: item,
                })),
              ]}
            />
          </SettingsRow>
          <SettingsRow label={i18n("tranbtn_position_mode")}>
            <SettingsSelect
              value={safeBtnPositionMode}
              label={i18n("tranbtn_position_mode")}
              onChange={(value) => updateTranbox({ btnPositionMode: value })}
              options={OPT_TRANBOX_BTN_POSITION_ALL.map((item) => ({
                value: item,
                label: i18n(`tranbtn_position_${item}`),
              }))}
            />
          </SettingsRow>
          <SettingsRow label={i18n("hide_tran_button")}>
            <SettingsSwitch
              checked={Boolean(hideTranBtn)}
              label={i18n("hide_tran_button")}
              onChange={(checked) => updateTranbox({ hideTranBtn: checked })}
            />
          </SettingsRow>
          <SettingsRow label={i18n("tranbox_interact_mode")}>
            <SettingsSelect
              value={safeInteractMode}
              label={i18n("tranbox_interact_mode")}
              onChange={(value) =>
                updateTranbox({ tranboxInteractMode: value })
              }
              options={[
                { value: "-", label: i18n("disable") },
                {
                  value: OPT_TRANBOX_INTERACT_CLICK,
                  label: i18n("tranbox_interact_click"),
                },
                {
                  value: OPT_TRANBOX_INTERACT_DBLCLICK,
                  label: i18n("tranbox_interact_dblclick"),
                },
              ]}
            />
          </SettingsRow>
          <Box component="li" sx={{ listStyle: "none", py: 2 }}>
            <Stack spacing={2}>
              <Grid container spacing={2} columns={12}>
                <Grid item xs={12} sm={6}>
                  <ValidationInput
                    fullWidth
                    size="small"
                    label={i18n("tranbtn_offset_x")}
                    type="number"
                    name="btnOffsetX"
                    value={btnOffsetX}
                    onChange={handleChange}
                    min={-200}
                    max={200}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <ValidationInput
                    fullWidth
                    size="small"
                    label={i18n("tranbtn_offset_y")}
                    type="number"
                    name="btnOffsetY"
                    value={btnOffsetY}
                    onChange={handleChange}
                    min={-200}
                    max={200}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <ValidationInput
                    fullWidth
                    size="small"
                    label={i18n("tranbox_offset_x")}
                    type="number"
                    name="boxOffsetX"
                    value={boxOffsetX}
                    onChange={handleChange}
                    min={-200}
                    max={200}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <ValidationInput
                    fullWidth
                    size="small"
                    label={i18n("tranbox_offset_y")}
                    type="number"
                    name="boxOffsetY"
                    value={boxOffsetY}
                    onChange={handleChange}
                    min={-200}
                    max={200}
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                size="small"
                label={i18n("blacklist")}
                helperText={i18n("pattern_helper")}
                name="blacklist"
                value={blacklistDraft ?? blacklist}
                onChange={(e) => setBlacklistDraft(e.target.value)}
                onBlur={(e) => {
                  const value = e.target.value;
                  setBlacklistDraft(null);
                  if (value !== blacklist) updateTranbox({ blacklist: value });
                }}
                maxRows={10}
                multiline
              />
            </Stack>
          </Box>
        </SettingsAdvanced>
      </Stack>
    </Box>
  );
}

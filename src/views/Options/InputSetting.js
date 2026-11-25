import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { useI18n } from "../../hooks/I18n";
import {
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  OPT_INPUT_TRANS_SIGNS,
  OPT_INPUT_DOT_DISABLE,
  OPT_INPUT_DOT_ALWAYS,
  isInputDotShown,
  DEFAULT_INPUT_RULE,
} from "../../config";
import ShortcutInput from "./ShortcutInput";
import { useInputRule } from "../../hooks/InputRule";
import { useCallback, useState } from "react";
import { useApiList, getApiDisplayName } from "../../hooks/Api";
import { limitNumber } from "../../libs/utils";
import {
  SettingsAdvanced,
  SettingsCard,
  SettingsRange,
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
  SettingsSelect,
  SettingsSwitch,
} from "./SettingsCard";

const MIN_TRIGGER_TIME = 10;
const MAX_TRIGGER_TIME = 1000;

export function normalizeTriggerTime(value) {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_INPUT_RULE.triggerTime;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_INPUT_RULE.triggerTime;
  }

  return limitNumber(numericValue, MIN_TRIGGER_TIME, MAX_TRIGGER_TIME);
}

/**
 * 网页输入框快捷输入翻译设置页面 (InputSetting)
 */
export default function InputSetting() {
  const i18n = useI18n();
  const { inputRule, updateInputRule } = useInputRule();
  const { enabledApis } = useApiList();
  const [blacklistDraft, setBlacklistDraft] = useState(null);

  const handleShortcutInput = useCallback(
    (val) => {
      updateInputRule({ triggerShortcut: val });
    },
    [updateInputRule]
  );

  const {
    transOpen,
    apiSlug,
    fromLang,
    toLang,
    triggerShortcut,
    triggerCount,
    triggerTime,
    transSign,
    showDot,
    blacklist = "",
  } = inputRule;
  const blacklistValue = blacklistDraft ?? blacklist;
  const commitBlacklist = (value) => {
    setBlacklistDraft(null);
    if (value !== blacklist) updateInputRule({ blacklist: value });
  };
  const normalizedTriggerTime = normalizeTriggerTime(triggerTime);

  const apiOptions = enabledApis.map((api) => ({
    value: api.apiSlug,
    label: getApiDisplayName(api),
  }));
  const hasApiOption = apiOptions.some((item) => item.value === apiSlug);
  const safeApiOptions =
    !hasApiOption && apiSlug
      ? [
          {
            value: apiSlug,
            label: `${apiSlug} (${i18n("unavailable_option")})`,
          },
          ...apiOptions,
        ]
      : apiOptions;
  const safeApiSlug = hasApiOption || apiSlug ? apiSlug : "";
  const safeTransSign =
    transSign === "" || OPT_INPUT_TRANS_SIGNS.includes(transSign)
      ? transSign
      : "";
  const safeFromLang = OPT_LANGS_FROM.some(([lang]) => lang === fromLang)
    ? fromLang
    : OPT_LANGS_FROM[0]?.[0] || "auto";
  const safeToLang = OPT_LANGS_TO.some(([lang]) => lang === toLang)
    ? toLang
    : OPT_LANGS_TO[0]?.[0] || "en";

  return (
    <Box>
      <SettingsSection>
        <SettingsCard>
          <SettingsRow label={i18n("use_input_box_translation")}>
            <SettingsSwitch
              checked={transOpen}
              label={i18n("use_input_box_translation")}
              onChange={(checked) => updateInputRule({ transOpen: checked })}
            />
          </SettingsRow>
          <SettingsRow
            label={i18n("trigger_trans_shortcut")}
            description={i18n("trigger_trans_shortcut_help")}
          >
            <ShortcutInput
              compact
              value={triggerShortcut}
              onChange={handleShortcutInput}
              label={i18n("trigger_trans_shortcut")}
            />
          </SettingsRow>
          <SettingsRow label={i18n("shortcut_press_count")}>
            <SettingsSegmented
              className="kt-settings-segmented--numeric"
              value={Number(triggerCount)}
              label={i18n("shortcut_press_count")}
              onChange={(value) => updateInputRule({ triggerCount: value })}
              items={[1, 2, 3, 4, 5].map((value) => ({
                value,
                label: `${value}×`,
              }))}
            />
          </SettingsRow>
          <SettingsRow
            label={i18n("input_trans_start_sign")}
            description={i18n("input_trans_start_sign_help")}
          >
            <SettingsSelect
              value={safeTransSign}
              label={i18n("input_trans_start_sign")}
              onChange={(value) => updateInputRule({ transSign: value })}
              options={[
                { value: "", label: i18n("style_none") },
                ...OPT_INPUT_TRANS_SIGNS.map((value) => ({
                  value,
                  label: value,
                })),
              ]}
            />
          </SettingsRow>
          <SettingsRow label={i18n("to_lang")}>
            <SettingsSelect
              value={safeToLang}
              label={i18n("to_lang")}
              onChange={(value) => updateInputRule({ toLang: value })}
              options={OPT_LANGS_TO}
            />
          </SettingsRow>
          <SettingsRow label={i18n("show_translation_dot")}>
            <SettingsSwitch
              checked={isInputDotShown(showDot)}
              label={i18n("show_translation_dot")}
              onChange={(checked) =>
                updateInputRule({
                  showDot: checked
                    ? OPT_INPUT_DOT_ALWAYS
                    : OPT_INPUT_DOT_DISABLE,
                })
              }
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsAdvanced rows label={i18n("settings_detailed_controls")}>
        <SettingsRow label={i18n("translate_service")}>
          <SettingsSelect
            value={safeApiSlug}
            label={i18n("translate_service")}
            onChange={(value) => updateInputRule({ apiSlug: value })}
            options={safeApiOptions}
          />
        </SettingsRow>
        <SettingsRow label={i18n("from_lang")}>
          <SettingsSelect
            value={safeFromLang}
            label={i18n("from_lang")}
            onChange={(value) => updateInputRule({ fromLang: value })}
            options={OPT_LANGS_FROM}
          />
        </SettingsRow>
        <SettingsRow label={i18n("combo_timeout")}>
          <SettingsRange
            value={normalizedTriggerTime}
            min={MIN_TRIGGER_TIME}
            max={MAX_TRIGGER_TIME}
            step={1}
            unit=" ms"
            label={i18n("combo_timeout")}
            onChange={(value) => updateInputRule({ triggerTime: value })}
          />
        </SettingsRow>
      </SettingsAdvanced>

      <SettingsSection title={i18n("blacklist")}>
        <TextField
          fullWidth
          hiddenLabel
          size="small"
          helperText={i18n("pattern_helper")}
          name="blacklist"
          value={blacklistValue}
          inputProps={{ "aria-label": i18n("blacklist") }}
          onChange={(e) => setBlacklistDraft(e.target.value)}
          onBlur={(e) => commitBlacklist(e.target.value)}
          maxRows={10}
          multiline
        />
      </SettingsSection>
    </Box>
  );
}

import Box from "@mui/material/Box";
import { useI18n } from "../../hooks/I18n";
import ShortcutInput from "./ShortcutInput";
import CodeField from "./CodeField";
import TextField from "@mui/material/TextField";
import { useMouseHoverSetting } from "../../hooks/MouseHover";
import { useApiList, getApiDisplayName } from "../../hooks/Api";
import { useCallback, useState } from "react";
import { limitNumber } from "../../libs/utils";
import {
  DEFAULT_MOUSEHOVER_KEY,
  DEFAULT_MOUSE_HOVER_BUBBLE_STYLE,
  DEFAULT_MOUSE_HOVER_HOLD_DELAY,
  GLOBAL_KEY,
  OPT_MOUSE_HOVER_DISPLAY_BILINGUAL,
  OPT_MOUSE_HOVER_DISPLAY_BUBBLE,
  OPT_MOUSE_HOVER_TRANS_DISPLAY_BLOCK,
  OPT_MOUSE_HOVER_TRANS_DISPLAY_INLINE,
  OPT_MOUSE_HOVER_TRANS_AREA,
  OPT_MOUSE_HOVER_TRANS_PARAGRAPH,
  OPT_MOUSE_HOVER_TRANS_REGION,
} from "../../config";
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

const MIN_HOLD_DELAY = 50;
const MAX_HOLD_DELAY = 3000;
const TRANS_MODES = [
  OPT_MOUSE_HOVER_TRANS_PARAGRAPH,
  OPT_MOUSE_HOVER_TRANS_REGION,
  OPT_MOUSE_HOVER_TRANS_AREA,
];
const TRANS_DISPLAYS = [
  OPT_MOUSE_HOVER_TRANS_DISPLAY_BLOCK,
  OPT_MOUSE_HOVER_TRANS_DISPLAY_INLINE,
];

function normalizeHoldDelay(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return DEFAULT_MOUSE_HOVER_HOLD_DELAY;
  }
  return limitNumber(num, MIN_HOLD_DELAY, MAX_HOLD_DELAY);
}

/**
 * Mouse hover translation settings panel.
 */
export default function MouseHoverSetting() {
  const i18n = useI18n();
  const { mouseHoverSetting, updateMouseHoverSetting } = useMouseHoverSetting();
  const { enabledApis } = useApiList();
  const [blacklistDraft, setBlacklistDraft] = useState(null);
  const [bubbleStyleDraft, setBubbleStyleDraft] = useState(null);

  const handleShortcutInput = useCallback(
    (val) => {
      updateMouseHoverSetting({ mouseHoverKey: val });
    },
    [updateMouseHoverSetting]
  );

  const handleAltShortcutInput = useCallback(
    (val) => {
      updateMouseHoverSetting({ mouseHoverKey2: val });
    },
    [updateMouseHoverSetting]
  );

  const handleHoldKeyChange = useCallback(
    (checked) => {
      updateMouseHoverSetting({ mouseHoverKeyHold: checked });
    },
    [updateMouseHoverSetting]
  );

  const handleAltHoldKeyChange = useCallback(
    (checked) => {
      updateMouseHoverSetting({ mouseHoverKey2Hold: checked });
    },
    [updateMouseHoverSetting]
  );

  const handleHoldDelayChange = useCallback(
    (value) => {
      updateMouseHoverSetting({
        mouseHoverHoldDelay: normalizeHoldDelay(value),
      });
    },
    [updateMouseHoverSetting]
  );

  const handlePreventClickChange = useCallback(
    (checked) => {
      updateMouseHoverSetting({ mouseHoverPreventClick: checked });
    },
    [updateMouseHoverSetting]
  );

  const {
    useMouseHover = true,
    mouseHoverKey = DEFAULT_MOUSEHOVER_KEY,
    mouseHoverKey2 = [],
    mouseHoverKeyHold = false,
    mouseHoverKey2Hold = false,
    mouseHoverHoldDelay = DEFAULT_MOUSE_HOVER_HOLD_DELAY,
    mouseHoverTransMode = OPT_MOUSE_HOVER_TRANS_AREA,
    mouseHoverTransDisplay = OPT_MOUSE_HOVER_TRANS_DISPLAY_BLOCK,
    mouseHoverPreventClick = false,
    blacklist = "",
    displayMode = OPT_MOUSE_HOVER_DISPLAY_BILINGUAL,
    apiSlug = GLOBAL_KEY,
    bubbleStyle = DEFAULT_MOUSE_HOVER_BUBBLE_STYLE,
  } = mouseHoverSetting;
  const blacklistValue = blacklistDraft ?? blacklist;
  const commitBlacklist = (value) => {
    setBlacklistDraft(null);
    if (value !== blacklist) updateMouseHoverSetting({ blacklist: value });
  };
  const bubbleStyleValue = bubbleStyleDraft ?? bubbleStyle;
  const commitBubbleStyle = (value) => {
    setBubbleStyleDraft(null);
    if (value !== bubbleStyle) updateMouseHoverSetting({ bubbleStyle: value });
  };

  const selectedApiSlug = enabledApis.some((api) => api.apiSlug === apiSlug)
    ? apiSlug
    : GLOBAL_KEY;
  const selectedTransMode = TRANS_MODES.includes(mouseHoverTransMode)
    ? mouseHoverTransMode
    : OPT_MOUSE_HOVER_TRANS_AREA;
  const selectedTransDisplay = TRANS_DISPLAYS.includes(mouseHoverTransDisplay)
    ? mouseHoverTransDisplay
    : OPT_MOUSE_HOVER_TRANS_DISPLAY_BLOCK;
  const normalizedHoldDelay = normalizeHoldDelay(mouseHoverHoldDelay);

  return (
    <Box>
      <SettingsSection title={i18n("mouse_controls")}>
        <SettingsCard>
          <SettingsRow
            label={i18n("use_mousehover_translation")}
            description={i18n("use_mousehover_translation_helper")}
          >
            <SettingsSwitch
              checked={useMouseHover}
              label={i18n("use_mousehover_translation")}
              onChange={(checked) =>
                updateMouseHoverSetting({ useMouseHover: checked })
              }
            />
          </SettingsRow>
          <SettingsRow
            label={i18n("trigger_trans_shortcut")}
            description={i18n("mousehover_key_help")}
          >
            <ShortcutInput
              compact
              value={mouseHoverKey}
              onChange={handleShortcutInput}
              label={i18n("trigger_trans_shortcut")}
            />
          </SettingsRow>
          <SettingsRow
            label={i18n("mousehover_hold_key")}
            description={i18n("mousehover_hold_key_helper")}
          >
            <SettingsSwitch
              checked={mouseHoverKeyHold}
              label={i18n("mousehover_hold_key")}
              onChange={handleHoldKeyChange}
            />
          </SettingsRow>
          <SettingsRow label={i18n("mousehover_display_mode")}>
            <SettingsSegmented
              value={displayMode}
              label={i18n("mousehover_display_mode")}
              onChange={(value) =>
                updateMouseHoverSetting({ displayMode: value })
              }
              items={[
                {
                  value: OPT_MOUSE_HOVER_DISPLAY_BILINGUAL,
                  label: i18n("mousehover_display_bilingual"),
                },
                {
                  value: OPT_MOUSE_HOVER_DISPLAY_BUBBLE,
                  label: i18n("mousehover_display_bubble"),
                },
              ]}
            />
          </SettingsRow>
          {displayMode === OPT_MOUSE_HOVER_DISPLAY_BUBBLE && (
            <SettingsRow
              label={i18n("translate_service")}
              description={i18n("mousehover_bubble_api_helper")}
            >
              <SettingsSelect
                value={selectedApiSlug}
                label={i18n("translate_service")}
                onChange={(value) =>
                  updateMouseHoverSetting({ apiSlug: value })
                }
                options={[
                  {
                    value: GLOBAL_KEY,
                    label: i18n("mousehover_follow_page_rule"),
                  },
                  ...enabledApis.map((api) => ({
                    value: api.apiSlug,
                    label: getApiDisplayName(api),
                  })),
                ]}
              />
            </SettingsRow>
          )}
        </SettingsCard>
      </SettingsSection>

      {(mouseHoverKeyHold || mouseHoverKey2Hold) && (
        <SettingsSection title={i18n("mousehover_hold_key")}>
          <SettingsCard>
            <SettingsRow
              label={i18n("mousehover_hold_delay")}
              description={i18n("mousehover_hold_delay_helper")}
            >
              <SettingsRange
                value={normalizedHoldDelay}
                min={MIN_HOLD_DELAY}
                max={MAX_HOLD_DELAY}
                step={50}
                unit=" ms"
                label={i18n("mousehover_hold_delay")}
                onChange={handleHoldDelayChange}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("mousehover_hold_scope")}
              description={i18n("mousehover_hold_scope_helper")}
            >
              <SettingsSelect
                value={selectedTransMode}
                label={i18n("mousehover_hold_scope")}
                onChange={(value) =>
                  updateMouseHoverSetting({ mouseHoverTransMode: value })
                }
                options={[
                  {
                    value: OPT_MOUSE_HOVER_TRANS_PARAGRAPH,
                    label: i18n("mousehover_hold_scope_paragraph"),
                  },
                  {
                    value: OPT_MOUSE_HOVER_TRANS_REGION,
                    label: i18n("mousehover_hold_scope_region"),
                  },
                  {
                    value: OPT_MOUSE_HOVER_TRANS_AREA,
                    label: i18n("mousehover_hold_scope_area"),
                  },
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("mousehover_hold_display")}
              description={i18n("mousehover_hold_display_helper")}
            >
              <SettingsSelect
                value={selectedTransDisplay}
                label={i18n("mousehover_hold_display")}
                onChange={(value) =>
                  updateMouseHoverSetting({ mouseHoverTransDisplay: value })
                }
                options={[
                  {
                    value: OPT_MOUSE_HOVER_TRANS_DISPLAY_BLOCK,
                    label: i18n("mousehover_hold_display_block"),
                  },
                  {
                    value: OPT_MOUSE_HOVER_TRANS_DISPLAY_INLINE,
                    label: i18n("mousehover_hold_display_inline"),
                  },
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("mousehover_hold_prevent_click")}
              description={
                mouseHoverPreventClick
                  ? i18n("mousehover_hold_prevent_click_helper")
                  : undefined
              }
            >
              <SettingsSwitch
                checked={mouseHoverPreventClick}
                label={i18n("mousehover_hold_prevent_click")}
                onChange={handlePreventClickChange}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      )}

      <SettingsAdvanced rows label={i18n("settings_detailed_controls")}>
        <SettingsRow
          label={`${i18n("trigger_trans_shortcut")} 2`}
          description={i18n("mousehover_key_help")}
        >
          <ShortcutInput
            compact
            value={mouseHoverKey2}
            onChange={handleAltShortcutInput}
            label={`${i18n("trigger_trans_shortcut")} 2`}
          />
        </SettingsRow>
        <SettingsRow
          label={`${i18n("mousehover_hold_key")} 2`}
          description={i18n("mousehover_hold_key_helper")}
        >
          <SettingsSwitch
            checked={mouseHoverKey2Hold}
            label={`${i18n("mousehover_hold_key")} 2`}
            onChange={handleAltHoldKeyChange}
          />
        </SettingsRow>
        {displayMode === OPT_MOUSE_HOVER_DISPLAY_BUBBLE && (
          <SettingsRow
            stacked
            label={i18n("mousehover_bubble_style")}
            description={i18n("mousehover_bubble_style_helper")}
          >
            <CodeField
              fullWidth
              hiddenLabel
              size="small"
              name="bubbleStyle"
              value={bubbleStyleValue}
              inputProps={{ "aria-label": i18n("mousehover_bubble_style") }}
              onChange={(e) => setBubbleStyleDraft(e.target.value)}
              onBlur={(e) => commitBubbleStyle(e.target.value)}
              maxRows={12}
            />
          </SettingsRow>
        )}
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

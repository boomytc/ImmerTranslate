import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import CodeField from "./CodeField";
import MenuItem from "@mui/material/MenuItem";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useI18n } from "../../hooks/I18n";
import {
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  DEFAULT_SUBTITLE_PROMPT_SLUG,
  PROMPT_MODE_FOLLOW_API,
  PROMPT_MODE_GLOBAL,
  getPromptDisplayName,
  getSubtitlePromptOptions,
} from "../../config";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import { useSubtitle } from "../../hooks/Subtitle";
import { useApiList, getApiDisplayName } from "../../hooks/Api";
import { usePromptList } from "../../hooks/Prompt";
import ValidationInput from "../../hooks/ValidationInput";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  SettingsAdvanced,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
  SettingsSelect,
  SettingsSwitch,
} from "./SettingsCard";
import {
  colorToHex,
  formatFontSizeFromSlider,
  hexToRgb,
  objectToCss,
  parseCssToObject,
  parseFontSize,
  parsePadding,
  parseRgba,
  rgbToHex,
} from "./subtitleStyleUtils";

export { parseCssToObject, objectToCss } from "./subtitleStyleUtils";

const YOUTUBE_CAPTION_CONTAINER_WIDTH = 640;

/**
 * 视频双语字幕预览面板组件
 */
function SubtitleStylePreview({
  windowStyle,
  originStyle,
  translationStyle,
  displayOrder,
}) {
  const i18n = useI18n();
  const [stageBg, setStageBg] = useState("dark");
  const windowRef = useRef(null);
  const originRef = useRef(null);
  const transRef = useRef(null);

  useLayoutEffect(() => {
    if (windowRef.current) {
      windowRef.current.style.cssText = windowStyle || "";
      windowRef.current.style.textAlign = "center";
    }
    if (originRef.current) {
      originRef.current.style.cssText = originStyle || "";
      originRef.current.style.margin = "0";
    }
    if (transRef.current) {
      transRef.current.style.cssText = translationStyle || "";
      transRef.current.style.margin = "0";
    }
  }, [displayOrder, originStyle, translationStyle, windowStyle]);

  const originPreview = <p ref={originRef}>This is an example subtitle</p>;
  const translationPreview = (
    <p ref={transRef}>{i18n("subtitle_preview_sample", "这是示例字幕文本")}</p>
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1,
        }}
      >
        <Typography variant="subtitle2">
          {i18n("subtitle_style_preview", "样式预览")}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={stageBg}
          aria-label={i18n("subtitle_preview_stage_bg")}
          onChange={(_e, next) => {
            if (next) setStageBg(next);
          }}
        >
          <ToggleButton value="dark" sx={{ py: 0.25, px: 1.25, fontSize: 12 }}>
            {i18n("settings_theme_dark")}
          </ToggleButton>
          <ToggleButton value="light" sx={{ py: 0.25, px: 1.25, fontSize: 12 }}>
            {i18n("settings_theme_light")}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box
        sx={{
          background:
            stageBg === "dark"
              ? "radial-gradient(circle at 50% 25%, #2a3140 0%, #151821 62%, #0c0e14 100%)"
              : "linear-gradient(135deg, #eef2f7 0%, #dde4ee 100%)",
          borderRadius: "12px",
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 132,
          px: 2,
        }}
      >
        <Box
          sx={{
            containerType: "inline-size",
            width: YOUTUBE_CAPTION_CONTAINER_WIDTH,
            maxWidth: "100%",
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <div ref={windowRef}>
            {displayOrder === "translation-first" ? (
              <>
                {translationPreview}
                {originPreview}
              </>
            ) : (
              <>
                {originPreview}
                {translationPreview}
              </>
            )}
          </div>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * 视频双语字幕翻译设置页面组件 (SubtitleSetting)
 */
export default function SubtitleSetting() {
  const i18n = useI18n();
  const { subtitleSetting, updateSubtitle } = useSubtitle();
  const { enabledApis, aiEnabledApis } = useApiList();
  const { prompts } = usePromptList();
  const subtitlePromptOptions = useMemo(
    () => getSubtitlePromptOptions(prompts),
    [prompts]
  );

  const handleChange = (e) => {
    e.preventDefault();
    const { name, value } = e.target;
    const pending = debounceTimers.current[name];
    if (pending) {
      clearTimeout(pending.timer);
      delete debounceTimers.current[name];
    }
    const rafKey = {
      originStyle: "origin",
      translationStyle: "trans",
      windowStyle: "window",
    }[name];
    if (rafKey && rafIds.current[rafKey]) {
      cancelAnimationFrame(rafIds.current[rafKey]);
      rafIds.current[rafKey] = 0;
    }
    updateSubtitle({
      [name]: value,
    });
    if (name === "originStyle") {
      setLocalOriginStyle(value);
      originCssRef.current = parseCssToObject(value);
    } else if (name === "translationStyle") {
      setLocalTransStyle(value);
      transCssRef.current = parseCssToObject(value);
    } else if (name === "windowStyle") {
      setLocalWindowStyle(value);
      windowCssRef.current = parseCssToObject(value);
    }
  };

  const handleSegPromptChange = (e) => {
    e.preventDefault();
    const { value } = e.target;

    if (value === PROMPT_MODE_FOLLOW_API) {
      updateSubtitle({
        segPromptMode: PROMPT_MODE_FOLLOW_API,
      });
      return;
    }

    updateSubtitle({
      segPromptMode: PROMPT_MODE_GLOBAL,
      segPromptSlug: value,
    });
  };

  const {
    enabled,
    apiSlug,
    segSlug,
    forceSubtitleRetranslate = false,
    chunkLength,
    longSentenceThreshold = 120,
    preTrans = 90,
    throttleTrans = 30,
    toLang,
    autoTranslate = true,
    isBilingual,
    displayOrder = "original-first",
    aiContextSlug = "-",
    segPromptMode = PROMPT_MODE_FOLLOW_API,
    segPromptSlug,
    windowStyle,
    originStyle,
    translationStyle,
    showLoadNotification = true,
    hideSubtitleButton = false,
  } = subtitleSetting;

  const selectedSegPromptSlug = segPromptSlug || DEFAULT_SUBTITLE_PROMPT_SLUG;
  const hasSelectedSegPrompt = subtitlePromptOptions.some(
    (prompt) => prompt.slug === selectedSegPromptSlug
  );
  const segPromptValue =
    segPromptMode === PROMPT_MODE_GLOBAL && hasSelectedSegPrompt
      ? selectedSegPromptSlug
      : PROMPT_MODE_FOLLOW_API;

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

  const hasSegOption =
    segSlug === "-" || aiEnabledApis.some((api) => api.apiSlug === segSlug);
  const safeSegSlug = hasSegOption ? segSlug : "-";

  const hasContextOption =
    aiContextSlug === "-" ||
    aiEnabledApis.some((api) => api.apiSlug === aiContextSlug);
  const safeAiContextSlug = hasContextOption ? aiContextSlug : "-";

  const safeToLang = OPT_LANGS_TO.some(([lang]) => lang === toLang)
    ? toLang
    : OPT_LANGS_TO[0]?.[0] || "zh-CN";

  const [localOriginStyle, setLocalOriginStyle] = useState(originStyle);
  const [localTransStyle, setLocalTransStyle] = useState(translationStyle);
  const [localWindowStyle, setLocalWindowStyle] = useState(windowStyle);

  useEffect(() => {
    setLocalOriginStyle(originStyle);
  }, [originStyle]);
  useEffect(() => {
    setLocalTransStyle(translationStyle);
  }, [translationStyle]);
  useEffect(() => {
    setLocalWindowStyle(windowStyle);
  }, [windowStyle]);

  const debounceTimers = useRef({});
  const rafIds = useRef({ origin: 0, trans: 0, window: 0 });

  const originCssRef = useRef(parseCssToObject(localOriginStyle));
  const transCssRef = useRef(parseCssToObject(localTransStyle));
  const windowCssRef = useRef(parseCssToObject(localWindowStyle));

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((pending) => {
        clearTimeout(pending.timer);
        pending.flush();
      });
      debounceTimers.current = {};
      Object.values(rafIds.current).forEach(
        (id) => id && cancelAnimationFrame(id)
      );
      rafIds.current = { origin: 0, trans: 0, window: 0 };
    };
  }, []);

  const debouncedUpdate = useCallback(
    (name, value) => {
      const pending = debounceTimers.current[name];
      if (pending) {
        clearTimeout(pending.timer);
      }
      const flush = () => {
        delete debounceTimers.current[name];
        updateSubtitle({ [name]: value });
      };
      debounceTimers.current[name] = {
        flush,
        timer: setTimeout(flush, 200),
      };
    },
    [updateSubtitle]
  );

  const scheduleStyleUpdate = useCallback(
    (name, setter, cssString, immediate = false) => {
      const rafKey = {
        originStyle: "origin",
        translationStyle: "trans",
        windowStyle: "window",
      }[name];
      if (rafIds.current[rafKey]) {
        cancelAnimationFrame(rafIds.current[rafKey]);
        rafIds.current[rafKey] = 0;
      }
      if (immediate) {
        setter(cssString);
        return;
      }
      rafIds.current[rafKey] = requestAnimationFrame(() => {
        rafIds.current[rafKey] = 0;
        setter(cssString);
      });
    },
    []
  );

  const updateOriginCss = useCallback(
    (key, value, options = {}) => {
      originCssRef.current[key] = value;
      const css = objectToCss(originCssRef.current);
      scheduleStyleUpdate(
        "originStyle",
        setLocalOriginStyle,
        css,
        options.immediate
      );
      debouncedUpdate("originStyle", css);
    },
    [debouncedUpdate, scheduleStyleUpdate]
  );

  const updateTranslationCss = useCallback(
    (key, value, options = {}) => {
      transCssRef.current[key] = value;
      const css = objectToCss(transCssRef.current);
      scheduleStyleUpdate(
        "translationStyle",
        setLocalTransStyle,
        css,
        options.immediate
      );
      debouncedUpdate("translationStyle", css);
    },
    [debouncedUpdate, scheduleStyleUpdate]
  );

  const updateWindowCss = useCallback(
    (key, value, options = {}) => {
      windowCssRef.current[key] = value;
      const css = objectToCss(windowCssRef.current);
      scheduleStyleUpdate(
        "windowStyle",
        setLocalWindowStyle,
        css,
        options.immediate
      );
      debouncedUpdate("windowStyle", css);
    },
    [debouncedUpdate, scheduleStyleUpdate]
  );

  const updateWindowCssDirect = useCallback(
    (css) => {
      windowCssRef.current = parseCssToObject(css);
      scheduleStyleUpdate("windowStyle", setLocalWindowStyle, css, true);
      debouncedUpdate("windowStyle", css);
    },
    [debouncedUpdate, scheduleStyleUpdate]
  );

  useEffect(() => {
    originCssRef.current = parseCssToObject(localOriginStyle);
  }, [localOriginStyle]);
  useEffect(() => {
    transCssRef.current = parseCssToObject(localTransStyle);
  }, [localTransStyle]);
  useEffect(() => {
    windowCssRef.current = parseCssToObject(localWindowStyle);
  }, [localWindowStyle]);

  const originCssObj = useMemo(
    () => parseCssToObject(localOriginStyle),
    [localOriginStyle]
  );
  const transCssObj = useMemo(
    () => parseCssToObject(localTransStyle),
    [localTransStyle]
  );
  const windowCssObj = useMemo(
    () => parseCssToObject(localWindowStyle),
    [localWindowStyle]
  );

  const originFontSize = parseFontSize(originCssObj["font-size"] || "");
  const transFontSize = parseFontSize(transCssObj["font-size"] || "");

  const windowPadding = parsePadding(windowCssObj["padding"] || "0.5em 1em");
  const windowBgRgba = parseRgba(
    windowCssObj["background-color"] || "rgba(0, 0, 0, 0.5)"
  ) || { r: 0, g: 0, b: 0, a: 0.5 };
  const windowBgHex = rgbToHex(windowBgRgba.r, windowBgRgba.g, windowBgRgba.b);
  const windowLineHeight = parseFloat(windowCssObj["line-height"]) || 1.3;
  const windowHasTextShadow = !!windowCssObj["text-shadow"];

  const textStyleControls = useCallback(
    (label, fontSize, cssObj, updateCss) => {
      const isCustomFontSize = fontSize.mode === "custom";
      const sizeDisplay = isCustomFontSize
        ? fontSize.raw
        : fontSize.mode === "unit"
          ? `${fontSize.preferred}${fontSize.unit}`
          : String(fontSize.preferred);
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ minWidth: 56, flexShrink: 0 }}
              >
                {i18n("font_size", "字体大小")}
              </Typography>
              {isCustomFontSize ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ flex: 1, fontFamily: "ui-monospace, monospace" }}
                >
                  {sizeDisplay}
                </Typography>
              ) : (
                <>
                  <Slider
                    size="small"
                    aria-label={`${label} ${i18n("font_size", "Font size")}`}
                    value={fontSize.preferred}
                    min={fontSize.sliderMin}
                    max={fontSize.sliderMax}
                    step={fontSize.step}
                    onChange={(_e, val) => {
                      updateCss(
                        "font-size",
                        formatFontSizeFromSlider(fontSize, val)
                      );
                    }}
                    sx={{ flex: 1 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 36, textAlign: "right" }}
                  >
                    {sizeDisplay}
                  </Typography>
                </>
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ minWidth: 56, flexShrink: 0 }}
              >
                {i18n("font_color", "字体颜色")}
              </Typography>
              <Box
                component="input"
                type="color"
                aria-label={`${label} ${i18n("font_color", "Font color")}`}
                value={colorToHex(cssObj["color"])}
                onChange={(e) => updateCss("color", e.target.value)}
                sx={{
                  width: 48,
                  height: 48,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "8px",
                  cursor: "pointer",
                  p: 0,
                  bgcolor: "transparent",
                  "&::-webkit-color-swatch-wrapper": { p: "3px" },
                  "&::-webkit-color-swatch": {
                    border: 0,
                    borderRadius: "6px",
                  },
                  "&::-moz-color-swatch": {
                    border: 0,
                    borderRadius: "6px",
                  },
                }}
              />
              <TextField
                size="small"
                value={cssObj["color"] || ""}
                onChange={(e) =>
                  updateCss("color", e.target.value, { immediate: true })
                }
                placeholder="#ffffff"
                inputProps={{
                  "aria-label": `${label} ${i18n("font_color", "Font color")}`,
                }}
                sx={{ flex: 1 }}
              />
            </Box>
          </Stack>
        </Box>
      );
    },
    [i18n]
  );

  return (
    <Box>
      <Stack spacing={3}>
        <Alert severity="info">
          {i18n("subtitle_helper_1")}
          <br />
          {i18n("subtitle_helper_2")}
          <br />
          {i18n("subtitle_helper_3")}
        </Alert>

        <SettingsSection>
          <SettingsCard>
            <SettingsRow label={i18n("toggle_subtitle_translate")}>
              <SettingsSwitch
                checked={enabled}
                label={i18n("toggle_subtitle_translate")}
                onChange={(checked) => updateSubtitle({ enabled: checked })}
              />
            </SettingsRow>
            <SettingsRow
              label={i18n("settings_subtitle_auto_start")}
              description={i18n("settings_subtitle_auto_start_description")}
            >
              <SettingsSwitch
                checked={autoTranslate}
                disabled={!enabled}
                label={i18n("settings_subtitle_auto_start")}
                onChange={(checked) =>
                  updateSubtitle({ autoTranslate: checked })
                }
              />
            </SettingsRow>
            <SettingsRow label={i18n("is_bilingual_view")}>
              <SettingsSwitch
                checked={isBilingual}
                label={i18n("is_bilingual_view")}
                onChange={(checked) => updateSubtitle({ isBilingual: checked })}
              />
            </SettingsRow>
            <SettingsRow label={i18n("trans_order")}>
              <SettingsSegmented
                value={displayOrder}
                label={i18n("trans_order")}
                onChange={(value) => updateSubtitle({ displayOrder: value })}
                items={[
                  { value: "original-first", label: i18n("original_first") },
                  {
                    value: "translation-first",
                    label: i18n("translation_first"),
                  },
                ]}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={i18n("settings_quality_group")}>
          <SettingsCard>
            <SettingsRow label={i18n("translate_service")}>
              <SettingsSelect
                value={safeApiSlug}
                label={i18n("translate_service")}
                onChange={(value) => updateSubtitle({ apiSlug: value })}
                options={safeApiOptions}
              />
            </SettingsRow>
            <SettingsRow label={i18n("ai_segmentation")}>
              <TextField
                select
                hiddenLabel
                size="small"
                variant="filled"
                className="kt-settings-select"
                name="segSlug"
                value={safeSegSlug}
                inputProps={{ "aria-label": i18n("ai_segmentation") }}
                onChange={handleChange}
                helperText={
                  forceSubtitleRetranslate &&
                  safeSegSlug !== "-" &&
                  safeSegSlug !== safeApiSlug
                    ? i18n(
                        "seg_trans_diff_warning",
                        "断句和翻译服务不同，翻译引擎会重复翻译字幕"
                      )
                    : ""
                }
                FormHelperTextProps={{
                  sx: { color: "error.main" },
                }}
              >
                <MenuItem value={"-"}>{i18n("disable")}</MenuItem>
                {aiEnabledApis.map((api) => (
                  <MenuItem key={api.apiSlug} value={api.apiSlug}>
                    {getApiDisplayName(api)}
                  </MenuItem>
                ))}
              </TextField>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsAdvanced label={i18n("settings_detailed_controls")}>
          <Grid container spacing={2} columns={12}>
            {safeSegSlug !== "-" && (
              <Grid item xs={12} sm={12} md={6} lg={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  name="segPromptSlug"
                  value={segPromptValue}
                  label={i18n("seg_prompt_mode", "AI断句提示词")}
                  onChange={handleSegPromptChange}
                >
                  <MenuItem value={PROMPT_MODE_FOLLOW_API}>
                    {i18n("follow_api_prompt", "接口默认")}
                  </MenuItem>
                  {subtitlePromptOptions.map((prompt) => (
                    <MenuItem key={prompt.slug} value={prompt.slug}>
                      {getPromptDisplayName(prompt, i18n)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                fullWidth
                select
                size="small"
                name="forceSubtitleRetranslate"
                value={forceSubtitleRetranslate}
                label={i18n("force_subtitle_retranslate")}
                onChange={handleChange}
              >
                <MenuItem value={true}>{i18n("enable")}</MenuItem>
                <MenuItem value={false}>{i18n("disable")}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                fullWidth
                size="small"
                name="aiContextSlug"
                value={safeAiContextSlug}
                label={i18n("ai_enhanced_context")}
                onChange={handleChange}
              >
                <MenuItem value={"-"}>{i18n("disable")}</MenuItem>
                {aiEnabledApis.map((api) => (
                  <MenuItem key={api.apiSlug} value={api.apiSlug}>
                    {getApiDisplayName(api)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <ValidationInput
                fullWidth
                size="small"
                label={i18n("ai_chunk_length")}
                type="number"
                name="chunkLength"
                value={chunkLength}
                onChange={handleChange}
                min={200}
                max={20000}
              />
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <ValidationInput
                fullWidth
                size="small"
                label={i18n("long_sentence_threshold")}
                type="number"
                name="longSentenceThreshold"
                value={longSentenceThreshold}
                onChange={handleChange}
                min={20}
                max={500}
              />
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <ValidationInput
                fullWidth
                size="small"
                label={i18n("pre_trans_seconds")}
                type="number"
                name="preTrans"
                value={preTrans}
                onChange={handleChange}
                min={10}
                max={36000}
              />
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <ValidationInput
                fullWidth
                size="small"
                label={i18n("throttle_trans_interval")}
                type="number"
                name="throttleTrans"
                value={throttleTrans}
                onChange={handleChange}
                min={1}
                max={3600}
              />
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                fullWidth
                select
                size="small"
                name="toLang"
                value={safeToLang}
                label={i18n("to_lang")}
                onChange={handleChange}
              >
                {OPT_LANGS_TO.map(([lang, name]) => (
                  <MenuItem key={lang} value={lang}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                fullWidth
                select
                size="small"
                name="showLoadNotification"
                value={showLoadNotification}
                label={i18n("subtitle_loading_notification")}
                onChange={handleChange}
              >
                <MenuItem value={true}>{i18n("show")}</MenuItem>
                <MenuItem value={false}>{i18n("hide")}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                fullWidth
                select
                size="small"
                name="hideSubtitleButton"
                value={hideSubtitleButton}
                label={i18n("hide_subtitle_button")}
                onChange={handleChange}
              >
                <MenuItem value={true}>{i18n("enable")}</MenuItem>
                <MenuItem value={false}>{i18n("disable")}</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </SettingsAdvanced>

        <SettingsSection title={i18n("settings_appearance_group")}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "12px",
              p: 2,
            }}
          >
            <Stack spacing={2} useFlexGap>
              <SubtitleStylePreview
                windowStyle={localWindowStyle}
                originStyle={localOriginStyle}
                translationStyle={localTransStyle}
                displayOrder={displayOrder}
              />

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {textStyleControls(
                    i18n("origin_styles"),
                    originFontSize,
                    originCssObj,
                    updateOriginCss
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {textStyleControls(
                    i18n("translation_styles"),
                    transFontSize,
                    transCssObj,
                    updateTranslationCss
                  )}
                </Grid>
              </Grid>

              <Divider />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {i18n("background_styles")}
                </Typography>
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ minWidth: 56, flexShrink: 0 }}
                      >
                        {i18n("background_color", "背景颜色")}
                      </Typography>
                      <Box
                        component="input"
                        type="color"
                        aria-label={i18n(
                          "background_color",
                          "Background color"
                        )}
                        value={windowBgHex}
                        onChange={(e) => {
                          const rgb = hexToRgb(e.target.value);
                          updateWindowCss(
                            "background-color",
                            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${windowBgRgba.a})`
                          );
                        }}
                        sx={{
                          width: 48,
                          height: 48,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "8px",
                          cursor: "pointer",
                          p: 0,
                          bgcolor: "transparent",
                          "&::-webkit-color-swatch-wrapper": { p: "3px" },
                          "&::-webkit-color-swatch": {
                            border: 0,
                            borderRadius: "6px",
                          },
                          "&::-moz-color-swatch": {
                            border: 0,
                            borderRadius: "6px",
                          },
                        }}
                      />
                      <Typography variant="body2" sx={{ minWidth: 48 }}>
                        {i18n("opacity", "透明度")}
                      </Typography>
                      <Slider
                        size="small"
                        aria-label={i18n("opacity", "Opacity")}
                        value={windowBgRgba.a}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(_e, val) => {
                          updateWindowCss(
                            "background-color",
                            `rgba(${windowBgRgba.r}, ${windowBgRgba.g}, ${windowBgRgba.b}, ${val})`
                          );
                        }}
                        sx={{ flex: 1 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ minWidth: 36, textAlign: "right" }}
                      >
                        {Math.round(windowBgRgba.a * 100)}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ minWidth: 56, flexShrink: 0 }}
                      >
                        {i18n("line_height", "行高")}
                      </Typography>
                      <Slider
                        size="small"
                        aria-label={i18n("line_height", "Line height")}
                        value={windowLineHeight}
                        min={1}
                        max={2.5}
                        step={0.1}
                        onChange={(_e, val) =>
                          updateWindowCss("line-height", String(val))
                        }
                        sx={{ flex: 1 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ minWidth: 28, textAlign: "right" }}
                      >
                        {windowLineHeight}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 2,
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ minWidth: 56, flexShrink: 0 }}
                      >
                        {i18n("padding", "内边距")}
                      </Typography>
                      <Typography variant="body2">
                        {i18n("vertical", "上下")}
                      </Typography>
                      <Slider
                        size="small"
                        aria-label={`${i18n("padding", "Padding")} ${i18n("vertical", "Vertical")}`}
                        value={windowPadding.vertical}
                        min={0}
                        max={windowPadding.verticalMax}
                        step={windowPadding.step}
                        onChange={(_e, val) => {
                          updateWindowCss(
                            "padding",
                            `${val}${windowPadding.unit} ${windowPadding.horizontal}${windowPadding.unit}`
                          );
                        }}
                        sx={{ width: 80, flex: "1 1 80px" }}
                      />
                      <Typography variant="body2">
                        {i18n("horizontal", "左右")}
                      </Typography>
                      <Slider
                        size="small"
                        aria-label={`${i18n("padding", "Padding")} ${i18n("horizontal", "Horizontal")}`}
                        value={windowPadding.horizontal}
                        min={0}
                        max={windowPadding.horizontalMax}
                        step={windowPadding.step}
                        onChange={(_e, val) => {
                          updateWindowCss(
                            "padding",
                            `${windowPadding.vertical}${windowPadding.unit} ${val}${windowPadding.unit}`
                          );
                        }}
                        sx={{ width: 80, flex: "1 1 80px" }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={windowHasTextShadow}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateWindowCss(
                                "text-shadow",
                                "1px 1px 2px black"
                              );
                            } else {
                              const newObj = { ...windowCssRef.current };
                              delete newObj["text-shadow"];
                              updateWindowCssDirect(objectToCss(newObj));
                            }
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {i18n("text_shadow", "文字阴影")}
                        </Typography>
                      }
                    />
                  </Grid>
                </Grid>
              </Box>

              <Accordion
                sx={{ boxShadow: "none", "&:before": { display: "none" } }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" color="text.secondary">
                    {i18n("advanced_css", "高级 CSS 编辑")}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <CodeField
                        size="small"
                        label={i18n("origin_styles")}
                        name="originStyle"
                        value={localOriginStyle}
                        onChange={handleChange}
                        maxRows={10}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CodeField
                        size="small"
                        label={i18n("translation_styles")}
                        name="translationStyle"
                        value={localTransStyle}
                        onChange={handleChange}
                        maxRows={10}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CodeField
                        size="small"
                        label={i18n("background_styles")}
                        name="windowStyle"
                        value={localWindowStyle}
                        onChange={handleChange}
                        maxRows={10}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Stack>
          </Box>
        </SettingsSection>
      </Stack>
    </Box>
  );
}

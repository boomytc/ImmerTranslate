import { useEffect, useMemo, useRef, useState } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import CodeField from "./CodeField";
import Button from "@mui/material/Button";
import { useI18n } from "../../hooks/I18n";
import { useAlert } from "../../hooks/Alert";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import { useConfirm } from "../../hooks/Confirm";
import Box from "@mui/material/Box";
import {
  getCompactStylePreviewCode,
  toPersistedCustomStyle,
  useAllTextStyles,
  useStyleList,
} from "../../hooks/CustomStyles";
import { css } from "@emotion/css";
import { normalizeUiLang } from "../../config/i18n";
import { useSetting } from "../../hooks/Setting";
import { kissLog } from "../../libs/log";
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
} from "./SettingsCard";

const UI_LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

/**
 * 单个自定义 CSS 样式编辑表单区域
 */
function StyleFields({ customStyle, deleteStyle, updateStyle, isBuiltin }) {
  const i18n = useI18n();
  const alert = useAlert();
  const [formData, setFormData] = useState(() => customStyle || {});
  const [saving, setSaving] = useState(false);
  const lastSyncedStyleRef = useRef(JSON.stringify(customStyle || {}));
  const confirm = useConfirm();

  useEffect(() => {
    const nextSnapshot = JSON.stringify(customStyle || {});
    if (lastSyncedStyleRef.current === nextSnapshot) {
      return;
    }
    lastSyncedStyleRef.current = nextSnapshot;
    setFormData(customStyle || {});
  }, [customStyle]);

  const isModified = useMemo(
    () => JSON.stringify(customStyle || {}) !== JSON.stringify(formData),
    [customStyle, formData]
  );

  const handleChange = (e) => {
    e.preventDefault();
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateStyle(
        customStyle.styleSlug,
        toPersistedCustomStyle(formData)
      );
      alert.success(i18n("save_success"));
    } catch (error) {
      kissLog("save custom style", error);
      alert.error(i18n("error_got_some_wrong"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const displayName =
      customStyle.styleName || formData.styleName || customStyle.styleSlug;
    const isConfirmed = await confirm({
      message: i18n("delete_style_confirm").replace("{name}", displayName),
      confirmText: i18n("delete"),
      cancelText: i18n("cancel"),
    });

    if (isConfirmed) {
      deleteStyle(customStyle.styleSlug);
    }
  };

  const { styleName = "", styleCode = "" } = formData;

  const textClass = useMemo(
    () => css`
      ${styleCode}
    `,
    [styleCode]
  );

  return (
    <Stack spacing={3}>
      <Box>
        <span className={textClass}>{i18n("style_preview_translation")}</span>
      </Box>

      <TextField
        size="small"
        label={i18n("style_name")}
        name="styleName"
        value={styleName}
        onChange={handleChange}
        disabled={isBuiltin}
      />
      <CodeField
        size="small"
        label={i18n("style_code")}
        name="styleCode"
        value={styleCode}
        onChange={handleChange}
        maxRows={10}
        disabled={isBuiltin}
      />

      {!isBuiltin && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          useFlexGap
          flexWrap="wrap"
        >
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={!isModified || saving}
          >
            {i18n("save")}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={handleDelete}
          >
            {i18n("delete")}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

/**
 * 样式的折叠手风琴壳组件
 */
export function StyleAccordion({ customStyle, deleteStyle, updateStyle }) {
  const [expanded, setExpanded] = useState(false);
  const i18n = useI18n();
  const { isBuiltin } = customStyle;
  const previewCode = getCompactStylePreviewCode(customStyle);
  const previewClass = useMemo(
    () =>
      previewCode
        ? css`
            ${previewCode}
          `
        : undefined,
    [previewCode]
  );

  const handleChange = () => {
    setExpanded((pre) => !pre);
  };

  return (
    <Accordion
      className="kt-style-card"
      expanded={expanded}
      onChange={handleChange}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box className="kt-style-card__summary">
          <span>{i18n("style_preview_source")}</span>
          <span className={previewClass}>
            {i18n("style_preview_translation")}
          </span>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {customStyle.styleName}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {expanded && (
          <StyleFields
            customStyle={customStyle}
            deleteStyle={deleteStyle}
            updateStyle={updateStyle}
            isBuiltin={isBuiltin}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * 译文展现样式设置主页面组件 (StylesSetting)
 */
export default function StylesSetting() {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const [showStyleManager, setShowStyleManager] = useState(false);
  const [hasOpenedStyleManager, setHasOpenedStyleManager] = useState(false);
  const { addStyle, deleteStyle, updateStyle } = useStyleList();
  const { builtinStyles, customStyles } = useAllTextStyles();

  const handleClick = (e) => {
    e.preventDefault();
    addStyle();
  };

  const setStyleManagerVisibility = (visible) => {
    if (visible) setHasOpenedStyleManager(true);
    setShowStyleManager(visible);
  };

  const darkMode = setting.darkMode || "auto";
  const uiLang = normalizeUiLang(setting.uiLang);

  return (
    <Box>
      <SettingsSection title={i18n("settings_interface_theme")}>
        <SettingsCard>
          <SettingsRow label={i18n("ui_lang")}>
            <SettingsSegmented
              value={uiLang}
              label={i18n("ui_lang")}
              onChange={(value) => updateSetting({ uiLang: value })}
              items={UI_LANGUAGE_OPTIONS}
            />
          </SettingsRow>
          <SettingsRow label={i18n("settings_appearance_mode")}>
            <SettingsSegmented
              value={darkMode}
              label={i18n("settings_appearance_mode")}
              onChange={(value) => updateSetting({ darkMode: value })}
              items={[
                { value: "light", label: i18n("settings_theme_light") },
                { value: "dark", label: i18n("settings_theme_dark") },
                { value: "auto", label: i18n("settings_theme_system") },
              ]}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={i18n("settings_translation_styles")}>
        <SettingsCard>
          <SettingsRow
            label={i18n("settings_style_library")}
            description={i18n("settings_style_library_description")
              .replace("{0}", String(customStyles.length))
              .replace("{1}", String(builtinStyles.length))}
          >
            <Button
              size="small"
              variant={showStyleManager ? "outlined" : "contained"}
              onClick={() => setStyleManagerVisibility(!showStyleManager)}
            >
              {showStyleManager ? i18n("hide") : i18n("edit")}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {hasOpenedStyleManager && (
        <Stack
          className="kt-style-manager"
          spacing={3}
          hidden={!showStyleManager}
          aria-hidden={!showStyleManager}
          sx={{ display: showStyleManager ? "flex" : "none" }}
        >
          <Box>
            <Button
              size="small"
              id="add-style-button"
              variant="contained"
              onClick={handleClick}
              startIcon={<AddIcon />}
            >
              {i18n("add")}
            </Button>
          </Box>

          <section>
            <Typography component="h2" className="kt-options-section-title">
              {i18n("custom_styles")}
            </Typography>
            {customStyles.length > 0 ? (
              <Box className="kt-style-grid">
                {customStyles.map((customStyle) => (
                  <StyleAccordion
                    key={customStyle.styleSlug}
                    customStyle={customStyle}
                    deleteStyle={deleteStyle}
                    updateStyle={updateStyle}
                  />
                ))}
              </Box>
            ) : (
              <div className="kt-empty-state">
                {i18n("custom_styles_empty")}
              </div>
            )}
          </section>
          <section>
            <Typography component="h2" className="kt-options-section-title">
              {i18n("builtin_styles")}
            </Typography>
            <Box className="kt-style-grid">
              {builtinStyles.map((customStyle) => (
                <StyleAccordion
                  key={customStyle.styleSlug}
                  customStyle={customStyle}
                  deleteStyle={deleteStyle}
                  updateStyle={updateStyle}
                />
              ))}
            </Box>
          </section>
        </Stack>
      )}
    </Box>
  );
}

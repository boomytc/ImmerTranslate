import { useEffect, useMemo, useRef, useState } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import CodeField from "./CodeField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import { css } from "@emotion/css";
import { useI18n } from "../../hooks/I18n";
import { useAlert } from "../../hooks/Alert";
import { useConfirm } from "../../hooks/Confirm";
import {
  toPersistedCustomStyle,
  useAllTextStyles,
  useStyleList,
} from "../../hooks/CustomStyles";
import { normalizeUiLang } from "../../config/i18n";
import { useSetting } from "../../hooks/Setting";
import { kissLog } from "../../libs/log";
import { createM3CssVariables, resolveM3Colors } from "../../styles/m3";
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

function StyleRailItem({ styleItem, selected, onSelect }) {
  const i18n = useI18n();
  const sampleClass = useMemo(
    () =>
      styleItem.styleCode
        ? css`
            ${styleItem.styleCode}
          `
        : undefined,
    [styleItem.styleCode]
  );

  return (
    <ListItem disablePadding className="kt-master-row">
      <ListItemButton
        className="kt-master-row__btn kt-style-list-btn"
        selected={selected}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
        <span className="kt-style-list-btn__name">{styleItem.styleName}</span>
        <span className="kt-style-list-btn__sample">
          <span className={sampleClass}>
            {i18n("style_preview_translation")}
          </span>
        </span>
      </ListItemButton>
    </ListItem>
  );
}

/**
 * 单个译文 CSS 样式编辑表单区域
 */
function StyleEditor({
  selectedStyle,
  formData,
  onFieldChange,
  deleteStyle,
  updateStyle,
}) {
  const i18n = useI18n();
  const alert = useAlert();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const isBuiltin = Boolean(selectedStyle?.isBuiltin);

  const isModified = useMemo(
    () =>
      !isBuiltin &&
      JSON.stringify(toPersistedCustomStyle(selectedStyle || {})) !==
        JSON.stringify(toPersistedCustomStyle(formData || {})),
    [formData, isBuiltin, selectedStyle]
  );

  const handleSave = async () => {
    if (saving || isBuiltin || !selectedStyle) return;
    setSaving(true);
    try {
      await updateStyle(
        selectedStyle.styleSlug,
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
    if (isBuiltin || !selectedStyle) return;
    const displayName =
      selectedStyle.styleName || formData.styleName || selectedStyle.styleSlug;
    const isConfirmed = await confirm({
      message: i18n("delete_style_confirm").replace("{name}", displayName),
      confirmText: i18n("delete"),
      cancelText: i18n("cancel"),
    });

    if (isConfirmed) {
      deleteStyle(selectedStyle.styleSlug);
    }
  };

  const { styleName = "", styleCode = "" } = formData || {};

  return (
    <Stack spacing={2.5}>
      <TextField
        size="small"
        label={i18n("style_name")}
        name="styleName"
        value={styleName}
        onChange={onFieldChange}
        disabled={isBuiltin}
      />
      <CodeField
        size="small"
        label={i18n("style_code")}
        name="styleCode"
        value={styleCode}
        onChange={onFieldChange}
        minRows={4}
        maxRows={12}
        disabled={isBuiltin}
      />

      {!isBuiltin && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
        >
          <Button
            size="small"
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!isModified || saving}
          >
            {i18n("save")}
          </Button>
          <Button
            size="small"
            variant="text"
            color="error"
            startIcon={<DeleteIcon />}
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
 * 译文展现样式设置主页面组件 (StylesSetting)
 */
export default function StylesSetting() {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const { addStyle, deleteStyle, updateStyle } = useStyleList();
  const { builtinStyles, customStyles, allTextStyles } = useAllTextStyles();
  const [selectedSlug, setSelectedSlug] = useState("");
  const [previewBg, setPreviewBg] = useState("light");
  const [draftStyle, setDraftStyle] = useState(null);
  const pendingSelectNewRef = useRef(false);
  const prevCustomCountRef = useRef(customStyles.length);

  useEffect(() => {
    if (
      pendingSelectNewRef.current &&
      customStyles.length > prevCustomCountRef.current
    ) {
      const newest = customStyles[customStyles.length - 1];
      if (newest?.styleSlug) {
        setSelectedSlug(newest.styleSlug);
      }
      pendingSelectNewRef.current = false;
    }
    prevCustomCountRef.current = customStyles.length;
  }, [customStyles]);

  useEffect(() => {
    if (allTextStyles.length === 0) {
      setSelectedSlug("");
      return;
    }
    const exists = allTextStyles.some(
      (item) => item.styleSlug === selectedSlug
    );
    if (!exists) {
      const fallback = customStyles[0] || builtinStyles[0] || allTextStyles[0];
      if (fallback) setSelectedSlug(fallback.styleSlug);
    }
  }, [allTextStyles, builtinStyles, customStyles, selectedSlug]);

  const selectedStyle = useMemo(
    () =>
      allTextStyles.find((item) => item.styleSlug === selectedSlug) ||
      allTextStyles[0] ||
      null,
    [allTextStyles, selectedSlug]
  );

  const selectedSnapshot = useMemo(
    () => JSON.stringify(selectedStyle || {}),
    [selectedStyle]
  );

  useEffect(() => {
    setDraftStyle(selectedStyle ? { ...selectedStyle } : null);
  }, [selectedSnapshot, selectedStyle]);

  const activeDraft =
    draftStyle && draftStyle.styleSlug === selectedStyle?.styleSlug
      ? draftStyle
      : selectedStyle || {};

  const stagePreviewClass = useMemo(
    () =>
      activeDraft.styleCode
        ? css`
            ${activeDraft.styleCode}
          `
        : undefined,
    [activeDraft.styleCode]
  );

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setDraftStyle((prev) => ({
      ...(prev || selectedStyle || {}),
      [name]: value,
    }));
  };

  const handleAddStyle = (event) => {
    event.preventDefault();
    pendingSelectNewRef.current = true;
    addStyle();
  };

  const darkMode = setting.darkMode || "auto";
  const uiLang = normalizeUiLang(setting.uiLang);
  const previewColors = resolveM3Colors(previewBg);

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

      <SettingsSection
        title={i18n("settings_translation_styles")}
        action={
          <Button
            size="small"
            id="add-style-button"
            variant="outlined"
            onClick={handleAddStyle}
            startIcon={<AddIcon />}
          >
            {i18n("add")}
          </Button>
        }
      >
        <Box className="kt-preview-stage">
          <Box className="kt-preview-stage__header">
            <h3 className="kt-preview-stage__title">
              {activeDraft.styleName || i18n("settings_style_library")}
            </h3>
            <SettingsSegmented
              className="kt-preview-stage__toggle"
              value={previewBg}
              label={i18n("settings_appearance_mode")}
              onChange={setPreviewBg}
              items={[
                { value: "light", label: i18n("preview_bg_light") },
                { value: "dark", label: i18n("preview_bg_dark") },
              ]}
            />
          </Box>
          <Box
            className="kt-style-stage__canvas kt-m3-root"
            data-theme={previewBg}
            style={{
              ...createM3CssVariables(previewColors),
              colorScheme: previewBg,
            }}
          >
            <p className="kt-style-stage__source">
              {i18n("style_stage_source")}
            </p>
            <p className="kt-style-stage__translation">
              <span className={stagePreviewClass}>
                {i18n("style_stage_translation")}
              </span>
            </p>
          </Box>
        </Box>

        <Box className="kt-style-workbench">
          <Box className="kt-master-rail">
            <List
              disablePadding
              className="kt-master-rail__list"
              aria-label={i18n("settings_style_library")}
            >
              <li className="kt-master-rail__group">{i18n("custom_styles")}</li>
              {customStyles.length > 0 ? (
                customStyles.map((item) => (
                  <StyleRailItem
                    key={item.styleSlug}
                    styleItem={
                      item.styleSlug === activeDraft.styleSlug
                        ? activeDraft
                        : item
                    }
                    selected={item.styleSlug === selectedStyle?.styleSlug}
                    onSelect={() => setSelectedSlug(item.styleSlug)}
                  />
                ))
              ) : (
                <li className="kt-master-rail__empty">
                  {i18n("custom_styles_empty")}
                </li>
              )}

              <li className="kt-master-rail__group">
                {i18n("builtin_styles")}
              </li>
              {builtinStyles.map((item) => (
                <StyleRailItem
                  key={item.styleSlug}
                  styleItem={item}
                  selected={item.styleSlug === selectedStyle?.styleSlug}
                  onSelect={() => setSelectedSlug(item.styleSlug)}
                />
              ))}
            </List>
          </Box>

          <Box className="kt-master-detail-pane">
            {selectedStyle && (
              <StyleEditor
                selectedStyle={selectedStyle}
                formData={activeDraft}
                onFieldChange={handleFieldChange}
                deleteStyle={deleteStyle}
                updateStyle={updateStyle}
              />
            )}
          </Box>
        </Box>
      </SettingsSection>
    </Box>
  );
}

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockIcon from "@mui/icons-material/Lock";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useConfirm } from "../../hooks/Confirm";
import { useAlert } from "../../hooks/Alert";
import { useI18n } from "../../hooks/I18n";
import { kissLog } from "../../libs/log";
import {
  INPUT_PLACE_DESCRIPTION,
  INPUT_PLACE_CONTEXT,
  INPUT_PLACE_FROM,
  INPUT_PLACE_FROM_LANG,
  INPUT_PLACE_GLOSSARY,
  INPUT_PLACE_SEGMENTS,
  INPUT_PLACE_SUMMARY,
  INPUT_PLACE_TEXT,
  INPUT_PLACE_TITLE,
  INPUT_PLACE_TO,
  INPUT_PLACE_TO_LANG,
  INPUT_PLACE_TONE,
  PROMPT_CATEGORY_BATCH_SYSTEM,
  PROMPT_CATEGORY_DICTIONARY,
  PROMPT_CATEGORY_SUBTITLE,
  PROMPT_CATEGORY_USER,
  PROMPT_TEMPLATE_CATEGORIES,
  getPromptCategoryDisplayName,
  getPromptDisplayName,
  normalizePrompt,
} from "../../config";
import { usePromptList } from "../../hooks/Prompt";
import CodeField from "./CodeField";

const TRANSLATION_PROMPT_PLACEHOLDERS = [
  INPUT_PLACE_TEXT,
  INPUT_PLACE_TO,
  INPUT_PLACE_FROM,
  INPUT_PLACE_TO_LANG,
  INPUT_PLACE_FROM_LANG,
  INPUT_PLACE_TITLE,
  INPUT_PLACE_DESCRIPTION,
  INPUT_PLACE_SUMMARY,
  INPUT_PLACE_CONTEXT,
  INPUT_PLACE_TONE,
  INPUT_PLACE_GLOSSARY,
];

const BATCH_TRANSLATION_PROMPT_PLACEHOLDERS = [
  INPUT_PLACE_SEGMENTS,
  INPUT_PLACE_TO,
  INPUT_PLACE_FROM,
  INPUT_PLACE_TO_LANG,
  INPUT_PLACE_FROM_LANG,
  INPUT_PLACE_TITLE,
  INPUT_PLACE_DESCRIPTION,
  INPUT_PLACE_SUMMARY,
  INPUT_PLACE_CONTEXT,
  INPUT_PLACE_TONE,
  INPUT_PLACE_GLOSSARY,
];

const SUBTITLE_PROMPT_PLACEHOLDERS = [
  INPUT_PLACE_TO,
  INPUT_PLACE_FROM,
  INPUT_PLACE_TO_LANG,
  INPUT_PLACE_FROM_LANG,
  INPUT_PLACE_TITLE,
  INPUT_PLACE_DESCRIPTION,
  INPUT_PLACE_SUMMARY,
  INPUT_PLACE_TONE,
  INPUT_PLACE_GLOSSARY,
];

const DICTIONARY_PROMPT_PLACEHOLDERS = [
  INPUT_PLACE_TEXT,
  INPUT_PLACE_TO,
  INPUT_PLACE_FROM,
  INPUT_PLACE_TO_LANG,
  INPUT_PLACE_FROM_LANG,
  INPUT_PLACE_TITLE,
  INPUT_PLACE_DESCRIPTION,
  INPUT_PLACE_SUMMARY,
  INPUT_PLACE_CONTEXT,
];

function getPromptPlaceholders(category) {
  if (category === PROMPT_CATEGORY_SUBTITLE) {
    return SUBTITLE_PROMPT_PLACEHOLDERS;
  }

  if (category === PROMPT_CATEGORY_DICTIONARY) {
    return DICTIONARY_PROMPT_PLACEHOLDERS;
  }

  if (category === PROMPT_CATEGORY_BATCH_SYSTEM) {
    return BATCH_TRANSLATION_PROMPT_PLACEHOLDERS;
  }

  if (category === PROMPT_CATEGORY_USER) {
    return TRANSLATION_PROMPT_PLACEHOLDERS;
  }

  return [];
}

function PromptVariableMenu({ category, disabled, onInsert, idPrefix }) {
  const i18n = useI18n();
  const [anchorEl, setAnchorEl] = useState(null);
  const placeholders = getPromptPlaceholders(category);
  const open = Boolean(anchorEl);

  if (placeholders.length === 0 || disabled) {
    return null;
  }

  const menuId = `${idPrefix}-variable-menu`;

  return (
    <>
      <Button
        size="small"
        variant="text"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        endIcon={<KeyboardArrowDownIcon fontSize="small" />}
      >
        {i18n("insert_variable")}
      </Button>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
      >
        {placeholders.map((placeholder) => (
          <MenuItem
            key={placeholder}
            onClick={() => {
              setAnchorEl(null);
              onInsert(placeholder);
            }}
            sx={{ fontFamily: "var(--kt-font-mono)" }}
          >
            {placeholder}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function PromptListItem({ prompt, selected, isPreset, onSelect }) {
  const i18n = useI18n();

  return (
    <ListItem disablePadding className="kt-master-row">
      <ListItemButton
        className="kt-master-row__btn"
        selected={selected}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
        {isPreset ? (
          <LockIcon fontSize="small" color="action" />
        ) : (
          <TextSnippetIcon fontSize="small" color="action" />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <span className="kt-master-row__title">
            {getPromptDisplayName(prompt, i18n)}
          </span>
          <span className="kt-master-row__secondary">
            {getPromptCategoryDisplayName(
              normalizePrompt(prompt).category,
              i18n
            )}
          </span>
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

function PromptFields({
  prompt,
  isPreset,
  onSave,
  onCopy,
  onDelete,
  onCollapse,
  onDirtyChange,
}) {
  const i18n = useI18n();
  const alert = useAlert();
  const confirm = useConfirm();
  const [formData, setFormData] = useState(() => normalizePrompt(prompt));
  const [saving, setSaving] = useState(false);
  const lastSyncedPromptRef = useRef(JSON.stringify(normalizePrompt(prompt)));
  const promptDisplayName = getPromptDisplayName(prompt, i18n);
  const systemPromptRef = useRef(null);
  const userPromptRef = useRef(null);
  const selectionRangesRef = useRef({});
  const showUserPrompt =
    formData.category === PROMPT_CATEGORY_USER ||
    formData.category === PROMPT_CATEGORY_DICTIONARY ||
    formData.category === PROMPT_CATEGORY_BATCH_SYSTEM;

  useLayoutEffect(() => {
    const nextSnapshot = JSON.stringify(normalizePrompt(prompt));
    if (lastSyncedPromptRef.current === nextSnapshot) {
      return;
    }
    lastSyncedPromptRef.current = nextSnapshot;
    selectionRangesRef.current = {};
    setFormData(normalizePrompt(prompt));
  }, [prompt]);

  const isModified = useMemo(
    () =>
      !isPreset &&
      JSON.stringify(normalizePrompt(prompt)) !==
        JSON.stringify(normalizePrompt(formData)),
    [formData, isPreset, prompt]
  );

  useEffect(() => {
    onDirtyChange?.(isModified);
  }, [isModified, onDirtyChange]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(formData);
      alert.success(i18n("save_success"));
    } catch (error) {
      kissLog("save prompt", error);
      alert.error(i18n("error_got_some_wrong"));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setFormData(normalizePrompt(prompt));
  };

  const captureSelection = (name, event) => {
    const target = event?.target;
    if (!target) return;
    selectionRangesRef.current[name] = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
  };

  const handleInsertPlaceholder = (name, inputRef, placeholder) => {
    if (isPreset) {
      return;
    }

    const input = inputRef.current;
    const value = formData[name] || "";
    const savedRange = selectionRangesRef.current[name];
    const start =
      typeof savedRange?.start === "number"
        ? savedRange.start
        : (input?.selectionStart ?? value.length);
    const end =
      typeof savedRange?.end === "number"
        ? savedRange.end
        : (input?.selectionEnd ?? value.length);
    const nextValue =
      value.slice(0, start) + placeholder + value.slice(end, value.length);
    const nextCaret = start + placeholder.length;
    selectionRangesRef.current[name] = { start: nextCaret, end: nextCaret };

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    setTimeout(() => {
      input?.focus();
      input?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleDelete = async () => {
    const isConfirmed = await confirm({
      message: i18n("delete_prompt_named_confirm").replace(
        "{name}",
        promptDisplayName
      ),
      confirmText: i18n("delete"),
      cancelText: i18n("cancel"),
    });

    if (isConfirmed) {
      onDelete(formData.slug);
      onCollapse?.();
    }
  };

  return (
    <Stack spacing={3}>
      <TextField
        size="small"
        label={i18n("prompt_name")}
        name="name"
        value={isPreset ? promptDisplayName : formData.name}
        onChange={handleChange}
        disabled={isPreset}
      />

      <Stack spacing={0.75}>
        <Box className="kt-prompt-field-header">
          <span className="kt-prompt-field-header__label">
            {i18n("system_prompt")}
          </span>
          <PromptVariableMenu
            idPrefix="system-prompt"
            category={formData.category}
            disabled={isPreset}
            onInsert={(placeholder) =>
              handleInsertPlaceholder(
                "systemPrompt",
                systemPromptRef,
                placeholder
              )
            }
          />
        </Box>
        <CodeField
          className="kt-resizable-text-field"
          hiddenLabel
          size="small"
          name="systemPrompt"
          value={formData.systemPrompt}
          onChange={handleChange}
          onSelect={(event) => captureSelection("systemPrompt", event)}
          onKeyUp={(event) => captureSelection("systemPrompt", event)}
          onBlur={(event) => captureSelection("systemPrompt", event)}
          inputRef={systemPromptRef}
          minRows={3}
          maxRows={14}
          disabled={isPreset}
          inputProps={{
            "aria-label": i18n("system_prompt"),
            className: "kt-resizable-textarea",
            style: { resize: "vertical" },
          }}
          sx={{
            "& .MuiInputBase-root": {
              overflow: "visible",
            },
            '& textarea:not([aria-hidden="true"])': {
              resize: "vertical",
            },
          }}
        />
      </Stack>

      {showUserPrompt && (
        <Stack spacing={0.75}>
          <Box className="kt-prompt-field-header">
            <span className="kt-prompt-field-header__label">
              {i18n("user_prompt")}
            </span>
            <PromptVariableMenu
              idPrefix="user-prompt"
              category={formData.category}
              disabled={isPreset}
              onInsert={(placeholder) =>
                handleInsertPlaceholder(
                  "userPrompt",
                  userPromptRef,
                  placeholder
                )
              }
            />
          </Box>
          <CodeField
            className="kt-resizable-text-field"
            hiddenLabel
            size="small"
            name="userPrompt"
            value={formData.userPrompt}
            onChange={handleChange}
            onSelect={(event) => captureSelection("userPrompt", event)}
            onKeyUp={(event) => captureSelection("userPrompt", event)}
            onBlur={(event) => captureSelection("userPrompt", event)}
            inputRef={userPromptRef}
            minRows={3}
            maxRows={14}
            disabled={isPreset}
            inputProps={{
              "aria-label": i18n("user_prompt"),
              className: "kt-resizable-textarea",
              style: { resize: "vertical" },
            }}
            sx={{
              "& .MuiInputBase-root": {
                overflow: "visible",
              },
              '& textarea:not([aria-hidden="true"])': {
                resize: "vertical",
              },
            }}
          />
        </Stack>
      )}

      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
      >
        {!isPreset && (
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={!isModified || saving}
            startIcon={<SaveIcon />}
          >
            {i18n("save")}
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          onClick={() => onCopy(formData, promptDisplayName)}
          startIcon={<ContentCopyIcon />}
        >
          {i18n("copy_as_template")}
        </Button>
        {isModified && (
          <Button
            size="small"
            variant="text"
            onClick={handleDiscard}
            startIcon={<RestoreIcon />}
          >
            {i18n("discard_changes")}
          </Button>
        )}
        {!isPreset && (
          <Button
            size="small"
            variant="text"
            color="error"
            onClick={handleDelete}
            startIcon={<DeleteIcon />}
          >
            {i18n("delete")}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

export default function Prompts() {
  const i18n = useI18n();
  const confirm = useConfirm();
  const {
    prompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    copyPrompt,
    isPresetPromptSlug,
  } = usePromptList();
  const [selectedPromptSlug, setSelectedPromptSlug] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const detailPanelRef = useRef(null);
  const prevSelectedSlugRef = useRef("");
  const addMenuOpen = Boolean(anchorEl);

  useEffect(() => {
    if (prompts.length === 0) {
      setSelectedPromptSlug("");
      return;
    }

    const selectedExists = prompts.some(
      (prompt) => normalizePrompt(prompt).slug === selectedPromptSlug
    );
    if (!selectedExists) {
      setSelectedPromptSlug(normalizePrompt(prompts[0]).slug);
    }
  }, [prompts, selectedPromptSlug]);

  useLayoutEffect(() => {
    if (
      prevSelectedSlugRef.current &&
      selectedPromptSlug &&
      prevSelectedSlugRef.current !== selectedPromptSlug
    ) {
      detailPanelRef.current?.scrollIntoView?.({ block: "nearest" });
    }
    prevSelectedSlugRef.current = selectedPromptSlug;
  }, [selectedPromptSlug]);

  const selectedPrompt = useMemo(
    () =>
      prompts.find(
        (prompt) => normalizePrompt(prompt).slug === selectedPromptSlug
      ),
    [prompts, selectedPromptSlug]
  );

  const promptTemplateGroups = useMemo(
    () =>
      PROMPT_TEMPLATE_CATEGORIES.map((category) => ({
        category,
        templates: prompts.filter(
          (prompt) =>
            isPresetPromptSlug(normalizePrompt(prompt).slug) &&
            normalizePrompt(prompt).category === category
        ),
      })).filter((group) => group.templates.length > 0),
    [isPresetPromptSlug, prompts]
  );

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const confirmDiscardChanges = async () => {
    if (!editorDirty) return true;
    return confirm({
      message: i18n("discard_prompt_changes_confirm"),
      confirmText: i18n("discard_changes"),
      cancelText: i18n("cancel"),
    });
  };

  const handleAddPromptFromTemplate = async (template) => {
    if (!(await confirmDiscardChanges())) {
      handleClose();
      return;
    }
    const templateName = getPromptDisplayName(template, i18n);
    const promptSlug = addPrompt(template, templateName);
    setEditorDirty(false);
    setSelectedPromptSlug(promptSlug);
    handleClose();
  };

  const handleCopyPrompt = (prompt, promptDisplayName) => {
    const promptSlug = copyPrompt(prompt, promptDisplayName);
    setEditorDirty(false);
    setSelectedPromptSlug(promptSlug);
  };

  const handleSelectPrompt = async (prompt) => {
    const promptSlug = normalizePrompt(prompt).slug;
    if (promptSlug === selectedPromptSlug) return;
    if (!(await confirmDiscardChanges())) return;
    setEditorDirty(false);
    setSelectedPromptSlug(promptSlug);
  };

  return (
    <Box>
      <Box className="kt-prompt-editor kt-master-detail">
        <Box className="kt-master-rail kt-prompt-editor__list-panel">
          <Box className="kt-master-rail__header">
            <Button
              size="small"
              fullWidth
              id="add-prompt-button"
              variant="outlined"
              onClick={handleClick}
              aria-controls={addMenuOpen ? "add-prompt-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={addMenuOpen ? "true" : undefined}
              startIcon={<AddIcon />}
              endIcon={<KeyboardArrowDownIcon />}
            >
              {i18n("add_prompt")}
            </Button>
          </Box>
          <List
            className="kt-master-rail__list kt-prompt-editor__list"
            disablePadding
            aria-label={i18n("prompt_management")}
          >
            {prompts.map((prompt) => (
              <PromptListItem
                key={normalizePrompt(prompt).slug}
                prompt={prompt}
                selected={normalizePrompt(prompt).slug === selectedPromptSlug}
                isPreset={isPresetPromptSlug(normalizePrompt(prompt).slug)}
                onSelect={() => void handleSelectPrompt(prompt)}
              />
            ))}
          </List>
        </Box>

        <Box
          className="kt-master-detail-pane kt-prompt-editor__detail-panel"
          ref={detailPanelRef}
        >
          {selectedPrompt && (
            <PromptFields
              prompt={selectedPrompt}
              isPreset={isPresetPromptSlug(
                normalizePrompt(selectedPrompt).slug
              )}
              onSave={(updateData) =>
                updatePrompt(normalizePrompt(selectedPrompt).slug, updateData)
              }
              onCopy={handleCopyPrompt}
              onDelete={deletePrompt}
              onDirtyChange={setEditorDirty}
              onCollapse={() => {
                setEditorDirty(false);
                setSelectedPromptSlug("");
              }}
            />
          )}
        </Box>
      </Box>

      <Menu
        id="add-prompt-menu"
        anchorEl={anchorEl}
        open={addMenuOpen}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "add-prompt-button",
        }}
      >
        {promptTemplateGroups.map((group) => (
          <Fragment key={group.category}>
            <ListSubheader disableSticky>
              {getPromptCategoryDisplayName(group.category, i18n)}
            </ListSubheader>
            {group.templates.map((template) => (
              <MenuItem
                key={normalizePrompt(template).slug}
                onClick={() => void handleAddPromptFromTemplate(template)}
                sx={{ gap: 1 }}
              >
                <LockIcon fontSize="small" color="action" />
                <Box component="span" sx={{ flex: 1 }}>
                  {getPromptDisplayName(template, i18n)}
                </Box>
              </MenuItem>
            ))}
          </Fragment>
        ))}
      </Menu>
    </Box>
  );
}

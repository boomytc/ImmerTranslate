import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import { useCallback, useEffect, useState, useRef } from "react";
import { shortcutListener } from "../../libs/shortcut";
import { useI18n } from "../../hooks/I18n";
import { formatShortcutKey } from "../../libs/shortcutLabel";

export { formatShortcutKey } from "../../libs/shortcutLabel";

/**
 * 快捷键录入输入框组件 (ShortcutInput)
 * 允许用户点击编辑按钮后，直接在键盘上按下对应的组合键，自动捕获并录入为快捷键配置
 */
export default function ShortcutInput({
  value: keys = [],
  onChange,
  label,
  helperText,
  compact = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingKeys, setEditingKeys] = useState([]);
  const editingRef = useRef(false);
  const hasCapturedRef = useRef(false);
  const originalKeysRef = useRef(keys);
  const inputRef = useRef(null);
  const i18n = useI18n();

  const stopEditing = useCallback(() => {
    editingRef.current = false;
    hasCapturedRef.current = false;
    setIsEditing(false);
  }, []);

  // 提交并保存录入的快捷键组合，并退出编辑状态；未修改时不触发冗余 onChange
  const commitChanges = useCallback(
    (keysToCommit = editingKeys) => {
      if (!editingRef.current) return;
      const captured = hasCapturedRef.current;
      const previousKeys = originalKeysRef.current;
      stopEditing();
      if (!captured) {
        setEditingKeys(previousKeys);
        return;
      }
      const unchanged =
        keysToCommit.length === previousKeys.length &&
        keysToCommit.every((key, index) => key === previousKeys[index]);
      if (unchanged) {
        return;
      }
      onChange(keysToCommit);
    },
    [editingKeys, onChange, stopEditing]
  );

  // 按 Escape 取消编辑并回滚到编辑前的值
  const cancelEdit = useCallback(() => {
    if (!editingRef.current) return;
    stopEditing();
    setEditingKeys(originalKeysRef.current);
  }, [stopEditing]);

  // 失去焦点时，仅在用户确实按下了新组合键时保存；否则保持原值避免误清空
  const handleBlur = () => {
    if (!editingRef.current) return;
    if (hasCapturedRef.current) {
      commitChanges(editingKeys);
    } else {
      cancelEdit();
    }
  };

  // 点击编辑图标：备份原值并开始监听键盘输入
  const handleEditClick = () => {
    originalKeysRef.current = keys;
    hasCapturedRef.current = false;
    editingRef.current = true;
    setEditingKeys([]);
    setIsEditing(true);
  };

  // 显式清除快捷键
  const handleClearClick = () => {
    stopEditing();
    setEditingKeys([]);
    onChange([]);
  };

  // 仅在编辑状态下，注册并启动全局快捷键捕获监听器
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.focus();
    }
    const clearShortcut = shortcutListener((pressedKeys, event) => {
      event.preventDefault();
      event.stopPropagation();
      if (pressedKeys.size === 1 && pressedKeys.has("Escape")) {
        cancelEdit();
        return;
      }
      hasCapturedRef.current = true;
      setEditingKeys([...pressedKeys]);
    });

    return () => {
      clearShortcut();
    };
  }, [cancelEdit, isEditing]);

  const displayValue = isEditing ? editingKeys : keys;
  const formattedValue = displayValue.map(formatShortcutKey).join(" + ");
  const hasValue = displayValue.length > 0;

  return (
    <Stack
      className={compact ? "kt-shortcut-input kt-shortcut-input--compact" : ""}
      direction="row"
      alignItems="flex-start"
      spacing={0.5}
      useFlexGap
    >
      <TextField
        size="small"
        label={compact ? undefined : label}
        name={label || "shortcut"}
        value={formattedValue}
        placeholder={compact ? i18n("pls_press_shortcut") : undefined}
        fullWidth
        inputRef={inputRef}
        disabled={!isEditing}
        inputProps={{ "aria-label": label }}
        onBlur={handleBlur}
        helperText={
          compact
            ? undefined
            : isEditing
              ? i18n("pls_press_shortcut")
              : helperText
        }
      />
      {isEditing ? (
        <IconButton
          key="save"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => commitChanges(editingKeys)}
          color="primary"
          aria-label={`${i18n("save")} ${label}`}
          title={`${i18n("save")} ${label}`}
        >
          <CheckIcon />
        </IconButton>
      ) : (
        <IconButton
          key="edit"
          onClick={handleEditClick}
          aria-label={`${i18n("edit")} ${label}`}
          title={`${i18n("edit")} ${label}`}
        >
          <EditIcon />
        </IconButton>
      )}
      {hasValue && (
        <IconButton
          key="clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClearClick}
          aria-label={`${i18n("clear")} ${label}`}
          title={`${i18n("clear")} ${label}`}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );
}

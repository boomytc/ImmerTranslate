import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useI18n } from "../../hooks/I18n";
import { useSync } from "../../hooks/Sync";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import LoadingButton from "@mui/lab/LoadingButton";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import {
  URL_GITHUB_GIST_TOKEN,
  OPT_SYNCTYPE_ALL,
  OPT_SYNCTYPE_WEBDAV,
  OPT_SYNCTYPE_GIST,
  OPT_SYNCTOKEN_PERFIX,
} from "../../config";
import { useRef, useState } from "react";
import { changeSyncEncryptKey, syncSettingAndRules } from "../../libs/sync";
import { useAlert } from "../../hooks/Alert";
import { useConfirm } from "../../hooks/Confirm";
import { useSetting } from "../../hooks/Setting";
import { kissLog } from "../../libs/log";
import SyncIcon from "@mui/icons-material/Sync";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import EditIcon from "@mui/icons-material/Edit";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { SettingsDisclosure, SettingsSection } from "./SettingsCard";

const SYNC_METHOD_METADATA = {
  [OPT_SYNCTYPE_WEBDAV]: {
    Icon: FolderSharedRoundedIcon,
    descriptionKey: "sync_method_webdav_description",
  },
  [OPT_SYNCTYPE_GIST]: {
    Icon: CodeRoundedIcon,
    descriptionKey: "sync_method_gist_description",
  },
};

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Utf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) {
      // 兼容旧版直接 btoa(json) 生成的 Latin-1 分享码，避免非 ASCII 字符被替换为 U+FFFD。
      return binary;
    }
    throw error;
  }
}

const EMPTY_ENCRYPT_ERROR = { field: "", message: "" };

/**
 * 云端备份与同步设置主面板组件 (SyncSetting)
 */
export default function SyncSetting() {
  const i18n = useI18n();
  const { sync, updateSync } = useSync();
  const alert = useAlert();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  // 同步加密口令只能通过弹窗设定/修改，避免主表单直接误改导致云端密文不可读。
  const [encryptKeyDialogMode, setEncryptKeyDialogMode] = useState(null);
  const [oldEncryptKey, setOldEncryptKey] = useState("");
  const [newEncryptKey, setNewEncryptKey] = useState("");
  const [confirmEncryptKey, setConfirmEncryptKey] = useState("");
  const [encryptKeyError, setEncryptKeyError] = useState(EMPTY_ENCRYPT_ERROR);
  const [savingEncryptKey, setSavingEncryptKey] = useState(false);
  // 敏感字段默认隐藏，用户可临时切换明文查看。
  const [showSyncKey, setShowSyncKey] = useState(false);
  const [showSyncEncryptKey, setShowSyncEncryptKey] = useState(false);
  const [showOldEncryptKey, setShowOldEncryptKey] = useState(false);
  const [showNewEncryptKey, setShowNewEncryptKey] = useState(false);
  const [showConfirmEncryptKey, setShowConfirmEncryptKey] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState({});
  const fieldDraftsRef = useRef({});
  const pendingCommitsRef = useRef(new Set());
  const syncMethodRefs = useRef([]);
  const { reloadSetting } = useSetting();

  const getSyncErrorMessage = (err, fallback = i18n("sync_failed")) => {
    const rawMessage = err?.message || String(err || "");
    if (!rawMessage) return fallback;

    try {
      const parsed = JSON.parse(rawMessage);
      const status = parsed.status ? `HTTP ${parsed.status}` : "";
      const statusText = parsed.statusText || "";
      const body = parsed.body ? JSON.stringify(parsed.body) : "";
      const detail = [status, statusText, body].filter(Boolean).join(" ");
      return detail ? `${fallback}: ${detail}` : `${fallback}: ${rawMessage}`;
    } catch {
      return `${fallback}: ${rawMessage}`;
    }
  };

  const clearMatchingDrafts = (committedPatch) => {
    setFieldDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(committedPatch).forEach(([field, val]) => {
        if (field in next && next[field] === val) {
          delete next[field];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  const restoreDraftsOnFailure = (failedPatch) => {
    const nextRef = { ...fieldDraftsRef.current };
    Object.entries(failedPatch).forEach(([field, val]) => {
      if (!(field in nextRef)) {
        nextRef[field] = val;
      }
    });
    fieldDraftsRef.current = nextRef;
    setFieldDrafts((prev) => {
      const next = { ...prev };
      Object.entries(failedPatch).forEach(([field, val]) => {
        if (!(field in next)) {
          next[field] = val;
        }
      });
      return next;
    });
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    fieldDraftsRef.current = {
      ...fieldDraftsRef.current,
      [name]: value,
    };
    setFieldDrafts((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const commitField = async (name, value) => {
    const hadDraft = name in fieldDraftsRef.current;
    if (hadDraft) {
      const nextRef = { ...fieldDraftsRef.current };
      delete nextRef[name];
      fieldDraftsRef.current = nextRef;
    }

    if (value === (sync?.[name] ?? "")) {
      clearMatchingDrafts({ [name]: value });
      return;
    }

    const patch = { [name]: value };
    const entry = { alerted: false };
    const writePromise = Promise.resolve(updateSync(patch)).then(
      () => {
        clearMatchingDrafts(patch);
      },
      (err) => {
        restoreDraftsOnFailure(patch);
        throw err;
      }
    );
    entry.promise = writePromise;
    pendingCommitsRef.current.add(entry);

    try {
      await writePromise;
    } catch (err) {
      entry.alerted = true;
      kissLog("save sync field", err);
      alert.error(getSyncErrorMessage(err));
    } finally {
      pendingCommitsRef.current.delete(entry);
    }
  };

  const flushFieldDrafts = async () => {
    const currentDrafts = fieldDraftsRef.current;
    const patch = {};
    const unchanged = {};
    ["syncUrl", "syncUser", "syncKey"].forEach((field) => {
      if (!(field in currentDrafts)) return;
      if (currentDrafts[field] !== (sync?.[field] ?? "")) {
        patch[field] = currentDrafts[field];
      } else {
        unchanged[field] = currentDrafts[field];
      }
    });
    fieldDraftsRef.current = {};
    if (Object.keys(unchanged).length > 0) {
      clearMatchingDrafts(unchanged);
    }

    if (Object.keys(patch).length > 0) {
      const entry = { alerted: false };
      const writePromise = Promise.resolve(updateSync(patch)).then(
        () => {
          clearMatchingDrafts(patch);
        },
        (err) => {
          restoreDraftsOnFailure(patch);
          throw err;
        }
      );
      entry.promise = writePromise;
      pendingCommitsRef.current.add(entry);
      const cleanup = () => {
        pendingCommitsRef.current.delete(entry);
      };
      writePromise.then(cleanup, cleanup);
    }

    const inFlight = [...pendingCommitsRef.current];
    for (const entry of inFlight) {
      try {
        await entry.promise;
      } catch (err) {
        if (entry.alerted && err && typeof err === "object") {
          err._syncFieldAlerted = true;
        }
        throw err;
      }
    }
  };

  const handleSyncTypeChange = async (syncTypeValue) => {
    if (syncTypeValue === syncType) return;
    try {
      await updateSync({ syncType: syncTypeValue });
    } catch (err) {
      kissLog("save sync type", err);
      alert.error(getSyncErrorMessage(err));
    }
  };

  const handleSyncTypeKeyDown = (event, currentIndex) => {
    const lastIndex = OPT_SYNCTYPE_ALL.length - 1;
    let targetIndex;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        targetIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        targetIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        break;
      case "Home":
        targetIndex = 0;
        break;
      case "End":
        targetIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    syncMethodRefs.current[targetIndex]?.focus();
    void handleSyncTypeChange(OPT_SYNCTYPE_ALL[targetIndex]);
  };

  const handleSyncTest = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await flushFieldDrafts();
      await syncSettingAndRules();
      reloadSetting();
      alert.success(i18n("sync_success"));
    } catch (err) {
      if (!err?._syncFieldAlerted) {
        kissLog("sync all", err);
        alert.error(getSyncErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // 将当前同步配置生成 UTF-8 安全的 Base64 分享串并复制到剪贴板，不记录明文密钥日志
  const handleGenerateShareString = async () => {
    try {
      const base64Config = encodeBase64Utf8(
        JSON.stringify({
          syncType,
          syncUrl: syncUrlValue,
          syncUser: syncUserValue,
          syncKey: syncKeyValue,
          syncEncryptKey,
        })
      );
      const shareString = `${OPT_SYNCTOKEN_PERFIX}${base64Config}`;
      await navigator.clipboard.writeText(shareString);
      void flushFieldDrafts().catch((err) => {
        kissLog("flush sync drafts", err);
      });
      alert.success(i18n("copy_success"));
    } catch (error) {
      kissLog("Failed to copy share string to clipboard", error);
      alert.error(i18n("copy_failed"));
    }
  };

  // 从剪贴板导入分享串，校验结构后写入本地同步配置，不记录剪贴板原文
  const handleImportFromClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text.startsWith(OPT_SYNCTOKEN_PERFIX)) {
        alert.error(i18n("sync_share_invalid"));
        return;
      }

      const base64Config = text.slice(OPT_SYNCTOKEN_PERFIX.length);
      const jsonString = decodeBase64Utf8(base64Config);
      const updatedConfig = JSON.parse(jsonString);

      if (
        !updatedConfig ||
        typeof updatedConfig !== "object" ||
        Array.isArray(updatedConfig) ||
        !OPT_SYNCTYPE_ALL.includes(updatedConfig.syncType)
      ) {
        alert.error(i18n("sync_share_invalid"));
        return;
      }

      if (
        updatedConfig.syncUrl ||
        updatedConfig.syncType === OPT_SYNCTYPE_GIST
      ) {
        await updateSync({
          syncType: updatedConfig.syncType,
          syncUrl: updatedConfig.syncUrl || "",
          syncUser: updatedConfig.syncUser || "",
          syncKey: updatedConfig.syncKey || "",
          syncEncryptKey: updatedConfig.syncEncryptKey || "",
        });
        fieldDraftsRef.current = {};
        setFieldDrafts({});
        alert.success(i18n("import_success"));
      } else {
        alert.error(i18n("sync_share_invalid"));
      }
    } catch (error) {
      kissLog("Failed to import sync share string", error);
      alert.error(i18n("import_failed"));
    }
  };

  const openEncryptKeyDialog = (mode) => {
    setEncryptKeyDialogMode(mode);
    setOldEncryptKey("");
    setNewEncryptKey("");
    setConfirmEncryptKey("");
    setEncryptKeyError(EMPTY_ENCRYPT_ERROR);
    setShowOldEncryptKey(false);
    setShowNewEncryptKey(false);
    setShowConfirmEncryptKey(false);
  };

  const closeEncryptKeyDialog = () => {
    if (savingEncryptKey) return;
    setEncryptKeyDialogMode(null);
    setEncryptKeyError(EMPTY_ENCRYPT_ERROR);
  };

  // 设定口令只保存本地配置；修改口令需要先完成远端数据重加密。
  const handleSaveEncryptKey = async (event) => {
    event?.preventDefault();
    setEncryptKeyError(EMPTY_ENCRYPT_ERROR);

    if (encryptKeyDialogMode === "change" && !oldEncryptKey) {
      setEncryptKeyError({
        field: "old",
        message: i18n("error_cant_be_blank"),
      });
      return;
    }

    if (newEncryptKey.length < 6) {
      setEncryptKeyError({
        field: "new",
        message: i18n("sync_encrypt_key_too_short"),
      });
      return;
    }

    if (newEncryptKey !== confirmEncryptKey) {
      setEncryptKeyError({
        field: "confirm",
        message: i18n("sync_encrypt_key_mismatch"),
      });
      return;
    }

    const wasChange = encryptKeyDialogMode === "change";
    try {
      setSavingEncryptKey(true);
      await flushFieldDrafts();
      if (wasChange) {
        // changeSyncEncryptKey 已以 preserveDestination 持久化并广播，避免重复写入递增 destinationRevision。
        await changeSyncEncryptKey({
          oldEncryptKey,
          newEncryptKey,
        });
      } else {
        await updateSync({ syncEncryptKey: newEncryptKey });
      }
      setEncryptKeyDialogMode(null);
      alert.success(
        wasChange
          ? i18n("sync_encrypt_key_change_success")
          : i18n("save_success")
      );
    } catch (err) {
      kissLog("save sync encrypt key", err);
      if (
        encryptKeyDialogMode === "change" &&
        err?.code === "SYNC_DECRYPT_FAILED"
      ) {
        setEncryptKeyError({
          field: "old",
          message: i18n("old_sync_encrypt_key_invalid"),
        });
        return;
      }
      setEncryptKeyError({
        field: "form",
        message: getSyncErrorMessage(
          err,
          encryptKeyDialogMode === "change"
            ? i18n("sync_encrypt_key_change_failed")
            : i18n("sync_failed")
        ),
      });
    } finally {
      setSavingEncryptKey(false);
    }
  };

  const handleClearLocalEncryptKey = async () => {
    const confirmed = await confirm({
      title: i18n("clear_sync_encrypt_key_title"),
      message: i18n("clear_sync_encrypt_key_message"),
      confirmText: i18n("clear_sync_encrypt_key_confirm"),
    });
    if (!confirmed) return;

    try {
      await updateSync({ syncEncryptKey: "" });
      alert.success(i18n("clear_sync_encrypt_key_success"));
    } catch (err) {
      kissLog("clear sync encrypt key", err);
      alert.error(getSyncErrorMessage(err));
    }
  };

  if (!sync) {
    return null;
  }

  const {
    syncType = OPT_SYNCTYPE_WEBDAV,
    syncUrl = "",
    syncUser = "",
    syncKey = "",
    syncEncryptKey = "",
  } = sync;
  const syncUrlValue = fieldDrafts.syncUrl ?? syncUrl;
  const syncUserValue = fieldDrafts.syncUser ?? syncUser;
  const syncKeyValue = fieldDrafts.syncKey ?? syncKey;
  const isGistSync = syncType === OPT_SYNCTYPE_GIST;
  const selectedSyncMethodIndex = OPT_SYNCTYPE_ALL.indexOf(syncType);
  const tabbableSyncMethodIndex =
    selectedSyncMethodIndex === -1 ? 0 : selectedSyncMethodIndex;
  const editEncryptKeyLabel = `${i18n("edit")} ${i18n("data_sync_encrypt_key")}`;

  return (
    <Box>
      <SettingsDisclosure label={i18n("usage_guide")} defaultOpen={false}>
        <ul>
          <li>{i18n("sync_warn_encryption")}</li>
          <li>{i18n("sync_warn")}</li>
          <li>{i18n("sync_warn_2")}</li>
          {isGistSync && <li>{i18n("sync_warn_gist")}</li>}
        </ul>
      </SettingsDisclosure>

      <Stack spacing={3}>
        <SettingsSection title={i18n("data_sync_type")}>
          <div
            className="kt-sync-methods"
            role="radiogroup"
            aria-label={i18n("data_sync_type")}
          >
            {OPT_SYNCTYPE_ALL.map((item, index) => {
              const { Icon, descriptionKey } = SYNC_METHOD_METADATA[item];
              return (
                <button
                  type="button"
                  className="kt-sync-method"
                  role="radio"
                  data-sync-type={item}
                  aria-checked={syncType === item}
                  tabIndex={index === tabbableSyncMethodIndex ? 0 : -1}
                  ref={(element) => {
                    syncMethodRefs.current[index] = element;
                  }}
                  key={item}
                  onClick={() => void handleSyncTypeChange(item)}
                  onKeyDown={(event) => handleSyncTypeKeyDown(event, index)}
                >
                  <Icon />
                  <span className="kt-sync-method__name">{item}</span>
                  <span className="kt-sync-method__description">
                    {i18n(descriptionKey)}
                  </span>
                </button>
              );
            })}
          </div>
          {isGistSync && (
            <Box sx={{ mt: 1.5 }}>
              <Link
                href={URL_GITHUB_GIST_TOKEN}
                target="_blank"
                rel="noopener noreferrer"
              >
                {i18n("gist_sync_tip")}
              </Link>
            </Box>
          )}
        </SettingsSection>

        <Stack spacing={2}>
          {!isGistSync && (
            <TextField
              size="small"
              label={i18n("data_sync_url")}
              name="syncUrl"
              value={syncUrlValue}
              onChange={handleFieldChange}
              onBlur={(e) => void commitField("syncUrl", e.target.value)}
            />
          )}

          {syncType === OPT_SYNCTYPE_WEBDAV && (
            <TextField
              size="small"
              label={i18n("data_sync_user")}
              name="syncUser"
              value={syncUserValue}
              onChange={handleFieldChange}
              onBlur={(e) => void commitField("syncUser", e.target.value)}
            />
          )}

          <TextField
            size="small"
            type={showSyncKey ? "text" : "password"}
            label={i18n("data_sync_key")}
            name="syncKey"
            value={syncKeyValue}
            onChange={handleFieldChange}
            onBlur={(e) => void commitField("syncKey", e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label={`${i18n(showSyncKey ? "hide" : "show")} ${i18n(
                      "data_sync_key"
                    )}`}
                    onClick={() => setShowSyncKey((value) => !value)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showSyncKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TextField
                fullWidth
                size="small"
                type={showSyncEncryptKey ? "text" : "password"}
                label={i18n("data_sync_encrypt_key")}
                name="syncEncryptKey"
                value={syncEncryptKey}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label={`${i18n(
                          showSyncEncryptKey ? "hide" : "show"
                        )} ${i18n("data_sync_encrypt_key")}`}
                        onClick={() => setShowSyncEncryptKey((value) => !value)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showSyncEncryptKey ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <IconButton
                size="small"
                aria-label={editEncryptKeyLabel}
                title={editEncryptKeyLabel}
                sx={{ flexShrink: 0 }}
                onClick={() =>
                  openEncryptKeyDialog(syncEncryptKey ? "change" : "set")
                }
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Stack>
            {!syncEncryptKey && (
              <FormHelperText error>
                {i18n("sync_encrypt_key_not_set")}
              </FormHelperText>
            )}
            {syncEncryptKey && (
              <Button
                size="small"
                variant="text"
                color="error"
                onClick={handleClearLocalEncryptKey}
                sx={{ mt: 0.75 }}
              >
                {i18n("clear_sync_encrypt_key")}
              </Button>
            )}
          </Box>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          useFlexGap
          flexWrap="wrap"
        >
          <LoadingButton
            size="small"
            variant="contained"
            disabled={
              (!isGistSync && !syncUrlValue) ||
              !syncKeyValue ||
              !syncEncryptKey ||
              loading
            }
            onClick={handleSyncTest}
            startIcon={<SyncIcon />}
            loading={loading}
          >
            {i18n("sync_now")}
          </LoadingButton>
          <Button
            size="small"
            variant="text"
            onClick={handleGenerateShareString}
            startIcon={<ContentCopyIcon />}
          >
            {i18n("copy")}
          </Button>
          <Button
            onClick={handleImportFromClipboard}
            size="small"
            variant="text"
            startIcon={<ContentPasteIcon />}
          >
            {i18n("import")}
          </Button>
        </Stack>
      </Stack>
      <Dialog
        open={!!encryptKeyDialogMode}
        onClose={savingEncryptKey ? undefined : closeEncryptKeyDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby="sync-encryption-dialog-title"
      >
        <Box component="form" onSubmit={handleSaveEncryptKey}>
          <DialogTitle id="sync-encryption-dialog-title">
            {encryptKeyDialogMode === "change"
              ? i18n("change_sync_encrypt_key")
              : i18n("set_sync_encrypt_key")}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ width: "100%", pt: 1 }}>
              {encryptKeyError.field === "form" && (
                <Alert severity="error">{encryptKeyError.message}</Alert>
              )}
              {encryptKeyDialogMode === "change" && (
                <TextField
                  size="small"
                  fullWidth
                  type={showOldEncryptKey ? "text" : "password"}
                  label={i18n("old_sync_encrypt_key")}
                  InputLabelProps={{ shrink: true }}
                  value={oldEncryptKey}
                  error={encryptKeyError.field === "old"}
                  helperText={
                    encryptKeyError.field === "old"
                      ? encryptKeyError.message
                      : ""
                  }
                  onChange={(e) => {
                    setOldEncryptKey(e.target.value);
                    if (encryptKeyError.field === "old") {
                      setEncryptKeyError(EMPTY_ENCRYPT_ERROR);
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          edge="end"
                          aria-label={`${i18n(
                            showOldEncryptKey ? "hide" : "show"
                          )} ${i18n("old_sync_encrypt_key")}`}
                          onClick={() =>
                            setShowOldEncryptKey((value) => !value)
                          }
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {showOldEncryptKey ? (
                            <VisibilityOffIcon />
                          ) : (
                            <VisibilityIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              <TextField
                size="small"
                fullWidth
                type={showNewEncryptKey ? "text" : "password"}
                label={i18n("new_sync_encrypt_key")}
                InputLabelProps={{ shrink: true }}
                value={newEncryptKey}
                error={encryptKeyError.field === "new"}
                helperText={
                  encryptKeyError.field === "new" ? encryptKeyError.message : ""
                }
                onChange={(e) => {
                  setNewEncryptKey(e.target.value);
                  if (encryptKeyError.field === "new") {
                    setEncryptKeyError(EMPTY_ENCRYPT_ERROR);
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label={`${i18n(
                          showNewEncryptKey ? "hide" : "show"
                        )} ${i18n("new_sync_encrypt_key")}`}
                        onClick={() => setShowNewEncryptKey((value) => !value)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showNewEncryptKey ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                size="small"
                fullWidth
                type={showConfirmEncryptKey ? "text" : "password"}
                label={i18n("confirm_sync_encrypt_key")}
                InputLabelProps={{ shrink: true }}
                value={confirmEncryptKey}
                error={encryptKeyError.field === "confirm"}
                helperText={
                  encryptKeyError.field === "confirm"
                    ? encryptKeyError.message
                    : ""
                }
                onChange={(e) => {
                  setConfirmEncryptKey(e.target.value);
                  if (encryptKeyError.field === "confirm") {
                    setEncryptKeyError(EMPTY_ENCRYPT_ERROR);
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label={`${i18n(
                          showConfirmEncryptKey ? "hide" : "show"
                        )} ${i18n("confirm_sync_encrypt_key")}`}
                        onClick={() =>
                          setShowConfirmEncryptKey((value) => !value)
                        }
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showConfirmEncryptKey ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEncryptKeyDialog} disabled={savingEncryptKey}>
              {i18n("cancel", "cancel")}
            </Button>
            <LoadingButton
              type="submit"
              loading={savingEncryptKey}
              variant="contained"
            >
              {i18n("save", "save")}
            </LoadingButton>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

import TouchTranslateControl from "../../components/TouchTranslateControl";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import {
  sendBgMsg,
  sendTabMsg,
  sendTopFrameMsg,
  getCurTab,
} from "../../libs/msg";
import { isExt } from "../../libs/client";
import { useI18n } from "../../hooks/I18n";
import {
  API_SPE_TYPES,
  EVENT_KISS_INNER,
  GLOBAL_KEY,
  MSG_FAB_TOGGLE,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_CURRULE,
  MSG_RULE_EDITOR,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_SET_MODEL,
  MSG_SAVE_RULE,
  MSG_TOUCH_TRANSLATE_MODE_SET,
  MSG_TOUCH_TRANSLATE_STATE,
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  OPT_TRANS_QWENMT,
  STOKEY_FAB,
  STOKEY_RULES,
  DEFAULT_RULES,
  DEFAULT_TRANBOX_SETTING,
  MSG_TRANSBOX_TOGGLE,
} from "../../config";
import { getPresetModels } from "../../config/presetModels";
import { fetchModelCatalog } from "../../libs/modelList";
import { DEFAULT_FAB, isFabVisible, FAB_SIZE_PRESETS } from "../../config/fab";
import { useStorage } from "../../hooks/Storage";
import {
  readSiteTransOpen,
  siteRulePattern,
  SITE_TRANS_OPEN_OPTIONS,
} from "../Action/sitePolicy";
import { browser } from "../../libs/browser";
import { saveRule } from "../../libs/rules";
import { tryClearCaches } from "../../libs/cache";
import { kissLog } from "../../libs/log";
import { getDomainOptions, truncateMiddle } from "../../libs/url";
import { isMatch } from "../../libs/utils";
import {
  getCompactStylePreviewCode,
  useAllTextStyles,
} from "../../hooks/CustomStyles";
import { useOverviewShortcuts } from "../../hooks/Commands";
import { isInBlacklist } from "../../libs/blacklist";
import { useSetting } from "../../hooks/Setting";
import ApiKeyEmptyState from "../../components/ApiKeyEmptyState";
import ApiProviderIcon from "../../components/ApiProviderIcon";
import { configuredByokApis, isMissingRequiredApiKey } from "../../libs/apiKey";
import { COLLAPSED_SERVICE_LIMIT, getVisibleServices } from "./services";
import CompactLanguageSelect from "./CompactLanguageSelect";
import PopupStylePreview from "./PopupStylePreview";
import { queryPopupData } from "./loadData";
import { useConfirmedPopupUpdate } from "./useConfirmedPopupUpdate";

const uniqueModels = (values) => {
  const seen = new Set();
  const models = [];
  values.forEach((value) => {
    const model = String(value || "").trim();
    if (!model || seen.has(model)) return;
    seen.add(model);
    models.push(model);
  });
  return models;
};

const isTouchAction = (action) =>
  action === MSG_TOUCH_TRANSLATE_STATE ||
  action === MSG_TOUCH_TRANSLATE_MODE_SET;

export function resolvePopupTextStyles(
  allTextStyles,
  activeStyleSlug,
  expanded
) {
  if (expanded) return allTextStyles;

  const activeStyle = allTextStyles.find(
    (style) => style.styleSlug === activeStyleSlug
  );
  const seen = new Set();
  return [activeStyle, ...allTextStyles]
    .filter(Boolean)
    .filter((style) => {
      if (seen.has(style.styleSlug)) return false;
      seen.add(style.styleSlug);
      return true;
    })
    .slice(0, 5);
}

function effectiveTransOpen(siteTransOpen, globalTransOpen) {
  if (siteTransOpen === "true" || siteTransOpen === true) return "true";
  if (siteTransOpen === "false" || siteTransOpen === false) return "false";
  if (globalTransOpen === "true" || globalTransOpen === true) return "true";
  if (globalTransOpen === "false" || globalTransOpen === false) return "false";
  return "false";
}

export default function PopupCont({
  rule,
  setting,
  setRule,
  handleOpenSetting,
  processActions,
  targetTab,
  documentInfo,
  isVisible = true,
  onPageUnavailable,
  capabilities,
  isTopFrame = true,
  isContent = false,
}) {
  const i18n = useI18n();
  const advancedPanelId = useId();
  const { setting: contextSetting, updateSetting } = useSetting();
  const shortcutMap = useOverviewShortcuts(setting);
  const [domainOptions, setDomainOptions] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [currentHref, setCurrentHref] = useState("");
  const [snackbar, setSnackbar] = useState({
    id: 0,
    open: false,
    message: "",
    severity: "success",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationTogglePending, setTranslationTogglePending] =
    useState(false);
  const busyTimerRef = useRef(null);
  const translationTogglePendingRef = useRef(false);
  const snackbarSequenceRef = useRef(0);
  const ruleRef = useRef(rule);
  const activeRef = useRef(true);
  const visibleRef = useRef(isVisible);
  const touchActivityRef = useRef(0);
  const pageActionSequenceRef = useRef(0);
  const hasTargetTab = targetTab != null;
  const targetTabUrl = targetTab?.url;
  const canTranslatePage = capabilities?.pageTranslation !== false;
  const canEditRule = isTopFrame && capabilities?.ruleEditor !== false;
  const { allTextStyles } = useAllTextStyles();
  const visiblePopupTextStyles = useMemo(
    () => resolvePopupTextStyles(allTextStyles, rule?.textStyle, showAllStyles),
    [allTextStyles, rule?.textStyle, showAllStyles]
  );
  const hiddenStyleCount = allTextStyles.length - visiblePopupTextStyles.length;
  const styleDisclosureLabel = showAllStyles
    ? `${i18n("popup_collapse")}: ${i18n("popup_all_styles")}`
    : `${i18n("popup_all_styles")} (${hiddenStyleCount})`;

  const showMessage = useCallback((message, severity = "success") => {
    setSnackbar({
      id: ++snackbarSequenceRef.current,
      open: true,
      message,
      severity,
    });
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (busyTimerRef.current) window.clearTimeout(busyTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    ruleRef.current = rule;
  }, [rule]);
  useLayoutEffect(() => {
    visibleRef.current = isVisible;
    touchActivityRef.current += 1;
  }, [isVisible, targetTab?.id, documentInfo?.token]);

  const blacklistValue = contextSetting?.blacklist || "";
  const isInCurrentBlacklist = useMemo(() => {
    if (!selectedDomain || !blacklistValue) return false;
    return isInBlacklist(currentHref, blacklistValue);
  }, [blacklistValue, currentHref, selectedDomain]);

  const handleAddToBlacklist = useCallback(async () => {
    if (!selectedDomain) return;
    try {
      await updateSetting((previous) => {
        const entries = (previous?.blacklist || "")
          .split(/\n|,/)
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (entries.includes(selectedDomain)) return previous;
        return {
          ...previous,
          blacklist: [...entries, selectedDomain].join("\n"),
        };
      });
      showMessage(`${i18n("add_to_blacklist")}: ${selectedDomain}`);
    } catch (error) {
      kissLog("add to blacklist", error);
      showMessage(i18n("error_got_some_wrong"), "error");
    }
  }, [i18n, selectedDomain, showMessage, updateSetting]);

  const handleRemoveFromBlacklist = useCallback(async () => {
    if (!selectedDomain) return;
    try {
      await updateSetting((previous) => ({
        ...previous,
        blacklist: (previous?.blacklist || "")
          .split(/\n|,/)
          .map((entry) => entry.trim())
          .filter((entry) => entry && entry !== selectedDomain)
          .join("\n"),
      }));
      showMessage(`${i18n("remove_from_blacklist")}: ${selectedDomain}`);
    } catch (error) {
      kissLog("remove from blacklist", error);
      showMessage(i18n("error_got_some_wrong"), "error");
    }
  }, [i18n, selectedDomain, showMessage, updateSetting]);

  const sendPageMessage = useCallback(
    (action, args, topFrame = false) => {
      if (targetTab?.id !== undefined) {
        if (isTouchAction(action) && documentInfo?.token) {
          return sendTabMsg(
            action,
            args,
            { frameId: documentInfo.frameId },
            targetTab.id,
            documentInfo.token
          );
        }
        return topFrame
          ? documentInfo?.frameId === 0
            ? sendTopFrameMsg(action, args, targetTab.id, documentInfo.token)
            : sendTopFrameMsg(action, args, targetTab.id)
          : documentInfo?.token
            ? sendTabMsg(
                action,
                args,
                undefined,
                targetTab.id,
                undefined,
                documentInfo.token
              )
            : sendTabMsg(action, args, undefined, targetTab.id);
      }
      return topFrame
        ? args === undefined
          ? sendTopFrameMsg(action)
          : sendTopFrameMsg(action, args)
        : sendTabMsg(action, args);
    },
    [targetTab?.id, documentInfo]
  );

  const dispatchPageAction = useCallback(
    async (action, args) => {
      if (processActions) {
        const response = await processActions({ action, args });
        if (response?.error) throw new Error(response.error);
        return response;
      }
      const sequence = ++pageActionSequenceRef.current;
      let result;
      try {
        result = await sendPageMessage(action, args);
      } catch (error) {
        if (documentInfo) {
          // A frame can disappear after receiving the command. A separate
          // availability check may recover the panel, but cannot confirm it.
          const current = await queryPopupData(
            targetTab?.id,
            documentInfo
          ).catch(() => undefined);
          if (current == null && sequence === pageActionSequenceRef.current) {
            onPageUnavailable?.();
          }
        }
        throw error;
      }
      if (result?.error) {
        if (
          result.code === "STALE_DOCUMENT" &&
          sequence === pageActionSequenceRef.current
        ) {
          onPageUnavailable?.();
        }
        throw new Error(result.error);
      }
      // Only the selected document acknowledges a broadcast. Verify that it
      // is still current before accepting its resulting state.
      const response = await queryPopupData(targetTab?.id, documentInfo);
      if (response == null && sequence === pageActionSequenceRef.current) {
        onPageUnavailable?.();
      }
      if (response?.error) throw new Error(response.error);
      // Touch state is returned by its own command, after verifying that the
      // document which produced it still owns this popup's page controls.
      return isTouchAction(action) && response != null ? result : response;
    },
    [
      onPageUnavailable,
      processActions,
      sendPageMessage,
      targetTab?.id,
      documentInfo,
    ]
  );

  const dispatchTouchAction = useCallback(
    async ({ action, args }) => {
      if (
        !processActions &&
        (!Number.isInteger(targetTab?.id) || !documentInfo?.token)
      ) {
        throw new Error("The popup document is not ready.");
      }
      if (!isVisible || !activeRef.current || !visibleRef.current) {
        throw new Error("The popup page controls are no longer active.");
      }
      const activity = touchActivityRef.current;
      const response = await dispatchPageAction(action, args);
      // A late reply must not persist a preference after navigation or unmount.
      if (
        !activeRef.current ||
        !visibleRef.current ||
        activity !== touchActivityRef.current
      ) {
        throw new Error("The popup page controls are no longer active.");
      }
      return response;
    },
    [
      dispatchPageAction,
      documentInfo?.token,
      isVisible,
      processActions,
      targetTab?.id,
    ]
  );

  const reportActionFailure = useCallback(
    (error) => {
      kissLog("update popup page state", error);
      if (activeRef.current) showMessage(i18n("popup_action_failed"), "error");
    },
    [i18n, showMessage]
  );
  const updateRule = useConfirmedPopupUpdate({
    value: rule,
    setValue: setRule,
    onError: reportActionFailure,
  });
  const applyExternalRule = useCallback(
    (nextRule) => {
      if (!nextRule || typeof nextRule !== "object") return;
      const patch = { ...nextRule };
      // The main switch confirms transOpen itself. Don't let a broadcast
      // rewind that optimistic value while the toggle is still in flight.
      if (translationTogglePendingRef.current) delete patch.transOpen;
      updateRule.applyExternal?.(patch);
    },
    [updateRule]
  );
  const documentToken = documentInfo?.token;
  const targetTabId = targetTab?.id;

  useEffect(() => {
    const matchesDocument = (sourceDocument) =>
      !documentToken ||
      !sourceDocument?.token ||
      sourceDocument.token === documentToken;
    const onInner = (event) => {
      if (event.detail?.action !== MSG_TRANS_CURRULE) return;
      if (!matchesDocument(event.detail.document)) return;
      applyExternalRule(event.detail.rule);
    };
    const onRuntime = (message, sender) => {
      if (message?.action !== MSG_TRANS_CURRULE) return;
      if (
        targetTabId != null &&
        sender?.tab?.id != null &&
        sender.tab.id !== targetTabId
      ) {
        return;
      }
      const sourceDocument = message.args?.document;
      if (documentToken) {
        if (sourceDocument?.token !== documentToken) return;
      } else if (message.args?.isTopFrame === false) {
        return;
      }
      applyExternalRule(message.args?.rule);
    };
    document.addEventListener(EVENT_KISS_INNER, onInner);
    const runtimeEvents = browser?.runtime?.onMessage;
    if (!processActions && typeof runtimeEvents?.addListener === "function") {
      runtimeEvents.addListener(onRuntime);
    }
    return () => {
      document.removeEventListener(EVENT_KISS_INNER, onInner);
      runtimeEvents?.removeListener?.(onRuntime);
    };
  }, [applyExternalRule, documentToken, processActions, targetTabId]);
  const putRuleValues = useCallback(
    (values) => {
      if (!canTranslatePage) return;
      // Keep consecutive actions current even before React commits their updates.
      ruleRef.current = { ...ruleRef.current, ...values };
      return updateRule(values, async () => {
        const response = await dispatchPageAction(MSG_TRANS_PUTRULE, values);
        return response?.rule;
      });
    },
    [canTranslatePage, dispatchPageAction, updateRule]
  );

  const putRuleValue = useCallback(
    (name, value) => putRuleValues({ [name]: value }),
    [putRuleValues]
  );

  const handleSwapLanguages = useCallback(() => {
    const { fromLang, toLang } = ruleRef.current;
    void putRuleValues({ fromLang: toLang, toLang: fromLang });
  }, [putRuleValues]);

  const handleTransToggle = useCallback(
    async (enabled) => {
      if (!canTranslatePage || translationTogglePendingRef.current) return;
      translationTogglePendingRef.current = true;
      setTranslationTogglePending(true);
      const previousTransOpen = rule?.transOpen;
      if (busyTimerRef.current) {
        window.clearTimeout(busyTimerRef.current);
        busyTimerRef.current = null;
      }
      setRule((previous) => ({
        ...previous,
        transOpen: enabled ? "true" : "false",
      }));
      setTranslationBusy(true);
      try {
        const response = await dispatchPageAction(MSG_TRANS_TOGGLE, {
          enabled,
        });
        if (!activeRef.current) return;

        const responseTransOpen = response?.rule?.transOpen;
        const hasConfirmedState =
          responseTransOpen === true ||
          responseTransOpen === false ||
          responseTransOpen === "true" ||
          responseTransOpen === "false";

        if (!hasConfirmedState) {
          throw new Error("Page translation state was not confirmed");
        }

        const resolvedEnabled =
          responseTransOpen === true || responseTransOpen === "true";
        if (resolvedEnabled !== enabled) {
          throw new Error("Page translation state did not match the request");
        }
        setRule((previous) => ({
          ...previous,
          transOpen: resolvedEnabled ? "true" : "false",
        }));

        // The card already shows successful state changes. Reserve snackbars
        // for failures so they do not obscure the other translation controls.
        busyTimerRef.current = window.setTimeout(
          () => {
            setTranslationBusy(false);
          },
          resolvedEnabled ? 900 : 0
        );
      } catch (error) {
        if (!activeRef.current) return;
        kissLog("toggle translation", error);
        setRule((previous) => ({
          ...previous,
          transOpen: previousTransOpen,
        }));
        setTranslationBusy(false);
        showMessage(i18n("rule_toggle_failed"), "error");
      } finally {
        if (activeRef.current) {
          translationTogglePendingRef.current = false;
          setTranslationTogglePending(false);
        }
      }
    },
    [
      canTranslatePage,
      dispatchPageAction,
      i18n,
      rule?.transOpen,
      setRule,
      showMessage,
    ]
  );

  const handleOpenRuleEditor = useCallback(async () => {
    if (!canEditRule) return;
    try {
      const response = processActions
        ? await processActions({ action: MSG_RULE_EDITOR })
        : await sendPageMessage(MSG_RULE_EDITOR, undefined, true);
      if (!activeRef.current || !visibleRef.current) return;
      if (response?.error || response?.ruleEditorOpened !== true) {
        throw new Error(response?.error || "Rule editor did not open");
      }
      if (!processActions) window.close();
    } catch (error) {
      reportActionFailure(error);
    }
  }, [canEditRule, processActions, reportActionFailure, sendPageMessage]);

  const handleClearCache = useCallback(async () => {
    const cleared = await tryClearCaches();
    showMessage(
      i18n(cleared ? "clear_success" : "clear_failed"),
      cleared ? "success" : "error"
    );
  }, [i18n, showMessage]);

  const handleSaveRule = useCallback(async () => {
    if (!selectedDomain) return;
    try {
      const currentRule = { ...ruleRef.current, pattern: selectedDomain };
      const response =
        isExt && isContent
          ? await sendBgMsg(MSG_SAVE_RULE, currentRule)
          : await saveRule(currentRule);
      if (response?.error) throw new Error(response.error);
      showMessage(`${i18n("save_rule")}: ${selectedDomain}`);
    } catch (error) {
      kissLog("save rule", error);
      showMessage(i18n("error_got_some_wrong"), "error");
    }
  }, [i18n, isContent, selectedDomain, showMessage]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const href = isContent
          ? window.location?.href
          : targetTabUrl || (await getCurTab())?.url || "";
        if (!active || !href) return;
        const options = getDomainOptions(href);
        setCurrentHref(href);
        setDomainOptions(options);
        setSelectedDomain(options[0] || "");
      } catch (error) {
        kissLog("get domain options", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [isContent, hasTargetTab, targetTabUrl]);

  const services = useMemo(
    () =>
      configuredByokApis(setting?.transApis).map((api) => ({
        key: api.apiSlug,
        type: api.apiType || api.apiSlug,
        name: api.apiName || api.apiSlug,
      })),
    [setting?.transApis]
  );

  const {
    transOpen,
    apiSlug,
    fromLang,
    toLang,
    textStyle,
    autoScan,
    transOnly,
    hasRichText,
    scanAll,
    isPlainText: plainTextValue = false,
  } = rule || {};
  const translationEnabled =
    canTranslatePage && (transOpen === true || transOpen === "true");
  const isPlainText = plainTextValue === true || plainTextValue === "true";
  const targetName =
    OPT_LANGS_TO.find(([key]) => key === toLang)?.[1] || toLang;
  const activeService = services.find(({ key }) => key === apiSlug);
  const activeServiceName = activeService?.name || apiSlug || "—";
  const effectiveTransApis =
    contextSetting?.transApis || setting?.transApis || [];
  const activeApiSetting = effectiveTransApis.find(
    (api) => api?.apiSlug === apiSlug
  );
  const [modelOverride, setModelOverride] = useState(null);
  const [catalogModels, setCatalogModels] = useState([]);

  const supportsModel = Boolean(
    activeApiSetting &&
      (API_SPE_TYPES.ai?.has(activeApiSetting.apiType) ||
        activeApiSetting.apiType === OPT_TRANS_QWENMT)
  );
  const listUrl = String(
    activeApiSetting?.modelListUrl || activeApiSetting?.url || ""
  ).trim();
  const selectedModel = modelOverride ?? activeApiSetting?.model ?? "";
  const modelOptions = useMemo(
    () =>
      uniqueModels([
        selectedModel,
        ...getPresetModels(activeApiSetting?.apiType),
        ...catalogModels,
      ]),
    [activeApiSetting?.apiType, catalogModels, selectedModel]
  );

  useEffect(() => {
    setModelOverride(null);
    setCatalogModels([]);
  }, [apiSlug]);

  useEffect(() => {
    if (
      !supportsModel ||
      !listUrl ||
      !String(activeApiSetting?.key || "").trim()
    ) {
      return undefined;
    }
    let active = true;
    Promise.resolve(
      fetchModelCatalog({
        apiType: activeApiSetting.apiType,
        modelListUrl: listUrl,
        key: activeApiSetting.key,
      })
    )
      .then((catalog) => {
        if (!active || !Array.isArray(catalog?.models)) return;
        setCatalogModels(
          catalog.models.filter((model) => typeof model === "string")
        );
      })
      .catch((err) => {
        kissLog("fetchModelCatalog popup error", err);
        if (active) setCatalogModels([]);
      });
    return () => {
      active = false;
    };
  }, [
    activeApiSetting?.apiType,
    activeApiSetting?.key,
    listUrl,
    supportsModel,
  ]);

  const handleSelectModel = useCallback(
    (model) => {
      if (!model || model === selectedModel || !activeApiSetting) return;
      setModelOverride(model);
      if (canTranslatePage) {
        void Promise.resolve(
          processActions
            ? processActions({
                action: MSG_TRANS_SET_MODEL,
                args: { apiSlug: activeApiSetting.apiSlug, model },
              })
            : sendPageMessage(MSG_TRANS_SET_MODEL, {
                apiSlug: activeApiSetting.apiSlug,
                model,
              })
        ).catch((err) => kissLog("apply model to page", err));
      }
      void updateSetting((previous) => ({
        ...previous,
        transApis: (previous?.transApis || setting?.transApis || []).map(
          (api) =>
            api.apiSlug === activeApiSetting.apiSlug ? { ...api, model } : api
        ),
      }));
    },
    [
      activeApiSetting,
      canTranslatePage,
      processActions,
      selectedModel,
      sendPageMessage,
      setting?.transApis,
      updateSetting,
    ]
  );

  const {
    data: fabData,
    save: updateFab,
    isLoading: fabLoading,
  } = useStorage(STOKEY_FAB, DEFAULT_FAB);
  const isCurrentSiteFabVisible = isFabVisible(currentHref, fabData);

  const handleToggleGlobalFab = useCallback(
    async (enabled) => {
      if (fabLoading) return;
      let resolvedNextFab;
      try {
        await updateFab((prev) => {
          resolvedNextFab = {
            ...(typeof prev === "object" && prev !== null ? prev : {}),
            isHide: !enabled,
          };
          return resolvedNextFab;
        });
        if (canTranslatePage && resolvedNextFab) {
          const shouldShow = isFabVisible(currentHref, resolvedNextFab);
          const args = { enabled: shouldShow, fabConfig: resolvedNextFab };
          if (processActions) {
            await processActions({ action: MSG_FAB_TOGGLE, args });
          } else {
            await sendPageMessage(MSG_FAB_TOGGLE, args, true);
          }
        }
      } catch (error) {
        kissLog("toggle global fab error", error);
      }
    },
    [
      canTranslatePage,
      currentHref,
      fabLoading,
      processActions,
      sendPageMessage,
      updateFab,
    ]
  );

  const handleToggleSiteFab = useCallback(async () => {
    if (fabLoading) return;
    const domain =
      selectedDomain || (currentHref ? getDomainOptions(currentHref)[0] : "");
    if (!domain) return;
    let resolvedNextFab;
    let resolvedTargetVisible;
    try {
      await updateFab((prev) => {
        const current =
          typeof prev === "object" && prev !== null ? prev : DEFAULT_FAB;
        const currentIsHide = Boolean(current?.isHide);
        const targetVisible = !isFabVisible(currentHref, current);
        resolvedTargetVisible = targetVisible;
        const entries = (current?.hideExceptionList || "")
          .split(/\n|,/)
          .map((entry) => entry.trim())
          .filter(Boolean);

        let nextEntries;
        if (targetVisible) {
          if (currentIsHide) {
            nextEntries = entries.includes(domain)
              ? entries
              : [...entries, domain];
          } else {
            nextEntries = entries.filter(
              (entry) => entry !== domain && !isMatch(currentHref, entry)
            );
          }
        } else {
          if (currentIsHide) {
            nextEntries = entries.filter(
              (entry) => entry !== domain && !isMatch(currentHref, entry)
            );
          } else {
            nextEntries = entries.includes(domain)
              ? entries
              : [...entries, domain];
          }
        }

        resolvedNextFab = {
          ...current,
          hideExceptionList: nextEntries.join("\n"),
        };
        return resolvedNextFab;
      });

      if (canTranslatePage && resolvedNextFab) {
        const shouldShow = isFabVisible(currentHref, resolvedNextFab);
        const args = { enabled: shouldShow, fabConfig: resolvedNextFab };
        if (processActions) {
          await processActions({ action: MSG_FAB_TOGGLE, args });
        } else {
          await sendPageMessage(MSG_FAB_TOGGLE, args, true);
        }
      }
      showMessage(
        i18n(
          resolvedTargetVisible
            ? "fab_shown_on_site_toast"
            : "fab_hidden_on_site_toast"
        )
      );
    } catch (error) {
      kissLog("toggle site fab error", error);
      showMessage(i18n("error_got_some_wrong"), "error");
    }
  }, [
    canTranslatePage,
    currentHref,
    fabLoading,
    i18n,
    processActions,
    selectedDomain,
    sendPageMessage,
    showMessage,
    updateFab,
  ]);

  const handleUpdateFabSize = useCallback(
    async (size) => {
      if (fabLoading) return;
      try {
        const nextFab = { ...(fabData || DEFAULT_FAB), size };
        await updateFab(nextFab);
        const shouldShow = isFabVisible(currentHref, nextFab);
        const args = { enabled: shouldShow, fabConfig: nextFab };
        if (processActions) {
          await processActions({ action: MSG_FAB_TOGGLE, args });
        } else {
          await sendPageMessage(MSG_FAB_TOGGLE, args);
        }
      } catch (error) {
        kissLog("update fab size error", error);
      }
    },
    [
      currentHref,
      fabData,
      fabLoading,
      processActions,
      sendPageMessage,
      updateFab,
    ]
  );

  const [localSelectionTranslateOpen, setLocalSelectionTranslateOpen] =
    useState(null);
  const activeTranboxSetting =
    contextSetting?.tranboxSetting ||
    setting?.tranboxSetting ||
    DEFAULT_TRANBOX_SETTING;
  const selectionTranslateOpen =
    localSelectionTranslateOpen ?? (activeTranboxSetting?.transOpen !== false);

  const handleToggleSelectionTranslate = useCallback(
    async (enabled) => {
      setLocalSelectionTranslateOpen(enabled);
      try {
        if (canTranslatePage) {
          const args = { enabled };
          if (processActions) {
            await processActions({ action: MSG_TRANSBOX_TOGGLE, args });
          } else {
            await sendPageMessage(MSG_TRANSBOX_TOGGLE, args);
          }
        }
        await updateSetting((previous) => ({
          ...previous,
          tranboxSetting: {
            ...(previous?.tranboxSetting ||
              setting?.tranboxSetting ||
              DEFAULT_TRANBOX_SETTING),
            transOpen: enabled,
          },
        }));
      } catch (error) {
        kissLog("toggle selection translate error", error);
      }
    },
    [
      canTranslatePage,
      processActions,
      sendPageMessage,
      setting?.tranboxSetting,
      updateSetting,
    ]
  );

  const { data: rulesData, isLoading: rulesLoading } = useStorage(
    STOKEY_RULES,
    DEFAULT_RULES
  );
  const rules = useMemo(
    () => (Array.isArray(rulesData) ? rulesData : DEFAULT_RULES),
    [rulesData]
  );
  const [siteDraft, setSiteDraft] = useState(null);
  const sitePattern = useMemo(
    () => selectedDomain || siteRulePattern(currentHref, rules),
    [currentHref, rules, selectedDomain]
  );
  const storedSiteTransOpen = useMemo(() => {
    if (selectedDomain) {
      const exact = rules.find((r) => r.pattern === selectedDomain);
      if (exact && exact.transOpen) {
        return exact.transOpen;
      }
    }
    return readSiteTransOpen(currentHref, rules);
  }, [currentHref, rules, selectedDomain]);
  const siteTransOpen = siteDraft ?? storedSiteTransOpen;

  useEffect(() => {
    setSiteDraft(null);
  }, [storedSiteTransOpen, currentHref, selectedDomain]);

  const handleSelectSitePolicy = useCallback(
    async (next) => {
      if (rulesLoading || !sitePattern || next === siteTransOpen) return;
      setSiteDraft(next);
      const saved = { pattern: sitePattern, transOpen: next };
      const persist =
        isExt && isContent ? sendBgMsg(MSG_SAVE_RULE, saved) : saveRule(saved);
      const globalTransOpen = rules.find(
        (item) => item.pattern === GLOBAL_KEY
      )?.transOpen;
      const nextRuntime = effectiveTransOpen(next, globalTransOpen);
      const currentRuntime =
        rule?.transOpen === true || rule?.transOpen === "true"
          ? "true"
          : "false";

      if (canTranslatePage && nextRuntime !== currentRuntime) {
        void Promise.resolve(
          processActions
            ? processActions({
                action: MSG_TRANS_TOGGLE,
                args: {
                  enabled: nextRuntime === "true",
                  persistSite: next !== GLOBAL_KEY,
                },
              })
            : sendPageMessage(MSG_TRANS_TOGGLE, {
                enabled: nextRuntime === "true",
                persistSite: next !== GLOBAL_KEY,
              })
        ).catch((err) => kissLog("toggle site transOpen error", err));
      }

      try {
        const response = await Promise.resolve(persist);
        if (response?.error) throw new Error(response.error);
        showMessage(i18n("save_success"));
      } catch (error) {
        kissLog("save site transOpen", error);
        setSiteDraft(null);
        showMessage(i18n("error_got_some_wrong"), "error");
      }
    },
    [
      canTranslatePage,
      i18n,
      isContent,
      processActions,
      rule?.transOpen,
      rules,
      rulesLoading,
      sendPageMessage,
      showMessage,
      sitePattern,
      siteTransOpen,
    ]
  );
  const missingApiKey = isMissingRequiredApiKey(activeApiSetting);
  const heroActive = translationEnabled && !missingApiKey;
  const heroBusy = translationBusy && !missingApiKey;
  const pageShortcutLabel = shortcutMap.page.join("+");
  const enabledSummary = [
    i18n("popup_enabled"),
    `${activeServiceName} → ${targetName}`,
    pageShortcutLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const isAutoSource =
    !fromLang || fromLang === "auto" || fromLang === "$global";

  const visibleServices = useMemo(
    () => getVisibleServices(services, apiSlug, showAllServices),
    [apiSlug, services, showAllServices]
  );
  const hiddenServiceCount = services.length - visibleServices.length;
  const serviceDisclosureLabel = showAllServices
    ? `${i18n("popup_collapse")}: ${i18n("popup_more_services")}`
    : `${i18n("popup_more_services")} (${hiddenServiceCount})`;

  const advancedRows = [
    ["transOnly", i18n("show_only_translations"), transOnly === "true"],
    ["hasRichText", i18n("richtext_alt"), hasRichText === "true"],
    ["scanAll", i18n("scan_all_nodes"), scanAll === "true"],
    ["isPlainText", i18n("plain_text_translate"), isPlainText],
  ];

  const renderPopupStyleChip = (style) => (
    <button
      type="button"
      className="kt-popup-style-chip"
      aria-pressed={style.styleSlug === textStyle}
      key={style.styleSlug}
      onClick={() => putRuleValue("textStyle", style.styleSlug)}
    >
      <PopupStylePreview
        styleSlug={style.styleSlug}
        previewCode={getCompactStylePreviewCode(style)}
        label={i18n("style_preview_translation")}
      />
      <small>{style.styleName}</small>
    </button>
  );

  return (
    <section className="kt-popup-content">
      <div
        className={`kt-popup-hero ${
          heroActive ? "" : "kt-popup-hero--off"
        } ${heroBusy ? "kt-popup-hero--busy" : ""}`}
        aria-busy={translationTogglePending || heroBusy}
        aria-disabled={!canTranslatePage}
        onClick={() => {
          if (canTranslatePage && !translationTogglePending) {
            void handleTransToggle(!translationEnabled);
          }
        }}
      >
        <span className="kt-popup-hero__icon" aria-hidden="true">
          {heroBusy ? <AutorenewRoundedIcon /> : <TranslateRoundedIcon />}
        </span>
        <span className="kt-popup-hero__copy">
          <span className="kt-popup-hero__title">
            {i18n("popup_translate_page")}
          </span>
          <span className="kt-popup-hero__subtitle">
            {missingApiKey
              ? i18n("missing_api_key_status")
              : !canTranslatePage
                ? i18n("popup_unavailable")
                : translationBusy
                  ? i18n("popup_translating")
                  : translationEnabled
                    ? enabledSummary
                    : i18n("popup_disabled")}
          </span>
        </span>
        <Switch
          className="kt-popup-main-switch"
          checked={translationEnabled}
          disabled={!canTranslatePage || translationTogglePending}
          onChange={(_event, checked) => void handleTransToggle(checked)}
          onClick={(event) => event.stopPropagation()}
          inputProps={{
            "aria-label": i18n("popup_translate_page"),
            "aria-busy": translationTogglePending || heroBusy,
          }}
        />
        {heroBusy && <span className="kt-popup-hero__progress" />}
      </div>

      {missingApiKey && services.length > 0 && (
        <ApiKeyEmptyState
          className="kt-popup-key-empty"
          messageKey="missing_api_key_empty"
        />
      )}

      {canTranslatePage && (
        <div className="kt-popup-language-row">
          <div className="kt-popup-language">
            <span>{i18n("from_lang")}</span>
            <CompactLanguageSelect
              value={fromLang}
              ariaLabel={i18n("from_lang")}
              options={OPT_LANGS_FROM}
              onChange={(event) => putRuleValue("fromLang", event.target.value)}
            />
          </div>
          <IconButton
            className="kt-popup-swap"
            disabled={isAutoSource}
            title={i18n("swap_languages")}
            onClick={handleSwapLanguages}
          >
            <SwapHorizRoundedIcon />
          </IconButton>
          <div className="kt-popup-language">
            <span>{i18n("to_lang")}</span>
            <CompactLanguageSelect
              value={toLang}
              ariaLabel={i18n("to_lang")}
              options={OPT_LANGS_TO}
              onChange={(event) => putRuleValue("toLang", event.target.value)}
            />
          </div>
        </div>
      )}

      {canTranslatePage && (
        <div className="kt-popup-services-block">
          <div className="kt-popup-section-label">
            {i18n("translate_service")}
          </div>
          {services.length === 0 ? (
            <ApiKeyEmptyState
              className="kt-popup-key-empty"
              messageKey="fab_no_keyed_provider"
            />
          ) : (
            <div
              className={`kt-popup-services ${
                showAllServices ? "kt-popup-services--open" : ""
              }`}
            >
              {visibleServices.map((service) => (
                <button
                  type="button"
                  className="kt-popup-service"
                  aria-pressed={service.key === apiSlug}
                  key={service.key}
                  onClick={() => putRuleValue("apiSlug", service.key)}
                >
                  <ApiProviderIcon
                    apiType={service.type}
                    className="kt-service-logo"
                    lightSurface
                  />
                  <span className="kt-popup-service__name">{service.name}</span>
                </button>
              ))}
              {services.length > COLLAPSED_SERVICE_LIMIT && (
                <button
                  type="button"
                  className={`kt-popup-service kt-popup-more-service ${
                    showAllServices ? "kt-popup-more-service--open" : ""
                  }`}
                  aria-label={serviceDisclosureLabel}
                  aria-expanded={showAllServices}
                  title={serviceDisclosureLabel}
                  onClick={() => setShowAllServices((current) => !current)}
                >
                  {showAllServices
                    ? i18n("popup_collapse")
                    : `+${services.length - visibleServices.length}`}
                  <ExpandMoreRoundedIcon aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {supportsModel && (
            <div className="kt-popup-model-row">
              <span className="kt-popup-model-label">{i18n("fab_model")}</span>
              <select
                className="kt-popup-model-select"
                aria-label={i18n("fab_model")}
                title={selectedModel}
                value={
                  modelOptions.includes(selectedModel) ? selectedModel : ""
                }
                onChange={(event) => handleSelectModel(event.target.value)}
              >
                {!selectedModel && (
                  <option value="">{i18n("fab_model")}</option>
                )}
                {modelOptions.map((model) => (
                  <option key={model} value={model} title={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <TouchTranslateControl processActions={dispatchTouchAction} />
      <div className="kt-popup-site">
        <div className="kt-popup-site__top">
          <select
            className="kt-popup-site__select"
            value={selectedDomain}
            aria-label={i18n("domain")}
            title={selectedDomain}
            onChange={(event) => setSelectedDomain(event.target.value)}
          >
            {domainOptions.map((domain) => (
              <option key={domain} value={domain} title={domain}>
                {truncateMiddle(domain)}
              </option>
            ))}
          </select>
          <span
            className={`kt-popup-site__badge ${
              isInCurrentBlacklist ? "kt-popup-site__badge--blocked" : ""
            }`}
          >
            {i18n(
              isInCurrentBlacklist
                ? "popup_domain_blocked"
                : "popup_domain_allowed"
            )}
          </span>
        </div>
        <div className="kt-popup-site__actions">
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSaveRule}
            disabled={!canTranslatePage || !domainOptions.length}
          >
            {i18n("save_rule")}
          </Button>
          <Button
            variant={isInCurrentBlacklist ? "contained" : "outlined"}
            color={isInCurrentBlacklist ? "error" : "primary"}
            onClick={
              isInCurrentBlacklist
                ? handleRemoveFromBlacklist
                : handleAddToBlacklist
            }
            disabled={!domainOptions.length}
          >
            {i18n(
              isInCurrentBlacklist
                ? "remove_from_blacklist"
                : "add_to_blacklist"
            )}
          </Button>
        </div>
      </div>

      {canTranslatePage && domainOptions.length > 0 && (
        <div className="kt-popup-site-policy">
          <div className="kt-popup-section-label">
            {i18n("site_trans_policy")}
          </div>
          <div
            className="kt-popup-policy-modes"
            role="group"
            aria-label={i18n("site_trans_policy")}
            aria-busy={rulesLoading}
          >
            {SITE_TRANS_OPEN_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                className={`kt-popup-policy-mode ${
                  !rulesLoading && siteTransOpen === value
                    ? "kt-popup-policy-mode--active"
                    : ""
                }`}
                aria-pressed={!rulesLoading && siteTransOpen === value}
                disabled={rulesLoading}
                onClick={() => void handleSelectSitePolicy(value)}
              >
                {i18n(labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="kt-popup-fab-control">
        <div className="kt-popup-section-label">{i18n("fab_control")}</div>
        <div className="kt-popup-fab-control__body">
          <div className="kt-popup-fab-control__global">
            <span>{i18n("fab_global_switch")}</span>
            <Switch
              size="small"
              checked={!fabLoading && !fabData?.isHide}
              disabled={fabLoading}
              onChange={(_event, checked) =>
                void handleToggleGlobalFab(checked)
              }
              inputProps={{ "aria-label": i18n("fab_global_switch") }}
            />
          </div>
          {canTranslatePage && domainOptions.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              className="kt-popup-fab-control__site-btn"
              disabled={fabLoading}
              onClick={() => void handleToggleSiteFab()}
            >
              {i18n(
                isCurrentSiteFabVisible
                  ? "hide_fab_on_site"
                  : "show_fab_on_site"
              )}
            </Button>
          )}
        </div>
        <div className="kt-popup-fab-control__row">
          <div className="kt-popup-fab-control__global">
            <span>{i18n("selection_translate")}</span>
            <Switch
              size="small"
              checked={selectionTranslateOpen}
              onChange={(_event, checked) =>
                void handleToggleSelectionTranslate(checked)
              }
              inputProps={{ "aria-label": i18n("selection_translate") }}
            />
          </div>
        </div>
        <div className="kt-popup-fab-control__sizes">
          <span className="kt-popup-fab-control__size-label">
            {i18n("fab_size")}
          </span>
          <div
            className="kt-popup-fab-control__size-group"
            role="group"
            aria-label={i18n("fab_size")}
          >
            {FAB_SIZE_PRESETS.map(({ size, labelKey }) => (
              <button
                key={size}
                type="button"
                className="kt-popup-fab-control__size-chip"
                aria-pressed={
                  Math.abs((fabData?.size || DEFAULT_FAB.size) - size) <= 4
                }
                disabled={fabLoading}
                onClick={() => void handleUpdateFabSize(size)}
              >
                {i18n(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="kt-popup-disclosure-row">
        <button
          type="button"
          className="kt-popup-disclosure"
          aria-expanded={showAdvanced}
          aria-controls={advancedPanelId}
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {i18n("popup_advanced_options")}
          <ExpandMoreRoundedIcon />
        </button>
      </div>

      <div
        id={advancedPanelId}
        className="kt-popup-advanced"
        hidden={!showAdvanced}
      >
        {showAdvanced && (
          <>
            {canTranslatePage && (
              <>
                <div>
                  <div className="kt-popup-section-label">
                    {i18n("text_style_alt")}
                  </div>
                  <div className="kt-popup-style-chips">
                    {visiblePopupTextStyles.map(renderPopupStyleChip)}
                    {allTextStyles.length > 5 && (
                      <button
                        type="button"
                        className="kt-popup-style-chip kt-popup-style-more"
                        aria-label={styleDisclosureLabel}
                        aria-expanded={showAllStyles}
                        title={styleDisclosureLabel}
                        onClick={() => setShowAllStyles((current) => !current)}
                      >
                        {showAllStyles
                          ? i18n("popup_collapse")
                          : `+${hiddenStyleCount}`}
                        <ExpandMoreRoundedIcon aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="kt-popup-advanced-grid">
                  {advancedRows.map(([name, label, checked]) => (
                    <div className="kt-popup-advanced-row" key={name}>
                      <span>{label}</span>
                      <Switch
                        size="small"
                        checked={checked}
                        onChange={(event) =>
                          putRuleValue(
                            name,
                            name === "isPlainText"
                              ? event.target.checked
                              : event.target.checked
                                ? "true"
                                : "false"
                          )
                        }
                        inputProps={{ "aria-label": label }}
                      />
                    </div>
                  ))}
                </div>
                <div className="kt-popup-advanced-row">
                  <span>{i18n("autoscan_alt")}</span>
                  <Switch
                    size="small"
                    checked={autoScan === "true"}
                    onChange={(event) =>
                      putRuleValue(
                        "autoScan",
                        event.target.checked ? "true" : "false"
                      )
                    }
                    inputProps={{ "aria-label": i18n("autoscan_alt") }}
                  />
                </div>
              </>
            )}
            <div className="kt-popup-advanced-tools">
              {canEditRule && (
                <Button
                  variant="text"
                  startIcon={<EditOutlinedIcon />}
                  onClick={handleOpenRuleEditor}
                >
                  {i18n("rule_editor_open")}
                </Button>
              )}
              <Button
                variant="text"
                startIcon={<DeleteSweepRoundedIcon />}
                onClick={handleClearCache}
                aria-label={i18n("clear_cache")}
              >
                {i18n("clear_cache")}
              </Button>
            </div>
          </>
        )}
      </div>

      <footer className="kt-popup-footer">
        {[
          {
            key: "page",
            keys: shortcutMap.page,
            label: i18n("toggle_translate_shortcut"),
          },
          {
            key: "selection",
            keys: shortcutMap.selection,
            label: i18n("trigger_tranbox_shortcut"),
          },
        ]
          .filter(({ keys }) => keys.length > 0)
          .map(({ key, keys, label }) => (
            <span
              className="kt-popup-footer__keys"
              key={key}
              title={`${label}: ${keys.join("+")}`}
              aria-label={`${label}: ${keys.join("+")}`}
            >
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
          ))}
        <span className="kt-popup-footer__spacer" />
        <Button variant="text" onClick={handleOpenSetting}>
          {i18n("popup_all_settings")}
        </Button>
      </footer>

      <Snackbar
        key={snackbar.id}
        open={snackbar.open}
        autoHideDuration={2200}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={(_, reason) => {
          if (reason === "clickaway") return;
          setSnackbar((current) => ({ ...current, open: false }));
        }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() =>
            setSnackbar((current) => ({ ...current, open: false }))
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </section>
  );
}

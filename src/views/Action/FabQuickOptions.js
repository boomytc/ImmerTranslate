import { useEffect, useMemo, useState } from "react";
import {
  API_SPE_TYPES,
  EVENT_KISS_INNER,
  GLOBAL_KEY,
  MSG_SAVE_RULE,
  MSG_TRANS_CURRULE,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_SET_MODEL,
  MSG_TRANS_TOGGLE,
  OPT_LANGS_TO,
  OPT_TRANS_QWENMT,
} from "../../config";
import { DEFAULT_FAB, FAB_SIZE_PRESETS } from "../../config/fab";
import { getPresetModels } from "../../config/presetModels";
import { useI18n } from "../../hooks/I18n";
import { useRules } from "../../hooks/Rules";
import { useSetting } from "../../hooks/Setting";
import ApiKeyEmptyState from "../../components/ApiKeyEmptyState";
import { configuredByokApis, isMissingRequiredApiKey } from "../../libs/apiKey";
import { isExt } from "../../libs/client";
import { kissLog } from "../../libs/log";
import { fetchModelCatalog } from "../../libs/modelList";
import { sendBgMsg } from "../../libs/msg";
import { saveRule } from "../../libs/rules";
import { effectiveTransOpen } from "../../libs/pageRuleSync";
import {
  readSiteTransOpen,
  siteRulePattern,
  SITE_TRANS_OPEN_OPTIONS,
} from "./sitePolicy";

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

/**
 * Compact translation controls for the content FAB.
 * Site auto-translate is the personal rule's transOpen (`*` follows global).
 * Provider, bilingual mode, and target language write the page rule through
 * MSG_TRANS_PUTRULE. Open popups hear MSG_TRANS_CURRULE and this menu does too.
 */
export default function FabQuickOptions({
  getFabPageState,
  processActions,
  onPageRule,
  onHideOnSite,
  currentFabSize,
  onChangeFabSize,
}) {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const { list: rules = [], isLoading: rulesLoading } = useRules();
  const [rule, setRule] = useState(null);
  const [catalogModels, setCatalogModels] = useState([]);
  const [modelOverride, setModelOverride] = useState(null);
  const [siteDraft, setSiteDraft] = useState(null);
  const href = window.location.href;
  const sitePattern = siteRulePattern(href, rules);
  const storedSiteTransOpen = readSiteTransOpen(href, rules);
  const siteTransOpen = siteDraft ?? storedSiteTransOpen;

  useEffect(() => {
    if (!getFabPageState) return undefined;
    let active = true;
    (async () => {
      try {
        const response = await getFabPageState();
        if (active && response?.rule) setRule(response.rule);
      } catch {
        // The action list stays usable when the page rule cannot be read.
      }
    })();
    return () => {
      active = false;
    };
  }, [getFabPageState]);

  useEffect(() => {
    const onRule = (event) => {
      if (event.detail?.action !== MSG_TRANS_CURRULE || !event.detail.rule) {
        return;
      }
      setRule(event.detail.rule);
    };
    document.addEventListener(EVENT_KISS_INNER, onRule);
    return () => document.removeEventListener(EVENT_KISS_INNER, onRule);
  }, []);

  useEffect(() => {
    onPageRule?.(rule);
  }, [onPageRule, rule]);

  const configuredApis = useMemo(
    () => configuredByokApis(setting?.transApis),
    [setting?.transApis]
  );
  const activeApi = useMemo(
    () =>
      (setting?.transApis || []).find((api) => api.apiSlug === rule?.apiSlug) ||
      null,
    [rule?.apiSlug, setting?.transApis]
  );
  const missingCurrentKey = isMissingRequiredApiKey(activeApi);
  const supportsModel = Boolean(
    activeApi &&
      (API_SPE_TYPES.ai.has(activeApi.apiType) ||
        activeApi.apiType === OPT_TRANS_QWENMT)
  );
  const listUrl = String(
    activeApi?.modelListUrl || activeApi?.url || ""
  ).trim();
  const selectedModel = modelOverride ?? activeApi?.model ?? "";
  const modelOptions = useMemo(
    () =>
      uniqueModels([
        selectedModel,
        ...getPresetModels(activeApi?.apiType),
        ...catalogModels,
      ]),
    [activeApi?.apiType, catalogModels, selectedModel]
  );

  useEffect(() => {
    setModelOverride(null);
    setCatalogModels([]);
  }, [rule?.apiSlug]);

  useEffect(() => {
    if (!supportsModel || !listUrl || !String(activeApi?.key || "").trim()) {
      return undefined;
    }
    let active = true;
    Promise.resolve(
      fetchModelCatalog({
        apiType: activeApi.apiType,
        modelListUrl: listUrl,
        key: activeApi.key,
      })
    )
      .then((catalog) => {
        if (!active || !Array.isArray(catalog?.models)) return;
        setCatalogModels(
          catalog.models.filter((model) => typeof model === "string")
        );
      })
      .catch(() => {
        if (active) setCatalogModels([]);
      });
    return () => {
      active = false;
    };
  }, [activeApi?.apiType, activeApi?.key, listUrl, supportsModel]);

  useEffect(() => {
    setSiteDraft(null);
  }, [storedSiteTransOpen, href]);

  const selectSiteTransOpen = (next) => {
    if (!sitePattern || rulesLoading || next === siteTransOpen) return;
    setSiteDraft(next);
    const saved = { pattern: sitePattern, transOpen: next };
    const persist = isExt ? sendBgMsg(MSG_SAVE_RULE, saved) : saveRule(saved);
    const globalTransOpen = rules.find(
      (item) => item.pattern === GLOBAL_KEY
    )?.transOpen;
    const nextRuntime = effectiveTransOpen(next, globalTransOpen);
    const currentRuntime =
      rule?.transOpen === true || rule?.transOpen === "true" ? "true" : "false";
    // Pinning true/false also asks the page to translate now. Follow (`*`)
    // moves runtime to the global value without saving that boolean over `*`.
    if (!rule || nextRuntime !== currentRuntime) {
      void processActions?.({
        action: MSG_TRANS_TOGGLE,
        args: {
          enabled: nextRuntime === "true",
          persistSite: next !== GLOBAL_KEY,
        },
      });
    }
    void Promise.resolve(persist)
      .then((response) => {
        if (response?.error) throw new Error(response.error);
      })
      .catch((error) => {
        kissLog("save site transOpen", error);
        setSiteDraft(null);
      });
  };

  const showSite = Boolean(sitePattern) && !rulesLoading;
  if (!rule && !showSite) return null;

  const translationOnly =
    rule?.transOnly === true || rule?.transOnly === "true";
  const setTranslationOnly = (enabled) => {
    if (enabled === translationOnly) return;
    const transOnly = enabled ? "true" : "false";
    setRule((current) => ({ ...current, transOnly }));
    void processActions?.({
      action: MSG_TRANS_PUTRULE,
      args: { transOnly },
    });
  };
  const applyModel = (model) => {
    if (!model || model === selectedModel || !activeApi) return;
    setModelOverride(model);
    void processActions?.({
      action: MSG_TRANS_SET_MODEL,
      args: { apiSlug: activeApi.apiSlug, model },
    });
    void updateSetting?.((previous) => ({
      ...previous,
      transApis: (previous?.transApis || []).map((api) =>
        api.apiSlug === activeApi.apiSlug ? { ...api, model } : api
      ),
    }));
  };
  const applyService = (apiSlug) => {
    if (!apiSlug || apiSlug === rule?.apiSlug) return;
    setRule((current) => ({ ...current, apiSlug }));
    void processActions?.({
      action: MSG_TRANS_PUTRULE,
      args: { apiSlug },
    });
  };
  const applyToLang = (toLang) => {
    if (!toLang || toLang === rule?.toLang) return;
    setRule((current) => ({ ...current, toLang }));
    void processActions?.({
      action: MSG_TRANS_PUTRULE,
      args: { toLang },
    });
  };
  const toLang = rule?.toLang || "";
  const toLangOptions =
    toLang && !OPT_LANGS_TO.some(([code]) => code === toLang)
      ? [[toLang, toLang], ...OPT_LANGS_TO]
      : OPT_LANGS_TO;

  const matchedFabSize =
    FAB_SIZE_PRESETS.find(
      (preset) =>
        Math.abs((currentFabSize || DEFAULT_FAB.size) - preset.size) <= 4
    )?.size ?? FAB_SIZE_PRESETS[1].size;

  return (
    <div className="kt-content-fab-menu__options">
      {showSite && (
        <label className="kt-content-fab-menu__row">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-site-trans-open-label"
          >
            {i18n("site_trans_open")}
          </span>
          <select
            className="kt-content-fab-menu__select kt-content-fab-menu__site-select"
            aria-labelledby="kt-site-trans-open-label"
            aria-label={i18n("site_trans_open")}
            value={siteTransOpen}
            disabled={rulesLoading}
            onChange={(event) => selectSiteTransOpen(event.target.value)}
          >
            {SITE_TRANS_OPEN_OPTIONS.map(({ value, labelKey }) => (
              <option key={value} value={value}>
                {i18n(labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}

      {rule && (
        <div className="kt-content-fab-menu__service-field">
          <label className="kt-content-fab-menu__row">
            <span
              className="kt-content-fab-menu__row-label"
              id="kt-fab-service-label"
            >
              {i18n("translate_service")}
            </span>
            {configuredApis.length === 0 ? (
              <span className="kt-content-fab-menu__row-empty">
                {i18n("fab_no_keyed_provider")}
              </span>
            ) : (
              <select
                className="kt-content-fab-menu__select kt-content-fab-menu__service-select"
                aria-labelledby="kt-fab-service-label"
                aria-label={i18n("translate_service")}
                value={rule.apiSlug || ""}
                onChange={(event) => applyService(event.target.value)}
              >
                {!rule.apiSlug && (
                  <option value="">{i18n("translate_service")}</option>
                )}
                {configuredApis.map((api) => (
                  <option key={api.apiSlug} value={api.apiSlug}>
                    {api.apiName || api.apiSlug}
                  </option>
                ))}
              </select>
            )}
          </label>
          {configuredApis.length === 0 ? (
            <ApiKeyEmptyState
              className="kt-content-fab-menu__empty"
              messageKey={
                missingCurrentKey
                  ? "missing_api_key_empty"
                  : "fab_no_keyed_provider"
              }
            />
          ) : (
            missingCurrentKey && (
              <ApiKeyEmptyState
                className="kt-content-fab-menu__empty"
                messageKey="missing_api_key_empty"
              />
            )
          )}
        </div>
      )}

      {rule && supportsModel && (
        <label className="kt-content-fab-menu__row">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-fab-model-label"
          >
            {i18n("fab_model")}
          </span>
          <select
            className="kt-content-fab-menu__select kt-content-fab-menu__model"
            aria-labelledby="kt-fab-model-label"
            aria-label={i18n("fab_model")}
            title={selectedModel}
            value={modelOptions.includes(selectedModel) ? selectedModel : ""}
            onChange={(event) => applyModel(event.target.value)}
          >
            {!selectedModel && <option value="">{i18n("fab_model")}</option>}
            {modelOptions.map((model) => (
              <option key={model} value={model} title={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      )}

      {rule && (
        <label className="kt-content-fab-menu__row">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-fab-lang-label"
          >
            {i18n("to_lang")}
          </span>
          <select
            className="kt-content-fab-menu__select kt-content-fab-menu__lang"
            aria-labelledby="kt-fab-lang-label"
            aria-label={i18n("to_lang")}
            value={
              toLangOptions.some(([code]) => code === toLang) ? toLang : ""
            }
            onChange={(event) => applyToLang(event.target.value)}
          >
            {!toLang && <option value="">{i18n("to_lang")}</option>}
            {toLangOptions.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      {rule && (
        <label className="kt-content-fab-menu__row">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-fab-mode-label"
          >
            {i18n("fab_translation_mode")}
          </span>
          <select
            className="kt-content-fab-menu__select kt-content-fab-menu__mode-select"
            aria-labelledby="kt-fab-mode-label"
            aria-label={i18n("fab_translation_mode")}
            value={translationOnly ? "trans_only" : "bilingual"}
            onChange={(event) =>
              setTranslationOnly(event.target.value === "trans_only")
            }
          >
            <option value="bilingual">{i18n("fab_bilingual")}</option>
            <option value="trans_only">{i18n("show_only_translations")}</option>
          </select>
        </label>
      )}

      {onChangeFabSize && (
        <label className="kt-content-fab-menu__row">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-fab-size-label"
          >
            {i18n("fab_size")}
          </span>
          <select
            className="kt-content-fab-menu__select kt-content-fab-menu__size-select"
            aria-labelledby="kt-fab-size-label"
            aria-label={i18n("fab_size")}
            value={matchedFabSize}
            onChange={(event) => onChangeFabSize(Number(event.target.value))}
          >
            {FAB_SIZE_PRESETS.map(({ size, labelKey }) => (
              <option key={size} value={size}>
                {i18n(labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}

      {onHideOnSite && (
        <div className="kt-content-fab-menu__field kt-content-fab-menu__field--hide-fab">
          <button
            type="button"
            className="kt-content-fab-menu__mode kt-content-fab-menu__mode--hide-fab"
            title={i18n("hide_fab_on_site")}
            onClick={onHideOnSite}
          >
            {i18n("hide_fab_on_site")}
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  API_SPE_TYPES,
  MSG_SAVE_RULE,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_SET_MODEL,
  OPT_TRANS_QWENMT,
} from "../../config";
import { getPresetModels } from "../../config/presetModels";
import { useI18n } from "../../hooks/I18n";
import { useRules } from "../../hooks/Rules";
import { useSetting } from "../../hooks/Setting";
import { isExt } from "../../libs/client";
import { kissLog } from "../../libs/log";
import { fetchModelCatalog } from "../../libs/modelList";
import { sendBgMsg } from "../../libs/msg";
import { saveRule } from "../../libs/rules";
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
 * Providers the user can actually call: enabled entries with a non-empty key.
 * Preset engines and Custom (`apiType === "Custom"`) share this check.
 * Free-tier rows without a key stay out of the FAB list.
 */
export const configuredByokApis = (transApis = []) =>
  transApis
    .filter((api) => !api?.isDisabled && String(api?.key || "").trim())
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));

/**
 * Compact translation controls for the content FAB.
 * Site auto-translate is the personal rule's transOpen. Provider switching
 * writes that same rule's apiSlug. Bilingual mode and the active engine
 * model stay as they were.
 */
export default function FabQuickOptions({ getFabPageState, processActions }) {
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

  return (
    <div className="kt-content-fab-menu__options">
      {showSite && (
        <div className="kt-content-fab-menu__field">
          <span id="kt-site-trans-open-label">{i18n("site_trans_open")}</span>
          <div
            className="kt-content-fab-menu__sites"
            role="group"
            aria-labelledby="kt-site-trans-open-label"
          >
            {SITE_TRANS_OPEN_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                className="kt-content-fab-menu__mode"
                aria-pressed={siteTransOpen === value}
                disabled={rulesLoading}
                onClick={() => selectSiteTransOpen(value)}
              >
                {i18n(labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
      {rule && (
        <div
          className="kt-content-fab-menu__modes"
          role="group"
          aria-label={i18n("fab_translation_mode")}
        >
          <button
            type="button"
            className="kt-content-fab-menu__mode"
            aria-pressed={!translationOnly}
            onClick={() => setTranslationOnly(false)}
          >
            {i18n("fab_bilingual")}
          </button>
          <button
            type="button"
            className="kt-content-fab-menu__mode"
            aria-pressed={translationOnly}
            onClick={() => setTranslationOnly(true)}
          >
            {i18n("show_only_translations")}
          </button>
        </div>
      )}
      {rule && configuredApis.length > 0 && (
        <div className="kt-content-fab-menu__field">
          <span id="kt-fab-service-label">{i18n("translate_service")}</span>
          <div
            className="kt-content-fab-menu__services"
            role="group"
            aria-labelledby="kt-fab-service-label"
          >
            {configuredApis.map((api) => (
              <button
                key={api.apiSlug}
                type="button"
                className="kt-content-fab-menu__mode"
                aria-pressed={rule.apiSlug === api.apiSlug}
                onClick={() => applyService(api.apiSlug)}
              >
                {api.apiName || api.apiSlug}
              </button>
            ))}
          </div>
        </div>
      )}
      {rule && supportsModel && (
        <label className="kt-content-fab-menu__field">
          <span>{i18n("fab_model")}</span>
          <select
            className="kt-content-fab-menu__model"
            aria-label={i18n("fab_model")}
            value={modelOptions.includes(selectedModel) ? selectedModel : ""}
            onChange={(event) => applyModel(event.target.value)}
          >
            {!selectedModel && <option value="">{i18n("fab_model")}</option>}
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

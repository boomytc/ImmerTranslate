import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_SPE_TYPES,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_SET_MODEL,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  OPT_STYLE_NONE,
  OPT_TRANS_QWENMT,
} from "../../config";
import { getPresetModels } from "../../config/presetModels";
import { useI18n } from "../../hooks/I18n";
import { useRules } from "../../hooks/Rules";
import { useSetting } from "../../hooks/Setting";
import { useAllTextStyles } from "../../hooks/CustomStyles";
import { getApiDisplayName } from "../../hooks/Api";
import ApiKeyEmptyState from "../../components/ApiKeyEmptyState";
import { configuredByokApis, isMissingRequiredApiKey } from "../../libs/apiKey";
import { kissLog } from "../../libs/log";
import { fetchModelCatalog } from "../../libs/modelList";
import {
  readSiteTransOpen,
  SITE_TRANS_OPEN,
  siteRulePattern,
  SITE_TRANS_OPEN_OPTIONS,
  writeSiteApiSlug,
  writeSiteTransOpen,
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
 * The translation service is saved on the site rule. Language, bilingual mode,
 * and style stay on this page through MSG_TRANS_PUTRULE. Open popups hear
 * MSG_TRANS_CURRULE and this menu does too.
 */
export default function FabQuickOptions({
  pageRule,
  processActions,
  onPageRule,
  onHideOnSite,
}) {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const { list: rules = [], isLoading: rulesLoading } = useRules();
  const { allTextStyles } = useAllTextStyles();
  const rule = pageRule;
  const [catalogModels, setCatalogModels] = useState([]);
  const [modelOverride, setModelOverride] = useState(null);
  const [siteDraft, setSiteDraft] = useState(null);
  const modeButtonRefs = useRef([]);
  const href = window.location.href;
  const sitePattern = siteRulePattern(href, rules);
  const storedSiteTransOpen = useMemo(() => {
    try {
      return readSiteTransOpen(href, rules, sitePattern);
    } catch (error) {
      kissLog("read site transOpen", error);
      return SITE_TRANS_OPEN.FOLLOW_GLOBAL;
    }
  }, [href, rules, sitePattern]);
  const siteTransOpen = siteDraft ?? storedSiteTransOpen;

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
  const listUrl = String(activeApi?.url || "").trim();
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
  const currentTextStyle = rule?.textStyle || OPT_STYLE_NONE;
  const styleOptions = useMemo(() => {
    if (
      currentTextStyle &&
      !allTextStyles.some((item) => item.styleSlug === currentTextStyle)
    ) {
      return [
        {
          styleSlug: currentTextStyle,
          styleName: currentTextStyle,
        },
        ...allTextStyles,
      ];
    }
    return allTextStyles;
  }, [allTextStyles, currentTextStyle]);

  useEffect(() => {
    setModelOverride(null);
  }, [rule?.apiSlug, activeApi?.model]);

  useEffect(() => {
    setCatalogModels([]);
  }, [rule?.apiSlug]);

  useEffect(() => {
    setCatalogModels([]);
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
    const persist = writeSiteTransOpen(href, next, rules);
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

  const translationOnly = rule?.transOnly === "true";
  const setTranslationOnly = (enabled) => {
    if (enabled === translationOnly) return;
    const transOnly = enabled ? "true" : "false";
    onPageRule?.((current) => ({ ...current, transOnly }));
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
    const previous = rule?.apiSlug;
    onPageRule?.((current) => ({ ...current, apiSlug }));
    void (async () => {
      try {
        const response = await processActions?.({
          action: MSG_TRANS_PUTRULE,
          args: { apiSlug },
        });
        if (response?.error) throw new Error(response.error);
        const saved = await writeSiteApiSlug(href, apiSlug);
        if (saved?.error) throw new Error(saved.error);
      } catch (error) {
        kissLog("save site apiSlug", error);
        onPageRule?.((current) =>
          current?.apiSlug === apiSlug
            ? { ...current, apiSlug: previous }
            : current
        );
        if (previous) {
          void processActions?.({
            action: MSG_TRANS_PUTRULE,
            args: { apiSlug: previous },
          });
        }
      }
    })();
  };
  const applyToLang = (toLang) => {
    if (!toLang || toLang === rule?.toLang) return;
    onPageRule?.((current) => ({ ...current, toLang }));
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

  const applyTextStyle = (textStyle) => {
    if (!textStyle || textStyle === currentTextStyle) return;
    onPageRule?.((current) => ({ ...current, textStyle }));
    void processActions?.({
      action: MSG_TRANS_PUTRULE,
      args: { textStyle },
    });
  };

  const hasConfiguredCurrentApi = Boolean(
    rule?.apiSlug && configuredApis.some((api) => api.apiSlug === rule.apiSlug)
  );
  const unavailableCurrentApiLabel = activeApi
    ? `${getApiDisplayName(activeApi)} (${i18n("unavailable_option")})`
    : `${rule?.apiSlug || ""} (${i18n("unavailable_option")})`;

  const modeOptions = [
    { value: false, label: i18n("fab_bilingual") },
    { value: true, label: i18n("show_only_translations") },
  ];

  const handleModeKeyDown = (event, index) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? modeOptions.length - 1
          : (index +
              (event.key === "ArrowRight" ? 1 : -1) +
              modeOptions.length) %
            modeOptions.length;
    modeButtonRefs.current[nextIndex]?.focus();
    setTranslationOnly(modeOptions[nextIndex].value);
  };

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
          <span className="kt-content-fab-menu__select-wrap">
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
            <ExpandMoreRoundedIcon
              className="kt-content-fab-menu__chevron"
              aria-hidden="true"
            />
          </span>
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
              <span className="kt-content-fab-menu__select-wrap">
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
                  {rule.apiSlug && !hasConfiguredCurrentApi && (
                    <option value={rule.apiSlug} disabled>
                      {unavailableCurrentApiLabel}
                    </option>
                  )}
                  {configuredApis.map((api) => (
                    <option key={api.apiSlug} value={api.apiSlug}>
                      {getApiDisplayName(api)}
                    </option>
                  ))}
                </select>
                <ExpandMoreRoundedIcon
                  className="kt-content-fab-menu__chevron"
                  aria-hidden="true"
                />
              </span>
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
          <span className="kt-content-fab-menu__select-wrap">
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
            <ExpandMoreRoundedIcon
              className="kt-content-fab-menu__chevron"
              aria-hidden="true"
            />
          </span>
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
          <span className="kt-content-fab-menu__select-wrap">
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
            <ExpandMoreRoundedIcon
              className="kt-content-fab-menu__chevron"
              aria-hidden="true"
            />
          </span>
        </label>
      )}

      {rule && (
        <div className="kt-content-fab-menu__row kt-content-fab-menu__row--stacked">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-fab-mode-label"
          >
            {i18n("fab_translation_mode")}
          </span>
          <div
            className="kt-fab-segmented"
            role="radiogroup"
            aria-labelledby="kt-fab-mode-label"
          >
            {modeOptions.map((option, index) => {
              const checked = translationOnly === option.value;
              return (
                <button
                  key={option.label}
                  ref={(element) => {
                    modeButtonRefs.current[index] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className={`kt-fab-segmented__item${
                    checked ? " kt-fab-segmented__item--active" : ""
                  }`}
                  onClick={() => setTranslationOnly(option.value)}
                  onKeyDown={(event) => handleModeKeyDown(event, index)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rule && (
        <label className="kt-content-fab-menu__row">
          <span
            className="kt-content-fab-menu__row-label"
            id="kt-fab-style-label"
          >
            {i18n("text_style")}
          </span>
          <span className="kt-content-fab-menu__select-wrap">
            <select
              className="kt-content-fab-menu__select kt-content-fab-menu__style-select"
              aria-labelledby="kt-fab-style-label"
              aria-label={i18n("text_style")}
              value={currentTextStyle}
              onChange={(event) => applyTextStyle(event.target.value)}
            >
              {styleOptions.map((style) => (
                <option key={style.styleSlug} value={style.styleSlug}>
                  {style.styleName || style.styleSlug}
                </option>
              ))}
            </select>
            <ExpandMoreRoundedIcon
              className="kt-content-fab-menu__chevron"
              aria-hidden="true"
            />
          </span>
        </label>
      )}

      {onHideOnSite && (
        <div className="kt-content-fab-menu__footer">
          <button
            type="button"
            className="kt-content-fab-menu__hide-fab"
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

import { useEffect, useMemo, useState } from "react";
import {
  API_SPE_TYPES,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_SET_MODEL,
  OPT_TRANS_QWENMT,
} from "../../config";
import { getPresetModels } from "../../config/presetModels";
import { useI18n } from "../../hooks/I18n";
import { useSetting } from "../../hooks/Setting";
import { fetchModelCatalog } from "../../libs/modelList";

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
 * Only the existing bilingual switch and the active engine's model.
 */
export default function FabQuickOptions({ getFabPageState, processActions }) {
  const i18n = useI18n();
  const { setting, updateSetting } = useSetting();
  const [rule, setRule] = useState(null);
  const [catalogModels, setCatalogModels] = useState([]);
  const [modelOverride, setModelOverride] = useState(null);

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

  if (!rule) return null;

  const translationOnly = rule.transOnly === true || rule.transOnly === "true";
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

  return (
    <div className="kt-content-fab-menu__options">
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
      {supportsModel && (
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

import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import Button from "@mui/material/Button";
import { Link as RouterLink } from "react-router-dom";
import { useI18n } from "../../hooks/I18n";
import { useSetting } from "../../hooks/Setting";
import { useRules } from "../../hooks/Rules";
import { useOverviewShortcuts } from "../../hooks/Commands";
import { getApiDisplayName } from "../../hooks/Api";
import {
  GLOBLA_RULE,
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
} from "../../config";
import { configuredByokApis } from "../../libs/apiKey";

export default function OverviewHero() {
  const i18n = useI18n();
  const { setting } = useSetting();
  const { list: rules, isLoading: rulesLoading = false } = useRules();
  const shortcutMap = useOverviewShortcuts(setting);
  const globalRule = rulesLoading
    ? null
    : rules.find((rule) => rule.pattern === "*") || GLOBLA_RULE;
  const transApis = setting?.transApis || [];
  const usableApis = configuredByokApis(transApis);
  const activeApi = globalRule
    ? transApis.find((api) => api.apiSlug === globalRule.apiSlug)
    : null;
  const noUsableService = usableApis.length === 0;
  const serviceName = !globalRule
    ? "—"
    : noUsableService
      ? i18n("overview_no_service_short")
      : activeApi
        ? getApiDisplayName(activeApi)
        : globalRule.apiSlug || "—";
  const sourceLanguage = globalRule
    ? OPT_LANGS_FROM.find(([key]) => key === globalRule.fromLang)?.[1] ||
      globalRule.fromLang ||
      "—"
    : "—";
  const targetLanguage = globalRule
    ? OPT_LANGS_TO.find(([key]) => key === globalRule.toLang)?.[1] ||
      globalRule.toLang ||
      "—"
    : "—";
  const shortcuts = [
    [i18n("popup_translate_page"), shortcutMap.page],
    [i18n("open_menu"), shortcutMap.popup],
    [i18n("open_separate_window"), shortcutMap.separateWindow],
    [i18n("text_style_alt"), shortcutMap.style],
    [i18n("selection_translate"), shortcutMap.selection],
    [i18n("input_translate"), shortcutMap.input],
    [i18n("setting"), shortcutMap.settings],
  ];

  const heroTitle = noUsableService
    ? i18n("overview_setup_needed")
    : i18n("overview_ready_title");
  const heroSubtitle = noUsableService
    ? i18n("fab_no_keyed_provider")
    : i18n("overview_ready_subtitle").replace(
        "{count}",
        String(usableApis.length)
      );

  return (
    <section
      className="kt-overview-top"
      aria-busy={rulesLoading ? "true" : undefined}
    >
      <div className="kt-overview-hero">
        <div className="kt-overview-hero__header">
          <span className="kt-overview-hero__icon" aria-hidden="true">
            <TranslateRoundedIcon />
          </span>
          <span className="kt-overview-hero__copy">
            <span className="kt-overview-hero__title">{heroTitle}</span>
            <span className="kt-overview-hero__subtitle">{heroSubtitle}</span>
          </span>
          {noUsableService && (
            <Button
              component={RouterLink}
              to="/apis"
              size="small"
              variant="contained"
              className="kt-overview-hero__cta"
            >
              {i18n("overview_configure_services")}
            </Button>
          )}
        </div>
        <div className="kt-overview-hero__summary">
          <div className="kt-overview-hero__summary-item">
            <span>{i18n("translate_service")}</span>
            <strong title={serviceName}>{serviceName}</strong>
          </div>
          <div className="kt-overview-hero__summary-item">
            <span>
              {i18n("from_lang")} → {i18n("to_lang")}
            </span>
            <strong>
              {sourceLanguage.split(" - ")[0]} →{" "}
              {targetLanguage.split(" - ")[0]}
            </strong>
          </div>
        </div>
      </div>
      <div className="kt-overview-shortcuts">
        <h2>{i18n("options_shortcuts")}</h2>
        {shortcuts.map(([label, keys = []]) => (
          <div className="kt-overview-shortcut" key={label}>
            <span>{label}</span>
            <span className="kt-overview-shortcut__keys">
              {(keys.length ? keys : ["—"]).map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

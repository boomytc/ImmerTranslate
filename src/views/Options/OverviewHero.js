import Button from "@mui/material/Button";
import { Link as RouterLink } from "react-router-dom";
import { useI18n } from "../../hooks/I18n";
import { useSetting } from "../../hooks/Setting";
import { useRules } from "../../hooks/Rules";
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
  const globalRule = rulesLoading
    ? null
    : rules.find((rule) => rule.pattern === "*") || GLOBLA_RULE;
  const transApis = setting?.transApis || [];
  const usableApis = configuredByokApis(transApis);
  const activeApi = globalRule
    ? transApis.find((api) => api.apiSlug === globalRule.apiSlug)
    : null;
  const noUsableService = usableApis.length === 0;
  const emptyLabel = rulesLoading ? i18n("popup_loading") : i18n("not_set");
  const serviceName = !globalRule
    ? emptyLabel
    : noUsableService
      ? i18n("overview_no_service_short")
      : activeApi
        ? getApiDisplayName(activeApi)
        : globalRule.apiSlug || emptyLabel;
  const sourceLanguage = globalRule
    ? OPT_LANGS_FROM.find(([key]) => key === globalRule.fromLang)?.[1] ||
      globalRule.fromLang ||
      emptyLabel
    : emptyLabel;
  const targetLanguage = globalRule
    ? OPT_LANGS_TO.find(([key]) => key === globalRule.toLang)?.[1] ||
      globalRule.toLang ||
      emptyLabel
    : emptyLabel;
  const langPair = `${sourceLanguage.split(" - ")[0]} → ${targetLanguage.split(" - ")[0]}`;

  const statusTitle = noUsableService
    ? i18n("overview_setup_needed")
    : i18n("overview_ready_title");
  const statusMeta = noUsableService
    ? i18n("fab_no_keyed_provider")
    : i18n("overview_ready_count").replace(
        "{count}",
        String(usableApis.length)
      );

  return (
    <section
      className={`kt-overview-strip ${
        noUsableService ? "kt-overview-strip--warn" : ""
      }`.trim()}
      aria-busy={rulesLoading ? "true" : undefined}
      aria-label={i18n("translate_service")}
    >
      <div className="kt-overview-strip__status">
        <span className="kt-overview-strip__dot" aria-hidden="true" />
        <span className="kt-overview-strip__title">{statusTitle}</span>
        <span className="kt-overview-strip__meta">{statusMeta}</span>
      </div>
      {!noUsableService && (
        <dl className="kt-overview-strip__facts">
          <div className="kt-overview-strip__fact">
            <dt>{i18n("translate_service")}</dt>
            <dd title={serviceName}>{serviceName}</dd>
          </div>
          <div className="kt-overview-strip__fact">
            <dt>{i18n("options_lang_pair")}</dt>
            <dd title={langPair}>{langPair}</dd>
          </div>
        </dl>
      )}
      <div className="kt-overview-strip__action">
        {noUsableService ? (
          <Button
            component={RouterLink}
            to="/apis"
            size="small"
            variant="contained"
          >
            {i18n("overview_configure_services")}
          </Button>
        ) : (
          <RouterLink className="kt-overview-strip__link" to="/apis">
            {i18n("overview_manage_services")}
          </RouterLink>
        )}
      </div>
    </section>
  );
}

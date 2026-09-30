import { useI18n } from "../hooks/I18n";
import { openOptionsApisPage } from "../libs/optionsEntry";

/**
 * Empty state for a missing API key. It does not report a finished translation.
 * The button reuses the failure-path deep link into Options #/apis.
 */
export default function ApiKeyEmptyState({ messageKey, className = "" }) {
  const i18n = useI18n();

  return (
    <div className={className} role="status">
      <p>{i18n(messageKey)}</p>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openOptionsApisPage();
        }}
      >
        {i18n("missing_api_key_action")}
      </button>
    </div>
  );
}

import { httpStatusFromError } from "./modelList";

/** Reuse the connection-test copy when the failure kind is the same. */
export const PAGE_TRANSLATE_INVALID_KEY = "test_connection_invalid_key";
export const PAGE_TRANSLATE_HTTP = "test_connection_http";
export const PAGE_TRANSLATE_NETWORK = "test_connection_network";
/** Distinct: the active service is off or has no usable endpoint. */
export const PAGE_TRANSLATE_SERVICE = "page_translate_service_unavailable";
/** Distinct: page translate can also switch service or open settings. */
export const PAGE_TRANSLATE_FAILED = "page_translate_failed";
/** Distinct: the hover bubble should not say the page translation failed. */
export const HOVER_TRANSLATE_FAILED = "hover_translate_failed";

const INVALID_KEY_RE =
  /invalid(?:\s+|[_-])?(?:api(?:\s+|[_-])?)?key|incorrect api key|api key is invalid|unauthorized/i;

const NETWORK_RE =
  /failed to fetch|network\s*error|networkerror|net::err_|offline|time(?:d )?out|load failed|econnrefused|enotfound|internet disconnected|err_internet|err_name_not_resolved|err_connection|err_network/i;

const SERVICE_RE =
  /url is empty|apitype not matched|service (?:is )?disabled|translator (?:is )?disabled|no translation service|api setting (?:is )?(?:missing|disabled)/i;

function errorMessage(error) {
  if (typeof error === "string") return error;
  return String(error?.message || "");
}

function statusOf(error) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number(error.status);
    if (Number.isFinite(status)) return status;
  }
  return httpStatusFromError(error);
}

function isNetworkFailure(error, message) {
  const name = error?.name || "";
  if (name === "NetworkError" || name === "TimeoutError") return true;
  if (NETWORK_RE.test(message)) return true;
  if (/"status"\s*:\s*0\b/.test(message)) return true;
  return error && typeof error === "object" && Number(error.status) === 0;
}

/**
 * Map a page-translation failure to an actionable i18n key.
 * HTTP status wins over a disabled-service hint so a blocked host or a
 * provider error stays specific.
 *
 * @param {unknown} error
 * @param {{isDisabled?: boolean}|null|undefined} [apiSetting]
 * @returns {string}
 */
export function pageTranslateFailureKey(error, apiSetting) {
  const message = errorMessage(error);
  const status = statusOf(error);

  if (status === 401 || status === 403) return PAGE_TRANSLATE_INVALID_KEY;
  if (status === 400 && INVALID_KEY_RE.test(message)) {
    return PAGE_TRANSLATE_INVALID_KEY;
  }
  if (status >= 400) return PAGE_TRANSLATE_HTTP;
  if (INVALID_KEY_RE.test(message)) return PAGE_TRANSLATE_INVALID_KEY;
  if (isNetworkFailure(error, message)) return PAGE_TRANSLATE_NETWORK;
  if (apiSetting?.isDisabled || SERVICE_RE.test(message)) {
    return PAGE_TRANSLATE_SERVICE;
  }
  return PAGE_TRANSLATE_FAILED;
}

/**
 * Hover bubbles share the page-translate failure kinds. Network, HTTP,
 * invalid-key, and unavailable-service copy stays the same; only the generic
 * sentence is hover-specific.
 *
 * @param {unknown} error
 * @param {{isDisabled?: boolean}|null|undefined} [apiSetting]
 * @returns {string}
 */
export function hoverTranslateFailureKey(error, apiSetting) {
  const key = pageTranslateFailureKey(error, apiSetting);
  return key === PAGE_TRANSLATE_FAILED ? HOVER_TRANSLATE_FAILED : key;
}

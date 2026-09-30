import { fetchModelCatalog, httpStatusFromError } from "./modelList";

const MISSING_CONFIG = "test_connection_missing";
const INVALID_KEY = "test_connection_invalid_key";
const HTTP_ERROR = "test_connection_http";
const NETWORK_ERROR = "test_connection_network";
const UNPARSEABLE = "test_connection_unparseable";

const hasText = (value) => String(value || "").trim().length > 0;

/**
 * Probe a saved translator by listing models.
 * The key stays inside the catalog request and is never copied into the result.
 *
 * @param {Object} params
 * @param {string} params.apiType
 * @param {string} params.modelListUrl Model list URL, or the API base when that is all the user saved.
 * @param {string} params.key
 * @returns {Promise<{ok: true, models: string[]} | {ok: false, kind: string, message: string, status?: number}>}
 */
export async function testApiConnection({ apiType, modelListUrl, key } = {}) {
  let catalog;
  try {
    catalog = await fetchModelCatalog({ apiType, modelListUrl, key });
  } catch (error) {
    const status = httpStatusFromError(error);
    if (status) {
      return {
        ok: false,
        kind: "http",
        status,
        message: status === 401 || status === 403 ? INVALID_KEY : HTTP_ERROR,
      };
    }
    return { ok: false, kind: "network", message: NETWORK_ERROR };
  }

  // fetchModelCatalog returns an empty catalog without sending when key or URL is missing.
  if (!hasText(key) || !hasText(modelListUrl)) {
    return { ok: false, kind: "config", message: MISSING_CONFIG };
  }

  if (!Array.isArray(catalog?.models)) {
    return { ok: false, kind: "provider", message: UNPARSEABLE };
  }

  return {
    ok: true,
    models: catalog.models.filter((model) => typeof model === "string"),
  };
}

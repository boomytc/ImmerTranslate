import { fetchModelCatalog, httpStatusFromError } from "./modelList";
import { OPT_TRANS_BUILTINAI } from "../config";

const MISSING_CONFIG = "test_connection_missing";
const INVALID_KEY = "test_connection_invalid_key";
const HTTP_ERROR = "test_connection_http";
const NETWORK_ERROR = "test_connection_network";
const UNPARSEABLE = "test_connection_unparseable";

const hasText = (value) => String(value || "").trim().length > 0;

/**
 * 测试浏览器内置端侧 AI (Gemini Nano) 翻译能力可用性。
 * 调用 WICG 标准 Translator.availability({ sourceLanguage: "en", targetLanguage: "zh" })。
 *
 * @returns {Promise<{ok: boolean, kind: string, availability: string, message: string}>}
 */
export async function testBuiltinAiConnection() {
  if (
    typeof globalThis === "undefined" ||
    !("Translator" in globalThis) ||
    typeof globalThis.Translator?.availability !== "function"
  ) {
    return {
      ok: false,
      kind: "builtin",
      availability: "unavailable",
      message: "builtin_ai_status_unavailable",
    };
  }

  try {
    const availability = await globalThis.Translator.availability({
      sourceLanguage: "en",
      targetLanguage: "zh",
    });

    if (availability === "readily" || availability === "available") {
      return {
        ok: true,
        kind: "builtin",
        availability: "readily",
        message: "builtin_ai_status_readily",
      };
    }

    if (
      availability === "after-download" ||
      availability === "downloadable" ||
      availability === "downloading"
    ) {
      return {
        ok: true,
        kind: "builtin",
        availability: "after-download",
        message: "builtin_ai_status_after_download",
      };
    }

    return {
      ok: false,
      kind: "builtin",
      availability: "unavailable",
      message: "builtin_ai_status_unavailable",
    };
  } catch (error) {
    return {
      ok: false,
      kind: "builtin",
      availability: "unavailable",
      message: "builtin_ai_status_unavailable",
    };
  }
}

/**
 * Probe a saved translator by listing models.
 * The key stays inside the catalog request and is never copied into the result.
 *
 * @param {Object} params
 * @param {string} [params.apiType]
 * @param {string} [params.apiSlug]
 * @param {string} [params.modelListUrl] Model list URL, or the API base when that is all the user saved.
 * @param {string} [params.key]
 * @returns {Promise<{ok: true, models: string[]} | {ok: false, kind: string, message: string, status?: number}>}
 */
export async function testApiConnection({
  apiType,
  apiSlug,
  modelListUrl,
  key,
} = {}) {
  const resolvedType = apiType || apiSlug;
  if (resolvedType === OPT_TRANS_BUILTINAI) {
    return testBuiltinAiConnection();
  }

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

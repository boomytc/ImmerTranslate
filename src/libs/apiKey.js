import {
  OPT_TRANS_BAIDU,
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_DEEPLFREE,
  OPT_TRANS_DEEPLX,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_GOOGLE_2,
  OPT_TRANS_MICROSOFT,
  OPT_TRANS_OLLAMA,
  OPT_TRANS_TENCENT,
  OPT_TRANS_VOLCENGINE,
  OPT_TRANS_YANDEXFREE,
} from "../config";

/**
 * Engines that translate without a user-supplied API key.
 * Google covers Google and Google2. Paid Google Cloud is not in this set.
 * Local engines (Ollama, DeepLX) keep working when the key field is blank.
 */
export const KEYLESS_API_TYPES = new Set([
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_GOOGLE_2,
  OPT_TRANS_MICROSOFT,
  OPT_TRANS_DEEPLFREE,
  OPT_TRANS_YANDEXFREE,
  OPT_TRANS_BAIDU,
  OPT_TRANS_TENCENT,
  OPT_TRANS_VOLCENGINE,
  OPT_TRANS_OLLAMA,
  OPT_TRANS_DEEPLX,
]);

export function apiTypeOf(api) {
  return String(api?.apiType || api?.apiSlug || "").trim();
}

/** True when this provider cannot translate until the user fills a key. */
export function apiRequiresKey(api) {
  const apiType = apiTypeOf(api);
  if (!apiType) return false;
  return !KEYLESS_API_TYPES.has(apiType);
}

/**
 * Current provider is a keyed engine and its key is blank.
 * Disabled rows still count when they are the active apiSlug.
 */
export function isMissingRequiredApiKey(api) {
  if (!api) return false;
  return apiRequiresKey(api) && !String(api.key || "").trim();
}

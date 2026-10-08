import {
  OPT_TRANS_BAIDU,
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_DEEPLFREE,
  OPT_TRANS_DEEPLX,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_MICROSOFT,
  OPT_TRANS_OLLAMA,
  OPT_TRANS_TENCENT,
  OPT_TRANS_VOLCENGINE,
  OPT_TRANS_YANDEXFREE,
} from "../config";
import { isBuiltinAIAvailable } from "./browser";

/**
 * 判断当前宿主环境是否支持原生内置 AI (LanguageDetector 和 Translator)。
 * 优先响应显式 mock 的 isBuiltinAIAvailable，并动态检测 globalThis 环境能力。
 */
export const isBuiltinAiSupported = () => {
  if (typeof isBuiltinAIAvailable === "boolean" && !isBuiltinAIAvailable) {
    return false;
  }
  return (
    typeof globalThis !== "undefined" &&
    "LanguageDetector" in globalThis &&
    "Translator" in globalThis
  );
};

/**
 * Engines that translate without a user-supplied API key.
 * Paid Google Cloud is not in this set.
 * Local engines (Ollama, DeepLX) keep working when the key field is blank.
 */
export const KEYLESS_API_TYPES = new Set([
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_GOOGLE,
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

/**
 * Enabled providers a picker can switch to.
 * A row qualifies when it has a non-empty key, or when it does not require
 * one (keyless engines such as Microsoft, Google, and BuiltinAI).
 * Disabled rows stay out. Key-required rows with a blank key stay out.
 * BuiltinAI requires host environment support; otherwise filtered out.
 */
export const configuredByokApis = (transApis = []) => {
  const builtinSupported = isBuiltinAiSupported();
  return transApis
    .filter((api) => {
      if (!api || api.isDisabled) return false;
      const apiType = apiTypeOf(api);
      if (apiType === OPT_TRANS_BUILTINAI && !builtinSupported) {
        return false;
      }
      return Boolean(String(api.key || "").trim() || !apiRequiresKey(api));
    })
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
};

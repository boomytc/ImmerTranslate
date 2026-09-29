/**
 * Runtime options for the DeepSeek OpenAI-compatible endpoint.
 * Reads variable names only; this module never stores a key.
 */

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ apiKey: string, baseUrl: string, model: string } | null}
 */
export function deepSeekOptionsFromEnv(env = process.env) {
  const source = env && typeof env === "object" ? env : {};
  const apiKey =
    typeof source.DEEPSEEK_API_KEY === "string" ? source.DEEPSEEK_API_KEY.trim() : "";
  if (!apiKey) return null;
  const baseRaw =
    typeof source.DEEPSEEK_BASE_URL === "string" ? source.DEEPSEEK_BASE_URL.trim() : "";
  return {
    apiKey,
    baseUrl: baseRaw || DEFAULT_DEEPSEEK_BASE_URL,
    model: DEFAULT_DEEPSEEK_MODEL,
  };
}

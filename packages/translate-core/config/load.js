/**
 * Node / cloud engine config. The browser extension does not import this module
 * (it uses chrome.storage). Sync does not copy this file into extension/vendor.
 *
 * Merge (later wins): defaults ← config.yaml ← config.local.yaml ← env.
 * YAML subset: one `key: value` per line, optional quotes, full-line `#` comments.
 * No nesting, no indented lines, no inline comments.
 *
 * @typedef {object} MergedEngineConfig
 * @property {string} provider `openai` (OpenAI-compatible, including DeepSeek) or `anthropic`
 * @property {string} apiKey
 * @property {string} baseUrl
 * @property {string} model
 * @property {string} sourceLang
 * @property {string} targetLang
 *
 * @typedef {import('../src/types.js').TranslateEngine} TranslateEngine
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAnthropicCompatibleEngine, createOpenAICompatibleEngine } from "../src/engines.js";
import { mockTranslate } from "../src/mock.js";

/** @type {MergedEngineConfig} */
export const ENGINE_CONFIG_DEFAULTS = {
  provider: "openai",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
  apiKey: "",
  sourceLang: "auto",
  targetLang: "zh-CN",
};

const FIELDS = /** @type {(keyof MergedEngineConfig)[]} */ (Object.keys(ENGINE_CONFIG_DEFAULTS));

/**
 * Later rows win. DeepSeek names are last so they override generic names and YAML.
 * Blank or whitespace-only values are treated as unset.
 */
const ENV_BINDINGS = [
  ["IMMER_TRANSLATE_PROVIDER", "provider"],
  ["IMMER_TRANSLATE_BASE_URL", "baseUrl"],
  ["IMMER_TRANSLATE_MODEL", "model"],
  ["IMMER_TRANSLATE_API_KEY", "apiKey"],
  ["IMMER_TRANSLATE_SOURCE_LANG", "sourceLang"],
  ["IMMER_TRANSLATE_TARGET_LANG", "targetLang"],
  ["DEEPSEEK_BASE_URL", "baseUrl"],
  ["DEEPSEEK_API_KEY", "apiKey"],
];

/**
 * @param {string} raw
 * @returns {string}
 */
function unquote(raw) {
  const value = raw.trim();
  if (value.length >= 2) {
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      const inner = value.slice(1, -1);
      if (quote === '"') {
        return inner
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
      return inner;
    }
  }
  return value;
}

/**
 * @param {unknown} text
 * @returns {Record<string, string>}
 */
export function parseYamlSubset(text) {
  /** @type {Record<string, string>} */
  const out = {};
  const body = String(text ?? "").replace(/^\uFEFF/, "");
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      throw new Error("YAML subset does not support indented lines");
    }
    const colon = line.indexOf(":");
    if (colon <= 0) {
      throw new Error(`unsupported YAML line: ${line.trim().slice(0, 80)}`);
    }
    const key = line.slice(0, colon).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`unsupported YAML key: ${key.slice(0, 40)}`);
    }
    out[key] = unquote(line.slice(colon + 1));
  }
  return out;
}

/**
 * @param {Record<string, string>} parsed
 * @returns {Partial<MergedEngineConfig>}
 */
function pickFields(parsed) {
  /** @type {Partial<MergedEngineConfig>} */
  const out = {};
  for (const key of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
    out[key] = String(parsed[key]).trim();
  }
  return out;
}

/**
 * @param {(filePath: string) => string | null | undefined} readFile
 * @param {string} filePath
 * @returns {string}
 */
function readOptional(readFile, filePath) {
  try {
    const text = readFile(filePath);
    if (text == null) return "";
    return String(text);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
    if (code === "ENOENT" || code === "ENOTDIR") return "";
    throw err;
  }
}

/**
 * @param {MergedEngineConfig} config
 * @param {Record<string, string | undefined> | NodeJS.ProcessEnv} env
 * @returns {MergedEngineConfig}
 */
function applyEnv(config, env) {
  const source = env && typeof env === "object" ? env : {};
  for (const [name, field] of ENV_BINDINGS) {
    const raw = source[name];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    config[/** @type {keyof MergedEngineConfig} */ (field)] = trimmed;
  }
  return config;
}

/**
 * Shallow-merge engine settings for Node / cloud.
 * `readFile` is called with absolute paths (`join(cwd, "config.yaml")` and
 * `join(cwd, "config.local.yaml")`). Return `null` / `undefined`, or throw
 * `ENOENT`, when a file is absent.
 *
 * @param {{
 *   cwd?: string,
 *   env?: Record<string, string | undefined> | NodeJS.ProcessEnv,
 *   readFile?: (filePath: string) => string | null | undefined,
 * }} [opts]
 * @returns {MergedEngineConfig}
 */
export function loadMergedEngineConfig(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const env = opts.env || process.env;
  const readFile = opts.readFile || ((filePath) => readFileSync(filePath, "utf8"));
  const base = pickFields(parseYamlSubset(readOptional(readFile, join(cwd, "config.yaml"))));
  const local = pickFields(parseYamlSubset(readOptional(readFile, join(cwd, "config.local.yaml"))));
  return applyEnv({ ...ENGINE_CONFIG_DEFAULTS, ...base, ...local }, env);
}

/**
 * `anthropic` → Anthropic Messages engine. Any other provider (including
 * `openai` and DeepSeek) → OpenAI-compatible chat completions.
 * Empty `apiKey` returns `mockTranslate` and does not call the network.
 *
 * @param {Partial<MergedEngineConfig> & { fetchImpl?: typeof fetch }} cfg
 * @param {{ fetchImpl?: typeof fetch }} [extra]
 * @returns {TranslateEngine}
 */
export function createEngineFromMergedConfig(cfg, extra = {}) {
  const apiKey = typeof cfg?.apiKey === "string" ? cfg.apiKey.trim() : "";
  if (!apiKey) return mockTranslate;
  const provider = String(cfg?.provider || "openai").trim().toLowerCase();
  const options = {
    apiKey,
    baseUrl: cfg?.baseUrl,
    model: cfg?.model,
    fetchImpl: extra?.fetchImpl,
  };
  if (provider === "anthropic") return createAnthropicCompatibleEngine(options);
  return createOpenAICompatibleEngine(options);
}

/**
 * Message bus → translate-core (vendored).
 * Refresh vendor: `./scripts/sync-translate-core.sh`
 *
 * Settings (chrome.storage.local): provider openai|anthropic, baseUrl, model, apiKey,
 * paragraphHotkey. Empty apiKey stays on mockTranslate. Defaults: OpenAI-compatible
 * DeepSeek. Paragraph hotkey default is Alt+T (content script matches it).
 * The selected engine is wrapped once with createPipelineEngine (TransPipe).
 */

import {
  mockTranslate,
  createOpenAICompatibleEngine,
  createAnthropicCompatibleEngine,
  createPipelineEngine,
} from "./vendor/translate-core/index.js";

const DEFAULTS = {
  provider: "openai",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
  apiKey: "",
  sourceLang: "auto",
  targetLang: "zh-CN",
  paragraphHotkey: "Alt+T",
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (data) => resolve({ ...DEFAULTS, ...data }));
  });
}

/**
 * @param {Partial<typeof DEFAULTS>} settings
 * @returns {import("./vendor/translate-core/types.js").TranslateEngine}
 */
export function buildEngine(settings = {}) {
  const apiKey = (settings.apiKey || "").trim();
  if (!apiKey) return mockTranslate;

  const baseUrl = (settings.baseUrl || "").trim() || DEFAULTS.baseUrl;
  const model = (settings.model || "").trim() || DEFAULTS.model;
  const provider = String(settings.provider || DEFAULTS.provider)
    .trim()
    .toLowerCase();
  const opts = { apiKey, baseUrl, model };

  if (provider === "anthropic") {
    return createAnthropicCompatibleEngine(opts);
  }
  return createOpenAICompatibleEngine(opts);
}

/** @type {import("./vendor/translate-core/types.js").TranslateEngine | null} */
let pipedEngine = null;
let pipedStamp = "";

/**
 * Reuse one pipeline so paragraph cache and rate limit survive later batches.
 * Rebuild only when provider, base URL, model, or apiKey changes.
 * @param {Partial<typeof DEFAULTS>} settings
 * @returns {import("./vendor/translate-core/types.js").TranslateEngine}
 */
export function engineFor(settings = {}) {
  const base = buildEngine(settings);
  const apiKey = (settings.apiKey || "").trim();
  const provider = String(settings.provider || DEFAULTS.provider)
    .trim()
    .toLowerCase();
  const model = (settings.model || "").trim() || DEFAULTS.model;
  const baseUrl = (settings.baseUrl || "").trim() || DEFAULTS.baseUrl;
  const stamp = [provider, baseUrl, model, apiKey].join("\0");
  if (!pipedEngine || pipedStamp !== stamp) {
    pipedStamp = stamp;
    pipedEngine = createPipelineEngine(base, {
      cache: { provider, model },
    });
  }
  return pipedEngine;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TRANSLATE_BATCH") {
      getSettings()
        .then((settings) => {
          const engine = engineFor(settings);
          const payload = {
            sourceLang: message.payload?.sourceLang || settings.sourceLang,
            targetLang: message.payload?.targetLang || settings.targetLang,
            segments: message.payload?.segments || [],
          };
          return engine(payload);
        })
        .then((res) => sendResponse({ ok: true, data: res }))
        .catch((err) =>
          sendResponse({ ok: false, error: String(err?.message || err) })
        );
      return true;
    }
    if (message?.type === "GET_SETTINGS") {
      getSettings().then((settings) =>
        sendResponse({
          ok: true,
          data: {
            sourceLang: settings.sourceLang,
            targetLang: settings.targetLang,
            provider: settings.provider,
            baseUrl: settings.baseUrl,
            model: settings.model,
            hasApiKey: Boolean((settings.apiKey || "").trim()),
            paragraphHotkey: settings.paragraphHotkey || DEFAULTS.paragraphHotkey,
          },
        })
      );
      return true;
    }
    return false;
  });
}

if (typeof chrome !== "undefined" && chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATE" });
    } catch {
      // Content script may not be injected yet (chrome:// etc.)
    }
  });
}

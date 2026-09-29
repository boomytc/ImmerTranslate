/**
 * Message bus → translate-core (vendored).
 * Refresh vendor: `./scripts/sync-translate-core.sh`
 *
 * Settings (chrome.storage.local): provider openai|anthropic, baseUrl, model, apiKey,
 * paragraphHotkey, denyOrigins, allowOrigins, translationFontSize,
 * translationContrast, displayMode. Empty apiKey stays on mockTranslate.
 * Defaults: OpenAI-compatible DeepSeek. Paragraph hotkey canonical default
 * is Alt+T (Option on macOS, Alt on Windows and Linux). The service worker
 * reads chrome.runtime.getPlatformInfo and, on macOS, stores that default as
 * ⌥T so the saved value matches the options page. Whole-page translate stays
 * Alt+A in the content script (⌥A on macOS), never Command+T. The same
 * chord is also a chrome.commands shortcut so a browser that eats the page
 * keydown still messages the active tab with TOGGLE_TRANSLATE. Site lists
 * default to empty (every origin eligible). The content script enforces deny
 * before inserting nodes.
 * The selected engine is wrapped once with createPipelineEngine (TransPipe).
 * The toolbar opens popup.html (default_popup). That card and the in-page
 * ball both message this worker only for TRANSLATE_BATCH / GET_SETTINGS;
 * page on/off state stays in the content script.
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
  denyOrigins: [],
  allowOrigins: [],
  translationFontSize: "md",
  translationContrast: "normal",
  displayMode: "bilingual",
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

/** @type {string} */
let platformOs = "";

/**
 * Service worker has no reliable navigator.platform. getPlatformInfo is the
 * extension API for this context. macOS rewrites a missing or literal Alt+T
 * paragraph default to ⌥T; other chords are left alone.
 */
function refreshPlatformOs() {
  if (typeof chrome === "undefined" || !chrome.runtime?.getPlatformInfo) return;
  chrome.runtime.getPlatformInfo((info) => {
    platformOs = info?.os || "";
    if (platformOs !== "mac" || !chrome.storage?.local) return;
    chrome.storage.local.get({ paragraphHotkey: "" }, (data) => {
      const current = String(data?.paragraphHotkey || "").trim();
      if (current && current !== "Alt+T") return;
      chrome.storage.local.set({ paragraphHotkey: "⌥T" });
    });
  });
}

if (typeof chrome !== "undefined" && chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command !== "toggle-page-translate") return;
    if (!chrome.tabs?.query) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId || !chrome.tabs?.sendMessage) return;
      chrome.tabs.sendMessage(tabId, { type: "TOGGLE_TRANSLATE" }, () => {
        // Article pages have the content script. chrome:// and other
        // unsupported tabs report lastError; there is nothing to toggle.
        void chrome.runtime.lastError;
      });
    });
  });
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  refreshPlatformOs();
  if (chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
      refreshPlatformOs();
    });
  }
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
            platformOs,
            denyOrigins: Array.isArray(settings.denyOrigins) ? settings.denyOrigins : [],
            allowOrigins: Array.isArray(settings.allowOrigins) ? settings.allowOrigins : [],
            translationFontSize: settings.translationFontSize || DEFAULTS.translationFontSize,
            translationContrast: settings.translationContrast || DEFAULTS.translationContrast,
            displayMode: settings.displayMode || DEFAULTS.displayMode,
          },
        })
      );
      return true;
    }
    return false;
  });
}


/**
 * Message bus → translate-core (vendored).
 * Refresh vendor: `./scripts/sync-translate-core.sh`
 *
 * Settings (chrome.storage.local): provider openai|anthropic, baseUrl, model, apiKey,
 * pageHotkey, paragraphHotkey, denyOrigins, allowOrigins, translationFontSize,
 * translationContrast, displayMode, ballEnabled. Empty apiKey stays on mockTranslate.
 * Defaults: OpenAI-compatible DeepSeek. Paragraph hotkey canonical default
 * is Alt+T (Option on macOS, Alt on Windows and Linux). The service worker
 * reads chrome.runtime.getPlatformInfo and, on macOS, stores that default as
 * ⌥T so the saved value matches the options page. Whole-page translate stays
 * Alt+A in the content script (⌥A on macOS), never Command+T. The same
 * chord is also a chrome.commands shortcut so a browser that eats the page
 * keydown still messages the active tab with TOGGLE_TRANSLATE. Paragraph
 * Alt+T is a separate command (translate-hovered-paragraph). It messages
 * TRANSLATE_HOVERED_PARAGRAPH with the command's current shortcut; the
 * content script translates the hovered paragraph only when that shortcut
 * still matches the saved paragraphHotkey. Site lists
 * default to empty (every origin eligible). The content script enforces deny
 * before inserting nodes.
 * The selected engine is wrapped once with createPipelineEngine (TransPipe).
 * The toolbar opens popup.html (default_popup). That card and the in-page
 * ball both message this worker only for TRANSLATE_BATCH / GET_SETTINGS;
 * page on/off state stays in the content script.
 * A rejected translate is not swallowed: TRANSLATE_BATCH answers with
 * ok:false plus error (message), kind, code, and status from TranslateFailure.
 * TranslateRequest / TranslateResponse are unchanged.
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
  pageHotkey: "Alt+A",
  paragraphHotkey: "Alt+T",
  denyOrigins: [],
  allowOrigins: [],
  translationFontSize: "md",
  translationContrast: "normal",
  displayMode: "bilingual",
  ballEnabled: true,
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

/**
 * @param {Record<string, unknown>} payload
 */
function messageActiveTab(payload) {
  if (!chrome.tabs?.query) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && tabs[0].id;
    if (!tabId || !chrome.tabs?.sendMessage) return;
    chrome.tabs.sendMessage(tabId, payload, () => {
      // Article pages have the content script. chrome:// and other
      // unsupported tabs report lastError; there is nothing to do.
      void chrome.runtime.lastError;
    });
  });
}

/**
 * Shortcut currently bound to the paragraph command. Falls back to the
 * manifest suggestion Alt+T when the query has no string; the content script
 * still ignores it unless it matches the saved paragraphHotkey.
 * @returns {Promise<string>}
 */
function paragraphCommandShortcut() {
  const fallback = "Alt+T";
  if (!chrome.commands?.getAll) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    try {
      chrome.commands.getAll((commands) => {
        void chrome.runtime.lastError;
        const found = (commands || []).find(
          (item) => item && item.name === "translate-hovered-paragraph"
        );
        const shortcut =
          found && typeof found.shortcut === "string" ? found.shortcut.trim() : "";
        resolve(shortcut || fallback);
      });
    } catch {
      resolve(fallback);
    }
  });
}

/**
 * Rejection envelope for TRANSLATE_BATCH. A plain Error leaves kind, code,
 * and status undefined; TranslateFailure fills them in.
 * @param {any} err
 * @returns {{ ok: false, error: string, kind?: string, code?: string, status?: number }}
 */
export function failureResponse(err) {
  return {
    ok: false,
    error: String(err?.message || err),
    kind: err?.kind,
    code: err?.code,
    status: err?.status,
  };
}

if (typeof chrome !== "undefined" && chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-page-translate") {
      messageActiveTab({ type: "TOGGLE_TRANSLATE" });
      return;
    }
    if (command !== "translate-hovered-paragraph") return;
    paragraphCommandShortcut().then((shortcut) => {
      messageActiveTab({ type: "TRANSLATE_HOVERED_PARAGRAPH", shortcut });
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
        .catch((err) => sendResponse(failureResponse(err)));
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
            pageHotkey: settings.pageHotkey || DEFAULTS.pageHotkey,
            paragraphHotkey: settings.paragraphHotkey || DEFAULTS.paragraphHotkey,
            ballEnabled: settings.ballEnabled !== false,
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


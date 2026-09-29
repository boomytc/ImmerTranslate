/**
 * Message bus → translate-core (vendored).
 * Refresh vendor: `./scripts/sync-translate-core.sh`
 */

import * as core from "./vendor/translate-core/index.js";

const { mockTranslate, createOpenAICompatibleEngine } = core;

const DEFAULTS = {
  provider: "openai",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
  apiKey: "",
  sourceLang: "auto",
  targetLang: "zh-CN",
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (data) => resolve({ ...DEFAULTS, ...data }));
  });
}

/**
 * @param {typeof DEFAULTS} settings
 */
function buildEngine(settings) {
  const apiKey = (settings.apiKey || "").trim();
  if (!apiKey) return mockTranslate;

  const baseUrl = (settings.baseUrl || DEFAULTS.baseUrl).trim();
  const model = (settings.model || DEFAULTS.model).trim();

  if (settings.provider === "anthropic") {
    const createAnthropic = core.createAnthropicCompatibleEngine;
    if (typeof createAnthropic !== "function") {
      throw new Error("Anthropic 引擎尚未同步到 vendor，请更新扩展");
    }
    return createAnthropic({ apiKey, baseUrl, model });
  }

  if (typeof createOpenAICompatibleEngine !== "function") {
    throw new Error("OpenAI 兼容引擎尚未同步到 vendor，请更新扩展");
  }
  return createOpenAICompatibleEngine({ apiKey, baseUrl, model });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TRANSLATE_BATCH") {
    getSettings()
      .then((settings) => {
        const engine = buildEngine(settings);
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
        },
      })
    );
    return true;
  }
  return false;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TRANSLATE" });
  } catch {
    // Content script may not be injected yet (chrome:// etc.)
  }
});

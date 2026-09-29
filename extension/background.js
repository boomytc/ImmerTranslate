/**
 * Message bus. Translate engine from packages/translate-core
 * (vendored under extension/vendor for MV3 load rules).
 * Refresh vendor: `./scripts/sync-translate-core.sh`
 */

import { mockTranslate } from "./vendor/translate-core/index.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TRANSLATE_BATCH") {
    mockTranslate(message.payload)
      .then((res) => sendResponse({ ok: true, data: res }))
      .catch((err) =>
        sendResponse({ ok: false, error: String(err?.message || err) })
      );
    return true;
  }
  if (message?.type === "GET_SETTINGS") {
    chrome.storage.local.get(
      { sourceLang: "auto", targetLang: "zh-CN", apiKey: "" },
      (settings) => sendResponse({ ok: true, data: settings })
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

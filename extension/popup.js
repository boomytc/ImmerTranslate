const $ = (id) => document.getElementById(id);

/**
 * @param {number} tabId
 * @param {Record<string, unknown>} message
 */
function send(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(res);
    });
  });
}

function activeTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve((tabs && tabs[0]) || null);
    });
  });
}

/**
 * @param {Record<string, unknown>} defaults
 */
function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (data) => resolve({ ...defaults, ...(data || {}) }));
  });
}

/**
 * @param {string} text
 */
function setHint(text) {
  $("hint").textContent = text || "";
}

/**
 * Read-only engine / language line. Empty key stays on the mock label.
 * @param {Record<string, unknown>} stored
 */
function paintEngine(stored) {
  const key = String(stored.apiKey || "").trim();
  const source = String(stored.sourceLang || "auto").trim() || "auto";
  const target = String(stored.targetLang || "zh-CN").trim() || "zh-CN";
  const langs = `${source} → ${target}`;
  const provider = String(stored.provider || "openai").trim().toLowerCase();
  const engine = provider === "anthropic" ? "Anthropic 兼容" : "OpenAI 兼容";
  $("mock").hidden = false;
  $("mock").textContent = key
    ? `${engine} · ${langs}`
    : `Mock 模式：未填写 API Key，译文为 ⟦原文⟧ · ${langs}`;
}

let busy = false;
/** @type {boolean} */
let pageActive = false;

/**
 * Dual-state primary CTA: 「翻译」 when the page is original, 「显示原文」 when translated.
 * @param {{ supported: boolean, denied: boolean, active: boolean }} view
 */
function paint(view) {
  const button = $("toggle");
  if (!view.supported) {
    $("status").textContent = "此页面无法翻译";
    button.textContent = "翻译";
    button.disabled = true;
    return;
  }
  if (view.denied) {
    $("status").textContent = "本站永不翻译";
    button.textContent = "翻译";
    button.disabled = true;
    return;
  }
  pageActive = view.active;
  $("status").textContent = view.active ? "已翻译" : "未翻译";
  button.textContent = view.active ? "显示原文" : "翻译";
  button.disabled = busy;
}

async function refresh() {
  const tab = await activeTab();
  const stored = await storageGet({
    apiKey: "",
    provider: "openai",
    sourceLang: "auto",
    targetLang: "zh-CN",
  });
  paintEngine(stored);

  const supported = Boolean(tab?.id) && /^https?:/i.test(tab.url || "");
  if (!supported) {
    paint({ supported: false, denied: false, active: false });
    return;
  }

  /** @type {{ ok?: boolean, active?: boolean, denied?: boolean } | null} */
  let state = null;
  try {
    state = await send(tab.id, { type: "GET_PAGE_STATE" });
  } catch {
    state = null;
  }
  if (!state?.ok) {
    paint({ supported: false, denied: false, active: false });
    return;
  }
  const denied = Boolean(state.denied);
  paint({
    supported: true,
    denied,
    active: Boolean(state.active) && !denied,
  });
}

/**
 * @param {() => Promise<void>} action
 */
async function run(action) {
  if (busy) return;
  busy = true;
  $("toggle").disabled = true;
  try {
    await action();
  } catch (err) {
    setHint(String(err?.message || err || "操作失败"));
  } finally {
    busy = false;
    await refresh();
  }
}

$("toggle").addEventListener("click", () => {
  run(async () => {
    const tab = await activeTab();
    if (!tab?.id) return;
    const type = pageActive ? "RESTORE_PAGE" : "TRANSLATE_PAGE";
    const res = await send(tab.id, { type });
    if (!res?.ok) throw new Error(res?.error || "操作失败");
    if (res.denied) setHint("本站已设为永不翻译");
    else setHint("");
  });
});

$("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh().catch(() => {
  paint({ supported: false, denied: false, active: false });
});

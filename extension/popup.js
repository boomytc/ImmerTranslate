const $ = (id) => document.getElementById(id);

const siteApi = globalThis.ImmerSites;

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
 * @param {Record<string, unknown>} data
 */
function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

/**
 * @param {string} text
 */
function setHint(text) {
  $("hint").textContent = text || "";
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
    $("deny").disabled = true;
    return;
  }
  if (view.denied) {
    $("status").textContent = "本站永不翻译";
    button.textContent = "翻译";
    button.disabled = true;
    $("deny").disabled = true;
    return;
  }
  pageActive = view.active;
  $("status").textContent = view.active ? "已翻译" : "未翻译";
  button.textContent = view.active ? "显示原文" : "翻译";
  button.disabled = busy;
  $("deny").disabled = busy;
}

async function refresh() {
  const tab = await activeTab();
  const stored = await storageGet({ apiKey: "" });
  const mock = !String(stored.apiKey || "").trim();
  $("mock").hidden = !mock;

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
  $("deny").disabled = true;
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

$("deny").addEventListener("click", () => {
  run(async () => {
    const tab = await activeTab();
    if (!tab?.id || !/^https?:/i.test(tab.url || "")) {
      setHint("此页面无法加入永不翻译");
      return;
    }
    try {
      const res = await send(tab.id, { type: "DENY_THIS_ORIGIN" });
      if (!res?.ok) throw new Error(res?.error || "加入失败");
      setHint(res.entry ? `已加入永不翻译：${res.entry}` : "已加入永不翻译");
      return;
    } catch (err) {
      const entry = siteApi?.normalizeSiteEntry(tab.url || "") || "";
      if (!entry) throw err;
      const stored = await storageGet({ denyOrigins: [] });
      const list = siteApi.normalizeSiteList(stored.denyOrigins);
      if (!list.includes(entry)) list.push(entry);
      await storageSet({ denyOrigins: list });
      setHint(`已加入永不翻译：${entry}`);
    }
  });
});

$("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh().catch(() => {
  paint({ supported: false, denied: false, active: false });
});

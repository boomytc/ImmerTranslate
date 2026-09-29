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

async function refresh() {
  const tab = await activeTab();
  const stored = await storageGet({ apiKey: "" });
  const mock = !String(stored.apiKey || "").trim();
  $("mock").hidden = !mock;

  const supported = Boolean(tab?.id) && /^https?:/i.test(tab.url || "");
  if (!supported) {
    $("status").textContent = "此页面无法翻译";
    $("translate").disabled = true;
    $("restore").disabled = true;
    $("deny").disabled = true;
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
    $("status").textContent = "此页面无法翻译";
    $("translate").disabled = true;
    $("restore").disabled = true;
    $("deny").disabled = true;
    return;
  }

  const denied = Boolean(state.denied);
  const active = Boolean(state.active) && !denied;
  $("status").textContent = denied ? "本站永不翻译" : active ? "已翻译" : "未翻译";
  $("translate").disabled = busy || denied || active;
  $("restore").disabled = busy || !active;
  $("deny").disabled = busy || denied;
}

/**
 * @param {() => Promise<void>} action
 */
async function run(action) {
  if (busy) return;
  busy = true;
  $("translate").disabled = true;
  $("restore").disabled = true;
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

$("translate").addEventListener("click", () => {
  run(async () => {
    const tab = await activeTab();
    if (!tab?.id) return;
    const res = await send(tab.id, { type: "TRANSLATE_PAGE" });
    if (!res?.ok) throw new Error(res?.error || "翻译失败");
    if (res.denied) setHint("本站已设为永不翻译");
    else setHint("");
  });
});

$("restore").addEventListener("click", () => {
  run(async () => {
    const tab = await activeTab();
    if (!tab?.id) return;
    const res = await send(tab.id, { type: "RESTORE_PAGE" });
    if (!res?.ok) throw new Error(res?.error || "还原失败");
    setHint("");
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
  $("status").textContent = "此页面无法翻译";
});

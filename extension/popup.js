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
/** @type {boolean} */
let pageDenied = false;
/** @type {boolean} */
let pageOnAllow = false;

const siteApi = globalThis.ImmerSites;

const LABEL_TRANSLATE = "翻译";
const LABEL_RESTORE = "显示原文";

/**
 * Page-translate CTA. Parentheses come from formatActionLabel, shared with
 * the options-page chord formatter.
 * @returns {string}
 */
/** Saved page chord, or "" until storage returns. Display still uses DEFAULT_PAGE_HOTKEY. */
let pageChord = "";

function translateLabel() {
  const api = globalThis.ImmerHotkey;
  if (!api) return LABEL_TRANSLATE;
  return api.formatActionLabel(LABEL_TRANSLATE, pageChord || api.DEFAULT_PAGE_HOTKEY);
}

/**
 * Dual-state primary CTA, plus the current-page deny / allow buttons.
 * `supported` is whether this tab can translate. `listable` is whether its
 * origin can be written into a site list (any http(s) page).
 * @param {{ supported: boolean, listable: boolean, denied: boolean, onAllow: boolean, active: boolean, entry: string }} view
 */
function paint(view) {
  const button = $("toggle");
  pageDenied = Boolean(view.denied);
  pageOnAllow = Boolean(view.onAllow);
  const denyBtn = $("addPageDeny");
  const allowBtn = $("addPageAllow");
  denyBtn.textContent = pageDenied ? "本页移出永不翻译" : "本页加入永不翻译";
  allowBtn.textContent = pageOnAllow ? "本页移出始终翻译" : "本页加入始终翻译";
  denyBtn.disabled = !view.listable || busy;
  allowBtn.disabled = !view.listable || busy;
  $("pageOrigin").textContent = view.entry ? `本页来源：${view.entry}` : "";
  if (!view.supported) {
    $("status").textContent = "此页面无法翻译";
    button.textContent = translateLabel();
    button.disabled = true;
    pageActive = false;
    return;
  }
  if (view.denied) {
    $("status").textContent = "本站永不翻译";
    button.textContent = translateLabel();
    button.disabled = true;
    pageActive = false;
    return;
  }
  pageActive = view.active;
  $("status").textContent = view.active ? "已翻译" : "未翻译";
  button.textContent = view.active ? LABEL_RESTORE : translateLabel();
  button.disabled = busy;
}

/**
 * @param {chrome.tabs.Tab | null} tab
 * @returns {{ entry: string, page: { origin: string, hostname: string } } | null}
 */
function pageRefFromTab(tab) {
  const url = tab?.url || "";
  if (!/^https?:/i.test(url) || !siteApi) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const entry = siteApi.normalizeSiteEntry(url);
  if (!entry) return null;
  return {
    entry,
    page: { origin: parsed.origin, hostname: parsed.hostname },
  };
}

/**
 * @param {Record<string, unknown>} patch
 */
function storageSet(patch) {
  return new Promise((resolve) => {
    chrome.storage.local.set(patch, () => resolve());
  });
}

/**
 * @param {{ changed?: boolean, entry?: string, removed?: string[], which?: string, mode?: string, denied?: boolean, onAllow?: boolean }} res
 */
function describeListChange(res) {
  const entry = res.entry || "";
  const removed = Array.isArray(res.removed) && res.removed.length ? res.removed.join("、") : entry;
  if (res.which === "deny" && res.mode === "add") {
    if (!res.changed) return `已在永不翻译中：${entry}`;
    return res.onAllow
      ? `已加入永不翻译：${entry}（优先于始终翻译）`
      : `已加入永不翻译：${entry}`;
  }
  if (res.which === "deny" && res.mode === "remove") {
    if (!res.changed) return "本页不在永不翻译中";
    return `已移出永不翻译：${removed}`;
  }
  if (res.which === "allow" && res.mode === "add") {
    if (!res.changed) return `已在始终翻译中：${entry}`;
    return res.denied
      ? `已加入始终翻译：${entry}。本页仍不翻译，以永不翻译为准`
      : `已加入始终翻译：${entry}`;
  }
  if (!res.changed) return "本页不在始终翻译中";
  return `已移出始终翻译：${removed}`;
}

/**
 * @param {"deny" | "allow"} which
 * @param {"add" | "remove"} mode
 * @param {{ entry: string, page: { origin: string, hostname: string } }} ref
 */
async function writePageList(which, mode, ref) {
  const data = await storageGet({ denyOrigins: [], allowOrigins: [] });
  const deny = siteApi.normalizeSiteList(data.denyOrigins);
  const allow = siteApi.normalizeSiteList(data.allowOrigins);
  const current = which === "allow" ? allow : deny;
  const next = siteApi.pageListChange(current, ref.page, ref.entry, mode);
  const patch = which === "allow" ? { allowOrigins: next.list } : { denyOrigins: next.list };
  await storageSet(patch);
  const denyList = which === "deny" ? next.list : deny;
  const allowList = which === "allow" ? next.list : allow;
  const policy = siteApi.sitePolicy(denyList, allowList, ref.page);
  return {
    ok: true,
    entry: next.entry || ref.entry,
    which,
    mode,
    changed: next.changed,
    removed: next.removed,
    denied: policy.denied,
    onAllow: policy.onAllow,
  };
}

/**
 * @param {"deny" | "allow"} which
 */
async function applyPageList(which) {
  const tab = await activeTab();
  const ref = pageRefFromTab(tab);
  if (!ref || !tab?.id) {
    setHint("此页面无法加入站点名单");
    return;
  }
  const onList = which === "deny" ? pageDenied : pageOnAllow;
  const mode = onList ? "remove" : "add";
  /** @type {Record<string, unknown> | null} */
  let res = null;
  try {
    res = await send(tab.id, { type: "SET_PAGE_LIST", which, mode });
  } catch {
    res = null;
  }
  if (!res?.ok) {
    const written = await writePageList(which, mode, ref);
    setHint(`${describeListChange(written)} 若页面没有马上变化，刷新一次即可。`);
    return;
  }
  setHint(describeListChange(res));
}

async function refresh() {
  const tab = await activeTab();
  const stored = await storageGet({
    apiKey: "",
    provider: "openai",
    sourceLang: "auto",
    targetLang: "zh-CN",
    pageHotkey: "",
    denyOrigins: [],
    allowOrigins: [],
  });
  pageChord = String(stored.pageHotkey || "");
  paintEngine(stored);

  const ref = pageRefFromTab(tab);
  const denyList = siteApi ? siteApi.normalizeSiteList(stored.denyOrigins) : [];
  const allowList = siteApi ? siteApi.normalizeSiteList(stored.allowOrigins) : [];
  const storedDenied = Boolean(ref && siteApi.siteListMatches(denyList, ref.page));
  const storedAllow = Boolean(ref && siteApi.siteListMatches(allowList, ref.page));
  const listable = Boolean(ref);

  /** @type {{ ok?: boolean, active?: boolean, denied?: boolean, onAllow?: boolean } | null} */
  let state = null;
  if (listable && tab?.id) {
    try {
      state = await send(tab.id, { type: "GET_PAGE_STATE" });
    } catch {
      state = null;
    }
  }
  const live = Boolean(state?.ok);
  const denied = live ? Boolean(state.denied) : storedDenied;
  const onAllow = live && typeof state.onAllow === "boolean" ? state.onAllow : storedAllow;
  paint({
    supported: live,
    listable,
    denied,
    onAllow,
    active: live && Boolean(state.active) && !denied,
    entry: ref?.entry || "",
  });
}

/**
 * @param {() => Promise<void>} action
 */
async function run(action) {
  if (busy) return;
  busy = true;
  $("toggle").disabled = true;
  $("addPageDeny").disabled = true;
  $("addPageAllow").disabled = true;
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

$("addPageDeny").addEventListener("click", () => {
  run(() => applyPageList("deny"));
});

$("addPageAllow").addEventListener("click", () => {
  run(() => applyPageList("allow"));
});

$("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function bootPopup() {
  refresh().catch(() => {
    paint({ supported: false, listable: false, denied: false, onAllow: false, active: false, entry: "" });
  });
  const api = globalThis.ImmerHotkey;
  if (!api?.detectPlatform) return;
  api.detectPlatform().then(() => refresh()).catch(() => {});
}

bootPopup();

const $ = (id) => document.getElementById(id);

/** Defaults: DeepSeek OpenAI-compatible. Site lists start empty (every origin eligible). */
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

const hotkeyApi = globalThis.ImmerHotkey;
const siteApi = globalThis.ImmerSites;

/** @type {string[]} */
let denyOrigins = [];
/** @type {string[]} */
let allowOrigins = [];
let statusTimer = 0;

function canonicalHotkey(spec) {
  return hotkeyApi.normalizeHotkey(spec) || hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY;
}

/**
 * The field, reset button, and hints show the platform chord (⌥T / Alt+T).
 * Saving writes that same display string. Matching still uses the canonical
 * Alt/Ctrl/Meta form.
 * @param {string} spec
 */
function paintHotkeyField(spec) {
  const shown = hotkeyApi.formatHotkeyDisplay(canonicalHotkey(spec));
  $("paragraphHotkey").value = shown;
  $("resetHotkey").textContent = `恢复默认 ${hotkeyApi.formatHotkeyDisplay(hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY)}`;
  $("hotkeyHint").textContent =
    `默认 ${hotkeyApi.formatHotkeyDisplay(hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY)}。聚焦后按下新组合键（须含 ${hotkeyApi.modifierHint()}），再点保存。阅读页悬停主内容段落会标出当前段，按下该键只翻译这一段；译文节点样式与整页对照相同。已译过的段不会重复插入。`;
  $("hotkeyNotice").textContent = `段落快捷键存在本机设置里，默认 ${hotkeyApi.formatHotkeyDisplay(hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY)}。`;
}

function storedHotkey(spec) {
  return hotkeyApi.formatHotkeyDisplay(canonicalHotkey(spec));
}

function normalizeProvider(value) {
  return value === "anthropic" ? "anthropic" : "openai";
}

/**
 * @param {unknown} value
 * @returns {"sm" | "md" | "lg"}
 */
function normalizeFontSize(value) {
  return value === "sm" || value === "lg" ? value : "md";
}

/**
 * @param {unknown} value
 * @returns {"normal" | "high"}
 */
function normalizeContrast(value) {
  return value === "high" ? "high" : "normal";
}

/**
 * @param {unknown} value
 * @returns {"bilingual" | "translation-only"}
 */
function normalizeMode(value) {
  return value === "translation-only" ? "translation-only" : "bilingual";
}

/**
 * @param {string} text
 */
function setStatus(text) {
  $("status").textContent = text;
  clearTimeout(statusTimer);
  if (!text) return;
  statusTimer = setTimeout(() => {
    $("status").textContent = "";
  }, 1800);
}

function styleSnapshot() {
  return {
    translationFontSize: normalizeFontSize($("translationFontSize").value),
    translationContrast: normalizeContrast($("translationContrast").value),
    displayMode: normalizeMode($("displayMode").value),
  };
}

function listSnapshot() {
  return {
    denyOrigins: siteApi.normalizeSiteList(denyOrigins),
    allowOrigins: siteApi.normalizeSiteList(allowOrigins),
  };
}

function persistLists() {
  const lists = listSnapshot();
  denyOrigins = lists.denyOrigins;
  allowOrigins = lists.allowOrigins;
  chrome.storage.local.set(lists);
}

function persistStyles() {
  chrome.storage.local.set(styleSnapshot());
}

/**
 * @param {"deny" | "allow"} which
 * @param {string[]} items
 */
function renderOneList(ul, which, items) {
  ul.replaceChildren();
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "（空）";
    ul.appendChild(li);
    return;
  }
  const denied = new Set(denyOrigins);
  for (const item of items) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = item;
    if (which === "allow" && allowEntryCovered(item, denied)) {
      const note = document.createElement("span");
      note.className = "covered";
      note.textContent = "（已被永不翻译覆盖）";
      li.append(span, note);
    } else {
      li.append(span);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "移除";
    btn.addEventListener("click", () => {
      if (which === "deny") denyOrigins = denyOrigins.filter((entry) => entry !== item);
      else allowOrigins = allowOrigins.filter((entry) => entry !== item);
      renderLists();
      persistLists();
      setStatus(`已移除 ${item}`);
    });
    li.append(btn);
    ul.appendChild(li);
  }
}

/**
 * A bare denied host covers every origin on that host. An origin entry
 * covers only that same stored string.
 * @param {string} allowEntry
 * @param {Set<string>} denied
 */
function allowEntryCovered(allowEntry, denied) {
  if (denied.has(allowEntry)) return true;
  if (!allowEntry.includes("://")) return false;
  try {
    return denied.has(new URL(allowEntry).hostname);
  } catch {
    return false;
  }
}

function renderLists() {
  renderOneList($("denyList"), "deny", denyOrigins);
  renderOneList($("allowList"), "allow", allowOrigins);
}

/**
 * @param {chrome.tabs.Tab[]} tabs
 * @returns {chrome.tabs.Tab | null}
 */
function pickHttpTab(tabs) {
  const list = tabs || [];
  const pages = list.filter((tab) => /^https?:/i.test(tab.url || ""));
  if (!pages.length) return null;
  const activeHttp = pages.find((tab) => tab.active);
  if (activeHttp) return activeHttp;
  const stamped = pages.filter((tab) => (tab.lastAccessed || 0) > 0);
  if (stamped.length) {
    stamped.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    return stamped[0];
  }
  const active = list.find((tab) => tab.active);
  const anchor = typeof active?.index === "number" ? active.index : 0;
  const before = pages.filter((tab) => (tab.index || 0) < anchor);
  if (before.length) {
    before.sort((a, b) => (b.index || 0) - (a.index || 0));
    return before[0];
  }
  return [...pages].sort(
    (a, b) => Math.abs((a.index || 0) - anchor) - Math.abs((b.index || 0) - anchor)
  )[0];
}

function currentPageEntry() {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const inWindow = pickHttpTab(tabs || []);
      if (inWindow?.url) {
        resolve(siteApi.normalizeSiteEntry(inWindow.url));
        return;
      }
      chrome.tabs.query({}, (all) => {
        const anyTab = pickHttpTab(all || []);
        resolve(anyTab?.url ? siteApi.normalizeSiteEntry(anyTab.url) : "");
      });
    });
  });
}

/**
 * @param {"deny" | "allow"} which
 * @param {string} raw
 */
function addEntry(which, raw) {
  const normalized = siteApi.normalizeSiteEntry(raw);
  if (!normalized) {
    setStatus("无法识别该来源，请填域名或 http(s) 网址");
    return;
  }
  const target = which === "deny" ? denyOrigins : allowOrigins;
  if (target.includes(normalized)) {
    setStatus(`已在名单中：${normalized}`);
    return;
  }
  target.push(normalized);
  $("siteEntry").value = "";
  renderLists();
  persistLists();
  if (which === "deny") {
    const alsoAllowed = allowOrigins.includes(normalized);
    setStatus(
      alsoAllowed
        ? `已加入永不翻译：${normalized}（优先于始终翻译）`
        : `已加入永不翻译：${normalized}`
    );
    return;
  }
  setStatus(`已加入始终翻译：${normalized}`);
}

chrome.storage.local.get(DEFAULTS, (data) => {
  $("provider").value = normalizeProvider(data.provider);
  $("baseUrl").value = data.baseUrl || DEFAULTS.baseUrl;
  $("model").value = data.model || DEFAULTS.model;
  $("apiKey").value = data.apiKey || "";
  $("sourceLang").value = data.sourceLang || DEFAULTS.sourceLang;
  $("targetLang").value = data.targetLang || DEFAULTS.targetLang;
  paintHotkeyField(data.paragraphHotkey || DEFAULTS.paragraphHotkey);
  denyOrigins = siteApi.normalizeSiteList(data.denyOrigins);
  allowOrigins = siteApi.normalizeSiteList(data.allowOrigins);
  $("translationFontSize").value = normalizeFontSize(data.translationFontSize);
  $("translationContrast").value = normalizeContrast(data.translationContrast);
  $("displayMode").value = normalizeMode(data.displayMode);
  renderLists();
});

$("paragraphHotkey").addEventListener("keydown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const next = hotkeyApi.formatHotkeyEvent(event);
  if (!next) return;
  paintHotkeyField(next);
});

$("resetHotkey").addEventListener("click", () => {
  paintHotkeyField(hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY);
});

paintHotkeyField(DEFAULTS.paragraphHotkey);
hotkeyApi.detectPlatform().then(() => {
  paintHotkeyField($("paragraphHotkey").value || DEFAULTS.paragraphHotkey);
});

$("addDeny").addEventListener("click", () => {
  addEntry("deny", $("siteEntry").value);
});

$("addAllow").addEventListener("click", () => {
  addEntry("allow", $("siteEntry").value);
});

$("addCurrentDeny").addEventListener("click", () => {
  currentPageEntry().then((entry) => {
    if (!entry) {
      setStatus("没有可用来源的网页标签");
      return;
    }
    addEntry("deny", entry);
  });
});

$("addCurrentAllow").addEventListener("click", () => {
  currentPageEntry().then((entry) => {
    if (!entry) {
      setStatus("没有可用来源的网页标签");
      return;
    }
    addEntry("allow", entry);
  });
});

$("siteEntry").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addEntry("deny", $("siteEntry").value);
});

for (const id of ["translationFontSize", "translationContrast", "displayMode"]) {
  $(id).addEventListener("change", () => {
    persistStyles();
    setStatus("样式已保存");
  });
}

$("save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      provider: normalizeProvider($("provider").value),
      baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
      model: $("model").value.trim() || DEFAULTS.model,
      apiKey: $("apiKey").value.trim(),
      sourceLang: $("sourceLang").value,
      targetLang: $("targetLang").value,
      paragraphHotkey: storedHotkey($("paragraphHotkey").value),
      ...listSnapshot(),
      ...styleSnapshot(),
    },
    () => {
      renderLists();
      setStatus("已保存");
    }
  );
});

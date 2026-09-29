const $ = (id) => document.getElementById(id);

/** Defaults: DeepSeek OpenAI-compatible. Site lists start empty (every origin eligible). */
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

const NAV = ["basic", "hotkeys", "ball", "sites", "engine"];

const hotkeyApi = globalThis.ImmerHotkey;
const siteApi = globalThis.ImmerSites;

/** @type {string[]} */
let denyOrigins = [];
/** @type {string[]} */
let allowOrigins = [];
let statusTimer = 0;

/**
 * @param {string} spec
 * @param {string} fallback
 */
function canonicalHotkey(spec, fallback) {
  return hotkeyApi.normalizeHotkey(spec) || fallback;
}

/**
 * The field and reset button use formatHotkeyDisplay — the same function the
 * popup wraps as 「翻译 (⌥A / Alt+A)」. Saving writes that display string.
 * Matching still uses the canonical Alt/Ctrl/Meta form.
 * @param {string} inputId
 * @param {string} resetId
 * @param {string} spec
 * @param {string} fallback
 */
function paintChord(inputId, resetId, spec, fallback) {
  const shown = hotkeyApi.formatHotkeyDisplay(canonicalHotkey(spec, fallback));
  $(inputId).value = shown;
  $(resetId).textContent = `恢复默认 ${hotkeyApi.formatHotkeyDisplay(fallback)}`;
}

function paintHotkeyCopy() {
  const page = hotkeyApi.formatHotkeyDisplay(hotkeyApi.DEFAULT_PAGE_HOTKEY);
  const para = hotkeyApi.formatHotkeyDisplay(hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY);
  const mods = hotkeyApi.modifierHint();
  $("hotkeyIntro").textContent =
    `组合键按本机显示（${mods}）。聚焦输入框后按下含修饰键的新组合，再点保存才会在阅读页生效。`;
  $("pageHotkeyHint").textContent =
    `默认 ${page}。焦点不在输入框时，该组合在翻译和显示原文之间切换，并与弹窗、悬浮球同一状态。`;
  $("hotkeyHint").textContent =
    `默认 ${para}。阅读页悬停主内容段落会标出当前段，按下该键只翻译这一段；译文节点样式与整页对照相同。已译过的段不会重复插入。`;
  $("hotkeyNotice").textContent =
    `整页与段落快捷键都存在本机设置里。默认整页 ${page}，段落 ${para}。`;
}

function repaintChordsFromFields() {
  paintChord(
    "pageHotkey",
    "resetPageHotkey",
    $("pageHotkey").value || DEFAULTS.pageHotkey,
    hotkeyApi.DEFAULT_PAGE_HOTKEY
  );
  paintChord(
    "paragraphHotkey",
    "resetHotkey",
    $("paragraphHotkey").value || DEFAULTS.paragraphHotkey,
    hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY
  );
  paintHotkeyCopy();
}

/**
 * @param {string} spec
 * @param {string} fallback
 */
function storedHotkey(spec, fallback) {
  return hotkeyApi.formatHotkeyDisplay(canonicalHotkey(spec, fallback));
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

function paintKeyMode() {
  const key = $("apiKey").value.trim();
  $("keyMode").textContent = key
    ? "已填写 API Key。保存后走所选协议，消耗以你自备的提供商账单为准。本扩展不设日限墙。"
    : "未填写 API Key：使用 mock，译文为 ⟦原文⟧（⟦…⟧），无额度限制。";
}

/**
 * @param {string} name
 */
function showSection(name) {
  const id = NAV.includes(name) ? name : "basic";
  for (const key of NAV) {
    const panel = document.querySelector(`[data-panel="${key}"]`);
    const button = document.querySelector(`[data-nav="${key}"]`);
    const on = key === id;
    if (panel) panel.hidden = !on;
    if (!button) continue;
    button.classList.toggle("is-active", on);
    if (on) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}

document.querySelector(".nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  const id = button.getAttribute("data-nav") || "basic";
  showSection(id);
  history.replaceState(null, "", `#${id}`);
});

window.addEventListener("hashchange", () => {
  showSection(location.hash.replace(/^#/, ""));
});

showSection(location.hash.replace(/^#/, ""));

/**
 * @param {HTMLElement} ul
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
  $("pageHotkey").value = data.pageHotkey || DEFAULTS.pageHotkey;
  $("paragraphHotkey").value = data.paragraphHotkey || DEFAULTS.paragraphHotkey;
  repaintChordsFromFields();
  denyOrigins = siteApi.normalizeSiteList(data.denyOrigins);
  allowOrigins = siteApi.normalizeSiteList(data.allowOrigins);
  $("translationFontSize").value = normalizeFontSize(data.translationFontSize);
  $("translationContrast").value = normalizeContrast(data.translationContrast);
  $("displayMode").value = normalizeMode(data.displayMode);
  $("ballEnabled").checked = data.ballEnabled !== false;
  renderLists();
  paintKeyMode();
});

/**
 * @param {string} inputId
 * @param {string} resetId
 * @param {string} fallback
 */
function bindChordCapture(inputId, resetId, fallback) {
  $(inputId).addEventListener("keydown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = hotkeyApi.formatHotkeyEvent(event);
    if (!next) return;
    paintChord(inputId, resetId, next, fallback);
  });
}

bindChordCapture("pageHotkey", "resetPageHotkey", hotkeyApi.DEFAULT_PAGE_HOTKEY);
bindChordCapture("paragraphHotkey", "resetHotkey", hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY);

$("resetPageHotkey").addEventListener("click", () => {
  paintChord(
    "pageHotkey",
    "resetPageHotkey",
    hotkeyApi.DEFAULT_PAGE_HOTKEY,
    hotkeyApi.DEFAULT_PAGE_HOTKEY
  );
  paintHotkeyCopy();
  chrome.storage.local.set(
    { pageHotkey: storedHotkey($("pageHotkey").value, hotkeyApi.DEFAULT_PAGE_HOTKEY) },
    () => setStatus("已恢复默认整页快捷键")
  );
});

$("resetHotkey").addEventListener("click", () => {
  paintChord(
    "paragraphHotkey",
    "resetHotkey",
    hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY,
    hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY
  );
  paintHotkeyCopy();
  chrome.storage.local.set(
    { paragraphHotkey: storedHotkey($("paragraphHotkey").value, hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY) },
    () => setStatus("已恢复默认快捷键")
  );
});

repaintChordsFromFields();
hotkeyApi.detectPlatform().then(() => {
  repaintChordsFromFields();
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

$("ballEnabled").addEventListener("change", () => {
  const enabled = $("ballEnabled").checked;
  chrome.storage.local.set({ ballEnabled: enabled }, () => {
    setStatus(enabled ? "悬浮球已开启" : "悬浮球已关闭");
  });
});

$("apiKey").addEventListener("input", () => {
  paintKeyMode();
});

$("save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      provider: normalizeProvider($("provider").value),
      baseUrl: $("baseUrl").value.trim() || DEFAULTS.baseUrl,
      model: $("model").value.trim() || DEFAULTS.model,
      apiKey: $("apiKey").value.trim(),
      sourceLang: $("sourceLang").value,
      targetLang: $("targetLang").value,
      pageHotkey: storedHotkey($("pageHotkey").value, hotkeyApi.DEFAULT_PAGE_HOTKEY),
      paragraphHotkey: storedHotkey($("paragraphHotkey").value, hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY),
      ballEnabled: $("ballEnabled").checked,
      ...listSnapshot(),
      ...styleSnapshot(),
    },
    () => {
      renderLists();
      paintKeyMode();
      setStatus("已保存");
    }
  );
});

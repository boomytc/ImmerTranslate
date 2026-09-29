/**
 * Main-content paragraphs → bilingual nodes under originals.
 * Full page: action icon TOGGLE_TRANSLATE (0.1.x).
 * One segment: hover marks the paragraph; the options hotkey (default Alt+T)
 * sends TRANSLATE_BATCH with a single {id,text}. Cache/retry stays in
 * translate-core (TransPipe); this shell only renders the response.
 *
 * Site policy (chrome.storage.local): denyOrigins never inserts bilingual
 * nodes (icon toggle and hotkey). allowOrigins may auto-translate on load.
 * Empty deny list keeps every origin eligible. Deny wins over allow.
 * Style keys apply on this page through a storage listener, no reload.
 */

const ATTR_ID = "data-immer-id";
const ATTR_DONE = "data-immer-translated";
const ATTR_PENDING = "data-immer-pending";
const CLASS_WRAPPER = "immer-bilingual";
const CLASS_TRANS = "immer-translation";
const CLASS_HOVER = "immer-hover";
const PARAGRAPH_SELECTOR = "p, li, h1, h2, h3, h4, blockquote";
const DEFAULT_HOTKEY =
  globalThis.ImmerHotkey?.DEFAULT_PARAGRAPH_HOTKEY || "Alt+T";

const PAGE_DEFAULTS = {
  sourceLang: "auto",
  targetLang: "zh-CN",
  paragraphHotkey: DEFAULT_HOTKEY,
  denyOrigins: [],
  allowOrigins: [],
  translationFontSize: "md",
  translationContrast: "normal",
  displayMode: "bilingual",
};

/** @type {boolean} */
let active = false;
/** @type {HTMLElement | null} */
let hovered = null;
/** @type {string} */
let paragraphHotkey = DEFAULT_HOTKEY;
/** @type {string[]} */
let denyOrigins = [];
/** @type {string[]} */
let allowOrigins = [];
/** @type {{ translationFontSize: string, translationContrast: string, displayMode: string }} */
let pageStyle = {
  translationFontSize: "md",
  translationContrast: "normal",
  displayMode: "bilingual",
};
/** Bumped when nodes are cleared so an in-flight batch cannot insert afterwards. */
let runId = 0;
/** Bumped on each storage change so a stale boot read cannot overwrite it. */
let policyEpoch = 0;

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
 * @param {unknown} list
 * @returns {string[]}
 */
function normalizeStoredList(list) {
  return globalThis.ImmerSites?.normalizeSiteList(list) || [];
}

function pageRef() {
  return { origin: location.origin, hostname: location.hostname };
}

function originDenied() {
  const api = globalThis.ImmerSites;
  if (!api) return false;
  return api.siteListMatches(denyOrigins, pageRef());
}

function originAllowed() {
  const api = globalThis.ImmerSites;
  if (!api) return false;
  return api.siteListMatches(allowOrigins, pageRef());
}

function syncPolicyFlag() {
  const root = document.documentElement;
  if (originDenied()) root.setAttribute("data-immer-denied", "1");
  else root.removeAttribute("data-immer-denied");
}

function paintTranslations() {
  const size =
    pageStyle.translationFontSize === "sm"
      ? "0.8em"
      : pageStyle.translationFontSize === "lg"
        ? "1.35em"
        : "0.95em";
  const high = pageStyle.translationContrast === "high";
  document.querySelectorAll(`.${CLASS_TRANS}`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.fontSize = size;
    node.style.color = high ? "#0b1220" : "#334155";
    node.style.background = high ? "#dbe7ff" : "rgba(79, 140, 255, 0.06)";
    node.style.borderLeft = high ? "4px solid #1e3a8a" : "3px solid #4f8cff";
    node.style.fontWeight = high ? "600" : "";
  });
}

function applyPageStyle() {
  const root = document.documentElement;
  root.setAttribute("data-immer-font-size", pageStyle.translationFontSize);
  root.setAttribute("data-immer-contrast", pageStyle.translationContrast);
  root.setAttribute("data-immer-mode", pageStyle.displayMode);
  syncPolicyFlag();
  paintTranslations();
  if (pageStyle.displayMode === "translation-only") setHovered(null);
}

/**
 * @param {Partial<typeof PAGE_DEFAULTS>} settings
 */
function adoptSettings(settings) {
  rememberHotkey(settings?.paragraphHotkey);
  denyOrigins = normalizeStoredList(settings?.denyOrigins);
  allowOrigins = normalizeStoredList(settings?.allowOrigins);
  pageStyle = {
    translationFontSize: normalizeFontSize(settings?.translationFontSize),
    translationContrast: normalizeContrast(settings?.translationContrast),
    displayMode: normalizeMode(settings?.displayMode),
  };
  applyPageStyle();
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function mainRoot() {
  return (
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body
  );
}

/**
 * Same selection rules as the full-page picker.
 * @param {Element | null} el
 * @param {Element | null} [root]
 * @returns {el is HTMLElement}
 */
function isTranslatableParagraph(el, root) {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.matches(PARAGRAPH_SELECTOR)) return false;
  const scope = root || mainRoot();
  if (!scope || !scope.contains(el)) return false;
  if (el.closest(`.${CLASS_WRAPPER}, .${CLASS_TRANS}, script, style, noscript`))
    return false;
  const text = (el.innerText || "").trim();
  if (text.length < 8) return false;
  if (!isVisible(el)) return false;
  return true;
}

function pickParagraphs() {
  const root = mainRoot();
  if (!root) return [];
  const nodes = root.querySelectorAll(PARAGRAPH_SELECTOR);
  /** @type {HTMLElement[]} */
  const out = [];
  for (const el of nodes) {
    if (isTranslatableParagraph(el, root)) out.push(el);
  }
  return out;
}

/**
 * @param {{ sourceLang: string, targetLang: string, segments: {id:string,text:string}[] }} payload
 */
function translateBatch(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "TRANSLATE_BATCH", payload },
      (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!res?.ok) {
          reject(new Error(res?.error || "translate failed"));
          return;
        }
        resolve(res.data);
      }
    );
  });
}

function getPageSettings() {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve({ ...PAGE_DEFAULTS, denyOrigins: [], allowOrigins: [] });
      return;
    }
    chrome.storage.local.get(PAGE_DEFAULTS, (data) => {
      resolve({ ...PAGE_DEFAULTS, ...(data || {}) });
    });
  });
}

/**
 * @param {HTMLElement} el
 * @param {string} text
 * @param {string} targetLang
 */
function placeTranslation(el, text, targetLang) {
  if (originDenied()) return;
  if (!el.isConnected || el.getAttribute(ATTR_DONE) === "1") return;
  const next = el.nextElementSibling;
  if (next && next.classList.contains(CLASS_TRANS)) return;
  const node = document.createElement("div");
  node.className = CLASS_TRANS;
  node.setAttribute("lang", targetLang || "zh-CN");
  node.textContent = text;
  el.insertAdjacentElement("afterend", node);
  el.setAttribute(ATTR_DONE, "1");
  paintTranslations();
}

function clearTranslations() {
  runId += 1;
  document.querySelectorAll(`.${CLASS_TRANS}`).forEach((n) => n.remove());
  document
    .querySelectorAll(`[${ATTR_DONE}], [${ATTR_PENDING}]`)
    .forEach((el) => {
      el.removeAttribute(ATTR_DONE);
      el.removeAttribute(ATTR_ID);
      el.removeAttribute(ATTR_PENDING);
    });
}

/**
 * @param {string | undefined} value
 */
function rememberHotkey(value) {
  const normalized = globalThis.ImmerHotkey?.normalizeHotkey(value) || "";
  paragraphHotkey = normalized || DEFAULT_HOTKEY;
}

/**
 * @param {Partial<typeof PAGE_DEFAULTS>} [preset]
 */
async function applyTranslations(preset) {
  const run = runId;
  if (originDenied()) return;
  const settings = preset || (await getPageSettings());
  if (run !== runId) return;
  adoptSettings(settings);
  if (originDenied()) return;

  const paras = pickParagraphs();
  if (!paras.length) return;

  const segments = paras.map((el, i) => {
    const id = `p-${i}`;
    el.setAttribute(ATTR_ID, id);
    return { id, text: (el.innerText || "").trim() };
  });

  const response = await translateBatch({
    sourceLang: settings.sourceLang || "auto",
    targetLang: settings.targetLang || "zh-CN",
    segments,
  });

  if (run !== runId || originDenied()) return;
  const byId = new Map(response.segments.map((s) => [s.id, s]));
  for (const el of paras) {
    const id = el.getAttribute(ATTR_ID);
    if (!id || el.getAttribute(ATTR_DONE) === "1") continue;
    const hit = byId.get(id);
    if (!hit || hit.error) continue;
    placeTranslation(el, hit.text, settings.targetLang || "zh-CN");
  }
}

/**
 * @param {HTMLElement} el
 */
async function translateSegment(el) {
  if (!el.isConnected || !isTranslatableParagraph(el)) return;
  if (el.getAttribute(ATTR_DONE) === "1" || el.getAttribute(ATTR_PENDING) === "1")
    return;

  const run = runId;
  const settings = await getPageSettings();
  if (run !== runId) return;
  adoptSettings(settings);
  if (originDenied()) return;
  if (!el.isConnected || !isTranslatableParagraph(el)) return;
  if (el.getAttribute(ATTR_DONE) === "1" || el.getAttribute(ATTR_PENDING) === "1")
    return;

  const id =
    el.getAttribute(ATTR_ID) ||
    `seg-${Date.now().toString(36)}-${(el.innerText || "").length}`;
  el.setAttribute(ATTR_ID, id);
  el.setAttribute(ATTR_PENDING, "1");
  const text = (el.innerText || "").trim();

  try {
    const response = await translateBatch({
      sourceLang: settings.sourceLang || "auto",
      targetLang: settings.targetLang || "zh-CN",
      segments: [{ id, text }],
    });
    if (run !== runId || originDenied()) return;
    if (!el.isConnected || el.getAttribute(ATTR_PENDING) !== "1") return;
    if (el.getAttribute(ATTR_ID) !== id || el.getAttribute(ATTR_DONE) === "1") return;
    const hit = (response.segments || []).find((s) => s.id === id);
    if (!hit || hit.error) return;
    placeTranslation(el, hit.text, settings.targetLang || "zh-CN");
  } finally {
    el.removeAttribute(ATTR_PENDING);
  }
}

async function toggle() {
  const settings = await getPageSettings();
  adoptSettings(settings);
  if (originDenied()) {
    active = false;
    setHovered(null);
    clearTranslations();
    return;
  }
  active = !active;
  if (!active) {
    clearTranslations();
    return;
  }
  await applyTranslations(settings);
}

/**
 * @param {EventTarget | null} target
 * @returns {HTMLElement | null}
 */
function paragraphFromEventTarget(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest(`.${CLASS_TRANS}, .${CLASS_WRAPPER}`)) return null;
  const el = target.closest(PARAGRAPH_SELECTOR);
  if (!isTranslatableParagraph(el)) return null;
  return el;
}

/**
 * @param {HTMLElement | null} el
 */
function setHovered(el) {
  if (hovered === el) return;
  if (hovered) hovered.classList.remove(CLASS_HOVER);
  hovered = el;
  if (hovered) hovered.classList.add(CLASS_HOVER);
}

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * @param {Record<string, chrome.storage.StorageChange>} changes
 * @param {string} area
 */
function onStorageChanged(changes, area) {
  if (area !== "local" || !changes) return;
  policyEpoch += 1;
  if (Object.prototype.hasOwnProperty.call(changes, "paragraphHotkey")) {
    rememberHotkey(changes.paragraphHotkey.newValue);
  }
  let listsChanged = false;
  if (Object.prototype.hasOwnProperty.call(changes, "denyOrigins")) {
    denyOrigins = normalizeStoredList(changes.denyOrigins.newValue);
    listsChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "allowOrigins")) {
    allowOrigins = normalizeStoredList(changes.allowOrigins.newValue);
    listsChanged = true;
  }
  let styleChanged = false;
  if (Object.prototype.hasOwnProperty.call(changes, "translationFontSize")) {
    pageStyle.translationFontSize = normalizeFontSize(
      changes.translationFontSize.newValue
    );
    styleChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "translationContrast")) {
    pageStyle.translationContrast = normalizeContrast(
      changes.translationContrast.newValue
    );
    styleChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "displayMode")) {
    pageStyle.displayMode = normalizeMode(changes.displayMode.newValue);
    styleChanged = true;
  }
  if (styleChanged) applyPageStyle();
  if (!listsChanged) return;
  syncPolicyFlag();
  if (originDenied()) {
    active = false;
    setHovered(null);
    clearTranslations();
    return;
  }
  if (originAllowed() && !active) {
    active = true;
    applyTranslations().catch(() => {});
  }
}

document.addEventListener("mouseover", (event) => {
  setHovered(paragraphFromEventTarget(event.target));
});

document.addEventListener("mouseout", (event) => {
  if (!hovered) return;
  const related = event.relatedTarget;
  if (related instanceof Node && hovered.contains(related)) return;
  const next =
    related instanceof Element ? paragraphFromEventTarget(related) : null;
  if (next) {
    setHovered(next);
    return;
  }
  const leaving =
    event.target instanceof Node &&
    (event.target === hovered || hovered.contains(event.target));
  if (leaving) setHovered(null);
});

document.addEventListener(
  "keydown",
  (event) => {
    if (event.repeat || event.isComposing) return;
    if (isTypingTarget(event.target)) return;
    const matches = globalThis.ImmerHotkey?.eventMatchesHotkey(
      event,
      paragraphHotkey
    );
    if (!matches || !hovered) return;
    event.preventDefault();
    event.stopPropagation();
    translateSegment(hovered).catch(() => {});
  },
  true
);

applyPageStyle();

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener(onStorageChanged);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TOGGLE_TRANSLATE") {
    toggle()
      .then(() => sendResponse({ ok: true, active, denied: originDenied() }))
      .catch((err) =>
        sendResponse({ ok: false, error: String(err?.message || err) })
      );
    return true;
  }
  return false;
});

const seenAtBoot = policyEpoch;
getPageSettings()
  .then((first) => (policyEpoch === seenAtBoot ? first : getPageSettings()))
  .then((settings) => {
    adoptSettings(settings);
    if (originDenied()) {
      active = false;
      setHovered(null);
      clearTranslations();
      return;
    }
    if (!originAllowed()) return;
    active = true;
    return applyTranslations(settings);
  })
  .catch(() => {});

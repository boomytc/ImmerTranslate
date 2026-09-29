/**
 * Main-content paragraphs → bilingual nodes under originals.
 * Full page: action icon TOGGLE_TRANSLATE (0.1.x).
 * One segment: hover marks the paragraph; the options hotkey (default Alt+T)
 * sends TRANSLATE_BATCH with a single {id,text}. Cache/retry stays in
 * translate-core (TransPipe); this shell only renders the response.
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

/** @type {boolean} */
let active = false;
/** @type {HTMLElement | null} */
let hovered = null;
/** @type {string} */
let paragraphHotkey = DEFAULT_HOTKEY;

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
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      resolve(
        res?.data || {
          sourceLang: "auto",
          targetLang: "zh-CN",
          paragraphHotkey: DEFAULT_HOTKEY,
        }
      );
    });
  });
}

/**
 * @param {HTMLElement} el
 * @param {string} text
 * @param {string} targetLang
 */
function placeTranslation(el, text, targetLang) {
  const node = document.createElement("div");
  node.className = CLASS_TRANS;
  node.setAttribute("lang", targetLang || "zh-CN");
  node.textContent = text;
  el.insertAdjacentElement("afterend", node);
  el.setAttribute(ATTR_DONE, "1");
}

function clearTranslations() {
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

function loadHotkey() {
  if (!chrome?.storage?.local) return;
  chrome.storage.local.get({ paragraphHotkey: DEFAULT_HOTKEY }, (data) => {
    rememberHotkey(data?.paragraphHotkey);
  });
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local" || !changes.paragraphHotkey) return;
    rememberHotkey(changes.paragraphHotkey.newValue);
  });
}

async function applyTranslations() {
  const paras = pickParagraphs();
  if (!paras.length) return;

  const segments = paras.map((el, i) => {
    const id = `p-${i}`;
    el.setAttribute(ATTR_ID, id);
    return { id, text: (el.innerText || "").trim() };
  });

  const settings = await getPageSettings();
  rememberHotkey(settings.paragraphHotkey);

  const response = await translateBatch({
    sourceLang: settings.sourceLang || "auto",
    targetLang: settings.targetLang || "zh-CN",
    segments,
  });

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

  const id =
    el.getAttribute(ATTR_ID) ||
    `seg-${Date.now().toString(36)}-${(el.innerText || "").length}`;
  el.setAttribute(ATTR_ID, id);
  el.setAttribute(ATTR_PENDING, "1");
  const text = (el.innerText || "").trim();

  try {
    const settings = await getPageSettings();
    rememberHotkey(settings.paragraphHotkey);
    const response = await translateBatch({
      sourceLang: settings.sourceLang || "auto",
      targetLang: settings.targetLang || "zh-CN",
      segments: [{ id, text }],
    });
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
  active = !active;
  if (!active) {
    clearTranslations();
    return;
  }
  await applyTranslations();
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

loadHotkey();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TOGGLE_TRANSLATE") {
    toggle()
      .then(() => sendResponse({ ok: true, active }))
      .catch((err) =>
        sendResponse({ ok: false, error: String(err?.message || err) })
      );
    return true;
  }
  return false;
});

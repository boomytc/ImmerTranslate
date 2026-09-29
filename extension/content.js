/**
 * Main-content paragraphs → bilingual nodes under originals.
 * Full page: popup TRANSLATE_PAGE / RESTORE_PAGE, or the floating ball,
 * both through the same setTranslated() state. TOGGLE_TRANSLATE remains.
 * One segment: hover marks the paragraph; the options hotkey (canonical
 * Alt+T, shown as ⌥T on macOS) sends TRANSLATE_BATCH with a single {id,text}.
 * Whole-page Option/Alt+A toggles the same state as the popup and the ball.
 * The chord is handled on window and document keydown in the capture phase
 * (preventDefault + stopPropagation) when focus is outside editable fields.
 * If the browser eats that keydown, the matching keyup or the extension
 * command still calls the same toggle. Cache/retry stays in
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
const PAGE_HOTKEY = globalThis.ImmerHotkey?.DEFAULT_PAGE_HOTKEY || "Alt+A";

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
/** Stops a second translate/restore from flipping `active` mid-flight. */
let translateLock = false;
/** @type {HTMLElement | null} */
let ballHost = null;
/** @type {HTMLButtonElement | null} */
let ballButton = null;
/** @type {HTMLElement | null} */
let ballHint = null;
/** @type {HTMLElement | null} */
let ballTip = null;
let ballLeft = 0;
let ballTop = 0;
/** @type {"left" | "right"} */
let ballSide = "right";
/** @type {{ side: "left" | "right", top: number } | null} */
let ballAnchor = null;
let ballDragging = false;
/** True after a drag-save or a stored position, so resize keeps that side and height. */
let ballPinned = false;
let ballHintTimer = 0;
/** Settings have been read, so a deny-list page does not flash the first-use tip. */
let pageReady = false;
let ballTipChecked = false;
const BALL_TIP_TEXT = "点此可翻译或显示原文。拖到左右边缘后会贴边，并记住上下位置。";
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
  if (el.closest(`.${CLASS_WRAPPER}, .${CLASS_TRANS}, #immer-ball-host, script, style, noscript`))
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

function currentViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function syncBall() {
  if (!ballHost || !ballButton) return;
  const denied = originDenied();
  ballHost.style.setProperty("display", denied ? "none" : "block", "important");
  if (denied) {
    if (ballTip) ballTip.hidden = true;
    return;
  }
  ballButton.classList.toggle("is-on", active);
  const mark = ballButton.querySelector(".mark");
  if (mark) mark.textContent = active ? "原" : "译";
  const badge = ballButton.querySelector(".badge");
  if (badge) badge.hidden = !active;
  ballButton.setAttribute("aria-label", active ? "显示原文" : "翻译");
  ballButton.setAttribute("aria-pressed", active ? "true" : "false");
  maybeShowBallTip();
}

function positionBallTip() {
  if (!ballTip) return;
  const onRight = ballSide !== "left";
  ballTip.classList.toggle("on-right", onRight);
  ballTip.classList.toggle("on-left", !onRight);
  ballTip.classList.toggle("flip-up", ballTop > window.innerHeight - 120);
}

function maybeShowBallTip() {
  if (!pageReady || ballTipChecked || !ballTip || originDenied()) return;
  if (!chrome?.storage?.local) return;
  ballTipChecked = true;
  chrome.storage.local.get({ ballTipSeen: false }, (data) => {
    if (data?.ballTipSeen || originDenied() || !ballTip) return;
    positionBallTip();
    ballTip.hidden = false;
    chrome.storage.local.set({ ballTipSeen: true });
  });
}

/**
 * @param {string} text
 */
function showBallHint(text) {
  if (!ballHint) return;
  ballHint.textContent = text;
  ballHint.hidden = false;
  ballHint.classList.toggle("below", ballTop < 72);
  clearTimeout(ballHintTimer);
  ballHintTimer = setTimeout(() => {
    ballHint.hidden = true;
  }, 2200);
}

/**
 * @param {{ left: number, top: number }} pos
 */
/**
 * @param {{ left: number, top: number, side?: "left" | "right" }} pos
 */
function placeBall(pos) {
  ballLeft = pos.left;
  ballTop = pos.top;
  if (pos.side === "left" || pos.side === "right") ballSide = pos.side;
  if (!ballHost) return;
  ballHost.style.setProperty("left", `${pos.left}px`, "important");
  ballHost.style.setProperty("top", `${pos.top}px`, "important");
  positionBallTip();
}

function restoreBallPosition() {
  if (!chrome?.storage?.local || !globalThis.ImmerBall) return;
  chrome.storage.local.get({ ballPosition: null }, (data) => {
    if (ballDragging) return;
    const pos = globalThis.ImmerBall.normalizeStoredBallPosition(
      data?.ballPosition,
      currentViewport()
    );
    if (!pos) return;
    ballPinned = true;
    ballAnchor = { side: pos.side, top: pos.top };
    placeBall(pos);
  });
}

/**
 * @param {unknown} value
 */
function adoptBallPosition(value) {
  if (ballDragging || !globalThis.ImmerBall) return;
  const pos = globalThis.ImmerBall.normalizeStoredBallPosition(value, currentViewport());
  if (!pos) return;
  ballPinned = true;
  ballAnchor = { side: pos.side, top: pos.top };
  placeBall(pos);
}

function mountBall() {
  if (!document.documentElement || document.getElementById("immer-ball-host")) return;
  const api = globalThis.ImmerBall;
  const initial = api
    ? api.defaultBallPosition(currentViewport())
    : { left: 16, top: 16 };
  const host = document.createElement("div");
  host.id = "immer-ball-host";
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("z-index", "2147483646", "important");
  host.style.setProperty("width", "48px", "important");
  host.style.setProperty("height", "48px", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("overflow", "visible", "important");
  const shadow = host.attachShadow({ mode: "open" });
  const glassUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL("glass.css") : "glass.css";
  shadow.innerHTML = `
    <link rel="stylesheet" href="${glassUrl}" />
    <style>
      #immer-ball {
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        position: relative;
        width: 48px;
        height: 48px;
        margin: 0;
        padding: 0;
        color: var(--immer-glass-text, #1c2430);
        font: 600 15px/1 system-ui, sans-serif;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      #immer-ball.is-on {
        background: var(--immer-glass-fill-strong, rgba(255, 255, 255, 0.8));
      }
      #immer-ball.is-dragging { cursor: grabbing; }
      .mark { pointer-events: none; }
      .badge {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--immer-badge, #1f4e9a);
        box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
        pointer-events: none;
      }
      .hint {
        position: absolute;
        left: 50%;
        bottom: 56px;
        transform: translateX(-50%);
        width: max-content;
        max-width: 196px;
        padding: var(--immer-glass-space, 8px);
        font: 12px/1.4 system-ui, sans-serif;
        text-align: center;
        pointer-events: none;
      }
      .hint.below { bottom: auto; top: 56px; }
      .tip {
        position: absolute;
        top: 0;
        box-sizing: border-box;
        width: 200px;
        padding: var(--immer-glass-gap, 12px);
        font: 12px/1.45 system-ui, sans-serif;
      }
      .tip.on-right { right: 56px; }
      .tip.on-left { left: 56px; }
      .tip.flip-up { top: auto; bottom: 0; }
      .tip p { margin: 0; }
      .tip button {
        all: unset;
        display: inline-block;
        margin-top: var(--immer-glass-space, 8px);
        color: var(--immer-cta-bg, #1f4e9a);
        font: 600 12px/1 system-ui, sans-serif;
        cursor: pointer;
      }
    </style>
    <button id="immer-ball" class="immer-glass" type="button" aria-pressed="false">
      <span class="mark">译</span>
      <span class="badge" hidden></span>
    </button>
    <div class="hint immer-glass" hidden></div>
    <div class="tip immer-glass" hidden>
      <p></p>
      <button type="button">知道了</button>
    </div>
  `;
  ballHost = host;
  ballButton = shadow.querySelector("#immer-ball");
  ballHint = shadow.querySelector(".hint");
  ballTip = shadow.querySelector(".tip");
  const tipText = ballTip?.querySelector("p");
  if (tipText) tipText.textContent = BALL_TIP_TEXT;
  const dismissTip = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (ballTip) ballTip.hidden = true;
  };
  ballTip?.addEventListener("click", dismissTip);
  ballTip?.querySelector("button")?.addEventListener("click", dismissTip);
  const glassLink = shadow.querySelector('link[rel="stylesheet"]');
  if (glassLink && !glassLink.sheet) {
    host.style.setProperty("visibility", "hidden", "important");
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      host.style.removeProperty("visibility");
    };
    glassLink.addEventListener("load", reveal);
    glassLink.addEventListener("error", reveal);
    setTimeout(reveal, 600);
  }
  placeBall(initial);
  document.documentElement.appendChild(host);
  bindBallDrag();
  syncBall();
  restoreBallPosition();
}

function bindBallDrag() {
  const button = ballButton;
  const api = globalThis.ImmerBall;
  if (!button || !api) return;
  /** @type {{ id: number, x: number, y: number, left: number, top: number, moved: boolean } | null} */
  let drag = null;
  let suppressClick = false;

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: ballLeft,
      top: ballTop,
      moved: false,
    };
    ballDragging = true;
    button.classList.add("is-dragging");
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured.
    }
  });

  button.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    placeBall(
      api.clampBallPosition(
        { left: drag.left + dx, top: drag.top + dy },
        currentViewport()
      )
    );
  });

  /**
   * @param {PointerEvent} event
   * @param {boolean} fromUp
   */
  const finish = (event, fromUp) => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    ballDragging = false;
    button.classList.remove("is-dragging");
    if (!moved) return;
    if (fromUp) suppressClick = true;
    ballPinned = true;
    const snapped = api.snapBallPosition(
      { left: ballLeft, top: ballTop },
      currentViewport()
    );
    ballAnchor = { side: snapped.side, top: snapped.top };
    placeBall(snapped);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({
        ballPosition: { side: snapped.side, top: snapped.top },
      });
    }
  };

  button.addEventListener("pointerup", (event) => finish(event, true));
  button.addEventListener("pointercancel", (event) => finish(event, false));
  button.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (originDenied()) return;
    if (ballTip) ballTip.hidden = true;
    toggle().catch(() => {
      showBallHint("翻译失败");
    });
  });

  window.addEventListener("resize", () => {
    if (ballDragging) return;
    const viewport = currentViewport();
    if (!ballPinned || !ballAnchor) {
      placeBall(api.defaultBallPosition(viewport));
      return;
    }
    placeBall(api.normalizeStoredBallPosition(ballAnchor, viewport) || api.defaultBallPosition(viewport));
  });
}

/**
 * @param {boolean} next
 */
async function setTranslated(next) {
  if (translateLock) return;
  translateLock = true;
  const want = Boolean(next);
  try {
    const settings = await getPageSettings();
    adoptSettings(settings);
    if (originDenied()) {
      active = false;
      setHovered(null);
      clearTranslations();
      return;
    }
    if (want === active) {
      if (!want) clearTranslations();
      return;
    }
    active = want;
    if (!active) {
      clearTranslations();
      return;
    }
    await applyTranslations(settings);
  } finally {
    translateLock = false;
    syncBall();
  }
}

async function toggle() {
  await setTranslated(!active);
}

/**
 * @returns {Promise<{ ok: boolean, entry?: string, error?: string }>}
 */
async function denyThisOrigin() {
  const api = globalThis.ImmerSites;
  const entry = api?.normalizeSiteEntry(location.href) || "";
  if (!entry) return { ok: false, error: "无法识别来源" };
  const settings = await getPageSettings();
  const list = normalizeStoredList(settings.denyOrigins);
  if (!list.includes(entry)) list.push(entry);
  denyOrigins = list;
  await new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ denyOrigins: list }, () => resolve());
  });
  active = false;
  setHovered(null);
  clearTranslations();
  syncPolicyFlag();
  syncBall();
  return { ok: true, entry };
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
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const role = target.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

/**
 * event.target plus document.activeElement, including an open shadow root.
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function focusIsTyping(target) {
  if (isTypingTarget(target)) return true;
  let el = document.activeElement;
  const seen = new Set();
  while (el instanceof HTMLElement && !seen.has(el)) {
    seen.add(el);
    if (isTypingTarget(el)) return true;
    const next = el.shadowRoot && el.shadowRoot.activeElement;
    if (!(next instanceof HTMLElement)) break;
    el = next;
  }
  return false;
}

/** @type {{ type: string, code: string, stamp: number } | null} */
let chordSlot = null;
/** Code of a keydown this page already handled, so its keyup does not flip again. */
let keydownCode = "";
/** Last whole-page toggle from the chord or the extension command. */
let chordToggleAt = 0;
/** @type {"page" | "command" | ""} */
let chordSource = "";

/**
 * One physical Alt+A / ⌥A must toggle once. The page listener and
 * chrome.commands can both observe that press; a cold service worker may
 * deliver the command after the page already handled the keydown.
 * A later keydown still toggles. Popup and the ball call setTranslated / toggle
 * directly and are not gated here.
 * @param {"page" | "command"} source
 * @returns {Promise<void>}
 */
function toggleFromChord(source) {
  const now = Date.now();
  if (source === "command" && chordSource === "page" && now - chordToggleAt < 1200) {
    return Promise.resolve();
  }
  if (now - chordToggleAt < 100) return Promise.resolve();
  chordToggleAt = now;
  chordSource = source === "command" ? "command" : "page";
  return toggle();
}

/**
 * Capture-phase listener. preventDefault runs only after the chord matches
 * and focus is outside an editable field, so browser menu/accelerator
 * defaults for Alt+A / ⌥A are cancelled when the event still reaches the page.
 * @param {KeyboardEvent} event
 */
function onChordKey(event) {
  const api = globalThis.ImmerHotkey;
  if (!api?.resolveChord || !api?.markChordEvent) return;
  const marked = api.markChordEvent(chordSlot, event);
  chordSlot = marked.slot;
  if (marked.duplicate) return;
  const decision = api.resolveChord(event, {
    paragraphSpec: paragraphHotkey,
    pageSpec: PAGE_HOTKEY,
    typing: focusIsTyping(event.target),
    hovered: Boolean(hovered),
    keydownCode,
    lastToggleAt: chordToggleAt,
    now: Date.now(),
  });
  keydownCode = decision.keydownCode;
  if (!decision.prevent || !decision.action) return;
  event.preventDefault();
  event.stopPropagation();
  if (decision.action === "paragraph") {
    if (hovered) translateSegment(hovered).catch(() => {});
    return;
  }
  toggleFromChord("page").catch(() => {});
}

/**
 * @param {Record<string, chrome.storage.StorageChange>} changes
 * @param {string} area
 */
function onStorageChanged(changes, area) {
  if (area !== "local" || !changes) return;
  policyEpoch += 1;
  if (Object.prototype.hasOwnProperty.call(changes, "ballPosition")) {
    adoptBallPosition(changes.ballPosition.newValue);
  }
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
    syncBall();
    return;
  }
  syncBall();
  if (originAllowed() && !active) {
    active = true;
    syncBall();
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

window.addEventListener("keydown", onChordKey, { capture: true });
window.addEventListener("keyup", onChordKey, { capture: true });
document.addEventListener("keydown", onChordKey, { capture: true });
document.addEventListener("keyup", onChordKey, { capture: true });

applyPageStyle();

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener(onStorageChanged);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_PAGE_STATE") {
    sendResponse({
      ok: true,
      active: Boolean(active) && !originDenied(),
      denied: originDenied(),
    });
    return false;
  }
  if (message?.type === "DENY_THIS_ORIGIN") {
    denyThisOrigin()
      .then((result) =>
        sendResponse({
          ...result,
          active: false,
          denied: originDenied(),
        })
      )
      .catch((err) =>
        sendResponse({ ok: false, error: String(err?.message || err), active, denied: originDenied() })
      );
    return true;
  }
  if (
    message?.type === "TOGGLE_TRANSLATE" ||
    message?.type === "TRANSLATE_PAGE" ||
    message?.type === "RESTORE_PAGE"
  ) {
    const job =
      message.type === "TRANSLATE_PAGE"
        ? setTranslated(true)
        : message.type === "RESTORE_PAGE"
          ? setTranslated(false)
          : toggleFromChord("command");
    job
      .then(() => sendResponse({ ok: true, active, denied: originDenied() }))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: String(err?.message || err),
          active,
          denied: originDenied(),
        })
      );
    return true;
  }
  return false;
});

mountBall();

const seenAtBoot = policyEpoch;
getPageSettings()
  .then((first) => (policyEpoch === seenAtBoot ? first : getPageSettings()))
  .then((settings) => {
    adoptSettings(settings);
    pageReady = true;
    if (originDenied()) {
      active = false;
      setHovered(null);
      clearTranslations();
      syncBall();
      return;
    }
    syncBall();
    if (!originAllowed()) return;
    active = true;
    syncBall();
    return applyTranslations(settings);
  })
  .catch(() => {});

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
 * command still calls the same toggle. Paragraph Alt+T uses the same capture
 * path, plus TRANSLATE_HOVERED_PARAGRAPH when the paragraph command shortcut
 * still matches the saved chord. A deny-listed origin skips the paragraph
 * chord before preventDefault. Cache/retry stays in
 * translate-core (TransPipe); this shell only renders the response.
 * A rejected batch is not swallowed: kind / code / status / message come back
 * from the service worker and show as a non-blocking glass toast, a ball
 * hint, and the same sentence on the popup. Empty API key stays on mock.
 *
 * Site policy (chrome.storage.local): denyOrigins never inserts bilingual
 * nodes (icon toggle and hotkey). allowOrigins may auto-translate on load.
 * Empty deny list keeps every origin eligible. Deny wins over allow
 * (ImmerSites.sitePolicy: blocked when denied, auto only when allowed
 * and not denied). SET_PAGE_LIST adds or removes this page's origin.
 * Style keys apply on this page through a storage listener, no reload.
 *
 * First run: a three-step card (ImmerOnboarding) sits at the top left until
 * `onboardingDone` is set. It does not cover the page. The one-time ball tip
 * stays down while that card is pending, visible, or was just dismissed here.
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
  pageHotkey: PAGE_HOTKEY,
  paragraphHotkey: DEFAULT_HOTKEY,
  denyOrigins: [],
  allowOrigins: [],
  translationFontSize: "md",
  translationContrast: "normal",
  displayMode: "bilingual",
  ballEnabled: true,
};

/** @type {boolean} */
let active = false;
/** @type {HTMLElement | null} */
let hovered = null;
/**
 * Last paragraph the pointer actually entered. The paragraph command uses it
 * when a browser menu clears `hovered` before the command message arrives.
 * @type {HTMLElement | null}
 */
let hoverMemory = null;
let hoverMemoryAt = 0;
/** @type {string} */
let paragraphHotkey = DEFAULT_HOTKEY;
/** @type {string} */
let pageHotkey = PAGE_HOTKEY;
/** Options can hide the ball without clearing ballPosition. Default on. */
let ballEnabled = true;
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
/** @type {HTMLButtonElement | null} */
let ballSites = null;
/** @type {HTMLElement | null} */
let ballMenu = null;
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
/** @type {HTMLElement | null} */
let failHost = null;
/** @type {HTMLElement | null} */
let failKicker = null;
/** @type {HTMLElement | null} */
let failBody = null;
let failTimer = 0;
/** Ball hint is showing a translate failure, so a later success may clear it. */
let ballHintIsFailure = false;
/** @type {HTMLElement | null} */
let onboardingHost = null;
/** @type {{ index: number, done: boolean, ballIntroduced: boolean } | null} */
let onboardingState = null;
/** Storage has been read. Until then the ball tip stays down. */
let onboardingKnown = false;
/** Permanent flag `onboardingDone`. */
let onboardingDone = false;
/** This document already closed the guide, so the ball tip does not chain. */
let onboardingDismissedHere = false;
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

/**
 * Deny wins: `blocked` when the page matches denyOrigins, `auto` only when
 * it matches allowOrigins and does not match deny.
 * @returns {{ denied: boolean, onAllow: boolean, blocked: boolean, auto: boolean }}
 */
function pagePolicy() {
  const api = globalThis.ImmerSites;
  const page = pageRef();
  if (api?.sitePolicy) return api.sitePolicy(denyOrigins, allowOrigins, page);
  const denied = Boolean(api && api.siteListMatches(denyOrigins, page));
  const onAllow = Boolean(api && api.siteListMatches(allowOrigins, page));
  return { denied, onAllow, blocked: denied, auto: !denied && onAllow };
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
  rememberPageHotkey(settings?.pageHotkey);
  rememberBallEnabled(settings?.ballEnabled);
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
  if (
    el.closest(
      `.${CLASS_WRAPPER}, .${CLASS_TRANS}, #immer-ball-host, #immer-onboarding-host, script, style, noscript`
    )
  )
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
 * @param {unknown} source
 * @param {string} [fallback]
 * @returns {Error & { kind?: string, code?: string, status?: number }}
 */
function asFailure(source, fallback) {
  const api = globalThis.ImmerFail;
  if (api?.failureError) return api.failureError(source, fallback);
  const rec = source && typeof source === "object" ? source : {};
  const err = /** @type {Error & { kind?: string, code?: string, status?: number }} */ (
    new Error(String(rec.error || rec.message || source || fallback || "translate failed"))
  );
  if (typeof rec.kind === "string") err.kind = rec.kind;
  if (typeof rec.code === "string") err.code = rec.code;
  if (typeof rec.status === "number") err.status = rec.status;
  return err;
}

/**
 * Page toast plus the ball hint. Pointer events stay off the toast.
 * @param {unknown} err
 */
function showTranslateFailure(err) {
  const api = globalThis.ImmerFail;
  const tip = api?.formatFailureTip
    ? api.formatFailureTip(err)
    : {
        kicker: "翻译失败",
        body: String(err?.message || err || "翻译失败"),
        text: String(err?.message || err || "翻译失败"),
      };
  showPageToast(tip.kicker, tip.body);
  if (ballHint && ballEnabled && !originDenied()) {
    if (ballTip) ballTip.hidden = true;
    showBallHint(tip.text, 5200);
    ballHintIsFailure = true;
  }
}

function hideTranslateFailure() {
  if (failHost) failHost.hidden = true;
  clearTimeout(failTimer);
  if (!ballHintIsFailure || !ballHint) return;
  ballHint.hidden = true;
  clearTimeout(ballHintTimer);
  ballHintIsFailure = false;
}

function ensureFailToast() {
  if (failHost && failKicker && failBody) return;
  if (!document.documentElement) return;
  const existing = document.getElementById("immer-fail-host");
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id = "immer-fail-host";
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "open" });
  const glassUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL("glass.css") : "glass.css";
  shadow.innerHTML = `
    <link rel="stylesheet" href="${glassUrl}" />
    <style>
      .toast {
        box-sizing: border-box;
        width: 100%;
        padding: 12px 14px;
        font: 13px/1.45 system-ui, sans-serif;
        color: #1c2430;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.72);
        border-radius: 14px;
        box-shadow:
          0 10px 28px rgba(28, 36, 48, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.65),
          inset 0 0 0 1px rgba(28, 36, 48, 0.12);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        pointer-events: none;
      }
      .kicker {
        margin: 0;
        font-weight: 650;
        font-size: 12px;
        letter-spacing: 0.01em;
      }
      .body {
        margin: 4px 0 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
    <div class="toast immer-glass" role="status" aria-live="polite">
      <p class="kicker"></p>
      <p class="body"></p>
    </div>
  `;
  failHost = host;
  failKicker = shadow.querySelector(".kicker");
  failBody = shadow.querySelector(".body");
  document.documentElement.appendChild(host);
}

/**
 * @param {string} kicker
 * @param {string} body
 */
function showPageToast(kicker, body) {
  ensureFailToast();
  if (!failHost || !failKicker || !failBody) return;
  failKicker.textContent = kicker;
  failBody.textContent = body;
  failHost.hidden = false;
  clearTimeout(failTimer);
  failTimer = setTimeout(() => {
    if (failHost) failHost.hidden = true;
  }, 5200);
}

/**
 * Reply shape for the popup. kind / code / status pass through when present.
 * @param {any} err
 * @param {Record<string, unknown>} [extra]
 */
function translateFailureReply(err, extra) {
  return {
    ok: false,
    error: String(err?.message || err),
    kind: err?.kind,
    code: err?.code,
    status: err?.status,
    ...(extra || {}),
  };
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
          reject(asFailure({ error: chrome.runtime.lastError.message }));
          return;
        }
        if (!res?.ok) {
          reject(asFailure(res, "translate failed"));
          return;
        }
        resolve(res.data);
      }
    );
  }).then(
    (data) => {
      hideTranslateFailure();
      return data;
    },
    (err) => {
      showTranslateFailure(err);
      throw err;
    }
  );
}

function getPageSettings() {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve({ ...PAGE_DEFAULTS, onboardingDone: true, denyOrigins: [], allowOrigins: [] });
      return;
    }
    chrome.storage.local.get({ ...PAGE_DEFAULTS, onboardingDone: false }, (data) => {
      resolve({ ...PAGE_DEFAULTS, onboardingDone: false, ...(data || {}) });
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
 * @param {string | undefined} value
 */
function rememberPageHotkey(value) {
  const normalized = globalThis.ImmerHotkey?.normalizeHotkey(value) || "";
  pageHotkey = normalized || PAGE_HOTKEY;
}

/**
 * Missing or any value other than false keeps the ball. Only an explicit
 * false from the options page hides it.
 * @param {unknown} value
 */
function rememberBallEnabled(value) {
  ballEnabled = value !== false;
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
  el.setAttribute(ATTR_PENDING, "1");

  const run = runId;
  try {
    const settings = await getPageSettings();
    if (run !== runId) return;
    adoptSettings(settings);
    if (originDenied()) return;
    if (!el.isConnected || !isTranslatableParagraph(el)) return;
    if (el.getAttribute(ATTR_DONE) === "1") return;

    const id =
      el.getAttribute(ATTR_ID) ||
      `seg-${Date.now().toString(36)}-${(el.innerText || "").length}`;
    el.setAttribute(ATTR_ID, id);
    const text = (el.innerText || "").trim();
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
    if (el.isConnected) el.removeAttribute(ATTR_PENDING);
  }
}

function currentViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Apply the current lists to this document. Deny clears any translation.
 * Allow auto-starts only when the page is not denied.
 * @param {Partial<typeof PAGE_DEFAULTS>} [preset]
 */
function applyListPolicy(preset) {
  syncPolicyFlag();
  const policy = pagePolicy();
  if (policy.blocked) {
    active = false;
    setHovered(null);
    clearTranslations();
    syncBall();
    return;
  }
  syncBall();
  if (policy.auto && !active) {
    active = true;
    syncBall();
    applyTranslations(preset).catch(() => {
      active = false;
      clearTranslations();
      syncBall();
    });
  }
}

function syncBall() {
  if (!ballHost || !ballButton) return;
  const denied = originDenied() || !ballEnabled;
  ballHost.style.setProperty("display", denied ? "none" : "block", "important");
  if (denied) {
    if (ballTip) ballTip.hidden = true;
    if (ballMenu) ballMenu.hidden = true;
    return;
  }
  paintSiteMenu();
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

function positionSiteMenu() {
  const nearTop = ballTop < 28;
  if (ballSites) ballSites.classList.toggle("below", nearTop);
  if (!ballMenu) return;
  const onRight = ballSide !== "left";
  ballMenu.classList.toggle("on-right", onRight);
  ballMenu.classList.toggle("on-left", !onRight);
  ballMenu.classList.toggle("flip-up", ballTop > window.innerHeight - 120);
}

function paintSiteMenu() {
  if (!ballMenu) return;
  const policy = pagePolicy();
  const deny = ballMenu.querySelector('[data-site="deny"]');
  const allow = ballMenu.querySelector('[data-site="allow"]');
  if (deny) deny.textContent = policy.denied ? "本页移出永不翻译" : "本页加入永不翻译";
  if (allow) allow.textContent = policy.onAllow ? "本页移出始终翻译" : "本页加入始终翻译";
}

/**
 * @param {{ ok?: boolean, which?: string, mode?: string, changed?: boolean, onAllow?: boolean, denied?: boolean, error?: string }} res
 */
function siteMenuHint(res) {
  if (!res?.ok) return res?.error || "操作失败";
  if (res.which === "deny" && res.mode === "add") {
    if (!res.changed) return "已在永不翻译中";
    return res.onAllow ? "已加入永不翻译，优先于始终翻译" : "已加入永不翻译";
  }
  if (res.which === "deny") return res.changed ? "已移出永不翻译" : "本页不在永不翻译中";
  if (res.mode === "add") {
    if (!res.changed) return "已在始终翻译中";
    return res.denied ? "已加入始终翻译，仍以永不翻译为准" : "已加入始终翻译";
  }
  return res.changed ? "已移出始终翻译" : "本页不在始终翻译中";
}

/**
 * In-memory gate. Storage `ballTipSeen` is applied in the callback.
 * @param {boolean} ballTipSeen
 */
function ballTipAllowed(ballTipSeen) {
  const api = globalThis.ImmerOnboarding;
  if (!api) return ballTipSeen !== true && onboardingKnown && onboardingDone && !onboardingDismissedHere && !onboardingHost;
  return api.allowBallTip({
    ballTipSeen,
    guideVisible: Boolean(onboardingHost),
    dismissedOnThisDocument: onboardingDismissedHere,
    guidePending: !onboardingKnown || !onboardingDone,
  });
}

function maybeShowBallTip() {
  if (!pageReady || ballTipChecked || !ballTip || originDenied() || !ballEnabled) return;
  if (!chrome?.storage?.local) return;
  if (!ballTipAllowed(false)) return;
  ballTipChecked = true;
  chrome.storage.local.get({ ballTipSeen: false }, (data) => {
    if (!ballTipAllowed(data?.ballTipSeen === true) || originDenied() || !ballEnabled || !ballTip) return;
    positionBallTip();
    ballTip.hidden = false;
    chrome.storage.local.set({ ballTipSeen: true });
  });
}

/**
 * @param {string} text
 * @param {number} [ms]
 */
function showBallHint(text, ms) {
  if (!ballHint) return;
  ballHintIsFailure = false;
  ballHint.textContent = text;
  ballHint.hidden = false;
  ballHint.classList.toggle("below", ballTop < 72);
  clearTimeout(ballHintTimer);
  const wait = typeof ms === "number" && ms > 0 ? ms : 2200;
  ballHintTimer = setTimeout(() => {
    if (ballHint) ballHint.hidden = true;
    ballHintIsFailure = false;
  }, wait);
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
  positionSiteMenu();
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

function unmountOnboarding() {
  if (onboardingHost) {
    onboardingHost.remove();
    onboardingHost = null;
  }
  onboardingState = null;
}

/**
 * @param {ShadowRoot} shadow
 * @param {NonNullable<typeof globalThis.ImmerOnboarding>} api
 */
function renderOnboardingCard(shadow, api) {
  const state = onboardingState;
  if (!state) return;
  const step = api.STEPS[state.index];
  if (!step) return;
  const kicker = shadow.querySelector(".kicker");
  const title = shadow.querySelector("h2");
  const body = shadow.querySelector(".body");
  const primary = shadow.querySelector(".primary");
  const skipAll = shadow.querySelector(".skip-all");
  if (kicker) kicker.textContent = `${state.index + 1} / ${api.STEPS.length}`;
  if (title) title.textContent = step.title;
  if (body) body.textContent = step.body;
  if (primary) primary.textContent = api.primaryLabel(state.index);
  if (skipAll instanceof HTMLElement) skipAll.hidden = !api.showSkipAll(state.index);
}

/**
 * @param {"next" | "skip" | "skip-all"} action
 */
function applyOnboardingAction(action) {
  const api = globalThis.ImmerOnboarding;
  if (!api || !onboardingState) return;
  onboardingState = api.reduce(onboardingState, action);
  if (!onboardingState.done) {
    if (onboardingHost?.shadowRoot) renderOnboardingCard(onboardingHost.shadowRoot, api);
    return;
  }
  const patch = api.storagePatch(onboardingState);
  onboardingDone = true;
  onboardingDismissedHere = true;
  if (patch?.ballTipSeen) {
    ballTipChecked = true;
    if (ballTip) ballTip.hidden = true;
  }
  unmountOnboarding();
  if (patch && chrome?.storage?.local) chrome.storage.local.set(patch);
}

/**
 * @param {{ onboardingDone?: unknown } | null | undefined} settings
 */
function bootOnboarding(settings) {
  const api = globalThis.ImmerOnboarding;
  onboardingKnown = true;
  onboardingDone = api ? !api.guidePending(settings?.onboardingDone) : settings?.onboardingDone === true;
  if (!onboardingDone) mountOnboarding();
}

function mountOnboarding() {
  if (onboardingDone || onboardingHost || !document.documentElement) return;
  if (document.getElementById("immer-onboarding-host")) return;
  const api = globalThis.ImmerOnboarding;
  if (!api) return;
  onboardingState = api.initialState();
  const host = document.createElement("div");
  host.id = "immer-onboarding-host";
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("z-index", "2147483645", "important");
  host.style.setProperty("top", "16px", "important");
  host.style.setProperty("left", "16px", "important");
  host.style.setProperty("width", "min(320px, calc(100vw - 32px))", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("border", "0", "important");
  host.style.setProperty("background", "transparent", "important");
  host.style.setProperty("pointer-events", "none", "important");
  host.style.setProperty("overflow", "visible", "important");
  const shadow = host.attachShadow({ mode: "open" });
  const glassUrl = chrome?.runtime?.getURL ? chrome.runtime.getURL("glass.css") : "glass.css";
  shadow.innerHTML = `
    <link rel="stylesheet" href="${glassUrl}" />
    <style>
      .card {
        pointer-events: auto;
        box-sizing: border-box;
        width: 100%;
        max-height: calc(100vh - 32px);
        overflow: auto;
        padding: var(--immer-glass-pad, 16px);
        font: 13px/1.45 system-ui, sans-serif;
        color: var(--immer-glass-text, #1c2430);
      }
      .kicker {
        margin: 0;
        color: var(--immer-glass-muted, #5c6b7a);
        font-size: 12px;
        letter-spacing: 0.02em;
      }
      h2 {
        margin: 4px 0 0;
        font: 650 16px/1.3 system-ui, sans-serif;
      }
      .body {
        margin: var(--immer-glass-space, 8px) 0 0;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--immer-glass-space, 8px);
        margin-top: var(--immer-glass-gap, 12px);
      }
      button {
        font: inherit;
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid var(--immer-cta-bg, #1f4e9a);
        outline-offset: 2px;
      }
      .primary {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        border-radius: var(--immer-glass-radius, 14px);
        padding: 8px 14px;
        background: var(--immer-cta-bg, #1f4e9a);
        color: var(--immer-cta-fg, #ffffff);
        font-weight: 650;
      }
      .primary:hover { background: var(--immer-cta-bg-pressed, #183e7a); }
      .ghost, .skip-all {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        background: transparent;
        color: var(--immer-cta-bg, #1f4e9a);
        font-weight: 600;
        padding: 8px 10px;
      }
      .skip-all {
        margin-top: 2px;
        padding-left: 0;
        color: var(--immer-glass-muted, #5c6b7a);
        font-weight: 500;
      }
    </style>
    <section class="card immer-glass" aria-labelledby="immer-onboarding-title">
      <p class="kicker"></p>
      <h2 id="immer-onboarding-title"></h2>
      <p class="body"></p>
      <div class="row">
        <button class="primary" type="button" data-action="next"></button>
        <button class="ghost" type="button" data-action="skip">跳过</button>
      </div>
      <button class="skip-all" type="button" data-action="skip-all">全部跳过</button>
    </section>
  `;
  shadow.addEventListener("click", (event) => {
    const node = event.target;
    const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
    const button = element?.closest("button") ?? null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.getAttribute("data-action");
    if (action === "next" || action === "skip" || action === "skip-all") applyOnboardingAction(action);
  });
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
  renderOnboardingCard(shadow, api);
  onboardingHost = host;
  document.documentElement.appendChild(host);
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
        max-width: 240px;
        padding: var(--immer-glass-space, 8px);
        font: 12px/1.4 system-ui, sans-serif;
        text-align: center;
        pointer-events: none;
        white-space: pre-wrap;
        word-break: break-word;
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
      .sites {
        all: unset;
        position: absolute;
        left: 0;
        top: -22px;
        box-sizing: border-box;
        width: 48px;
        height: 18px;
        border-radius: 999px;
        background: var(--immer-glass-fill-strong, rgba(255, 255, 255, 0.8));
        box-shadow: var(--immer-glass-shadow, 0 8px 24px rgba(28, 36, 48, 0.12));
        color: var(--immer-cta-bg, #1f4e9a);
        font: 600 11px/18px system-ui, sans-serif;
        text-align: center;
        cursor: pointer;
      }
      .sites.below { top: auto; bottom: -22px; }
      .menu {
        position: absolute;
        top: 0;
        box-sizing: border-box;
        width: 168px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .menu.on-right { right: 56px; }
      .menu.on-left { left: 56px; }
      .menu.flip-up { top: auto; bottom: 0; }
      .menu button {
        all: unset;
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: 6px 8px;
        border-radius: 8px;
        color: var(--immer-glass-text, #1c2430);
        font: 600 12px/1.35 system-ui, sans-serif;
        cursor: pointer;
      }
      .menu button:hover { background: rgba(31, 78, 154, 0.1); }
    </style>
    <button id="immer-ball" class="immer-glass" type="button" aria-pressed="false">
      <span class="mark">译</span>
      <span class="badge" hidden></span>
    </button>
    <button id="immer-sites" class="sites" type="button">站点</button>
    <div class="menu immer-glass" hidden>
      <button type="button" data-site="deny">本页加入永不翻译</button>
      <button type="button" data-site="allow">本页加入始终翻译</button>
    </div>
    <div class="hint immer-glass" hidden></div>
    <div class="tip immer-glass" hidden>
      <p></p>
      <button type="button">知道了</button>
    </div>
  `;
  ballHost = host;
  ballButton = shadow.querySelector("#immer-ball");
  ballSites = shadow.querySelector("#immer-sites");
  ballMenu = shadow.querySelector(".menu");
  ballHint = shadow.querySelector(".hint");
  ballTip = shadow.querySelector(".tip");
  /** The opening click can reach document after the menu is shown. */
  let suppressSiteClose = false;
  ballSites?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!ballMenu || originDenied() || !ballEnabled) return;
    paintSiteMenu();
    positionSiteMenu();
    ballMenu.hidden = !ballMenu.hidden;
    if (!ballMenu.hidden && ballTip) ballTip.hidden = true;
    suppressSiteClose = !ballMenu.hidden;
    if (suppressSiteClose) {
      setTimeout(() => {
        suppressSiteClose = false;
      }, 0);
    }
  });
  ballMenu?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.target instanceof Element ? event.target.closest("[data-site]") : null;
    if (!button) return;
    const which = button.getAttribute("data-site") === "allow" ? "allow" : "deny";
    const policy = pagePolicy();
    const mode = (which === "deny" ? policy.denied : policy.onAllow) ? "remove" : "add";
    if (ballMenu) ballMenu.hidden = true;
    setPageList(which, mode)
      .then((res) => showBallHint(siteMenuHint(res)))
      .catch((err) => showBallHint(String(err?.message || err || "操作失败")));
  });
  document.addEventListener("click", (event) => {
    if (!ballMenu || ballMenu.hidden || suppressSiteClose) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (ballHost && path.includes(ballHost)) return;
    ballMenu.hidden = true;
  });
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
    if (ballMenu) ballMenu.hidden = true;
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
    toggle().catch(() => {});
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
    try {
      await applyTranslations(settings);
    } catch (err) {
      active = false;
      clearTranslations();
      throw err;
    }
  } finally {
    translateLock = false;
    syncBall();
  }
}

async function toggle() {
  await setTranslated(!active);
}

/**
 * @param {Record<string, unknown>} patch
 */
function storageSet(patch) {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set(patch, () => resolve());
  });
}

/**
 * Add or remove this page on denyOrigins / allowOrigins. Remove drops every
 * stored row that matches the page (bare host and exact origin).
 * @param {"deny" | "allow"} which
 * @param {"add" | "remove"} mode
 */
async function setPageList(which, mode) {
  const api = globalThis.ImmerSites;
  const page = pageRef();
  const entry = api?.normalizeSiteEntry(location.href) || "";
  if (!api?.pageListChange || !entry) return { ok: false, error: "无法识别来源" };
  const listKey = which === "allow" ? "allowOrigins" : "denyOrigins";
  const settings = await getPageSettings();
  const current = which === "allow" ? settings.allowOrigins : settings.denyOrigins;
  const next = api.pageListChange(current, page, entry, mode === "remove" ? "remove" : "add");
  if (which === "allow") allowOrigins = next.list;
  else denyOrigins = next.list;
  await storageSet({ [listKey]: next.list });
  applyListPolicy();
  return {
    ok: true,
    entry: next.entry || entry,
    which: which === "allow" ? "allow" : "deny",
    mode: mode === "remove" ? "remove" : "add",
    changed: next.changed,
    removed: next.removed,
    active: Boolean(active) && !originDenied(),
    denied: originDenied(),
    onAllow: originAllowed(),
  };
}

/**
 * @returns {Promise<{ ok: boolean, entry?: string, error?: string }>}
 */
async function denyThisOrigin() {
  return setPageList("deny", "add");
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
  const previous = hovered;
  hovered = el;
  if (hovered) {
    hovered.classList.add(CLASS_HOVER);
    hoverMemory = hovered;
    hoverMemoryAt = Date.now();
  } else if (previous) {
    hoverMemory = previous;
    hoverMemoryAt = Date.now();
  }
}

/**
 * Paragraph for the extension command. Prefer the live hover. If the chord
 * opened a menu and the pointer event cleared it, keep the paragraph that
 * was under the pointer a moment ago.
 * @returns {HTMLElement | null}
 */
function commandParagraphTarget() {
  if (hovered && hovered.isConnected) return hovered;
  if (
    hoverMemory &&
    hoverMemory.isConnected &&
    Date.now() - hoverMemoryAt < 1200
  ) {
    return hoverMemory;
  }
  return null;
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
/** Last paragraph chord, so a late command does not translate a new hover. */
let paragraphChordAt = 0;
/** @type {"page" | "command" | ""} */
let paragraphChordSource = "";

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
 * Extension command for the paragraph chord. Translates the paragraph that
 * was hovered when the command arrived. A saved hotkey that no longer matches
 * the command shortcut is left to the in-page listener. Deny-list origins,
 * editable focus, and a missing hover do nothing — this never toggles the page.
 * @param {string} shortcut
 * @returns {Promise<{ ok: boolean, reason?: string, deduped?: boolean }>}
 */
async function onParagraphFromCommand(shortcut) {
  const target = commandParagraphTarget();
  const typing = focusIsTyping(document.activeElement);
  const settings = await getPageSettings();
  adoptSettings(settings);
  const api = globalThis.ImmerHotkey;
  const matches = api?.sameHotkey
    ? api.sameHotkey(shortcut, paragraphHotkey)
    : false;
  if (!matches) return { ok: false, reason: "mismatch" };
  if (typing || originDenied() || !target) return { ok: false, reason: "inert" };
  const now = Date.now();
  if (paragraphChordSource === "page" && now - paragraphChordAt < 1200) {
    return { ok: true, deduped: true };
  }
  if (now - paragraphChordAt < 100) return { ok: true, deduped: true };
  paragraphChordAt = now;
  paragraphChordSource = "command";
  await translateSegment(target);
  return { ok: true };
}

/**
 * Capture-phase listener. preventDefault runs only after the chord matches
 * and focus is outside an editable field, so browser menu/accelerator
 * defaults for Alt+A / ⌥A and Alt+T / ⌥T are cancelled when the event still
 * reaches the page. A deny-listed origin leaves the paragraph chord alone.
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
    pageSpec: pageHotkey,
    typing: focusIsTyping(event.target),
    hovered: Boolean(hovered),
    keydownCode,
    lastToggleAt: chordToggleAt,
    now: Date.now(),
  });
  keydownCode = decision.keydownCode;
  if (!decision.prevent || !decision.action) return;
  if (decision.action === "paragraph") {
    if (originDenied()) return;
    event.preventDefault();
    event.stopPropagation();
    paragraphChordAt = Date.now();
    paragraphChordSource = "page";
    if (hovered) translateSegment(hovered).catch(() => {});
    return;
  }
  event.preventDefault();
  event.stopPropagation();
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
  if (Object.prototype.hasOwnProperty.call(changes, "pageHotkey")) {
    rememberPageHotkey(changes.pageHotkey.newValue);
  }
  if (Object.prototype.hasOwnProperty.call(changes, "ballEnabled")) {
    rememberBallEnabled(changes.ballEnabled.newValue);
    syncBall();
  }
  if (Object.prototype.hasOwnProperty.call(changes, "onboardingDone")) {
    const api = globalThis.ImmerOnboarding;
    const done = api
      ? !api.guidePending(changes.onboardingDone.newValue)
      : changes.onboardingDone.newValue === true;
    onboardingKnown = true;
    onboardingDone = done;
    if (done) {
      onboardingDismissedHere = true;
      ballTipChecked = true;
      if (ballTip) ballTip.hidden = true;
      unmountOnboarding();
    } else if (!onboardingHost) {
      onboardingDismissedHere = false;
      mountOnboarding();
    }
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
  applyListPolicy();
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
      onAllow: originAllowed(),
      entry: globalThis.ImmerSites?.normalizeSiteEntry(location.href) || "",
    });
    return false;
  }
  if (message?.type === "SET_PAGE_LIST") {
    const which = message.which === "allow" ? "allow" : "deny";
    const mode = message.mode === "remove" ? "remove" : "add";
    setPageList(which, mode)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: String(err?.message || err),
          active,
          denied: originDenied(),
          onAllow: originAllowed(),
        })
      );
    return true;
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
  if (message?.type === "TRANSLATE_HOVERED_PARAGRAPH") {
    onParagraphFromCommand(typeof message.shortcut === "string" ? message.shortcut : "")
      .then((result) => sendResponse({ ...result, denied: originDenied() }))
      .catch((err) => sendResponse(translateFailureReply(err, { denied: originDenied() })));
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
        sendResponse(translateFailureReply(err, { active, denied: originDenied() }))
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
    bootOnboarding(settings);
    const policy = pagePolicy();
    if (policy.blocked) {
      active = false;
      setHovered(null);
      clearTranslations();
      syncBall();
      return;
    }
    syncBall();
    if (!policy.auto) return;
    active = true;
    syncBall();
    return applyTranslations(settings).catch(() => {
      active = false;
      clearTranslations();
      syncBall();
    });
  })
  .catch(() => {});

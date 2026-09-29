/**
 * Main-content paragraph picker → bilingual nodes under originals.
 * Talks to background via TRANSLATE_BATCH (TransPipe request/response shape).
 */

const ATTR_ID = "data-immer-id";
const ATTR_DONE = "data-immer-translated";
const CLASS_WRAPPER = "immer-bilingual";
const CLASS_TRANS = "immer-translation";

/** @type {boolean} */
let active = false;

function isVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function pickParagraphs() {
  const roots = [
    document.querySelector("article"),
    document.querySelector("main"),
    document.querySelector("[role='main']"),
    document.body,
  ].filter(Boolean);

  const root = roots[0];
  const nodes = root.querySelectorAll("p, li, h1, h2, h3, h4, blockquote");
  /** @type {HTMLElement[]} */
  const out = [];
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest(`.${CLASS_WRAPPER}, .${CLASS_TRANS}, script, style, noscript`))
      continue;
    const text = (el.innerText || "").trim();
    if (text.length < 8) continue;
    if (!isVisible(el)) continue;
    out.push(el);
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

function clearTranslations() {
  document.querySelectorAll(`.${CLASS_TRANS}`).forEach((n) => n.remove());
  document.querySelectorAll(`[${ATTR_DONE}]`).forEach((el) => {
    el.removeAttribute(ATTR_DONE);
    el.removeAttribute(ATTR_ID);
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

  const settings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      resolve(res?.data || { sourceLang: "auto", targetLang: "zh-CN" });
    });
  });

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

    const node = document.createElement("div");
    node.className = CLASS_TRANS;
    node.setAttribute("lang", settings.targetLang || "zh-CN");
    node.textContent = hit.text;
    el.insertAdjacentElement("afterend", node);
    el.setAttribute(ATTR_DONE, "1");
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

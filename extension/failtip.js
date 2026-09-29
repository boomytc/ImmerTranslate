/**
 * Failure tip shared by the content script and the toolbar popup.
 * Classic script (not an ES module): each page loads it and reads globalThis.ImmerFail.
 *
 * TranslateRequest / TranslateResponse stay unchanged. A rejected translate
 * carries message plus kind / code / status from TranslateFailure. This file
 * only turns that rejection into one sentence for the glass toast, the ball,
 * and the popup hint. An empty API key never reaches this path (mock ⟦…⟧).
 */
(function initImmerFail(root) {
  /**
   * @param {unknown} source
   * @returns {{ message: string, kind: string, code: string, status?: number }}
   */
  function readFailure(source) {
    const rec =
      source && typeof source === "object"
        ? /** @type {Record<string, unknown>} */ (source)
        : {};
    const fromMessage = typeof rec.message === "string" ? rec.message.trim() : "";
    const fromError = typeof rec.error === "string" ? rec.error.trim() : "";
    let message = fromMessage || fromError;
    if (!message) {
      message =
        source == null || source === "" || (source && typeof source === "object")
          ? "翻译失败"
          : String(source);
    }
    const kind = typeof rec.kind === "string" ? rec.kind.trim() : "";
    const code = typeof rec.code === "string" ? rec.code.trim() : "";
    const status =
      typeof rec.status === "number" && Number.isFinite(rec.status) ? rec.status : undefined;
    return { message, kind, code, status };
  }

  /**
   * Kicker names the failure (kind, and code / status when they add information).
   * Body is the engine sentence. `text` is the one line used by the popup and the ball.
   * @param {unknown} source
   * @returns {{ kicker: string, body: string, text: string }}
   */
  function formatFailureTip(source) {
    const info = readFailure(source);
    /** @type {string[]} */
    const bits = [];
    if (info.kind) bits.push(info.kind);
    if (info.code && info.code !== info.kind) bits.push(info.code);
    if (info.status != null) bits.push(String(info.status));
    const meta = bits.join(" · ");
    const kicker = meta ? `翻译失败 · ${meta}` : "翻译失败";
    const body = info.message || "翻译失败";
    const text = body === kicker ? kicker : `${kicker}：${body}`;
    return { kicker, body, text };
  }

  /**
   * Error that still carries kind / code / status across the next message hop.
   * @param {unknown} source
   * @param {string} [fallback]
   * @returns {Error & { kind?: string, code?: string, status?: number }}
   */
  function failureError(source, fallback) {
    const info = readFailure(source);
    const message =
      info.message && info.message !== "翻译失败" ? info.message : fallback || info.message || "翻译失败";
    const err = /** @type {Error & { kind?: string, code?: string, status?: number }} */ (
      new Error(message)
    );
    if (info.kind) err.kind = info.kind;
    if (info.code) err.code = info.code;
    if (info.status != null) err.status = info.status;
    return err;
  }

  root.ImmerFail = { readFailure, formatFailureTip, failureError };
})(typeof globalThis !== "undefined" ? globalThis : this);

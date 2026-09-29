/**
 * @typedef {import('./types.js').TranslateRequest} TranslateRequest
 * @typedef {import('./types.js').TranslateResponse} TranslateResponse
 * @typedef {import('./types.js').TranslateEngine} TranslateEngine
 */

/**
 * Deterministic mock: wraps each segment as ⟦text⟧ (same as extension shell).
 * @type {TranslateEngine}
 */
export async function mockTranslate(req) {
  if (!req || !Array.isArray(req.segments)) {
    throw new Error("TranslateRequest.segments must be an array");
  }
  return {
    segments: req.segments.map((s) => ({
      id: s.id,
      text: `⟦${s.text}⟧`,
    })),
  };
}

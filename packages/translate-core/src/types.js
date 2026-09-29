/**
 * Shared TranslateRequest / TranslateResponse shapes.
 * Sole ExtForge ↔ TransPipe boundary — do not change without room agreement.
 *
 * @typedef {"auto" | "zh-CN" | "en" | string} Lang
 *
 * @typedef {{ id: string, text: string }} Segment
 *
 * @typedef {{
 *   sourceLang: Lang,
 *   targetLang: Lang,
 *   segments: Segment[]
 * }} TranslateRequest
 *
 * @typedef {{
 *   segments: Array<{ id: string, text: string, error?: string }>
 * }} TranslateResponse
 *
 * @typedef {(req: TranslateRequest) => Promise<TranslateResponse>} TranslateEngine
 */

export {};

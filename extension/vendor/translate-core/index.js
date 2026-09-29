/**
 * @immer-translate/translate-core
 * Engine abstraction entry. Keys never live in this package.
 */

import { mockTranslate } from "./mock.js";

export { mockTranslate };

/**
 * Default engine for local / extension wiring until a real OpenAI-compatible
 * engine is plugged in. Callers pass secrets from chrome.storage / env at runtime.
 */
export const translate = mockTranslate;

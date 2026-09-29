/**
 * @immer-translate/translate-core
 * Engine abstraction entry. Keys never live in this package.
 */

import { mockTranslate } from "./mock.js";

export { mockTranslate };
export { createOpenAICompatibleEngine, createAnthropicCompatibleEngine } from "./engines.js";
export { deepSeekOptionsFromEnv } from "./env.js";
export {
  createPipelineEngine,
  pipelineDefaults,
  withCache,
  withRateLimit,
  withRetry,
} from "./pipeline.js";

/**
 * Default engine stays the mock. Real engines are opt-in via the factories;
 * callers pass secrets from chrome.storage or the process environment.
 */
export const translate = mockTranslate;

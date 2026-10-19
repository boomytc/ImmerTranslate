// Jest test environment setup: polyfill browser built-in AI APIs by default
// so existing tests continue to pass in simulated modern browser environment.
if (typeof globalThis !== "undefined") {
  globalThis.LanguageDetector = globalThis.LanguageDetector || {};
  globalThis.Translator = globalThis.Translator || {
    availability: () => Promise.resolve("readily"),
  };
}

// jsdom used by the test runner does not expose structuredClone. Runtime code
// calls the platform implementation, which current browsers provide.
if (typeof globalThis.structuredClone !== "function") {
  const { runInThisContext } = require("vm");
  globalThis.structuredClone = runInThisContext("structuredClone");
}

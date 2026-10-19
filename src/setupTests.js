// Jest test environment setup: polyfill browser built-in AI APIs by default
// so existing tests continue to pass in simulated modern browser environment.
if (typeof globalThis !== "undefined") {
  globalThis.LanguageDetector = globalThis.LanguageDetector || {};
  globalThis.Translator = globalThis.Translator || {
    availability: () => Promise.resolve("readily"),
  };
}

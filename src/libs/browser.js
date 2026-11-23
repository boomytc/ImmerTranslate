/**
 * @file browser.js
 * @description 浏览器环境桥接模块，用于引入 WebExtension Polyfill 垫片，并提供当前执行环境上下文 (Background, Options, Content Script) 的判定工具。
 */

/**
 * 尝试安全加载 webextension-polyfill
 * @returns {object|undefined} 浏览器插件 API polyfill 实例，非插件环境则返回 undefined
 */
function _browser() {
  if (globalThis.browser) return globalThis.browser;
  try {
    return require("webextension-polyfill");
  } catch (err) {
    // 非扩展环境下运行时忽略报错 (如开发打包、Web 预览)
    // kissLog("browser", err);
  }
}

// 统一的浏览器扩展 API 导出对象
export const browser = _browser();

export const APP_CONTEXT_KEY = "__IMMERTRANSLATE_CONTEXT__";

/**
 * 获取当前脚本在浏览器扩展中的具体执行环境上下文。
 * 优先读取入口显式挂载的上下文标记，缺失时按运行环境与扩展 URL 回退判定。
 * @returns {string} 返回 "background" | "content" | "options" | "popup" | "sidepanel" | "undefined"
 */
export const getContext = () => {
  const context = globalThis[APP_CONTEXT_KEY];
  if (context) return context;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return browser?.runtime?.id ? "background" : "undefined";
  }

  try {
    const extensionOrigin =
      typeof browser?.runtime?.getURL === "function"
        ? browser.runtime.getURL("")
        : "";
    if (!extensionOrigin) {
      return "undefined";
    }
    if (!window.location?.href?.startsWith(extensionOrigin)) {
      return "content";
    }

    const pathname = (window.location?.pathname || "").toLowerCase();
    if (pathname.includes("popup")) return "popup";
    if (pathname.includes("options")) return "options";
    if (pathname.includes("sidepanel")) return "sidepanel";
    if (pathname.includes("background")) return "background";
  } catch {
    return "undefined";
  }

  return "undefined";
};

// 辅助环境判定变量
export const isBg = () => getContext() === "background";
export const isOptions = () => getContext() === "options";

// 判断当前浏览器内核中是否支持原生内置 AI (LanguageDetector 和 Translator，目前主要是 Chrome Dev 138+)
export const isBuiltinAIAvailable =
  "LanguageDetector" in globalThis && "Translator" in globalThis;

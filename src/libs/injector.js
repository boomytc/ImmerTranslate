import { APP_LCNAME } from "../config/app";
import { trustedTypesHelper } from "./trustedTypes";

export const INJECT_SOURCE_PREFIX = `${APP_LCNAME}-inject`;

// 向宿主页面注入行内 JavaScript 脚本。
// 结合 Trusted Types 机制处理代码，兼容高安全 CSP (Content Security Policy) 要求的网站。
export const injectInlineJs = (code, id = `${APP_LCNAME}-inline-js`) => {
  // 避免重复注入相同 ID 的脚本
  if (document.getElementById(id)) {
    return;
  }

  const el = document.createElement("script");
  el.setAttribute("data-source", `${INJECT_SOURCE_PREFIX} injectInlineJs`);
  el.type = "text/javascript";
  el.id = id;
  // 通过 Trusted Types 策略生成受信任的 Script
  el.textContent = trustedTypesHelper.createScript(code);
  (document.head || document.documentElement).appendChild(el);
};

// 向页面注入外部引用的 JavaScript 脚本文件。
export const injectExternalJs = (src, id = `${APP_LCNAME}-external-js`) => {
  if (document.getElementById(id)) {
    return;
  }

  const el = document.createElement("script");
  el.setAttribute("data-source", `${INJECT_SOURCE_PREFIX} injectExternalJs`);
  el.type = "text/javascript";
  el.id = id;
  // 通过 Trusted Types 转换外部 script 链接，防止被严格 CSP 拦截
  el.src = trustedTypesHelper.createScriptURL(src);
  (document.head || document.documentElement).appendChild(el);
};

// 向页面注入行内 CSS 样式。
// 该函数会被 browser.scripting.executeScript 序列化到页面 MAIN world 执行，
// 因此保持完全自包含，不引用外层模块变量；sourcePrefix 由参数传入。
export const injectInternalCss = (
  styles,
  sourcePrefix = "immertranslate-inject"
) => {
  if (typeof styles !== "string" || !styles) {
    return;
  }

  const el = document.createElement("style");
  el.setAttribute("data-source", `${sourcePrefix} injectInternalCss`);
  el.textContent = styles;
  (document.head || document.documentElement)?.appendChild(el);
};

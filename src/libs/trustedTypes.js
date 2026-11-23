/**
 * @file trustedTypes.js
 * @description Trusted Types (可信类型) 辅助模块，用于兼容现代浏览器高强度 CSP 限制下的 HTML 注入和动态脚本执行，防范 XSS 攻击。
 */

import DOMPurify from "dompurify";
import { APP_LCNAME } from "../config/app";
import { browser } from "./browser";

const validateScriptURL = (urlString) => {
  if (typeof urlString !== "string" || !urlString.trim()) {
    throw new TypeError("Invalid script URL");
  }

  const extensionPrefix =
    typeof browser?.runtime?.getURL === "function"
      ? browser.runtime.getURL("")
      : "";
  if (extensionPrefix) {
    const normalized = new URL(urlString).href;
    if (!normalized.startsWith(extensionPrefix)) {
      throw new TypeError("Blocked untrusted script URL");
    }
    return normalized;
  }

  // 非扩展环境下仅放行同源脚本地址，避免放行任意第三方脚本。
  if (
    typeof globalThis.location?.origin === "string" &&
    globalThis.location.origin !== "null"
  ) {
    const parsed = new URL(urlString, globalThis.location.href);
    if (parsed.origin === globalThis.location.origin) {
      return parsed.href;
    }
  }

  throw new TypeError("Blocked untrusted script URL");
};

// JSDoc 类型的 Trusted Types 辅助工具类
export const trustedTypesHelper = (() => {
  const POLICY_NAME = `${APP_LCNAME}-policy`;
  let policy = null;
  let policyUnavailable = false;

  const createPolicy = () => {
    if (policy || policyUnavailable) {
      return policy;
    }

    if (!globalThis.trustedTypes || !globalThis.trustedTypes.createPolicy) {
      policyUnavailable = true;
      return null;
    }

    try {
      policy = globalThis.trustedTypes.createPolicy(POLICY_NAME, {
        // 使用 DOMPurify 清洗注入的 HTML，保证译文容器中没有恶意代码
        createHTML: (string) => DOMPurify.sanitize(string),
        createScript: (string) => string,
        createScriptURL: (string) => validateScriptURL(string),
      });
    } catch {
      policyUnavailable = true;
    }

    return policy;
  };

  return {
    /**
     * 创建符合可信类型的 HTML，若不支持则返回清洗后的普通字符串
     * @param {string} htmlString
     */
    createHTML: (htmlString) => {
      const trustedPolicy = createPolicy();
      return trustedPolicy
        ? trustedPolicy.createHTML(htmlString)
        : DOMPurify.sanitize(htmlString);
    },
    /**
     * 创建符合可信类型的 Script 脚本，若不支持则原样返回
     * @param {string} scriptString
     */
    createScript: (scriptString) => {
      const trustedPolicy = createPolicy();
      return trustedPolicy
        ? trustedPolicy.createScript(scriptString)
        : scriptString;
    },
    /**
     * 创建符合可信类型的 ScriptURL 脚本地址，并校验其属于受信任来源
     * @param {string} urlString
     */
    createScriptURL: (urlString) => {
      const trustedPolicy = createPolicy();
      return trustedPolicy
        ? trustedPolicy.createScriptURL(urlString)
        : validateScriptURL(urlString);
    },
    /**
     * 判断当前 Trusted Types 策略是否生效
     * @returns {boolean}
     */
    isEnabled: () => policy !== null,
  };
})();

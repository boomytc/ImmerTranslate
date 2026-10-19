/**
 * @file rules.js
 * @description 翻译规则引擎。提供选择器的继承与差分算法（如支持加减号追加/剔除选择器）、内置规则与个人规则合并（个人规则覆盖内置规则，内置规则覆盖全局规则）以及规则数据的健全性清洗校验与保存。
 */

import { matchValue, type, isMatch } from "./utils";
import {
  GLOBAL_KEY,
  OPT_LANGS_FROM,
  OPT_LANGS_TO,
  DEFAULT_RULE,
  GLOBLA_RULE,
  BUILTIN_RULES,
  STOKEY_RULES,
  OPT_SPLIT_PARAGRAPH_ALL,
} from "../config";
import { getRulesWithDefault, saveEdit } from "./storage";
import { trySyncRules } from "./sync";
import { kissLog } from "./log";
import { splitSelectorList } from "./selectorList";
import { isSiteTransOpen, siteTransOpenValue } from "./siteTransOpen";

/**
 * 差分合并 CSS 选择器。
 * 支持用户使用 “+” 号前缀在默认/基准选择器上追加自定义选择器，
 * 以及使用 “-” 号前缀从基准选择器中剔除某些被误伤的默认选择器。
 * 若无前缀（非补丁模式），则认为完全覆盖基准选择器。
 * @param {string} defaultStr 默认/基准 CSS 选择器字符串（逗号分割）
 * @param {string} userStr 覆盖的 CSS 选择器字符串（逗号分割）
 * @returns {string} 合并后的最终 CSS 选择器字符串
 */
export function mergeSelectors(defaultStr, userStr) {
  if (!userStr || !userStr.trim()) {
    return defaultStr;
  }

  // Keep invalid legacy input intact for the existing runtime error handling.
  // Never silently change attribute values or nested selector arguments.
  let defaultList, userList;
  try {
    defaultList = splitSelectorList(defaultStr);
    userList = splitSelectorList(userStr);
  } catch (err) {
    kissLog("invalid selector list", err);
    return userStr;
  }

  // 判断是否属于追加/删除的补丁（Patch）模式（即列表中包含任意一个带 "+" 或 "-" 的项）
  const isPatchMode = userList.some(
    (s) => s.startsWith("+") || s.startsWith("-")
  );

  // 纯覆盖模式：直接去重并返回用户的选择器
  if (!isPatchMode) {
    return [...new Set(userList)].join(", ");
  }

  // 补丁差分模式
  let finalSet = new Set(defaultList);
  let currentMode = "add"; // 默认修饰动作为“添加”
  userList.forEach((item) => {
    let selector = item;

    if (item.startsWith("+")) {
      currentMode = "add";
      selector = item.slice(1).trim();
    } else if (item.startsWith("-")) {
      currentMode = "remove";
      selector = item.slice(1).trim();
    }

    if (!selector) return;

    if (currentMode === "remove") {
      finalSet.delete(selector); // 剔除选择器
    } else {
      finalSet.add(selector); // 追加选择器
    }
  });

  return [...finalSet].join(", ");
}

/**
 * 在给定的规则列表中，依据当前的 URL 匹配适合的规则
 * @param {Array<Object>} rules 待遍历的规则数组
 * @param {string} href 当前页面的完整 URL (如 location.href)
 * @returns {Object|undefined} 匹配到的首条规则，未匹配返回 undefined
 */
export const matchesRulePattern = (href, pattern) => {
  if (pattern.startsWith("hostname:")) {
    try {
      const url = new URL(href);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        url.hostname === pattern.slice("hostname:".length).toLowerCase()
      );
    } catch {
      return false;
    }
  }
  return pattern.split(/\n|,/).some((p) => isMatch(href, p.trim()));
};

export const hostnamePattern = (href) => {
  const url = new URL(href);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error("unsupported-page");
  }
  return `hostname:${url.hostname}`;
};

export const findMatchingRule = (rules, href) => {
  return rules.find(
    (r) =>
      r.pattern !== GLOBAL_KEY &&
      r.enabled !== false &&
      matchesRulePattern(href, r.pattern)
  );
};

/**
 * 合并两条规则，高优先级（overrideRule）覆盖基准低优先级规则（baseRule）
 * 对于选择器字段（selector, keepSelector 等），会调用 mergeSelectors 进行智能继承/差分合并；
 * 对于枚举或普通字段，高优先级若为 `*` (GLOBAL_KEY) 或为空则继承低优先级，否则予以覆盖。
 * @param {Object} baseRule 基准低优先级规则
 * @param {Object} overrideRule 覆盖高优先级规则
 * @returns {Object} 合并后的最终规则
 */
const copyRule = (rule) => ({ ...rule });

export const mergeRules = (baseRule, overrideRule) => {
  if (!overrideRule) return copyRule(baseRule);
  if (!baseRule) return copyRule(overrideRule);

  const merged = { ...baseRule };

  // 1. 合并 CSS 选择器类型的属性，支持追加/剔除
  [
    "selector",
    "keepSelector",
    "blockSelector",
    "rootsSelector",
    "ignoreSelector",
  ].forEach((key) => {
    merged[key] = mergeSelectors(baseRule[key] || "", overrideRule[key] || "");
  });

  // 2. 合并非空字符串类型的属性 (如自定义 JS/CSS/术语表样式)
  [
    "terms",
    "aiTerms",
    "termsStyle",
    "highlightStyle",
    "textExtStyle",
    "selectStyle",
    "parentStyle",
    "grandStyle",
    "injectCss",
  ].forEach((key) => {
    if (overrideRule[key]?.trim()) {
      merged[key] = overrideRule[key];
    }
  });

  // 3. 合并枚举类型的属性，若高优先级属性为星号 '*' 则继续继承，否则直接覆盖
  [
    "apiSlug",
    "fromLang",
    "toLang",
    "transOpen",
    "transOnly",
    "transOnlyRevert",
    "transOrder",
    "wrapOriginal",
    "autoScan",
    "hasRichText",
    "hasShadowroot",
    "scanAll",
    "isPlainText",
    "transTag",
    "transTitle",
    "splitParagraph",
    "textStyle",
    "originalTextStyle",
  ].forEach((key) => {
    if (overrideRule[key] && overrideRule[key] !== GLOBAL_KEY) {
      merged[key] = overrideRule[key];
    }
  });

  // 4. 合并数字数值类型属性
  ["splitLength", "transOnlyRevertDelay"].forEach((key) => {
    if (overrideRule[key] && overrideRule[key] !== GLOBAL_KEY) {
      merged[key] = overrideRule[key];
    }
  });

  // 5. 覆盖 pattern (URL 匹配模板)
  if (overrideRule.pattern) {
    merged.pattern = overrideRule.pattern;
  }

  return merged;
};

/** Resolve rule precedence without storage access or network requests. */
export const deriveRuleContext = (href, { personalRules }, sitePattern) => {
  // Derive inheritance from one caller-owned storage snapshot.
  const globalRule = {
    ...GLOBLA_RULE,
    ...(personalRules.find((r) => r.pattern === GLOBAL_KEY) || {}),
  };

  // Find the active personal rule, excluding the global rule.
  // The visual editor can keep editing a renamed rule even when its new
  // pattern no longer matches the page used to select elements.
  const activePersonalRule = findMatchingRule(personalRules, href);
  const requestedPersonalRule = sitePattern
    ? personalRules.find((rule) => rule.pattern === sitePattern)
    : null;
  // Reload must recover from deletion, renaming or a change in precedence.
  // Keep an explicitly edited off-page rule, but never pin a shadowed rule.
  const matchedPersonalRule =
    requestedPersonalRule &&
    requestedPersonalRule.enabled !== false &&
    (!matchesRulePattern(href, requestedPersonalRule.pattern) ||
      requestedPersonalRule === activePersonalRule)
      ? requestedPersonalRule
      : activePersonalRule;

  const matchedBuiltinRule = findMatchingRule(BUILTIN_RULES, href) || null;

  const inherited = mergeRules(globalRule, matchedBuiltinRule || null);
  const finalRule = mergeRules(inherited, matchedPersonalRule || null);

  return {
    effective: finalRule,
    inherited,
    // Restore the page rule after previewing an off-page rule.
    pageEffective:
      matchedPersonalRule !== activePersonalRule
        ? mergeRules(inherited, activePersonalRule || null)
        : null,
    personal: matchedPersonalRule || null,
    global: globalRule,
    site: matchedPersonalRule || null,
  };
};

export const resolveRuleContext = async (href, _setting, sitePattern) => {
  const personalRules = await getRulesWithDefault();
  return deriveRuleContext(href, { personalRules }, sitePattern);
};

export const matchRule = async (href, setting) =>
  (await resolveRuleContext(href, setting)).effective;

/**
 * 检查、清洗并过滤规则列表数据。
 * 支持输入 JSON 字符串或数组，对所有字段进行格式规范化与去重。
 * @param {Array<Object>|string} rules 待校验的规则数组或 JSON 字符串
 * @returns {Array<Object>} 校验规范化后的规则数组
 * @throws {Error} 如果解析失败或数据格式不为数组，则抛出 "data error" 异常
 */
export const checkRules = (rules) => {
  // 如果是 JSON 字符串，先尝试解析为 JavaScript 对象
  if (type(rules) === "string") {
    rules = JSON.parse(rules);
  }
  // 必须是数组格式
  if (type(rules) !== "array") {
    throw new Error("data error");
  }

  const fromLangs = OPT_LANGS_FROM.map((item) => item[0]);
  const toLangs = OPT_LANGS_TO.map((item) => item[0]);
  const patternSet = new Set();

  // 过滤并映射规则列表
  rules = rules
    .filter((rule) => type(rule) === "object") // 过滤出有效的规则对象
    .filter(({ pattern }) => {
      // 过滤掉没有 pattern 或 pattern 重复的规则
      if (type(pattern) !== "string" || patternSet.has(pattern.trim())) {
        return false;
      }
      patternSet.add(pattern.trim());
      return true;
    })
    .map(
      ({
        pattern,
        enabled,
        selector,
        keepSelector,
        blockSelector,
        rootsSelector,
        ignoreSelector,
        terms,
        aiTerms,
        termsStyle,
        highlightStyle,
        textExtStyle,
        selectStyle,
        parentStyle,
        grandStyle,
        injectCss,
        apiSlug,
        fromLang,
        toLang,
        textStyle,
        wrapOriginal,
        originalTextStyle,
        transOpen,
        transOnly,
        transOnlyRevert,
        transOnlyRevertDelay,
        transOrder,
        autoScan,
        hasRichText,
        hasShadowroot,
        scanAll,
        isPlainText,
        transTag,
        transTitle,
        splitParagraph,
        splitLength,
      }) => ({
        // 确保字段类型及取值的合法性，不合法或空值时回退到默认占位符或空值
        pattern: pattern.trim(),
        enabled: type(enabled) === "boolean" ? enabled : true,
        selector: type(selector) === "string" ? selector : "",
        keepSelector: type(keepSelector) === "string" ? keepSelector : "",
        blockSelector: type(blockSelector) === "string" ? blockSelector : "",
        rootsSelector: type(rootsSelector) === "string" ? rootsSelector : "",
        ignoreSelector: type(ignoreSelector) === "string" ? ignoreSelector : "",
        terms: type(terms) === "string" ? terms : "",
        aiTerms: type(aiTerms) === "string" ? aiTerms : "",
        termsStyle: type(termsStyle) === "string" ? termsStyle : "",
        highlightStyle: type(highlightStyle) === "string" ? highlightStyle : "",
        textExtStyle: type(textExtStyle) === "string" ? textExtStyle : "",
        selectStyle: type(selectStyle) === "string" ? selectStyle : "",
        parentStyle: type(parentStyle) === "string" ? parentStyle : "",
        grandStyle: type(grandStyle) === "string" ? grandStyle : "",
        injectCss: type(injectCss) === "string" ? injectCss : "",
        apiSlug:
          type(apiSlug) === "string" && apiSlug.trim() !== ""
            ? apiSlug.trim()
            : GLOBAL_KEY,
        fromLang: matchValue([GLOBAL_KEY, ...fromLangs], fromLang),
        toLang: matchValue([GLOBAL_KEY, ...toLangs], toLang),
        textStyle:
          type(textStyle) === "string" && textStyle.trim() !== ""
            ? textStyle.trim()
            : GLOBAL_KEY,
        wrapOriginal: matchValue(
          [GLOBAL_KEY, "true", "false"],
          [GLOBAL_KEY, "true", "false"].includes(wrapOriginal)
            ? wrapOriginal
            : pattern.trim() === GLOBAL_KEY
              ? GLOBLA_RULE.wrapOriginal
              : GLOBAL_KEY
        ),
        originalTextStyle:
          type(originalTextStyle) === "string" &&
          originalTextStyle.trim() !== ""
            ? originalTextStyle.trim()
            : pattern.trim() === GLOBAL_KEY
              ? GLOBLA_RULE.originalTextStyle
              : GLOBAL_KEY,
        transOpen: matchValue([GLOBAL_KEY, "true", "false"], transOpen),
        transOnly: matchValue([GLOBAL_KEY, "true", "false"], transOnly),
        transOnlyRevert: matchValue(
          [GLOBAL_KEY, "true", "false"],
          transOnlyRevert
        ),
        transOnlyRevertDelay:
          type(transOnlyRevertDelay) === "string" &&
          !isNaN(parseFloat(transOnlyRevertDelay))
            ? transOnlyRevertDelay
            : GLOBAL_KEY,
        transOrder: matchValue(
          [GLOBAL_KEY, "original-first", "translation-first"],
          transOrder
        ),
        autoScan: matchValue([GLOBAL_KEY, "true", "false"], autoScan),
        hasRichText: matchValue([GLOBAL_KEY, "true", "false"], hasRichText),
        hasShadowroot: matchValue([GLOBAL_KEY, "true", "false"], hasShadowroot),
        scanAll: matchValue([GLOBAL_KEY, "true", "false"], scanAll),
        isPlainText: matchValue([GLOBAL_KEY, "true", "false"], isPlainText),
        transTag: matchValue([GLOBAL_KEY, "span", "font"], transTag),
        transTitle: matchValue([GLOBAL_KEY, "true", "false"], transTitle),
        splitParagraph: matchValue(
          [GLOBAL_KEY, ...OPT_SPLIT_PARAGRAPH_ALL],
          splitParagraph
        ),
        splitLength: Number.isInteger(splitLength) ? splitLength : 0,
      })
    );

  return rules;
};

const RULE_SELECTOR_FIELDS = [
  "selector",
  "keepSelector",
  "blockSelector",
  "rootsSelector",
  "ignoreSelector",
];

const ruleHasConcreteSetting = (rule) =>
  Object.keys(rule).some(
    (key) =>
      key !== "pattern" && rule[key] !== GLOBAL_KEY && rule[key] !== undefined
  );

/** Apply a popup edit without mutating either the request or stored rules. */
const applySavedRule = (rules, curRule) => {
  const index = rules.findIndex(
    (item) =>
      item.pattern !== GLOBAL_KEY &&
      (item.pattern === curRule.pattern ||
        (item.pattern.startsWith("hostname:")
          ? matchesRulePattern(`https://${curRule.pattern}`, item.pattern)
          : isMatch(curRule.pattern, item.pattern)))
  );

  const remaining = rules.filter((_, ruleIndex) => ruleIndex !== index);
  const rule = rules[index];
  const globalRule = {
    ...GLOBLA_RULE,
    ...(rules.find((item) => item.pattern === GLOBAL_KEY) || {}),
  };
  const next = { ...(rule || {}), pattern: rule?.pattern || curRule.pattern };

  // 只写调用方带来的字段。没给的键保持原样，不再铺成整份 DEFAULT_RULE。
  Object.keys(curRule || {}).forEach((key) => {
    if (key === "pattern") return;
    if (rule && RULE_SELECTOR_FIELDS.includes(key)) return;
    if (
      key === "transOpen" &&
      Object.prototype.hasOwnProperty.call(curRule, "transOpen") &&
      isSiteTransOpen(curRule.transOpen)
    ) {
      next.transOpen = curRule.transOpen;
      return;
    }
    const value = curRule[key];
    next[key] = !value || value === globalRule[key] ? DEFAULT_RULE[key] : value;
  });

  // 跟随全局之后如果没有任何非 * 字段，删掉这条，不留全 * 的空壳。
  if (!ruleHasConcreteSetting(next)) return remaining;
  return [next, ...remaining];
};

/** Persist the edit and its metadata before starting synchronization. */
export const saveRule = async (curRule) => {
  if (curRule && Object.prototype.hasOwnProperty.call(curRule, "transOpen")) {
    siteTransOpenValue(curRule.transOpen);
  }
  await saveEdit(STOKEY_RULES, (rules) => applySavedRule(rules, curRule));
  trySyncRules();
};

/** save_rule 的消息响应。非法 transOpen 放进 error，不能当成保存成功。 */
export async function saveRuleMessage(curRule) {
  try {
    await saveRule(curRule);
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

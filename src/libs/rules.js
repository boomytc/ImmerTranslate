/**
 * @file rules.js
 * @description 翻译规则引擎。提供选择器的继承与差分算法（如支持加减号追加/剔除选择器）、内置规则与个人规则合并（个人规则覆盖内置规则，内置规则覆盖全局规则）以及规则数据的健全性清洗校验与保存。
 */

import selectorParser from "postcss-selector-parser";
import { matchValue, type } from "./utils";
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
import {
  matchesSiteEntry,
  parseHostEntry,
  rulePatternIndex,
} from "./siteMatch";
import { getDomainOptions } from "./url";

/**
 * 规范化单个 CSS 选择器的引号与空白，仅用于差分合并时的等价判定与去重，
 * 不改写原始选择器的语义或属性值。
 */
function normalizeSelectorKey(selector) {
  try {
    return selectorParser((root) => {
      root.walk((node) => {
        if (node.spaces) {
          node.spaces.before = "";
          node.spaces.after = "";
        }
        if (node.raws) {
          delete node.raws.spaces;
        }
        if (node.type === "combinator") {
          node.value = node.value.trim() || " ";
          if (node.raws) delete node.raws.value;
        } else if (node.type === "attribute") {
          if (node.spaces) {
            node.spaces.attribute = {};
            node.spaces.operator = {};
            node.spaces.value = {};
            node.spaces.insensitive = {};
          }
          if (node.value !== undefined) {
            node.setValue(node.value, { quoteMark: '"' });
          }
        }
      });
    })
      .processSync(selector)
      .trim();
  } catch {
    return selector.replace(/\s+/g, " ").trim();
  }
}

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

  // 纯覆盖模式：按规范化键去重，同时保留用户原始写法
  if (!isPatchMode) {
    const deduped = new Map();
    userList.forEach((selector) => {
      const key = normalizeSelectorKey(selector);
      if (!deduped.has(key)) {
        deduped.set(key, selector);
      }
    });
    return [...deduped.values()].join(", ");
  }

  // 补丁差分模式（保持粘性 currentMode 契约，按规范化键匹配引号/空白差异）
  const finalMap = new Map();
  defaultList.forEach((selector) => {
    const key = normalizeSelectorKey(selector);
    if (!finalMap.has(key)) {
      finalMap.set(key, selector);
    }
  });
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

    const key = normalizeSelectorKey(selector);
    if (currentMode === "remove") {
      finalMap.delete(key); // 剔除选择器
    } else if (!finalMap.has(key)) {
      finalMap.set(key, selector); // 追加选择器
    }
  });

  return [...finalMap.values()].join(", ");
}

/**
 * 在给定的规则列表中，依据当前的 URL 匹配适合的规则
 * @param {Array<Object>} rules 待遍历的规则数组
 * @param {string} href 当前页面的完整 URL (如 location.href)
 * @returns {Object|undefined} 匹配到的首条规则，未匹配返回 undefined
 */
export const matchesRulePattern = (href, pattern) => {
  return pattern.split(/\n|,/).some((part) => {
    const value = part.trim();
    if (!value) return false;
    if (value.startsWith("hostname:")) {
      const host = value.slice("hostname:".length);
      const parsed = parseHostEntry(host);
      if (!parsed || parsed.wildcard) return false;
      try {
        if (!["http:", "https:"].includes(new URL(href).protocol)) return false;
      } catch {
        return false;
      }
      return matchesSiteEntry(href, host);
    }
    return matchesSiteEntry(href, value);
  });
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

/** 当前主机。已有等价域名写法时沿用那条 pattern。 */
export function siteRulePattern(href, rules) {
  const pattern = getDomainOptions(href)[0] || "";
  const eligible = (Array.isArray(rules) ? rules : []).filter(
    (rule) => rule?.enabled !== false
  );
  const existing = eligible[rulePatternIndex(eligible, pattern)];
  return existing?.pattern || pattern;
}

/**
 * 网站翻译服务写到正在生效的个人规则上。
 * 没有个人规则时新建当前主机规则。
 */
export function siteServicePattern(href, rules) {
  const list = Array.isArray(rules) ? rules : [];
  const matched = findMatchingRule(list, href);
  if (typeof matched?.pattern === "string" && matched.pattern !== GLOBAL_KEY) {
    return matched.pattern;
  }
  return siteRulePattern(href, list);
}

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

  // 4. 合并数字数值类型属性（transOnlyRevertDelay 允许 0，splitLength=0 表示继承）
  if (overrideRule.splitLength && overrideRule.splitLength !== GLOBAL_KEY) {
    merged.splitLength = overrideRule.splitLength;
  }
  if (
    overrideRule.transOnlyRevertDelay === 0 ||
    (overrideRule.transOnlyRevertDelay &&
      overrideRule.transOnlyRevertDelay !== GLOBAL_KEY)
  ) {
    merged.transOnlyRevertDelay = overrideRule.transOnlyRevertDelay;
  }

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
    ? personalRules[rulePatternIndex(personalRules, sitePattern)]
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
export const checkRules = (rules, { ensureGlobal = false } = {}) => {
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
      // 过滤掉空 pattern 或 pattern 重复的规则
      const trimmed = type(pattern) === "string" ? pattern.trim() : "";
      if (!trimmed || patternSet.has(trimmed)) {
        return false;
      }
      patternSet.add(trimmed);
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
      }) => {
        const trimmedPattern = pattern.trim();
        const isGlobal = trimmedPattern === GLOBAL_KEY;
        const pickEnum = (allowed, value, globalFallback) => {
          if (isGlobal) {
            return allowed.includes(value) ? value : globalFallback;
          }
          return matchValue([GLOBAL_KEY, ...allowed], value);
        };
        const delayStr =
          typeof transOnlyRevertDelay === "number" &&
          Number.isFinite(transOnlyRevertDelay)
            ? String(transOnlyRevertDelay)
            : transOnlyRevertDelay;

        return {
          // 确保字段类型及取值的合法性，不合法或空值时回退到默认占位符或全局默认值
          pattern: trimmedPattern,
          enabled: isGlobal
            ? true
            : type(enabled) === "boolean"
              ? enabled
              : true,
          selector:
            type(selector) === "string" && (selector.trim() || !isGlobal)
              ? selector
              : isGlobal
                ? GLOBLA_RULE.selector
                : "",
          keepSelector: type(keepSelector) === "string" ? keepSelector : "",
          blockSelector: type(blockSelector) === "string" ? blockSelector : "",
          rootsSelector:
            type(rootsSelector) === "string" &&
            (rootsSelector.trim() || !isGlobal)
              ? rootsSelector
              : isGlobal
                ? GLOBLA_RULE.rootsSelector
                : "",
          ignoreSelector:
            type(ignoreSelector) === "string" ? ignoreSelector : "",
          terms: type(terms) === "string" ? terms : "",
          aiTerms: type(aiTerms) === "string" ? aiTerms : "",
          termsStyle: type(termsStyle) === "string" ? termsStyle : "",
          highlightStyle:
            type(highlightStyle) === "string" ? highlightStyle : "",
          textExtStyle: type(textExtStyle) === "string" ? textExtStyle : "",
          selectStyle: type(selectStyle) === "string" ? selectStyle : "",
          parentStyle: type(parentStyle) === "string" ? parentStyle : "",
          grandStyle: type(grandStyle) === "string" ? grandStyle : "",
          injectCss: type(injectCss) === "string" ? injectCss : "",
          apiSlug:
            type(apiSlug) === "string" &&
            apiSlug.trim() !== "" &&
            (!isGlobal || apiSlug.trim() !== GLOBAL_KEY)
              ? apiSlug.trim()
              : isGlobal
                ? GLOBLA_RULE.apiSlug
                : GLOBAL_KEY,
          fromLang: pickEnum(fromLangs, fromLang, GLOBLA_RULE.fromLang),
          toLang: pickEnum(toLangs, toLang, GLOBLA_RULE.toLang),
          textStyle:
            type(textStyle) === "string" &&
            textStyle.trim() !== "" &&
            (!isGlobal || textStyle.trim() !== GLOBAL_KEY)
              ? textStyle.trim()
              : isGlobal
                ? GLOBLA_RULE.textStyle
                : GLOBAL_KEY,
          wrapOriginal: pickEnum(
            ["true", "false"],
            wrapOriginal,
            GLOBLA_RULE.wrapOriginal
          ),
          originalTextStyle:
            type(originalTextStyle) === "string" &&
            originalTextStyle.trim() !== "" &&
            (!isGlobal || originalTextStyle.trim() !== GLOBAL_KEY)
              ? originalTextStyle.trim()
              : isGlobal
                ? GLOBLA_RULE.originalTextStyle
                : GLOBAL_KEY,
          transOpen: pickEnum(
            ["true", "false"],
            transOpen,
            GLOBLA_RULE.transOpen
          ),
          transOnly: pickEnum(
            ["true", "false"],
            transOnly,
            GLOBLA_RULE.transOnly
          ),
          transOnlyRevert: pickEnum(
            ["true", "false"],
            transOnlyRevert,
            GLOBLA_RULE.transOnlyRevert
          ),
          transOnlyRevertDelay:
            type(delayStr) === "string" &&
            delayStr.trim() !== "" &&
            Number.isFinite(parseFloat(delayStr))
              ? delayStr.trim()
              : isGlobal
                ? GLOBLA_RULE.transOnlyRevertDelay
                : GLOBAL_KEY,
          transOrder: pickEnum(
            ["original-first", "translation-first"],
            transOrder,
            GLOBLA_RULE.transOrder
          ),
          autoScan: pickEnum(["true", "false"], autoScan, GLOBLA_RULE.autoScan),
          hasRichText: pickEnum(
            ["true", "false"],
            hasRichText,
            GLOBLA_RULE.hasRichText
          ),
          hasShadowroot: pickEnum(
            ["true", "false"],
            hasShadowroot,
            GLOBLA_RULE.hasShadowroot
          ),
          scanAll: pickEnum(["true", "false"], scanAll, GLOBLA_RULE.scanAll),
          isPlainText: pickEnum(
            ["true", "false"],
            isPlainText,
            GLOBLA_RULE.isPlainText
          ),
          transTag: pickEnum(["span", "font"], transTag, GLOBLA_RULE.transTag),
          transTitle: pickEnum(
            ["true", "false"],
            transTitle,
            GLOBLA_RULE.transTitle
          ),
          splitParagraph: pickEnum(
            OPT_SPLIT_PARAGRAPH_ALL,
            splitParagraph,
            GLOBLA_RULE.splitParagraph
          ),
          splitLength:
            Number.isInteger(splitLength) && splitLength > 0
              ? splitLength
              : isGlobal
                ? GLOBLA_RULE.splitLength
                : 0,
        };
      }
    );

  if (ensureGlobal && !patternSet.has(GLOBAL_KEY)) {
    rules.push({ ...GLOBLA_RULE });
  }

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
  const index =
    curRule.pattern === GLOBAL_KEY
      ? -1
      : rulePatternIndex(rules, curRule.pattern);

  const remaining = rules.filter((_, ruleIndex) => ruleIndex !== index);
  const rule = rules[index];
  // Quick saves cannot take effect while the selected rule is disabled.
  if (rule?.enabled === false) throw new Error("rule-disabled");
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
    next[key] =
      value === undefined || value === null || value === ""
        ? DEFAULT_RULE[key]
        : value;
  });

  // 跟随全局之后如果没有任何非 * 字段，删掉这条，不留全 * 的空壳。
  if (!ruleHasConcreteSetting(next)) return remaining;
  if (index < 0) return [next, ...rules];
  return rules.map((item, ruleIndex) => (ruleIndex === index ? next : item));
};

/** Persist the edit and its metadata before starting synchronization. */
export const saveRule = async (curRule) => {
  if (curRule && Object.prototype.hasOwnProperty.call(curRule, "transOpen")) {
    siteTransOpenValue(curRule.transOpen);
  }
  await saveEdit(STOKEY_RULES, (rules) => applySavedRule(rules, curRule));
  trySyncRules();
};

/** 把当前页的翻译服务记到正在生效的网站规则上。 */
export const saveSiteApiSlug = async (href, apiSlug) => {
  const slug = typeof apiSlug === "string" ? apiSlug.trim() : "";
  if (typeof href !== "string" || !href || !slug || slug === GLOBAL_KEY) {
    throw new Error("invalid-api-slug");
  }
  await saveEdit(STOKEY_RULES, (rules) => {
    if (!Array.isArray(rules)) return rules;
    const pattern = siteServicePattern(href, rules);
    if (!pattern || pattern === GLOBAL_KEY) return rules;
    return applySavedRule(rules, { pattern, apiSlug: slug });
  });
  trySyncRules();
};

/** save_rule 的消息响应。非法 transOpen 放进 error，不能当成保存成功。 */
export async function saveRuleMessage(curRule) {
  try {
    if (curRule?.rememberApiSlug === true) {
      await saveSiteApiSlug(curRule.href, curRule.apiSlug);
      return;
    }
    await saveRule(curRule);
  } catch (error) {
    return { error: error?.message || String(error) };
  }
}

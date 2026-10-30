import { GLOBAL_KEY, MSG_SAVE_RULE } from "../../config";
import { isExt } from "../../libs/client";
import { sendBgMsg } from "../../libs/msg";
import { findMatchingRule, saveRule } from "../../libs/rules";
import { rulePatternIndex } from "../../libs/siteMatch";
import { SITE_TRANS_OPEN, siteTransOpenValue } from "../../libs/siteTransOpen";
import { getDomainOptions } from "../../libs/url";

export { SITE_TRANS_OPEN };

/** Values shown by the current-site control, in menu order. */
export const SITE_TRANS_OPEN_OPTIONS = [
  { value: SITE_TRANS_OPEN.FOLLOW_GLOBAL, labelKey: "site_trans_follow" },
  { value: SITE_TRANS_OPEN.AUTO_TRANSLATE, labelKey: "site_trans_on" },
  { value: SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE, labelKey: "site_trans_off" },
];

/**
 * 本页个人规则的 transOpen。
 * 没有匹配的个人规则，或匹配规则没有 transOpen 键，都是跟随全局 `*`
 * （与规则合并里空值继续继承一致）。
 * 有 transOpen 键但值不是 `*` / `"true"` / `"false"` 时抛错，不能读成跟随。
 */
export function readSiteTransOpen(href, rules, pattern) {
  const list = Array.isArray(rules) ? rules : [];
  const eligible = list.filter(
    (rule) => rule?.pattern !== GLOBAL_KEY && rule?.enabled !== false
  );
  const matched = pattern
    ? eligible[rulePatternIndex(eligible, pattern)]
    : typeof findMatchingRule === "function"
      ? findMatchingRule(list, href)
      : undefined;
  if (!matched) return SITE_TRANS_OPEN.FOLLOW_GLOBAL;
  if (!Object.prototype.hasOwnProperty.call(matched, "transOpen")) {
    return SITE_TRANS_OPEN.FOLLOW_GLOBAL;
  }
  return siteTransOpenValue(matched.transOpen);
}

/**
 * Default to the exact current host, retaining an existing equivalent alias.
 * A wider scope is used only when the caller explicitly selects it.
 */
export function siteRulePattern(href, rules) {
  const pattern = getDomainOptions(href)[0] || "";
  const eligible = (rules || []).filter((rule) => rule?.enabled !== false);
  const existing = eligible[rulePatternIndex(eligible, pattern)];
  return existing?.pattern || pattern;
}

/**
 * 本站开关只写选定范围：默认当前主机，调用方也可明确选用宽范围。
 */
export function sitePolicyRecord(href, rules, transOpen, pattern) {
  const resolved = pattern || siteRulePattern(href, rules);
  if (!resolved || resolved === GLOBAL_KEY) return null;
  return { pattern: resolved, transOpen: siteTransOpenValue(transOpen) };
}

export async function writeSiteTransOpen(
  href,
  transOpen,
  rules,
  { throughBackground = isExt, pattern } = {}
) {
  const record = sitePolicyRecord(href, rules, transOpen, pattern);
  if (!record) return null;
  if (throughBackground) return sendBgMsg(MSG_SAVE_RULE, record);
  return saveRule(record);
}

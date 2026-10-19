import { GLOBAL_KEY, MSG_SAVE_RULE } from "../../config";
import { isExt } from "../../libs/client";
import { sendBgMsg } from "../../libs/msg";
import { findMatchingRule, saveRule } from "../../libs/rules";
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
export function readSiteTransOpen(href, rules) {
  const matched =
    typeof findMatchingRule === "function"
      ? findMatchingRule(rules || [], href)
      : undefined;
  if (!matched) return SITE_TRANS_OPEN.FOLLOW_GLOBAL;
  if (!Object.prototype.hasOwnProperty.call(matched, "transOpen")) {
    return SITE_TRANS_OPEN.FOLLOW_GLOBAL;
  }
  return siteTransOpenValue(matched.transOpen);
}

/**
 * Pattern saveRule should update: the personal rule that already matches
 * this page, or the current host when no personal rule exists yet.
 */
export function siteRulePattern(href, rules) {
  const matched =
    typeof findMatchingRule === "function"
      ? findMatchingRule(rules || [], href)?.pattern
      : undefined;
  return matched || getDomainOptions(href)[0] || "";
}

/**
 * 本站开关只写这一条记录：已有个人规则就改它，否则用当前主机名新建一条。
 * 不另选下拉框里的宽模式，避免同一次切换再落一条规则。
 */
export function sitePolicyRecord(href, rules, transOpen) {
  const pattern = siteRulePattern(href, rules);
  if (!pattern || pattern === GLOBAL_KEY) return null;
  return { pattern, transOpen: siteTransOpenValue(transOpen) };
}

export async function writeSiteTransOpen(
  href,
  transOpen,
  rules,
  { throughBackground = isExt } = {}
) {
  const record = sitePolicyRecord(href, rules, transOpen);
  if (!record) return null;
  if (throughBackground) return sendBgMsg(MSG_SAVE_RULE, record);
  return saveRule(record);
}

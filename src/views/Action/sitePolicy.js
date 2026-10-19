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
 * Personal-rule transOpen for this page.
 * `*` follows the global rule; missing or unknown values do the same.
 */
export function readSiteTransOpen(href, rules) {
  const matched =
    typeof findMatchingRule === "function"
      ? findMatchingRule(rules || [], href)
      : undefined;
  // 没有个人规则才是跟随全局。匹配到的规则缺值或值非法必须报错，
  // 不能把「不自动翻译」和坏数据都读成「*」。
  if (!matched) return SITE_TRANS_OPEN.FOLLOW_GLOBAL;
  if (!Object.prototype.hasOwnProperty.call(matched, "transOpen")) {
    throw new TypeError("Site rule is missing transOpen");
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

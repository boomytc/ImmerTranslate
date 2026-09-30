import { GLOBAL_KEY } from "../../config";
import { findMatchingRule } from "../../libs/rules";
import { getDomainOptions } from "../../libs/url";

const SITE_TRANS_OPEN = new Set([GLOBAL_KEY, "true", "false"]);

/** Values shown by the current-site control, in menu order. */
export const SITE_TRANS_OPEN_OPTIONS = [
  { value: GLOBAL_KEY, labelKey: "site_trans_follow" },
  { value: "true", labelKey: "site_trans_on" },
  { value: "false", labelKey: "site_trans_off" },
];

/**
 * Personal-rule transOpen for this page.
 * `*` follows the global rule; missing or unknown values do the same.
 */
export function readSiteTransOpen(href, rules) {
  const value = findMatchingRule(rules || [], href)?.transOpen;
  return SITE_TRANS_OPEN.has(value) ? value : GLOBAL_KEY;
}

/**
 * Pattern saveRule should update: the personal rule that already matches
 * this page, or the current host when no personal rule exists yet.
 */
export function siteRulePattern(href, rules) {
  return (
    findMatchingRule(rules || [], href)?.pattern ||
    getDomainOptions(href)[0] ||
    ""
  );
}

import {
  EVENT_KISS_INNER,
  GLOBAL_KEY,
  MSG_SAVE_RULE,
  MSG_TRANS_CURRULE,
} from "../config";
import { browser } from "./browser";
import { isExt } from "./client";
import { sendBgMsg } from "./msg";
import { findMatchingRule, saveRule } from "./rules";
import { getRulesWithDefault } from "./storage";
import { getDomainOptions } from "./url";

/**
 * Fields both the toolbar/content popup and the FAB already change through
 * MSG_TRANS_PUTRULE / MSG_TRANS_TOGGLE / MSG_TRANS_TOGGLE_STYLE.
 * Advanced-only popup fields stay session-local.
 */
export const SHARED_PAGE_RULE_FIELDS = Object.freeze([
  "apiSlug",
  "transOnly",
  "fromLang",
  "toLang",
  "textStyle",
  "transOpen",
]);

export function pickSharedRulePatch(values) {
  const patch = {};
  if (!values || typeof values !== "object") return patch;
  for (const key of SHARED_PAGE_RULE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    const value = values[key];
    if (value == null || value === "") continue;
    patch[key] = value;
  }
  return patch;
}

/**
 * Effective page translation is only "true" or "false".
 * Site policy "*" follows the global rule; anything else falls back to off,
 * matching GLOBLA_RULE.transOpen.
 */
export function effectiveTransOpen(siteTransOpen, globalTransOpen) {
  if (siteTransOpen === "true" || siteTransOpen === "false") {
    return siteTransOpen;
  }
  if (globalTransOpen === "true" || globalTransOpen === "false") {
    return globalTransOpen;
  }
  return "false";
}

/** Tell open popups and FABs in this document, and the toolbar popup, the current rule. */
export function publishPageRule(response) {
  if (!response?.rule || typeof document === "undefined") return;
  const detail = {
    action: MSG_TRANS_CURRULE,
    rule: response.rule,
    isTopFrame: response.isTopFrame,
    document: response.document,
  };
  document.dispatchEvent(new CustomEvent(EVENT_KISS_INNER, { detail }));
  if (!isExt || typeof browser?.runtime?.sendMessage !== "function") return;
  Promise.resolve(
    browser.runtime.sendMessage({ action: MSG_TRANS_CURRULE, args: detail })
  ).catch(() => {});
}

/**
 * Persist a shared patch on the personal rule for this page so a refresh
 * rebuilds the same effective rule. Values equal to the global rule are
 * stored as "*" by saveRule; the effective value stays the same.
 */
export async function persistSharedSiteRule(
  patch,
  href = globalThis.location?.href || ""
) {
  const fields = pickSharedRulePatch(patch);
  if (!Object.keys(fields).length || !href) return undefined;
  const rules = await getRulesWithDefault();
  const pattern =
    findMatchingRule(rules, href)?.pattern || getDomainOptions(href)[0] || "";
  if (!pattern || pattern === GLOBAL_KEY) return undefined;
  const saved = { pattern, ...fields };
  if (isExt) return sendBgMsg(MSG_SAVE_RULE, saved);
  return saveRule(saved);
}

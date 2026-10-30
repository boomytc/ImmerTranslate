import {
  DEFAULT_RULE,
  KV_RULES_KEY,
  MSG_EDIT_RULE,
  STOKEY_RULES,
} from "../config";
import {
  checkRules,
  findMatchingRule,
  hostnamePattern,
  matchesRulePattern,
  deriveRuleContext,
} from "./rules";
import { SELECTOR_FIELDS, splitSelectorList } from "./selectorList";
import { withTransaction } from "./storage";
import { trySyncRules } from "./sync";
import { isExt } from "./client";
import { sendBgMsg } from "./msg";
import { getDomainOptions } from "./url";
import { rulePatternIndex, sameRulePattern } from "./siteMatch";

const EDITABLE_FIELDS = [...SELECTOR_FIELDS, "autoScan", "pattern"];
let writeQueue = Promise.resolve();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// In extensions this queue lives in the background, shared by all editor tabs.
export function writeSiteRule({
  href,
  patch,
  expected,
  seed = null,
  inherited,
}) {
  const timestamp = Date.now();
  const write = async () => {
    hostnamePattern(href);
    const defaultPattern = getDomainOptions(href)[0];
    const previousPattern = expected?.pattern || defaultPattern;
    if (previousPattern === "*") throw new Error("invalid-pattern");
    const rawPattern = patch?.pattern ?? previousPattern;
    if (typeof rawPattern !== "string") throw new Error("invalid-patch");
    const pattern = rawPattern.trim();
    const keys = Object.keys(patch || {});
    if (!keys.length || keys.some((key) => !EDITABLE_FIELDS.includes(key))) {
      throw new Error("invalid-patch");
    }
    for (const key of keys) {
      if (typeof patch[key] !== "string") throw new Error("invalid-patch");
      if (SELECTOR_FIELDS.includes(key)) splitSelectorList(patch[key]);
      else if (key === "pattern") {
        if (!pattern || pattern === "*") throw new Error("invalid-pattern");
      } else if (!["true", "false", "*"].includes(patch[key]))
        throw new Error("invalid-patch");
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const context = await withTransaction(async (transaction) => {
        const result = await transaction.saveEdit(
          STOKEY_RULES,
          (rules) => {
            const latest = deriveRuleContext(href, {
              personalRules: rules,
            });
            if (
              inherited &&
              keys.some((key) => latest.inherited[key] !== inherited[key])
            )
              throw new Error("rule-conflict");
            const index = rulePatternIndex(rules, previousPattern);
            if (
              rules.some(
                (rule, i) =>
                  i !== index && sameRulePattern(rule.pattern, pattern)
              )
            )
              throw new Error("duplicate-pattern");
            const current = index < 0 ? null : rules[index];
            const active = findMatchingRule(rules, href) || null;
            if (!current) {
              if (expected || !same(active, seed))
                throw new Error("rule-conflict");
            } else if (
              !expected ||
              current.enabled === false ||
              (matchesRulePattern(href, current.pattern) &&
                !sameRulePattern(active?.pattern, previousPattern)) ||
              keys.some(
                (key) =>
                  (current[key] ?? DEFAULT_RULE[key]) !==
                  (expected[key] ?? DEFAULT_RULE[key])
              )
            ) {
              throw new Error("rule-conflict");
            }
            // Preserve unrelated fields from the latest rule and its priority.
            const saved = checkRules([
              {
                ...DEFAULT_RULE,
                ...(current || seed),
                ...patch,
                pattern,
                enabled: true,
              },
            ])[0];
            const next = [...rules];
            if (index < 0) next.unshift(saved);
            else next[index] = saved;
            return next;
          },
          KV_RULES_KEY,
          { timestamp }
        );
        return deriveRuleContext(
          href,
          { personalRules: result.value },
          pattern
        );
      });
      if (!context) continue;
      trySyncRules();
      return context;
    }
    throw new Error("rule-conflict");
  };
  const result = writeQueue.then(write);
  writeQueue = result.catch(() => {});
  return result;
}

export const saveSiteRule = (request) =>
  isExt ? sendBgMsg(MSG_EDIT_RULE, request) : writeSiteRule(request);

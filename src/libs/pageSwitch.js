import {
  SITE_TRANS_OPEN,
  sitePolicyValue,
  siteTransOpenValue,
} from "./siteTransOpen";

/** 页面翻译的唯一有效状态。 */
export const PAGE_SWITCH = Object.freeze({
  PAUSED: "paused",
  ON: "on",
  OFF: "off",
});

const SWITCH_VALUES = new Set([PAGE_SWITCH.ON, PAGE_SWITCH.OFF]);

export function isPageSwitch(value) {
  return value === PAGE_SWITCH.PAUSED || SWITCH_VALUES.has(value);
}

/**
 * 本页这一次手动开关。
 * 只在同一网址、且记录时的站点策略 transOpen 没变时生效。
 * 命中黑名单不会清掉它；策略一变，或换了网址，调用方继续拿着它也等于作废。
 */
export class ManualOverride {
  #url;
  #ruleTransOpen;
  #value;

  constructor(url, ruleTransOpen, value) {
    if (typeof url !== "string" || url === "") {
      throw new TypeError("Manual override requires the page url");
    }
    if (!SWITCH_VALUES.has(value)) {
      throw new TypeError(
        `Manual override must be on or off, received ${String(value)}`
      );
    }
    this.#url = url;
    this.#ruleTransOpen = siteTransOpenValue(ruleTransOpen);
    this.#value = value;
    Object.freeze(this);
  }

  applies(url, ruleTransOpen) {
    return this.#url === url && this.#ruleTransOpen === ruleTransOpen;
  }

  get url() {
    return this.#url;
  }

  get ruleTransOpen() {
    return this.#ruleTransOpen;
  }

  get value() {
    return this.#value;
  }
}

function followedTransOpen(globalTransOpen) {
  return globalTransOpen === SITE_TRANS_OPEN.AUTO_TRANSLATE
    ? SITE_TRANS_OPEN.AUTO_TRANSLATE
    : SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE;
}

/**
 * 由存储里的站点策略、当前网址、黑名单和本页手动覆盖推出唯一状态。
 * `*` 跟随全局；`"true"` 开；`"false"` 关。两者不会互相当成对方。
 * 没有规则时不能套用手动覆盖。
 */
export function pageSwitchState({
  rule,
  policy: sitePolicy,
  href,
  blacklistHit,
  override = null,
  globalTransOpen = SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE,
}) {
  if (blacklistHit) return PAGE_SWITCH.PAUSED;
  if (!rule) return PAGE_SWITCH.OFF;
  const policy = sitePolicyValue(sitePolicy);
  if (override instanceof ManualOverride && override.applies(href, policy)) {
    return override.value;
  }
  const effective =
    policy === SITE_TRANS_OPEN.FOLLOW_GLOBAL
      ? followedTransOpen(globalTransOpen)
      : policy;
  return effective === SITE_TRANS_OPEN.AUTO_TRANSLATE
    ? PAGE_SWITCH.ON
    : PAGE_SWITCH.OFF;
}

/** 纯函数算出要写进管理器的目标。调用方只应用它，不再各自记一份开关。 */
export function pageTarget({
  rule,
  policy,
  href,
  blacklistHit,
  override = null,
  globalTransOpen,
  setting = null,
}) {
  const state = pageSwitchState({
    rule,
    policy,
    href,
    blacklistHit,
    override,
    globalTransOpen,
  });
  const transOpen =
    state === PAGE_SWITCH.ON
      ? SITE_TRANS_OPEN.AUTO_TRANSLATE
      : SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE;
  return {
    state,
    rule: { ...(rule || {}), transOpen },
    setting,
  };
}

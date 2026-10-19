import { GLOBAL_KEY } from "../config";

/**
 * 本站翻译策略。三个值都要原样落库：
 * `*` 跟随全局，`"true"` 自动翻译，`"false"` 不自动翻译。
 * `"false"` 即使和当前全局相同也不能收成 `*`，否则以后改全局会把本站一起改掉。
 */
export const SITE_TRANS_OPEN = Object.freeze({
  FOLLOW_GLOBAL: GLOBAL_KEY,
  AUTO_TRANSLATE: "true",
  DONT_AUTO_TRANSLATE: "false",
});

const SITE_TRANS_OPEN_VALUES = new Set(Object.values(SITE_TRANS_OPEN));

export function isSiteTransOpen(value) {
  return SITE_TRANS_OPEN_VALUES.has(value);
}

/** 只接受枚举。布尔和空值不是策略，调用方必须先选好枚举再写入。 */
export function siteTransOpenValue(policy) {
  if (!isSiteTransOpen(policy)) {
    throw new TypeError(`Unknown site translation policy: ${String(policy)}`);
  }
  return policy;
}

const SITE_POLICY_BRAND = Symbol("SitePolicy");

/**
 * 站点策略。只有这里能把枚举包成页面开关认的值。
 * 折叠后的 matchRule.transOpen 是生效开关，不能拿来当策略。
 */
export function sitePolicy(value) {
  const policy = siteTransOpenValue(value);
  return Object.freeze({
    [SITE_POLICY_BRAND]: true,
    value: policy,
  });
}

export function sitePolicyValue(policy) {
  if (!policy || policy[SITE_POLICY_BRAND] !== true) {
    throw new TypeError(
      "Site policy must be created with sitePolicy(), not a folded rule transOpen"
    );
  }
  return policy.value;
}

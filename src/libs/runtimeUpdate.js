/**
 * 套用到运行中页面的一次更新。
 * fields 是选择器等规则字段，policy 只在本站 transOpen 真的变化时出现，
 * setting 是按当前网址折过功能黑名单的设置，内容没变则为 null。
 */
export function ruleApplication({ previousTransOpen, rule, setting = null }) {
  const fields = { ...(rule || {}) };
  const transOpen = fields.transOpen;
  delete fields.transOpen;
  const policy =
    (transOpen === "true" || transOpen === "false") &&
    transOpen !== previousTransOpen
      ? { transOpen }
      : null;
  return { fields, policy, setting };
}

/**
 * 把一次更新作用到运行中的翻译器。
 * 没有 policy 时保留当前开关，只写入规则字段。
 */
export function applyRuleUpdate({
  liveTransOpen,
  fields,
  policy,
  updateRule,
  disable,
  enable,
}) {
  const nextTransOpen = policy ? policy.transOpen : liveTransOpen;
  const nextRule = { ...fields, transOpen: nextTransOpen };
  if (policy && liveTransOpen === "true" && nextTransOpen !== "true") {
    disable?.();
  }
  updateRule?.(nextRule);
  if (policy && liveTransOpen !== "true" && nextTransOpen === "true") {
    enable?.();
  }
  return nextRule;
}

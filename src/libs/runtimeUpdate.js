/**
 * 套用到运行中页面的一次更新。
 * fields 是选择器等规则字段，policy 只在本站 transOpen 真的变化时出现，
 * setting 是设置字段和三个功能开关的变化；内容没变则为 null。
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

/**
 * 把折过功能黑名单的设置拆成字段和开关变化。
 * switches 只包含相对上次已套用设置真正变化的划词、输入、悬停开关。
 * 没变化的开关不出现，调用方保留页面上的运行时状态。
 */
export function settingApplication({ previous, setting }) {
  const tranbox = Boolean(setting?.tranboxSetting?.transOpen);
  const input = Boolean(setting?.inputRule?.transOpen);
  const hover = Boolean(setting?.mouseHoverSetting?.useMouseHover);
  const switches = {};
  if (tranbox !== Boolean(previous?.tranboxSetting?.transOpen)) {
    switches.tranbox = tranbox;
  }
  if (input !== Boolean(previous?.inputRule?.transOpen)) {
    switches.input = input;
  }
  if (hover !== Boolean(previous?.mouseHoverSetting?.useMouseHover)) {
    switches.hover = hover;
  }
  return { fields: setting, switches };
}

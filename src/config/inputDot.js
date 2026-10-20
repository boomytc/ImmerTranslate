// --- 输入框即时翻译图标(点)的显示策略 ---
export const OPT_INPUT_DOT_DISABLE = "-"; // 彻底不显示图标
export const OPT_INPUT_DOT_ALWAYS = "always"; // 始终显示在输入框边缘

// 旧版存储的 "mobile"（仅移动端）在桌面上本就隐藏，按隐藏处理。
export function isInputDotShown(showDot) {
  return (showDot || OPT_INPUT_DOT_ALWAYS) === OPT_INPUT_DOT_ALWAYS;
}

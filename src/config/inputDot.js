import { isMobile } from "../libs/mobile";

// --- 输入框即时翻译图标(点)的显示策略 ---
export const OPT_INPUT_DOT_DISABLE = "-"; // 彻底不显示图标
export const OPT_INPUT_DOT_MOBILE = "mobile"; // 仅在移动端浏览器中显示
export const OPT_INPUT_DOT_ALWAYS = "always"; // 始终显示在输入框边缘

export function isInputDotShown(showDot) {
  const mode = showDot || OPT_INPUT_DOT_ALWAYS;
  if (mode === OPT_INPUT_DOT_DISABLE) return false;
  if (mode === OPT_INPUT_DOT_MOBILE) {
    return isMobile || navigator.maxTouchPoints > 0;
  }
  return true;
}

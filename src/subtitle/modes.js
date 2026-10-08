import {
  OPT_ENHANCE_MOBILE_OFF,
  OPT_ENHANCE_OFF,
  OPT_ENHANCE_ON,
} from "../config";
import { isMobile } from "../libs/mobile.js";

/**
 * 规范化字幕增强模式
 * 只接受内部的增强状态常量，其它值统一降级为移动端关闭模式。
 *
 * @param {*} value - 输入的配置状态值
 * @returns {string} 规范化后的字幕增强模式常量值 (OPT_ENHANCE_ON / OPT_ENHANCE_OFF / OPT_ENHANCE_MOBILE_OFF)
 */
export function normalizeSubtitleMode(value) {
  if (
    value === OPT_ENHANCE_ON ||
    value === OPT_ENHANCE_OFF ||
    value === OPT_ENHANCE_MOBILE_OFF
  ) {
    return value;
  }

  return OPT_ENHANCE_MOBILE_OFF;
}

/**
 * 判断在当前设备运行环境下，字幕增强模式是否最终判定为启用。
 *
 * @param {*} value - 当前的配置值
 * @returns {boolean} true 表示启用增强功能，false 表示禁用
 */
export function isSubtitleModeEnabled(value) {
  const mode = normalizeSubtitleMode(value);

  // 判定启用的条件：
  // 1. 状态是全局开启 (OPT_ENHANCE_ON)；
  // 2. 或者状态是移动端关闭 (OPT_ENHANCE_MOBILE_OFF)，且当前运行环境判定为非移动端 (!isMobile)。
  return (
    mode === OPT_ENHANCE_ON || (mode === OPT_ENHANCE_MOBILE_OFF && !isMobile)
  );
}

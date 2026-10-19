import { isInBlacklist } from "./blacklist";

/**
 * 按当前网址折出划词、输入、悬停开关。
 * 不改入参；命中黑名单时只在返回的新对象上关掉对应开关。
 */
export function withFeatureBlacklists(setting, href) {
  const next = {
    ...(setting || {}),
    tranboxSetting: { ...(setting?.tranboxSetting || {}) },
    inputRule: { ...(setting?.inputRule || {}) },
    mouseHoverSetting: { ...(setting?.mouseHoverSetting || {}) },
  };
  if (isInBlacklist(href, next.tranboxSetting.blacklist)) {
    next.tranboxSetting.transOpen = false;
  }
  if (isInBlacklist(href, next.inputRule.blacklist)) {
    next.inputRule.transOpen = false;
  }
  if (isInBlacklist(href, next.mouseHoverSetting.blacklist)) {
    next.mouseHoverSetting.useMouseHover = false;
  }
  return next;
}

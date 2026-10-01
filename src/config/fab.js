import { isInBlacklist } from "../libs/blacklist";

export const FAB_MIN_OPACITY = 0.1;
export const FAB_MIN_SIZE = 24;
export const FAB_MAX_SIZE = 96;

export const FAB_SIZE_PRESETS = [
  { size: 36, label: "36px", labelKey: "fab_size_s" },
  { size: 48, label: "48px", labelKey: "fab_size_m" },
  { size: 56, label: "56px", labelKey: "fab_size_l" },
];

export const DEFAULT_FAB = {
  hideExceptionList: "",
  halfHide: true,
  opacity: 1,
  size: 56,
};

// Older stored configurations do not contain appearance preferences.
export function normalizeFabAppearance(config) {
  return {
    halfHide:
      typeof config?.halfHide === "boolean"
        ? config.halfHide
        : DEFAULT_FAB.halfHide,
    opacity:
      typeof config?.opacity === "number" && Number.isFinite(config.opacity)
        ? Math.min(1, Math.max(FAB_MIN_OPACITY, config.opacity))
        : DEFAULT_FAB.opacity,
    size:
      typeof config?.size === "number" && Number.isFinite(config.size)
        ? Math.round(
            Math.min(FAB_MAX_SIZE, Math.max(FAB_MIN_SIZE, config.size))
          )
        : DEFAULT_FAB.size,
  };
}

/**
 * 判断指定页面当前是否应当显示悬浮球。
 * 全局显示时：未在特例名单中则显示，在名单中则隐藏；
 * 全局隐藏时：在特例名单中则显示，未在名单中则隐藏。
 */
export function isFabVisible(href, fabConfig = {}) {
  const safeHref = typeof href === "string" ? href : "";
  const isGlobalHide = Boolean(fabConfig?.isHide);
  const isException = isInBlacklist(
    safeHref,
    fabConfig?.hideExceptionList || ""
  );
  return isGlobalHide ? isException : !isException;
}

import { matchesSiteEntry } from "../libs/siteMatch";

export const FAB_MIN_OPACITY = 0.1;
export const FAB_MIN_SIZE = 24;
export const FAB_MAX_SIZE = 96;

export const FAB_SIZE_PRESETS = [
  { size: 36, label: "36px", labelKey: "fab_size_s" },
  { size: 48, label: "48px", labelKey: "fab_size_m" },
  { size: 56, label: "56px", labelKey: "fab_size_l" },
];

export const DEFAULT_FAB = {
  isHide: false,
  hiddenSites: "",
  shownSites: "",
  halfHide: true,
  opacity: 1,
  size: 56,
};

let fabVisibilityHolds = 0;

/**
 * 撤销提示还挂在悬浮球组件上时，先挡住按配置销毁。
 * 调用方必须释放，否则其它标签页的显隐也不会落地。
 */
export function holdFabVisibility() {
  fabVisibilityHolds += 1;
  return function releaseFabVisibilityHold() {
    fabVisibilityHolds = Math.max(0, fabVisibilityHolds - 1);
  };
}

export function isFabVisibilityHeld() {
  return fabVisibilityHolds > 0;
}

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

function normalizeIsHide(value) {
  return typeof value === "boolean" ? value : DEFAULT_FAB.isHide;
}

function asSiteList(value) {
  return typeof value === "string" ? value : "";
}

/**
 * 悬浮球配置的唯一形状。全局显示看 hiddenSites，全局隐藏看 shownSites。
 */
export function normalizeFabConfig(config) {
  const source = config && typeof config === "object" ? { ...config } : {};
  delete source.hideExceptionList;
  return {
    ...source,
    ...normalizeFabAppearance(source),
    isHide: normalizeIsHide(source.isHide),
    hiddenSites: asSiteList(source.hiddenSites),
    shownSites: asSiteList(source.shownSites),
  };
}

export function splitFabSites(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function canonicalSiteEntry(href) {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const hostname = url.hostname.toLowerCase();
    if (!hostname) return "";
    return url.port ? `${hostname}:${url.port}` : hostname;
  } catch {
    return "";
  }
}

export function activeFabSiteList(config) {
  return normalizeFabConfig(config).isHide ? "shownSites" : "hiddenSites";
}

function withSiteList(config, key, entries) {
  return { ...config, [key]: entries.join("\n") };
}

function addSiteEntry(entries, entry) {
  if (!entry || entries.includes(entry)) return entries;
  return [...entries, entry];
}

/**
 * 把某个网址调成可见或不可见。只改当前全局状态下生效的那一份名单，
 * 因此再切全局开关时，两份名单的含义不会对调。
 */
export function applyFabSitePolicy(prev, href, visible) {
  const config = normalizeFabConfig(prev);
  const entry = canonicalSiteEntry(href);
  const key = activeFabSiteList(config);
  const entries = splitFabSites(config[key]);
  if (!entry) return config;

  const showByRemoving = !config.isHide && visible;
  const hideByRemoving = config.isHide && !visible;
  const next =
    showByRemoving || hideByRemoving
      ? entries.filter((item) => !matchesSiteEntry(href, item))
      : addSiteEntry(entries, entry);
  return withSiteList(config, key, next);
}

/**
 * 撤销「此站隐藏」时把当时删掉的条目放回去。没有删过条目时，
 * 退回 applyFabSitePolicy(..., true)，只去掉这次加进去的主机名。
 */
export function restoreRemovedFabSites(prev, href, removedEntries = []) {
  const config = normalizeFabConfig(prev);
  const removed = (removedEntries || []).filter(Boolean);
  if (!removed.length) return applyFabSitePolicy(config, href, true);
  const key = activeFabSiteList(config);
  const next = [...splitFabSites(config[key])];
  removed.forEach((entry) => {
    if (!next.includes(entry)) next.push(entry);
  });
  return withSiteList(config, key, next);
}

function siteListMatches(href, list) {
  return splitFabSites(list).some((entry) => matchesSiteEntry(href, entry));
}

const FAB_UNDO_FIELDS = ["isHide", "size"];
const FAB_SITE_FIELDS = ["hiddenSites", "shownSites"];

function siteEntries(value) {
  return splitFabSites(value);
}

/**
 * 算出这次写入动过的字段，返回只撤回这些字段的函数。
 * 调用时若当前值已经不是这次写入的结果，就跳过该字段。
 * 站点名单只撤回这次加进或移出的主机名，其它主机名和 x/y 保持不动。
 */
export function undoFabWrite(previous, next) {
  const before = normalizeFabConfig(previous);
  const after = normalizeFabConfig(next);
  const fields = FAB_UNDO_FIELDS.filter(
    (key) => before[key] !== after[key]
  ).map((key) => ({ key, from: before[key], to: after[key] }));
  const sites = FAB_SITE_FIELDS.map((key) => {
    const earlier = siteEntries(before[key]);
    const later = siteEntries(after[key]);
    return {
      key,
      added: later.filter((entry) => !earlier.includes(entry)),
      removed: earlier.filter((entry) => !later.includes(entry)),
    };
  }).filter((change) => change.added.length || change.removed.length);

  return (current) => {
    const base = current && typeof current === "object" ? current : {};
    const live = normalizeFabConfig(base);
    const patch = {};
    fields.forEach((change) => {
      if (live[change.key] !== change.to) return;
      patch[change.key] = change.from;
    });
    sites.forEach((change) => {
      const entries = siteEntries(live[change.key]);
      const added = change.added.filter((entry) => entries.includes(entry));
      const removed = change.removed.filter(
        (entry) => !entries.includes(entry)
      );
      if (!added.length && !removed.length) return;
      const nextEntries = entries.filter((entry) => !added.includes(entry));
      removed.forEach((entry) => {
        if (!nextEntries.includes(entry)) nextEntries.push(entry);
      });
      patch[change.key] = nextEntries.join("\n");
    });
    if (!Object.keys(patch).length) return current;
    return { ...base, ...patch };
  };
}

/**
 * 全局显示时：命中 hiddenSites 则隐藏。
 * 全局隐藏时：命中 shownSites 才显示。
 */
export function isFabVisible(href, fabConfig = {}) {
  const safeHref = typeof href === "string" ? href : "";
  const config = normalizeFabConfig(fabConfig);
  if (config.isHide) return siteListMatches(safeHref, config.shownSites);
  return !siteListMatches(safeHref, config.hiddenSites);
}

/**
 * @file blacklist.js
 * @description 黑名单检测。翻译黑名单仍用 isMatch；是否命中与列出命中条目共用 matchingBlacklistEntries。
 */

import { isMatch } from "./utils";

export function blacklistEntries(list) {
  return String(list ?? "")
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** 当前 URL 命中的全部黑名单条目，顺序与配置一致。 */
export function matchingBlacklistEntries(list, url) {
  const href = typeof url === "string" ? url : "";
  if (!href) return [];
  return blacklistEntries(list).filter((entry) => isMatch(href, entry));
}

export const isInBlacklist = (href, blacklist = "") =>
  matchingBlacklistEntries(blacklist, href).length > 0;

/** 按条目原文删除。同文多写会一并去掉，其它条目保持原样。 */
export function removeBlacklistEntry(list, entry) {
  const target = String(entry ?? "").trim();
  return blacklistEntries(list)
    .filter((item) => item !== target)
    .join("\n");
}

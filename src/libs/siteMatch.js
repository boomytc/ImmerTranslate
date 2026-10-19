import { isMatch } from "./utils";

/**
 * 悬浮球站点条目匹配。
 *
 * 没有斜杠、也没有协议的条目按主机名比较，避免 isMatch 前后补 * 把
 * x.com 误伤成 netflix.com / box.com。带路径或协议的写法仍交给 isMatch，
 * 翻译黑名单不走这里。
 */
const HOST_ENTRY = /^(\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\d+))?$/i;

export function matchesSiteEntry(href, entry) {
  const pattern = typeof entry === "string" ? entry.trim() : "";
  const target = typeof href === "string" ? href : "";
  if (!pattern || !target) return false;

  const hostLike = !pattern.includes("/") && !pattern.includes("://");
  if (hostLike) {
    const parsed = parseHostEntry(pattern);
    if (parsed) {
      let url;
      try {
        url = new URL(target);
      } catch {
        return false;
      }
      if (parsed.port != null && String(url.port || "") !== parsed.port) {
        return false;
      }
      const host = url.hostname.toLowerCase();
      if (parsed.wildcard) {
        return host === parsed.domain || host.endsWith(`.${parsed.domain}`);
      }
      return host === parsed.domain;
    }
  }

  return isMatch(target, pattern);
}

function parseHostEntry(pattern) {
  const match = HOST_ENTRY.exec(pattern.trim().toLowerCase());
  if (!match) return null;
  return {
    wildcard: Boolean(match[1]),
    domain: match[2],
    port: match[3] == null ? null : match[3],
  };
}

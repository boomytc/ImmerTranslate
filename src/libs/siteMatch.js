import { isMatch } from "./utils";

/**
 * 悬浮球站点条目匹配。
 *
 * 没有斜杠、也没有协议的条目按主机名比较，避免 isMatch 前后补 * 把
 * x.com 误伤成 netflix.com / box.com。带路径或协议的写法仍交给 isMatch，
 * 翻译黑名单不走这里。
 */
const HOST_ENTRY =
  /^((?:\*\.)*)(\[[0-9a-f:.]+\]|[a-z0-9_\u0080-\uffff-]+(?:\.[a-z0-9_\u0080-\uffff-]+)*\.?)(?::(\d+|\*))?$/i;

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
      // File extension choices such as *.txt are path patterns, not domains.
      if (
        url.protocol === "file:" &&
        parsed.wildcards === 1 &&
        !parsed.domain.includes(".") &&
        parsed.port == null
      )
        return isMatch(target, pattern);
      const port =
        url.port ||
        (url.protocol === "https:"
          ? "443"
          : url.protocol === "http:"
            ? "80"
            : "");
      if (parsed.port != null && parsed.port !== "*" && port !== parsed.port) {
        return false;
      }
      const host = url.hostname.toLowerCase();
      if (parsed.wildcard) {
        const prefix =
          host === parsed.domain
            ? ""
            : host.endsWith(`.${parsed.domain}`)
              ? host.slice(0, -parsed.domain.length - 1)
              : null;
        return (
          prefix !== null &&
          (prefix ? prefix.split(".").length : 0) >= parsed.wildcards - 1
        );
      }
      return host === parsed.domain;
    }
  }

  return isMatch(target, pattern);
}

export function parseHostEntry(pattern) {
  const match = HOST_ENTRY.exec(pattern.trim().toLowerCase());
  if (!match) return null;
  let domain;
  try {
    domain = new URL(`http://${match[2]}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (match[1] && domain.startsWith("[")) return null;
  return {
    wildcard: Boolean(match[1]),
    wildcards: match[1].length / 2,
    domain,
    port:
      match[3] == null
        ? null
        : match[3] === "*"
          ? "*"
          : String(Number(match[3])),
  };
}

export const sameRulePattern = (first, second) => {
  if (
    typeof first !== "string" ||
    typeof second !== "string" ||
    !first ||
    !second
  )
    return false;
  if (first === second) return true;
  const parse = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    const host = trimmed.startsWith("hostname:")
      ? trimmed.slice("hostname:".length)
      : trimmed;
    const parsed = parseHostEntry(host);
    if (trimmed.startsWith("hostname:") && parsed?.wildcard) return null;
    return parsed;
  };
  const left = parse(first);
  const right = parse(second);
  return Boolean(
    left &&
      right &&
      left.domain === right.domain &&
      left.wildcards === right.wildcards &&
      left.port === right.port
  );
};

export function rulePatternIndex(rules, pattern) {
  if (typeof pattern !== "string" || !pattern) return -1;
  const exact = rules.findIndex((rule) => rule?.pattern === pattern);
  return exact >= 0
    ? exact
    : rules.findIndex((rule) => sameRulePattern(rule?.pattern, pattern));
}

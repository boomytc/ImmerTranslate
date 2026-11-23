// content script 是 all_frames，并且 match_about_blank。
// GIS 的 Continue with Google 画在 accounts.google.com/gsi/button
// （或 about:blank）子 frame 里，不在顶层帖文 document。
// 子 frame 的 location 对不上 www/new/sh，matchRule 会退回全局 autoScan，
// 顶层 ignore 的 closest() 也穿不过 frame。这里只在嵌入这三台时，
// 改用外层页面的 URL 去选规则。old.reddit.com / chat.reddit.com 不在内。

const REDDIT_EMBEDDING_HOSTS = new Set([
  "www.reddit.com",
  "new.reddit.com",
  "sh.reddit.com",
]);

function hostnameOf(href) {
  try {
    const url = new URL(href);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.hostname;
  } catch {
    return "";
  }
}

export function redditEmbeddingHref({
  isIframe = false,
  topHref = "",
  ancestorOrigins = [],
  referrer = "",
} = {}) {
  if (!isIframe) return "";

  const candidates = [topHref];
  const origins =
    ancestorOrigins && typeof ancestorOrigins.length === "number"
      ? Array.from(ancestorOrigins).filter(Boolean)
      : [];
  if (origins.length > 0) {
    candidates.push(...origins);
  } else if (referrer) {
    // 仅在无法读取 ancestorOrigins 时才回退 referrer，避免非 Reddit 宿主的子框被外链来源误判
    candidates.push(referrer);
  }

  for (const candidate of candidates) {
    if (REDDIT_EMBEDDING_HOSTS.has(hostnameOf(candidate))) return candidate;
  }
  return "";
}

export function readRedditEmbeddingHref(win, isIframe) {
  if (!isIframe || !win) return "";

  let topHref = "";
  try {
    topHref = win.top?.location?.href || "";
  } catch {
    topHref = "";
  }

  let ancestorOrigins = [];
  try {
    const origins = win.location?.ancestorOrigins;
    ancestorOrigins = origins ? Array.from(origins) : [];
  } catch {
    ancestorOrigins = [];
  }

  let referrer = "";
  try {
    referrer = win.document?.referrer || "";
  } catch {
    referrer = "";
  }

  return redditEmbeddingHref({
    isIframe,
    topHref,
    ancestorOrigins,
    referrer,
  });
}

/**
 * Per-origin allow / deny matching for the options page and the content script.
 * Classic script (not an ES module): both load it and read globalThis.ImmerSites.
 *
 * A bare host (`example.com`) matches that hostname on http and https.
 * A full URL is stored as its origin (`https://example.com` or with a port)
 * and matches only that origin. Paths, queries, and hashes are dropped.
 * Non-http(s) input is rejected. Subdomains are not implied.
 */
(function initImmerSites(root) {
  /**
   * @param {string} input
   * @returns {string}
   */
  function normalizeSiteEntry(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    const typedScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const withScheme = typedScheme ? raw : `https://${raw}`;
    let url;
    try {
      url = new URL(withScheme);
    } catch {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname) return "";
    if (!typedScheme) return url.hostname.toLowerCase();
    return url.origin.toLowerCase();
  }

  /**
   * @param {unknown} list
   * @returns {string[]}
   */
  function normalizeSiteList(list) {
    if (!Array.isArray(list)) return [];
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    for (const item of list) {
      const normalized = normalizeSiteEntry(String(item ?? ""));
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    return out;
  }

  /**
   * @param {unknown} list
   * @param {{ origin?: string, hostname?: string }} page
   * @returns {boolean}
   */
  function siteListMatches(list, page) {
    const origin = String(page?.origin || "").toLowerCase();
    const hostname = String(page?.hostname || "").toLowerCase();
    for (const entry of normalizeSiteList(list)) {
      if (entry.includes("://")) {
        if (origin && entry === origin) return true;
      } else if (hostname && entry === hostname) {
        return true;
      }
    }
    return false;
  }

  root.ImmerSites = {
    normalizeSiteEntry,
    normalizeSiteList,
    siteListMatches,
  };
})(globalThis);

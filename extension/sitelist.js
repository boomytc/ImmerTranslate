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
   * Stored rows that match this page. A bare host and an exact origin can
   * both match the same page; callers that remove "this page" drop every hit.
   * @param {unknown} list
   * @param {{ origin?: string, hostname?: string }} page
   * @returns {string[]}
   */
  function matchingEntries(list, page) {
    const origin = String(page?.origin || "").toLowerCase();
    const hostname = String(page?.hostname || "").toLowerCase();
    /** @type {string[]} */
    const hits = [];
    for (const entry of normalizeSiteList(list)) {
      if (entry.includes("://")) {
        if (origin && entry === origin) hits.push(entry);
      } else if (hostname && entry === hostname) {
        hits.push(entry);
      }
    }
    return hits;
  }

  /**
   * @param {unknown} list
   * @param {{ origin?: string, hostname?: string }} page
   * @returns {boolean}
   */
  function siteListMatches(list, page) {
    return matchingEntries(list, page).length > 0;
  }

  /**
   * Add stores the page origin. Remove drops every stored row that matches
   * the page, including a bare host that covers that origin.
   * @param {unknown} list
   * @param {{ origin?: string, hostname?: string }} page
   * @param {string} entry
   * @param {"add" | "remove"} mode
   * @returns {{ list: string[], changed: boolean, entry: string, removed: string[] }}
   */
  function pageListChange(list, page, entry, mode) {
    const normalized = normalizeSiteList(list);
    const hits = matchingEntries(normalized, page);
    const cleanEntry = normalizeSiteEntry(entry);
    if (mode === "remove") {
      if (!hits.length) {
        return { list: normalized, changed: false, entry: cleanEntry, removed: [] };
      }
      const drop = new Set(hits);
      return {
        list: normalized.filter((item) => !drop.has(item)),
        changed: true,
        entry: cleanEntry || hits[0],
        removed: hits.slice(),
      };
    }
    if (hits.length || !cleanEntry) {
      return { list: normalized, changed: false, entry: cleanEntry || hits[0] || "", removed: [] };
    }
    return {
      list: normalized.concat(cleanEntry),
      changed: true,
      entry: cleanEntry,
      removed: [],
    };
  }

  /**
   * Deny wins. A page on both lists is blocked and is not auto-translated.
   * `onAllow` stays true so the UI can still show that the allow row exists.
   * @param {unknown} denyList
   * @param {unknown} allowList
   * @param {{ origin?: string, hostname?: string }} page
   * @returns {{ denied: boolean, onAllow: boolean, blocked: boolean, auto: boolean }}
   */
  function sitePolicy(denyList, allowList, page) {
    const denied = siteListMatches(denyList, page);
    const onAllow = siteListMatches(allowList, page);
    return {
      denied,
      onAllow,
      blocked: denied,
      auto: !denied && onAllow,
    };
  }

  root.ImmerSites = {
    normalizeSiteEntry,
    normalizeSiteList,
    matchingEntries,
    siteListMatches,
    pageListChange,
    sitePolicy,
  };
})(globalThis);

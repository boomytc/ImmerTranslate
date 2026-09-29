/**
 * Hotkey codec for the options page, the popup, and the content script.
 * Classic script (not an ES module): each page loads it and reads globalThis.ImmerHotkey.
 *
 * Canonical chords use Ctrl / Alt / Shift / Meta so event.altKey matches Option.
 * User-facing text follows the OS: macOS shows ⌃ ⌥ ⇧ ⌘ (paragraph default ⌥T,
 * whole-page default ⌥A). Windows and Linux keep Ctrl / Alt wording.
 * Whole-page default is Alt+A, never Command+T (that chord opens a new tab).
 * Letter and digit keys match event.code (KeyA / Digit1), so macOS Option still
 * resolves to the key printed on the keyboard.
 */
(function initImmerHotkey(root) {
  const DEFAULT_PARAGRAPH_HOTKEY = "Alt+T";
  const DEFAULT_PAGE_HOTKEY = "Alt+A";
  const MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"];
  const MAC_SYMBOL = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘" };

  /** @type {"mac" | "windows" | "linux" | "other"} */
  let currentPlatform = "other";

  /**
   * @param {string} id
   * @returns {"mac" | "windows" | "linux" | "other"}
   */
  function rememberPlatform(id) {
    if (id === "mac" || id === "windows" || id === "linux" || id === "other") {
      currentPlatform = id;
    }
    return currentPlatform;
  }

  /**
   * @param {unknown} platform
   * @returns {"mac" | "windows" | "linux" | ""}
   */
  function platformFromUserAgentData(platform) {
    const value = String(platform || "").trim().toLowerCase();
    if (!value) return "";
    if (value.includes("mac")) return "mac";
    if (value.includes("win")) return "windows";
    if (
      value.includes("linux") ||
      value.includes("cros") ||
      value.includes("chrome os") ||
      value.includes("android")
    ) {
      return "linux";
    }
    return "";
  }

  /**
   * @param {unknown} platform
   * @returns {"mac" | "windows" | "linux" | ""}
   */
  function platformFromNavigatorPlatform(platform) {
    const value = String(platform || "").trim().toLowerCase();
    if (!value) return "";
    if (value.includes("mac") || value.includes("iphone") || value.includes("ipad")) return "mac";
    if (value.includes("win")) return "windows";
    if (value.includes("linux") || value.includes("android") || value.includes("cros")) return "linux";
    return "";
  }

  /**
   * chrome.runtime.getPlatformInfo().os
   * @param {unknown} os
   * @returns {"mac" | "windows" | "linux" | ""}
   */
  function platformFromChromeOs(os) {
    const value = String(os || "").trim().toLowerCase();
    if (value === "mac") return "mac";
    if (value === "win") return "windows";
    if (
      value === "linux" ||
      value === "cros" ||
      value === "openbsd" ||
      value === "android" ||
      value === "fuchsia"
    ) {
      return "linux";
    }
    return "";
  }

  /**
   * Popup, options, and content scripts: userAgentData, then navigator.platform.
   * @returns {"mac" | "windows" | "linux" | "other"}
   */
  function detectPlatformSync() {
    const nav = typeof navigator === "undefined" ? null : navigator;
    const uaPlatform = nav && nav.userAgentData ? nav.userAgentData.platform : "";
    const fromUa = platformFromUserAgentData(uaPlatform);
    if (fromUa) return rememberPlatform(fromUa);
    const fromNav = platformFromNavigatorPlatform(nav && nav.platform);
    if (fromNav) return rememberPlatform(fromNav);
    return rememberPlatform(currentPlatform === "other" ? "other" : currentPlatform);
  }

  /**
   * Extension pages and content scripts prefer chrome.runtime.getPlatformInfo.
   * The service worker calls that API itself and does not load this file.
   * @returns {Promise<"mac" | "windows" | "linux" | "other">}
   */
  function detectPlatform() {
    const runtime = globalThis.chrome && globalThis.chrome.runtime;
    if (runtime && typeof runtime.getPlatformInfo === "function") {
      return new Promise((resolve) => {
        try {
          runtime.getPlatformInfo((info) => {
            const mapped = platformFromChromeOs(info && info.os);
            resolve(mapped ? rememberPlatform(mapped) : detectPlatformSync());
          });
        } catch {
          resolve(detectPlatformSync());
        }
      });
    }
    return Promise.resolve(detectPlatformSync());
  }

  /**
   * @param {string} spec
   * @returns {string}
   */
  function expandSymbols(spec) {
    return String(spec || "")
      .replace(/⌘/g, "+Meta+")
      .replace(/⌥/g, "+Alt+")
      .replace(/⌃/g, "+Ctrl+")
      .replace(/⇧/g, "+Shift+")
      .replace(/\+\+/g, "+");
  }

  /**
   * @param {string} part
   * @returns {string}
   */
  function tokenFromPart(part) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") return "Ctrl";
    if (lower === "alt" || lower === "option" || lower === "opt") return "Alt";
    if (lower === "shift") return "Shift";
    if (
      lower === "meta" ||
      lower === "cmd" ||
      lower === "command" ||
      lower === "win" ||
      lower === "super"
    ) {
      return "Meta";
    }
    if (part.length === 1) return part.toUpperCase();
    return part;
  }

  /**
   * @param {string} spec
   * @returns {string} Canonical "Ctrl+Alt+T" form, or "" when invalid.
   */
  function normalizeHotkey(spec) {
    const parts = expandSymbols(spec)
      .split("+")
      .map((item) => item.trim())
      .filter(Boolean)
      .map(tokenFromPart);
    /** @type {Record<string, boolean>} */
    const mods = { Ctrl: false, Alt: false, Shift: false, Meta: false };
    let key = "";
    for (const part of parts) {
      if (Object.prototype.hasOwnProperty.call(mods, part)) mods[part] = true;
      else if (!key) key = part;
    }
    if (!key) return "";
    if (!mods.Ctrl && !mods.Alt && !mods.Meta) return "";
    /** @type {string[]} */
    const ordered = [];
    for (const name of MODIFIERS) {
      if (mods[name]) ordered.push(name);
    }
    ordered.push(key);
    return ordered.join("+");
  }

  /**
   * @param {KeyboardEvent | { code?: string, key?: string }} event
   * @returns {string}
   */
  function tokenFromEvent(event) {
    const code = typeof event.code === "string" ? event.code : "";
    const fromCode = /^Key([A-Z])$/.exec(code) || /^Digit([0-9])$/.exec(code);
    if (fromCode) return fromCode[1];
    if (code === "Space") return "Space";
    const key = typeof event.key === "string" ? event.key : "";
    if (!key || key === "Dead" || key === "Unidentified") return "";
    const lower = key.toLowerCase();
    if (
      lower === "alt" ||
      lower === "control" ||
      lower === "shift" ||
      lower === "meta"
    ) {
      return "";
    }
    if (key === " ") return "Space";
    return key.length === 1 ? key.toUpperCase() : key;
  }

  /**
   * Canonical chord for storage and matching. UI passes the result through
   * formatHotkeyDisplay before showing it.
   * @param {KeyboardEvent | { altKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean, metaKey?: boolean, code?: string, key?: string }} event
   * @returns {string}
   */
  function formatHotkeyEvent(event) {
    const key = tokenFromEvent(event);
    if (!key) return "";
    if (!event.ctrlKey && !event.altKey && !event.metaKey) return "";
    /** @type {string[]} */
    const mods = [];
    if (event.ctrlKey) mods.push("Ctrl");
    if (event.altKey) mods.push("Alt");
    if (event.shiftKey) mods.push("Shift");
    if (event.metaKey) mods.push("Meta");
    return normalizeHotkey([...mods, key].join("+"));
  }

  /**
   * @param {"Ctrl" | "Alt" | "Shift" | "Meta"} name
   * @param {"mac" | "windows" | "linux" | "other"} platform
   * @returns {string}
   */
  function modifierLabel(name, platform) {
    if (platform === "mac") return MAC_SYMBOL[name] || name;
    if (name === "Meta") {
      if (platform === "windows") return "Win";
      if (platform === "linux") return "Super";
    }
    return name;
  }

  /**
   * @param {string} spec
   * @param {"mac" | "windows" | "linux" | "other"} [platform]
   * @returns {string}
   */
  function formatHotkeyDisplay(spec, platform) {
    const canonical = normalizeHotkey(spec);
    if (!canonical) return "";
    const os = platform || currentPlatform;
    const parts = canonical.split("+");
    const key = parts[parts.length - 1];
    const mods = parts.slice(0, -1).map((name) => modifierLabel(name, os));
    if (os === "mac") return mods.join("") + key;
    return [...mods, key].join("+");
  }

  /**
   * Popup CTA: action plus the same chord the options page shows, in parentheses.
   * macOS → 「翻译 (⌥A)」; Windows/Linux → 「翻译 (Alt+A)」. Callers do not hard-code Alt+.
   * @param {string} action
   * @param {string} spec
   * @param {"mac" | "windows" | "linux" | "other"} [platform]
   * @returns {string}
   */
  function formatActionLabel(action, spec, platform) {
    const name = String(action || "");
    const chord = formatHotkeyDisplay(spec, platform);
    if (!name) return chord;
    if (!chord) return name;
    return `${name} (${chord})`;
  }

  /**
   * @param {"mac" | "windows" | "linux" | "other"} [platform]
   * @returns {string}
   */
  function modifierHint(platform) {
    const os = platform || currentPlatform;
    if (os === "mac") return "⌥、⌃ 或 ⌘";
    if (os === "windows") return "Alt、Ctrl 或 Win";
    if (os === "linux") return "Alt、Ctrl 或 Super";
    return "Alt、Ctrl 或 Meta";
  }

  /**
   * @param {KeyboardEvent | { altKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean, metaKey?: boolean, code?: string, key?: string }} event
   * @param {string} spec
   * @returns {boolean}
   */
  function eventMatchesHotkey(event, spec) {
    const normalized = normalizeHotkey(spec);
    if (!normalized) return false;
    return formatHotkeyEvent(event) === normalized;
  }

  detectPlatformSync();

  root.ImmerHotkey = {
    DEFAULT_PARAGRAPH_HOTKEY,
    DEFAULT_PAGE_HOTKEY,
    normalizeHotkey,
    formatHotkeyEvent,
    formatHotkeyDisplay,
    formatActionLabel,
    eventMatchesHotkey,
    detectPlatformSync,
    detectPlatform,
    modifierHint,
    platformFromUserAgentData,
    platformFromNavigatorPlatform,
    platformFromChromeOs,
  };
})(globalThis);

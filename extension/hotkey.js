/**
 * Paragraph hotkey codec for the options page and the content script.
 * Classic script (not an ES module): both load it and read globalThis.ImmerHotkey.
 *
 * Default is Alt+T. A binding must include Alt, Ctrl, or Meta so plain typing
 * still works. Letter and digit keys match event.code (KeyA / Digit1), so
 * macOS Option still resolves to the key printed on the keyboard.
 */
(function initImmerHotkey(root) {
  const DEFAULT_PARAGRAPH_HOTKEY = "Alt+T";
  const MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"];

  /**
   * @param {string} part
   * @returns {string}
   */
  function tokenFromPart(part) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") return "Ctrl";
    if (lower === "alt" || lower === "option") return "Alt";
    if (lower === "shift") return "Shift";
    if (
      lower === "meta" ||
      lower === "cmd" ||
      lower === "command" ||
      lower === "win"
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
    const parts = String(spec || "")
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
   * @param {KeyboardEvent | { altKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean, metaKey?: boolean, code?: string, key?: string }} event
   * @param {string} spec
   * @returns {boolean}
   */
  function eventMatchesHotkey(event, spec) {
    const normalized = normalizeHotkey(spec);
    if (!normalized) return false;
    return formatHotkeyEvent(event) === normalized;
  }

  root.ImmerHotkey = {
    DEFAULT_PARAGRAPH_HOTKEY,
    normalizeHotkey,
    formatHotkeyEvent,
    eventMatchesHotkey,
  };
})(globalThis);

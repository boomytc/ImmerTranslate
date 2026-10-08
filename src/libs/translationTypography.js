import { APP_LCNAME } from "../config/app";

/**
 * Page bilingual nodes must follow the source paragraph's typography.
 * Site rules such as `* { font-size }` or `font { font-size }` set a used
 * value on the inserted element and stop inheritance. Copying the source
 * computed style back as an inline declaration wins those rules without
 * touching Options/Popup/FAB chrome.
 */

export const BILINGUAL_TYPOGRAPHY_PROPERTIES = [
  "font-size",
  "font-weight",
  "line-height",
  "color",
  "font-family",
  "letter-spacing",
  "font-style",
  "text-transform",
];

const FONT_SHORTHAND_PROPERTIES = new Set([
  "font-style",
  "font-variant",
  "font-weight",
  "font-stretch",
  "font-size",
  "line-height",
  "font-family",
]);

export const PAGE_TRANSLATION_CHROME_STYLE_ID = "kiss-translator-page-chrome";

// Glass / frost stays on the extension shell. Page translations stay flat.
export const PAGE_TRANSLATION_CHROME_CSS = `
${APP_LCNAME}.${APP_LCNAME}-wrapper,
.${APP_LCNAME}-wrapper {
  background-color: transparent !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}
${APP_LCNAME}.${APP_LCNAME}-wrapper > .${APP_LCNAME}-inner,
.${APP_LCNAME}-wrapper > .${APP_LCNAME}-inner {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}
`;

function propertyPattern(property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[;{])\\s*${escaped}\\s*:`, "im");
}

export function styleOwnsProperty(styleCode, property) {
  if (!styleCode || !property) return false;
  if (
    property !== "font" &&
    FONT_SHORTHAND_PROPERTIES.has(property) &&
    propertyPattern("font").test(styleCode)
  ) {
    return true;
  }
  return propertyPattern(property).test(styleCode);
}

export function applySourceTypography(node, source, styleCode = "") {
  if (
    !node?.style?.setProperty ||
    !source ||
    typeof window.getComputedStyle !== "function"
  ) {
    return;
  }

  let computed;
  try {
    computed = window.getComputedStyle(source);
  } catch {
    return;
  }
  if (!computed?.getPropertyValue) return;

  BILINGUAL_TYPOGRAPHY_PROPERTIES.forEach((property) => {
    if (styleOwnsProperty(styleCode, property)) return;
    const value = computed.getPropertyValue(property)?.trim();
    if (!value) return;
    try {
      // Important beats site rules such as `font { font-size: 12px !important }`.
      node.style.setProperty(property, value, "important");
    } catch {
      // Ignore a declaration the browser cannot parse.
    }
  });

  if (
    !styleOwnsProperty(styleCode, "color") &&
    !styleOwnsProperty(styleCode, "-webkit-text-fill-color")
  ) {
    try {
      node.style.setProperty(
        "-webkit-text-fill-color",
        "currentcolor",
        "important"
      );
    } catch {
      // Older engines can reject the prefixed property.
    }
  }
}

export function applyInlineCss(node, cssText) {
  if (!cssText || !node?.style?.setProperty) return;
  cssText.split(";").forEach((part) => {
    const separator = part.indexOf(":");
    if (separator === -1) return;
    const property = part.slice(0, separator).trim();
    let value = part.slice(separator + 1).trim();
    if (!property || !value) return;
    value = value.replace(/!important\s*$/i, "").trim();
    if (!value) return;
    try {
      node.style.setProperty(property, value, "important");
    } catch {
      // A bad user declaration must not drop the rest of the rule.
    }
  });
}

export function clearPageTranslationChrome(node, { surface = false } = {}) {
  if (!node?.style?.setProperty) return;
  const declarations = [
    ["backdrop-filter", "none"],
    ["-webkit-backdrop-filter", "none"],
    ["box-shadow", "none"],
  ];
  if (surface) {
    declarations.push(
      ["background-color", "transparent"],
      ["background-image", "none"]
    );
  }
  declarations.forEach(([property, value]) => {
    try {
      node.style.setProperty(property, value, "important");
    } catch {
      // Keep translating if a prefix is unsupported.
    }
  });
}

export function ensurePageTranslationChromeStyle(doc = document) {
  if (!doc?.getElementById || !doc.createElement) return;
  if (doc.getElementById(PAGE_TRANSLATION_CHROME_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = PAGE_TRANSLATION_CHROME_STYLE_ID;
  style.textContent = PAGE_TRANSLATION_CHROME_CSS;
  (doc.head || doc.documentElement)?.appendChild(style);
}

import { APP_LCNAME } from "../config/app";

/**
 * Page bilingual nodes must follow the source paragraph's typography.
 * Site rules such as `* { font-size }` or `font { font-size }` set a used
 * value on the inserted element and stop inheritance. Declaring `inherit`
 * inline beats author rules while still tracking dynamic theme / hover
 * changes on the host instead of freezing static computed RGB values.
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

export const PAGE_TRANSLATION_CHROME_STYLE_ID = `${APP_LCNAME}-page-chrome`;

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

/**
 * 读取宿主容器的弹性/网格布局特征，避免在横向 flex 或 grid 中强行换行或撑破列布局。
 */
export function getHostLayoutContext(source) {
  const fallback = {
    isHorizontalFlex: false,
    isFlexWrap: false,
    isGrid: false,
  };
  if (!source || typeof window.getComputedStyle !== "function") {
    return fallback;
  }
  let computed;
  try {
    computed = window.getComputedStyle(source);
  } catch {
    return fallback;
  }
  if (!computed) return fallback;

  const display = computed.display || "";
  const isFlex = display === "flex" || display === "inline-flex";
  const flexDirection = computed.flexDirection || "row";
  const flexWrap = computed.flexWrap || "nowrap";
  const isHorizontalFlex =
    isFlex && flexDirection !== "column" && flexDirection !== "column-reverse";
  const isGrid = display === "grid" || display === "inline-grid";

  return {
    isHorizontalFlex,
    isFlexWrap: isHorizontalFlex && flexWrap !== "nowrap",
    isGrid,
  };
}

/**
 * 为译文容器设置与宿主布局兼容的结构样式。
 * 返回是否适合在容器内使用 `<br>` 换行（横向 nowrap flex 或 grid 中禁用 `<br>`，防止错位）。
 */
export function applyWrapperLayout(
  wrapper,
  source,
  { blockDisplay = false, preferNewline = false } = {}
) {
  const layout = getHostLayoutContext(source);
  if (!wrapper?.style?.setProperty) {
    return { useNewline: preferNewline, isBlockWrapper: blockDisplay };
  }

  if (layout.isHorizontalFlex) {
    wrapper.style.setProperty("min-width", "0");
    wrapper.style.setProperty("max-width", "100%");
    if (layout.isFlexWrap && (blockDisplay || preferNewline)) {
      wrapper.style.setProperty("flex-basis", "100%");
      if (blockDisplay) {
        wrapper.style.setProperty("margin", "8px 0");
        wrapper.style.setProperty("box-sizing", "border-box");
      }
      return { useNewline: false, isBlockWrapper: true };
    }
    // 横向不换行 flex 容器中保持行内收缩，不插入 <br> 破坏行对齐
    return { useNewline: false, isBlockWrapper: false };
  }

  if (layout.isGrid) {
    wrapper.style.setProperty("min-width", "0");
    wrapper.style.setProperty("max-width", "100%");
    return { useNewline: false, isBlockWrapper: false };
  }

  if (blockDisplay) {
    wrapper.style.display = "block";
    wrapper.style.margin = "8px 0";
    wrapper.style.boxSizing = "border-box";
    return { useNewline: false, isBlockWrapper: true };
  }

  return { useNewline: preferNewline, isBlockWrapper: false };
}

export function applySourceTypography(node, source, styleCode = "") {
  if (!node?.style?.setProperty || !source) {
    return;
  }

  BILINGUAL_TYPOGRAPHY_PROPERTIES.forEach((property) => {
    if (styleOwnsProperty(styleCode, property)) return;
    try {
      // 使用 inherit 而非静态计算值和 !important，既可覆盖站点 font/* 规则，
      // 又能在站点切换暗色模式或链接 hover 时动态跟随宿主颜色与字形。
      node.style.setProperty(property, "inherit");
    } catch {
      // Ignore a declaration the browser cannot parse.
    }
  });

  if (
    !styleOwnsProperty(styleCode, "color") &&
    !styleOwnsProperty(styleCode, "-webkit-text-fill-color")
  ) {
    try {
      node.style.setProperty("-webkit-text-fill-color", "currentcolor");
    } catch {
      // Older engines can reject the prefixed property.
    }
  }
}

export function clearInlineCss(node, cssText) {
  if (!cssText || !node?.style?.removeProperty) return;
  cssText.split(";").forEach((part) => {
    const separator = part.indexOf(":");
    if (separator === -1) return;
    const property = part.slice(0, separator).trim();
    if (!property) return;
    try {
      node.style.removeProperty(property);
    } catch {
      // Ignore invalid property names.
    }
  });
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

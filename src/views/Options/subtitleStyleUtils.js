import {
  parseCssDeclaration,
  splitCssDeclarations,
} from "../../libs/cssDeclarations";

export { splitCssDeclarations };

/**
 * 将 CSS 字符串解析成键值对 JavaScript 对象
 */
export const parseCssToObject = (cssString) => {
  const result = {};
  if (!cssString) return result;

  const properties = splitCssDeclarations(cssString).filter((p) => p.trim());
  properties.forEach((prop) => {
    const parsed = parseCssDeclaration(prop);
    if (parsed) {
      result[parsed.property] = parsed.value;
    }
  });
  return result;
};

/**
 * 将 JavaScript CSS 样式对象转换回标准 CSS 字符串
 */
export const objectToCss = (obj) => {
  const entries = Object.entries(obj).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  if (entries.length === 0) {
    return "";
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join(";\n") + ";";
};

/**
 * 提取并解析 rgba() 或 rgb() 颜色字符串的 R、G、B、A 属性
 */
export const parseRgba = (rgbaString) => {
  const match = rgbaString?.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
  }
  return null;
};

/**
 * 将 RGB 十进制数值转换为 Hex 十六进制颜色代码
 */
export const rgbToHex = (r, g, b) => {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        let v = Number(x);
        if (Number.isNaN(v)) v = 0;
        v = Math.min(255, Math.max(0, Math.round(v)));
        return v.toString(16).padStart(2, "0");
      })
      .join("")
  );
};

/**
 * 将 Hex 十六进制颜色代码转换成 RGB 十进制颜色对象
 */
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

/**
 * 从 CSS 字体大小声明中解析出滑块参数，保留非 cqw/rem 单位避免粗暴截断
 */
export const parseFontSize = (fontSizeStr) => {
  if (!fontSizeStr) {
    return {
      mode: "clamp",
      min: 1,
      preferred: 2,
      max: 3,
      unit: "rem",
      preferredUnit: "cqw",
      sliderMin: 0.5,
      sliderMax: 5,
      step: 0.1,
      raw: "",
    };
  }

  const trimmed = fontSizeStr.trim();
  const clampMatch = trimmed.match(
    /^clamp\s*\(\s*([\d.]+)([a-z%]+)\s*,\s*([\d.]+)([a-z%]+)\s*,\s*([\d.]+)([a-z%]+)\s*\)$/i
  );
  if (clampMatch) {
    const preferred = parseFloat(clampMatch[3]);
    const preferredUnit = clampMatch[4].toLowerCase();
    const isFluidScale = preferredUnit === "cqw" || preferredUnit === "rem";
    return {
      mode: isFluidScale ? "clamp" : "custom",
      min: parseFloat(clampMatch[1]),
      preferred,
      max: parseFloat(clampMatch[5]),
      unit: clampMatch[2].toLowerCase(),
      preferredUnit,
      sliderMin: 0.5,
      sliderMax: Math.max(5, preferred),
      step: 0.1,
      raw: trimmed,
    };
  }

  const simpleMatch = trimmed.match(/^([\d.]+)([a-z%]+)$/i);
  if (simpleMatch) {
    const value = parseFloat(simpleMatch[1]);
    const unit = simpleMatch[2].toLowerCase();
    if (unit === "cqw" || unit === "rem") {
      return {
        mode: "unit",
        min: value * 0.5,
        preferred: value,
        max: value * 1.5,
        unit,
        preferredUnit: unit,
        sliderMin: 0.5,
        sliderMax: Math.max(5, value),
        step: 0.1,
        raw: trimmed,
      };
    }
    if (unit === "px") {
      return {
        mode: "unit",
        min: 10,
        preferred: value,
        max: Math.max(64, value),
        unit,
        preferredUnit: unit,
        sliderMin: 10,
        sliderMax: Math.max(64, value),
        step: 1,
        raw: trimmed,
      };
    }
    return {
      mode: "custom",
      min: 0,
      preferred: value,
      max: value,
      unit,
      preferredUnit: unit,
      sliderMin: 0,
      sliderMax: value,
      step: 0.1,
      raw: trimmed,
    };
  }

  return {
    mode: "custom",
    min: 1,
    preferred: 2,
    max: 3,
    unit: "rem",
    preferredUnit: "cqw",
    sliderMin: 0.5,
    sliderMax: 5,
    step: 0.1,
    raw: trimmed,
  };
};

export const formatFontSizeFromSlider = (fontSize, val) => {
  if (fontSize.mode === "unit") {
    return `${val}${fontSize.unit}`;
  }
  const p = fontSize.preferred || 1;
  const minRatio = fontSize.min / p;
  const maxRatio = fontSize.max / p;
  return `clamp(${(val * minRatio).toFixed(2)}${fontSize.unit}, ${val}${fontSize.preferredUnit}, ${(val * maxRatio).toFixed(2)}${fontSize.unit})`;
};

const buildPaddingRange = (vertical, horizontal, unit) => {
  const normalizedUnit = String(unit || "em").toLowerCase();
  if (normalizedUnit === "px") {
    return {
      vertical,
      horizontal,
      unit: normalizedUnit,
      verticalMax: Math.max(32, vertical),
      horizontalMax: Math.max(48, horizontal),
      step: 1,
    };
  }
  if (normalizedUnit === "%") {
    return {
      vertical,
      horizontal,
      unit: normalizedUnit,
      verticalMax: Math.max(10, vertical),
      horizontalMax: Math.max(15, horizontal),
      step: 0.5,
    };
  }
  return {
    vertical,
    horizontal,
    unit: normalizedUnit,
    verticalMax: Math.max(2, vertical),
    horizontalMax: Math.max(3, horizontal),
    step: 0.1,
  };
};

/**
 * 从 CSS 的 padding 声明中解析出上下和左右内边距及滑块范围
 */
export const parsePadding = (paddingStr) => {
  if (!paddingStr) return buildPaddingRange(0.5, 1, "em");

  const normalized = String(paddingStr)
    .replace(/\s*!important\s*$/i, "")
    .trim();
  if (!normalized) return buildPaddingRange(0.5, 1, "em");

  const parts = normalized.split(/\s+/);
  const parseToken = (token) => {
    const match = token.match(/^([\d.]+)([a-z%]*)$/i);
    if (!match) return null;
    const value = parseFloat(match[1]);
    if (!Number.isFinite(value)) return null;
    const unit = match[2] ? match[2].toLowerCase() : "";
    if (!unit && value !== 0) return null;
    return { value, unit };
  };

  if (parts.length === 1) {
    const parsed = parseToken(parts[0]);
    if (parsed) {
      return buildPaddingRange(parsed.value, parsed.value, parsed.unit || "em");
    }
  } else if (parts.length >= 2) {
    const v = parseToken(parts[0]);
    const h = parseToken(parts[1]);
    if (v && h) {
      return buildPaddingRange(v.value, h.value, v.unit || h.unit || "em");
    }
  }
  return buildPaddingRange(0.5, 1, "em");
};

/**
 * 将常见的 CSS 颜色值规范为 `<input type="color">` 可接受的 7 位十六进制颜色代码
 */
export const colorToHex = (colorStr) => {
  if (!colorStr) return "#ffffff";
  const namedColors = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
    grey: "#808080",
    orange: "#ffa500",
    transparent: "#ffffff",
  };
  const lower = String(colorStr)
    .replace(/\s*!important\s*$/i, "")
    .toLowerCase()
    .trim();
  if (namedColors[lower]) return namedColors[lower];
  if (lower.startsWith("#")) {
    if (/^#[0-9a-f]{3}$/.test(lower) || /^#[0-9a-f]{4}$/.test(lower)) {
      return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
    }
    if (/^#[0-9a-f]{6}$/.test(lower)) {
      return lower;
    }
    if (/^#[0-9a-f]{8}$/.test(lower)) {
      return lower.slice(0, 7);
    }
    return "#ffffff";
  }
  const rgba = parseRgba(lower);
  if (rgba) return rgbToHex(rgba.r, rgba.g, rgba.b);
  return "#ffffff";
};

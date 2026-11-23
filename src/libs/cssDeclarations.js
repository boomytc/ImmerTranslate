/**
 * Split CSS at declaration boundaries.
 *
 * Semicolons inside strings, parentheses, or comments are part of the value.
 * Preserve them so editing or applying inline CSS cannot truncate values such
 * as `url("data:image/svg+xml;utf8,...")`.
 *
 * @param {string} cssString CSS source.
 * @returns {string[]} Declarations with their original whitespace and comments.
 */
export const splitCssDeclarations = (cssString) => {
  if (!cssString) return [];

  const parts = [];
  let buffer = "";
  let depth = 0;
  let quote = null;
  let inComment = false;
  let inUnquotedUrl = false;
  let name = "";

  for (let i = 0; i < cssString.length; i++) {
    const char = cssString[i];

    if (inUnquotedUrl) {
      buffer += char;
      if (char === "\\" && i + 1 < cssString.length) {
        buffer += cssString[++i];
      } else if (char === ")") {
        inUnquotedUrl = false;
        depth = Math.max(0, depth - 1);
      }
      continue;
    }
    if (inComment) {
      buffer += char;
      if (char === "*" && cssString[i + 1] === "/") {
        buffer += cssString[++i];
        inComment = false;
      }
      continue;
    }
    if (quote) {
      buffer += char;
      if (char === "\\" && i + 1 < cssString.length) {
        buffer += cssString[++i];
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (cssString.startsWith("<!--", i)) {
      buffer += "<!--";
      name = "";
      i += 3;
      continue;
    }
    if (char === "\\" && i + 1 < cssString.length) {
      const escape = cssString
        .slice(i + 1)
        .match(/^[\da-f]{1,6}(?:\r\n|[ \t\n\r\f])?/i);
      if (escape) {
        const codePoint = parseInt(escape[0], 16);
        name +=
          codePoint > 0 &&
          codePoint <= 0x10ffff &&
          (codePoint < 0xd800 || codePoint > 0xdfff)
            ? String.fromCodePoint(codePoint)
            : "\ufffd";
        buffer += char + escape[0];
        i += escape[0].length;
      } else {
        name = /[\n\r\f]/.test(cssString[i + 1]) ? "" : name + cssString[i + 1];
        buffer += char + cssString[++i];
      }
      continue;
    }
    if (char === "/" && cssString[i + 1] === "*") {
      inComment = true;
      name = "";
      buffer += "/*";
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      name = "";
      buffer += char;
      continue;
    }
    if (char === "(") {
      depth++;
      if (name.toLowerCase() === "url") {
        inUnquotedUrl = !/^[ \t\n\r\f]*["']/.test(cssString.slice(i + 1));
      }
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    }
    name = /[-\w\u0080-\uffff#@]/.test(char) ? name + char : "";

    if (char === ";" && depth === 0) {
      parts.push(buffer);
      buffer = "";
      continue;
    }
    buffer += char;
  }

  parts.push(buffer);
  return parts;
};

/**
 * Parse a single CSS declaration into `{ property, value }`, skipping CSS
 * comments so colons inside comments cannot hijack the declaration separator.
 *
 * @param {string} declaration Single CSS declaration text.
 * @returns {{ property: string, value: string } | null}
 */
export const parseCssDeclaration = (declaration) => {
  if (!declaration) return null;

  let property = "";
  let inComment = false;

  for (let i = 0; i < declaration.length; i++) {
    const char = declaration[i];

    if (inComment) {
      if (char === "*" && declaration[i + 1] === "/") {
        inComment = false;
        i += 1;
      }
      continue;
    }

    if (char === "/" && declaration[i + 1] === "*") {
      inComment = true;
      i += 1;
      continue;
    }

    if (char === ":") {
      const normalizedProperty = property.trim();
      if (!normalizedProperty) return null;
      return {
        property: normalizedProperty,
        value: declaration.slice(i + 1).trim(),
      };
    }

    property += char;
  }

  return null;
};

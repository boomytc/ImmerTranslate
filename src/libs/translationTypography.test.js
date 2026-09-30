import { builtinStylesMap } from "./style";
import { OPT_STYLE_HIGHLIGHT, OPT_STYLE_NONE } from "../config/styles";
import {
  applySourceTypography,
  clearPageTranslationChrome,
  ensurePageTranslationChromeStyle,
  PAGE_TRANSLATION_CHROME_CSS,
  PAGE_TRANSLATION_CHROME_STYLE_ID,
  styleOwnsProperty,
} from "./translationTypography";

describe("bilingual source typography", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  test("treats decorative styles as owning the color they paint", () => {
    expect(styleOwnsProperty(builtinStylesMap[OPT_STYLE_NONE], "color")).toBe(
      false
    );
    expect(
      styleOwnsProperty(builtinStylesMap[OPT_STYLE_HIGHLIGHT], "color")
    ).toBe(true);
    expect(
      styleOwnsProperty(builtinStylesMap[OPT_STYLE_HIGHLIGHT], "font-size")
    ).toBe(false);
    expect(styleOwnsProperty("font: 16px/1.4 sans-serif;", "line-height")).toBe(
      true
    );
    expect(styleOwnsProperty("font-size: 12px;", "font-family")).toBe(false);
  });

  test("copies paragraph typography onto the translation and beats a font rule", () => {
    document.head.appendChild(document.createElement("style")).textContent = `
      font.kiss-translator-inner {
        font-size: 12px;
        font-weight: 400;
        line-height: 14px;
        color: rgb(255, 0, 0);
        backdrop-filter: blur(22px);
      }
    `;
    document.body.innerHTML =
      '<p id="source" style="font-size: 22px; font-weight: 700; line-height: 36px; color: rgb(10, 20, 30); letter-spacing: 0.2px;">Hello paragraph</p>';
    const source = document.getElementById("source");
    const inner = document.createElement("font");
    inner.className = "kiss-translator-inner";
    source.appendChild(inner);

    applySourceTypography(inner, source, builtinStylesMap[OPT_STYLE_NONE]);

    expect(inner.style.fontSize).toBe("22px");
    expect(inner.style.fontWeight).toBe("700");
    expect(inner.style.lineHeight).toBe("36px");
    expect(inner.style.color).toBe("rgb(10, 20, 30)");
    expect(inner.style.letterSpacing).toBe("0.2px");
    expect(inner.style.getPropertyPriority("font-size")).toBe("important");
    expect(window.getComputedStyle(inner).fontSize).toBe("22px");
    expect(window.getComputedStyle(inner).color).toBe("rgb(10, 20, 30)");
  });

  test("leaves color to a highlight style while still matching size", () => {
    document.body.innerHTML =
      '<p id="source" style="font-size: 19px; font-weight: 650; color: rgb(1, 2, 3);">Title</p>';
    const source = document.getElementById("source");
    const inner = document.createElement("font");

    applySourceTypography(inner, source, builtinStylesMap[OPT_STYLE_HIGHLIGHT]);

    expect(inner.style.fontSize).toBe("19px");
    expect(inner.style.fontWeight).toBe("650");
    expect(inner.style.color).toBe("");
    expect(inner.style.getPropertyValue("-webkit-text-fill-color")).toBe("");
  });

  test("strips frosted chrome from page translation nodes", () => {
    const wrapper = document.createElement("kiss-translator");
    wrapper.className = "kiss-translator-wrapper";
    wrapper.style.backdropFilter = "blur(22px)";
    wrapper.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
    const inner = document.createElement("font");
    inner.style.backdropFilter = "blur(8px)";

    clearPageTranslationChrome(wrapper, { surface: true });
    clearPageTranslationChrome(inner);

    expect(wrapper.style.getPropertyValue("box-shadow")).toBe("none");
    expect(wrapper.style.getPropertyPriority("box-shadow")).toBe("important");
    expect(wrapper.style.getPropertyValue("background-color")).toBe(
      "transparent"
    );
    expect(wrapper.style.getPropertyValue("background-image")).toBe("none");
    expect(inner.style.getPropertyValue("box-shadow")).toBe("none");
    expect(inner.style.backgroundColor).toBe("");
    expect(PAGE_TRANSLATION_CHROME_CSS).toContain("backdrop-filter: none");
    expect(PAGE_TRANSLATION_CHROME_CSS).toContain(
      "-webkit-backdrop-filter: none"
    );
    expect(PAGE_TRANSLATION_CHROME_CSS).not.toContain("kt-glass");
  });

  test("injects the page chrome reset once", () => {
    ensurePageTranslationChromeStyle();
    ensurePageTranslationChromeStyle();
    const styles = document.querySelectorAll(
      `#${PAGE_TRANSLATION_CHROME_STYLE_ID}`
    );
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain(
      ".kiss-translator-wrapper > .kiss-translator-inner"
    );
  });
});

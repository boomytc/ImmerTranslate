jest.mock("../apis", () => ({
  apiMicrosoftDict: jest.fn(),
  apiTranslate: jest.fn(),
  apiYoudaoDict: jest.fn(),
}));

jest.mock("./msg", () => ({
  sendBgMsg: jest.fn(),
}));

jest.mock("./detect", () => ({
  tryDetectLang: jest.fn(),
}));

const { apiTranslate, apiMicrosoftDict, apiYoudaoDict } = require("../apis");
const { tryDetectLang } = require("./detect");
const {
  OPT_STYLE_NONE,
  OPT_STYLE_LINE,
  OPT_STYLE_FUZZY,
  OPT_STYLE_HIGHLIGHT,
  OPT_STYLE_DASHBOX,
} = require("../config");
const { Translator } = require("./translator");

const flushAsync = async () => {
  jest.runOnlyPendingTimers();
  for (let frame = 0; frame < 2; frame++) {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    jest.advanceTimersByTime(16);
  }
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe("Translator style toggling and runtime rendering", () => {
  let createdTranslators = [];
  let originalIntersectionObserver;
  let originalCSSStyleSheet;

  beforeAll(() => {
    originalIntersectionObserver = global.IntersectionObserver;
    global.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(target) {
        this.callback([{ target, isIntersecting: true }]);
      }
      unobserve() {}
      disconnect() {}
    };

    originalCSSStyleSheet = global.CSSStyleSheet;
    global.CSSStyleSheet = class {
      replaceSync() {}
    };
  });

  afterAll(() => {
    global.IntersectionObserver = originalIntersectionObserver;
    global.CSSStyleSheet = originalCSSStyleSheet;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    apiTranslate.mockResolvedValue({ trText: "Translated", isSame: false });
    apiMicrosoftDict.mockResolvedValue(null);
    apiYoudaoDict.mockResolvedValue(null);
    tryDetectLang.mockResolvedValue("en");
  });

  afterEach(() => {
    createdTranslators.forEach((t) => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
    createdTranslators = [];
    document.body.innerHTML = "";
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function createTestTranslator(rule = {}, setting = {}) {
    const translator = new Translator({
      rule: {
        transOpen: "true",
        rootsSelector: "#root",
        fromLang: "en",
        toLang: "zh-CN",
        autoScan: "true",
        hasShadowroot: "false",
        scanAll: "false",
        transTitle: "false",
        ...rule,
      },
      setting: {
        minLength: 0,
        transInterval: 0,
        rootMargin: 0,
        customStyles: [],
        transApis: [],
        ...setting,
      },
    });
    createdTranslators.push(translator);
    return translator;
  }

  describe("toggleStyle intelligent switching", () => {
    test("defaults to OPT_STYLE_FUZZY when initial style is OPT_STYLE_NONE", () => {
      const translator = createTestTranslator({ textStyle: OPT_STYLE_NONE });
      expect(translator.rule.textStyle).toBe(OPT_STYLE_NONE);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_FUZZY);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_NONE);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_FUZZY);
    });

    test("losslessly toggles between current valid style and OPT_STYLE_NONE", () => {
      const translator = createTestTranslator({ textStyle: OPT_STYLE_LINE });
      expect(translator.rule.textStyle).toBe(OPT_STYLE_LINE);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_NONE);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_LINE);
    });

    test("remembers new valid style updated via updateRule", () => {
      const translator = createTestTranslator({ textStyle: OPT_STYLE_LINE });

      translator.updateRule({ textStyle: OPT_STYLE_HIGHLIGHT });
      expect(translator.rule.textStyle).toBe(OPT_STYLE_HIGHLIGHT);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_NONE);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_HIGHLIGHT);
    });

    test("accepts explicit targetStyle when passed", () => {
      const translator = createTestTranslator({ textStyle: OPT_STYLE_LINE });

      translator.toggleStyle(OPT_STYLE_DASHBOX);
      expect(translator.rule.textStyle).toBe(OPT_STYLE_DASHBOX);

      // Toggling again with the same targetStyle toggles it off
      translator.toggleStyle(OPT_STYLE_DASHBOX);
      expect(translator.rule.textStyle).toBe(OPT_STYLE_NONE);

      // Toggling with no arg restores the last active style
      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_DASHBOX);
    });

    test("explicit OPT_STYLE_NONE turns style off and remembers last active style", () => {
      const translator = createTestTranslator({ textStyle: OPT_STYLE_LINE });

      translator.toggleStyle(OPT_STYLE_NONE);
      expect(translator.rule.textStyle).toBe(OPT_STYLE_NONE);

      translator.toggleStyle();
      expect(translator.rule.textStyle).toBe(OPT_STYLE_LINE);
    });
  });

  describe("#updateStyle robustness and styling updates", () => {
    test("does not throw when wrapper has no inner node", async () => {
      document.body.innerHTML = `
        <main id="root">
          <p id="para">Hello World</p>
        </main>
      `;
      createTestTranslator({ textStyle: OPT_STYLE_NONE });
      await flushAsync();

      const wrapper = document.querySelector(
        `.${Translator.KISS_CLASS.warpper}`
      );
      expect(wrapper).not.toBeNull();

      // Remove the inner node to simulate corrupted DOM
      const inner = wrapper.querySelector(`.${Translator.KISS_CLASS.inner}`);
      inner?.remove();

      expect(() => {
        createdTranslators[0].updateRule({ textStyle: OPT_STYLE_LINE });
      }).not.toThrow();
    });

    test("safely removes old style classes and applies new style classes", async () => {
      document.body.innerHTML = `
        <main id="root">
          <p id="para">Hello World</p>
        </main>
      `;
      const translator = createTestTranslator({ textStyle: OPT_STYLE_LINE });
      await flushAsync();

      const inner = document.querySelector(`.${Translator.KISS_CLASS.inner}`);
      expect(inner).not.toBeNull();

      translator.updateRule({ textStyle: OPT_STYLE_FUZZY });
      await flushAsync();

      expect(inner.classList.contains(Translator.KISS_CLASS.inner)).toBe(true);
    });

    test("cleans and resets surface background when switching between none and highlight", async () => {
      document.body.innerHTML = `
        <main id="root">
          <p id="para" style="color: rgb(10, 20, 30);">Sample sentence</p>
        </main>
      `;
      const translator = createTestTranslator({ textStyle: OPT_STYLE_NONE });
      await flushAsync();

      const inner = document.querySelector(`.${Translator.KISS_CLASS.inner}`);
      expect(inner).not.toBeNull();

      // Initially OPT_STYLE_NONE (does not own background)
      expect(inner.style.getPropertyValue("background-color")).toBe(
        "transparent"
      );

      // Switch to highlight (which owns background and color)
      translator.updateRule({ textStyle: OPT_STYLE_HIGHLIGHT });
      await flushAsync();

      // Surface transparent background should NOT be forced when style owns background
      expect(inner.style.getPropertyValue("background-color")).not.toBe(
        "transparent"
      );

      // Switch back to none (which does not own background)
      translator.updateRule({ textStyle: OPT_STYLE_NONE });
      await flushAsync();

      // Surface transparent background should now be reset to transparent !important
      expect(inner.style.getPropertyValue("background-color")).toBe(
        "transparent"
      );
    });

    test("removes inline color override when switching to style owning color, and restores source typography when switching back", async () => {
      document.body.innerHTML = `
        <main id="root">
          <p id="para" style="color: rgb(40, 50, 60);">Sample typography sentence</p>
        </main>
      `;
      const translator = createTestTranslator({ textStyle: OPT_STYLE_NONE });
      await flushAsync();

      const inner = document.querySelector(`.${Translator.KISS_CLASS.inner}`);
      expect(inner).not.toBeNull();

      // In OPT_STYLE_NONE, applySourceTypography applies source color
      expect(inner.style.getPropertyValue("color")).toBe("rgb(40, 50, 60)");

      // Switch to OPT_STYLE_HIGHLIGHT (owns color)
      translator.updateRule({ textStyle: OPT_STYLE_HIGHLIGHT });
      await flushAsync();

      // When style owns color, inline color property is removed so class color can apply
      expect(inner.style.getPropertyValue("color")).toBe("");

      // Switch back to OPT_STYLE_NONE
      translator.updateRule({ textStyle: OPT_STYLE_NONE });
      await flushAsync();

      // Inline color property is re-applied from source node
      expect(inner.style.getPropertyValue("color")).toBe("rgb(40, 50, 60)");
    });

    test("safely handles undefined, empty or unknown style slugs without throwing", async () => {
      document.body.innerHTML = `
        <main id="root">
          <p id="para">Safe style fallback</p>
        </main>
      `;
      const translator = createTestTranslator({ textStyle: OPT_STYLE_NONE });
      await flushAsync();

      const inner = document.querySelector(`.${Translator.KISS_CLASS.inner}`);
      expect(inner).not.toBeNull();

      expect(() => {
        translator.updateRule({ textStyle: "non_existent_style_slug" });
      }).not.toThrow();

      expect(() => {
        translator.updateRule({ textStyle: "" });
      }).not.toThrow();

      expect(() => {
        translator.updateRule({ textStyle: undefined });
      }).not.toThrow();
    });
  });
});

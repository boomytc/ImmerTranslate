import { act } from "react";

jest.mock("../apis", () => ({
  apiMicrosoftDict: jest.fn(),
  apiTranslate: jest.fn(),
  apiYoudaoDict: jest.fn(),
}));

jest.mock("./detect", () => ({
  tryDetectLang: jest.fn(),
}));

jest.mock("./storageState", () => ({
  getStorageState: () => ({
    subscribe: () => () => {},
  }),
}));

jest.mock("../components/TouchTranslateControl", () => ({
  TouchTranslateStatus: () => null,
}));

jest.mock("../views/Selection", () => {
  const React = require("react");
  return jest.fn(() => React.createElement("div"));
});

jest.mock("./popupManager", () => ({
  PopupManager: class {
    destroy() {}
    toggle() {}
    hide() {}
  },
}));

jest.mock("./fabManager", () => ({
  FabManager: class {
    destroy() {}
    show() {}
  },
}));

jest.mock("./ruleEditorManager", () => ({
  RuleEditorManager: class {
    destroy() {}
    open() {}
  },
}));

jest.mock("./pageRuleSync", () => ({
  pickSharedRulePatch: () => ({}),
  publishPageRule: jest.fn(),
  persistSharedSiteRule: jest.fn(),
}));

const { apiTranslate } = require("../apis");
const { tryDetectLang } = require("./detect");
const { DEFAULT_API_SETTING, OPT_TRANS_GOOGLE } = require("../config");
const { Translator } = require("./translator");
const { TransboxManager } = require("./tranbox");
const { InputTranslator } = require("./inputTranslate");
const TranslatorManager = require("./translatorManager").default;
const Selection = require("../views/Selection");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flushAsync = async () => {
  jest.runOnlyPendingTimers();
  for (let frame = 0; frame < 2; frame++) {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    jest.advanceTimersByTime(16);
  }
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function createSetting() {
  return {
    preInit: false,
    minLength: 0,
    transInterval: 0,
    touchModes: [],
    shortcuts: {},
    contextMenuType: 0,
    customStyles: [],
    prompts: [{ slug: "custom", userPrompt: "keep" }],
    subtitleSetting: { segPromptSlug: "subtitle-segmentation" },
    tranboxSetting: {
      transOpen: false,
      triggerMode: "select",
      btnPosition: "fixed",
    },
    inputRule: {
      transOpen: false,
      apiSlug: "fake-engine",
      fromLang: "en",
      toLang: "zh-CN",
      triggerShortcut: ["AltLeft", "KeyI"],
      triggerCount: 1,
      triggerTime: 200,
      showDot: "always",
    },
    mouseHoverSetting: {
      useMouseHover: false,
      mouseHoverKey: [],
      mouseHoverKey2: [],
    },
    transApis: [
      {
        ...DEFAULT_API_SETTING,
        apiSlug: "fake-engine",
        apiType: OPT_TRANS_GOOGLE,
        apiName: "Fake",
        isDisabled: false,
      },
    ],
  };
}

function createRule() {
  return {
    transOpen: "false",
    rootsSelector: "#root",
    fromLang: "en",
    toLang: "zh-CN",
    apiSlug: "fake-engine",
    autoScan: "true",
    hasShadowroot: "false",
    scanAll: "false",
    transTitle: "false",
  };
}

function lastSelectionProps() {
  const calls = Selection.mock.calls;
  return calls[calls.length - 1]?.[0];
}

function installObservers() {
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
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  global.CSSStyleSheet = class {
    replaceSync() {}
  };
}

describe("owned setting copies", () => {
  beforeAll(() => {
    installObservers();
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    apiTranslate.mockReset();
    apiTranslate.mockResolvedValue({ trText: "译文", isSame: false });
    tryDetectLang.mockReset();
    tryDetectLang.mockResolvedValue("en");
    Selection.mockImplementation(() => require("react").createElement("div"));
    Selection.mockClear();
  });

  test("Translator writes stay inside its copy during toggle and translate", async () => {
    jest.useFakeTimers();
    try {
      document.body.innerHTML =
        '<main id="root"><p>Hello from the page</p></main>';
      const setting = createSetting();
      const rule = createRule();
      const settingSnapshot = structuredClone(setting);
      const ruleSnapshot = structuredClone(rule);
      const translator = new Translator({ rule, setting, favWords: [] });

      translator.toggleTransbox();
      translator.toggleInputTranslate();
      translator.toggleMouseHover();
      translator.updateRule({ fromLang: "ja", toLang: "ko" });
      translator.enable();
      await flushAsync();
      await flushAsync();

      expect(apiTranslate).toHaveBeenCalledWith(
        expect.objectContaining({
          fromLang: "ja",
          toLang: "ko",
          apiSetting: expect.objectContaining({ apiSlug: "fake-engine" }),
        })
      );
      expect(translator.setting.tranboxSetting.transOpen).toBe(true);
      expect(translator.setting.inputRule.transOpen).toBe(true);
      expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(true);
      expect(setting).toEqual(settingSnapshot);
      expect(rule).toEqual(ruleSnapshot);
      translator.stop();
    } finally {
      jest.useRealTimers();
    }
  });

  test("TransboxManager update does not write back into the caller setting", () => {
    const setting = createSetting();
    const snapshot = structuredClone(setting);
    let manager;
    act(() => {
      manager = new TransboxManager(setting);
    });

    const nextProps = {
      tranboxSetting: {
        transOpen: true,
        triggerMode: "dblclick",
        btnPosition: "mouse",
      },
    };
    act(() => {
      manager.update(nextProps);
    });

    expect(lastSelectionProps().tranboxSetting).toEqual(
      nextProps.tranboxSetting
    );
    nextProps.tranboxSetting.triggerMode = "hover";
    nextProps.tranboxSetting.transOpen = false;
    expect(lastSelectionProps().tranboxSetting.triggerMode).toBe("dblclick");
    expect(lastSelectionProps().tranboxSetting.transOpen).toBe(true);
    expect(setting).toEqual(snapshot);

    act(() => {
      manager.disable();
    });
  });

  test("InputTranslator translate and updateConfig leave the caller setting intact", async () => {
    const setting = createSetting();
    const snapshot = structuredClone(setting);
    const translator = new InputTranslator(setting);
    const input = document.createElement("textarea");
    input.value = "Hello from the input";
    document.body.appendChild(input);
    input.focus();

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hello from the input",
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting: expect.objectContaining({ apiSlug: "fake-engine" }),
      })
    );

    const nextRule = {
      ...setting.inputRule,
      apiSlug: "next-engine",
      fromLang: "fr",
      toLang: "de",
      transOpen: true,
    };
    const nextApis = [
      {
        ...DEFAULT_API_SETTING,
        apiSlug: "next-engine",
        apiType: OPT_TRANS_GOOGLE,
        apiName: "Next",
        isDisabled: false,
      },
    ];
    translator.updateConfig({
      inputRule: nextRule,
      transApis: nextApis,
    });
    apiTranslate.mockClear();
    await translator.handleTranslate({ isBtnTrigger: true });

    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        fromLang: "fr",
        toLang: "de",
        apiSetting: expect.objectContaining({ apiSlug: "next-engine" }),
      })
    );
    nextRule.fromLang = "es";
    nextApis[0].apiSlug = "mutated-after-update";
    expect(setting).toEqual(snapshot);
    translator.disable();
  });

  test("owned copies keep later updates and do not share the manager setting", async () => {
    const inputSetting = createSetting();
    const inputRule = createRule();
    const realClone = globalThis.structuredClone.bind(globalThis);
    let heldSetting;
    let heldRule;
    globalThis.structuredClone = (value, options) => {
      const cloned = realClone(value, options);
      if (value === inputSetting) heldSetting = cloned;
      if (value === inputRule) heldRule = cloned;
      return cloned;
    };
    let manager;
    try {
      manager = new TranslatorManager({
        setting: inputSetting,
        rule: inputRule,
        fabConfig: { isHide: true },
        favWords: [],
        isIframe: false,
        isUserscript: true,
      });
    } finally {
      globalThis.structuredClone = realClone;
    }

    const heldSettingSnapshot = structuredClone(heldSetting);
    const translator = new Translator({
      rule: heldRule,
      setting: heldSetting,
      favWords: [],
    });
    let transbox;
    act(() => {
      transbox = new TransboxManager(heldSetting);
    });
    const inputTranslator = new InputTranslator(heldSetting);

    heldSetting.tranboxSetting.transOpen = true;
    heldSetting.tranboxSetting.triggerMode = "hover";
    heldSetting.inputRule.apiSlug = "mutated-by-holder";
    heldSetting.inputRule.transOpen = true;
    heldSetting.mouseHoverSetting.useMouseHover = true;
    heldSetting.transApis[0].apiName = "Mutated";
    heldRule.fromLang = "xx";
    heldRule.transOpen = "true";

    expect(translator.setting.tranboxSetting).toEqual(
      heldSettingSnapshot.tranboxSetting
    );
    expect(translator.setting.inputRule).toEqual(heldSettingSnapshot.inputRule);
    expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(false);
    expect(translator.setting.transApis[0].apiName).toBe("Fake");
    expect(translator.rule.fromLang).toBe("en");
    expect(translator.rule.transOpen).toBe("false");
    expect(translator.setting.tranboxSetting).not.toBe(
      heldSetting.tranboxSetting
    );
    expect(translator.rule).not.toBe(heldRule);

    translator.toggleTransbox();
    translator.toggleInputTranslate();
    translator.toggleMouseHover();
    expect(heldSetting.tranboxSetting.transOpen).toBe(true);
    expect(heldSetting.inputRule.transOpen).toBe(true);
    expect(heldSetting.inputRule.apiSlug).toBe("mutated-by-holder");
    expect(heldSetting.mouseHoverSetting.useMouseHover).toBe(true);
    expect(heldRule.transOpen).toBe("true");
    expect(heldRule.fromLang).toBe("xx");
    expect(translator.setting.tranboxSetting.transOpen).toBe(true);
    expect(translator.setting.inputRule.transOpen).toBe(true);
    expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(true);
    expect(translator.rule.transOpen).toBe("false");

    const nextRule = { fromLang: "ja", toLang: "ko" };
    translator.updateRule(nextRule);
    expect(translator.rule.fromLang).toBe("ja");
    expect(translator.rule.toLang).toBe("ko");
    expect(heldRule.fromLang).toBe("xx");
    nextRule.fromLang = "es";
    expect(translator.rule.fromLang).toBe("ja");

    const nextBox = {
      tranboxSetting: {
        transOpen: true,
        triggerMode: "dblclick",
        btnPosition: "mouse",
      },
    };
    act(() => {
      transbox.update(nextBox);
    });
    expect(lastSelectionProps().tranboxSetting.triggerMode).toBe("dblclick");
    nextBox.tranboxSetting.triggerMode = "click";
    expect(lastSelectionProps().tranboxSetting.triggerMode).toBe("dblclick");

    const nextInputRule = {
      ...heldSettingSnapshot.inputRule,
      apiSlug: "next-engine",
      fromLang: "fr",
      toLang: "de",
    };
    const nextApis = [
      {
        ...DEFAULT_API_SETTING,
        apiSlug: "next-engine",
        apiType: OPT_TRANS_GOOGLE,
        isDisabled: false,
      },
    ];
    inputTranslator.updateConfig({
      inputRule: nextInputRule,
      transApis: nextApis,
    });
    const input = document.createElement("textarea");
    input.value = "Hello from the manager holder";
    document.body.appendChild(input);
    input.focus();
    await inputTranslator.handleTranslate({ isBtnTrigger: true });
    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        fromLang: "fr",
        toLang: "de",
        apiSetting: expect.objectContaining({ apiSlug: "next-engine" }),
      })
    );
    nextInputRule.fromLang = "it";
    nextApis[0].apiName = "Changed";
    apiTranslate.mockClear();
    await inputTranslator.handleTranslate({ isBtnTrigger: true });
    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        fromLang: "fr",
        apiSetting: expect.objectContaining({ apiSlug: "next-engine" }),
      })
    );

    document.body.innerHTML =
      '<main id="root"><p>Hello from the page</p></main>';
    jest.useFakeTimers();
    try {
      apiTranslate.mockClear();
      translator.enable();
      await flushAsync();
      await flushAsync();
      expect(apiTranslate).toHaveBeenCalledWith(
        expect.objectContaining({ fromLang: "ja", toLang: "ko" })
      );
      translator.disable();
      expect(translator.rule.transOpen).toBe("false");
      expect(heldRule.transOpen).toBe("true");
    } finally {
      jest.useRealTimers();
    }

    act(() => {
      manager.start();
    });
    heldSetting.tranboxSetting.marker = "after-start";
    heldSetting.inputRule.apiSlug = "after-start";
    expect(manager._translator.setting.tranboxSetting.marker).toBeUndefined();
    expect(manager._translator.setting.inputRule.apiSlug).toBe(
      "mutated-by-holder"
    );
    expect(manager._translator.setting.tranboxSetting).not.toBe(
      heldSetting.tranboxSetting
    );
    const holderTransOpen = heldSetting.tranboxSetting.transOpen;
    const holderInputOpen = heldSetting.inputRule.transOpen;
    manager._translator.toggleTransbox();
    manager._translator.toggleInputTranslate();
    expect(heldSetting.tranboxSetting.transOpen).toBe(holderTransOpen);
    expect(heldSetting.inputRule.transOpen).toBe(holderInputOpen);
    manager._translator.updateRule({ fromLang: "de", toLang: "en" });
    expect(manager._translator.rule.fromLang).toBe("de");
    expect(manager._translator.rule.toLang).toBe("en");
    expect(heldRule.fromLang).toBe("xx");

    translator.stop();
    inputTranslator.disable();
    act(() => {
      transbox.disable();
    });
    act(() => {
      manager.stop();
    });
  });
});

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
const { DEFAULT_API_SETTING, OPT_TRANS_GOOGLE } = require("../config");
const { EVENT_KISS_TRANSLATOR, MSG_TRANS_PUTRULE } = require("../config/msg");
const TranslatorManager = require("./translatorManager").default;
const Selection = require("../views/Selection");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
      transOpen: true,
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

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function installObservers() {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  if (typeof global.CSSStyleSheet !== "function") {
    global.CSSStyleSheet = class {
      replaceSync() {}
    };
  } else if (typeof CSSStyleSheet.prototype.replaceSync !== "function") {
    CSSStyleSheet.prototype.replaceSync = () => {};
  }
}

describe("setting isolation at the manager boundary", () => {
  beforeAll(() => {
    installObservers();
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    apiTranslate.mockReset();
    apiTranslate.mockResolvedValue({ trText: "译文", isSame: false });
    Selection.mockImplementation(() => require("react").createElement("div"));
    Selection.mockClear();
  });

  test("modules receive nested copies, and updateRule does not reattach the originals", async () => {
    const setting = createSetting();
    const rule = createRule();
    const settingSnapshot = snapshot(setting);
    const ruleSnapshot = snapshot(rule);
    const manager = new TranslatorManager({
      setting,
      rule,
      fabConfig: { isHide: true },
      favWords: [],
      isIframe: false,
      isUserscript: true,
    });

    act(() => {
      manager.start();
    });

    const runtimeSetting = manager._translator.setting;
    expect(runtimeSetting.tranboxSetting).not.toBe(setting.tranboxSetting);
    expect(runtimeSetting.inputRule).not.toBe(setting.inputRule);
    expect(runtimeSetting.mouseHoverSetting).not.toBe(
      setting.mouseHoverSetting
    );
    expect(runtimeSetting.transApis).not.toBe(setting.transApis);
    expect(runtimeSetting.transApis[0]).not.toBe(setting.transApis[0]);
    expect(runtimeSetting.prompts).not.toBe(setting.prompts);
    expect(runtimeSetting.prompts[0]).not.toBe(setting.prompts[0]);
    expect(Selection.mock.calls[0][0].tranboxSetting).not.toBe(
      setting.tranboxSetting
    );
    expect(Selection.mock.calls[0][0].prompts[0]).not.toBe(setting.prompts[0]);

    setting.tranboxSetting.transOpen = false;
    setting.tranboxSetting.triggerMode = "sentinel";
    setting.inputRule.apiSlug = "sentinel-api";
    setting.inputRule.fromLang = "sentinel";
    setting.mouseHoverSetting.useMouseHover = true;
    setting.transApis[0].apiSlug = "sentinel-api";
    setting.prompts[0].userPrompt = "sentinel";
    rule.fromLang = "sentinel";

    expect(runtimeSetting.tranboxSetting).toEqual(
      settingSnapshot.tranboxSetting
    );
    expect(runtimeSetting.inputRule).toEqual(settingSnapshot.inputRule);
    expect(runtimeSetting.mouseHoverSetting.useMouseHover).toBe(false);
    expect(Selection.mock.calls[0][0].tranboxSetting).toEqual(
      settingSnapshot.tranboxSetting
    );
    expect(manager._translator.rule.fromLang).toBe("en");

    const storedTransOpen = setting.tranboxSetting.transOpen;
    const storedInputOpen = setting.inputRule.transOpen;
    const storedHover = setting.mouseHoverSetting.useMouseHover;
    const runtimeTransOpen = runtimeSetting.tranboxSetting.transOpen;
    const runtimeInputOpen = runtimeSetting.inputRule.transOpen;
    const runtimeHover = runtimeSetting.mouseHoverSetting.useMouseHover;
    manager._translator.toggleTransbox();
    manager._translator.toggleInputTranslate();
    manager._translator.toggleMouseHover();
    expect(setting.tranboxSetting.transOpen).toBe(storedTransOpen);
    expect(setting.inputRule.transOpen).toBe(storedInputOpen);
    expect(setting.mouseHoverSetting.useMouseHover).toBe(storedHover);
    expect(runtimeSetting.tranboxSetting.transOpen).toBe(!runtimeTransOpen);
    expect(runtimeSetting.inputRule.transOpen).toBe(!runtimeInputOpen);
    expect(runtimeSetting.mouseHoverSetting.useMouseHover).toBe(!runtimeHover);

    const nextRule = { fromLang: "ja", toLang: "ko" };
    window.dispatchEvent(
      new CustomEvent(EVENT_KISS_TRANSLATOR, {
        detail: { action: MSG_TRANS_PUTRULE, args: nextRule },
      })
    );
    expect(manager._translator.rule.fromLang).toBe("ja");
    expect(manager._translator.rule.toLang).toBe("ko");
    nextRule.fromLang = "es";
    expect(manager._translator.rule.fromLang).toBe("ja");
    expect(rule.fromLang).toBe("sentinel");
    expect(snapshot(rule)).toEqual({ ...ruleSnapshot, fromLang: "sentinel" });

    const input = document.createElement("textarea");
    input.value = "Hello from the input";
    document.body.appendChild(input);
    input.focus();
    await manager._inputTranslator.handleTranslate({ isBtnTrigger: true });
    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hello from the input",
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting: expect.objectContaining({ apiSlug: "fake-engine" }),
      })
    );

    act(() => {
      manager.stop();
    });
  });
});

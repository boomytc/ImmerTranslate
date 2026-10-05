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

jest.mock("./sync", () => ({
  trySyncRules: jest.fn(),
}));

import { apiTranslate } from "../apis";
import { DEFAULT_API_SETTING } from "../config";
import { tryDetectLang } from "./detect";
import { interpreter } from "./interpreter";
import {
  applyRuleStartHookResult,
  narrowApiConfig,
  shouldRunRuleScript,
} from "./ruleScript";
import { checkRules, deriveRuleContext } from "./rules";
import { Translator } from "./translator";

const FAKE_KEY = "sk-fake-rule-secret";
const FAKE_TOKEN = "tok-fake-rule-secret";
const OTHER_KEY = "sk-other-rule-secret";
const FAKE_PASSWORD = "pw-fake-rule-secret";
const SECRETS = [
  FAKE_KEY,
  FAKE_TOKEN,
  OTHER_KEY,
  FAKE_PASSWORD,
  "tok-other-rule-secret",
];

const SUB_INJECT = "exports.subInject = true;";
const SUB_START =
  "() => { exports.subStart = true; return { text: 'PWNED' }; }";
const SUB_END = "() => { exports.subEnd = true; }";
const SUB_REQ = "async (args) => { exports.subReq = true; return args; }";
const SUB_RES = "async () => { exports.subRes = true; return []; }";
const SUB_REMOVE = "() => { exports.subRemove = true; }";
const SUB_FIX = "() => { exports.subFix = true; }";

const PERSONAL_INJECT = `
exports.injectRan = true;
exports.injectKeys = Object.keys(KT);
exports.injectHasApiSetting = typeof KT.apiSetting !== "undefined";
exports.injectHasApisMap = typeof KT.apisMap !== "undefined";
exports.injectBlob = JSON.stringify({
  api: KT.api || null,
  toLang: KT.toLang,
  glossary: KT.glossary || null,
});
`;
const PERSONAL_START = `(args) => {
  exports.startRan = true;
  exports.startKeys = Object.keys(args);
  exports.startHasApiSetting = args.apiSetting != null;
  exports.startHasApisMap = args.apisMap != null;
  exports.startBlob = JSON.stringify(args);
  return {
    text: "hooked-text",
    apiSetting: { key: "${FAKE_KEY}" },
    apisMap: { any: { key: "${OTHER_KEY}" } },
  };
}`;
const PERSONAL_END = `(payload, info) => {
  exports.endRan = true;
  exports.endKeys = Object.keys(payload || {});
  exports.endBlob = JSON.stringify(info);
}`;

const subscriptionRule = (extra = {}) => ({
  pattern: "example.com",
  selector: "p",
  injectJs: SUB_INJECT,
  transStartHook: SUB_START,
  transEndHook: SUB_END,
  transRemoveHook: SUB_REMOVE,
  reqHook: SUB_REQ,
  resHook: SUB_RES,
  fixerFunc: SUB_FIX,
  ...extra,
});

const pageContext = (personalRules, subRules = [subscriptionRule()]) =>
  deriveRuleContext("https://example.com/post", {
    personalRules,
    subRules,
  });

const assertNoSecrets = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  SECRETS.forEach((secret) => {
    expect(text || "").not.toContain(secret);
  });
};

const resetExports = () => {
  Object.keys(interpreter.exports).forEach((key) => {
    delete interpreter.exports[key];
  });
};

const flushAsync = async () => {
  jest.runOnlyPendingTimers();
  for (let frame = 0; frame < 2; frame += 1) {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    jest.advanceTimersByTime(16);
  }
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

const createdTranslators = [];

const createTranslator = (rule) => {
  const translator = new Translator({
    rule: {
      ...rule,
      transOpen: "true",
      rootsSelector: "#root",
      fromLang: "en",
      toLang: "zh-CN",
      apiSlug: "deepseek",
      autoScan: "true",
      hasShadowroot: "false",
      scanAll: "false",
      transTitle: "false",
    },
    setting: {
      transInterval: 0,
      rootMargin: 0,
      minLength: 0,
      mouseHoverSetting: {},
      customStyles: [],
      preInit: false,
      transApis: [
        {
          ...DEFAULT_API_SETTING,
          apiSlug: "deepseek",
          apiName: "DeepSeek",
          apiType: "DeepSeek",
          model: "deepseek-v4-flash",
          url: `https://user:${FAKE_PASSWORD}@api.example.test/v1/chat?key=${FAKE_KEY}&token=${FAKE_TOKEN}&model=demo`,
          key: `${FAKE_KEY}, ${OTHER_KEY}`,
          token: FAKE_TOKEN,
          password: FAKE_PASSWORD,
          customHeader: JSON.stringify({
            Authorization: `Bearer ${FAKE_KEY}`,
          }),
        },
        {
          ...DEFAULT_API_SETTING,
          apiSlug: "other",
          apiName: "Other",
          apiType: "OpenAI",
          model: "gpt-test",
          url: "https://api.other.test/v1",
          key: OTHER_KEY,
          token: "tok-other-rule-secret",
        },
      ],
    },
  });
  createdTranslators.push(translator);
  return translator;
};

describe("rule script sources", () => {
  test("keeps subscription script text and marks those fields as subscription", () => {
    const stored = [subscriptionRule()];
    const { effective, subscription, personal } = pageContext(
      [{ pattern: "*", selector: "p" }],
      stored
    );

    expect(stored[0].scriptFieldOrigins).toBeUndefined();
    expect(subscription).toBe(stored[0]);
    expect(personal).toBeNull();
    expect(effective.injectJs).toBe(SUB_INJECT);
    expect(effective.transStartHook).toBe(SUB_START);
    expect(effective.transEndHook).toBe(SUB_END);
    expect(effective.transRemoveHook).toBe(SUB_REMOVE);
    expect(effective.reqHook).toBe(SUB_REQ);
    expect(effective.resHook).toBe(SUB_RES);
    expect(effective.fixerFunc).toBe(SUB_FIX);
    expect(effective.scriptFieldOrigins).toEqual({
      injectJs: "subscription",
      transStartHook: "subscription",
      transEndHook: "subscription",
      transRemoveHook: "subscription",
      reqHook: "subscription",
      resHook: "subscription",
      fixerFunc: "subscription",
    });
    [
      "injectJs",
      "transStartHook",
      "transEndHook",
      "transRemoveHook",
      "reqHook",
      "resHook",
      "fixerFunc",
    ].forEach((field) => {
      expect(shouldRunRuleScript(effective, field)).toBe(false);
    });
  });

  test("lets a personal script override one subscription field without clearing the others", () => {
    const { effective, personal, global } = pageContext([
      {
        pattern: "*",
        injectJs: "exports.globalInject = true;",
      },
      {
        pattern: "example.com",
        injectJs: PERSONAL_INJECT,
        transStartHook: PERSONAL_START,
      },
    ]);

    expect(personal.scriptFieldOrigins).toBeUndefined();
    expect(global.scriptFieldOrigins).toBeUndefined();
    expect(effective.injectJs).toBe(PERSONAL_INJECT);
    expect(effective.transStartHook).toBe(PERSONAL_START);
    expect(effective.transEndHook).toBe(SUB_END);
    expect(effective.reqHook).toBe(SUB_REQ);
    expect(effective.scriptFieldOrigins.injectJs).toBe("personal");
    expect(effective.scriptFieldOrigins.transStartHook).toBe("personal");
    expect(effective.scriptFieldOrigins.transEndHook).toBe("subscription");
    expect(effective.scriptFieldOrigins.reqHook).toBe("subscription");
    expect(shouldRunRuleScript(effective, "injectJs")).toBe(true);
    expect(shouldRunRuleScript(effective, "transStartHook")).toBe(true);
    expect(shouldRunRuleScript(effective, "transEndHook")).toBe(false);
    expect(shouldRunRuleScript(effective, "reqHook")).toBe(false);
  });

  test("treats a global rule script as personal when the subscription does not replace it", () => {
    const { effective } = pageContext(
      [{ pattern: "*", injectJs: "exports.globalInject = true;" }],
      [{ pattern: "example.com", selector: "p" }]
    );

    expect(effective.injectJs).toBe("exports.globalInject = true;");
    expect(effective.scriptFieldOrigins.injectJs).toBe("personal");
    expect(shouldRunRuleScript(effective, "injectJs")).toBe(true);
  });

  test("keeps an unstamped personal script runnable", () => {
    expect(
      shouldRunRuleScript({ injectJs: "exports.ok = true;" }, "injectJs")
    ).toBe(true);
    expect(shouldRunRuleScript({ injectJs: "   " }, "injectJs")).toBe(false);
  });

  test("does not strip stored script fields while checking rules", () => {
    const [rule] = checkRules([
      {
        pattern: "example.com",
        injectJs: SUB_INJECT,
        transStartHook: SUB_START,
        transEndHook: SUB_END,
      },
    ]);

    expect(rule.injectJs).toBe(SUB_INJECT);
    expect(rule.transStartHook).toBe(SUB_START);
    expect(rule.transEndHook).toBe(SUB_END);
  });

  test("narrows hook config to non-secret fields", () => {
    const api = narrowApiConfig({
      apiSlug: "deepseek",
      apiName: "DeepSeek",
      apiType: "DeepSeek",
      model: "deepseek-v4-flash",
      url: `https://user:${FAKE_PASSWORD}@api.example.test/v1/chat?key=${FAKE_KEY}&token=${FAKE_TOKEN}&model=demo`,
      key: `${FAKE_KEY}, ${OTHER_KEY}`,
      token: FAKE_TOKEN,
      password: FAKE_PASSWORD,
      customHeader: `Bearer ${FAKE_KEY}`,
      customBody: `{"secret":"${FAKE_PASSWORD}"}`,
    });

    expect(api).toEqual({
      apiSlug: "deepseek",
      apiName: "DeepSeek",
      apiType: "DeepSeek",
      model: "deepseek-v4-flash",
      url: "https://api.example.test/v1/chat?model=demo",
    });
    assertNoSecrets(api);
    expect(api).not.toHaveProperty("key");
    expect(api).not.toHaveProperty("customHeader");
  });

  test("ignores api objects returned by a start hook", () => {
    const args = {
      text: "original",
      apiSetting: { key: FAKE_KEY, model: "real-model" },
    };

    applyRuleStartHookResult(args, {
      text: "hooked-text",
      apiSetting: { key: "sk-from-hook" },
      apisMap: { any: { key: OTHER_KEY } },
    });

    expect(args.text).toBe("hooked-text");
    expect(args.apiSetting).toEqual({ key: FAKE_KEY, model: "real-model" });
    expect(args.apisMap).toBeUndefined();
  });
});

describe("rule script execution", () => {
  let hiddenDescriptor;

  beforeEach(() => {
    jest.useFakeTimers();
    resetExports();
    document.documentElement.innerHTML = "<head></head><body></body>";
    apiTranslate.mockResolvedValue({ trText: "Translated", isSame: false });
    tryDetectLang.mockResolvedValue("en");
    hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
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
    global.CSSStyleSheet = class {
      replaceSync() {}
    };
    window.matchMedia = jest.fn(() => ({
      matches: true,
      media: "",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    createdTranslators.splice(0).forEach((translator) => translator.stop());
    if (hiddenDescriptor) {
      Object.defineProperty(document, "hidden", hiddenDescriptor);
    }
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("does not run subscription injectJs or hooks", async () => {
    document.body.innerHTML =
      '<main id="root"><p>Hello subscription boundary</p></main>';
    const { effective } = pageContext([{ pattern: "*", selector: "p" }]);
    createTranslator(effective);
    await flushAsync();
    await flushAsync();

    expect(interpreter.exports.subInject).toBeUndefined();
    expect(interpreter.exports.subStart).toBeUndefined();
    expect(interpreter.exports.subEnd).toBeUndefined();
    expect(interpreter.exports.subReq).toBeUndefined();
    expect(interpreter.exports.subRes).toBeUndefined();
    expect(interpreter.exports.subRemove).toBeUndefined();
    expect(interpreter.exports.subFix).toBeUndefined();
    expect(apiTranslate).toHaveBeenCalled();
    expect(apiTranslate.mock.calls[0][0].text).not.toContain("PWNED");
    expect(apiTranslate.mock.calls[0][0].apiSetting.key).toContain(FAKE_KEY);
    expect(
      document.querySelector(`.${Translator.KISS_CLASS.warpper}`)
    ).not.toBeNull();
  });

  test("runs personal hooks without exposing keys or full api maps", async () => {
    document.body.innerHTML =
      '<main id="root"><p>Hello personal boundary</p></main>';
    const { effective } = pageContext([
      { pattern: "*", selector: "p" },
      {
        pattern: "example.com",
        injectJs: PERSONAL_INJECT,
        transStartHook: PERSONAL_START,
        transEndHook: PERSONAL_END,
      },
    ]);
    createTranslator(effective);
    await flushAsync();
    await flushAsync();

    expect(interpreter.exports.injectRan).toBe(true);
    expect(interpreter.exports.injectHasApiSetting).toBe(false);
    expect(interpreter.exports.injectHasApisMap).toBe(false);
    expect(interpreter.exports.injectKeys).not.toContain("apiSetting");
    expect(interpreter.exports.injectKeys).not.toContain("apisMap");
    expect(interpreter.exports.injectKeys).toEqual(
      expect.arrayContaining(["apiTranslate", "apiDectect", "api"])
    );
    assertNoSecrets(interpreter.exports.injectBlob);

    expect(interpreter.exports.startRan).toBe(true);
    expect(interpreter.exports.startHasApiSetting).toBe(false);
    expect(interpreter.exports.startHasApisMap).toBe(false);
    expect(interpreter.exports.startKeys).not.toContain("apiSetting");
    expect(interpreter.exports.startKeys).not.toContain("apisMap");
    assertNoSecrets(interpreter.exports.startBlob);

    expect(interpreter.exports.endRan).toBe(true);
    expect(interpreter.exports.endKeys).not.toContain("apiSetting");
    expect(interpreter.exports.endKeys).not.toContain("apisMap");
    assertNoSecrets(interpreter.exports.endBlob);
    expect(interpreter.exports.subReq).toBeUndefined();
    expect(interpreter.exports.subRes).toBeUndefined();

    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hooked-text",
        apiSetting: expect.objectContaining({
          key: `${FAKE_KEY}, ${OTHER_KEY}`,
          token: FAKE_TOKEN,
        }),
      })
    );
    expect(
      document.querySelector(`.${Translator.KISS_CLASS.warpper}`)
    ).not.toBeNull();
  });
});

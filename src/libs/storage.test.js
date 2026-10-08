import {
  STOKEY_SETTING,
  SETTINGS_VERSION_V3,
  DEFAULT_SUBTITLE_SETTING,
  DEFAULT_API_LIST,
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_DEEPSEEK,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_MICROSOFT,
  OPT_TRANS_OPENAI,
  OPT_TRANS_TENCENT,
  OPT_INPUT_DOT_ALWAYS,
  OPT_INPUT_DOT_DISABLE,
  OPT_INPUT_DOT_MOBILE,
} from "../config";
import { getSettingWithDefault } from "./storage";

// 存储测试不涉及流式解析，隔离 ESM-only 依赖以免 Jest 27 在加载阶段失败。
jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));
// jsdom 并非扩展页面，使用空实现避免 webextension-polyfill 在模块初始化时主动抛错。
jest.mock("webextension-polyfill", () => ({}));

const readStoredJson = (key) => JSON.parse(window.localStorage.getItem(key));

function loadGmStorageModule() {
  let storageModule;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({
      isExt: false,
      isGm: true,
    }));
    storageModule = require("./storage");
  });
  jest.dontMock("./client");
  return storageModule;
}

describe("settings storage migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.KISS_GM;
    delete globalThis.GM;
    delete globalThis.GM_setValue;
    delete globalThis.GM_getValue;
    delete globalThis.GM_deleteValue;
  });

  afterEach(() => {
    delete globalThis.GM;
    delete globalThis.GM_setValue;
    delete globalThis.GM_getValue;
    delete globalThis.GM_deleteValue;
  });

  test.each([
    [undefined, true, SETTINGS_VERSION_V3, true],
    [2, false, 2, false],
    [SETTINGS_VERSION_V3, "auto", SETTINGS_VERSION_V3, "auto"],
  ])(
    "keeps stored version %p and theme %p without persisting",
    async (version, darkMode, expectedVersion, expectedTheme) => {
      const oldSetting = { version, darkMode, uiLang: "en" };
      const serialized = JSON.stringify(oldSetting);
      window.localStorage.setItem(STOKEY_SETTING, serialized);
      const setItem = jest.spyOn(window.Storage.prototype, "setItem");
      try {
        await expect(getSettingWithDefault()).resolves.toMatchObject({
          version: expectedVersion,
          darkMode: expectedTheme,
          uiLang: "en",
        });
        expect(setItem).not.toHaveBeenCalled();
        expect(window.localStorage.getItem(STOKEY_SETTING)).toBe(serialized);
        expect(oldSetting.darkMode).toBe(darkMode);
      } finally {
        setItem.mockRestore();
      }
    }
  );

  test("merges the language variant default without overriding an explicit choice", async () => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({ version: SETTINGS_VERSION_V3, uiLang: "zh" })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      translateVariants: true,
    });

    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        translateVariants: false,
      })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      translateVariants: false,
    });
  });

  test("keeps clipboard auto-translation opt-in for existing settings", async () => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({ version: SETTINGS_VERSION_V3, uiLang: "zh" })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      autoTranslateClipboard: false,
    });

    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        autoTranslateClipboard: true,
      })
    );
    await expect(getSettingWithDefault()).resolves.toMatchObject({
      autoTranslateClipboard: true,
    });
  });

  test("keeps a stored mobile input dot without persisting", async () => {
    const storedSetting = {
      version: SETTINGS_VERSION_V3,
      uiLang: "zh",
      inputRule: { showDot: OPT_INPUT_DOT_MOBILE, toLang: "zh-CN" },
    };
    const serialized = JSON.stringify(storedSetting);
    window.localStorage.setItem(STOKEY_SETTING, serialized);
    const setItem = jest.spyOn(window.Storage.prototype, "setItem");
    try {
      await expect(getSettingWithDefault()).resolves.toMatchObject({
        inputRule: { showDot: OPT_INPUT_DOT_MOBILE, toLang: "zh-CN" },
      });
      expect(setItem).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(STOKEY_SETTING)).toBe(serialized);
    } finally {
      setItem.mockRestore();
    }
  });

  test.each([
    [{ showDot: OPT_INPUT_DOT_DISABLE }, OPT_INPUT_DOT_DISABLE],
    [{ showDot: OPT_INPUT_DOT_MOBILE }, OPT_INPUT_DOT_MOBILE],
    [{ showDot: OPT_INPUT_DOT_ALWAYS }, OPT_INPUT_DOT_ALWAYS],
  ])("keeps an explicit input dot %#", async (inputRule, showDot) => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({ version: SETTINGS_VERSION_V3, inputRule })
    );

    await expect(getSettingWithDefault()).resolves.toMatchObject({
      inputRule: { showDot },
    });
  });

  test("does not replace explicitly stored Tencent entry points", async () => {
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        inputRule: { apiSlug: OPT_TRANS_TENCENT },
        tranboxSetting: { apiSlugs: [OPT_TRANS_TENCENT] },
        subtitleSetting: { apiSlug: OPT_TRANS_TENCENT },
      })
    );

    await expect(getSettingWithDefault()).resolves.toMatchObject({
      inputRule: { apiSlug: OPT_TRANS_TENCENT },
      tranboxSetting: { apiSlugs: [OPT_TRANS_TENCENT] },
      subtitleSetting: { apiSlug: OPT_TRANS_TENCENT },
    });
  });

  test("keeps an explicitly stored subtitle chunk length", async () => {
    // 新默认值只影响新配置；已有用户明确保存的 2000 不应被默认设置覆盖。
    expect(DEFAULT_SUBTITLE_SETTING.chunkLength).toBe(1000);
    window.localStorage.setItem(
      STOKEY_SETTING,
      JSON.stringify({
        version: SETTINGS_VERSION_V3,
        subtitleSetting: { chunkLength: 2000 },
      })
    );

    const setting = await getSettingWithDefault();

    expect(setting.subtitleSetting.chunkLength).toBe(2000);
  });

  test("normalizes legacy default thinking effort only in the loaded setting", async () => {
    const storedSetting = {
      version: SETTINGS_VERSION_V3,
      transApis: [
        {
          apiSlug: "openai",
          apiType: OPT_TRANS_OPENAI,
          model: "gpt-5.6-sol",
          thinkingMode: "enabled",
          thinkingEffort: "_default",
        },
      ],
    };
    window.localStorage.setItem(STOKEY_SETTING, JSON.stringify(storedSetting));

    const setting = await getSettingWithDefault();

    expect(setting.transApis[0].thinkingEffort).toBeNull();
    expect(readStoredJson(STOKEY_SETTING)).toEqual(storedSetting);
  });

  test("normalizes thinking settings for a fresh installation", async () => {
    const setting = await getSettingWithDefault();
    const deepseek = setting.transApis.find(
      (api) => api.apiType === OPT_TRANS_DEEPSEEK
    );

    expect(deepseek).toMatchObject({
      thinkingMode: "disabled",
      thinkingEffort: null,
    });
  });

  test("enables only the initial two services for a fresh installation", async () => {
    const setting = await getSettingWithDefault();

    expect(setting.transApis).toHaveLength(DEFAULT_API_LIST.length);
    expect(
      setting.transApis
        .filter((api) => !api.isDisabled)
        .map((api) => api.apiType)
    ).toEqual([
      OPT_TRANS_GOOGLE,
      OPT_TRANS_MICROSOFT,
    ]);
    expect(
      setting.transApis.find((api) => api.apiType === OPT_TRANS_BUILTINAI)
    ).toMatchObject({
      isDisabled: true,
      sortOrder: 999,
    });
  });

  test.each([1, 2, SETTINGS_VERSION_V3])(
    "preserves saved service activation choices from settings version %p",
    async (version) => {
      const savedApis = [
        {
          ...DEFAULT_API_LIST.find((api) => api.apiType === OPT_TRANS_OPENAI),
          isDisabled: false,
          sortOrder: -1,
          key: "saved-key",
        },
        {
          ...DEFAULT_API_LIST.find(
            (api) => api.apiType === OPT_TRANS_MICROSOFT
          ),
          isDisabled: true,
          sortOrder: 999,
        },
        {
          apiSlug: "legacy-tencent",
          apiType: OPT_TRANS_TENCENT,
        },
      ];
      const storedSetting = { version, transApis: savedApis };
      window.localStorage.setItem(
        STOKEY_SETTING,
        JSON.stringify(storedSetting)
      );

      const setting = await getSettingWithDefault();

      expect(setting.transApis).toHaveLength(savedApis.length);
      savedApis.forEach((savedApi, index) => {
        const loadedApi = setting.transApis[index];
        [
          "apiSlug",
          "apiName",
          "apiType",
          "isDisabled",
          "sortOrder",
          "key",
        ].forEach((field) => {
          if (Object.prototype.hasOwnProperty.call(savedApi, field)) {
            expect(loadedApi).toHaveProperty(field, savedApi[field]);
          } else {
            expect(loadedApi).not.toHaveProperty(field);
          }
        });
      });
      expect(readStoredJson(STOKEY_SETTING)).toEqual(storedSetting);
    }
  );

  test.each(["none", "minimal", "_default"])(
    "loads legacy Astra disabled effort %s as low without rewriting storage",
    async (thinkingEffort) => {
      const storedSetting = {
        version: SETTINGS_VERSION_V3,
        transApis: [
          {
            apiSlug: "openai",
            apiType: OPT_TRANS_OPENAI,
            model: "gpt-6-astra",
            thinkingMode: "disabled",
            thinkingEffort,
          },
        ],
      };
      window.localStorage.setItem(
        STOKEY_SETTING,
        JSON.stringify(storedSetting)
      );
      const setting = await getSettingWithDefault();
      expect(setting.transApis[0].thinkingEffort).toBe("low");
      expect(readStoredJson(STOKEY_SETTING)).toEqual(storedSetting);
    }
  );

  test("GM storage reports a clear error when GM APIs are unavailable", async () => {
    const { storage } = loadGmStorageModule();

    await expect(storage.get("missing-gm")).rejects.toThrow(
      "GM API is not available"
    );
  });

  test("GM storage uses KISS_GM when it is available", async () => {
    const stored = new Map();
    window.KISS_GM = {
      setValue: jest.fn(async (key, value) => stored.set(key, value)),
      getValue: jest.fn(async (key) => stored.get(key)),
      deleteValue: jest.fn(async (key) => stored.delete(key)),
    };
    globalThis.GM = {
      setValue: jest.fn(),
      getValue: jest.fn(),
      deleteValue: jest.fn(),
    };
    const { storage } = loadGmStorageModule();

    await storage.setObj("gm-key", { local: true });
    await expect(storage.getObj("gm-key")).resolves.toEqual({ local: true });
    await storage.del("gm-key");

    expect(window.KISS_GM.setValue).toHaveBeenCalledWith(
      "gm-key",
      JSON.stringify({ local: true })
    );
    expect(window.KISS_GM.getValue).toHaveBeenCalledWith("gm-key");
    expect(window.KISS_GM.deleteValue).toHaveBeenCalledWith("gm-key");
    expect(globalThis.GM.setValue).not.toHaveBeenCalled();
    expect(globalThis.GM.getValue).not.toHaveBeenCalled();
    expect(globalThis.GM.deleteValue).not.toHaveBeenCalled();
    expect(stored.has("gm-key")).toBe(false);
  });

  test("GM storage uses native GM storage APIs without KISS_GM", async () => {
    const stored = new Map();
    globalThis.GM = {
      setValue: jest.fn(async (key, value) => stored.set(key, value)),
      getValue: jest.fn(async (key) => stored.get(key)),
      deleteValue: jest.fn(async (key) => stored.delete(key)),
    };
    globalThis.GM_setValue = jest.fn();
    globalThis.GM_getValue = jest.fn();
    globalThis.GM_deleteValue = jest.fn();
    const { storage } = loadGmStorageModule();

    await storage.setObj("native-gm-key", { ios: true });
    await expect(storage.getObj("native-gm-key")).resolves.toEqual({
      ios: true,
    });
    await storage.del("native-gm-key");

    expect(globalThis.GM.setValue).toHaveBeenCalledWith(
      "native-gm-key",
      JSON.stringify({ ios: true })
    );
    expect(globalThis.GM.getValue).toHaveBeenCalledWith("native-gm-key");
    expect(globalThis.GM.deleteValue).toHaveBeenCalledWith("native-gm-key");
    expect(globalThis.GM_setValue).not.toHaveBeenCalled();
    expect(globalThis.GM_getValue).not.toHaveBeenCalled();
    expect(globalThis.GM_deleteValue).not.toHaveBeenCalled();
    expect(stored.has("native-gm-key")).toBe(false);
  });

  test("GM storage falls back to legacy GM storage APIs", async () => {
    const stored = new Map();
    globalThis.GM = {};
    globalThis.GM_setValue = jest.fn(async (key, value) =>
      stored.set(key, value)
    );
    globalThis.GM_getValue = jest.fn(async (key) => stored.get(key));
    globalThis.GM_deleteValue = jest.fn(async (key) => stored.delete(key));
    const { storage } = loadGmStorageModule();

    await storage.setObj("legacy-gm-key", { ios: true });
    await expect(storage.getObj("legacy-gm-key")).resolves.toEqual({
      ios: true,
    });
    await storage.del("legacy-gm-key");

    expect(globalThis.GM_setValue).toHaveBeenCalledWith(
      "legacy-gm-key",
      JSON.stringify({ ios: true })
    );
    expect(globalThis.GM_getValue).toHaveBeenCalledWith("legacy-gm-key");
    expect(globalThis.GM_deleteValue).toHaveBeenCalledWith("legacy-gm-key");
    expect(stored.has("legacy-gm-key")).toBe(false);
  });
});

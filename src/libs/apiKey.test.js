import {
  DEFAULT_API_LIST,
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_DEEPL,
  OPT_TRANS_DEEPLFREE,
  OPT_TRANS_DEEPSEEK,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_GOOGLE_CLOUD,
  OPT_TRANS_MICROSOFT,
  OPT_TRANS_OLLAMA,
  OPT_TRANS_YANDEXFREE,
} from "../config";
import {
  apiRequiresKey,
  configuredByokApis,
  isMissingRequiredApiKey,
} from "./apiKey";

describe("api key requirement", () => {
  test.each([
    OPT_TRANS_BUILTINAI,
    OPT_TRANS_GOOGLE,
    OPT_TRANS_MICROSOFT,
    OPT_TRANS_DEEPLFREE,
    OPT_TRANS_YANDEXFREE,
    OPT_TRANS_OLLAMA,
  ])("keeps the keyless %s path", (apiType) => {
    expect(apiRequiresKey({ apiType, key: "" })).toBe(false);
    expect(
      isMissingRequiredApiKey({ apiType, apiSlug: apiType, key: "" })
    ).toBe(false);
  });

  test.each([OPT_TRANS_DEEPSEEK, OPT_TRANS_DEEPL, OPT_TRANS_GOOGLE_CLOUD])(
    "treats an empty %s key as missing",
    (apiType) => {
      expect(apiRequiresKey({ apiType, key: "  " })).toBe(true);
      expect(
        isMissingRequiredApiKey({ apiType, apiSlug: apiType, key: "  " })
      ).toBe(true);
      expect(
        isMissingRequiredApiKey({
          apiType,
          apiSlug: apiType,
          key: "sk-present",
        })
      ).toBe(false);
    }
  );
});

describe("configuredByokApis default behavior", () => {
  test("retains only Google and Microsoft from DEFAULT_API_LIST and excludes BuiltinAI", () => {
    const list = configuredByokApis(DEFAULT_API_LIST);
    expect(list.map((api) => api.apiType)).toEqual([
      OPT_TRANS_GOOGLE,
      OPT_TRANS_MICROSOFT,
    ]);
    expect(
      list.find((api) => api.apiType === OPT_TRANS_BUILTINAI)
    ).toBeUndefined();
  });
});

describe("configuredByokApis BuiltinAI environment check", () => {
  const originalLanguageDetector = globalThis.LanguageDetector;
  const originalTranslator = globalThis.Translator;

  afterEach(() => {
    globalThis.LanguageDetector = originalLanguageDetector;
    globalThis.Translator = originalTranslator;
  });

  test("filters out BuiltinAI when host environment does not support it even if enabled", () => {
    delete globalThis.LanguageDetector;
    delete globalThis.Translator;

    const list = configuredByokApis([
      {
        apiSlug: "BuiltinAI",
        apiType: OPT_TRANS_BUILTINAI,
        key: "",
        isDisabled: false,
        sortOrder: 0,
      },
      {
        apiSlug: "Microsoft",
        apiType: OPT_TRANS_MICROSOFT,
        key: "",
        isDisabled: false,
        sortOrder: 1,
      },
    ]);

    expect(list.map((api) => api.apiSlug)).toEqual(["Microsoft"]);
  });

  test("includes BuiltinAI when host environment supports it and it is enabled", () => {
    globalThis.LanguageDetector = {};
    globalThis.Translator = { availability: () => Promise.resolve("readily") };

    const list = configuredByokApis([
      {
        apiSlug: "BuiltinAI",
        apiType: OPT_TRANS_BUILTINAI,
        key: "",
        isDisabled: false,
        sortOrder: 0,
      },
      {
        apiSlug: "Microsoft",
        apiType: OPT_TRANS_MICROSOFT,
        key: "",
        isDisabled: false,
        sortOrder: 1,
      },
    ]);

    expect(list.map((api) => api.apiSlug)).toEqual(["BuiltinAI", "Microsoft"]);
  });

  test("excludes BuiltinAI when disabled even if host environment supports it", () => {
    globalThis.LanguageDetector = {};
    globalThis.Translator = { availability: () => Promise.resolve("readily") };

    const list = configuredByokApis([
      {
        apiSlug: "BuiltinAI",
        apiType: OPT_TRANS_BUILTINAI,
        key: "",
        isDisabled: true,
        sortOrder: 0,
      },
      {
        apiSlug: "Microsoft",
        apiType: OPT_TRANS_MICROSOFT,
        key: "",
        isDisabled: false,
        sortOrder: 1,
      },
    ]);

    expect(list.map((api) => api.apiSlug)).toEqual(["Microsoft"]);
  });
});

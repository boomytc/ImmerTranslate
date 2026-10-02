import {
  DEFAULT_API_LIST,
  OPT_TRANS_BUILTINAI,
  OPT_TRANS_DEEPL,
  OPT_TRANS_DEEPLFREE,
  OPT_TRANS_DEEPSEEK,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_GOOGLE_2,
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
    OPT_TRANS_GOOGLE_2,
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

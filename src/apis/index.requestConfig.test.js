jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("../libs/fetch", () => ({
  fetchData: jest.fn(),
  fetchStream: jest.fn(),
  fnPolyfill: jest.fn(),
}));

jest.mock("../libs/browser", () => ({
  isBuiltinAIAvailable: false,
  isBg: () => false,
}));

jest.mock("../libs/storage", () => ({ getSetting: jest.fn() }));
jest.mock("../libs/cache", () => ({
  getHttpCachePolyfill: jest.fn(),
  putHttpCachePolyfill: jest.fn(),
}));
jest.mock("../libs/docInfo", () => ({
  getDocInfo: () => ({ title: "Doc", description: "Desc", summary: "" }),
}));

jest.mock("./trans", () => ({
  handleTranslate: jest.fn(),
  handleDict: jest.fn(),
  handleSubtitle: jest.fn(),
  handleSummarize: jest.fn(),
  buildSubtitleSystemPrompt: ({ subtitlePrompt }) => subtitlePrompt || "",
  formatIndexSubtitleEvents: (events) =>
    events.map((event, id) => ({ id, text: event.text })),
}));

import {
  apiDict,
  apiSubtitle,
  apiSummarizeContext,
  apiTranslate,
} from "./index";
import {
  handleDict,
  handleSubtitle,
  handleSummarize,
  handleTranslate,
} from "./trans";
import { getHttpCachePolyfill, putHttpCachePolyfill } from "../libs/cache";
import { clearAllBatchQueue } from "../libs/batchQueue";
import {
  DEFAULT_API_LIST,
  OPT_TRANS_GOOGLE,
  OPT_TRANS_OPENAI,
} from "../config";

const SECRET = "super-secret-key-value";

const openAiSetting = (overrides = {}) => ({
  ...DEFAULT_API_LIST.find((api) => api.apiType === OPT_TRANS_OPENAI),
  apiSlug: "openai_fingerprint",
  key: SECRET,
  model: "model-a",
  url: "https://api.example/v1/chat/completions",
  useBatchFetch: false,
  useStream: false,
  systemPrompt: "translate plainly",
  dictPrompt: "define {{text}}",
  dictUserPrompt: "explain {{text}}",
  ...overrides,
});

const cacheParams = (cacheInput) =>
  new URLSearchParams(cacheInput.split("?")[1]);

const reqSigOf = (cacheInput) => cacheParams(cacheInput).get("reqSig");

describe("request config cache and batch isolation", () => {
  let cache;

  beforeEach(() => {
    cache = new Map();
    getHttpCachePolyfill.mockImplementation(async (key) => cache.get(key));
    putHttpCachePolyfill.mockImplementation(async (key, _init, value) => {
      cache.set(key, value);
    });
    handleTranslate.mockImplementation(async function* (texts, options) {
      const { model, url } = options.apiSetting;
      for (let id = 0; id < texts.length; id += 1) {
        yield {
          id,
          result: [`${model}|${url}|${texts[id]}`, "en"],
        };
      }
    });
    handleDict.mockImplementation(
      async ({ text, apiSetting }) =>
        `${apiSetting.model}|${apiSetting.url}|${text}`
    );
    handleSubtitle.mockImplementation(async ({ apiSetting }) => [
      {
        text: "hello",
        translation: `${apiSetting.model}|${apiSetting.url}`,
      },
    ]);
    handleSummarize.mockImplementation(
      async ({ apiSetting }) => `${apiSetting.model}|${apiSetting.url}`
    );
  });

  afterEach(() => {
    clearAllBatchQueue();
    jest.clearAllMocks();
  });

  test("does not reuse a translation cached for another model or base URL", async () => {
    const translate = (overrides) =>
      apiTranslate({
        text: "hello",
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting: openAiSetting(overrides),
        useCache: true,
      });

    const modelA = await translate({ model: "model-a" });
    const modelB = await translate({ model: "model-b" });
    const modelAAgain = await translate({ model: "model-a" });
    const otherUrl = await translate({
      model: "model-a",
      url: "https://proxy.example/v1/chat/completions",
    });
    const originalUrlAgain = await translate({ model: "model-a" });

    expect(modelA.trText).toBe(
      "model-a|https://api.example/v1/chat/completions|hello"
    );
    expect(modelB.trText).toBe(
      "model-b|https://api.example/v1/chat/completions|hello"
    );
    expect(modelB.trText).not.toBe(modelA.trText);
    expect(modelAAgain.trText).toBe(modelA.trText);
    expect(otherUrl.trText).toBe(
      "model-a|https://proxy.example/v1/chat/completions|hello"
    );
    expect(originalUrlAgain.trText).toBe(modelA.trText);
    expect(handleTranslate).toHaveBeenCalledTimes(3);

    const cacheKeys = putHttpCachePolyfill.mock.calls.map(([key]) => key);
    expect(new Set(cacheKeys).size).toBe(3);
    cacheKeys.forEach((key) => {
      expect(key).toContain("reqSig=");
      expect(key).not.toContain(SECRET);
    });
  });

  test("does not reuse a dictionary entry cached for another model or base URL", async () => {
    const define = (overrides) =>
      apiDict({
        text: "library",
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting: openAiSetting(overrides),
        context: "The library is open.",
        useCache: true,
      });

    const modelA = await define({ model: "model-a" });
    const modelB = await define({ model: "model-b" });
    const modelAAgain = await define({ model: "model-a" });
    const otherUrl = await define({
      model: "model-a",
      url: "https://proxy.example/v1/chat/completions",
    });

    expect(modelA).toBe(
      "model-a|https://api.example/v1/chat/completions|library"
    );
    expect(modelB).toBe(
      "model-b|https://api.example/v1/chat/completions|library"
    );
    expect(modelAAgain).toBe(modelA);
    expect(otherUrl).toBe(
      "model-a|https://proxy.example/v1/chat/completions|library"
    );
    expect(handleDict).toHaveBeenCalledTimes(3);
    putHttpCachePolyfill.mock.calls.forEach(([key]) => {
      expect(key).toContain("reqSig=");
      expect(key).not.toContain(SECRET);
    });
  });

  test("keeps different models and base URLs out of the same batch queue", async () => {
    const submit = (text, overrides) =>
      apiTranslate({
        text,
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting: openAiSetting({
          useBatchFetch: true,
          batchInterval: 0,
          batchSize: 2,
          ...overrides,
        }),
        useCache: false,
      });

    const [sameA, sameB] = await Promise.all([
      submit("alpha", { model: "model-a" }),
      submit("beta", { model: "model-a" }),
    ]);
    expect(handleTranslate).toHaveBeenCalledTimes(1);
    expect([...handleTranslate.mock.calls[0][0]].sort()).toEqual([
      "alpha",
      "beta",
    ]);
    expect(sameA.trText).toContain("|alpha");
    expect(sameB.trText).toContain("|beta");
    expect(sameA.trText).toContain("model-a|");
    expect(sameB.trText).toContain("model-a|");

    clearAllBatchQueue();
    handleTranslate.mockClear();
    await Promise.all([
      submit("alpha", { model: "model-a" }),
      submit("beta", { model: "model-b" }),
    ]);
    expect(handleTranslate).toHaveBeenCalledTimes(2);
    expect(
      handleTranslate.mock.calls
        .map(
          ([texts, options]) => `${options.apiSetting.model}:${texts.join()}`
        )
        .sort()
    ).toEqual(["model-a:alpha", "model-b:beta"]);

    clearAllBatchQueue();
    handleTranslate.mockClear();
    await Promise.all([
      submit("alpha", {
        model: "model-a",
        url: "https://api.example/v1/chat/completions",
      }),
      submit("beta", {
        model: "model-a",
        url: "https://proxy.example/v1/chat/completions",
      }),
    ]);
    expect(handleTranslate).toHaveBeenCalledTimes(2);
    expect(
      handleTranslate.mock.calls
        .map(([texts, options]) => `${options.apiSetting.url}:${texts.join()}`)
        .sort()
    ).toEqual([
      "https://api.example/v1/chat/completions:alpha",
      "https://proxy.example/v1/chat/completions:beta",
    ]);
  });

  test("does not reuse a subtitle cached for another model or base URL", async () => {
    const events = [{ start: 0, end: 1000, text: "hello" }];
    const translate = (overrides) =>
      apiSubtitle({
        videoId: "video-1",
        chunkSign: "0 --> 1000",
        fromLang: "en",
        toLang: "zh-CN",
        events,
        apiSetting: openAiSetting({
          subtitlePrompt: "subtitle prompt",
          ...overrides,
        }),
      });

    const modelA = await translate({ model: "model-a" });
    const modelB = await translate({ model: "model-b" });
    const modelAAgain = await translate({ model: "model-a" });
    const otherUrl = await translate({
      model: "model-a",
      url: "https://proxy.example/v1/chat/completions",
    });

    expect(modelA[0].translation).toBe(
      "model-a|https://api.example/v1/chat/completions"
    );
    expect(modelB[0].translation).toBe(
      "model-b|https://api.example/v1/chat/completions"
    );
    expect(modelAAgain).toBe(modelA);
    expect(otherUrl[0].translation).toBe(
      "model-a|https://proxy.example/v1/chat/completions"
    );
    expect(handleSubtitle).toHaveBeenCalledTimes(3);
    putHttpCachePolyfill.mock.calls.forEach(([key]) => {
      expect(key).toContain("reqSig=");
      expect(key).not.toContain(SECRET);
    });
  });

  test("does not reuse a context summary cached for another model or base URL", async () => {
    const summarize = (overrides) =>
      apiSummarizeContext({
        videoId: "video-1",
        title: "Title",
        description: "Description",
        transcript: "hello world",
        apiSetting: openAiSetting(overrides),
      });

    const modelA = await summarize({ model: "model-a" });
    const modelB = await summarize({ model: "model-b" });
    const modelAAgain = await summarize({ model: "model-a" });
    const otherUrl = await summarize({
      model: "model-a",
      url: "https://proxy.example/v1/chat/completions",
    });

    expect(modelA).toBe("model-a|https://api.example/v1/chat/completions");
    expect(modelB).toBe("model-b|https://api.example/v1/chat/completions");
    expect(modelAAgain).toBe(modelA);
    expect(otherUrl).toBe("model-a|https://proxy.example/v1/chat/completions");
    expect(handleSummarize).toHaveBeenCalledTimes(3);
    const keys = putHttpCachePolyfill.mock.calls.map(([key]) => key);
    expect(new Set(keys.map(reqSigOf)).size).toBe(3);
    keys.forEach((key) => expect(key).not.toContain(SECRET));
  });

  test("reads the legacy Google2 cache with a new-format fingerprint", async () => {
    const reads = [];
    getHttpCachePolyfill.mockImplementation(async (cacheInput) => {
      reads.push(cacheInput);
      if (cacheInput.includes("apiSlug=Google2")) {
        return { trText: "历史谷歌2缓存译文", srLang: "en", srCode: "en" };
      }
      return null;
    });

    const result = await apiTranslate({
      text: "legacy cache test",
      fromLang: "auto",
      toLang: "zh-CN",
      apiSetting: {
        ...DEFAULT_API_LIST.find((api) => api.apiType === OPT_TRANS_GOOGLE),
        apiType: OPT_TRANS_GOOGLE,
        apiSlug: OPT_TRANS_GOOGLE,
        key: SECRET,
        url: "https://translate.googleapis.com/translate_a/single",
      },
      useCache: true,
    });

    expect(result.trText).toBe("历史谷歌2缓存译文");
    expect(handleTranslate).not.toHaveBeenCalled();
    expect(reads).toHaveLength(2);
    expect(cacheParams(reads[0]).get("apiSlug")).toBe("Google");
    expect(cacheParams(reads[1]).get("apiSlug")).toBe("Google2");
    expect(reqSigOf(reads[0])).toBeTruthy();
    expect(reqSigOf(reads[1])).toBeTruthy();
    expect(reqSigOf(reads[0])).not.toBe(reqSigOf(reads[1]));
    reads.forEach((key) => expect(key).not.toContain(SECRET));
  });
});

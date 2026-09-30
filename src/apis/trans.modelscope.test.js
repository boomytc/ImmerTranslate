jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () => ({
  JSONParser: jest.fn(),
}));

jest.mock("../libs/fetch", () => ({
  fetchData: jest.fn(),
  fetchStream: jest.fn(),
}));

jest.mock("../libs/docInfo", () => ({
  getDocInfo: () => ({}),
}));

import { handleTranslate } from "./trans";
import {
  API_SPE_TYPES,
  DEFAULT_API_LIST,
  MODELSCOPE_CHAT_COMPLETIONS_URL,
  MODELSCOPE_MODELS_URL,
  OPT_TRANS_MODELSCOPE,
  resolveApiPromptSettings,
} from "../config";
import { fetchData } from "../libs/fetch";

const getApiSetting = (update = {}) =>
  resolveApiPromptSettings({
    ...DEFAULT_API_LIST.find((api) => api.apiType === OPT_TRANS_MODELSCOPE),
    useStream: false,
    useBatchFetch: false,
    key: "modelscope-test-key",
    fetchInterval: 0,
    fetchLimit: 1,
    httpTimeout: 1000,
    ...update,
  });

describe("ModelScope interface", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("ships the OpenAI-compatible chat URL and native model list URL", () => {
    const api = DEFAULT_API_LIST.find(
      (item) => item.apiType === OPT_TRANS_MODELSCOPE
    );

    expect(api).toMatchObject({
      url: MODELSCOPE_CHAT_COMPLETIONS_URL,
      modelListUrl: MODELSCOPE_MODELS_URL,
      model: "Qwen/Qwen3-32B",
      key: "",
    });
    expect(API_SPE_TYPES.ai.has(OPT_TRANS_MODELSCOPE)).toBe(true);
    expect(API_SPE_TYPES.stream.has(OPT_TRANS_MODELSCOPE)).toBe(true);
  });

  test("sends a bearer chat completion", async () => {
    fetchData.mockResolvedValueOnce({
      choices: [
        {
          message: { role: "assistant", content: "你好" },
        },
      ],
    });

    const result = [];
    for await (const item of handleTranslate(["Hello"], {
      from: "en",
      to: "zh-CN",
      fromLang: "English",
      toLang: "Chinese",
      langMap: () => "",
      glossary: "",
      apiSetting: getApiSetting(),
      usePool: false,
    })) {
      result.push(item);
    }

    expect(fetchData).toHaveBeenCalledTimes(1);
    const [url, init] = fetchData.mock.calls[0];
    expect(url).toBe(MODELSCOPE_CHAT_COMPLETIONS_URL);
    expect(init.headers.Authorization).toBe("Bearer modelscope-test-key");
    expect(JSON.parse(init.body).model).toBe("Qwen/Qwen3-32B");
    expect(result[0].result[0]).toBe("你好");
  });
});

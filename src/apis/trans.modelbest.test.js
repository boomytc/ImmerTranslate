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

import { genTransReq, handleTranslate } from "./trans";
import {
  DEFAULT_API_LIST,
  MODELBEST_CHAT_COMPLETIONS_URL,
  OPT_TRANS_MODELBEST,
  resolveApiPromptSettings,
} from "../config";
import { fetchData } from "../libs/fetch";

const getApiSetting = (update = {}) =>
  resolveApiPromptSettings({
    ...DEFAULT_API_LIST.find((api) => api.apiType === OPT_TRANS_MODELBEST),
    useStream: false,
    useBatchFetch: false,
    key: "modelbest-test-key",
    fetchInterval: 0,
    fetchLimit: 1,
    httpTimeout: 1000,
    ...update,
  });

const requestBody = async (update = {}) => {
  const [, init] = await genTransReq({
    ...getApiSetting(update),
    texts: ["Hello"],
    from: "en",
    to: "zh-CN",
    fromLang: "English",
    toLang: "Chinese",
  });
  return JSON.parse(init.body);
};

describe("ModelBest interface", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("sends a bearer chat completion with thinking off", async () => {
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
    const body = JSON.parse(init.body);
    expect(url).toBe(MODELBEST_CHAT_COMPLETIONS_URL);
    expect(init.headers.Authorization).toBe("Bearer modelbest-test-key");
    expect(body.model).toBe("MiniCPM5-2B");
    expect(body.max_tokens).toBe(20480);
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(result[0].result[0]).toBe("你好");
  });

  test("turns thinking on only when the user enables it", async () => {
    const enabled = await requestBody({
      thinkingMode: "enabled",
      thinkingEffort: null,
    });
    expect(enabled.chat_template_kwargs).toEqual({ enable_thinking: true });

    const auto = await requestBody({
      thinkingMode: "auto",
      thinkingEffort: "high",
    });
    expect(auto.chat_template_kwargs).toEqual({ enable_thinking: false });
  });
});

jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () => ({ JSONParser: jest.fn() }));

jest.mock("../libs/fetch", () => ({
  fetchData: jest.fn(),
  fetchStream: jest.fn(),
}));

jest.mock("../libs/docInfo", () => ({ getDocInfo: () => ({}) }));

import { genTransReq } from "./trans";
import {
  DEFAULT_API_LIST,
  OPT_TRANS_CLAUDE,
  OPT_TRANS_CUSTOMIZE,
  OPT_TRANS_DEEPSEEK,
  OPT_TRANS_OLLAMA,
  OPT_TRANS_OPENAI,
} from "../config";

const requestUrl = async (apiType, url, update = {}) => {
  const base = DEFAULT_API_LIST.find((api) => api.apiType === apiType);
  const [requestUrl, init] = await genTransReq({
    ...base,
    url,
    key: "test-key",
    model: "qwen3.8-flash",
    useStream: false,
    useBatchFetch: false,
    texts: ["hello"],
    from: "en",
    to: "zh-CN",
    fromLang: "en",
    toLang: "zh-CN",
    ...update,
  });
  return { requestUrl, body: init.body ? JSON.parse(init.body) : null };
};

describe("OpenAI-compatible base URL completion", () => {
  test("posts a service root to /v1/chat/completions with the configured model", async () => {
    const { requestUrl: url, body } = await requestUrl(
      OPT_TRANS_OPENAI,
      "http://192.168.4.159:4000"
    );
    expect(url).toBe("http://192.168.4.159:4000/v1/chat/completions");
    expect(body.model).toBe("qwen3.8-flash");
  });

  test("posts a /v1 root to /v1/chat/completions", async () => {
    const { requestUrl: url } = await requestUrl(
      OPT_TRANS_OPENAI,
      "http://192.168.4.159:4000/v1"
    );
    expect(url).toBe("http://192.168.4.159:4000/v1/chat/completions");
  });

  test("leaves a complete chat URL unchanged", async () => {
    const deepseek = await requestUrl(
      OPT_TRANS_DEEPSEEK,
      "https://api.deepseek.com/chat/completions"
    );
    expect(deepseek.requestUrl).toBe(
      "https://api.deepseek.com/chat/completions"
    );

    const ollama = await requestUrl(
      OPT_TRANS_OLLAMA,
      "http://127.0.0.1:11434/v1/chat/completions"
    );
    expect(ollama.requestUrl).toBe(
      "http://127.0.0.1:11434/v1/chat/completions"
    );
  });

  test("does not rewrite Custom or Claude roots into chat completions", async () => {
    const custom = await requestUrl(
      OPT_TRANS_CUSTOMIZE,
      "http://192.168.4.159:4000",
      { reqHook: "", resHook: "" }
    );
    expect(custom.requestUrl).toBe("http://192.168.4.159:4000");

    const claude = await requestUrl(
      OPT_TRANS_CLAUDE,
      "https://api.anthropic.com"
    );
    expect(claude.requestUrl).toBe("https://api.anthropic.com");
  });
});

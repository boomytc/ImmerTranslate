jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () =>
  jest.requireActual("../../node_modules/@streamparser/json/dist/cjs/index.js")
);

const { TextDecoder, TextEncoder } = require("util");
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

jest.mock("../libs/fetch", () => ({
  fetchData: jest.fn(),
  fetchStream: jest.fn(),
}));

jest.mock("../libs/docInfo", () => ({
  getDocInfo: () => ({}),
}));

import { handleTranslate, parseTransRes } from "./trans";
import {
  DEFAULT_API_LIST,
  GOOGLE_TRANSLATE_URL,
  GOOGLE_PA_TRANSLATE_URL,
  OPT_TRANS_GOOGLE,
} from "../config";
import { fetchData } from "../libs/fetch";

const getGoogleSetting = (overrides = {}) => ({
  ...DEFAULT_API_LIST.find((api) => api.apiType === OPT_TRANS_GOOGLE),
  useStream: false,
  useBatchFetch: true,
  fetchInterval: 0,
  fetchLimit: 1,
  httpTimeout: 1000,
  ...overrides,
});

async function collectAsyncGenerator(generator) {
  const result = [];
  for await (const item of generator) {
    result.push(item);
  }
  return result;
}

describe("Google unified adaptive routing and fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("routes HTML textFormat to Google PA API via POST", async () => {
    fetchData.mockResolvedValueOnce([
      ["你好 <b>世界</b>"],
      ["en"],
    ]);

    const result = await collectAsyncGenerator(
      handleTranslate(["Hello <b>world</b>"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting(),
        textFormat: "html",
        usePool: false,
      })
    );

    expect(fetchData).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchData.mock.calls[0];
    expect(calledUrl).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(calledInit.method).toBe("POST");
    expect(calledInit.headers["Content-Type"]).toBe(
      "application/json+protobuf"
    );
    expect(result).toEqual([
      { id: 0, result: ["你好 <b>世界</b>", "en"] },
    ]);
  });

  test("routes batched texts (length > 1) to Google PA API via POST", async () => {
    fetchData.mockResolvedValueOnce([
      ["段落一", "段落二"],
      ["en", "en"],
    ]);

    const result = await collectAsyncGenerator(
      handleTranslate(["Paragraph 1", "Paragraph 2"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting(),
        textFormat: "text",
        usePool: false,
      })
    );

    expect(fetchData).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchData.mock.calls[0];
    expect(calledUrl).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(calledInit.method).toBe("POST");
    expect(result).toEqual([
      { id: 0, result: ["段落一", "en"] },
      { id: 1, result: ["段落二", "en"] },
    ]);
  });

  test("routes single plain text to Google GTX single endpoint via GET", async () => {
    fetchData.mockResolvedValueOnce({
      sentences: [{ trans: "你好", orig: "Hello" }],
      src: "en",
    });

    const result = await collectAsyncGenerator(
      handleTranslate(["Hello"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting(),
        textFormat: "text",
        usePool: false,
      })
    );

    expect(fetchData).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchData.mock.calls[0];
    expect(calledUrl).toContain(GOOGLE_TRANSLATE_URL);
    expect(calledInit.method).toBe("GET");
    expect(result).toEqual([{ id: 0, result: ["你好", "en"] }]);
  });

  test("automatically retries with Google PA API when GET request fails on single text", async () => {
    // 1st attempt: GTX GET fails with 429 rate limit or network error
    fetchData.mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"));
    // 2nd attempt: PA POST succeeds
    fetchData.mockResolvedValueOnce([
      ["你好世界"],
      ["en"],
    ]);

    const result = await collectAsyncGenerator(
      handleTranslate(["Hello world"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting(),
        textFormat: "text",
        usePool: false,
      })
    );

    expect(fetchData).toHaveBeenCalledTimes(2);
    // First call was GET to GTX
    expect(fetchData.mock.calls[0][0]).toContain(GOOGLE_TRANSLATE_URL);
    expect(fetchData.mock.calls[0][1].method).toBe("GET");
    // Second call was fallback POST to PA API
    expect(fetchData.mock.calls[1][0]).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(fetchData.mock.calls[1][1].method).toBe("POST");
    expect(result).toEqual([{ id: 0, result: ["你好世界", "en"] }]);
  });

  test("does not retry fallback when request was aborted", async () => {
    const abortErr = new DOMException("The operation was aborted.", "AbortError");
    fetchData.mockRejectedValueOnce(abortErr);

    await expect(
      collectAsyncGenerator(
        handleTranslate(["Hello"], {
          from: "en",
          to: "zh-CN",
          fromLang: "en",
          toLang: "zh-CN",
          langMap: () => "",
          glossary: "",
          apiSetting: getGoogleSetting(),
          textFormat: "text",
          usePool: false,
        })
      )
    ).rejects.toThrow("The operation was aborted.");

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  describe("parseTransRes compatibility", () => {
    test("parses Google PA Protobuf array structure", async () => {
      const paPayload = [
        ["Translated line 1", "Translated line 2"],
        ["en", "en"],
      ];
      const parsed = await parseTransRes(paPayload, {
        texts: ["Line 1", "Line 2"],
        apiType: OPT_TRANS_GOOGLE,
        textFormat: "text",
      });
      expect(parsed).toEqual([
        ["Translated line 1", "en"],
        ["Translated line 2", "en"],
      ]);
    });

    test("parses Google GTX sentences object structure", async () => {
      const gtxPayload = {
        sentences: [
          { trans: "Part 1", orig: "Part 1" },
          { trans: "Part 2", orig: "Part 2" },
        ],
        src: "en",
      };
      const parsed = await parseTransRes(gtxPayload, {
        texts: ["Part 1 Part 2"],
        apiType: OPT_TRANS_GOOGLE,
        textFormat: "text",
      });
      expect(parsed).toEqual([["Part 1 Part 2", "en"]]);
    });
  });
});

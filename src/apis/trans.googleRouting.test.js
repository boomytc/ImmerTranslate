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
  GOOGLE_TRANSLATE_BATCH_URL,
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

  test("routes keyless HTML text to the free single endpoint", async () => {
    fetchData.mockResolvedValueOnce({
      sentences: [{ trans: "你好 <b>世界</b>", orig: "Hello <b>world</b>" }],
      src: "en",
    });

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
    expect(calledUrl).toContain(GOOGLE_TRANSLATE_URL);
    expect(calledUrl).not.toContain(GOOGLE_PA_TRANSLATE_URL);
    expect(new URL(calledUrl).searchParams.get("q")).toBe("Hello <b>world</b>");
    expect(calledInit.method).toBe("GET");
    expect(calledInit.headers.Authorization).toBeUndefined();
    expect(result).toEqual([{ id: 0, result: ["你好 <b>世界</b>", "en"] }]);
  });

  test("routes keyless batched texts to translate_a/t", async () => {
    fetchData.mockResolvedValueOnce([
      ["段落一", "en"],
      ["段落二", "en"],
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
    expect(calledUrl).toContain(GOOGLE_TRANSLATE_BATCH_URL);
    expect(new URL(calledUrl).searchParams.getAll("q")).toEqual([
      "Paragraph 1",
      "Paragraph 2",
    ]);
    expect(calledInit.method).toBe("GET");
    expect(calledInit.headers["X-Goog-API-Key"]).toBeUndefined();
    expect(result).toEqual([
      { id: 0, result: ["段落一", "en"] },
      { id: 1, result: ["段落二", "en"] },
    ]);
  });

  test("keeps a supplied key on the Google PA endpoint for HTML and batches", async () => {
    fetchData.mockResolvedValueOnce([["你好 <b>世界</b>"], ["en"]]);
    fetchData.mockResolvedValueOnce([
      ["段落一", "段落二"],
      ["en", "en"],
    ]);

    const htmlResult = await collectAsyncGenerator(
      handleTranslate(["Hello <b>world</b>"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting({ key: "paid-key" }),
        textFormat: "html",
        usePool: false,
      })
    );
    const batchResult = await collectAsyncGenerator(
      handleTranslate(["Paragraph 1", "Paragraph 2"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting({ key: "paid-key" }),
        textFormat: "text",
        usePool: false,
      })
    );

    expect(fetchData.mock.calls[0][0]).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(fetchData.mock.calls[0][1].headers["X-Goog-API-Key"]).toBe(
      "paid-key"
    );
    expect(fetchData.mock.calls[1][0]).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(htmlResult).toEqual([{ id: 0, result: ["你好 <b>世界</b>", "en"] }]);
    expect(batchResult).toEqual([
      { id: 0, result: ["段落一", "en"] },
      { id: 1, result: ["段落二", "en"] },
    ]);
  });

  test("splits a long keyless batch across more than one free request", async () => {
    const first = "A".repeat(4000);
    const second = "B".repeat(4000);
    fetchData.mockResolvedValueOnce([["甲", "en"]]);
    fetchData.mockResolvedValueOnce([["乙", "en"]]);

    const result = await collectAsyncGenerator(
      handleTranslate([first, second], {
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
    expect(
      new URL(fetchData.mock.calls[0][0]).searchParams.getAll("q")
    ).toEqual([first]);
    expect(
      new URL(fetchData.mock.calls[1][0]).searchParams.getAll("q")
    ).toEqual([second]);
    expect(result).toEqual([
      { id: 0, result: ["甲", "en"] },
      { id: 1, result: ["乙", "en"] },
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

  test("retries a keyed single GET on Google PA when the free endpoint fails", async () => {
    fetchData.mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"));
    fetchData.mockResolvedValueOnce([["你好世界"], ["en"]]);

    const result = await collectAsyncGenerator(
      handleTranslate(["Hello world"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting({ key: "paid-key" }),
        textFormat: "text",
        usePool: false,
      })
    );

    expect(fetchData).toHaveBeenCalledTimes(2);
    expect(fetchData.mock.calls[0][0]).toContain(GOOGLE_TRANSLATE_URL);
    expect(fetchData.mock.calls[0][1].method).toBe("GET");
    expect(fetchData.mock.calls[1][0]).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(fetchData.mock.calls[1][1].method).toBe("POST");
    expect(result).toEqual([{ id: 0, result: ["你好世界", "en"] }]);
  });

  test("does not send a keyless failure to the key-only endpoint", async () => {
    fetchData.mockRejectedValueOnce(new Error(JSON.stringify({ status: 429 })));

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
    ).rejects.toThrow("429");

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(fetchData.mock.calls[0][0]).toContain(GOOGLE_TRANSLATE_URL);
  });

  test("falls back to the free endpoint when Google PA rejects the key", async () => {
    fetchData.mockRejectedValueOnce(
      new Error(
        JSON.stringify({
          status: 400,
          message: "API key not valid. Please pass a valid API key.",
        })
      )
    );
    fetchData.mockResolvedValueOnce(["你好 <b>世界</b>"]);

    const result = await collectAsyncGenerator(
      handleTranslate(["Hello <b>world</b>"], {
        from: "en",
        to: "zh-CN",
        fromLang: "en",
        toLang: "zh-CN",
        langMap: () => "",
        glossary: "",
        apiSetting: getGoogleSetting({ key: "not-a-real-key" }),
        textFormat: "html",
        usePool: false,
      })
    );

    expect(fetchData).toHaveBeenCalledTimes(2);
    expect(fetchData.mock.calls[0][0]).toBe(GOOGLE_PA_TRANSLATE_URL);
    expect(fetchData.mock.calls[1][0]).toContain(GOOGLE_TRANSLATE_BATCH_URL);
    expect(fetchData.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(result).toEqual([{ id: 0, result: ["你好 <b>世界</b>", ""] }]);
  });

  test("does not retry fallback when request was aborted", async () => {
    const abortErr = new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
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

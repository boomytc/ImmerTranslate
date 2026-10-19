jest.mock("webextension-polyfill", () => ({}));

jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () =>
  jest.requireActual("../../node_modules/@streamparser/json/dist/cjs/index.js")
);

const { TextDecoder, TextEncoder } = require("util");
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

jest.mock("./detect", () => ({
  tryDetectLang: jest.fn(),
}));

import { Translator } from "./translator";
import { tryDetectLang } from "./detect";
import { clearAllBatchQueue } from "./batchQueue";
import { clearFetchPool } from "./pool";
import { DEFAULT_API_SETTING, I18N } from "../config";

const H1 = "FAB visibility test page";
const P1 =
  "The quick brown fox jumps over the lazy dog. This paragraph exists so the extension has English text to translate and a page on which the floating button can appear.";
const P2 =
  "Software engineering is the systematic application of engineering approaches to the development of software. It involves requirements, design, testing and maintenance.";
const P3 =
  "Weather today is mild with a gentle breeze from the west. Many people are walking in the park and enjoying the sunshine before the evening rain arrives.";

const translated = (text) => `译:${text}`;

const microsoftResponse = (texts) => ({
  ok: true,
  headers: { get: () => "application/json" },
  text: async () =>
    JSON.stringify(
      texts.map((text) => ({
        detectedLanguage: { language: "en", score: 1 },
        translations: [{ text: translated(text), to: "zh-Hans" }],
      }))
    ),
  clone() {
    return this;
  },
});

const pump = async (ms = 0) => {
  if (ms) jest.advanceTimersByTime(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

const finishRequests = async () => {
  // 译文插入、批量窗口和任务池启动都是 setTimeout(0)。
  // 失败发生在微任务里，任务池才会排上下一次重试（间隔 1000ms）。
  // 必须先清空微任务，下一次推进才会执行那次重试。
  // 默认再试两次，三次都失败后，现有的网络错误横幅才会画出来。
  for (let step = 0; step < 4; step++) await pump(50);
  await pump(1100);
  await pump(1100);
  await pump(1100);
  await pump(50);
};

const created = [];

const mountFixture = () => {
  document.body.innerHTML = `<h1 id="heading">${H1}</h1><p id="p1">${P1}</p><p id="p2">${P2}</p><p id="p3">${P3}</p>`;
  const translator = new Translator({
    rule: {
      transOpen: "true",
      apiSlug: "Microsoft",
      fromLang: "auto",
      toLang: "zh-CN",
      rootsSelector: "body",
      transTitle: "false",
    },
    setting: {
      uiLang: "en",
      transInterval: 0,
      rootMargin: 0,
      minLength: 0,
      transApis: [
        {
          ...DEFAULT_API_SETTING,
          batchInterval: 0,
          fetchInterval: 1,
          fetchLimit: 10,
          httpTimeout: 30,
          useStream: false,
        },
      ],
    },
  });
  created.push(translator);
  return translator;
};

const requestTexts = () =>
  global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body));

describe("Microsoft heading shares the page batch", () => {
  let originalIntersectionObserver;
  let originalCSSStyleSheet;
  let originalFetch;
  let dateNowSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    // 任务池用 Date.now() 计算启动间隔，并且实例跨测试保留。
    // 假时间各自从真实时间起算时，上一个测试推进过的时间会落在未来，
    // 把下一次请求的间隔拉长，重试就停在加载动画上。这里把 Date.now 固定住。
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(Date.now());
    document.documentElement.innerHTML = "<head></head><body></body>";
    tryDetectLang.mockImplementation(async (text) =>
      String(text).trim().length < 40 ? "" : "en"
    );
    originalFetch = global.fetch;
    originalIntersectionObserver = global.IntersectionObserver;
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
    originalCSSStyleSheet = global.CSSStyleSheet;
    global.CSSStyleSheet = class {
      replaceSync() {}
    };
  });

  afterEach(() => {
    const translators = created.splice(0);
    translators.forEach((translator) => translator.stop());
    clearFetchPool();
    clearAllBatchQueue();
    jest.runOnlyPendingTimers();
    translators.forEach((translator) => translator.stop());
    clearFetchPool();
    clearAllBatchQueue();
    dateNowSpy.mockRestore();
    global.fetch = originalFetch;
    global.IntersectionObserver = originalIntersectionObserver;
    global.CSSStyleSheet = originalCSSStyleSheet;
    jest.useRealTimers();
  });

  test("translates the heading with the paragraphs when its own request would fail", async () => {
    global.fetch = jest.fn(async (url, init) => {
      const texts = JSON.parse(init.body);
      if (texts.length === 1 && texts[0] === H1) {
        throw new TypeError("Failed to fetch");
      }
      return microsoftResponse(texts);
    });

    mountFixture();
    await finishRequests();

    const bodies = requestTexts();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual([H1, P1, P2, P3]);
    expect(new URL(global.fetch.mock.calls[0][0]).searchParams.get("from")).toBe(
      ""
    );
    expect(document.getElementById("heading").textContent).toContain(
      translated(H1)
    );
    expect(document.getElementById("p1").textContent).toContain(translated(P1));
    expect(
      document.querySelector(`.${Translator.KISS_CLASS.error}`)
    ).toBeNull();
    expect(document.body.textContent).not.toContain(
      I18N.test_connection_network.en
    );
  });

  test("still shows the network banner when the shared request fails", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    mountFixture();
    await finishRequests();

    const heading = document.getElementById("heading");
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(heading.textContent).toContain(H1);
    expect(heading.textContent).toContain(I18N.test_connection_network.en);
    expect(heading.textContent).not.toContain(translated(H1));
    expect(
      heading.querySelector(`.${Translator.KISS_CLASS.openOptions}`).textContent
    ).toBe("Open Setting");
    expect(requestTexts().every((texts) => texts.includes(H1))).toBe(true);
  });

  test("removes the heading banner after a later attempt succeeds", async () => {
    let fail = true;
    global.fetch = jest.fn(async (_url, init) => {
      const texts = JSON.parse(init.body);
      if (fail) throw new TypeError("Failed to fetch");
      return microsoftResponse(texts);
    });

    mountFixture();
    await finishRequests();
    expect(document.getElementById("heading").textContent).toContain(
      I18N.test_connection_network.en
    );

    fail = false;
    document
      .querySelectorAll(`.${Translator.KISS_CLASS.retry}`)
      .forEach((node) => {
        node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    await finishRequests();

    const heading = document.getElementById("heading");
    expect(heading.textContent).toContain(translated(H1));
    expect(heading.textContent).not.toContain(I18N.test_connection_network.en);
    expect(document.getElementById("p1").textContent).toContain(translated(P1));
    expect(
      document.querySelector(`.${Translator.KISS_CLASS.error}`)
    ).toBeNull();
  });

  test("does not paint a network banner when the request is aborted", async () => {
    global.fetch = jest.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });

    mountFixture();
    await finishRequests();

    expect(
      document.querySelector(`.${Translator.KISS_CLASS.error}`)
    ).toBeNull();
    expect(document.body.textContent).not.toContain(
      I18N.test_connection_network.en
    );
    expect(document.getElementById("heading").textContent).toBe(H1);
  });

  test("keeps an explicit source language on one shared request", async () => {
    tryDetectLang.mockResolvedValue("en");
    global.fetch = jest.fn(async (_url, init) =>
      microsoftResponse(JSON.parse(init.body))
    );
    document.body.innerHTML = `<h1 id="heading">${H1}</h1><p id="p1">${P1}</p>`;
    const translator = new Translator({
      rule: {
        transOpen: "true",
        apiSlug: "Microsoft",
        fromLang: "en",
        toLang: "zh-CN",
        rootsSelector: "body",
        transTitle: "false",
      },
      setting: {
        uiLang: "en",
        transInterval: 0,
        rootMargin: 0,
        minLength: 0,
        transApis: [
          {
            ...DEFAULT_API_SETTING,
            batchInterval: 0,
            fetchInterval: 1,
            httpTimeout: 30,
            useStream: false,
          },
        ],
      },
    });
    created.push(translator);
    await finishRequests();

    expect(requestTexts()).toEqual([[H1, P1]]);
    expect(new URL(global.fetch.mock.calls[0][0]).searchParams.get("from")).toBe(
      "en"
    );
    expect(tryDetectLang).not.toHaveBeenCalled();
    expect(document.getElementById("heading").textContent).toContain(
      translated(H1)
    );
  });
});

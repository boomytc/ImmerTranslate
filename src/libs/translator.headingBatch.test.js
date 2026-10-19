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

const flushWork = async () => {
  for (let step = 0; step < 6; step++) await pump(50);
};

// 任务池对非 AbortError 再试两次，间隔 1000ms。第三次仍失败才画横幅。
const exhaustNetworkRetries = async () => {
  await flushWork();
  await pump(1000);
  await flushWork();
  await pump(1000);
  await flushWork();
};

const created = [];

const mountFixture = ({
  paragraphs = [P1, P2, P3],
  batchSize = 20,
  fromLang = "auto",
} = {}) => {
  const markup = paragraphs
    .map((text, index) => `<p id="p${index}">${text}</p>`)
    .join("");
  document.body.innerHTML = `<h1 id="heading">${H1}</h1>${markup}`;
  const translator = new Translator({
    rule: {
      transOpen: "true",
      apiSlug: "Microsoft",
      fromLang,
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
          batchSize,
          batchConcurrency: 10,
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

const expectNoNetworkBanner = () => {
  expect(document.querySelector(`.${Translator.KISS_CLASS.error}`)).toBeNull();
  expect(document.body.textContent).not.toContain(
    I18N.test_connection_network.en
  );
};

describe("Microsoft page batches", () => {
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

  test("translates a page that sends several Microsoft batches at once", async () => {
    const paragraphs = [P1, P2, P3, P1, P2];
    const release = [];
    let inFlight = 0;
    let maxInFlight = 0;
    global.fetch = jest.fn(async (_url, init) => {
      const texts = JSON.parse(init.body);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => release.push(resolve));
      inFlight -= 1;
      return microsoftResponse(texts);
    });

    mountFixture({ paragraphs, batchSize: 2 });

    for (
      let step = 0;
      step < 40 && global.fetch.mock.calls.length < 3;
      step++
    ) {
      await pump(20);
    }

    expect(global.fetch.mock.calls.length).toBe(3);
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
    expect(requestTexts().flat()).toEqual(
      expect.arrayContaining([H1, P1, P2, P3])
    );

    release.splice(0).forEach((finish) => finish());
    await flushWork();

    expect(document.getElementById("heading").textContent).toContain(
      translated(H1)
    );
    paragraphs.forEach((text, index) => {
      expect(document.getElementById(`p${index}`).textContent).toContain(
        translated(text)
      );
    });
    expectNoNetworkBanner();
  });

  test("recovers when one of several batches fails once", async () => {
    const paragraphs = [P1, P2, P3, P1, P2];
    let failed = false;
    global.fetch = jest.fn(async (_url, init) => {
      const texts = JSON.parse(init.body);
      if (!failed && !texts.includes(H1)) {
        failed = true;
        throw new TypeError("Failed to fetch");
      }
      return microsoftResponse(texts);
    });

    mountFixture({ paragraphs, batchSize: 2 });
    await flushWork();
    await pump(1000);
    await flushWork();

    expect(failed).toBe(true);
    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(document.getElementById("heading").textContent).toContain(
      translated(H1)
    );
    paragraphs.forEach((text, index) => {
      expect(document.getElementById(`p${index}`).textContent).toContain(
        translated(text)
      );
    });
    expectNoNetworkBanner();
  });

  test("translates the heading after one Failed to fetch is retried", async () => {
    let attempts = 0;
    global.fetch = jest.fn(async (_url, init) => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return microsoftResponse(JSON.parse(init.body));
    });

    mountFixture();
    await flushWork();

    const heading = document.getElementById("heading");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(heading.textContent).toContain(H1);
    expect(heading.textContent).not.toContain(translated(H1));
    expect(heading.textContent).not.toContain(I18N.test_connection_network.en);
    expect(
      document.querySelector(`.${Translator.KISS_CLASS.error}`)
    ).toBeNull();

    await pump(1000);
    await flushWork();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(requestTexts()[1]).toEqual(expect.arrayContaining([H1, P1, P2, P3]));
    expect(heading.textContent).toContain(translated(H1));
    expect(document.getElementById("p0").textContent).toContain(translated(P1));
    expectNoNetworkBanner();
  });

  test("still shows the network banner when every attempt fails", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    mountFixture();
    await exhaustNetworkRetries();

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
    await exhaustNetworkRetries();
    expect(document.getElementById("heading").textContent).toContain(
      I18N.test_connection_network.en
    );

    fail = false;
    document
      .querySelectorAll(`.${Translator.KISS_CLASS.retry}`)
      .forEach((node) => {
        node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    await flushWork();

    const heading = document.getElementById("heading");
    expect(heading.textContent).toContain(translated(H1));
    expect(heading.textContent).not.toContain(I18N.test_connection_network.en);
    expect(document.getElementById("p0").textContent).toContain(translated(P1));
    expectNoNetworkBanner();
  });

  test("does not paint a network banner when the request is aborted", async () => {
    global.fetch = jest.fn(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });

    mountFixture();
    await flushWork();

    expectNoNetworkBanner();
    expect(document.getElementById("heading").textContent).toBe(H1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("keeps an explicit source language on one shared request", async () => {
    tryDetectLang.mockResolvedValue("en");
    global.fetch = jest.fn(async (_url, init) =>
      microsoftResponse(JSON.parse(init.body))
    );
    mountFixture({ paragraphs: [P1], fromLang: "en" });
    await flushWork();

    expect(requestTexts()).toEqual([[H1, P1]]);
    expect(
      new URL(global.fetch.mock.calls[0][0]).searchParams.get("from")
    ).toBe("en");
    expect(tryDetectLang).not.toHaveBeenCalled();
    expect(document.getElementById("heading").textContent).toContain(
      translated(H1)
    );
  });
});

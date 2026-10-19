/* eslint-disable import/first -- jest.mock 必须写在 import 之前 */
jest.mock("webdav", () => ({
  createClient: jest.fn(),
  getPatcher: jest.fn(),
}));

jest.mock("webextension-polyfill", () => ({
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
}));

jest.mock("query-string", () => ({
  stringify: (obj) => new URLSearchParams(obj).toString(),
}));

jest.mock("@streamparser/json", () =>
  jest.requireActual("../../node_modules/@streamparser/json/dist/cjs/index.js")
);

jest.mock("./detect", () => ({
  tryDetectLang: jest.fn(async () => "en"),
}));

jest.mock("../components/TouchTranslateControl", () => ({
  TouchTranslateStatus: () => null,
}));

jest.mock("./tranbox", () => ({
  TransboxManager: class {
    isEnabled() {
      return false;
    }
    enable() {}
    disable() {}
  },
}));

jest.mock("./popupManager", () => ({
  PopupManager: class {
    destroy() {}
    toggle() {}
    hide() {}
  },
}));

jest.mock("./fabManager", () => ({
  FabManager: class {
    destroy() {}
    show() {}
    setProps() {}
  },
}));

jest.mock("./ruleEditorManager", () => ({
  RuleEditorManager: class {
    destroy() {}
    open() {}
  },
}));

jest.mock("./storageState", () => ({
  getStorageState: () => ({
    subscribe() {
      return () => {};
    },
  }),
}));

jest.mock("./pageRuleSync", () => ({
  pickSharedRulePatch: (values) => {
    const patch = {};
    if (!values || typeof values !== "object") return patch;
    for (const key of [
      "apiSlug",
      "transOnly",
      "fromLang",
      "toLang",
      "textStyle",
      "transOpen",
    ]) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
      const value = values[key];
      if (value == null || value === "") continue;
      patch[key] = value === true ? "true" : value === false ? "false" : value;
    }
    return patch;
  },
  publishPageRule: jest.fn(),
  persistSharedSiteRule: jest.fn(),
}));

jest.mock("../apis", () => {
  const actual = jest.requireActual("../apis");
  return {
    ...actual,
    apiTranslate: (args) => {
      const promise = actual.apiTranslate(args);
      global.__recordedTranslates.push({
        text: args.text,
        signal: args.signal,
        promise,
      });
      promise.catch(() => {});
      return promise;
    },
  };
});

jest.mock("../apis/index.js", () => {
  const actual = jest.requireActual("../apis/index.js");
  return {
    ...actual,
    apiTranslate: (args) => {
      const promise = actual.apiTranslate(args);
      global.__recordedTranslates.push({
        text: args.text,
        signal: args.signal,
        promise,
      });
      promise.catch(() => {});
      return promise;
    },
  };
});

const { TextDecoder, TextEncoder } = require("util");
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

import { DEFAULT_API_SETTING } from "../config";

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

const makeApiSetting = (transAllnow = false) => ({
  ...DEFAULT_API_SETTING,
  batchInterval: 0,
  batchSize: 1,
  batchConcurrency: 4,
  fetchInterval: 0,
  fetchLimit: 8,
  httpTimeout: 30,
  useStream: false,
  useBatchFetch: true,
  transAllnow,
});

const flush = async (ms = 20) => {
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

describe("translator cancellation leaves other callers running", () => {
  let apiTranslate;
  let BilingualSubtitleManager;
  let InputTranslator;
  let TranslatorManager;
  let logger;
  const managers = [];
  const subtitles = [];
  const inputs = [];
  let gates;
  let originalFetch;
  let originalIntersectionObserver;
  let originalCSSStyleSheet;
  let originalMatchMedia;
  let dateNowSpy;
  let sequence;
  let originalCrypto;

  beforeEach(() => {
    jest.resetModules();
    ({ apiTranslate } = require("../apis"));
    ({
      BilingualSubtitleManager,
    } = require("../subtitle/BilingualSubtitleManager"));
    ({ InputTranslator } = require("./inputTranslate"));
    ({ logger } = require("./log"));
    TranslatorManager = require("./translatorManager").default;
    sequence = 0;
    gates = [];
    global.__recordedTranslates = [];
    originalCrypto = global.crypto;
    if (!global.crypto?.getRandomValues) {
      const { webcrypto } = require("crypto");
      Object.defineProperty(global, "crypto", {
        value: {
          getRandomValues: (values) => webcrypto.getRandomValues(values),
        },
        configurable: true,
      });
    }
    jest.useFakeTimers();
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(Date.now());
    document.documentElement.innerHTML = "<head></head><body></body>";
    originalFetch = global.fetch;
    global.fetch = jest.fn(
      (_url, init) =>
        new Promise((resolve, reject) => {
          let settled = false;
          const gate = { init, aborted: false };
          const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            gate.settled = true;
            fn(value);
          };
          const abort = () => {
            gate.aborted = true;
            finish(
              reject,
              new DOMException("The operation was aborted.", "AbortError")
            );
          };
          gate.resolve = (value) => finish(resolve, value);
          if (init?.signal?.aborted) {
            abort();
            return;
          }
          init?.signal?.addEventListener("abort", abort, { once: true });
          gates.push(gate);
        })
    );

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
    originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  afterEach(() => {
    subtitles.splice(0).forEach((manager) => manager.destroy());
    inputs.splice(0).forEach((translator) => translator.disable());
    managers.splice(0).forEach((manager) => manager.stop());
    jest.clearAllTimers();
    global.fetch = originalFetch;
    global.IntersectionObserver = originalIntersectionObserver;
    global.CSSStyleSheet = originalCSSStyleSheet;
    window.matchMedia = originalMatchMedia;
    if (originalCrypto !== global.crypto) {
      Object.defineProperty(global, "crypto", {
        value: originalCrypto,
        configurable: true,
      });
    }
    dateNowSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
    global.__recordedTranslates = [];
  });

  const textsFor = () => {
    sequence += 1;
    return {
      page: `Page owned sentence ${sequence} stays on the translator.`,
      selection: `Selection owned sentence ${sequence} must finish.`,
      input: `Input owned sentence ${sequence} must finish.`,
      subtitle: `Subtitle owned sentence ${sequence} must finish.`,
    };
  };

  const callsFor = (text) =>
    global.__recordedTranslates.filter((call) => call.text === text);

  const fetchFor = (text) =>
    gates.find(
      (gate) => !gate.aborted && String(gate.init?.body || "").includes(text)
    );

  const waitForFetch = async (text) => {
    for (let step = 0; step < 30 && !fetchFor(text); step += 1) {
      await flush();
    }
    const gate = fetchFor(text);
    expect(gate).toBeTruthy();
    return gate;
  };

  const releaseOpenFetches = () => {
    for (const gate of gates) {
      if (gate.settled || gate.aborted || gate.init?.signal?.aborted) continue;
      let texts = [];
      try {
        texts = JSON.parse(gate.init.body);
      } catch {
        texts = [];
      }
      gate.resolve(microsoftResponse(Array.isArray(texts) ? texts : []));
    }
  };

  const spaEvents = [
    [
      "turbo:load",
      "turbo:load",
      () => document.documentElement.dispatchEvent(new Event("turbo:load")),
    ],
    [
      "turbo:frame-load",
      "turbo:frame-load",
      () => {
        const frame = document.createElement("turbo-frame");
        document.body.appendChild(frame);
        frame.dispatchEvent(new Event("turbo:frame-load", { bubbles: true }));
      },
    ],
    [
      "bfcache pageshow",
      "pageshow",
      () =>
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true })
        ),
    ],
  ];

  const requestTexts = (gate) => {
    try {
      const parsed = JSON.parse(gate.init?.body || "");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const openGatesFor = (sentence) =>
    gates.filter(
      (gate) =>
        !gate.settled && !gate.aborted && requestTexts(gate).includes(sentence)
    );

  // 页面句子和另外三条调用方句子必须各走各的请求，避免缓存命中或并进同一批。
  const expectSeparateOpenRequest = (sentence, others) => {
    const matches = openGatesFor(sentence);
    expect(matches).toHaveLength(1);
    expect(requestTexts(matches[0])).toEqual([sentence]);
    for (const other of others) {
      expect(requestTexts(matches[0])).not.toContain(other);
    }
    return matches[0];
  };

  const expectPeersAreSeparate = (text) => {
    const sentences = [text.page, text.selection, text.input, text.subtitle];
    for (const sentence of [text.selection, text.input, text.subtitle]) {
      expectSeparateOpenRequest(
        sentence,
        sentences.filter((item) => item !== sentence)
      );
    }
  };

  const fireSpaEvent = async (fire, reason) => {
    const info = jest.spyOn(logger, "info");
    fire();
    await flush();
    expect(info).toHaveBeenCalledWith(`TranslatorManager rescanned: ${reason}`);
    info.mockRestore();
  };

  const startManager = ({
    transOpen = "false",
    transAllnow = false,
    hover = false,
    preInit = true,
  } = {}) => {
    const manager = new TranslatorManager({
      setting: {
        preInit,
        transInterval: 0,
        rootMargin: 0,
        minLength: 0,
        touchModes: [],
        contextMenuType: 0,
        tranboxSetting: { transOpen: false },
        inputRule: { transOpen: false },
        mouseHoverSetting: hover
          ? {
              useMouseHover: true,
              mouseHoverKey: [],
              mouseHoverKey2: [],
              displayMode: "bubble",
            }
          : { useMouseHover: false },
        transApis: [makeApiSetting(transAllnow)],
      },
      rule: {
        transOpen,
        apiSlug: "Microsoft",
        fromLang: "en",
        toLang: "zh-CN",
        rootsSelector: "#root",
        transTitle: "false",
      },
      fabConfig: { isHide: true },
      isIframe: true,
    });
    managers.push(manager);
    manager.start();
    return manager;
  };

  const startPeers = async (text) => {
    const apiSetting = makeApiSetting();
    const selection = apiTranslate({
      text: text.selection,
      fromLang: "en",
      toLang: "zh-CN",
      apiSetting,
      textFormat: "text",
      translateVariants: true,
      signal: new AbortController().signal,
    });

    const field = document.createElement("textarea");
    field.value = text.input;
    document.body.appendChild(field);
    field.focus();
    const inputTranslator = new InputTranslator({
      inputRule: {
        transOpen: false,
        apiSlug: "Microsoft",
        fromLang: "en",
        toLang: "zh-CN",
        transSign: "",
      },
      transApis: [apiSetting],
    });
    inputs.push(inputTranslator);
    const inputTask = inputTranslator.handleTranslate({ isBtnTrigger: true });
    inputTask.catch(() => {});

    const player = document.createElement("div");
    player.className = "html5-video-player ytp-autohide notranslate";
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { value: 0, writable: true });
    player.appendChild(video);
    document.body.appendChild(player);
    const subtitle = new BilingualSubtitleManager({
      videoEl: video,
      formattedSubtitles: [
        { start: 0, end: 1000, text: text.subtitle, translation: "" },
      ],
      setting: {
        fromLang: "en",
        toLang: "zh-CN",
        apiSetting,
        docInfo: {},
        preTrans: 90,
        throttleTrans: 0,
        isBilingual: false,
        hoverLookupMode: "off",
      },
    });
    subtitles.push(subtitle);
    subtitle.start();

    const selectionGate = await waitForFetch(text.selection);
    const inputGate = await waitForFetch(text.input);
    const subtitleGate = await waitForFetch(text.subtitle);

    return {
      selection,
      input: callsFor(text.input)[0].promise,
      subtitle: callsFor(text.subtitle)[0].promise,
      selectionGate,
      inputGate,
      subtitleGate,
    };
  };

  const startOwnedRequest = async (text, { hover }) => {
    if (hover) {
      document.getElementById("page").dispatchEvent(
        new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 12,
          clientY: 12,
        })
      );
      await flush(100);
    }
    const gate = await waitForFetch(text.page);
    const owned = callsFor(text.page)[0];
    expect(owned?.signal).toBeInstanceOf(AbortSignal);
    return { owned, gate };
  };

  const expectPeersResolve = async (peers, text) => {
    releaseOpenFetches();
    await flush();
    await expect(peers.selection).resolves.toMatchObject({
      trText: translated(text.selection),
    });
    await expect(peers.input).resolves.toMatchObject({
      trText: translated(text.input),
    });
    await expect(peers.subtitle).resolves.toMatchObject({
      trText: translated(text.subtitle),
    });
  };

  const expectPeersStayOpen = (peers) => {
    for (const peerGate of [
      peers.selectionGate,
      peers.inputGate,
      peers.subtitleGate,
    ]) {
      expect(peerGate.aborted).toBe(false);
      expect(peerGate.init?.signal?.aborted).toBeFalsy();
    }
  };

  const runPeersOnlyCase = async ({ act, preInit = true }) => {
    const text = textsFor();
    document.body.innerHTML = `<main id="root"><p id="page">${text.page}</p></main>`;
    startManager({ transOpen: "false", hover: false, preInit });
    expect(callsFor(text.page)).toHaveLength(0);
    const peers = await startPeers(text);
    expect(openGatesFor(text.page)).toHaveLength(0);
    expectPeersAreSeparate(text);

    await act();
    await flush();

    expect(callsFor(text.page)).toHaveLength(0);
    expectPeersStayOpen(peers);
    await expectPeersResolve(peers, text);
  };

  const runCase = async ({
    transOpen = "false",
    transAllnow = false,
    hover = false,
    act,
    ownCancelled,
  }) => {
    const text = textsFor();
    document.body.innerHTML = `<main id="root"><p id="page">${text.page}</p></main>`;
    const manager = startManager({ transOpen, transAllnow, hover });
    const peers = await startPeers(text);
    const { owned, gate } = await startOwnedRequest(text, { hover });
    expectPeersAreSeparate(text);
    expect(requestTexts(gate)).toEqual([text.page]);

    await act(manager);
    await flush();

    expect(owned.signal.aborted).toBe(ownCancelled);
    expect(gate.aborted).toBe(ownCancelled);
    expectPeersStayOpen(peers);

    await expectPeersResolve(peers, text);
    if (ownCancelled) {
      await expect(owned.promise).rejects.toMatchObject({
        name: "AbortError",
      });
    } else {
      await expect(owned.promise).resolves.toMatchObject({
        trText: translated(text.page),
      });
    }
  };

  test("disable cancels the page request while selection and input requests stay in flight", async () => {
    await runCase({
      transOpen: "true",
      ownCancelled: true,
      act: (manager) => manager._translator.disable(),
    });
  });

  test("rescan during translation cancels the page request and lets other callers finish", async () => {
    await runCase({
      transOpen: "true",
      ownCancelled: true,
      act: (manager) => manager._translator.rescan(),
    });
  });

  test.each(spaEvents)(
    "B0 %s with page translation off keeps separate selection, input, and subtitle requests",
    async (_name, reason, fire) => {
      await runPeersOnlyCase({
        act: () => fireSpaEvent(fire, reason),
      });
    }
  );

  test.each(spaEvents)(
    "B1 %s with page translation on keeps separate selection, input, and subtitle requests",
    async (_name, reason, fire) => {
      await runCase({
        transOpen: "true",
        ownCancelled: true,
        act: () => fireSpaEvent(fire, reason),
      });
    }
  );

  test.each(spaEvents)(
    "%s cancels a hover request on a pre-initialized translator and lets other callers finish",
    async (_name, reason, fire) => {
      await runCase({
        transOpen: "false",
        hover: true,
        ownCancelled: true,
        act: () => fireSpaEvent(fire, reason),
      });
    }
  );

  test("turbo:load after the body is replaced restarts while translating and lets other callers finish", async () => {
    await runCase({
      transOpen: "true",
      ownCancelled: true,
      act: async () => {
        const nextBody = document.createElement("body");
        nextBody.innerHTML = document.body.innerHTML;
        document.body.replaceWith(nextBody);
        document.documentElement.dispatchEvent(new Event("turbo:load"));
        await flush();
      },
    });
  });

  test("enable with transAllnow rescans and lets other callers finish", async () => {
    await runCase({
      transOpen: "false",
      transAllnow: true,
      hover: true,
      ownCancelled: true,
      act: (manager) => manager._translator.enable(),
    });
  });

  test("history.pushState does not rescan or cancel in-flight requests", async () => {
    await runCase({
      transOpen: "true",
      ownCancelled: false,
      act: async () => {
        window.history.pushState({}, "", "/plain-history-change");
        await flush(50);
      },
    });
  });
});

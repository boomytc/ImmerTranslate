const mockTranslatorManagerStart = jest.fn();
let mockIsIframe = false;

jest.mock("./config", () => ({
  OPT_HIGHLIGHT_WORDS_DISABLE: "-",
}));

jest.mock("./libs/storage", () => ({
  getSettingWithDefault: jest.fn(),
  getFabWithDefault: jest.fn(),
  getWordsWithDefault: jest.fn(),
}));

jest.mock("./libs/iframe", () => ({
  get isIframe() {
    return mockIsIframe;
  },
}));

jest.mock("./libs/redditFrame", () => ({
  readRedditEmbeddingHref: jest.fn(() => ""),
}));

jest.mock("./libs/gm", () => ({
  handlePing: jest.fn(),
  injectScript: jest.fn(),
}));

jest.mock("./libs/rules", () => ({
  matchRule: jest.fn(),
}));

jest.mock("./libs/subRules", () => ({
  trySyncAllSubRules: jest.fn(),
}));

jest.mock("./libs/blacklist", () => ({
  isInBlacklist: jest.fn(() => false),
}));

jest.mock("./subtitle/subtitle", () => ({
  runSubtitle: jest.fn(),
}));

jest.mock("./libs/log", () => ({
  logger: {
    setLevel: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("./libs/injector", () => ({
  injectInlineJs: jest.fn(),
}));

jest.mock("./libs/translatorManager", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    start: mockTranslatorManagerStart,
  })),
}));

const {
  getSettingWithDefault,
  getFabWithDefault,
  getWordsWithDefault,
} = require("./libs/storage");
const { matchRule } = require("./libs/rules");
const { readRedditEmbeddingHref } = require("./libs/redditFrame");
const { isInBlacklist } = require("./libs/blacklist");
const { runSubtitle } = require("./subtitle/subtitle");
const { injectInlineJs } = require("./libs/injector");
const TranslatorManager = require("./libs/translatorManager").default;
const { run } = require("./common");

function setReadyState(value) {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value,
  });
}

function setContentType(value) {
  Object.defineProperty(document, "contentType", {
    configurable: true,
    value,
  });
}

function expectNoNormalUserscriptStartup() {
  expect(getSettingWithDefault).not.toHaveBeenCalled();
  expect(matchRule).not.toHaveBeenCalled();
  expect(TranslatorManager).not.toHaveBeenCalled();
}

describe("common iframe startup", () => {
  const originalOptionsPage = process.env.REACT_APP_OPTIONSPAGE;
  const originalOptionsPageDev = process.env.REACT_APP_OPTIONSPAGE_DEV;
  const originalOptionsPageLocal = process.env.REACT_APP_OPTIONSPAGE_LOCAL;

  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    setReadyState("complete");
    setContentType("text/html");
    mockIsIframe = false;
    process.env.REACT_APP_OPTIONSPAGE = "https://page.example/options.html";
    process.env.REACT_APP_OPTIONSPAGE_DEV = "https://dev.example/options.html";
    process.env.REACT_APP_OPTIONSPAGE_LOCAL =
      "http://localhost:3000/options.html";
    delete globalThis.unsafeWindow;
    jest.clearAllMocks();
    readRedditEmbeddingHref.mockReturnValue("");
    isInBlacklist.mockImplementation(() => false);

    TranslatorManager.mockImplementation(() => ({
      start: mockTranslatorManagerStart,
    }));
    getSettingWithDefault.mockResolvedValue({
      blacklist: "",
      tranboxSetting: { blacklist: "", transOpen: true },
      inputRule: { blacklist: "", transOpen: true },
      mouseHoverSetting: { blacklist: "", useMouseHover: true },
      logLevel: 1,
    });
    getFabWithDefault.mockResolvedValue({ isHide: false });
    getWordsWithDefault.mockResolvedValue({});
    matchRule.mockResolvedValue({
      transOpen: "true",
      highlightWords: "-",
    });
  });

  afterEach(() => {
    if (originalOptionsPage === undefined) {
      delete process.env.REACT_APP_OPTIONSPAGE;
    } else {
      process.env.REACT_APP_OPTIONSPAGE = originalOptionsPage;
    }
    if (originalOptionsPageDev === undefined) {
      delete process.env.REACT_APP_OPTIONSPAGE_DEV;
    } else {
      process.env.REACT_APP_OPTIONSPAGE_DEV = originalOptionsPageDev;
    }
    if (originalOptionsPageLocal === undefined) {
      delete process.env.REACT_APP_OPTIONSPAGE_LOCAL;
    } else {
      process.env.REACT_APP_OPTIONSPAGE_LOCAL = originalOptionsPageLocal;
    }
    delete globalThis.unsafeWindow;
  });

  test("starts translator manager for iframe with text", async () => {
    mockIsIframe = true;
    document.body.innerHTML = "<main>Hello iframe</main>";

    await run();

    expect(matchRule).toHaveBeenCalledTimes(1);
    expect(matchRule).toHaveBeenCalledWith(
      window.location.href,
      expect.any(Object)
    );
    expect(TranslatorManager).toHaveBeenCalledTimes(1);
    expect(mockTranslatorManagerStart).toHaveBeenCalledTimes(1);
    expect(runSubtitle).not.toHaveBeenCalled();
  });

  test("matches rules with the embedding reddit page inside a child frame", async () => {
    mockIsIframe = true;
    document.body.innerHTML = "<span>Continue with Google</span>";
    const embedding =
      "https://www.reddit.com/r/announcements/comments/pg006s/covid_denialism_and_policy_clarifications/";
    readRedditEmbeddingHref.mockReturnValue(embedding);

    await run();

    expect(readRedditEmbeddingHref).toHaveBeenCalledWith(window, true);
    expect(matchRule).toHaveBeenCalledWith(embedding, expect.any(Object));
    expect(isInBlacklist).toHaveBeenCalledWith(
      window.location.href,
      expect.any(String)
    );
    expect(TranslatorManager).toHaveBeenCalledTimes(1);
  });

  test("skips empty iframe before rule matching and manager startup", async () => {
    mockIsIframe = true;
    document.body.innerHTML = `
      <script>const text = "ignored";</script>
      <style>.ignored { color: red; }</style>
      <textarea>ignored</textarea>
    `;

    await run();

    expect(matchRule).not.toHaveBeenCalled();
    expect(TranslatorManager).not.toHaveBeenCalled();
    expect(mockTranslatorManagerStart).not.toHaveBeenCalled();
  });

  test("waits for DOMContentLoaded before skipping loading iframe", async () => {
    mockIsIframe = true;
    setReadyState("loading");

    const running = run();
    await Promise.resolve();

    document.body.innerHTML = "<p>Late iframe text</p>";
    setReadyState("interactive");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    await running;

    expect(matchRule).toHaveBeenCalledTimes(1);
    expect(TranslatorManager).toHaveBeenCalledTimes(1);
    expect(mockTranslatorManagerStart).toHaveBeenCalledTimes(1);
  });

  test("does not apply empty-text gate to top-level pages", async () => {
    mockIsIframe = false;

    await run();

    expect(matchRule).toHaveBeenCalledTimes(1);
    expect(TranslatorManager).toHaveBeenCalledTimes(1);
    expect(TranslatorManager.mock.calls[0][0].transboxOnly).toBe(false);
    expect(mockTranslatorManagerStart).toHaveBeenCalledTimes(1);
    expect(runSubtitle).toHaveBeenCalledTimes(1);
  });

  test("passes the stored FAB config through unchanged when the page matches its exception list", async () => {
    getFabWithDefault.mockResolvedValue({
      isHide: false,
      hideExceptionList: "page.example",
    });
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "page.example"
    );

    await run();

    expect(TranslatorManager.mock.calls[0][0].fabConfig).toEqual({
      isHide: false,
      hideExceptionList: "page.example",
    });
  });

  test("passes a globally hidden FAB config through unchanged when the page is listed", async () => {
    getFabWithDefault.mockResolvedValue({
      isHide: true,
      hideExceptionList: "page.example",
    });
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "page.example"
    );

    await run();

    expect(TranslatorManager.mock.calls[0][0].fabConfig).toEqual({
      isHide: true,
      hideExceptionList: "page.example",
    });
  });

  test("starts transbox-only manager for PDF documents", async () => {
    setContentType("application/pdf");
    getFabWithDefault.mockResolvedValue({
      isHide: false,
      hideExceptionList: "page.example",
    });
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "page.example"
    );

    await run();

    expect(matchRule).toHaveBeenCalledTimes(1);
    expect(TranslatorManager).toHaveBeenCalledTimes(1);
    expect(TranslatorManager.mock.calls[0][0].transboxOnly).toBe(true);
    expect(TranslatorManager.mock.calls[0][0].fabConfig.isHide).toBe(false);
    expect(mockTranslatorManagerStart).toHaveBeenCalledTimes(1);
    expect(runSubtitle).not.toHaveBeenCalled();
  });

  test("skips non-PDF media documents before rule matching and manager startup", async () => {
    setContentType("image/png");

    await run();

    expect(matchRule).not.toHaveBeenCalled();
    expect(TranslatorManager).not.toHaveBeenCalled();
    expect(mockTranslatorManagerStart).not.toHaveBeenCalled();
    expect(runSubtitle).not.toHaveBeenCalled();
  });

  test("creates the userscript GM shim before settings are read", async () => {
    const originalGM = globalThis.GM;
    const originalGMGetValue = globalThis.GM_getValue;
    const originalGMXmlhttpRequest = globalThis.GM_xmlhttpRequest;
    const legacyGetValue = jest.fn();
    const legacyXmlhttpRequest = jest.fn();
    let gmDuringRead;

    delete globalThis.GM;
    globalThis.GM_getValue = legacyGetValue;
    globalThis.GM_xmlhttpRequest = legacyXmlhttpRequest;
    getSettingWithDefault.mockImplementation(async () => {
      gmDuringRead = globalThis.GM;
      return {
      blacklist: "",
      tranboxSetting: { blacklist: "", transOpen: true },
      inputRule: { blacklist: "", transOpen: true },
      mouseHoverSetting: { blacklist: "", useMouseHover: true },
      logLevel: 1,
    };
    });

    try {
      await run(true);

      expect(getSettingWithDefault).toHaveBeenCalledTimes(1);
      expect(gmDuringRead).toBeDefined();
      expect(gmDuringRead.getValue).toBe(legacyGetValue);
      expect(gmDuringRead.xmlHttpRequest).toBe(legacyXmlhttpRequest);
    } finally {
      if (originalGM === undefined) {
        delete globalThis.GM;
      } else {
        globalThis.GM = originalGM;
      }
      if (originalGMGetValue === undefined) {
        delete globalThis.GM_getValue;
      } else {
        globalThis.GM_getValue = originalGMGetValue;
      }
      if (originalGMXmlhttpRequest === undefined) {
        delete globalThis.GM_xmlhttpRequest;
      } else {
        globalThis.GM_xmlhttpRequest = originalGMXmlhttpRequest;
      }
    }
  });

  test("exposes legacy GM value listeners through the direct settings bridge", async () => {
    const keys = [
      "GM",
      "GM_addValueChangeListener",
      "GM_removeValueChangeListener",
    ];
    const originals = keys.map((key) => [key, globalThis[key]]);
    const add = jest.fn();
    const remove = jest.fn();
    globalThis.GM = {};
    globalThis.GM_addValueChangeListener = add;
    globalThis.GM_removeValueChangeListener = remove;
    globalThis.unsafeWindow = {};
    process.env.REACT_APP_OPTIONSPAGE = window.location.href;
    try {
      await run(true);
      expect(globalThis.unsafeWindow.GM.addValueChangeListener).toBe(add);
      expect(globalThis.unsafeWindow.GM.removeValueChangeListener).toBe(remove);
      expectNoNormalUserscriptStartup();
    } finally {
      originals.forEach(([key, value]) => {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      });
    }
  });

  test("fills missing fields on existing userscript GM object", async () => {
    const originalGM = globalThis.GM;
    const originalGMXmlhttpRequest = globalThis.GM_xmlhttpRequest;
    const existingSetValue = jest.fn();
    const legacyXmlhttpRequest = jest.fn();
    let gmDuringRead;

    globalThis.GM = { setValue: existingSetValue };
    globalThis.GM_xmlhttpRequest = legacyXmlhttpRequest;
    getSettingWithDefault.mockImplementation(async () => {
      gmDuringRead = globalThis.GM;
      return {
      blacklist: "",
      tranboxSetting: { blacklist: "", transOpen: true },
      inputRule: { blacklist: "", transOpen: true },
      mouseHoverSetting: { blacklist: "", useMouseHover: true },
      logLevel: 1,
    };
    });

    try {
      await run(true);

      expect(getSettingWithDefault).toHaveBeenCalledTimes(1);
      expect(gmDuringRead.setValue).toBe(existingSetValue);
      expect(gmDuringRead.xmlHttpRequest).toBe(legacyXmlhttpRequest);
    } finally {
      if (originalGM === undefined) {
        delete globalThis.GM;
      } else {
        globalThis.GM = originalGM;
      }
      if (originalGMXmlhttpRequest === undefined) {
        delete globalThis.GM_xmlhttpRequest;
      } else {
        globalThis.GM_xmlhttpRequest = originalGMXmlhttpRequest;
      }
    }
  });

  test("does not replace existing GM xmlHttpRequest", async () => {
    const originalGM = globalThis.GM;
    const originalGMXmlhttpRequest = globalThis.GM_xmlhttpRequest;
    const existingXmlhttpRequest = jest.fn();
    const legacyXmlhttpRequest = jest.fn();
    let gmDuringRead;

    globalThis.GM = { xmlHttpRequest: existingXmlhttpRequest };
    globalThis.GM_xmlhttpRequest = legacyXmlhttpRequest;
    getSettingWithDefault.mockImplementation(async () => {
      gmDuringRead = globalThis.GM;
      return {
      blacklist: "",
      tranboxSetting: { blacklist: "", transOpen: true },
      inputRule: { blacklist: "", transOpen: true },
      mouseHoverSetting: { blacklist: "", useMouseHover: true },
      logLevel: 1,
    };
    });

    try {
      await run(true);

      expect(getSettingWithDefault).toHaveBeenCalledTimes(1);
      expect(gmDuringRead.xmlHttpRequest).toBe(existingXmlhttpRequest);
    } finally {
      if (originalGM === undefined) {
        delete globalThis.GM;
      } else {
        globalThis.GM = originalGM;
      }
      if (originalGMXmlhttpRequest === undefined) {
        delete globalThis.GM_xmlhttpRequest;
      } else {
        globalThis.GM_xmlhttpRequest = originalGMXmlhttpRequest;
      }
    }
  });

  test("falls back when unsafeWindow grant exists but unsafeWindow is unavailable", async () => {
    const originalHref = window.location.href;
    window.history.pushState({}, "", "/options.html");
    process.env.REACT_APP_OPTIONSPAGE = window.location.href;
    globalThis.GM = {
      info: {
        script: {
          grant: ["unsafeWindow"],
        },
      },
    };

    try {
      await run(true);

      expect(injectInlineJs).toHaveBeenCalledTimes(1);
      expect(injectInlineJs.mock.calls[0][1]).toBe(
        "kiss-translator-options-injector"
      );
      expectNoNormalUserscriptStartup();
    } finally {
      window.history.pushState({}, "", originalHref);
      delete globalThis.GM;
    }
  });

  test("mounts GM directly when unsafeWindow is available", async () => {
    const originalHref = window.location.href;
    const gm = {
      info: {
        script: {
          grant: ["unsafeWindow"],
        },
      },
    };
    window.history.pushState({}, "", "/options.html");
    process.env.REACT_APP_OPTIONSPAGE = window.location.href;
    globalThis.GM = gm;
    globalThis.unsafeWindow = {};

    try {
      await run(true);

      expect(globalThis.unsafeWindow.GM).toBe(gm);
      expect(globalThis.unsafeWindow.APP_INFO).toEqual({
        name: process.env.REACT_APP_NAME,
        version: process.env.REACT_APP_VERSION,
      });
      expect(injectInlineJs).not.toHaveBeenCalled();
      expectNoNormalUserscriptStartup();
    } finally {
      window.history.pushState({}, "", originalHref);
      delete globalThis.GM;
    }
  });

  test("falls back when GM grant metadata is missing", async () => {
    const originalHref = window.location.href;
    window.history.pushState({}, "", "/options.html");
    process.env.REACT_APP_OPTIONSPAGE = window.location.href;
    globalThis.GM = { info: {} };

    try {
      await run(true);

      expect(injectInlineJs).toHaveBeenCalledTimes(1);
      expect(injectInlineJs.mock.calls[0][1]).toBe(
        "kiss-translator-options-injector"
      );
      expectNoNormalUserscriptStartup();
    } finally {
      window.history.pushState({}, "", originalHref);
      delete globalThis.GM;
    }
  });

  test("uses setting page proxy for dev userscript options page", async () => {
    const originalHref = window.location.href;
    window.history.pushState({}, "", "/options");
    process.env.REACT_APP_OPTIONSPAGE_DEV = window.location.href;
    globalThis.GM = { info: {} };

    try {
      await run(true);

      expect(injectInlineJs).toHaveBeenCalledTimes(1);
      expect(injectInlineJs.mock.calls[0][1]).toBe(
        "kiss-translator-options-injector"
      );
      expectNoNormalUserscriptStartup();
    } finally {
      window.history.pushState({}, "", originalHref);
      delete globalThis.GM;
    }
  });

  test("uses setting page proxy for local userscript options page", async () => {
    const originalHref = window.location.href;
    window.history.pushState({}, "", "/options.html");
    process.env.REACT_APP_OPTIONSPAGE_LOCAL = window.location.href;
    globalThis.GM = { info: {} };

    try {
      await run(true);

      expect(injectInlineJs).toHaveBeenCalledTimes(1);
      expect(injectInlineJs.mock.calls[0][1]).toBe(
        "kiss-translator-options-injector"
      );
      expectNoNormalUserscriptStartup();
    } finally {
      window.history.pushState({}, "", originalHref);
      delete globalThis.GM;
    }
  });
});

const mockTranslatorManagerStart = jest.fn();
let mockIsIframe = false;

jest.mock("./libs/storage", () => ({
  getSettingWithDefault: jest.fn(),
  getFabWithDefault: jest.fn(),
}));

jest.mock("./libs/iframe", () => ({
  get isIframe() {
    return mockIsIframe;
  },
}));

jest.mock("./libs/blacklist", () => ({
  isInBlacklist: jest.fn(() => false),
  matchingBlacklistEntries: jest.fn(() => []),
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

const mockStartPageRuntime = jest.fn(async () => ({}));
jest.mock("./libs/pageRuntime", () => ({
  startPageRuntime: (...args) => mockStartPageRuntime(...args),
}));

jest.mock("./libs/translatorManager", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    start: mockTranslatorManagerStart,
  })),
}));

const { getSettingWithDefault, getFabWithDefault } = require("./libs/storage");
const { isInBlacklist, matchingBlacklistEntries } = require("./libs/blacklist");
const { runSubtitle } = require("./subtitle/subtitle");
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
    isInBlacklist.mockImplementation(() => false);
    matchingBlacklistEntries.mockImplementation(() => []);
    mockStartPageRuntime.mockClear();

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

  test("starts the page runtime for an iframe with text and does not build the manager itself", async () => {
    mockIsIframe = true;
    document.body.innerHTML = "<main>Hello iframe</main>";

    await run();

    expect(TranslatorManager).not.toHaveBeenCalled();
    expect(mockStartPageRuntime).toHaveBeenCalledTimes(1);
    expect(mockStartPageRuntime.mock.calls[0][0].isIframe).toBe(true);
    expect(mockStartPageRuntime.mock.calls[0][0].manager).toBeUndefined();
    mockStartPageRuntime.mock.calls[0][0].onActivate({
      href: window.location.href,
      setting: {},
      rule: {},
    });
    expect(runSubtitle).not.toHaveBeenCalled();
  });

  test("skips an empty iframe before starting the runtime", async () => {
    mockIsIframe = true;
    document.body.innerHTML = `
      <script>const text = "ignored";</script>
      <style>.ignored { color: red; }</style>
      <textarea>ignored</textarea>
    `;

    await run();

    expect(mockStartPageRuntime).not.toHaveBeenCalled();
    expect(TranslatorManager).not.toHaveBeenCalled();
  });

  test("waits for DOMContentLoaded before skipping a loading iframe", async () => {
    mockIsIframe = true;
    setReadyState("loading");

    const running = run();
    await Promise.resolve();

    document.body.innerHTML = "<p>Late iframe text</p>";
    setReadyState("interactive");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    await running;

    expect(mockStartPageRuntime).toHaveBeenCalledTimes(1);
    expect(TranslatorManager).not.toHaveBeenCalled();
  });

  test("does not apply the empty-text gate to top-level pages", async () => {
    mockIsIframe = false;

    await run();

    const options = mockStartPageRuntime.mock.calls[0][0];
    expect(options.transboxOnly).toBe(false);
    expect(options.manager).toBeUndefined();
    expect(TranslatorManager).not.toHaveBeenCalled();
    options.onActivate({
      href: window.location.href,
      setting: { logLevel: 1 },
      rule: { transOpen: "true" },
    });
    expect(runSubtitle).toHaveBeenCalledTimes(1);
  });

  test("passes the stored setting through without constructing a manager", async () => {
    const stored = {
      blacklist: "",
      tranboxSetting: { blacklist: "feature-off", transOpen: true },
      inputRule: { blacklist: "feature-off", transOpen: true },
      mouseHoverSetting: { blacklist: "feature-off", useMouseHover: true },
      logLevel: 1,
    };
    const freeze = (value) => {
      if (!value || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
      }
      Object.values(value).forEach(freeze);
      return Object.freeze(value);
    };
    freeze(stored);
    getSettingWithDefault.mockResolvedValue(stored);
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "feature-off"
    );

    await run();

    expect(TranslatorManager).not.toHaveBeenCalled();
    const runtimeSetting = mockStartPageRuntime.mock.calls.at(-1)[0].setting;
    expect(runtimeSetting).toBe(stored);
    expect(stored.tranboxSetting.transOpen).toBe(true);
    expect(stored.inputRule.transOpen).toBe(true);
    expect(stored.mouseHoverSetting.useMouseHover).toBe(true);
  });

  test("passes a normalized FAB config through when hiddenSites lists the page", async () => {
    getFabWithDefault.mockResolvedValue({
      isHide: false,
      hiddenSites: "page.example",
      shownSites: "",
    });
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "page.example"
    );

    await run();

    expect(mockStartPageRuntime.mock.calls[0][0].fabConfig).toMatchObject({
      isHide: false,
      hiddenSites: "page.example",
      shownSites: "",
    });
    expect(TranslatorManager).not.toHaveBeenCalled();
  });

  test("passes a globally hidden FAB config through when shownSites lists the page", async () => {
    getFabWithDefault.mockResolvedValue({
      isHide: true,
      hiddenSites: "",
      shownSites: "page.example",
    });
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "page.example"
    );

    await run();

    expect(mockStartPageRuntime.mock.calls[0][0].fabConfig).toMatchObject({
      isHide: true,
      hiddenSites: "",
      shownSites: "page.example",
    });
  });

  test("asks the runtime for a transbox-only PDF without starting subtitles", async () => {
    setContentType("application/pdf");
    getFabWithDefault.mockResolvedValue({
      isHide: false,
      hiddenSites: "page.example",
      shownSites: "",
    });
    isInBlacklist.mockImplementation(
      (_href, blacklist) => blacklist === "page.example"
    );

    await run();

    const options = mockStartPageRuntime.mock.calls[0][0];
    expect(options.transboxOnly).toBe(true);
    expect(options.fabConfig.isHide).toBe(false);
    expect(options.manager).toBeUndefined();
    expect(TranslatorManager).not.toHaveBeenCalled();
    options.onActivate({
      href: window.location.href,
      setting: {},
      rule: {},
    });
    expect(runSubtitle).not.toHaveBeenCalled();
  });

  test("still hands a blacklisted page to the runtime without a manager", async () => {
    matchingBlacklistEntries.mockReturnValue(["localhost"]);

    await run();

    expect(TranslatorManager).not.toHaveBeenCalled();
    expect(runSubtitle).not.toHaveBeenCalled();
    expect(mockStartPageRuntime).toHaveBeenCalledTimes(1);
    const parkedOptions = mockStartPageRuntime.mock.calls[0][0];
    expect(parkedOptions.manager).toBeUndefined();
    expect(parkedOptions.isIframe).toBe(false);
  });

  test("skips non-PDF media documents before the runtime starts", async () => {
    setContentType("image/png");

    await run();

    expect(mockStartPageRuntime).not.toHaveBeenCalled();
    expect(TranslatorManager).not.toHaveBeenCalled();
    expect(runSubtitle).not.toHaveBeenCalled();
  });
});

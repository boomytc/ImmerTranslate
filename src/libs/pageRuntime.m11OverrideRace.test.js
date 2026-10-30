jest.mock("./browser", () => ({
  browser: {
    runtime: {
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  },
}));
jest.mock("./log", () => ({
  logger: { info: jest.fn(), debug: jest.fn() },
  LogLevel: { INFO: { value: 1, name: "INFO" } },
}));
jest.mock("./popupDocument", () => ({
  getPopupDocumentIdentity: () => ({
    token: "document",
    url: "http://localhost/index.html",
  }),
}));
jest.mock("./storageState", () => ({
  getStorageState: jest.fn(() => ({
    subscribe: () => () => {},
  })),
}));
jest.mock("./translatorManager", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("./rules", () => {
  const { isMatch } = jest.requireActual("./utils");
  const { GLOBAL_KEY } = jest.requireActual("../config");
  const matchesRulePattern = (href, pattern) =>
    String(pattern || "")
      .split(/\n|,/)
      .some((item) => {
        const text = item.trim();
        return text !== "" && text !== GLOBAL_KEY && isMatch(href, text);
      });
  return {
    matchRule: jest.fn(async () => ({ transOpen: "false" })),
    matchesRulePattern,
    findMatchingRule: (rules, href) =>
      (rules || []).find(
        (rule) =>
          rule?.pattern !== GLOBAL_KEY &&
          rule?.enabled !== false &&
          matchesRulePattern(href, rule.pattern)
      ),
  };
});
const { PageRuntime } = require("./pageRuntime");

describe("M11 manual override race", () => {
  const runtimes = [];

  afterEach(() => {
    runtimes.forEach((runtime) => runtime.stop());
    runtimes.length = 0;
    window.history.pushState({}, "", "/stay-clear");
  });

  function boot(options) {
    let onRules = () => {};
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
    };
    const runtime = new PageRuntime({
      manager,
      setting: {
        blacklist: "",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
      rule: { transOpen: "false", pattern: "stored" },
      getHref: () => window.location.href,
      matchRule: async () => ({ transOpen: "false", pattern: "stored" }),
      subscribeSetting: (listener) => {
        listener({
          data: {
            blacklist: "",
            tranboxSetting: {},
            inputRule: {},
            mouseHoverSetting: {},
          },
        });
        return () => {};
      },
      subscribeRules: (listener) => {
        onRules = listener;
        listener({ data: [] });
        return () => {};
      },
      ...options,
    });
    runtimes.push(runtime);
    return {
      runtime,
      manager,
      get onRules() {
        return onRules;
      },
    };
  }

  test("manual enable after the initial rules load survives the same rules arriving again", async () => {
    window.history.pushState({}, "", "/index.html");
    const harness = boot();
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    expect(harness.manager.applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );

    harness.onRules({ data: [] });
    await harness.runtime.whenIdle();

    expect(harness.manager.applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
    expect(harness.manager.pause).not.toHaveBeenCalled();
  });

  test("manual enable after personal rules settle on follow-global survives a later reconcile", async () => {
    window.history.pushState({}, "", "/index.html");
    const harness = boot();
    await harness.runtime.start();
    harness.onRules({ data: [] });
    await harness.runtime.whenIdle();
    harness.manager.applyTarget.mockClear();

    harness.runtime.setManualSwitch(true);
    harness.onRules({ data: [{ pattern: "*", transOpen: "false" }] });
    await harness.runtime.whenIdle();

    expect(harness.manager.applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
  });
});

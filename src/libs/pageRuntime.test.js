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
    url: "http://localhost/stay-clear",
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
const {
  PageRuntime,
  watchPageLocation,
  withFeatureBlacklists,
} = require("./pageRuntime");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
const { LOCATION_CHANGE_EVENT } = require("./locationHook");

const nativePushState = History.prototype.pushState;

function goViaPage(path) {
  nativePushState.call(window.history, {}, "", path);
  window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
}

async function flushHistory() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("PageRuntime", () => {
  const runtimes = [];

  afterEach(() => {
    runtimes.forEach((runtime) => runtime.stop());
    runtimes.length = 0;
    window.history.pushState({}, "", "/stay-clear");
  });

  function boot(options) {
    const created = [];
    const managers = [];
    const listeners = [];
    let onSetting = () => {};
    let onRules = () => {};
    const runtime = new PageRuntime({
      setting: {
        blacklist: "",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
      getHref: () => window.location.href,
      matchRule: async (href) => ({
        transOpen: String(href).includes("auto-translate") ? "true" : "false",
        pattern: href,
      }),
      createManager: (config) => {
        created.push(config);
        let liveTransOpen = config.rule?.transOpen;
        let paused = false;
        const manager = {
          start: jest.fn(),
          stop: jest.fn(),
          pause: jest.fn(() => {
            paused = true;
            liveTransOpen = "false";
          }),
          resume: jest.fn(() => {
            paused = false;
          }),
          applyTarget: jest.fn((target) => {
            liveTransOpen = target?.rule?.transOpen;
          }),
          readLiveTransOpen: () => liveTransOpen,
          isPaused: () => paused,
        };
        managers.push(manager);
        return manager;
      },
      subscribeSetting: (listener) => {
        onSetting = listener;
        return () => {};
      },
      subscribeRules: (listener) => {
        onRules = listener;
        return () => {};
      },
      listen: (handler) => {
        listeners.push(handler);
        return () => {
          const index = listeners.indexOf(handler);
          if (index >= 0) listeners.splice(index, 1);
        };
      },
      getFavWords: async () => [],
      ...options,
    });
    runtimes.push(runtime);
    return {
      runtime,
      created,
      managers,
      listeners,
      get onSetting() {
        return onSetting;
      },
      get onRules() {
        return onRules;
      },
    };
  }

  test("pushState into and out of the blacklist parks and resumes without auto-translate", async () => {
    window.history.pushState({}, "", "/stay-clear");
    const { runtime, created, managers, listeners } = boot({
      setting: {
        blacklist: "page-blocked",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    });
    await runtime.start();
    expect(created).toHaveLength(1);
    expect(created[0].rule.transOpen).toBe("false");
    expect(listeners).toHaveLength(0);

    goViaPage("/page-blocked");
    await runtime.whenIdle();
    expect(managers[0].stop).not.toHaveBeenCalled();
    expect(managers[0].pause).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(managers[0].applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "paused",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );

    window.history.back();
    await flushHistory();
    await runtime.whenIdle();
    expect(created).toHaveLength(1);
    expect(managers[0].resume).toHaveBeenCalled();
    expect(managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );
  });

  test("pushState applies the next URL's site rule", async () => {
    window.history.pushState({}, "", "/stay-clear");
    const harness = boot();
    const { runtime, managers } = harness;
    await runtime.start();
    harness.onRules({
      data: [{ pattern: "auto-translate", transOpen: "true" }],
    });
    await runtime.whenIdle();
    goViaPage("/auto-translate");
    await runtime.whenIdle();
    expect(managers[0].applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
    goViaPage("/plain-page");
    await runtime.whenIdle();
    expect(managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );
  });

  test("popstate recalculates blacklist and site rules", async () => {
    window.history.pushState({}, "", "/auto-translate");
    window.history.pushState({}, "", "/page-blocked");
    window.history.back();
    await flushHistory();
    const harness = boot({
      setting: {
        blacklist: "page-blocked",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    });
    const { runtime, managers, listeners } = harness;
    await runtime.start();
    harness.onRules({
      data: [{ pattern: "auto-translate", transOpen: "true" }],
    });
    await runtime.whenIdle();
    expect(window.location.href).toContain("/auto-translate");
    expect(managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
    expect(listeners).toHaveLength(0);
    window.history.forward();
    await flushHistory();
    await runtime.whenIdle();
    expect(window.location.href).toContain("/page-blocked");
    expect(managers[0].pause).toHaveBeenCalledTimes(1);
    expect(managers[0].stop).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(0);
  });

  function pageSetting(blacklist) {
    return {
      data: {
        blacklist,
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    };
  }

  test("a manually enabled page stays on after a blacklist entry temporarily matches", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].pause).toHaveBeenCalled();
    expect(harness.managers[0].stop).not.toHaveBeenCalled();
    expect(harness.created).toHaveLength(1);
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
    expect(harness.managers[0].readLiveTransOpen()).toBe("true");
  });

  test("a manually enabled page stays on when an unrelated blacklist entry is saved", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    harness.onSetting(pageSetting("example.com"));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].pause).not.toHaveBeenCalled();
    expect(harness.created).toHaveLength(1);
    expect(harness.managers[0].readLiveTransOpen()).toBe("true");
  });

  test("a manually disabled page stays off after a blacklist entry temporarily matches", async () => {
    window.history.pushState({}, "", "/auto-translate");
    const harness = boot();
    await harness.runtime.start();
    harness.onRules({
      data: [{ pattern: "auto-translate", transOpen: "true" }],
    });
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
    harness.runtime.setManualSwitch(false);
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(harness.created).toHaveLength(1);
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );
  });

  test("a never-translate policy chosen while parked turns the page off", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onRules({
      data: [{ pattern: "localhost", transOpen: "false" }],
    });
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );
  });

  test("an always-translate policy chosen while parked turns the page on", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.runtime.setManualSwitch(false);
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onRules({
      data: [{ pattern: "localhost", transOpen: "true" }],
    });
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
  });

  test("an unchanged site policy restores the live switch after parking", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    let siteTransOpen = "*";
    const harness = boot({
      matchRule: async (href) => ({ transOpen: siteTransOpen, pattern: href }),
    });
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(siteTransOpen).toBe("*");
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
  });

  test("does not keep a parked switch after the page moves to another url", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    harness.onSetting(pageSetting("spa2.html/plain"));
    await harness.runtime.whenIdle();
    goViaPage("/other-clear");
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );
  });

  test("publishes the matched rule when a blocked page leaves the blacklist", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot({
      setting: {
        blacklist: "localhost",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
      matchRule: async (href) => ({
        transOpen: "false",
        fromLang: "en",
        toLang: "zh-CN",
        apiSlug: "deepl",
        pattern: href,
      }),
    });
    await harness.runtime.start();
    expect(harness.created).toHaveLength(1);
    expect(harness.created[0].rule).toEqual(
      expect.objectContaining({
        fromLang: "en",
        toLang: "zh-CN",
        apiSlug: "deepl",
        transOpen: "false",
      })
    );
    expect(harness.managers[0].pause).toHaveBeenCalledTimes(1);
    expect(harness.listeners).toHaveLength(0);
    harness.onSetting(pageSetting(""));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rule: expect.objectContaining({
          fromLang: "en",
          toLang: "zh-CN",
          apiSlug: "deepl",
        }),
      })
    );
  });

  test("a blacklist edit stops translation, and removing it does not auto-start unless the rule says so", async () => {
    window.history.pushState({}, "", "/live-page");
    const harness = boot();
    await harness.runtime.start();
    harness.onSetting({
      data: {
        blacklist: "live-page",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    });
    await harness.runtime.whenIdle();
    expect(harness.managers[0].pause).toHaveBeenCalledTimes(1);
    expect(harness.managers[0].stop).not.toHaveBeenCalled();
    harness.onSetting({
      data: {
        blacklist: "",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    });
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ transOpen: "false" }),
      })
    );

    harness.onRules({
      data: [{ pattern: "auto-translate", transOpen: "true" }],
    });
    await harness.runtime.whenIdle();
    goViaPage("/auto-translate");
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
  });

  test("a main-world location event recalculates, and the content script does not wrap history.pushState", async () => {
    const historyPush = window.history.pushState;
    window.history.pushState({}, "", "/stay-clear");
    const harness = boot();
    const { runtime, managers } = harness;
    await runtime.start();
    harness.onRules({
      data: [{ pattern: "auto-translate", transOpen: "true" }],
    });
    await runtime.whenIdle();
    managers[0].applyTarget.mockClear();
    expect(History.prototype.pushState).toBe(nativePushState);
    expect(window.history.pushState).toBe(historyPush);

    const stop = watchPageLocation(() => {});
    expect(window.history.pushState).toBe(historyPush);
    expect(History.prototype.pushState).toBe(nativePushState);
    stop();

    nativePushState.call(window.history, {}, "", "/auto-translate");
    await runtime.whenIdle();
    expect(managers[0].applyTarget).not.toHaveBeenCalled();

    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    await runtime.whenIdle();
    expect(managers[0].applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );

    runtime.stop();
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    await runtime.whenIdle();
    expect(managers[0].applyTarget).toHaveBeenCalledTimes(1);
    expect(window.history.pushState).toBe(historyPush);
  });

  test("an inserted iframe follows the top frame and is told to restore when it turns off", async () => {
    window.history.pushState({}, "", "/child-embed");
    let parent = { transOpen: true, fabVisible: false };
    const harness = boot({
      isIframe: true,
      queryParent: async () => parent,
      matchRule: async () => ({ transOpen: "false", apiSlug: "stored" }),
    });
    await harness.runtime.start();
    expect(harness.created[0].rule).toMatchObject({
      transOpen: "true",
      apiSlug: "stored",
    });
    parent = { transOpen: false, fabVisible: true };
    harness.onRules({ data: [{ pattern: "*", transOpen: "false" }] });
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({
          apiSlug: "stored",
          transOpen: "false",
        }),
      })
    );
  });

  test("M11 a new frame does not write its initial state back onto the parent", async () => {
    window.history.pushState({}, "", "/index.html");
    const parent = boot({
      rule: { transOpen: "false", pattern: "stored" },
      matchRule: async () => ({ transOpen: "false", pattern: "stored" }),
    });
    await parent.runtime.start();
    parent.runtime.setManualSwitch(true);
    expect(parent.managers[0].readLiveTransOpen()).toBe("true");
    const parentApplies = parent.managers[0].applyTarget.mock.calls.length;

    const child = boot({
      isIframe: true,
      queryParent: async () => ({
        transOpen: parent.managers[0].readLiveTransOpen() === "true",
        fabVisible: false,
      }),
      matchRule: async () => ({ transOpen: "false", pattern: "stored" }),
    });
    await child.runtime.start();

    expect(child.created[0].rule).toMatchObject({ transOpen: "true" });
    expect(parent.managers[0].applyTarget).toHaveBeenCalledTimes(parentApplies);
    expect(parent.managers[0].readLiveTransOpen()).toBe("true");

    child.onRules({
      data: [{ pattern: "localhost", transOpen: "false" }],
    });
    await child.runtime.whenIdle();
    expect(parent.managers[0].applyTarget).toHaveBeenCalledTimes(parentApplies);
    expect(parent.managers[0].readLiveTransOpen()).toBe("true");
  });

  test("S20 a selector edit keeps a manual on switch", async () => {
    window.history.pushState({}, "", "/index.html");
    let matched = { transOpen: "false", selector: "p", pattern: "stored" };
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
      rule: { transOpen: "true" },
    };
    const harness = boot({
      manager,
      rule: { transOpen: "false", selector: "p", pattern: "stored" },
      matchRule: async () => matched,
    });
    await harness.runtime.start();
    harness.onRules({
      data: [{ pattern: "localhost", selector: "p", transOpen: "false" }],
    });
    await harness.runtime.whenIdle();
    harness.runtime.setManualSwitch(true);
    matched = { transOpen: "false", selector: "article", pattern: "stored" };
    harness.onRules({
      data: [{ pattern: "localhost", selector: "article", transOpen: "false" }],
    });
    await harness.runtime.whenIdle();
    expect(manager.stop).not.toHaveBeenCalled();
    expect(manager.applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({
          selector: "article",
          transOpen: "true",
        }),
      })
    );
  });

  test("S21 changing the site policy to false turns the page off", async () => {
    window.history.pushState({}, "", "/index.html");
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
    };
    let matched = { transOpen: "true", selector: "p", pattern: "stored" };
    const harness = boot({
      manager,
      rule: { transOpen: "true", selector: "p", pattern: "stored" },
      matchRule: async () => matched,
    });
    await harness.runtime.start();
    matched = { transOpen: "false", selector: "p", pattern: "stored" };
    harness.onRules({
      data: [{ pattern: "localhost", selector: "p", transOpen: "false" }],
    });
    await harness.runtime.whenIdle();
    expect(manager.applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "off",
        rule: expect.objectContaining({ selector: "p", transOpen: "false" }),
      })
    );
  });

  test("a stored personal rule without transOpen follows the global rule", async () => {
    window.history.pushState({}, "", "/index.html");
    const harness = boot({
      matchRule: async () => ({ transOpen: "false", selector: "p" }),
    });
    await harness.runtime.start();
    harness.onRules({
      data: [
        { pattern: "*", transOpen: "true" },
        { pattern: "localhost", selector: "article" },
      ],
    });
    await harness.runtime.whenIdle();
    expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ transOpen: "true" }),
      })
    );
  });

  test.each([
    ["missing", [{ pattern: "localhost" }]],
    [
      "illegal",
      [{ pattern: "*", transOpen: "bogus" }, { pattern: "localhost" }],
    ],
  ])(
    "a global rule that is %s reads as false when the page follows it",
    async (_label, rules) => {
      window.history.pushState({}, "", "/index.html");
      const harness = boot({
        matchRule: async () => ({ transOpen: "true", selector: "p" }),
      });
      await harness.runtime.start();
      harness.onRules({ data: rules });
      await harness.runtime.whenIdle();
      expect(harness.managers[0].applyTarget).toHaveBeenLastCalledWith(
        expect.objectContaining({
          state: "off",
          rule: expect.objectContaining({ transOpen: "false" }),
        })
      );
    }
  );

  test("a personal rule with an illegal transOpen errors instead of following", async () => {
    window.history.pushState({}, "", "/index.html");
    const { logger } = require("./log");
    const harness = boot({
      matchRule: async () => ({ transOpen: "false", selector: "p" }),
    });
    await harness.runtime.start();
    harness.managers[0].applyTarget.mockClear();
    harness.onRules({
      data: [
        { pattern: "*", transOpen: "true" },
        { pattern: "localhost", transOpen: "bogus" },
      ],
    });
    await harness.runtime.whenIdle();
    expect(logger.info).toHaveBeenCalledWith(
      "page runtime",
      expect.any(TypeError)
    );
    expect(harness.managers[0].applyTarget).not.toHaveBeenCalled();
  });

  test("withFeatureBlacklists leaves a frozen stored setting unchanged", () => {
    const stored = deepFreeze({
      blacklist: "",
      tranboxSetting: { transOpen: true, blacklist: "feature-off" },
      inputRule: { transOpen: true, blacklist: "feature-off" },
      mouseHoverSetting: { useMouseHover: true, blacklist: "feature-off" },
    });
    const blocked = withFeatureBlacklists(
      stored,
      "http://localhost/feature-off/page"
    );
    const open = withFeatureBlacklists(stored, "http://localhost/clear-page");
    expect(blocked.tranboxSetting.transOpen).toBe(false);
    expect(blocked.inputRule.transOpen).toBe(false);
    expect(blocked.mouseHoverSetting.useMouseHover).toBe(false);
    expect(open.tranboxSetting.transOpen).toBe(true);
    expect(open.inputRule.transOpen).toBe(true);
    expect(open.mouseHoverSetting.useMouseHover).toBe(true);
    expect(stored.tranboxSetting.transOpen).toBe(true);
    expect(stored.inputRule.transOpen).toBe(true);
    expect(stored.mouseHoverSetting.useMouseHover).toBe(true);
    expect(blocked).not.toBe(stored);
    expect(blocked.tranboxSetting).not.toBe(stored.tranboxSetting);
  });

  test("leaving a feature blacklist restores selection input and hover and returning turns them off", async () => {
    window.history.pushState({}, "", "/feature-off/page");
    const stored = deepFreeze({
      blacklist: "",
      tranboxSetting: { transOpen: true, blacklist: "feature-off" },
      inputRule: { transOpen: true, blacklist: "feature-off" },
      mouseHoverSetting: { useMouseHover: true, blacklist: "feature-off" },
    });
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
      rule: { transOpen: "false" },
    };
    const harness = boot({
      manager,
      setting: stored,
      rule: { transOpen: "false", selector: "p" },
      matchRule: async () => ({ transOpen: "false", selector: "p" }),
    });
    await harness.runtime.start();
    expect(manager.applyTarget).not.toHaveBeenCalled();
    expect(stored.tranboxSetting.transOpen).toBe(true);
    expect(stored.inputRule.transOpen).toBe(true);
    expect(stored.mouseHoverSetting.useMouseHover).toBe(true);

    goViaPage("/clear-page");
    await harness.runtime.whenIdle();
    expect(manager.applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        setting: expect.objectContaining({
          tranboxSetting: expect.objectContaining({ transOpen: true }),
          inputRule: expect.objectContaining({ transOpen: true }),
          mouseHoverSetting: expect.objectContaining({
            useMouseHover: true,
          }),
        }),
      })
    );

    goViaPage("/feature-off/back");
    await harness.runtime.whenIdle();
    expect(manager.applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        setting: expect.objectContaining({
          tranboxSetting: expect.objectContaining({ transOpen: false }),
          inputRule: expect.objectContaining({ transOpen: false }),
          mouseHoverSetting: expect.objectContaining({
            useMouseHover: false,
          }),
        }),
      })
    );
    expect(stored.tranboxSetting.transOpen).toBe(true);
    expect(stored.inputRule.transOpen).toBe(true);
    expect(stored.mouseHoverSetting.useMouseHover).toBe(true);
  });

  test("a feature blacklist edit is applied without changing the translation switch", async () => {
    window.history.pushState({}, "", "/index.html");
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
      rule: { transOpen: "true" },
    };
    const harness = boot({
      manager,
      rule: { transOpen: "false", selector: "p" },
      setting: {
        blacklist: "",
        tranboxSetting: { transOpen: true, blacklist: "" },
        inputRule: { transOpen: true, blacklist: "" },
        mouseHoverSetting: { useMouseHover: true, blacklist: "" },
      },
      matchRule: async () => ({ transOpen: "false", selector: "p" }),
    });
    await harness.runtime.start();
    harness.runtime.setManualSwitch(true);
    harness.onSetting({
      data: {
        blacklist: "",
        tranboxSetting: { transOpen: true, blacklist: "index.html" },
        inputRule: { transOpen: true, blacklist: "" },
        mouseHoverSetting: { useMouseHover: true, blacklist: "" },
      },
    });
    await harness.runtime.whenIdle();
    expect(manager.stop).not.toHaveBeenCalled();
    expect(manager.pause).not.toHaveBeenCalled();
    expect(manager.applyTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "on",
        rule: expect.objectContaining({ selector: "p", transOpen: "true" }),
        setting: expect.objectContaining({
          tranboxSetting: expect.objectContaining({
            blacklist: "index.html",
            transOpen: false,
          }),
          inputRule: expect.objectContaining({ transOpen: true }),
          mouseHoverSetting: expect.objectContaining({
            useMouseHover: true,
          }),
        }),
      })
    );
  });

  test("a child frame pauses on its own url and leaves the top frame running", async () => {
    const topNotify = [];
    const childNotify = [];
    let topHref = "http://localhost:8765/spa-frame.html";
    let childHref = "http://localhost:8765/spa2.html";
    const setting = {
      blacklist: "spa2.html/blocked",
      tranboxSetting: {},
      inputRule: {},
      mouseHoverSetting: {},
    };
    const watchLocation = (bucket) => (onChange) => {
      bucket.push(onChange);
      return () => {};
    };
    const topManager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
      rule: { transOpen: "true" },
    };
    const top = boot({
      manager: topManager,
      setting,
      getHref: () => topHref,
      watchLocation: watchLocation(topNotify),
      matchRule: async () => ({ transOpen: "false" }),
    });
    const child = boot({
      isIframe: true,
      setting,
      getHref: () => childHref,
      watchLocation: watchLocation(childNotify),
      matchRule: async () => ({ transOpen: "false", apiSlug: "child" }),
      queryParent: async () => ({ transOpen: true, fabVisible: true }),
    });
    await top.runtime.start();
    await child.runtime.start();
    const childManager = child.managers[0];
    expect(child.created[0].rule.transOpen).toBe("true");

    childHref = "http://localhost:8765/spa2.html/blocked";
    childNotify.forEach((onChange) => onChange());
    expect(topNotify).toHaveLength(1);
    await Promise.all([top.runtime.whenIdle(), child.runtime.whenIdle()]);

    expect(childManager.pause).toHaveBeenCalledTimes(1);
    expect(childManager.stop).not.toHaveBeenCalled();
    expect(childManager.applyTarget).toHaveBeenCalledWith(
      expect.objectContaining({ state: "paused" })
    );
    expect(topManager.pause).not.toHaveBeenCalled();
    expect(topManager.stop).not.toHaveBeenCalled();
    expect(topManager.applyTarget).not.toHaveBeenCalled();
    expect(topManager.rule.transOpen).toBe("true");
    expect(top.listeners).toHaveLength(0);
    expect(child.listeners).toHaveLength(0);
  });

  test("a blacklisted top frame does not pause a child that misses the blacklist", async () => {
    const topNotify = [];
    const childNotify = [];
    let topHref = "http://localhost:8765/spa-frame.html";
    const childHref = "http://localhost:8765/spa2.html";
    const setting = {
      blacklist: "spa-frame.html/blocked",
      tranboxSetting: {},
      inputRule: {},
      mouseHoverSetting: {},
    };
    const watchLocation = (bucket) => (onChange) => {
      bucket.push(onChange);
      return () => {};
    };
    const topManager = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      applyTarget: jest.fn(),
      rule: { transOpen: "true" },
    };
    const top = boot({
      manager: topManager,
      setting,
      getHref: () => topHref,
      watchLocation: watchLocation(topNotify),
      matchRule: async () => ({ transOpen: "false" }),
    });
    const child = boot({
      isIframe: true,
      setting,
      getHref: () => childHref,
      watchLocation: watchLocation(childNotify),
      matchRule: async () => ({ transOpen: "false" }),
      queryParent: async () => ({ transOpen: true, fabVisible: false }),
    });
    await top.runtime.start();
    await child.runtime.start();
    const childManager = child.managers[0];

    topHref = "http://localhost:8765/spa-frame.html/blocked";
    topNotify.forEach((onChange) => onChange());
    expect(childNotify).toHaveLength(1);
    await Promise.all([top.runtime.whenIdle(), child.runtime.whenIdle()]);

    expect(topManager.pause).toHaveBeenCalledTimes(1);
    expect(topManager.stop).not.toHaveBeenCalled();
    expect(top.listeners).toHaveLength(0);
    expect(childManager.pause).not.toHaveBeenCalled();
    expect(childManager.stop).not.toHaveBeenCalled();
    expect(child.listeners).toHaveLength(0);
    expect(childManager.applyTarget).not.toHaveBeenCalled();
  });
});

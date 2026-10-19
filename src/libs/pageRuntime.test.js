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
jest.mock("./rules", () => ({
  matchRule: jest.fn(async () => ({ transOpen: "false" })),
}));
jest.mock("./subRules", () => ({
  loadOrFetchSubRules: jest.fn(),
}));

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

const MSG_TRANS_GETRULE = "trans_getrule";
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
        const manager = {
          start: jest.fn(),
          stop: jest.fn(),
          publishRuntimeRule: jest.fn(),
          applyLocationRule: jest.fn((update) => {
            if (
              update?.policy?.transOpen === "true" ||
              update?.policy?.transOpen === "false"
            ) {
              liveTransOpen = update.policy.transOpen;
            }
          }),
          readLiveTransOpen: () => liveTransOpen,
          setLiveTransOpen: (value) => {
            liveTransOpen = value;
          },
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
    expect(managers[0].stop).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(1);
    const parked = listeners[0]({ action: MSG_TRANS_GETRULE });
    expect(parked.rule.transOpen).toBe("false");
    expect(parked.setting).toBeTruthy();
    expect(parked.blacklistEntries).toEqual(["page-blocked"]);
    expect(parked.capabilities.pageTranslation).toBe(true);

    window.history.back();
    await flushHistory();
    await runtime.whenIdle();
    expect(created).toHaveLength(2);
    expect(created[1].rule.transOpen).toBe("false");
    expect(listeners).toHaveLength(0);
  });

  test("pushState applies the next URL's site rule", async () => {
    window.history.pushState({}, "", "/stay-clear");
    const { runtime, managers } = boot();
    await runtime.start();
    goViaPage("/auto-translate");
    await runtime.whenIdle();
    expect(managers[0].applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: { transOpen: "true" },
        setting: null,
      })
    );
    goViaPage("/plain-page");
    await runtime.whenIdle();
    expect(managers[0].applyLocationRule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        policy: { transOpen: "false" },
        setting: null,
      })
    );
  });

  test("popstate recalculates blacklist and site rules", async () => {
    window.history.pushState({}, "", "/auto-translate");
    window.history.pushState({}, "", "/page-blocked");
    window.history.back();
    await flushHistory();
    const { runtime, created, managers, listeners } = boot({
      setting: {
        blacklist: "page-blocked",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    });
    await runtime.start();
    expect(window.location.href).toContain("/auto-translate");
    expect(created[0].rule.transOpen).toBe("true");
    expect(listeners).toHaveLength(0);
    window.history.forward();
    await flushHistory();
    await runtime.whenIdle();
    expect(window.location.href).toContain("/page-blocked");
    expect(managers[0].stop).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(1);
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
    harness.managers[0].setLiveTransOpen("true");
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].stop).toHaveBeenCalledTimes(1);
    expect(harness.created).toHaveLength(2);
    expect(harness.created[1].rule.transOpen).toBe("true");
    expect(harness.managers[1].readLiveTransOpen()).toBe("true");
  });

  test("a manually enabled page stays on when an unrelated blacklist entry is saved", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.managers[0].setLiveTransOpen("true");
    harness.onSetting(pageSetting("example.com"));
    await harness.runtime.whenIdle();
    expect(harness.managers[0].stop).not.toHaveBeenCalled();
    expect(harness.created).toHaveLength(1);
    expect(harness.managers[0].readLiveTransOpen()).toBe("true");
  });

  test("a manually disabled page stays off after a blacklist entry temporarily matches", async () => {
    window.history.pushState({}, "", "/auto-translate");
    const harness = boot();
    await harness.runtime.start();
    expect(harness.created[0].rule.transOpen).toBe("true");
    harness.managers[0].setLiveTransOpen("false");
    harness.onSetting(pageSetting("localhost"));
    await harness.runtime.whenIdle();
    harness.onSetting(pageSetting("localhost:8765/spa2.html/blocked"));
    await harness.runtime.whenIdle();
    expect(harness.created).toHaveLength(2);
    expect(harness.created[1].rule.transOpen).toBe("false");
    expect(harness.managers[1].readLiveTransOpen()).toBe("false");
  });

  test("does not keep a parked switch after the page moves to another url", async () => {
    window.history.pushState({}, "", "/spa2.html/plain");
    const harness = boot();
    await harness.runtime.start();
    harness.managers[0].setLiveTransOpen("true");
    harness.onSetting(pageSetting("spa2.html/plain"));
    await harness.runtime.whenIdle();
    goViaPage("/other-clear");
    await harness.runtime.whenIdle();
    expect(harness.created[1].rule.transOpen).toBe("false");
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
    expect(harness.created).toHaveLength(0);
    expect(harness.listeners[0]({ action: MSG_TRANS_GETRULE }).rule).toEqual({
      transOpen: "false",
    });
    harness.onSetting(pageSetting(""));
    await harness.runtime.whenIdle();
    expect(harness.created[0].rule).toEqual(
      expect.objectContaining({
        fromLang: "en",
        toLang: "zh-CN",
        apiSlug: "deepl",
      })
    );
    expect(harness.managers[0].publishRuntimeRule).toHaveBeenCalledTimes(1);
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
    expect(harness.managers[0].stop).toHaveBeenCalledTimes(1);
    harness.onSetting({
      data: {
        blacklist: "",
        tranboxSetting: {},
        inputRule: {},
        mouseHoverSetting: {},
      },
    });
    await harness.runtime.whenIdle();
    expect(harness.created[1].rule.transOpen).toBe("false");

    goViaPage("/auto-translate");
    await harness.runtime.whenIdle();
    expect(harness.managers[1].applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: { transOpen: "true" },
        setting: null,
      })
    );
  });

  test("a main-world location event recalculates, and the content script does not wrap history.pushState", async () => {
    const historyPush = window.history.pushState;
    window.history.pushState({}, "", "/stay-clear");
    const { runtime, managers } = boot();
    await runtime.start();
    expect(History.prototype.pushState).toBe(nativePushState);
    expect(window.history.pushState).toBe(historyPush);

    const stop = watchPageLocation(() => {});
    expect(window.history.pushState).toBe(historyPush);
    expect(History.prototype.pushState).toBe(nativePushState);
    stop();

    nativePushState.call(window.history, {}, "", "/auto-translate");
    await runtime.whenIdle();
    expect(managers[0].applyLocationRule).not.toHaveBeenCalled();

    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    await runtime.whenIdle();
    expect(managers[0].applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: { transOpen: "true" },
        setting: null,
      })
    );

    runtime.stop();
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
    await runtime.whenIdle();
    expect(managers[0].applyLocationRule).toHaveBeenCalledTimes(1);
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
    expect(harness.managers[0].applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ apiSlug: "stored" }),
        policy: { transOpen: "false" },
      })
    );
  });

  test("a selector edit reaches the running page without changing the translation switch", async () => {
    window.history.pushState({}, "", "/index.html");
    let matched = { transOpen: "false", selector: "p", pattern: "stored" };
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      applyLocationRule: jest.fn(),
      rule: { transOpen: "true" },
    };
    const harness = boot({
      manager,
      rule: { transOpen: "false", selector: "p", pattern: "stored" },
      matchRule: async () => matched,
    });
    await harness.runtime.start();
    matched = { transOpen: "false", selector: "article", pattern: "stored" };
    harness.onRules({
      data: [{ pattern: "localhost", selector: "article", transOpen: "false" }],
    });
    await harness.runtime.whenIdle();
    expect(manager.stop).not.toHaveBeenCalled();
    expect(manager.applyLocationRule).toHaveBeenCalledWith({
      fields: { selector: "article", pattern: "stored" },
      policy: null,
      setting: null,
    });
    expect(manager.rule.transOpen).toBe("true");
  });

  test("changing the site policy to false stops a running translation", async () => {
    window.history.pushState({}, "", "/index.html");
    const { applyRuleUpdate } = require("./runtimeUpdate");
    const translator = {
      rule: { transOpen: "true" },
      disable: jest.fn(),
      enable: jest.fn(),
      updateRule: jest.fn(),
    };
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      rule: { transOpen: "true" },
      applyLocationRule(update) {
        const nextRule = applyRuleUpdate({
          liveTransOpen: translator.rule.transOpen,
          fields: update.fields,
          policy: update.policy,
          disable: () => translator.disable(),
          updateRule: (rule) => {
            translator.updateRule(rule);
            translator.rule = { ...translator.rule, ...rule };
          },
          enable: () => translator.enable(),
        });
        this.rule = { ...this.rule, ...nextRule };
      },
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
    expect(translator.disable).toHaveBeenCalledTimes(1);
    expect(translator.enable).not.toHaveBeenCalled();
    expect(manager.rule.transOpen).toBe("false");
    expect(translator.updateRule).toHaveBeenCalledWith(
      expect.objectContaining({ selector: "p", transOpen: "false" })
    );
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
      applyLocationRule: jest.fn(),
      rule: { transOpen: "false" },
    };
    const harness = boot({
      manager,
      setting: stored,
      rule: { transOpen: "false", selector: "p" },
      matchRule: async () => ({ transOpen: "false", selector: "p" }),
    });
    await harness.runtime.start();
    expect(manager.applyLocationRule).not.toHaveBeenCalled();
    expect(stored.tranboxSetting.transOpen).toBe(true);
    expect(stored.inputRule.transOpen).toBe(true);
    expect(stored.mouseHoverSetting.useMouseHover).toBe(true);

    goViaPage("/clear-page");
    await harness.runtime.whenIdle();
    expect(manager.applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: null,
        setting: {
          fields: expect.objectContaining({
            tranboxSetting: expect.objectContaining({ transOpen: true }),
            inputRule: expect.objectContaining({ transOpen: true }),
            mouseHoverSetting: expect.objectContaining({
              useMouseHover: true,
            }),
          }),
          switches: { tranbox: true, input: true, hover: true },
        },
      })
    );

    goViaPage("/feature-off/back");
    await harness.runtime.whenIdle();
    expect(manager.applyLocationRule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        policy: null,
        setting: {
          fields: expect.objectContaining({
            tranboxSetting: expect.objectContaining({ transOpen: false }),
            inputRule: expect.objectContaining({ transOpen: false }),
            mouseHoverSetting: expect.objectContaining({
              useMouseHover: false,
            }),
          }),
          switches: { tranbox: false, input: false, hover: false },
        },
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
      applyLocationRule: jest.fn(),
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
    expect(manager.rule.transOpen).toBe("true");
    expect(manager.applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: { selector: "p" },
        policy: null,
        setting: {
          fields: expect.objectContaining({
            tranboxSetting: expect.objectContaining({
              blacklist: "index.html",
              transOpen: false,
            }),
            inputRule: expect.objectContaining({ transOpen: true }),
            mouseHoverSetting: expect.objectContaining({
              useMouseHover: true,
            }),
          }),
          switches: { tranbox: false },
        },
      })
    );
  });

  test("a child frame parking on its own url leaves the top frame and its popup snapshot", async () => {
    const topNotify = [];
    const childNotify = [];
    const parked = [];
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
    const listen = (handler, info) => {
      const entry = { handler, isIframe: Boolean(info?.isIframe) };
      parked.push(entry);
      return () => {
        const index = parked.indexOf(entry);
        if (index >= 0) parked.splice(index, 1);
      };
    };
    const topManager = {
      start: jest.fn(),
      stop: jest.fn(),
      applyLocationRule: jest.fn(),
      rule: { transOpen: "true" },
    };
    const top = boot({
      manager: topManager,
      setting,
      getHref: () => topHref,
      watchLocation: watchLocation(topNotify),
      listen,
      matchRule: async () => ({ transOpen: "false" }),
    });
    const child = boot({
      isIframe: true,
      setting,
      getHref: () => childHref,
      watchLocation: watchLocation(childNotify),
      listen,
      matchRule: async () => ({ transOpen: "false", apiSlug: "child" }),
      queryParent: async () => ({ transOpen: true, fabVisible: true }),
    });
    await top.runtime.start();
    await child.runtime.start();
    const childManager = child.managers[0];
    expect(child.created[0].rule.transOpen).toBe("true");

    childHref = "http://localhost:8765/spa2.html/blocked";
    childNotify.forEach((onChange) => onChange());
    expect(topNotify.length).toBeGreaterThan(0);
    await Promise.all([top.runtime.whenIdle(), child.runtime.whenIdle()]);

    expect(childManager.stop).toHaveBeenCalledTimes(1);
    expect(parked.some((entry) => entry.isIframe)).toBe(true);
    expect(topManager.stop).not.toHaveBeenCalled();
    expect(topManager.applyLocationRule).not.toHaveBeenCalled();
    expect(topManager.rule.transOpen).toBe("true");

    const replies = parked
      .map((entry) =>
        entry.handler({ action: MSG_TRANS_GETRULE, targetTopFrame: true })
      )
      .filter((reply) => reply !== undefined);
    expect(replies).toEqual([]);
  });

  test("a blacklisted top frame does not park a child that misses the blacklist", async () => {
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
      applyLocationRule: jest.fn(),
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
    expect(childNotify.length).toBeGreaterThan(0);
    await Promise.all([top.runtime.whenIdle(), child.runtime.whenIdle()]);

    expect(topManager.stop).toHaveBeenCalledTimes(1);
    expect(top.listeners).toHaveLength(1);
    expect(childManager.stop).not.toHaveBeenCalled();
    expect(child.listeners).toHaveLength(0);
    expect(childManager.applyLocationRule).not.toHaveBeenCalled();
  });
});

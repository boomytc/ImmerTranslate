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

const { PageRuntime, watchPageLocation } = require("./pageRuntime");
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
        const manager = {
          start: jest.fn(),
          stop: jest.fn(),
          applyLocationRule: jest.fn(),
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
      expect.objectContaining({ transOpen: "true" })
    );
    goViaPage("/plain-page");
    await runtime.whenIdle();
    expect(managers[0].applyLocationRule).toHaveBeenLastCalledWith(
      expect.objectContaining({ transOpen: "false" })
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
      expect.objectContaining({ transOpen: "true" })
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
      expect.objectContaining({ transOpen: "true" })
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
    const { runtime, created, managers } = boot({
      isIframe: true,
      queryParent: async () => parent,
      matchRule: async () => ({ transOpen: "false", apiSlug: "stored" }),
    });
    await runtime.start();
    expect(created[0].rule).toMatchObject({
      transOpen: "true",
      apiSlug: "stored",
    });
    parent = { transOpen: false, fabVisible: true };
    await runtime.requestReconcile("parent");
    expect(managers[0].applyLocationRule).toHaveBeenCalledWith(
      expect.objectContaining({ transOpen: "false" })
    );
  });

  test("a rules refresh does not turn a live translation back off", async () => {
    window.history.pushState({}, "", "/index.html");
    const manager = {
      start: jest.fn(),
      stop: jest.fn(),
      applyLocationRule: jest.fn(),
      rule: { transOpen: "true" },
    };
    const harness = boot({
      manager,
      matchRule: async () => ({ transOpen: "false", pattern: "stored" }),
    });
    await harness.runtime.start();
    harness.onRules({ data: [{ pattern: "*", transOpen: "false" }] });
    await harness.runtime.whenIdle();
    expect(manager.stop).not.toHaveBeenCalled();
    expect(manager.applyLocationRule).not.toHaveBeenCalled();
    expect(manager.rule.transOpen).toBe("true");
  });

  test("a child frame parking on its own url leaves the top frame and its popup snapshot", async () => {
    const notify = [];
    const parked = [];
    let topHref = "http://localhost:8765/spa-frame.html";
    let childHref = "http://localhost:8765/spa2.html";
    const setting = {
      blacklist: "spa2.html/blocked",
      tranboxSetting: {},
      inputRule: {},
      mouseHoverSetting: {},
    };
    const watchLocation = (onChange) => {
      notify.push(onChange);
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
      watchLocation,
      listen,
      matchRule: async () => ({ transOpen: "false" }),
    });
    const child = boot({
      isIframe: true,
      setting,
      getHref: () => childHref,
      watchLocation,
      listen,
      matchRule: async () => ({ transOpen: "false", apiSlug: "child" }),
      queryParent: async () => ({ transOpen: true, fabVisible: true }),
    });
    await top.runtime.start();
    await child.runtime.start();
    const childManager = child.managers[0];
    expect(child.created[0].rule.transOpen).toBe("true");

    childHref = "http://localhost:8765/spa2.html/blocked";
    notify.forEach((onChange) => onChange());
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
    const notify = [];
    let topHref = "http://localhost:8765/spa-frame.html";
    const childHref = "http://localhost:8765/spa2.html";
    const setting = {
      blacklist: "spa-frame.html/blocked",
      tranboxSetting: {},
      inputRule: {},
      mouseHoverSetting: {},
    };
    const watchLocation = (onChange) => {
      notify.push(onChange);
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
      watchLocation,
      matchRule: async () => ({ transOpen: "false" }),
    });
    const child = boot({
      isIframe: true,
      setting,
      getHref: () => childHref,
      watchLocation,
      matchRule: async () => ({ transOpen: "false" }),
      queryParent: async () => ({ transOpen: true, fabVisible: false }),
    });
    await top.runtime.start();
    await child.runtime.start();
    const childManager = child.managers[0];

    topHref = "http://localhost:8765/spa-frame.html/blocked";
    notify.forEach((onChange) => onChange());
    await Promise.all([top.runtime.whenIdle(), child.runtime.whenIdle()]);

    expect(topManager.stop).toHaveBeenCalledTimes(1);
    expect(top.listeners).toHaveLength(1);
    expect(childManager.stop).not.toHaveBeenCalled();
    expect(child.listeners).toHaveLength(0);
    expect(childManager.applyLocationRule).not.toHaveBeenCalled();
  });
});

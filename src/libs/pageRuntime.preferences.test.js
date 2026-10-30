const mockActions = { current: null };

jest.mock("./browser", () => ({
  browser: {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  },
  isBg: () => false,
  isOptions: () => false,
}));
jest.mock("./client", () => ({ isExt: false }));
jest.mock("./sync", () => ({ trySyncRules: jest.fn() }));
jest.mock("./redditFrame", () => ({ readRedditEmbeddingHref: () => "" }));
jest.mock("./iframe", () => ({
  applyParentRuntime: (rule) => rule,
  queryParentFrameRuntime: jest.fn(async () => null),
  sendIframeMsg: jest.fn(),
  installFrameRuntimeBridge: jest.fn(() => () => {}),
}));
jest.mock("./pageRuleSync", () => ({ publishPageRule: jest.fn() }));
jest.mock("./popupDocument", () => ({
  getPopupDocumentIdentity: () => ({
    token: "test-document",
    url: "https://x.com/home",
  }),
}));
jest.mock("./translator", () => ({
  Translator: class {
    constructor({ rule, setting }) {
      this.rule = rule;
      this.setting = setting;
    }
    updateRule(patch) {
      Object.assign(this.rule, patch);
    }
    updateSetting(setting) {
      this.setting = setting;
    }
    enable() {
      this.rule.transOpen = "true";
    }
    disable() {
      this.rule.transOpen = "false";
    }
    stop() {
      this.disable();
    }
    pausePage() {}
    continuePage() {
      this.enable();
    }
    resumePage() {}
    toggleTransOnly() {
      if (this.rule.transOpen !== "true") {
        this.rule.transOnly = "true";
        this.enable();
      } else {
        this.rule.transOnly = this.rule.transOnly === "true" ? "false" : "true";
      }
    }
    toggleStyle(style) {
      this.rule.textStyle = style || "fuzzy";
    }
  },
}));
jest.mock("./tranbox", () => ({
  TransboxManager: class {
    isEnabled() {
      return false;
    }
    enable() {}
    disable() {}
    update() {}
  },
}));
jest.mock("./inputTranslate", () => ({
  InputTranslator: class {
    enable() {}
    disable() {}
    updateConfig() {}
  },
}));
jest.mock("./popupManager", () => ({
  PopupManager: class {
    constructor({ processActions }) {
      mockActions.current = processActions;
    }
    destroy() {}
    hide() {}
  },
}));
jest.mock("./fabManager", () => ({
  FabManager: class {
    constructor({ processActions }) {
      mockActions.current = processActions;
    }
    show() {}
    destroy() {}
  },
}));
jest.mock("./ruleEditorManager", () => ({
  RuleEditorManager: class {
    destroy() {}
  },
}));

const {
  DEFAULT_SETTING,
  GLOBLA_RULE,
  MSG_TRANS_GETRULE,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_ONLY,
  MSG_TRANS_TOGGLE_STYLE,
  STOKEY_RULES,
  STOKEY_SETTING,
} = require("../config");
const { PageRuntime } = require("./pageRuntime");
const { findStorageState, getStorageState } = require("./storageState");
const { storage } = require("./storage");
const { sendIframeMsg } = require("./iframe");

let runtime;

function seed(rules) {
  localStorage.setItem(STOKEY_SETTING, JSON.stringify(DEFAULT_SETTING));
  localStorage.setItem(STOKEY_RULES, JSON.stringify(rules));
}

function response(action, args) {
  return mockActions.current({ action, args });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.clear();
  mockActions.current = null;
});

afterEach(async () => {
  runtime?.manager?.stop();
  runtime?.stop();
  runtime = null;
  jest.restoreAllMocks();
  const rules = findStorageState(STOKEY_RULES);
  if (rules?.isRecovering) await rules.load();
  localStorage.clear();
});

test("cold start reads the confirmed site policy without opening any menu", async () => {
  seed([
    { pattern: "x.com", transOpen: "true", apiSlug: "Google" },
    { ...GLOBLA_RULE, transOpen: "false" },
  ]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });

  await runtime.start();

  expect(response(MSG_TRANS_GETRULE)).toMatchObject({
    pageSwitch: "on",
    rule: { apiSlug: "Google", transOpen: "true" },
  });
});

test("temporary service survives page toggles without writing a site rule", async () => {
  seed([{ ...GLOBLA_RULE, transOpen: "false" }]);
  const before = localStorage.getItem(STOKEY_RULES);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();

  response(MSG_TRANS_PUTRULE, { apiSlug: "Google" });
  expect(response(MSG_TRANS_GETRULE).rule.apiSlug).toBe("Google");
  response(MSG_TRANS_TOGGLE, { enabled: true });
  expect(response(MSG_TRANS_GETRULE)).toMatchObject({
    pageSwitch: "on",
    rule: { apiSlug: "Google" },
  });
  response(MSG_TRANS_TOGGLE, { enabled: false });
  expect(response(MSG_TRANS_GETRULE)).toMatchObject({
    pageSwitch: "off",
    rule: { apiSlug: "Google" },
  });
  expect(localStorage.getItem(STOKEY_RULES)).toBe(before);
});

test("unchanged fields in a page action do not mask later confirmed rule updates", async () => {
  seed([{ ...GLOBLA_RULE, apiSlug: "Microsoft" }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  response(MSG_TRANS_PUTRULE, { apiSlug: "Microsoft", toLang: "ja" });
  await getStorageState(STOKEY_RULES, []).save((rules) =>
    rules.map((rule) => ({
      ...rule,
      apiSlug: "Google",
    }))
  );
  await runtime.whenIdle();
  expect(response(MSG_TRANS_GETRULE).rule).toMatchObject({
    apiSlug: "Google",
    toLang: "ja",
  });
});

test("temporary language and style survive runtime module reconstruction and toggling", async () => {
  seed([{ ...GLOBLA_RULE, transOpen: "false" }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();

  response(MSG_TRANS_PUTRULE, { toLang: "ja", textStyle: "highlight" });
  runtime.manager.restart("test-body-replacement");
  response(MSG_TRANS_TOGGLE, { enabled: true });
  expect(response(MSG_TRANS_GETRULE).rule).toMatchObject({
    toLang: "ja",
    textStyle: "highlight",
  });
});

test.each([
  ["true", "*", "on"],
  ["false", "*", "off"],
  ["true", "true", "on"],
  ["false", "true", "on"],
  ["true", "false", "off"],
  ["false", "false", "off"],
])("global %s and site %s start as %s", async (global, site, expected) => {
  seed([
    { pattern: "x.com", transOpen: site },
    { ...GLOBLA_RULE, transOpen: global },
  ]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  expect(response(MSG_TRANS_GETRULE).pageSwitch).toBe(expected);
});

test("the first start waits for a delayed rules read and concurrent starts share a manager", async () => {
  seed([{ pattern: "x.com", transOpen: "true" }, { ...GLOBLA_RULE }]);
  const gate = deferred();
  const reading = deferred();
  const read = storage.readStoredObjects;
  jest.spyOn(storage, "readStoredObjects").mockImplementation(async (keys) => {
    if (keys.includes(STOKEY_RULES)) {
      reading.resolve();
      await gate.promise;
    }
    return read(keys);
  });
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  const first = runtime.start();
  const second = runtime.start();
  try {
    expect(second).toBe(first);
    await reading.promise;
    expect(runtime.manager).toBeNull();
  } finally {
    gate.resolve();
  }
  await Promise.all([first, second]);
  const manager = runtime.manager;
  expect(response(MSG_TRANS_GETRULE).pageSwitch).toBe("on");
  await runtime.start();
  expect(runtime.manager).toBe(manager);
});

test("a failed initial read rejects startup and removes its listeners", async () => {
  seed([{ ...GLOBLA_RULE }]);
  const read = storage.readStoredObjects;
  jest.spyOn(storage, "readStoredObjects").mockImplementation(async (keys) => {
    if (keys.includes(STOKEY_RULES)) throw new Error("rules unavailable");
    return read(keys);
  });
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await expect(runtime.start()).rejects.toThrow("rules unavailable");
  expect(runtime.manager).toBeNull();
  expect(mockActions.current).toBeNull();
});

test("stopping while the initial read is pending never starts a late manager", async () => {
  seed([{ pattern: "x.com", transOpen: "true" }, { ...GLOBLA_RULE }]);
  const gate = deferred();
  const reading = deferred();
  const read = storage.readStoredObjects;
  jest.spyOn(storage, "readStoredObjects").mockImplementation(async (keys) => {
    if (keys.includes(STOKEY_RULES)) {
      reading.resolve();
      await gate.promise;
    }
    return read(keys);
  });
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  const starting = runtime.start();
  try {
    await reading.promise;
    runtime.stop();
    await starting;
  } finally {
    gate.resolve();
  }
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(runtime.manager).toBeNull();
  expect(mockActions.current).toBeNull();
});

test("a stopped slow reconciliation cannot block a later start", async () => {
  seed([{ ...GLOBLA_RULE }]);
  const gate = deferred();
  const matching = deferred();
  let calls = 0;
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
    matchRule: async () => {
      calls += 1;
      if (calls === 1) {
        matching.resolve();
        await gate.promise;
      }
      return { ...GLOBLA_RULE };
    },
  });
  const first = runtime.start();
  try {
    await matching.promise;
    runtime.stop();
    const next = runtime.start();
    let timeout;
    try {
      await Promise.race([
        next,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("restart blocked by old match")),
            300
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    expect(response(MSG_TRANS_GETRULE).pageSwitch).toBe("off");
  } finally {
    gate.resolve();
    await first;
  }
});

test("a malformed stored rules value rejects startup instead of waiting forever", async () => {
  seed({ invalid: "not a rules list" });
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  let timeout;
  try {
    await expect(
      Promise.race([
        runtime.start(),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("startup hung")), 300);
        }),
      ])
    ).rejects.toThrow(/rules.*(invalid|array)/i);
  } finally {
    clearTimeout(timeout);
    runtime.stop();
  }
  expect(runtime.manager).toBeNull();
});

test("startup waits for a pending rules save before applying its first target", async () => {
  seed([{ pattern: "x.com", transOpen: "false" }, { ...GLOBLA_RULE }]);
  const settingGate = deferred();
  const settingsReading = deferred();
  const writeGate = deferred();
  const writing = deferred();
  const read = storage.readStoredObjects;
  const saveEdit = storage.saveEdit;
  jest.spyOn(storage, "readStoredObjects").mockImplementation(async (keys) => {
    if (keys.includes(STOKEY_SETTING)) {
      settingsReading.resolve();
      await settingGate.promise;
    }
    return read(keys);
  });
  jest.spyOn(storage, "saveEdit").mockImplementation(async (...args) => {
    writing.resolve();
    await writeGate.promise;
    return saveEdit(...args);
  });
  let navigate;
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
    watchLocation: (listener) => {
      navigate = listener;
      return () => {};
    },
  });
  const starting = runtime.start();
  let saving;
  try {
    await settingsReading.promise;
    const rules = findStorageState(STOKEY_RULES);
    await rules.ensureLoaded();
    saving = rules.save((previous) =>
      previous.map((rule) =>
        rule.pattern === "x.com" ? { ...rule, transOpen: "true" } : rule
      )
    );
    await writing.promise;
    let finished = false;
    starting.then(() => {
      finished = true;
    });
    settingGate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));
    navigate();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(finished).toBe(false);
    expect(runtime.manager).toBeNull();
  } finally {
    settingGate.resolve();
    writeGate.resolve();
  }
  await saving;
  await starting;
  expect(response(MSG_TRANS_GETRULE).pageSwitch).toBe("on");
});

test("startup waits for an in-flight storage recovery and does not replay the failed edit", async () => {
  seed([{ pattern: "x.com", transOpen: "true" }, { ...GLOBLA_RULE }]);
  const rules = getStorageState(STOKEY_RULES, []);
  const unsubscribe = rules.subscribe(() => {});
  await rules.ensureLoaded();
  const gate = deferred();
  const recovering = deferred();
  const transaction = storage.withTransaction;
  jest
    .spyOn(storage, "saveEdit")
    .mockRejectedValueOnce(new Error("write failed"));
  jest.spyOn(storage, "withTransaction").mockImplementation(async (...args) => {
    recovering.resolve();
    await gate.promise;
    return transaction(...args);
  });
  const saving = rules.save((previous) => previous).catch((error) => error);
  let starting;
  try {
    await recovering.promise;
    runtime = new PageRuntime({
      setting: DEFAULT_SETTING,
      getHref: () => "https://x.com/home",
    });
    starting = runtime.start();
    let result = "pending";
    starting.then(
      () => {
        result = "resolved";
      },
      () => {
        result = "rejected";
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result).toBe("pending");
    expect(runtime.manager).toBeNull();
    gate.resolve();
    expect((await saving).message).toBe("write failed");
    await starting;
    expect(response(MSG_TRANS_GETRULE).pageSwitch).toBe("on");
    expect(storage.saveEdit).toHaveBeenCalledTimes(1);
  } finally {
    gate.resolve();
    unsubscribe();
  }
});

test("pending rules do not replace confirmed values and temporary edits survive the confirmed refresh", async () => {
  seed([{ pattern: "x.com", transOpen: "true" }, { ...GLOBLA_RULE }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  response(MSG_TRANS_PUTRULE, { apiSlug: "Google", toLang: "ja" });
  response(MSG_TRANS_TOGGLE_STYLE, { textStyle: "highlight" });
  response(MSG_TRANS_TOGGLE_ONLY);
  const gate = deferred();
  const writing = deferred();
  const saveEdit = storage.saveEdit;
  jest.spyOn(storage, "saveEdit").mockImplementation(async (...args) => {
    writing.resolve();
    await gate.promise;
    return saveEdit(...args);
  });
  const rules = getStorageState(STOKEY_RULES, []);
  const saving = rules.save((previous) =>
    previous.map((rule) =>
      rule.pattern === "x.com"
        ? { ...rule, transOpen: "false", toLang: "fr" }
        : rule
    )
  );
  try {
    await writing.promise;
    expect(response(MSG_TRANS_GETRULE).pageSwitch).toBe("on");
  } finally {
    gate.resolve();
  }
  await saving;
  await runtime.whenIdle();
  expect(response(MSG_TRANS_GETRULE)).toMatchObject({
    pageSwitch: "off",
    rule: {
      apiSlug: "Google",
      toLang: "ja",
      textStyle: "highlight",
      transOnly: "true",
    },
  });
  runtime.manager.restart("body-replacement");
  expect(response(MSG_TRANS_GETRULE).rule).toMatchObject({
    apiSlug: "Google",
    toLang: "ja",
    textStyle: "highlight",
    transOnly: "true",
  });
});

test("a confirmed site policy change synchronizes iframes once; a manual toggle is not double forwarded", async () => {
  seed([{ pattern: "x.com", transOpen: "true" }, { ...GLOBLA_RULE }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  sendIframeMsg.mockClear();
  await getStorageState(STOKEY_RULES, []).save((rules) =>
    rules.map((rule) =>
      rule.pattern === "x.com" ? { ...rule, transOpen: "false" } : rule
    )
  );
  await runtime.whenIdle();
  expect(sendIframeMsg).toHaveBeenCalledTimes(1);
  expect(sendIframeMsg).toHaveBeenCalledWith(MSG_TRANS_TOGGLE, {
    enabled: false,
  });
  sendIframeMsg.mockClear();
  response(MSG_TRANS_TOGGLE, { enabled: true });
  expect(sendIframeMsg).toHaveBeenCalledTimes(1);
  expect(sendIframeMsg).toHaveBeenCalledWith(MSG_TRANS_TOGGLE, {
    enabled: true,
  });
});

test("frame handshake uses the page switch and sparse patch, not editor preview state", async () => {
  seed([{ ...GLOBLA_RULE, transOpen: "true" }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  response(MSG_TRANS_PUTRULE, { apiSlug: "Google", toLang: "ja" });
  runtime.manager._translator.rule.transOpen = "false";
  runtime.manager._translator.rule.selector = "#preview-only";
  const { installFrameRuntimeBridge } = require("./iframe");
  const getState = installFrameRuntimeBridge.mock.calls.at(-1)[0];
  expect(getState()).toMatchObject({
    transOpen: true,
    pagePatch: { apiSlug: "Google", toLang: "ja" },
  });
  expect(getState().pagePatch).not.toHaveProperty("selector");
});

test("ONLY records its patch before enabling and forwards a fixed result", async () => {
  seed([{ ...GLOBLA_RULE, transOpen: "false" }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  const statesWhenEnabling = [];
  jest
    .spyOn(runtime.manager._translator, "enable")
    .mockImplementation(function () {
      statesWhenEnabling.push(this.rule.transOnly);
      this.rule.transOpen = "true";
    });
  sendIframeMsg.mockClear();
  response(MSG_TRANS_TOGGLE_ONLY);
  expect(statesWhenEnabling).toEqual(["true"]);
  expect(sendIframeMsg).toHaveBeenCalledTimes(1);
  expect(sendIframeMsg).toHaveBeenCalledWith(MSG_TRANS_TOGGLE_ONLY, {
    transOnly: "true",
    enabled: true,
  });
  response(MSG_TRANS_TOGGLE_ONLY, { transOnly: "true", enabled: true });
  expect(response(MSG_TRANS_GETRULE).rule.transOnly).toBe("true");
});

test("style forwarding sets the accepted style rather than toggling the receiver", async () => {
  seed([{ ...GLOBLA_RULE, textStyle: "highlight" }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  jest
    .spyOn(runtime.manager._translator, "toggleStyle")
    .mockImplementation(function () {
      this.rule.textStyle = "none";
    });
  sendIframeMsg.mockClear();
  response(MSG_TRANS_TOGGLE_STYLE);
  expect(sendIframeMsg).toHaveBeenCalledWith(MSG_TRANS_PUTRULE, {
    textStyle: "none",
  });
  response(MSG_TRANS_TOGGLE, { enabled: true });
  expect(response(MSG_TRANS_GETRULE).rule.textStyle).toBe("none");
});

test("changing URLs discards the sparse page patch, including when returning", async () => {
  seed([{ pattern: "x.com", apiSlug: "Google" }, { ...GLOBLA_RULE }]);
  let href = "https://x.com/home";
  let navigate;
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => href,
    watchLocation: (listener) => {
      navigate = listener;
      return () => {};
    },
  });
  await runtime.start();
  response(MSG_TRANS_PUTRULE, { apiSlug: "Microsoft", toLang: "ja" });
  href = "https://x.com/explore";
  navigate();
  await runtime.whenIdle();
  expect(response(MSG_TRANS_GETRULE).rule).toMatchObject({
    apiSlug: "Google",
    toLang: "zh-CN",
  });
  href = "https://x.com/home";
  navigate();
  await runtime.whenIdle();
  expect(response(MSG_TRANS_GETRULE).rule).toMatchObject({
    apiSlug: "Google",
    toLang: "zh-CN",
  });
});

test("a fresh document starts from saved fields instead of the previous page patch", async () => {
  seed([
    { pattern: "x.com", apiSlug: "Google", toLang: "ja" },
    { ...GLOBLA_RULE },
  ]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  response(MSG_TRANS_PUTRULE, { apiSlug: "Microsoft", toLang: "fr" });
  runtime.stop();
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  expect(response(MSG_TRANS_GETRULE).rule).toMatchObject({
    apiSlug: "Google",
    toLang: "ja",
  });
});

test("only-translation enables an off page through its switch but cannot bypass a blacklist", async () => {
  seed([{ ...GLOBLA_RULE, transOpen: "false" }]);
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  const updateRule = jest.spyOn(runtime.manager._translator, "updateRule");
  response(MSG_TRANS_TOGGLE_ONLY);
  expect(response(MSG_TRANS_GETRULE)).toMatchObject({
    pageSwitch: "on",
    rule: { transOpen: "true", transOnly: "true" },
  });
  expect(
    updateRule.mock.calls.filter(([patch]) => patch.transOnly === "true")
  ).toHaveLength(1);
  runtime.manager.stop();
  runtime.stop();
  seed([{ ...GLOBLA_RULE, transOpen: "true" }]);
  localStorage.setItem(
    STOKEY_SETTING,
    JSON.stringify({ ...DEFAULT_SETTING, blacklist: "x.com" })
  );
  runtime = new PageRuntime({
    setting: DEFAULT_SETTING,
    getHref: () => "https://x.com/home",
  });
  await runtime.start();
  response(MSG_TRANS_TOGGLE_ONLY);
  expect(response(MSG_TRANS_GETRULE)).toMatchObject({
    pageSwitch: "paused",
    rule: { transOpen: "false", transOnly: "false" },
  });
});

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
jest.mock("./rules", () => ({
  matchRule: jest.fn(async () => ({ transOpen: "false" })),
}));
jest.mock("./translatorManager", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const STORED_SETTING = {
  blacklist: "",
  tranboxSetting: { transOpen: true, blacklist: "" },
  inputRule: { transOpen: true, blacklist: "" },
  mouseHoverSetting: { useMouseHover: true, blacklist: "" },
};
const STORED_RULES = [{ pattern: "*", transOpen: "false", selector: "p" }];

function loadRuntime() {
  let api;
  jest.isolateModules(() => {
    api = {
      PageRuntime: require("./pageRuntime").PageRuntime,
      keys: require("../config"),
    };
  });
  return api;
}

async function settle(runtime, matchRule) {
  let stable = 0;
  let last = -1;
  for (let step = 0; step < 30; step += 1) {
    await runtime.whenIdle();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const calls = matchRule.mock.calls.length;
    stable = calls === last ? stable + 1 : 0;
    last = calls;
    if (stable >= 4) return calls;
  }
  return matchRule.mock.calls.length;
}

describe("storage resume", () => {
  let runtime;

  afterEach(() => {
    runtime?.stop();
    runtime = null;
    localStorage.clear();
  });

  test.each(["focus", "pageshow"])(
    "%s does not reconcile when stored rules and settings are unchanged",
    async (eventName) => {
      const { PageRuntime, keys } = loadRuntime();
      localStorage.setItem(keys.STOKEY_RULES, JSON.stringify(STORED_RULES));
      localStorage.setItem(keys.STOKEY_SETTING, JSON.stringify(STORED_SETTING));
      const matchRule = jest.fn(async () => ({
        transOpen: "false",
        selector: "p",
      }));
      const applyLocationRule = jest.fn();
      runtime = new PageRuntime({
        setting: STORED_SETTING,
        getHref: () => "http://localhost/index.html",
        matchRule,
        createManager: () => ({
          start: jest.fn(),
          stop: jest.fn(),
          applyLocationRule,
        }),
      });
      await runtime.start();
      // 第一次把尚未读过的存储装进来。第二次内容相同，不能再重算。
      window.dispatchEvent(new Event(eventName));
      const matches = await settle(runtime, matchRule);
      const applications = applyLocationRule.mock.calls.length;
      expect(matches).toBeGreaterThan(1);

      window.dispatchEvent(new Event(eventName));
      await settle(runtime, matchRule);

      expect(matchRule).toHaveBeenCalledTimes(matches);
      expect(applyLocationRule).toHaveBeenCalledTimes(applications);
    }
  );
});

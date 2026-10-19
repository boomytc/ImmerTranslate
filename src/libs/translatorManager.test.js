jest.mock(
  "./shadowDomManager",
  () =>
    class {
      show = jest.fn();
      destroy = jest.fn();
    }
);
jest.mock("../components/TouchTranslateControl", () => ({
  TouchTranslateStatus: () => null,
}));
const mockTranslatorInstances = [];
const mockTranslatorArgs = [];
const mockTransboxInstances = [];
const mockTransboxArgs = [];
const mockInputTranslatorInstances = [];
const mockPopupInstances = [];
const mockFabInstances = [];
const mockPopupDocumentIdentity = jest.fn();
const activeManagers = [];
const mockFabStorage = { listeners: [], save: jest.fn() };

jest.mock("./storageState", () => ({
  getStorageState: () => ({
    subscribe(listener) {
      mockFabStorage.listeners.push(listener);
      return () => {
        mockFabStorage.listeners = mockFabStorage.listeners.filter(
          (item) => item !== listener
        );
      };
    },
    save: (...args) => mockFabStorage.save(...args),
  }),
}));

jest.mock("./popupDocument", () => ({
  getPopupDocumentIdentity: () => mockPopupDocumentIdentity(),
}));

jest.mock("./ruleEditorManager", () => ({
  RuleEditorManager: class {
    destroy = jest.fn();
    open = jest.fn();
  },
}));

jest.mock("../config", () => ({
  EVENT_KISS_INNER: "immertranslate-inner",
  EVENT_KISS_TRANSLATOR: "immertranslate",
  MSG_HOVERNODE_TOGGLE: "hovernode-toggle",
  MSG_INPUT_TRANSLATE: "input-translate",
  MSG_TRANS_TOGGLE: "trans-toggle",
  MSG_TRANS_TOGGLE_ONLY: "trans-toggle-only",
  MSG_TRANS_TOGGLE_STYLE: "trans-toggle-style",
  MSG_TRANS_GETRULE: "trans-getrule",
  MSG_TRANS_PUTRULE: "trans-putrule",
  MSG_OPEN_TRANBOX: "open-tranbox",
  MSG_TRANSBOX_TOGGLE: "transbox-toggle",
  MSG_POPUP_TOGGLE: "popup-toggle",
  MSG_FAB_TOGGLE: "toggle_fab",
  MSG_RULE_EDITOR: "rule-editor",
  MSG_MOUSEHOVER_TOGGLE: "mousehover-toggle",
  MSG_TOUCH_TRANSLATE_MODE_SET: "touch-mode-set",
  MSG_TOUCH_TRANSLATE_STATE: "touch-state",
  MSG_TRANSINPUT_TOGGLE: "transinput-toggle",
  OPT_SHORTCUT_TRANSLATE: "translate",
  OPT_SHORTCUT_TRANSONLY: "transonly",
  OPT_SHORTCUT_STYLE: "style",
  OPT_SHORTCUT_POPUP: "popup",
  OPT_SHORTCUT_SETTING: "setting",
  newI18n: () => (key) => key,
}));

jest.mock("./browser", () => ({
  browser: {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  },
}));

jest.mock("./translator", () => ({
  Translator: jest.fn().mockImplementation((args) => {
    mockTranslatorArgs.push(args);
    const instance = {
      setting: args.setting,
      rule: args.rule,
      stop: jest.fn(function stop() {
        this.rule.transOpen = "false";
      }),
      setTouchMode: jest.fn((mode) => mode),
      rescan: jest.fn(),
      toggle: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      pausePage: jest.fn(),
      continuePage: jest.fn(),
      resumePage: jest.fn(),
      toggleTransOnly: jest.fn(),
      toggleStyle: jest.fn(),
      updateRule: jest.fn(),
      toggleTransbox: jest.fn(function toggleTransbox() {
        this.setting.tranboxSetting.transOpen =
          !this.setting.tranboxSetting.transOpen;
      }),
      toggleMouseHover: jest.fn(function toggleMouseHover() {
        this.setting.mouseHoverSetting.useMouseHover =
          !this.setting.mouseHoverSetting.useMouseHover;
      }),
      toggleInputTranslate: jest.fn(function toggleInputTranslate() {
        this.setting.inputRule.transOpen = !this.setting.inputRule.transOpen;
      }),
      toggleHoverNode: jest.fn(),
      updateSetting: jest.fn(function updateSetting(setting) {
        this.setting = setting;
      }),
    };
    mockTranslatorInstances.push(instance);
    return instance;
  }),
}));

jest.mock("./tranbox", () => ({
  TransboxManager: jest.fn().mockImplementation((setting) => {
    mockTransboxArgs.push(setting);
    let enabled = Boolean(setting.tranboxSetting?.transOpen);
    const instance = {
      isEnabled: jest.fn(() => enabled),
      enable: jest.fn(() => {
        enabled = true;
      }),
      disable: jest.fn(() => {
        enabled = false;
      }),
      toggle: jest.fn(() => {
        enabled = !enabled;
      }),
    };
    instance.update = jest.fn((props) => {
      if (!props?.tranboxSetting || !("transOpen" in props.tranboxSetting)) {
        return;
      }
      if (!props.tranboxSetting.transOpen) {
        instance.disable();
        return;
      }
      if (!enabled) instance.enable();
    });
    mockTransboxInstances.push(instance);
    return instance;
  }),
}));

jest.mock("./inputTranslate", () => ({
  InputTranslator: jest.fn().mockImplementation(() => {
    const instance = {
      enable: jest.fn(),
      disable: jest.fn(),
      toggle: jest.fn(),
      handleTranslate: jest.fn(),
      updateConfig: jest.fn(),
    };
    mockInputTranslatorInstances.push(instance);
    return instance;
  }),
}));

jest.mock("./popupManager", () => ({
  PopupManager: jest.fn().mockImplementation(() => {
    const instance = {
      destroy: jest.fn(),
      toggle: jest.fn(),
      hide: jest.fn(),
    };
    mockPopupInstances.push(instance);
    return instance;
  }),
}));

jest.mock("./fabManager", () => ({
  FabManager: jest.fn().mockImplementation(() => {
    const instance = {
      destroy: jest.fn(),
      show: jest.fn(),
      setProps: jest.fn(),
      isVisible: true,
    };
    mockFabInstances.push(instance);
    return instance;
  }),
}));

jest.mock("./shortcut", () => ({
  shortcutRegister: jest.fn(() => jest.fn()),
}));

jest.mock("./touch", () => ({
  touchTapListener: jest.fn(() => jest.fn()),
}));

jest.mock("./iframe", () => ({
  sendIframeMsg: jest.fn(),
  installFrameRuntimeBridge: jest.fn(() => jest.fn()),
}));

jest.mock("./pageRuleSync", () => ({
  publishPageRule: jest.fn(),
}));

jest.mock("./log", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { browser } = require("./browser");
const { Translator } = require("./translator");
const { TransboxManager } = require("./tranbox");
const { InputTranslator } = require("./inputTranslate");
const { PopupManager } = require("./popupManager");
const { FabManager } = require("./fabManager");
const { sendIframeMsg } = require("./iframe");
const { shortcutRegister } = require("./shortcut");
const { publishPageRule } = require("./pageRuleSync");
const TranslatorManager = require("./translatorManager").default;

function setupMockConstructors() {
  Translator.mockImplementation((args) => {
    mockTranslatorArgs.push(args);
    const instance = {
      setting: args.setting,
      rule: args.rule,
      stop: jest.fn(function stop() {
        this.rule.transOpen = "false";
      }),
      setTouchMode: jest.fn((mode) => mode),
      rescan: jest.fn(),
      toggle: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      pausePage: jest.fn(),
      continuePage: jest.fn(),
      resumePage: jest.fn(),
      toggleTransOnly: jest.fn(),
      toggleStyle: jest.fn(),
      updateRule: jest.fn(),
      toggleTransbox: jest.fn(function toggleTransbox() {
        this.setting.tranboxSetting.transOpen =
          !this.setting.tranboxSetting.transOpen;
      }),
      toggleMouseHover: jest.fn(function toggleMouseHover() {
        this.setting.mouseHoverSetting.useMouseHover =
          !this.setting.mouseHoverSetting.useMouseHover;
      }),
      toggleInputTranslate: jest.fn(function toggleInputTranslate() {
        this.setting.inputRule.transOpen = !this.setting.inputRule.transOpen;
      }),
      toggleHoverNode: jest.fn(),
      updateSetting: jest.fn(function updateSetting(setting) {
        this.setting = setting;
      }),
    };
    mockTranslatorInstances.push(instance);
    return instance;
  });

  TransboxManager.mockImplementation((setting) => {
    mockTransboxArgs.push(setting);
    let enabled = Boolean(setting.tranboxSetting?.transOpen);
    const instance = {
      isEnabled: jest.fn(() => enabled),
      enable: jest.fn(() => {
        enabled = true;
      }),
      disable: jest.fn(() => {
        enabled = false;
      }),
      toggle: jest.fn(() => {
        enabled = !enabled;
      }),
    };
    instance.update = jest.fn((props) => {
      if (!props?.tranboxSetting || !("transOpen" in props.tranboxSetting)) {
        return;
      }
      if (!props.tranboxSetting.transOpen) {
        instance.disable();
        return;
      }
      if (!enabled) instance.enable();
    });
    mockTransboxInstances.push(instance);
    return instance;
  });

  InputTranslator.mockImplementation(() => {
    const instance = {
      enable: jest.fn(),
      disable: jest.fn(),
      toggle: jest.fn(),
      handleTranslate: jest.fn(),
      updateConfig: jest.fn(),
    };
    mockInputTranslatorInstances.push(instance);
    return instance;
  });

  PopupManager.mockImplementation(() => {
    const instance = {
      destroy: jest.fn(),
      toggle: jest.fn(),
      hide: jest.fn(),
    };
    mockPopupInstances.push(instance);
    return instance;
  });

  FabManager.mockImplementation(() => {
    const instance = {
      destroy: jest.fn(),
      show: jest.fn(),
      setProps: jest.fn(),
      isVisible: true,
    };
    mockFabInstances.push(instance);
    return instance;
  });
}

function createManager({
  rule = { transOpen: "true" },
  setting = {},
  isIframe = false,
  transboxOnly = false,
  onManualSwitch = () => {},
  pageSwitch = null,
} = {}) {
  const manager = new TranslatorManager({
    setting: {
      touchModes: [],
      shortcuts: {},
      tranboxSetting: { transOpen: true },
      mouseHoverSetting: { useMouseHover: false },
      inputRule: { transOpen: true },
      contextMenuType: 0,
      ...setting,
    },
    rule,
    fabConfig: { isHide: false },
    isIframe,
    transboxOnly,
    onManualSwitch,
    pageSwitch,
  });
  activeManagers.push(manager);
  return manager;
}

function replaceBody() {
  const newBody = document.createElement("body");
  document.body.replaceWith(newBody);
}

async function flushMutationObserver() {
  await Promise.resolve();
  await Promise.resolve();
}

function storedSetting({
  tranbox = true,
  input = true,
  hover = false,
  uiLang = "en",
} = {}) {
  return {
    uiLang,
    tranboxSetting: { transOpen: tranbox },
    inputRule: { transOpen: input },
    mouseHoverSetting: { useMouseHover: hover },
  };
}

function applyStoredSetting(manager, { next, transOpen = "true" }) {
  const target = {
    state: transOpen === "true" ? "on" : "off",
    rule: { selector: "article", transOpen },
    setting: next,
  };
  manager.applyTarget(target);
  return target;
}

function loadContextMenuClick() {
  const source = fs.readFileSync(
    path.join(__dirname, "../background.js"),
    "utf8"
  );
  const start = source.indexOf(
    "browser?.contextMenus?.onClicked?.addListener?.("
  );
  const end = source.indexOf("async function handleStreamFetch");
  if (start < 0 || end < start) {
    throw new Error("context menu listener was not found");
  }
  const real = jest.requireActual("../config/msg");
  const sendTabMsg = jest.fn();
  const sandbox = {
    sendTabMsg,
    broadcastTranslateToggle: jest.fn(),
    openOptionsPage: jest.fn(),
    CMD_TOGGLE_TRANSLATE: real.CMD_TOGGLE_TRANSLATE,
    CMD_TOGGLE_TRANSLATE_ONLY: real.CMD_TOGGLE_TRANSLATE_ONLY,
    CMD_TOGGLE_STYLE: real.CMD_TOGGLE_STYLE,
    CMD_OPEN_TRANBOX: real.CMD_OPEN_TRANBOX,
    CMD_TOGGLE_TRANBOX: real.CMD_TOGGLE_TRANBOX,
    CMD_OPEN_OPTIONS: real.CMD_OPEN_OPTIONS,
    MSG_TRANS_TOGGLE_ONLY: real.MSG_TRANS_TOGGLE_ONLY,
    MSG_TRANS_TOGGLE_STYLE: real.MSG_TRANS_TOGGLE_STYLE,
    MSG_OPEN_TRANBOX: real.MSG_OPEN_TRANBOX,
    MSG_TRANSBOX_TOGGLE: real.MSG_TRANSBOX_TOGGLE,
  };
  sandbox.browser = {
    contextMenus: {
      onClicked: {
        addListener(listener) {
          sandbox.click = listener;
        },
      },
    },
  };
  vm.runInContext(source.slice(start, end), vm.createContext(sandbox));
  return {
    sendTabMsg,
    click: sandbox.click,
    real,
    broadcastTranslateToggle: sandbox.broadcastTranslateToggle,
  };
}

function sendRuntimeMessage(message) {
  const runtimeHandler = browser.runtime.onMessage.addListener.mock.calls[0][0];
  const sendResponse = jest.fn();
  runtimeHandler(message, {}, sendResponse);
  expect(sendResponse).toHaveBeenCalledTimes(1);
  return sendResponse.mock.calls[0][0];
}

function sendRuntimeMessageAsync(message) {
  const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
  return new Promise((resolve) => {
    expect(handler(message, {}, resolve)).toBe(true);
  });
}

describe("TranslatorManager SPA lifecycle", () => {
  beforeEach(() => {
    mockFabStorage.listeners = [];
    jest.useFakeTimers();
    document.documentElement.innerHTML = "<head></head><body></body>";
    jest.clearAllMocks();
    shortcutRegister.mockImplementation(() => () => {});
    browser.runtime.sendMessage.mockReset().mockResolvedValue(12);
    mockPopupDocumentIdentity.mockReset();
    mockPopupDocumentIdentity.mockReturnValue({
      token: "current-document",
      url: "https://example.com/page",
    });

    mockTranslatorInstances.length = 0;
    mockTranslatorArgs.length = 0;
    mockTransboxInstances.length = 0;
    mockTransboxArgs.length = 0;
    mockInputTranslatorInstances.length = 0;
    mockPopupInstances.length = 0;
    mockFabInstances.length = 0;
    activeManagers.length = 0;
    setupMockConstructors();
  });

  afterEach(() => {
    activeManagers.forEach((manager) => manager.stop());
    activeManagers.length = 0;
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("restarts runtime modules when body is replaced", async () => {
    const manager = createManager();
    manager.start();

    replaceBody();
    await flushMutationObserver();
    jest.runOnlyPendingTimers();

    expect(Translator).toHaveBeenCalledTimes(2);
    expect(mockTranslatorInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockPopupInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(mockFabInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(browser.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  test("touch mode is document-local and survives runtime recreation", () => {
    const manager = createManager();
    manager.start();
    expect(
      sendRuntimeMessage({ action: "touch-state" }).touchTranslate.mode
    ).toBe("off");
    expect(
      sendRuntimeMessage({ action: "touch-mode-set", args: { mode: "tap" } })
        .touchTranslate.mode
    ).toBe("tap");
    manager.restart();
    expect(mockTranslatorInstances[1].setTouchMode).toHaveBeenCalledWith("tap");
    expect(mockTranslatorArgs[1].setting.mouseHoverSetting).toEqual({
      useMouseHover: false,
    });
    manager.stop();
    const nextDocument = createManager();
    nextDocument.start();
    const respond = jest.fn();
    browser.runtime.onMessage.addListener.mock.calls.at(-1)[0](
      { action: "touch-state" },
      {},
      respond
    );
    expect(respond.mock.calls[0][0].touchTranslate.mode).toBe("off");
  });

  test.each(["touch-state", "touch-mode-set"])(
    "rejects %s addressed to a replaced document",
    (action) => {
      const manager = createManager();
      manager.start();
      const translator = mockTranslatorInstances[0];
      translator.setTouchMode.mockClear();

      expect(
        sendRuntimeMessage({
          action,
          args: { mode: "tap" },
          expectedDocumentToken: "old-document",
        })
      ).toEqual({
        error: "The requested document is no longer current.",
        code: "STALE_DOCUMENT",
      });
      expect(translator.setTouchMode).not.toHaveBeenCalled();
      expect(
        sendRuntimeMessage({
          action: "touch-state",
          expectedDocumentToken: "current-document",
        }).touchTranslate.mode
      ).toBe("off");
    }
  );

  test("keeps touch state queries and exit available while editing rules", () => {
    const manager = createManager();
    manager.start();
    const { processActions } = PopupManager.mock.calls[0][0];
    processActions({ action: "touch-mode-set", args: { mode: "tap" } });
    manager._ruleEditorManager.session = {};
    mockTranslatorInstances[0].setTouchMode.mockClear();

    expect(processActions({ action: "touch-state" }).touchTranslate.mode).toBe(
      "tap"
    );
    expect(
      processActions({ action: "touch-mode-set", args: { mode: "swipe" } })
        .touchTranslate.mode
    ).toBe("tap");
    expect(mockTranslatorInstances[0].setTouchMode).not.toHaveBeenCalled();
    expect(
      processActions({ action: "touch-mode-set", args: { mode: "off" } })
        .touchTranslate.mode
    ).toBe("off");
    expect(mockTranslatorInstances[0].setTouchMode).toHaveBeenCalledWith("off");
    expect(sendIframeMsg).not.toHaveBeenCalled();
  });

  test("does not restart after stop", async () => {
    const manager = createManager();
    manager.start();
    manager.stop();

    replaceBody();
    await flushMutationObserver();
    jest.runOnlyPendingTimers();

    expect(Translator).toHaveBeenCalledTimes(1);
  });

  test("preserves disabled translation and UI settings across restart", async () => {
    const manager = createManager({
      rule: { transOpen: "false" },
      setting: {
        tranboxSetting: { transOpen: false },
        inputRule: { transOpen: false },
      },
    });
    manager.start();

    replaceBody();
    await flushMutationObserver();
    jest.runOnlyPendingTimers();

    expect(mockTranslatorArgs[1].rule.transOpen).toBe("false");
    expect(mockTransboxArgs[1].tranboxSetting.transOpen).toBe(false);
    expect(mockTranslatorArgs[1].setting.inputRule.transOpen).toBe(false);
  });

  test.each([true, false])(
    "restores pre-editor translation state %s and explicit feature settings on restart",
    (enabled) => {
      const manager = createManager();
      manager.start();
      sendRuntimeMessage({
        action: "transbox-toggle",
        args: { enabled: false },
      });
      sendRuntimeMessage({
        action: "transinput-toggle",
        args: { enabled: false },
      });

      const translator = mockTranslatorInstances[0];
      const editor = manager._ruleEditorManager;
      editor.session = { runtimeState: { enabled, mouseHover: enabled } };
      translator.rule = {
        transOpen: enabled ? "false" : "true",
        selector: ".article",
      };
      translator.setting.mouseHoverSetting.useMouseHover = !enabled;

      manager.restart("rule-editor-state-test");

      expect(editor.destroy).toHaveBeenCalledTimes(1);
      expect(mockTranslatorArgs[1].rule).toEqual({
        transOpen: enabled ? "true" : "false",
        selector: ".article",
      });
      expect(
        mockTranslatorArgs[1].setting.mouseHoverSetting.useMouseHover
      ).toBe(enabled);
      expect(mockTransboxArgs[1].tranboxSetting.transOpen).toBe(false);
      expect(mockTranslatorArgs[1].setting.inputRule.transOpen).toBe(false);
      expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(!enabled);
    }
  );

  test("coalesces navigation rescan and body replacement into one restart", async () => {
    const manager = createManager();
    manager.start();

    document.documentElement.dispatchEvent(new Event("turbo:load"));
    replaceBody();
    await flushMutationObserver();
    jest.runOnlyPendingTimers();

    expect(Translator).toHaveBeenCalledTimes(2);
    expect(mockTranslatorInstances[0].rescan).not.toHaveBeenCalled();
  });

  test("rescans on bfcache pageshow when the document container is unchanged", () => {
    const manager = createManager();
    manager.start();

    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true })
    );
    jest.runOnlyPendingTimers();

    expect(mockTranslatorInstances[0].rescan).toHaveBeenCalledTimes(1);
    expect(Translator).toHaveBeenCalledTimes(1);
  });

  test("keeps the github.com rule when a turbo frame navigates inside the repo", () => {
    const rule = {
      pattern: "github.com",
      autoScan: "false",
      selector: "h1, p, [data-testid='issue-title-sticky']",
      ignoreSelector: "button, p.pinned-item-desc+p",
      transOpen: "true",
    };
    const manager = createManager({ rule });
    manager.start();

    document.body.innerHTML =
      '<turbo-frame id="repo-content-turbo-frame"><article class="markdown-body"><p>Repo readme</p></article></turbo-frame>';
    const frame = document.querySelector("turbo-frame");
    frame.innerHTML =
      '<h1><bdi data-testid="issue-title">Issue title</bdi></h1><bdi data-testid="issue-title-sticky">Issue title</bdi><div class="comment-body markdown-body"><p>Comment body</p></div>';
    frame.dispatchEvent(new Event("turbo:frame-load", { bubbles: true }));
    jest.runOnlyPendingTimers();

    expect(Translator).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].rescan).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].rule).toMatchObject({
      pattern: "github.com",
      autoScan: "false",
      selector: rule.selector,
      transOpen: "true",
    });
  });

  test("keeps github.com selectors when a turbo visit replaces the body", async () => {
    const rule = {
      pattern: "github.com",
      autoScan: "false",
      selector: "h1, .markdown-body li, p",
      ignoreSelector: "button, p.pinned-item-desc+p",
      transOpen: "true",
    };
    const manager = createManager({ rule });
    manager.start();

    replaceBody();
    await flushMutationObserver();
    jest.runOnlyPendingTimers();

    expect(Translator).toHaveBeenCalledTimes(2);
    expect(mockTranslatorArgs[1].rule).toMatchObject({
      pattern: "github.com",
      autoScan: "false",
      selector: rule.selector,
      ignoreSelector: rule.ignoreSelector,
      transOpen: "true",
    });
  });

  test("starts only the transbox and message listener in transbox-only mode", () => {
    const manager = createManager({ transboxOnly: true });
    manager.start();

    expect(TransboxManager).toHaveBeenCalledTimes(1);
    expect(Translator).not.toHaveBeenCalled();
    expect(InputTranslator).not.toHaveBeenCalled();
    expect(PopupManager).not.toHaveBeenCalled();
    expect(FabManager).not.toHaveBeenCalled();
    expect(browser.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  test("passes open-tranbox args through the inner event", () => {
    const manager = createManager({ transboxOnly: true });
    const eventHandler = jest.fn();
    manager.start();
    document.addEventListener("immertranslate-inner", eventHandler);

    const runtimeHandler =
      browser.runtime.onMessage.addListener.mock.calls[0][0];
    const sendResponse = jest.fn();
    runtimeHandler(
      { action: "open-tranbox", args: { text: "hello" } },
      {},
      sendResponse
    );

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler.mock.calls[0][0].detail).toEqual({
      action: "open-tranbox",
      args: { text: "hello" },
    });

    document.removeEventListener("immertranslate-inner", eventHandler);
  });

  test.each([true, false])(
    "keeps reopened Popup toggles in sync in transbox-only mode from %s",
    (initialEnabled) => {
      const manager = createManager({
        transboxOnly: true,
        setting: { tranboxSetting: { transOpen: initialEnabled } },
      });
      manager.start();

      for (const expected of [
        !initialEnabled,
        initialEnabled,
        !initialEnabled,
      ]) {
        const reopened = sendRuntimeMessage({ action: "trans-getrule" });
        const message = {
          action: "transbox-toggle",
          args: { enabled: !reopened.setting.tranboxSetting.transOpen },
        };
        const response = sendRuntimeMessage(message);
        expect(response.setting.tranboxSetting.transOpen).toBe(expected);
        expect(mockTransboxInstances[0].isEnabled()).toBe(expected);

        const replayed = sendRuntimeMessage(message);
        expect(replayed.setting.tranboxSetting.transOpen).toBe(expected);
        expect(mockTransboxInstances[0].isEnabled()).toBe(expected);
      }

      for (const expected of [initialEnabled, !initialEnabled]) {
        const response = sendRuntimeMessage({ action: "transbox-toggle" });
        expect(response.setting.tranboxSetting.transOpen).toBe(expected);
        expect(mockTransboxInstances[0].isEnabled()).toBe(expected);
        const reopened = sendRuntimeMessage({ action: "trans-getrule" });
        expect(reopened.setting.tranboxSetting.transOpen).toBe(expected);
      }
    }
  );

  test.each([true, false])(
    "preserves the live transbox-only state across restart from %s",
    (initialEnabled) => {
      const tranboxSetting = {
        transOpen: initialEnabled,
        tranboxShortcut: "Alt+S",
      };
      const manager = createManager({
        transboxOnly: true,
        setting: { tranboxSetting, uiLang: "en" },
      });
      manager.start();
      sendRuntimeMessage({ action: "transbox-toggle" });

      manager.restart("pdf-selection-state-test");

      const response = sendRuntimeMessage({ action: "trans-getrule" });
      expect(response.setting.tranboxSetting).toEqual({
        ...tranboxSetting,
        transOpen: !initialEnabled,
      });
      expect(response.setting.uiLang).toBe("en");
      expect(mockTransboxInstances[1].isEnabled()).toBe(!initialEnabled);
      expect(mockTransboxArgs[1].tranboxSetting.transOpen).toBe(
        !initialEnabled
      );
      expect(tranboxSetting.transOpen).toBe(initialEnabled);
      expect(Translator).not.toHaveBeenCalled();
    }
  );

  test("returns current translator settings and rules in normal mode", () => {
    const manager = createManager();
    manager.start();
    const translator = mockTranslatorInstances[0];
    translator.setting.uiLang = "en";
    translator.rule = { transOpen: "false", toLang: "en" };

    sendRuntimeMessage({
      action: "transbox-toggle",
      args: { enabled: false },
    });
    const response = sendRuntimeMessage({ action: "trans-getrule" });

    expect(response).toEqual({
      rule: translator.rule,
      setting: translator.setting,
      capabilities: {
        pageTranslation: true,
        selectionTranslation: true,
        hoverTranslation: true,
        inputTranslation: true,
        ruleEditor: true,
      },
      isTopFrame: true,
      document: {
        token: "current-document",
        url: "https://example.com/page",
        frameId: 0,
      },
      pageSwitch: null,
    });
    expect(response.setting.uiLang).toBe("en");
    expect(response.setting.tranboxSetting.transOpen).toBe(false);
    expect(mockTransboxInstances[0].isEnabled()).toBe(false);
  });

  test("throws when the page-switch callback is missing", () => {
    expect(
      () =>
        new TranslatorManager({
          setting: {},
          rule: { transOpen: "true" },
          fabConfig: {},
        })
    ).toThrow(TypeError);
  });

  test("the top frame broadcasts the page switch and child frames follow it", () => {
    const topRuntime = jest.fn(() => {
      top.applyTarget({
        state: "off",
        rule: { transOpen: "false" },
      });
    });
    const top = createManager({
      rule: { transOpen: "true" },
      pageSwitch: "on",
      onManualSwitch: topRuntime,
    });
    top.start();
    const { processActions } = PopupManager.mock.calls.at(-1)[0];
    processActions({ action: "trans-toggle" });
    expect(topRuntime).toHaveBeenCalledWith(undefined);
    expect(sendIframeMsg).toHaveBeenCalledWith("trans-toggle", {
      enabled: false,
    });
    expect(mockTranslatorInstances[0].disable).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();

    const childOnRuntime = jest.fn();
    const childOffRuntime = jest.fn();
    const childOn = createManager({
      isIframe: true,
      rule: { transOpen: "true" },
      pageSwitch: "on",
      onManualSwitch: childOnRuntime,
    });
    childOn.start();
    const childOff = createManager({
      isIframe: true,
      rule: { transOpen: "false" },
      pageSwitch: "off",
      onManualSwitch: childOffRuntime,
    });
    childOff.start();
    const handlers = browser.runtime.onMessage.addListener.mock.calls;
    handlers.at(-2)[0](
      { action: "trans-toggle", args: { enabled: false } },
      {},
      jest.fn()
    );
    handlers.at(-1)[0](
      { action: "trans-toggle", args: { enabled: false } },
      {},
      jest.fn()
    );
    handlers.at(-2)[0]({ action: "trans-toggle" }, {}, jest.fn());
    handlers.at(-1)[0]({ action: "trans-toggle" }, {}, jest.fn());

    expect(childOnRuntime).toHaveBeenCalledTimes(1);
    expect(childOnRuntime).toHaveBeenCalledWith(false);
    expect(childOffRuntime).toHaveBeenCalledTimes(1);
    expect(childOffRuntime).toHaveBeenCalledWith(false);
    expect(mockTranslatorInstances.at(-2).enable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances.at(-2).disable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances.at(-1).enable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances.at(-1).disable).not.toHaveBeenCalled();
    expect(sendIframeMsg).toHaveBeenCalledTimes(1);
  });

  test("applies explicit feature states without flipping them on replay", () => {
    const manager = createManager();
    manager.start();

    const runtimeHandler =
      browser.runtime.onMessage.addListener.mock.calls[0][0];
    const send = (action, enabled) =>
      runtimeHandler({ action, args: { enabled } }, {}, jest.fn());

    send("transbox-toggle", false);
    send("transbox-toggle", false);
    send("mousehover-toggle", true);
    send("mousehover-toggle", true);
    send("transinput-toggle", false);
    send("transinput-toggle", false);

    expect(mockTransboxInstances[0].disable).toHaveBeenCalledTimes(2);
    expect(mockTranslatorInstances[0].toggleTransbox).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].setting.tranboxSetting.transOpen).toBe(
      false
    );
    expect(mockTranslatorInstances[0].toggleMouseHover).toHaveBeenCalledTimes(
      1
    );
    expect(
      mockTranslatorInstances[0].setting.mouseHoverSetting.useMouseHover
    ).toBe(true);
    expect(mockInputTranslatorInstances[0].disable).toHaveBeenCalledTimes(2);
    expect(
      mockTranslatorInstances[0].toggleInputTranslate
    ).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].setting.inputRule.transOpen).toBe(false);
  });

  test("keeps legacy feature toggles when no desired state is supplied", () => {
    const manager = createManager();
    manager.start();

    const runtimeHandler =
      browser.runtime.onMessage.addListener.mock.calls[0][0];
    ["transbox-toggle", "mousehover-toggle", "transinput-toggle"].forEach(
      (action) => runtimeHandler({ action }, {}, jest.fn())
    );

    expect(mockTransboxInstances[0].toggle).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].toggleTransbox).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].toggleMouseHover).toHaveBeenCalledTimes(
      1
    );
    expect(mockInputTranslatorInstances[0].toggle).toHaveBeenCalledTimes(1);
    expect(
      mockTranslatorInstances[0].toggleInputTranslate
    ).toHaveBeenCalledTimes(1);
  });

  test("reports live selection availability to the FAB after toggles and restart", () => {
    const manager = createManager({
      setting: { tranboxSetting: { transOpen: false } },
    });
    manager.start();
    const { getSelectionEnabled } = FabManager.mock.calls[0][0];
    const { processActions } = PopupManager.mock.calls[0][0];
    const snapshots = [];
    const onSelectionChange = (event) => {
      if (event.detail.action === "transbox-toggle") {
        snapshots.push(getSelectionEnabled());
      }
    };
    document.addEventListener("immertranslate-inner", onSelectionChange);

    try {
      expect(getSelectionEnabled()).toBe(false);
      for (const enabled of [true, true, false]) {
        processActions({ action: "transbox-toggle", args: { enabled } });
      }
      processActions({ action: "transbox-toggle" });
      processActions({ action: "transbox-toggle" });

      expect(snapshots).toEqual([true, true, false, true, false]);
      expect(getSelectionEnabled()).toBe(false);

      manager.restart("selection-state-test");
      expect(FabManager.mock.calls[1][0].getSelectionEnabled()).toBe(false);
      expect(mockTransboxArgs[1].tranboxSetting.transOpen).toBe(false);
    } finally {
      document.removeEventListener("immertranslate-inner", onSelectionChange);
    }
  });

  test.each([
    {
      name: "a child frame",
      options: { isIframe: true },
      capabilities: {
        pageTranslation: true,
        selectionTranslation: true,
        hoverTranslation: true,
        inputTranslation: false,
        ruleEditor: false,
      },
      isTopFrame: false,
    },
    {
      name: "a PDF selection-only frame",
      options: { transboxOnly: true },
      capabilities: {
        pageTranslation: false,
        selectionTranslation: true,
        hoverTranslation: false,
        inputTranslation: false,
        ruleEditor: false,
      },
      isTopFrame: true,
    },
  ])(
    "reports the modules available in $name",
    async ({ options, capabilities, isTopFrame }) => {
      browser.runtime.sendMessage.mockResolvedValue(12);
      const manager = createManager(options);
      manager.start();
      await flushMutationObserver();

      expect(sendRuntimeMessage({ action: "trans-getrule" })).toEqual(
        expect.objectContaining({ capabilities, isTopFrame })
      );
    }
  );

  test("rejects top-only operations in child frames while retaining translation", () => {
    const manager = createManager({ isIframe: true });
    manager.start();

    for (const action of [
      "transinput-toggle",
      "input-translate",
      "rule-editor",
    ]) {
      expect(sendRuntimeMessage({ action })).toEqual({
        error: expect.any(String),
      });
    }
    expect(
      mockTranslatorInstances[0].toggleInputTranslate
    ).not.toHaveBeenCalled();

    for (const action of [
      "mousehover-toggle",
      "transbox-toggle",
      "trans-toggle",
    ]) {
      const response = sendRuntimeMessage({ action });
      expect(response.error).toBeUndefined();
      expect(response.isTopFrame).toBe(false);
    }
    expect(mockTranslatorInstances[0].disable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
    sendRuntimeMessage({ action: "trans-toggle", args: { enabled: false } });
    sendRuntimeMessage({ action: "trans-toggle", args: { enabled: true } });
    expect(mockTranslatorInstances[0].disable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    expect(mockTransboxInstances[0].toggle).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].toggleMouseHover).toHaveBeenCalledTimes(
      1
    );
    sendRuntimeMessage({
      action: "mousehover-toggle",
      args: { enabled: true },
    });
    expect(mockTranslatorInstances[0].toggleMouseHover).toHaveBeenCalledTimes(
      1
    );
    expect(sendIframeMsg).not.toHaveBeenCalled();
  });

  test("rejects page operations when only PDF selection translation exists", () => {
    const manager = createManager({ transboxOnly: true });
    manager.start();

    for (const action of [
      "trans-toggle",
      "trans-putrule",
      "mousehover-toggle",
      "transinput-toggle",
      "rule-editor",
    ]) {
      expect(sendRuntimeMessage({ action })).toEqual({
        error: expect.any(String),
      });
    }
    expect(mockTransboxInstances[0].isEnabled()).toBe(true);
  });

  test("confirms direct operations without forwarding top-only commands", () => {
    const manager = createManager();
    manager.start();
    const { processActions } = PopupManager.mock.calls[0][0];

    const response = processActions({
      action: "transinput-toggle",
      args: { enabled: false },
    });
    processActions({ action: "input-translate" });
    expect(response.setting.inputRule.transOpen).toBe(false);
    expect(sendIframeMsg).not.toHaveBeenCalled();

    processActions({ action: "transbox-toggle", args: { enabled: false } });
    expect(sendIframeMsg).toHaveBeenCalledWith("transbox-toggle", {
      enabled: false,
    });
  });

  test("confirms a rule editor only after its session is visible", () => {
    const manager = createManager();
    manager.start();
    const editor = manager._ruleEditorManager;
    editor.open.mockImplementation(() => {
      editor.session = {};
      editor.isVisible = true;
      mockTranslatorInstances[0].touchMode = "off";
    });
    const onTouchState = jest.fn();
    document.addEventListener("immertranslate-inner", onTouchState);
    let response;
    try {
      response = sendRuntimeMessage({ action: "rule-editor" });
    } finally {
      document.removeEventListener("immertranslate-inner", onTouchState);
    }

    expect(response.ruleEditorOpened).toBe(true);
    expect(onTouchState).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "touch-state",
          touchTranslate: expect.objectContaining({ mode: "off" }),
        }),
      })
    );
    expect(mockPopupInstances[0].hide).toHaveBeenCalledTimes(1);
    expect(sendIframeMsg).not.toHaveBeenCalled();
    expect(sendRuntimeMessage({ action: "transbox-toggle" })).toEqual({
      error: expect.any(String),
    });
    expect(mockTransboxInstances[0].toggle).not.toHaveBeenCalled();
  });

  test("keeps the Popup open when the rule editor cannot mount", () => {
    const manager = createManager();
    manager.start();

    expect(sendRuntimeMessage({ action: "rule-editor" })).toEqual({
      error: "The rule editor could not be opened.",
    });
    expect(mockPopupInstances[0].hide).not.toHaveBeenCalled();
  });

  test("reports runtime operation failures through the existing error response", () => {
    const manager = createManager();
    manager.start();
    manager._ruleEditorManager.open.mockImplementation(() => {
      throw new Error("Editor initialization failed.");
    });

    expect(sendRuntimeMessage({ action: "rule-editor" })).toEqual({
      error: "Editor initialization failed.",
    });
    expect(mockPopupInstances[0].hide).not.toHaveBeenCalled();
  });

  test("rejects a guarded command addressed to a replaced document", () => {
    const manager = createManager();
    manager.start();
    expect(
      sendRuntimeMessage({
        action: "trans-toggle",
        args: { enabled: true },
        expectedDocumentToken: "old-document",
      })
    ).toEqual({
      error: "The requested document is no longer current.",
      code: "STALE_DOCUMENT",
    });
    expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    expect(
      sendRuntimeMessage({
        action: "trans-getrule",
        expectedDocumentToken: "current-document",
      }).document.token
    ).toBe("current-document");
  });

  test.each([
    "current-document",
    "child-document",
    "removed-document",
    undefined,
  ])(
    "executes a routed command only in its selected document: %s",
    async (responseDocumentToken) => {
      browser.runtime.sendMessage.mockResolvedValue(12);
      createManager().start();
      mockPopupDocumentIdentity.mockReturnValue({
        token: "child-document",
        url: "https://example.com/child",
      });
      createManager({ isIframe: true }).start();
      await flushMutationObserver();

      for (const [index, token] of [
        "current-document",
        "child-document",
      ].entries()) {
        const handler =
          browser.runtime.onMessage.addListener.mock.calls[index][0];
        const reply = jest.fn();
        const selected =
          !responseDocumentToken || responseDocumentToken === token;
        expect(
          handler(
            {
              action: "trans-toggle",
              args: { enabled: true },
              responseDocumentToken,
            },
            {},
            reply
          )
        ).toBe(selected);
        expect(reply).toHaveBeenCalledTimes(selected ? 1 : 0);
        if (selected) {
          expect(reply).toHaveBeenCalledWith(
            expect.objectContaining({
              document: expect.objectContaining({ token }),
            })
          );
        }
        expect(mockTranslatorInstances[index].enable).not.toHaveBeenCalled();
        expect(mockTranslatorInstances[index].disable).not.toHaveBeenCalled();
      }
      expect(sendIframeMsg).not.toHaveBeenCalled();
    }
  );

  test.each([
    { selected: true, throws: true },
    { selected: false, throws: true },
    { selected: true, throws: false },
    { selected: false, throws: false },
  ])(
    "only the selected document reports command errors (selected: $selected, throws: $throws)",
    async ({ selected, throws }) => {
      const manager = createManager({ isIframe: true });
      manager.start();
      await flushMutationObserver();
      mockTransboxInstances[0].enable.mockImplementation(() => {
        throw new Error("Translation initialization failed.");
      });
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      const reply = jest.fn();

      expect(
        handler(
          {
            action: throws ? "transbox-toggle" : "transinput-toggle",
            args: { enabled: true },
            responseDocumentToken: selected
              ? "current-document"
              : "another-document",
          },
          {},
          reply
        )
      ).toBe(selected);
      expect(reply).toHaveBeenCalledTimes(selected ? 1 : 0);
      if (selected) {
        expect(reply).toHaveBeenCalledWith({
          error: throws
            ? "Translation initialization failed."
            : "Message action is unavailable in this frame: transinput-toggle",
        });
      }
      expect(mockTransboxInstances[0].enable).toHaveBeenCalledTimes(
        selected && throws ? 1 : 0
      );
      expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    }
  );

  test.each([0, 12])(
    "verifies a forwarded command's source frame %s before executing in another frame",
    async (frameId) => {
      const sourceDocument = { token: "selected-document", frameId };
      createManager({ isIframe: true }).start();
      await flushMutationObserver();
      let verify;
      browser.runtime.sendMessage.mockReturnValueOnce(
        new Promise((resolve) => (verify = resolve))
      );
      const response = sendRuntimeMessageAsync({
        action: "trans-toggle",
        sourceDocument,
      });
      await flushMutationObserver();
      expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
      expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith({
        action: "validate_document",
        args: sourceDocument,
      });
      verify(true);
      await expect(response).resolves.toMatchObject({
        document: { token: "current-document" },
      });
      expect(mockTranslatorInstances[0].disable).not.toHaveBeenCalled();
      expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
      expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
      expect(sendIframeMsg).not.toHaveBeenCalled();
    }
  );

  test("does not execute the selected document's toggle again during forwarding", () => {
    createManager().start();
    const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
    const reply = jest.fn();
    expect(
      handler(
        {
          action: "trans-toggle",
          sourceDocument: { token: "current-document", frameId: 0 },
        },
        {},
        reply
      )
    ).toBe(false);
    expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  test.each([false, undefined, "true"])(
    "rejects a forwarded command when its replaced source cannot be verified: %s",
    async (verification) => {
      createManager().start();
      browser.runtime.sendMessage.mockResolvedValue(verification);
      await expect(
        sendRuntimeMessageAsync({
          action: "trans-toggle",
          sourceDocument: { token: "old-document", frameId: 0 },
        })
      ).resolves.toMatchObject({ code: "STALE_DOCUMENT" });
      expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
    }
  );

  test("does not execute a forwarded command after its receiving runtime stops", async () => {
    const manager = createManager();
    manager.start();
    let verify;
    browser.runtime.sendMessage.mockReturnValueOnce(
      new Promise((resolve) => (verify = resolve))
    );
    const response = sendRuntimeMessageAsync({
      action: "trans-toggle",
      sourceDocument: { token: "selected-document", frameId: 12 },
    });
    await flushMutationObserver();
    manager.stop();
    verify(true);
    await expect(response).resolves.toMatchObject({ code: "STALE_DOCUMENT" });
    expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
  });

  test("reports verification failure without executing a forwarded command", async () => {
    createManager().start();
    browser.runtime.sendMessage.mockRejectedValue(new Error("Frame removed."));
    await expect(
      sendRuntimeMessageAsync({
        action: "trans-toggle",
        sourceDocument: { token: "selected-document", frameId: 12 },
      })
    ).resolves.toEqual({ error: "Frame removed." });
    expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
  });

  test("preserves the arrival order of forwarded controls while verification is pending", async () => {
    createManager().start();
    const sourceDocument = { token: "selected-document", frameId: 12 };
    let verifyFirst;
    browser.runtime.sendMessage
      .mockReturnValueOnce(new Promise((resolve) => (verifyFirst = resolve)))
      .mockResolvedValueOnce(true);
    const firstResponse = sendRuntimeMessageAsync({
      action: "trans-putrule",
      args: { apiSlug: "service-one" },
      sourceDocument,
    });
    const secondResponse = sendRuntimeMessageAsync({
      action: "trans-putrule",
      args: { toLang: "fr" },
      sourceDocument,
    });
    await flushMutationObserver();
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].updateRule).not.toHaveBeenCalled();
    verifyFirst(true);
    await Promise.all([firstResponse, secondResponse]);
    expect(mockTranslatorInstances[0].updateRule.mock.calls).toEqual([
      [{ apiSlug: "service-one" }],
      [{ toLang: "fr" }],
    ]);
  });

  test("applies a this-page rule edit without writing storage", () => {
    createManager().start();
    sendRuntimeMessage({
      action: "trans-putrule",
      args: { apiSlug: "deepl", toLang: "fr", hasRichText: "true" },
    });
    expect(mockTranslatorInstances[0].updateRule).toHaveBeenCalledWith({
      apiSlug: "deepl",
      toLang: "fr",
      hasRichText: "true",
    });
    expect(publishPageRule).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: expect.any(Object),
        document: expect.objectContaining({ token: "current-document" }),
      })
    );
  });

  test("applyTarget turns translation off and back on with the matched rule", () => {
    const manager = createManager({ rule: { transOpen: "true" } });
    manager.start();
    manager.applyTarget({
      state: "off",
      rule: { apiSlug: "deepl", transOpen: "false" },
    });
    expect(mockTranslatorInstances[0].disable).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].updateRule).toHaveBeenCalledWith(
      expect.objectContaining({ transOpen: "false", apiSlug: "deepl" })
    );
    mockTranslatorInstances[0].rule.transOpen = "false";
    manager.applyTarget({
      state: "on",
      rule: { apiSlug: "deepl", transOpen: "true" },
    });
    expect(mockTranslatorInstances[0].enable).toHaveBeenCalledTimes(1);
    expect(mockTranslatorInstances[0].pausePage).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].continuePage).not.toHaveBeenCalled();
  });

  test("blacklist pause and resume do not disable or rescan the page translator", () => {
    const manager = createManager({ rule: { transOpen: "true" } });
    manager.start();
    const translator = mockTranslatorInstances[0];
    translator.rule.transOpen = "true";
    manager.applyTarget({
      state: "paused",
      rule: { apiSlug: "deepl", transOpen: "false" },
    });
    expect(translator.pausePage).toHaveBeenCalledTimes(1);
    expect(translator.disable).not.toHaveBeenCalled();
    expect(translator.rescan).not.toHaveBeenCalled();
    expect(translator.enable).not.toHaveBeenCalled();
    translator.rule.transOpen = "false";
    manager.applyTarget({
      state: "on",
      rule: { apiSlug: "deepl", transOpen: "true" },
    });
    expect(translator.continuePage).toHaveBeenCalledTimes(1);
    expect(translator.resumePage).not.toHaveBeenCalled();
    expect(translator.enable).not.toHaveBeenCalled();
    expect(translator.disable).not.toHaveBeenCalled();
    expect(translator.rescan).not.toHaveBeenCalled();
    manager.applyTarget({
      state: "paused",
      rule: { apiSlug: "deepl", transOpen: "false" },
    });
    translator.pausePage.mockClear();
    translator.continuePage.mockClear();
    manager.applyTarget({
      state: "off",
      rule: { apiSlug: "deepl", transOpen: "false" },
    });
    expect(translator.resumePage).toHaveBeenCalledTimes(1);
    expect(translator.continuePage).not.toHaveBeenCalled();
    expect(translator.enable).not.toHaveBeenCalled();
    expect(translator.disable).not.toHaveBeenCalled();
    expect(translator.rescan).not.toHaveBeenCalled();
  });

  test("hover stays off while the page switch is paused or off", () => {
    const manager = createManager({
      setting: {
        mouseHoverSetting: { useMouseHover: true, blacklist: "" },
      },
    });
    manager.start();
    const translator = mockTranslatorInstances[0];
    const hoverSetting = {
      mouseHoverSetting: { useMouseHover: true, blacklist: "" },
      tranboxSetting: { transOpen: true },
      inputRule: { transOpen: true },
    };

    manager.applyTarget({
      state: "paused",
      rule: { transOpen: "false" },
      setting: hoverSetting,
    });
    expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(false);
    expect(translator.updateSetting).toHaveBeenCalled();
    expect(
      sendRuntimeMessage({ action: "touch-state" }).touchTranslate.blocked
    ).toBe(true);
    expect(sendRuntimeMessage({ action: "trans-getrule" }).pageSwitch).toBe(
      "paused"
    );

    const runtimeHandler =
      browser.runtime.onMessage.addListener.mock.calls.at(-1)[0];
    runtimeHandler(
      { action: "mousehover-toggle", args: { enabled: true } },
      {},
      jest.fn()
    );
    expect(translator.toggleMouseHover).not.toHaveBeenCalled();

    manager.applyTarget({
      state: "off",
      rule: { transOpen: "false" },
      setting: hoverSetting,
    });
    expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(false);
    expect(
      sendRuntimeMessage({ action: "touch-state" }).touchTranslate.blocked
    ).toBe(true);

    manager.applyTarget({
      state: "on",
      rule: { transOpen: "true" },
      setting: hoverSetting,
    });
    expect(translator.setting.mouseHoverSetting.useMouseHover).toBe(true);
    expect(
      sendRuntimeMessage({ action: "touch-state" }).touchTranslate.blocked
    ).toBe(false);
    runtimeHandler(
      { action: "mousehover-toggle", args: { enabled: false } },
      {},
      jest.fn()
    );
    expect(translator.toggleMouseHover).toHaveBeenCalledTimes(1);
  });

  test("FAB and context-menu toggles do nothing while the page is paused", () => {
    const onManualSwitch = jest.fn();
    const manager = createManager({
      onManualSwitch,
      pageSwitch: "paused",
      rule: { transOpen: "false" },
    });
    manager.start();
    sendRuntimeMessage({ action: "trans-toggle" });
    sendRuntimeMessage({ action: "trans-toggle", args: { enabled: true } });
    sendRuntimeMessage({ action: "trans-toggle", args: { enabled: false } });
    expect(onManualSwitch).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].disable).not.toHaveBeenCalled();
    expect(sendRuntimeMessage({ action: "trans-getrule" }).pageSwitch).toBe(
      "paused"
    );
  });

  test("a bare toggle asks the page runtime instead of the folded transOpen", () => {
    const onManualSwitch = jest.fn();
    const manager = createManager({
      rule: { transOpen: "false" },
      onManualSwitch,
    });
    manager.start();
    sendRuntimeMessage({ action: "trans-toggle" });
    expect(onManualSwitch).toHaveBeenCalledTimes(1);
    expect(onManualSwitch).toHaveBeenCalledWith(undefined);
    expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].disable).not.toHaveBeenCalled();
  });

  test("the context menu translate item uses the shared page toggle", () => {
    const harness = loadContextMenuClick();
    harness.click({ menuItemId: harness.real.CMD_TOGGLE_TRANSLATE });
    expect(harness.broadcastTranslateToggle).toHaveBeenCalledTimes(1);
    expect(harness.sendTabMsg).not.toHaveBeenCalled();
    harness.click({ menuItemId: harness.real.CMD_TOGGLE_TRANBOX });
    expect(harness.sendTabMsg).toHaveBeenCalledWith(
      harness.real.MSG_TRANSBOX_TOGGLE
    );
  });

  test("leaving pause follows the page switch even if the rule transOpen disagrees", () => {
    const manager = createManager({
      rule: { transOpen: "true" },
      pageSwitch: "on",
    });
    manager.start();
    const translator = mockTranslatorInstances[0];
    translator.rule.transOpen = "true";
    manager.applyTarget({
      state: "paused",
      rule: { transOpen: "false" },
    });
    translator.rule.transOpen = "false";
    manager.applyTarget({
      state: "on",
      rule: { transOpen: "false" },
    });
    expect(translator.continuePage).toHaveBeenCalledTimes(1);
    expect(translator.resumePage).not.toHaveBeenCalled();
    expect(translator.enable).not.toHaveBeenCalled();
    expect(translator.disable).not.toHaveBeenCalled();
  });

  test("applyTarget keeps translation on when the target says on", () => {
    const manager = createManager({
      rule: { transOpen: "true", selector: "p" },
    });
    manager.start();
    mockTranslatorInstances[0].rule.transOpen = "true";
    manager.applyTarget({
      state: "on",
      rule: { selector: "article", apiSlug: "deepl", transOpen: "true" },
    });
    expect(mockTranslatorInstances[0].disable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].updateRule).toHaveBeenCalledWith(
      expect.objectContaining({
        selector: "article",
        apiSlug: "deepl",
        transOpen: "true",
      })
    );
  });

  test("a stored tranbox switch change turns selection translation off", () => {
    const manager = createManager();
    manager.start();
    const transbox = mockTransboxInstances[0];
    const translator = mockTranslatorInstances[0];
    expect(transbox.isEnabled()).toBe(true);

    applyStoredSetting(manager, {
      next: storedSetting({ tranbox: false, uiLang: "zh" }),
    });
    expect(transbox.isEnabled()).toBe(false);
    expect(translator.setting.tranboxSetting.transOpen).toBe(false);
    expect(translator.setting.uiLang).toBe("zh");
  });

  test("continues checking queued controls after a verification rejects", async () => {
    createManager().start();
    browser.runtime.sendMessage
      .mockRejectedValueOnce(new Error("Frame removed."))
      .mockResolvedValueOnce(true);
    const sourceDocument = { token: "selected-document", frameId: 12 };
    const firstResponse = sendRuntimeMessageAsync({
      action: "trans-toggle",
      sourceDocument,
    });
    const secondResponse = sendRuntimeMessageAsync({
      action: "trans-toggle-only",
      sourceDocument,
    });
    await expect(firstResponse).resolves.toEqual({ error: "Frame removed." });
    await secondResponse;
    expect(mockTranslatorInstances[0].toggle).not.toHaveBeenCalled();
    expect(mockTranslatorInstances[0].toggleTransOnly).toHaveBeenCalledTimes(1);
  });

  test.each([true, false])(
    "only the selected document reports an inactive runtime (selected: %s)",
    (selected) => {
      const manager = createManager();
      manager.start();
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      manager.stop();
      const reply = jest.fn();

      expect(
        handler(
          {
            action: "trans-toggle",
            args: { enabled: true },
            responseDocumentToken: selected
              ? "current-document"
              : "another-document",
          },
          {},
          reply
        )
      ).toBe(selected);
      expect(reply).toHaveBeenCalledTimes(selected ? 1 : 0);
      if (selected) {
        expect(reply).toHaveBeenCalledWith({
          error: "The requested runtime is no longer active.",
          code: "STALE_DOCUMENT",
        });
      }
      expect(mockTranslatorInstances[0].enable).not.toHaveBeenCalled();
    }
  );

  test.each([true, false])(
    "does not claim a routed query while another child identity is pending (stopped: %s)",
    async (stopped) => {
      let resolveFrameId;
      browser.runtime.sendMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveFrameId = resolve;
        })
      );
      const manager = createManager({ isIframe: true });
      manager.start();
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      const reply = jest.fn();
      expect(
        handler(
          {
            action: "trans-getrule",
            responseDocumentToken: "another-document",
          },
          {},
          reply
        )
      ).toBe(false);
      if (stopped) manager.stop();
      resolveFrameId(12);
      await flushMutationObserver();
      expect(reply).not.toHaveBeenCalled();
    }
  );

  test("uses the background's frame ID for a child document", async () => {
    browser.runtime.sendMessage.mockResolvedValue(12);
    const manager = createManager({ isIframe: true });
    manager.start();
    await flushMutationObserver();
    expect(sendRuntimeMessage({ action: "trans-getrule" }).document).toEqual({
      token: "current-document",
      url: "https://example.com/page",
      frameId: 12,
    });
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: "get_frame_id",
    });
  });

  test.each([
    { stopped: false, responseDocumentToken: undefined },
    { stopped: true, responseDocumentToken: undefined },
    { stopped: false, responseDocumentToken: "current-document" },
    { stopped: true, responseDocumentToken: "current-document" },
  ])(
    "waits for child identity before answering a snapshot (stopped: $stopped, response token: $responseDocumentToken)",
    async ({ stopped, responseDocumentToken }) => {
      let resolveFrameId;
      browser.runtime.sendMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveFrameId = resolve;
        })
      );
      const manager = createManager({ isIframe: true });
      manager.start();
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      const reply = jest.fn();
      const response = new Promise((resolve) => {
        expect(
          handler(
            { action: "trans-getrule", responseDocumentToken },
            {},
            (value) => {
              reply(value);
              resolve(value);
            }
          )
        ).toBe(true);
      });
      expect(reply).not.toHaveBeenCalled();
      if (stopped) manager.stop();
      resolveFrameId(12);
      if (stopped) {
        await expect(response).resolves.toMatchObject({
          code: "STALE_DOCUMENT",
        });
      } else {
        await expect(response).resolves.toMatchObject({
          document: { token: "current-document", frameId: 12 },
          isTopFrame: false,
        });
      }
      expect(reply).toHaveBeenCalledTimes(1);
    }
  );

  test("cleans up transbox-only runtime on stop", () => {
    const manager = createManager({ transboxOnly: true });
    manager.start();
    manager.stop();

    expect(browser.runtime.onMessage.removeListener).toHaveBeenCalledWith(
      browser.runtime.onMessage.addListener.mock.calls[0][0]
    );
    expect(mockTransboxInstances[0].disable).toHaveBeenCalledTimes(1);
  });

  describe("MSG_FAB_TOGGLE handling", () => {
    test("hides from the saved site list and ignores a contradictory enabled flag", () => {
      const manager = createManager();
      manager.start();
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      const reply = jest.fn();

      expect(mockFabInstances.length).toBe(1);
      const initialFab = mockFabInstances[0];

      handler(
        {
          action: "toggle_fab",
          args: {
            enabled: true,
            fabConfig: {
              isHide: false,
              hiddenSites: window.location.hostname,
            },
          },
        },
        {},
        reply
      );

      expect(initialFab.destroy).toHaveBeenCalledTimes(1);
      expect(reply).toHaveBeenCalledWith(
        expect.objectContaining({
          fabVisible: false,
          fabConfig: expect.objectContaining({
            isHide: false,
            hiddenSites: window.location.hostname,
          }),
        })
      );
    });

    test("creates FabManager and calls show when enabled is true", () => {
      const manager = createManager();
      manager.start();
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      const reply = jest.fn();

      handler(
        {
          action: "toggle_fab",
          args: {
            fabConfig: { hiddenSites: window.location.hostname },
          },
        },
        {},
        jest.fn()
      );

      // Now toggle back to true
      handler(
        {
          action: "toggle_fab",
          args: {
            enabled: false,
            fabConfig: { isHide: false, hiddenSites: "", size: 64 },
          },
        },
        {},
        reply
      );

      expect(FabManager).toHaveBeenCalledWith(
        expect.objectContaining({
          autoShow: false,
          fabConfig: expect.objectContaining({ size: 64 }),
        })
      );
      const newFab = mockFabInstances.at(-1);
      expect(newFab.show).toHaveBeenCalledWith(
        expect.objectContaining({
          fabConfig: expect.objectContaining({ size: 64 }),
        })
      );
      expect(reply).toHaveBeenCalledWith(
        expect.objectContaining({ fabVisible: true })
      );
    });

    test.each([{ isIframe: true }, { transboxOnly: true }])(
      "does not process MSG_FAB_TOGGLE in restricted mode %j",
      (options) => {
        const initialCount = mockFabInstances.length;
        const manager = createManager(options);
        manager.start();
        const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
        const reply = jest.fn();

        handler({ action: "toggle_fab", args: { enabled: true } }, {}, reply);
        expect(mockFabInstances.length).toBe(initialCount);
        expect(reply).toHaveBeenCalledWith(
          expect.not.objectContaining({ fabVisible: true })
        );
      }
    );

    test("preserves saved hide and undo configurations across SPA restarts", () => {
      const manager = createManager();
      manager.start();
      const handler = browser.runtime.onMessage.addListener.mock.calls[0][0];
      const hiddenConfig = {
        isHide: false,
        hiddenSites: window.location.hostname,
        shownSites: "",
      };

      // Keep the mounted undo bar while making the saved policy authoritative.
      handler(
        {
          action: "toggle_fab",
          args: { enabled: true, fabConfig: hiddenConfig },
        },
        {},
        jest.fn()
      );
      manager.restart("during-fab-undo-window");
      expect(FabManager.mock.calls.at(-1)[0].fabConfig).toMatchObject(
        hiddenConfig
      );

      handler(
        {
          action: "toggle_fab",
          args: { enabled: false, fabConfig: hiddenConfig },
        },
        {},
        jest.fn()
      );
      manager.restart("after-fab-undo-window");
      expect(FabManager.mock.calls.at(-1)[0].fabConfig).toMatchObject(
        hiddenConfig
      );

      const restoredConfig = { ...hiddenConfig, hiddenSites: "" };
      handler(
        {
          action: "toggle_fab",
          args: { enabled: true, fabConfig: restoredConfig },
        },
        {},
        jest.fn()
      );
      manager.restart("after-fab-undo");
      expect(FabManager.mock.calls.at(-1)[0].fabConfig).toMatchObject(
        restoredConfig
      );
    });

    test("follows STOKEY_FAB, uses it on restart, and unsubscribes on stop", () => {
      const manager = createManager();
      manager.start();
      const listener = mockFabStorage.listeners.at(-1);
      expect(typeof listener).toBe("function");

      listener({
        data: {
          isHide: false,
          hiddenSites: window.location.hostname,
          shownSites: "",
          size: 40,
        },
        isLoading: false,
      });
      expect(mockFabInstances[0].destroy).toHaveBeenCalledTimes(1);

      listener({
        isLoading: true,
        data: { isHide: true, shownSites: window.location.hostname },
      });
      expect(mockFabInstances).toHaveLength(1);

      manager.restart("after-storage-change");
      expect(FabManager.mock.calls.at(-1)[0].fabConfig).toMatchObject({
        hiddenSites: window.location.hostname,
        size: 40,
      });

      manager.stop();
      expect(mockFabStorage.listeners).not.toContain(listener);

      const iframe = createManager({ isIframe: true });
      iframe.start();
      expect(mockFabStorage.listeners).toHaveLength(0);
      iframe.stop();
    });
  });

  test("cloneConfig copies deeply and throws on non-cloneable values", () => {
    const tranboxSetting = { transOpen: true };
    const manager = createManager({ setting: { tranboxSetting } });
    manager.start();
    mockTranslatorArgs.at(-1).setting.tranboxSetting.transOpen = false;
    expect(tranboxSetting.transOpen).toBe(true);
    expect(() => createManager({ setting: { bad: () => 0 } })).toThrow();
  });
});

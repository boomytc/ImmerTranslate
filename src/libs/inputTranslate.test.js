const mockUnregisterShortcut = jest.fn();

jest.mock("../config", () => ({
  DEFAULT_INPUT_RULE: {
    transOpen: true,
    triggerShortcut: ["AltLeft", "KeyI"],
    triggerCount: 1,
    triggerTime: 200,
    showDot: "always",
  },
  DEFAULT_INPUT_SHORTCUT: ["AltLeft", "KeyI"],
  OPT_LANGS_LIST: [],
  DEFAULT_API_SETTING: {},
  OPT_INPUT_DOT_DISABLE: "-",
  OPT_INPUT_DOT_MOBILE: "mobile",
}));

jest.mock("../config/prompt", () => ({
  resolveApiPromptSettings: jest.fn(),
}));

jest.mock("./mobile", () => ({ isMobile: false }));

jest.mock("./utils", () => ({
  genEventName: jest.fn(() => "event"),
  removeEndchar: jest.fn((text) => text),
  matchInputStr: jest.fn(),
  sleep: jest.fn(() => Promise.resolve()),
}));

jest.mock("./shortcut", () => ({
  stepShortcutRegister: jest.fn(() => mockUnregisterShortcut),
}));

jest.mock("../apis", () => ({ apiTranslate: jest.fn() }));
// 失败文案分类会读到 modelList。挡住 request，避免它在导入时拉起被精简 mock 的 utils。
jest.mock("./request", () => ({
  fetchHandle: jest.fn(),
  fnPolyfill: jest.fn(),
}));
jest.mock("./svg", () => ({ createLoadingSVG: jest.fn() }));
jest.mock("./log", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const {
  InputTranslator,
  INPUT_FAILURE_NOTICE_MS,
  anchorInputFailureNotice,
  createInputTranslateFailureNotice,
} = require("./inputTranslate");
const { stepShortcutRegister } = require("./shortcut");
const { resolveApiPromptSettings } = require("../config/prompt");
const { apiTranslate } = require("../apis");
const { createLoadingSVG } = require("./svg");
const { I18N } = require("../config/i18n");
const { logger } = require("./log");

function makeRect({ top = 100, right = 200, width = 100, height = 30 } = {}) {
  return {
    top,
    right,
    bottom: top + height,
    left: right - width,
    width,
    height,
    x: right - width,
    y: top,
    toJSON: () => {},
  };
}

function focusTarget(translator, target, rect = makeRect()) {
  target.getBoundingClientRect = jest.fn(() => rect);
  document.body.appendChild(target);
  target.focus();
  translator.handleFocusIn();
}

function getFloatButton(target) {
  return Array.from(document.body.children).find(
    (node) => node !== target && node.style.position === "fixed"
  );
}

describe("InputTranslator input button", () => {
  let originalResizeObserver;
  let translator;

  beforeAll(() => {
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
  });

  afterAll(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    mockUnregisterShortcut.mockClear();
    stepShortcutRegister.mockReturnValue(mockUnregisterShortcut);
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
      },
    });
  });

  afterEach(() => {
    translator.disable();
    document.body.innerHTML = "";
  });

  test.each([
    ["input without an explicit type", () => document.createElement("input")],
    [
      "search input",
      () => Object.assign(document.createElement("input"), { type: "search" }),
    ],
    ["textarea", () => document.createElement("textarea")],
    [
      "contenteditable",
      () => {
        const node = document.createElement("div");
        node.tabIndex = 0;
        node.setAttribute("contenteditable", "true");
        return node;
      },
    ],
  ])("shows the button for %s", (_label, createTarget) => {
    const target = createTarget();
    focusTarget(translator, target);

    const button = getFloatButton(target);
    expect(button).toBeTruthy();
    expect(button.innerText).toBe("译");
  });

  test("shows the dot on desktop when the rule omits showDot", () => {
    translator.disable();
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
      },
    });
    const target = document.createElement("input");
    focusTarget(translator, target);

    expect(getFloatButton(target).innerText).toBe("译");
  });

  test.each([
    ["mobile-only", "mobile"],
    ["disabled", "-"],
  ])("hides the dot on desktop for a %s rule", (_label, showDot) => {
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 0,
    });
    translator.disable();
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot,
      },
    });
    const target = document.createElement("input");
    focusTarget(translator, target);

    expect(getFloatButton(target)).toBeUndefined();
  });

  test.each([
    "checkbox",
    "radio",
    "submit",
    "button",
    "image",
    "file",
    "password",
  ])("does not show the button for %s input", (type) => {
    const target = document.createElement("input");
    target.type = type;
    focusTarget(translator, target);

    expect(getFloatButton(target)).toBeUndefined();
  });

  test.each([
    [
      "disabled",
      (target) => {
        target.disabled = true;
      },
    ],
    [
      "read-only",
      (target) => {
        target.readOnly = true;
      },
    ],
  ])("does not show the button for a %s text input", (_label, configure) => {
    const target = document.createElement("input");
    configure(target);
    focusTarget(translator, target);

    expect(getFloatButton(target)).toBeUndefined();
  });

  test("places a short input button above when space is available", () => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 100, height: 30 }));

    expect(getFloatButton(target).style.top).toBe("68px");
  });

  test("places a short input button below when the top edge has no room", () => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 10, height: 30 }));

    expect(getFloatButton(target).style.top).toBe("42px");
  });

  test("keeps the button above an input near the bottom edge", () => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 560, height: 30 }));

    expect(getFloatButton(target).style.top).toBe("528px");
  });

  test("keeps a tall input button inside its bottom-right corner", () => {
    const target = document.createElement("textarea");
    focusTarget(translator, target, makeRect({ top: 100, height: 100 }));

    expect(getFloatButton(target).style.top).toBe("165px");
  });

  test.each([
    [20, "0px"],
    [900, "768px"],
  ])("clamps horizontal position for right edge %i", (right, expectedLeft) => {
    const target = document.createElement("input");
    focusTarget(translator, target, makeRect({ top: 100, right }));

    expect(getFloatButton(target).style.left).toBe(expectedLeft);
  });

  test("removes the button and shortcut when disabled", () => {
    const target = document.createElement("input");
    focusTarget(translator, target);

    translator.disable();

    expect(getFloatButton(target)).toBeUndefined();
    expect(mockUnregisterShortcut).toHaveBeenCalledTimes(1);
  });

  test("requests editable content as plain text", async () => {
    translator.disable();
    const apiSetting = {
      apiSlug: "google-cloud",
      apiType: "GoogleCloud",
    };
    translator = new InputTranslator({
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "google-cloud",
        fromLang: "auto",
        toLang: "en",
      },
      transApis: [apiSetting],
    });
    resolveApiPromptSettings.mockReturnValue(apiSetting);
    createLoadingSVG.mockReturnValue(
      document.createElementNS("http://www.w3.org/2000/svg", "svg")
    );
    apiTranslate.mockResolvedValueOnce({
      trText: "First isn't & simple\n\nSecond",
      isSame: false,
    });
    const target = document.createElement("textarea");
    target.value = "First & simple\n\nSecond";
    focusTarget(translator, target);

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(apiTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "First & simple\n\nSecond",
        textFormat: "text",
      })
    );
    expect(target.value).toBe("First isn't & simple\n\nSecond");
  });
});

function failureMessage(root = document) {
  return (
    root.querySelector("[data-input-translate-message]")?.textContent || ""
  );
}

function prepareInput(translator, value = "Hello") {
  resolveApiPromptSettings.mockReturnValue({ apiSlug: "test" });
  createLoadingSVG.mockReturnValue(
    document.createElementNS("http://www.w3.org/2000/svg", "svg")
  );
  const target = document.createElement("textarea");
  target.value = value;
  focusTarget(translator, target);
  return target;
}

describe("input translate failure notice", () => {
  test("shows the mapped sentence and a close control", () => {
    const onDismiss = jest.fn();
    const notice = createInputTranslateFailureNotice({
      message: I18N.test_connection_network.zh,
      closeLabel: I18N.close.zh,
      onDismiss,
    });
    document.body.appendChild(notice);

    expect(notice.getAttribute("role")).toBe("alert");
    expect(notice.className).toContain("notranslate");
    expect(failureMessage(notice)).toBe(I18N.test_connection_network.zh);
    expect(notice.textContent).not.toContain("Failed to fetch");
    expect(notice.querySelector("button").getAttribute("aria-label")).toBe(
      I18N.close.zh
    );

    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    notice.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);

    notice.querySelector("button").click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    notice.remove();
  });

  test("anchors the notice above the float dot when there is room", () => {
    expect(
      anchorInputFailureNotice({
        inputRect: { top: 200, right: 400, bottom: 230, left: 100 },
        buttonRect: { top: 166, right: 400, bottom: 196, left: 370 },
        viewport: { width: 800, height: 600 },
        noticeSize: { width: 280, height: 72 },
      })
    ).toEqual({ top: 86, left: 120, width: 280 });
  });

  test("moves the notice below the input when the top edge has no room", () => {
    expect(
      anchorInputFailureNotice({
        inputRect: { top: 10, right: 400, bottom: 40, left: 100 },
        buttonRect: { top: 42, right: 400, bottom: 72, left: 370 },
        viewport: { width: 800, height: 600 },
        noticeSize: { width: 280, height: 72 },
      })
    ).toEqual({ top: 80, left: 120, width: 280 });
  });

  test("clamps the notice inside a narrow viewport", () => {
    expect(
      anchorInputFailureNotice({
        inputRect: { top: 200, right: 40, bottom: 230, left: 0 },
        viewport: { width: 200, height: 100 },
        noticeSize: { width: 400, height: 80 },
      })
    ).toEqual({ top: 12, left: 8, width: 184 });
  });
});

describe("InputTranslator failure copy", () => {
  let originalResizeObserver;
  let translator;

  beforeAll(() => {
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
  });

  afterAll(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    mockUnregisterShortcut.mockClear();
    stepShortcutRegister.mockReturnValue(mockUnregisterShortcut);
    logger.error.mockClear();
    apiTranslate.mockReset();
    translator = new InputTranslator({
      uiLang: "zh",
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "test",
        fromLang: "auto",
        toLang: "zh-CN",
      },
      transApis: [{ apiSlug: "test" }],
    });
  });

  afterEach(() => {
    translator.disable();
    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  test("shows the connection-test network copy instead of the raw exception", async () => {
    const error = new TypeError("Failed to fetch");
    error.stack = "TypeError: Failed to fetch\n    at translate";
    apiTranslate.mockRejectedValueOnce(error);
    const target = prepareInput(translator);
    target.focus();

    await translator.handleTranslate({ isBtnTrigger: true });

    const notice = document.querySelector('[role="alert"]');
    expect(notice).not.toBeNull();
    expect(failureMessage()).toBe(I18N.test_connection_network.zh);
    expect(document.body.textContent).not.toContain("Failed to fetch");
    expect(document.body.textContent).not.toContain("TypeError");
    expect(document.body.textContent).not.toContain("at translate");
    expect(notice.style.position).toBe("fixed");
    expect(notice.style.visibility).toBe("visible");
    expect(logger.error).toHaveBeenCalledWith("Translate input error:", error);
    expect(target.value).toBe("Hello");
  });

  test("shows the connection-test http copy for a provider status error", async () => {
    apiTranslate.mockRejectedValueOnce(
      new Error(JSON.stringify({ status: 502, statusText: "Bad Gateway" }))
    );
    prepareInput(translator);

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(failureMessage()).toBe(I18N.test_connection_http.zh);
    expect(document.body.textContent).not.toContain("502");
    expect(document.body.textContent).not.toContain("Bad Gateway");
  });

  test("shows the connection-test invalid-key copy", async () => {
    apiTranslate.mockRejectedValueOnce(new Error("invalid api key"));
    prepareInput(translator);

    await translator.handleTranslate();

    expect(failureMessage()).toBe(I18N.test_connection_invalid_key.zh);
    expect(document.body.textContent).not.toContain("invalid api key");
  });

  test("shows service guidance when the request reports an unusable service", async () => {
    apiTranslate.mockRejectedValueOnce(new Error("genInit: url is empty"));
    prepareInput(translator);

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(apiTranslate).toHaveBeenCalledTimes(1);
    expect(failureMessage()).toBe(I18N.page_translate_service_unavailable.zh);
    expect(document.body.textContent).not.toContain("url is empty");
  });

  test.each([
    ["zh", I18N.page_translate_service_unavailable.zh],
    ["en", I18N.page_translate_service_unavailable.en],
  ])(
    "does not call the API when the selected input service is disabled (%s)",
    async (uiLang, copy) => {
      translator.disable();
      translator = new InputTranslator({
        uiLang,
        inputRule: {
          transOpen: true,
          triggerShortcut: ["AltLeft", "KeyI"],
          triggerCount: 1,
          triggerTime: 200,
          showDot: "always",
          apiSlug: "microsoft",
          fromLang: "auto",
          toLang: "zh-CN",
        },
        transApis: [
          {
            apiSlug: "microsoft",
            apiType: "Microsoft",
            url: "",
            isDisabled: true,
          },
        ],
      });
      apiTranslate.mockResolvedValue({
        trText: "你好，世界",
        isSame: false,
      });
      const target = prepareInput(translator, "Hello, world");

      await translator.handleTranslate({ isBtnTrigger: true });

      expect(apiTranslate).not.toHaveBeenCalled();
      expect(failureMessage()).toBe(copy);
      expect(target.value).toBe("Hello, world");
      expect(document.body.textContent).not.toContain("你好，世界");
      expect(document.body.textContent).not.toContain("translator is disabled");
    }
  );

  test("does not call the API when the resolved input service is disabled", async () => {
    apiTranslate.mockResolvedValue({ trText: "你好，世界", isSame: false });
    const target = prepareInput(translator, "Hello, world");
    resolveApiPromptSettings.mockReturnValue({
      apiSlug: "test",
      isDisabled: true,
    });

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(apiTranslate).not.toHaveBeenCalled();
    expect(failureMessage()).toBe(I18N.page_translate_service_unavailable.zh);
    expect(target.value).toBe("Hello, world");
  });

  test("does not call the API when the selected input service is missing", async () => {
    translator.disable();
    translator = new InputTranslator({
      uiLang: "zh",
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "microsoft",
      },
      transApis: [{ apiSlug: "google" }],
    });
    apiTranslate.mockResolvedValue({ trText: "你好，世界", isSame: false });
    const target = prepareInput(translator, "Hello, world");

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(apiTranslate).not.toHaveBeenCalled();
    expect(failureMessage()).toBe(I18N.page_translate_service_unavailable.zh);
    expect(target.value).toBe("Hello, world");
    expect(document.body.textContent).not.toContain("你好，世界");
  });

  test("shows an actionable input-box fallback in English for an unknown failure", async () => {
    translator.disable();
    translator = new InputTranslator({
      uiLang: "en",
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "always",
        apiSlug: "test",
      },
      transApis: [{ apiSlug: "test" }],
    });
    apiTranslate.mockRejectedValueOnce(
      new Error("translate got an unexpected result")
    );
    prepareInput(translator);

    await translator.handleTranslate({ isBtnTrigger: true });

    expect(failureMessage()).toBe(I18N.input_translate_failed.en);
    expect(document.body.textContent).not.toContain("unexpected result");
    expect(document.body.textContent).not.toContain(
      I18N.page_translate_failed.en
    );
    expect(document.body.textContent).not.toContain(
      I18N.hover_translate_failed.en
    );
    expect(document.body.textContent).not.toContain(
      I18N.selection_translate_failed.en
    );
  });

  test("dismisses the notice from the close control", async () => {
    apiTranslate.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const target = prepareInput(translator);

    await translator.handleTranslate({ isBtnTrigger: true });
    const notice = document.querySelector('[role="alert"]');
    const mouseDown = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    notice.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(target);

    notice.querySelector("button").click();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  test("clears the notice on its own", async () => {
    jest.useFakeTimers();
    apiTranslate.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    prepareInput(translator);

    await translator.handleTranslate({ isBtnTrigger: true });
    expect(failureMessage()).toBe(I18N.test_connection_network.zh);

    jest.advanceTimersByTime(INPUT_FAILURE_NOTICE_MS);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  test("keeps fill-back working and clears an earlier failure", async () => {
    apiTranslate.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const target = prepareInput(translator);
    await translator.handleTranslate({ isBtnTrigger: true });
    expect(failureMessage()).toBe(I18N.test_connection_network.zh);

    apiTranslate.mockResolvedValueOnce({
      trText: "你好",
      isSame: false,
    });
    await translator.handleTranslate({ isBtnTrigger: true });

    expect(target.value).toBe("你好");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).not.toContain(
      I18N.test_connection_network.zh
    );
  });

  test("moves the notice with the input", async () => {
    apiTranslate.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const target = prepareInput(translator);
    await translator.handleTranslate({ isBtnTrigger: true });
    const notice = document.querySelector('[role="alert"]');
    const before = notice.style.top;

    target.getBoundingClientRect = jest.fn(() =>
      makeRect({ top: 300, height: 30 })
    );
    translator.updateBtnPosition();

    expect(notice.style.top).not.toBe(before);
    expect(failureMessage()).toBe(I18N.test_connection_network.zh);
  });

  test("shows the failure copy when the float dot is turned off", async () => {
    translator.disable();
    translator = new InputTranslator({
      uiLang: "zh",
      inputRule: {
        transOpen: true,
        triggerShortcut: ["AltLeft", "KeyI"],
        triggerCount: 1,
        triggerTime: 200,
        showDot: "-",
        apiSlug: "test",
      },
      transApis: [{ apiSlug: "test" }],
    });
    const error = new TypeError("Failed to fetch");
    error.stack = "TypeError: Failed to fetch\n    at translate";
    apiTranslate.mockRejectedValueOnce(error);
    prepareInput(translator);

    await translator.handleTranslate();

    expect(
      Array.from(document.body.children).some(
        (node) => node.textContent === "译"
      )
    ).toBe(false);
    expect(failureMessage()).toBe(I18N.test_connection_network.zh);
    expect(document.body.textContent).not.toContain("Failed to fetch");
    expect(document.body.textContent).not.toContain("TypeError");
    expect(document.body.textContent).not.toContain("at translate");
  });
});

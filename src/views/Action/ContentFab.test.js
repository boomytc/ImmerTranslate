jest.mock("../../components/TouchTranslateControl", () => () => null);
/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import ContentFab from "./ContentFab";
import { configuredByokApis } from "../../libs/apiKey";
import {
  EVENT_KISS_INNER,
  MSG_OPEN_OPTIONS,
  MSG_OPEN_TRANBOX,
  MSG_POPUP_TOGGLE,
  MSG_SAVE_RULE,
  MSG_FAB_TOGGLE,
  MSG_TRANS_PUTRULE,
  MSG_TRANS_SET_MODEL,
  MSG_TRANS_CURRULE,
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_STYLE,
  MSG_TRANSBOX_TOGGLE,
  OPT_STYLE_LINE,
  OPT_STYLE_NONE,
} from "../../config";
import * as storageStateModule from "../../libs/storageState";
import { fetchModelCatalog } from "../../libs/modelList";
import { sendBgMsg } from "../../libs/msg";
import { getDomainOptions } from "../../libs/url";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockFabSetting = { transApis: [] };
let mockSiteRules = [];
const mockFabUpdateSetting = jest.fn();

jest.mock("../../hooks/Rules", () => ({
  useRules: () => ({ list: mockSiteRules, isLoading: false }),
}));
// Saving a site rule imports the rules module, which pulls these in.
jest.mock("../../libs/subRules", () => ({
  loadOrFetchSubRules: jest.fn(),
}));
jest.mock("../../libs/sync", () => ({
  trySyncRules: jest.fn(),
}));

jest.mock("../../libs/modelList", () => ({
  fetchModelCatalog: jest.fn(async () => ({
    models: ["deepseek-chat"],
    thinkingCapabilities: {},
  })),
}));

let mockIsVideoFullscreen = false;
let draggableProps = null;

jest.mock("../../hooks/Setting", () => ({
  SettingProvider: ({ children }) => children,
  useSetting: () => ({
    setting: mockFabSetting,
    updateSetting: mockFabUpdateSetting,
  }),
}));
jest.mock("../../hooks/M3Theme", () => ({
  __esModule: true,
  default: ({ children }) => {
    const React = require("react");
    return React.createElement("div", { className: "kt-m3-root" }, children);
  },
}));
jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));
jest.mock("../../hooks/WindowSize", () => ({
  __esModule: true,
  default: () => ({ w: 800, h: 600 }),
}));
jest.mock("../../hooks/useFullscreenDetect", () => ({
  useFullscreenDetect: () => ({ isVideoFullscreen: mockIsVideoFullscreen }),
}));
jest.mock("../../libs/client", () => ({ isExt: true }));
jest.mock("../../libs/msg", () => ({ sendBgMsg: jest.fn() }));

// Replace Draggable to access the FAB and menu directly.
// Keep onStart/onMove callable to simulate the click after a drag.
jest.mock("./Draggable", () => {
  const React = require("react");
  return function Draggable(props) {
    draggableProps = props;
    return React.createElement(
      "div",
      { "data-testid": "draggable" },
      props.handler,
      props.children
    );
  };
});

describe.each(["document", "shadow root"])("ContentFab in %s", (context) => {
  let container;
  let host;
  let focusRoot;
  let root;
  let processActions;
  let selectionEnabled;
  const getSelectionEnabled = () => selectionEnabled;

  beforeEach(() => {
    window.PointerEvent = MouseEvent;
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 2,
    });
    mockIsVideoFullscreen = false;
    draggableProps = null;
    mockFabSetting = { transApis: [] };
    mockSiteRules = [];
    mockFabUpdateSetting.mockReset();
    fetchModelCatalog.mockReset();
    fetchModelCatalog.mockResolvedValue({
      models: ["deepseek-chat"],
      thinkingCapabilities: {},
    });
    processActions = jest.fn();
    selectionEnabled = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    focusRoot =
      context === "shadow root"
        ? host.attachShadow({ mode: "open" })
        : document;
    container = document.createElement("div");
    (focusRoot === document ? host : focusRoot).appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    sendBgMsg.mockReset();
    jest.restoreAllMocks();
  });

  function render(fabConfig = {}) {
    act(() =>
      root.render(
        <ContentFab
          fabConfig={fabConfig}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
        />
      )
    );
  }

  const fab = () => container.querySelector(".kt-content-fab");
  const menuItems = () =>
    Array.from(container.querySelectorAll(".kt-content-fab-menu__item"));
  const clickFab = () => act(() => fab().click());
  const pressMenuKey = (key) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    act(() => focusRoot.activeElement.dispatchEvent(event));
    return event;
  };

  test("uses Material 3 regular FAB geometry for edge snapping", () => {
    render();

    expect(draggableProps).toEqual(
      expect.objectContaining({
        width: 56,
        height: 56,
        snapEdge: true,
        fitContent: true,
      })
    );
  });

  test("opens the action menu on click and lists every action", () => {
    render();
    expect(menuItems()).toHaveLength(0);
    expect(fab().getAttribute("aria-expanded")).toBe("false");
    const speedDialIcon = fab().querySelector(".MuiSpeedDialIcon-root");
    expect(fab().querySelectorAll(".MuiSpeedDialIcon-root svg")).toHaveLength(
      2
    );
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-iconOpen")
    ).toBeNull();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-openIconOpen")
    ).toBeNull();

    clickFab();

    expect(fab().getAttribute("aria-expanded")).toBe("true");
    expect(fab().id).toBe("kt-content-fab-button");
    expect(fab().getAttribute("aria-controls")).toBe("kt-content-fab-menu");
    const menu = container.querySelector("#kt-content-fab-menu");
    expect(menu.getAttribute("aria-labelledby")).toBe(fab().id);
    expect(menu.closest(".kt-m3-root")).not.toBeNull();
    expect(menu.getRootNode()).toBe(focusRoot);
    expect(focusRoot.activeElement).toBe(menuItems()[0]);
    if (context === "shadow root") {
      expect(document.activeElement).toBe(host);
    }
    expect(menuItems().map((item) => item.textContent)).toEqual([
      "popup_translate_page",
      "text_style_alt",
      "open_menu",
      "open_setting",
      "touch_paragraph",
    ]);
    expect(fab().querySelectorAll(".MuiSpeedDialIcon-root svg")).toHaveLength(
      2
    );
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-iconOpen")
    ).not.toBeNull();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-openIconOpen")
    ).not.toBeNull();
    expect(menuItems().every((item) => item.style.animationDelay === "")).toBe(
      true
    );

    clickFab();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-iconOpen")
    ).toBeNull();
    expect(
      speedDialIcon.querySelector(".MuiSpeedDialIcon-openIconOpen")
    ).toBeNull();
  });

  test.each([
    [0, MSG_TRANS_TOGGLE],
    [1, MSG_TRANS_TOGGLE_STYLE],
    [2, MSG_POPUP_TOGGLE],
  ])("menu item %i dispatches its action and closes", (index, action) => {
    render();
    clickFab();

    act(() => menuItems()[index].click());

    expect(processActions).toHaveBeenCalledWith({ action });
    expect(menuItems()).toHaveLength(0);
    expect(focusRoot.activeElement).toBe(fab());
  });

  test.each(["Escape", "Tab"])(
    "%s closes the menu, restores focus, and does not reach the host page",
    (key) => {
      render();
      clickFab();
      menuItems()[0].focus();
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      const onPageKeyDown = jest.fn();
      window.addEventListener("keydown", onPageKeyDown);

      try {
        act(() => menuItems()[0].dispatchEvent(event));

        expect(event.defaultPrevented).toBe(true);
        expect(menuItems()).toHaveLength(0);
        expect(focusRoot.activeElement).toBe(fab());
        expect(onPageKeyDown).not.toHaveBeenCalled();
      } finally {
        window.removeEventListener("keydown", onPageKeyDown);
      }
    }
  );

  test("moves focus with arrow keys, wraps, and supports Home and End", () => {
    render();
    clickFab();

    expect(pressMenuKey("ArrowDown").defaultPrevented).toBe(true);
    expect(focusRoot.activeElement).toBe(menuItems()[1]);
    pressMenuKey("ArrowDown");
    expect(focusRoot.activeElement).toBe(menuItems()[2]);
    pressMenuKey("ArrowUp");
    expect(focusRoot.activeElement).toBe(menuItems()[1]);
    expect(pressMenuKey("End").defaultPrevented).toBe(true);
    expect(focusRoot.activeElement).toBe(menuItems()[4]);
    pressMenuKey("ArrowDown");
    expect(focusRoot.activeElement).toBe(menuItems()[0]);
    pressMenuKey("ArrowUp");
    expect(focusRoot.activeElement).toBe(menuItems()[4]);
    expect(pressMenuKey("Home").defaultPrevented).toBe(true);
    expect(focusRoot.activeElement).toBe(menuItems()[0]);
    expect(processActions).not.toHaveBeenCalled();
  });

  test("cycles matching labels when the same character is typed repeatedly", () => {
    render();
    clickFab();

    expect(pressMenuKey("o").defaultPrevented).toBe(true);
    expect(focusRoot.activeElement).toBe(menuItems()[2]);
    pressMenuKey("o");
    expect(focusRoot.activeElement).toBe(menuItems()[3]);
    pressMenuKey("o");
    expect(focusRoot.activeElement).toBe(menuItems()[2]);
  });

  test("matches typed prefixes after the first character", () => {
    render();
    clickFab();

    for (const key of "open_s") {
      pressMenuKey(key);
    }

    expect(focusRoot.activeElement).toBe(menuItems()[3]);
    expect(processActions).not.toHaveBeenCalled();
  });

  test("resets typeahead when the menu is quickly closed and reopened", () => {
    jest.spyOn(performance, "now").mockReturnValue(1000);
    jest.spyOn(Date, "now").mockReturnValue(1000);
    render();
    clickFab();
    pressMenuKey("o");
    expect(focusRoot.activeElement).toBe(menuItems()[2]);

    pressMenuKey("Escape");
    clickFab();
    pressMenuKey("t");

    expect(focusRoot.activeElement).toBe(menuItems()[1]);
  });

  test("the settings item goes to the background, not through processActions", () => {
    render();
    clickFab();

    act(() => menuItems()[3].click());

    expect(sendBgMsg).toHaveBeenCalledWith(MSG_OPEN_OPTIONS);
    expect(processActions).not.toHaveBeenCalled();
    expect(menuItems()).toHaveLength(0);
  });

  // Preserve the existing direct-translation behavior of fabClickAction === 1.
  // The action menu must not add an extra click for users with this setting.
  test("fabClickAction=1 translates directly and never opens the menu", () => {
    render({ fabClickAction: 1 });

    expect(fab().getAttribute("aria-expanded")).toBeNull();
    expect(fab().getAttribute("aria-haspopup")).toBeNull();
    expect(fab().getAttribute("aria-controls")).toBeNull();
    expect(fab().querySelector(".MuiSpeedDialIcon-root")).toBeNull();
    expect(fab().querySelectorAll("svg")).toHaveLength(1);
    clickFab();

    expect(processActions).toHaveBeenCalledWith({ action: MSG_TRANS_TOGGLE });
    expect(menuItems()).toHaveLength(0);
    expect(draggableProps.expanded).toBe(false);
  });

  test("a drag suppresses the click that ends it", () => {
    render();

    act(() => {
      draggableProps.onStart();
      draggableProps.onMove();
    });
    clickFab();

    expect(processActions).not.toHaveBeenCalled();
    expect(menuItems()).toHaveLength(0);
  });

  test.each([
    { x: -28, y: 0, edge: "left" },
    { x: 772, y: 544, edge: "right" },
    { x: 744, y: -28, edge: "top" },
    { x: 0, y: 572, edge: "bottom" },
  ])("closes an open menu when dragged from $edge", (fabConfig) => {
    render(fabConfig);
    clickFab();
    expect(draggableProps.expanded).toBe(true);

    act(() => draggableProps.onStart());
    expect(menuItems()).toHaveLength(5);
    act(() => draggableProps.onMove());

    expect(menuItems()).toHaveLength(0);
    expect(draggableProps.expanded).toBe(false);
    expect(focusRoot.activeElement).toBe(fab());
    clickFab();
    expect(menuItems()).toHaveLength(0);
    expect(processActions).not.toHaveBeenCalled();

    act(() => draggableProps.onStart());
    clickFab();
    expect(menuItems()).toHaveLength(5);
    expect(draggableProps.expanded).toBe(true);
  });

  test("pressing an open FAB without moving still toggles the menu closed", () => {
    render();
    clickFab();

    act(() => draggableProps.onStart());
    clickFab();

    expect(menuItems()).toHaveLength(0);
    expect(processActions).not.toHaveBeenCalled();
  });

  test("switches bilingual mode and the active engine model without leaving the menu", async () => {
    const secret = "sk-deepseek-secret";
    mockFabSetting = {
      transApis: [
        {
          apiSlug: "deepseek",
          apiType: "DeepSeek",
          apiName: "DeepSeek",
          url: "https://api.deepseek.com/chat/completions",
          modelListUrl: "https://api.deepseek.com/models",
          key: secret,
          model: "deepseek-v4-flash",
        },
      ],
    };
    const getFabPageState = jest.fn(async () => ({
      rule: { apiSlug: "deepseek", transOnly: "false" },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    const modeSelect = container.querySelector(
      ".kt-content-fab-menu__mode-select"
    );
    expect(modeSelect.value).toBe("bilingual");
    act(() => {
      modeSelect.value = "trans_only";
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_PUTRULE,
      args: { transOnly: "true" },
    });
    expect(container.querySelector(".kt-content-fab-menu")).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
    });
    const modelSelect = container.querySelector(".kt-content-fab-menu__model");
    expect(
      Array.from(modelSelect.options).map((option) => option.value)
    ).toEqual(expect.arrayContaining(["deepseek-v4-flash", "deepseek-chat"]));
    expect(fetchModelCatalog).toHaveBeenCalledWith({
      apiType: "DeepSeek",
      modelListUrl: "https://api.deepseek.com/models",
      key: secret,
    });
    expect(container.textContent).not.toContain(secret);

    modelSelect.value = "deepseek-chat";
    await act(async () => {
      modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_SET_MODEL,
      args: { apiSlug: "deepseek", model: "deepseek-chat" },
    });
    expect(mockFabUpdateSetting).toHaveBeenCalledTimes(1);
    const saved = mockFabUpdateSetting.mock.calls[0][0]({
      transApis: mockFabSetting.transApis,
    });
    expect(saved.transApis[0].model).toBe("deepseek-chat");
    expect(saved.transApis[0].key).toBe(secret);
  });

  test("switches textStyle from FabQuickOptions and syncs palette button pressed state", async () => {
    const getFabPageState = jest.fn(async () => ({
      rule: { textStyle: OPT_STYLE_NONE },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    const paletteItem = menuItems()[1];
    expect(paletteItem.getAttribute("aria-pressed")).toBe("false");

    const styleSelect = container.querySelector(
      ".kt-content-fab-menu__style-select"
    );
    expect(styleSelect).not.toBeNull();
    expect(styleSelect.value).toBe(OPT_STYLE_NONE);

    act(() => {
      styleSelect.value = OPT_STYLE_LINE;
      styleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_PUTRULE,
      args: { textStyle: OPT_STYLE_LINE },
    });
    expect(paletteItem.getAttribute("aria-pressed")).toBe("true");

    // Test bidirectional sync from MSG_TRANS_CURRULE
    act(() => {
      document.dispatchEvent(
        new CustomEvent(EVENT_KISS_INNER, {
          detail: {
            action: MSG_TRANS_CURRULE,
            rule: { textStyle: OPT_STYLE_NONE },
          },
        })
      );
    });

    expect(styleSelect.value).toBe(OPT_STYLE_NONE);
    expect(paletteItem.getAttribute("aria-pressed")).toBe("false");
  });

  test("switches the page translator among configured services", async () => {
    mockFabSetting = {
      transApis: [
        {
          apiSlug: "Microsoft",
          apiType: "Microsoft",
          apiName: "Microsoft",
          key: "",
          isDisabled: false,
          sortOrder: 0,
        },
        {
          apiSlug: "OpenAI",
          apiType: "OpenAI",
          apiName: "OpenAI",
          key: "  ",
          model: "gpt-4o-mini",
          isDisabled: false,
          sortOrder: 1,
        },
        {
          apiSlug: "DeepSeek",
          apiType: "DeepSeek",
          apiName: "DeepSeek",
          url: "https://api.deepseek.com/chat/completions",
          key: "sk-deepseek-secret",
          model: "deepseek-chat",
          isDisabled: false,
          sortOrder: 3,
        },
        {
          apiSlug: "Custom_1",
          apiType: "Custom",
          apiName: "My Proxy",
          key: "sk-custom-secret",
          model: "local-model",
          isDisabled: false,
          sortOrder: 2,
        },
        {
          apiSlug: "Claude",
          apiType: "Claude",
          apiName: "Claude",
          key: "sk-claude-secret",
          isDisabled: true,
          sortOrder: 4,
        },
        {
          apiSlug: "Google",
          apiType: "Google",
          apiName: "Google",
          key: "",
          isDisabled: true,
          sortOrder: 5,
        },
      ],
    };
    const getFabPageState = jest.fn(async () => ({
      rule: { apiSlug: "Microsoft", transOnly: "false" },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    const serviceSelect = container.querySelector(
      ".kt-content-fab-menu__service-select"
    );
    expect(container.querySelector("#kt-fab-service-label").textContent).toBe(
      "translate_service"
    );
    expect(
      Array.from(serviceSelect.options).map((option) => option.textContent)
    ).toEqual(["Microsoft", "My Proxy", "DeepSeek"]);
    expect(serviceSelect.value).toBe("Microsoft");
    expect(
      container.querySelectorAll(".kt-content-fab-menu__model")
    ).toHaveLength(0);
    expect(container.textContent).not.toContain("sk-deepseek-secret");
    expect(container.textContent).not.toContain("sk-custom-secret");
    expect(container.textContent).not.toContain("sk-claude-secret");

    await act(async () => {
      serviceSelect.value = "DeepSeek";
      serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_PUTRULE,
      args: { apiSlug: "DeepSeek" },
    });
    expect(processActions).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: MSG_TRANS_SET_MODEL })
    );
    expect(mockFabUpdateSetting).not.toHaveBeenCalled();
    expect(serviceSelect.value).toBe("DeepSeek");
    expect(container.querySelector(".kt-content-fab-menu")).not.toBeNull();
    expect(
      container.querySelectorAll(".kt-content-fab-menu__model")
    ).toHaveLength(1);

    processActions.mockClear();
    await act(async () => {
      serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(processActions).not.toHaveBeenCalled();

    await act(async () => {
      serviceSelect.value = "Custom_1";
      serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_PUTRULE,
      args: { apiSlug: "Custom_1" },
    });
    expect(serviceSelect.value).toBe("Custom_1");
  });

  test("shows an empty service state when no enabled provider can be used", async () => {
    mockFabSetting = {
      transApis: [
        {
          apiSlug: "OpenAI",
          apiType: "OpenAI",
          apiName: "OpenAI",
          key: "  ",
          isDisabled: false,
        },
        {
          apiSlug: "DeepSeek",
          apiType: "DeepSeek",
          apiName: "DeepSeek",
          key: "",
          isDisabled: false,
        },
        {
          apiSlug: "Google",
          apiType: "Google",
          apiName: "Google",
          key: "",
          isDisabled: true,
        },
      ],
    };
    const getFabPageState = jest.fn(async () => ({
      rule: { apiSlug: "unused", transOnly: "false" },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector("#kt-fab-service-label").textContent).toBe(
      "translate_service"
    );
    expect(
      container.querySelector(".kt-content-fab-menu__services")
    ).toBeNull();
    const empty = container.querySelector(".kt-content-fab-menu__empty");
    expect(empty.textContent).toContain("fab_no_keyed_provider");
    expect(empty.textContent).not.toContain("missing_api_key_empty");
    expect(container.textContent).not.toContain("OpenAI");

    act(() => empty.querySelector("button").click());
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_OPEN_OPTIONS, { hash: "/apis" });
    expect(sendBgMsg).not.toHaveBeenCalledWith(MSG_OPEN_OPTIONS);
  });

  test("shows the current service empty state when its key is blank", async () => {
    mockFabSetting = {
      transApis: [
        {
          apiSlug: "DeepSeek",
          apiType: "DeepSeek",
          apiName: "DeepSeek",
          key: "",
          isDisabled: false,
        },
        {
          apiSlug: "OpenAI",
          apiType: "OpenAI",
          apiName: "OpenAI",
          key: "sk-openai-secret",
          isDisabled: false,
        },
      ],
    };
    const getFabPageState = jest.fn(async () => ({
      rule: { apiSlug: "DeepSeek", transOnly: "false" },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    const empty = container.querySelector(".kt-content-fab-menu__empty");
    expect(empty.textContent).toContain("missing_api_key_empty");
    const serviceSelect = container.querySelector(
      ".kt-content-fab-menu__service-select"
    );
    expect(
      Array.from(serviceSelect.options).map((option) => option.textContent)
    ).toEqual(["OpenAI"]);
    expect(container.textContent).not.toContain("sk-openai-secret");

    sendBgMsg.mockClear();
    act(() => empty.querySelector("button").click());
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_OPEN_OPTIONS, { hash: "/apis" });
  });

  test("persists the current site transOpen from the FAB menu", async () => {
    const pattern = getDomainOptions(window.location.href)[0];
    mockSiteRules = [{ pattern, selector: "article", transOpen: "false" }];
    const getFabPageState = jest.fn(async () => ({
      rule: { apiSlug: "microsoft", transOnly: "false" },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    const siteSelect = container.querySelector(
      ".kt-content-fab-menu__site-select"
    );
    expect(
      Array.from(siteSelect.options).map((option) => option.textContent)
    ).toEqual(["site_trans_follow", "site_trans_on", "site_trans_off"]);
    expect(siteSelect.value).toBe("false");

    await act(async () => {
      siteSelect.value = "*";
      siteSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_SAVE_RULE, {
      pattern,
      transOpen: "*",
    });
    expect(processActions).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: MSG_TRANS_PUTRULE })
    );
    expect(siteSelect.value).toBe("*");
    expect(container.querySelector(".kt-content-fab-menu")).not.toBeNull();

    sendBgMsg.mockClear();
    await act(async () => {
      siteSelect.value = "false";
      siteSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_SAVE_RULE, {
      pattern,
      transOpen: "false",
    });
    expect(siteSelect.value).toBe("false");
  });

  test("follows a popup rule and writes the target language back", async () => {
    mockFabSetting = {
      transApis: [
        {
          apiSlug: "DeepSeek",
          apiType: "DeepSeek",
          apiName: "DeepSeek",
          key: "sk-deepseek-secret",
          model: "deepseek-chat",
          isDisabled: false,
        },
        {
          apiSlug: "Microsoft",
          apiType: "Microsoft",
          apiName: "Microsoft",
          key: "ms-key",
          isDisabled: false,
        },
      ],
    };
    const getFabPageState = jest.fn(async () => ({
      rule: {
        apiSlug: "Microsoft",
        transOnly: "false",
        transOpen: "false",
        toLang: "zh-CN",
      },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const lang = container.querySelector('[aria-label="to_lang"]');
    expect(lang.value).toBe("zh-CN");
    expect(
      container
        .querySelector(".kt-content-fab-menu__item")
        .getAttribute("aria-pressed")
    ).toBe("false");

    act(() => {
      document.dispatchEvent(
        new CustomEvent(EVENT_KISS_INNER, {
          detail: {
            action: MSG_TRANS_CURRULE,
            rule: {
              apiSlug: "DeepSeek",
              transOnly: "true",
              transOpen: "true",
              toLang: "fr",
            },
          },
        })
      );
    });

    const serviceSelect = container.querySelector(
      ".kt-content-fab-menu__service-select"
    );
    expect(serviceSelect.value).toBe("DeepSeek");
    const modeSelect = container.querySelector(
      ".kt-content-fab-menu__mode-select"
    );
    expect(modeSelect.value).toBe("trans_only");
    expect(lang.value).toBe("fr");
    expect(
      container
        .querySelector(".kt-content-fab-menu__item")
        .getAttribute("aria-pressed")
    ).toBe("true");

    lang.value = "ja";
    await act(async () => {
      lang.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_PUTRULE,
      args: { toLang: "ja" },
    });
    expect(container.querySelector(".kt-content-fab-menu")).not.toBeNull();
  });

  test("aligns page translation when the current site policy changes", async () => {
    const pattern = getDomainOptions(window.location.href)[0];
    mockSiteRules = [
      { pattern: "*", transOpen: "false" },
      { pattern, transOpen: "*" },
    ];
    const getFabPageState = jest.fn(async () => ({
      rule: { apiSlug: "microsoft", transOnly: "false", transOpen: "true" },
    }));
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    clickFab();
    await act(async () => {
      await Promise.resolve();
    });

    const siteSelect = () =>
      container.querySelector(".kt-content-fab-menu__site-select");
    expect(siteSelect().value).toBe("*");

    await act(async () => {
      siteSelect().value = "false";
      siteSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_SAVE_RULE, {
      pattern,
      transOpen: "false",
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_TOGGLE,
      args: { enabled: false, persistSite: true },
    });

    processActions.mockClear();
    sendBgMsg.mockClear();
    mockSiteRules = [
      { pattern: "*", transOpen: "false" },
      { pattern, transOpen: "false" },
    ];
    act(() =>
      root.render(
        <ContentFab
          fabConfig={{}}
          processActions={processActions}
          getSelectionEnabled={getSelectionEnabled}
          getFabPageState={getFabPageState}
        />
      )
    );
    await act(async () => {
      siteSelect().value = "*";
      siteSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_SAVE_RULE, {
      pattern,
      transOpen: "*",
    });
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_TRANS_TOGGLE,
      args: { enabled: false, persistSite: false },
    });
  });

  // Video fullscreen hides the FAB, so its menu must close too.
  // Otherwise an unreachable, undismissable panel remains over the video.
  test("entering video fullscreen closes an open menu", () => {
    render();
    clickFab();
    expect(menuItems()).toHaveLength(5);

    mockIsVideoFullscreen = true;
    act(() =>
      root.render(<ContentFab fabConfig={{}} processActions={processActions} />)
    );

    expect(menuItems()).toHaveLength(0);
  });

  test("clicking hide on site button hides FAB, saves to storage, and allows undo", async () => {
    let savedUpdater = null;
    let undoUpdater = null;
    let stored = { isHide: false, hideExceptionList: "" };
    const mockSave = jest.fn((updater) => {
      if (!savedUpdater) {
        savedUpdater = updater;
      } else {
        undoUpdater = updater;
      }
      stored = updater(stored);
      return Promise.resolve({ value: stored });
    });
    const mockSubscribe = jest.fn(() => () => {});
    const spy = jest
      .spyOn(storageStateModule, "getStorageState")
      .mockReturnValue({
        save: mockSave,
        subscribe: mockSubscribe,
        snapshot: { data: { isHide: false, hideExceptionList: "" } },
      });

    render();
    clickFab();
    const hideBtn = container.querySelector(
      ".kt-content-fab-menu__mode--hide-fab"
    );
    expect(hideBtn).not.toBeNull();
    expect(hideBtn.textContent).toBe("hide_fab_on_site");

    await act(async () => {
      hideBtn.click();
    });

    expect(draggableProps.show).toBe(false);
    expect(mockSave).toHaveBeenCalledTimes(1);
    const domain = window.location.hostname;
    const hideResult = savedUpdater({ isHide: false, hideExceptionList: "" });
    expect(hideResult.hideExceptionList).toContain(domain);

    const undoBtn = container.querySelector(".kt-fab-undo-btn");
    expect(undoBtn).not.toBeNull();
    expect(undoBtn.textContent).toBe("fab_undo");

    await act(async () => {
      undoBtn.click();
    });

    expect(draggableProps.show).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(2);
    const undoResult = undoUpdater({
      isHide: false,
      hideExceptionList: domain,
    });
    expect(undoResult.hideExceptionList).not.toContain(domain);
    expect(processActions).toHaveBeenLastCalledWith({
      action: MSG_FAB_TOGGLE,
      args: {
        enabled: true,
        fabConfig: expect.objectContaining({
          hideExceptionList: expect.not.stringContaining(domain),
        }),
      },
    });
    spy.mockRestore();
  });

  test("when undo timer expires after 4500ms, sends MSG_FAB_TOGGLE to destroy DOM", async () => {
    jest.useFakeTimers();
    const mockSave = jest.fn((updater) =>
      Promise.resolve({
        value: updater({ isHide: false, hideExceptionList: "" }),
      })
    );
    const mockSubscribe = jest.fn(() => () => {});
    const spy = jest
      .spyOn(storageStateModule, "getStorageState")
      .mockReturnValue({
        save: mockSave,
        subscribe: mockSubscribe,
        snapshot: { data: { isHide: false, hideExceptionList: "" } },
      });

    render();
    clickFab();
    const hideBtn = container.querySelector(
      ".kt-content-fab-menu__mode--hide-fab"
    );

    await act(async () => {
      hideBtn.click();
    });

    expect(draggableProps.show).toBe(false);
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_FAB_TOGGLE,
      args: {
        enabled: true,
        fabConfig: expect.objectContaining({
          isHide: false,
          hideExceptionList: expect.stringContaining(window.location.hostname),
        }),
      },
    });

    act(() => {
      jest.advanceTimersByTime(4500);
    });

    expect(processActions).toHaveBeenLastCalledWith({
      action: MSG_FAB_TOGGLE,
      args: {
        enabled: false,
        fabConfig: expect.objectContaining({
          isHide: false,
          hideExceptionList: expect.stringContaining(window.location.hostname),
        }),
      },
    });

    jest.useRealTimers();
    spy.mockRestore();
  });

  test("when global is hidden (isHide: true) on a site exception, clicking hide on site removes site from exception list", async () => {
    let savedUpdater = null;
    let undoUpdater = null;
    let stored = { isHide: true, hideExceptionList: "localhost" };
    const mockSave = jest.fn((updater) => {
      if (!savedUpdater) savedUpdater = updater;
      else undoUpdater = updater;
      stored = updater(stored);
      return Promise.resolve({ value: stored });
    });
    const mockSubscribe = jest.fn(() => () => {});
    const spy = jest
      .spyOn(storageStateModule, "getStorageState")
      .mockReturnValue({
        save: mockSave,
        subscribe: mockSubscribe,
        snapshot: { data: { isHide: true, hideExceptionList: "localhost" } },
      });

    render();
    clickFab();
    const hideBtn = container.querySelector(
      ".kt-content-fab-menu__mode--hide-fab"
    );

    await act(async () => {
      hideBtn.click();
    });

    expect(draggableProps.show).toBe(false);
    const domain = window.location.hostname;
    const hideResult = savedUpdater({
      isHide: true,
      hideExceptionList: domain,
    });
    expect(hideResult.hideExceptionList).not.toContain(domain);

    const undoBtn = container.querySelector(".kt-fab-undo-btn");
    await act(async () => {
      undoBtn.click();
    });

    expect(draggableProps.show).toBe(true);
    const undoResult = undoUpdater({
      isHide: true,
      hideExceptionList: "",
    });
    expect(undoResult.hideExceptionList).toContain(domain);
    expect(processActions).toHaveBeenLastCalledWith({
      action: MSG_FAB_TOGGLE,
      args: {
        enabled: true,
        fabConfig: expect.objectContaining({
          isHide: true,
          hideExceptionList: expect.stringContaining(domain),
        }),
      },
    });
    spy.mockRestore();
  });

  test("external storage update making FAB visible cancels timer and restores FAB", async () => {
    let subscribeCallback = null;
    const mockSave = jest.fn(() => Promise.resolve());
    const mockSubscribe = jest.fn((cb) => {
      subscribeCallback = cb;
      return () => {};
    });
    const spy = jest
      .spyOn(storageStateModule, "getStorageState")
      .mockReturnValue({
        save: mockSave,
        subscribe: mockSubscribe,
        snapshot: { data: { isHide: false, hideExceptionList: "" } },
      });

    render();
    clickFab();
    const hideBtn = container.querySelector(
      ".kt-content-fab-menu__mode--hide-fab"
    );

    await act(async () => {
      hideBtn.click();
    });

    expect(draggableProps.show).toBe(false);
    expect(subscribeCallback).not.toBeNull();

    // 1. Initial snapshot confirms hidden:
    act(() => {
      subscribeCallback({
        data: { isHide: false, hideExceptionList: window.location.hostname },
      });
    });
    expect(draggableProps.show).toBe(false);

    // A pending write is only a preview; keep the confirmed hidden state.
    act(() => {
      subscribeCallback({
        data: { isHide: false, hideExceptionList: "" },
        isSaving: true,
      });
    });
    expect(draggableProps.show).toBe(false);
    expect(container.querySelector(".kt-fab-undo-btn")).not.toBeNull();

    // 2. External change in popup removes domain from exception list -> visible again!
    act(() => {
      subscribeCallback({
        data: { isHide: false, hideExceptionList: "" },
      });
    });

    // FAB restored and undo snackbar dismissed!
    expect(draggableProps.show).toBe(true);
    expect(container.querySelector(".kt-fab-undo-btn")).toBeNull();
    spy.mockRestore();
  });

  test("undo restores a removed wildcard exception without losing unrelated edits", async () => {
    let stored = { isHide: true, hideExceptionList: "*\nother.example" };
    jest.spyOn(storageStateModule, "getStorageState").mockReturnValue({
      save: jest.fn((updater) => {
        stored = updater(stored);
        return Promise.resolve({ value: stored });
      }),
      subscribe: jest.fn(() => () => {}),
    });

    render(stored);
    clickFab();
    await act(async () => {
      container.querySelector(".kt-content-fab-menu__mode--hide-fab").click();
    });
    expect(stored.hideExceptionList).toBe("other.example");

    stored = { ...stored, hideExceptionList: "other.example\nadded.example" };
    await act(async () => {
      container.querySelector(".kt-fab-undo-btn").click();
    });
    expect(stored.hideExceptionList.split("\n").sort()).toEqual(
      ["*", "other.example", "added.example"].sort()
    );
  });

  test("a rejected site hide keeps the FAB available and does not schedule destruction", async () => {
    jest.useFakeTimers();
    jest.spyOn(storageStateModule, "getStorageState").mockReturnValue({
      save: jest.fn().mockRejectedValue(new Error("storage unavailable")),
      subscribe: jest.fn(() => () => {}),
    });

    try {
      render();
      clickFab();
      await act(async () => {
        container.querySelector(".kt-content-fab-menu__mode--hide-fab").click();
      });

      expect(draggableProps.show).toBe(true);
      expect(container.querySelector(".kt-fab-undo-btn")).toBeNull();
      act(() => jest.advanceTimersByTime(4500));
      expect(processActions).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: MSG_FAB_TOGGLE })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("a rejected undo keeps the restoration available for retry", async () => {
    let stored = { isHide: true, hideExceptionList: "*\nother.example" };
    const save = jest.fn((updater) => {
      stored = updater(stored);
      return Promise.resolve({ value: stored });
    });
    jest.spyOn(storageStateModule, "getStorageState").mockReturnValue({
      save,
      subscribe: jest.fn(() => () => {}),
    });

    render(stored);
    clickFab();
    await act(async () => {
      container.querySelector(".kt-content-fab-menu__mode--hide-fab").click();
    });

    save.mockRejectedValueOnce(new Error("storage unavailable"));
    await act(async () => {
      container.querySelector(".kt-fab-undo-btn").click();
    });
    expect(draggableProps.show).toBe(false);
    expect(
      container.querySelector(".kt-fab-undo-snackbar").textContent
    ).toContain("error_got_some_wrong");

    await act(async () => {
      container.querySelector(".kt-fab-undo-btn").click();
    });
    expect(draggableProps.show).toBe(true);
    expect(stored.hideExceptionList.split("\n").sort()).toEqual(
      ["*", "other.example"].sort()
    );
  });

  test("renders size presets and updates button size when clicked", async () => {
    let stored = { size: 56 };
    const save = jest.fn(async (updater) => {
      stored = typeof updater === "function" ? updater(stored) : updater;
      return { value: stored };
    });
    jest.spyOn(storageStateModule, "getStorageState").mockReturnValue({
      save,
      subscribe: () => () => {},
    });

    render({ size: 56 });
    clickFab();

    const heroItem = container.querySelector(
      ".kt-content-fab-menu__item--hero"
    );
    expect(heroItem).not.toBeNull();
    expect(heroItem.textContent).toBe("popup_translate_page");

    const sizeSelect = container.querySelector(
      ".kt-content-fab-menu__size-select"
    );
    expect(sizeSelect).not.toBeNull();
    expect(sizeSelect.value).toBe("56");

    await act(async () => {
      sizeSelect.value = "36";
      sizeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(sizeSelect.value).toBe("36");
    expect(processActions).toHaveBeenCalledWith({
      action: MSG_FAB_TOGGLE,
      args: { fabConfig: { size: 36 } },
    });
    expect(stored.size).toBe(36);
  });
});

describe("configuredByokApis", () => {
  test("includes an enabled keyless engine with an empty key", () => {
    const list = configuredByokApis([
      {
        apiSlug: "Microsoft",
        apiType: "Microsoft",
        key: "",
        isDisabled: false,
        sortOrder: 2,
      },
      {
        apiSlug: "DeepSeek",
        apiType: "DeepSeek",
        key: "sk-deepseek",
        isDisabled: false,
        sortOrder: 1,
      },
    ]);

    expect(list.map((api) => api.apiSlug)).toEqual(["DeepSeek", "Microsoft"]);
  });

  test("excludes a key-required engine with an empty key", () => {
    const list = configuredByokApis([
      {
        apiSlug: "OpenAI",
        apiType: "OpenAI",
        key: "  ",
        isDisabled: false,
        sortOrder: 0,
      },
    ]);

    expect(list).toEqual([]);
  });

  test("excludes a disabled keyless engine", () => {
    const list = configuredByokApis([
      {
        apiSlug: "Google",
        apiType: "Google",
        key: "",
        isDisabled: true,
        sortOrder: 0,
      },
      {
        apiSlug: "BuiltinAI",
        apiType: "BuiltinAI",
        key: "",
        isDisabled: false,
        sortOrder: 1,
      },
    ]);

    expect(list.map((api) => api.apiSlug)).toEqual(["BuiltinAI"]);
  });
});

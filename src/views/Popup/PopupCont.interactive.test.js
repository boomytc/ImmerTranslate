/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PopupCont from "./PopupCont";
import {
  DEFAULT_RULES,
  GLOBAL_KEY,
  MSG_FAB_TOGGLE,
  MSG_TRANS_SET_MODEL,
  MSG_TRANS_TOGGLE,
  STOKEY_FAB,
  STOKEY_RULES,
} from "../../config";
import { DEFAULT_FAB } from "../../config/fab";
import * as storageStateModule from "../../libs/storageState";
import { getStorageState } from "../../libs/storageState";
import { saveRule } from "../../libs/rules";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

let mockContextSetting = { blacklist: "" };
const mockUpdateSetting = jest.fn();
jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: mockContextSetting,
    updateSetting: mockUpdateSetting,
  }),
}));

const mockStyles = [
  { styleSlug: "style_1", styleName: "Style 1" },
  { styleSlug: "style_2", styleName: "Style 2" },
];
jest.mock("../../hooks/CustomStyles", () => ({
  ...jest.requireActual("../../hooks/CustomStyles"),
  useAllTextStyles: () => ({ allTextStyles: mockStyles }),
}));

jest.mock("@emotion/react", () => ({
  ...jest.requireActual("@emotion/react"),
  ClassNames: ({ children }) => children({ css: () => "mock-css" }),
}));

const mockGetCurTab = jest.fn(async () => ({
  url: "https://example.com/test",
}));
const mockSendTopFrameMsg = jest.fn(async () => undefined);
const mockSendTabMsg = jest.fn(async () => undefined);
const mockSendBgMsg = jest.fn(async () => ({}));
jest.mock("../../libs/msg", () => ({
  getCurTab: (...args) => mockGetCurTab(...args),
  sendBgMsg: (...args) => mockSendBgMsg(...args),
  sendTabMsg: (...args) => mockSendTabMsg(...args),
  sendTopFrameMsg: (...args) => mockSendTopFrameMsg(...args),
}));

jest.mock("../../libs/rules", () => ({
  saveRule: jest.fn(async () => ({})),
}));

jest.mock("../../libs/sync", () => ({
  syncData: jest.fn(),
}));

jest.mock("../../libs/modelList", () => ({
  fetchModelCatalog: jest.fn(async () => ({
    models: ["gpt-4o", "gpt-4o-mini", "custom-model"],
  })),
}));

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function renderPopup(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const baseSetting = {
    transApis: [
      {
        apiSlug: "openai",
        apiName: "OpenAI",
        apiType: "OpenAI",
        model: "gpt-4o",
        url: "https://api.openai.com/v1",
        key: "sk-test",
      },
      {
        apiSlug: "qwenmt",
        apiName: "Qwen MT",
        apiType: "QwenMT",
        model: "qwen-mt-flash",
      },
      {
        apiSlug: "google",
        apiName: "Google",
        apiType: "Google",
      },
    ],
    tranboxSetting: { transOpen: true },
    mouseHoverSetting: { useMouseHover: false },
    inputRule: { transOpen: true },
    shortcuts: { toggleTranslate: ["AltLeft", "KeyQ"] },
  };

  const baseRule = {
    transOpen: "true",
    apiSlug: "openai",
    fromLang: "auto",
    toLang: "zh-CN",
    textStyle: "style_1",
    autoScan: "true",
    transOnly: "false",
    hasRichText: "true",
    scanAll: "false",
    isPlainText: false,
  };

  const defaultProps = {
    rule: baseRule,
    setting: baseSetting,
    setRule: jest.fn(),
    handleOpenSetting: jest.fn(),
    processActions: jest.fn(async () => ({ ok: true })),
    targetTab: { id: 1, url: "https://example.com/page" },
    documentInfo: { frameId: 0, token: "doc-1" },
    ...props,
  };

  act(() => {
    root.render(<PopupCont {...defaultProps} />);
  });

  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
    props: defaultProps,
  };
}

describe("PopupCont Extensions: Model Switcher, FAB Controls, Site Policy, and Footer", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetCurTab.mockResolvedValue({ url: "https://example.com/test" });
    mockContextSetting = { blacklist: "" };
    const fabState = getStorageState(STOKEY_FAB, DEFAULT_FAB);
    await fabState.save({
      ...DEFAULT_FAB,
      isHide: false,
      hideExceptionList: "",
    });
  });

  describe("AI Model Switcher", () => {
    test("renders model select when active service is an AI service", async () => {
      const view = renderPopup();
      await flushEffects();

      const modelSelect = view.container.querySelector(
        ".kt-popup-model-select"
      );
      expect(modelSelect).not.toBeNull();
      expect(modelSelect.value).toBe("gpt-4o");
      expect(modelSelect.title).toBe("gpt-4o");

      const options = Array.from(modelSelect.querySelectorAll("option"));
      options.forEach((opt) => {
        expect(opt.title).toBe(opt.value);
      });

      view.cleanup();
    });

    test("does not render model select when active service is not AI", async () => {
      const view = renderPopup({
        rule: {
          transOpen: "true",
          apiSlug: "google",
          fromLang: "auto",
          toLang: "zh-CN",
        },
      });
      await flushEffects();

      const modelSelect = view.container.querySelector(
        ".kt-popup-model-select"
      );
      expect(modelSelect).toBeNull();

      view.cleanup();
    });

    test("switching model triggers MSG_TRANS_SET_MODEL and updates settings", async () => {
      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({
        processActions,
        rule: {
          transOpen: "true",
          apiSlug: "qwenmt",
          fromLang: "auto",
          toLang: "zh-CN",
        },
      });
      await flushEffects();

      const modelSelect = view.container.querySelector(
        ".kt-popup-model-select"
      );
      expect(modelSelect).not.toBeNull();
      expect(modelSelect.value).toBe("qwen-mt-flash");

      await act(async () => {
        modelSelect.value = "qwen-mt-plus";
        modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_TRANS_SET_MODEL,
        args: { apiSlug: "qwenmt", model: "qwen-mt-plus" },
      });
      expect(mockUpdateSetting).toHaveBeenCalled();

      view.cleanup();
    });
  });

  describe("Floating Action Button (FAB) Controls", () => {
    test("renders FAB control section with global switch and site exception button", async () => {
      const view = renderPopup();
      await flushEffects();

      const fabControl = view.container.querySelector(".kt-popup-fab-control");
      expect(fabControl).not.toBeNull();

      const globalSwitch = fabControl.querySelector(
        ".kt-popup-fab-control__global input[type='checkbox']"
      );
      expect(globalSwitch).not.toBeNull();
      expect(globalSwitch.checked).toBe(true);

      const siteBtn = fabControl.querySelector(
        ".kt-popup-fab-control__site-btn"
      );
      expect(siteBtn).not.toBeNull();
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      view.cleanup();
    });

    test("toggling global switch updates fab config and sends MSG_FAB_TOGGLE", async () => {
      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({ processActions });
      await flushEffects();

      const fabControl = view.container.querySelector(".kt-popup-fab-control");
      const globalSwitch = fabControl.querySelector(
        ".kt-popup-fab-control__global input[type='checkbox']"
      );

      await act(async () => {
        globalSwitch.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          enabled: false,
          fabConfig: expect.objectContaining({ isHide: true }),
        }),
      });

      view.cleanup();
    });

    test("clicking site exception button adds domain to hideExceptionList and updates button text", async () => {
      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({ processActions });
      await flushEffects();

      const siteBtn = view.container.querySelector(
        ".kt-popup-fab-control__site-btn"
      );
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      await act(async () => {
        siteBtn.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          enabled: false,
          fabConfig: expect.objectContaining({
            hideExceptionList: expect.stringContaining("example.com"),
          }),
        }),
      });

      // After adding to hideExceptionList, button label toggles to show_fab_on_site
      expect(siteBtn.textContent).toBe("show_fab_on_site");

      // Clicking again removes domain from hideExceptionList and restores FAB
      await act(async () => {
        siteBtn.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenLastCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          enabled: true,
          fabConfig: expect.objectContaining({
            hideExceptionList: "",
          }),
        }),
      });
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      view.cleanup();
    });

    test("clicking size preset chip updates fab size and sends MSG_FAB_TOGGLE", async () => {
      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({ processActions });
      await flushEffects();

      const sizeChips = view.container.querySelectorAll(
        ".kt-popup-fab-control__size-chip"
      );
      expect(sizeChips).toHaveLength(3);
      expect(sizeChips[2].getAttribute("aria-pressed")).toBe("true");

      await act(async () => {
        sizeChips[0].click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          fabConfig: expect.objectContaining({ size: 36 }),
        }),
      });
      expect(sizeChips[0].getAttribute("aria-pressed")).toBe("true");

      view.cleanup();
    });

    test("when global FAB is hidden, site exception button enables FAB for this site", async () => {
      // Set storage to global hidden
      await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
        isHide: true,
        hideExceptionList: "",
      });

      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({ processActions });
      await flushEffects();

      const siteBtn = view.container.querySelector(
        ".kt-popup-fab-control__site-btn"
      );
      expect(siteBtn.textContent).toBe("show_fab_on_site");

      await act(async () => {
        siteBtn.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          enabled: true,
          fabConfig: expect.objectContaining({
            isHide: true,
            hideExceptionList: expect.stringContaining("example.com"),
          }),
        }),
      });
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      // Reset storage back
      await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
        isHide: false,
        hideExceptionList: "",
      });
      view.cleanup();
    });

    test("when hideExceptionList contains wildcard matching current site, site button shows FAB and cleans matching rule", async () => {
      // Set storage to global visible with wildcard rule
      await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
        isHide: false,
        hideExceptionList: "*.example.com",
      });

      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({
        processActions,
        targetTab: { id: 1, url: "https://sub.example.com/page" },
      });
      await flushEffects();

      const siteBtn = view.container.querySelector(
        ".kt-popup-fab-control__site-btn"
      );
      // Because *.example.com matches sub.example.com, FAB is currently hidden
      expect(siteBtn.textContent).toBe("show_fab_on_site");

      await act(async () => {
        siteBtn.click();
      });
      await flushEffects();

      // Clicking show should remove the matching wildcard and enable FAB
      expect(processActions).toHaveBeenCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          enabled: true,
          fabConfig: expect.objectContaining({
            hideExceptionList: "",
          }),
        }),
      });
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      // Reset storage back
      await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
        isHide: false,
        hideExceptionList: "",
      });
      view.cleanup();
    });

    test("shows the persisted FAB switch and site policy after storage loads", async () => {
      const listeners = { fab: new Set(), rules: new Set() };
      const snapshots = {
        fab: { data: DEFAULT_FAB, isLoading: true },
        rules: { data: DEFAULT_RULES, isLoading: true },
      };
      let releaseLoad = () => {};
      const loaded = new Promise((resolve) => {
        releaseLoad = resolve;
      });
      const persistedFab = {
        ...DEFAULT_FAB,
        isHide: true,
        hideExceptionList: "",
      };
      const persistedRules = [
        { pattern: "*", transOpen: "true" },
        { pattern: "example.com", transOpen: "false" },
      ];
      const makeState = (kind, persisted) => ({
        get snapshot() {
          return snapshots[kind];
        },
        configureSync: jest.fn(),
        subscribe(listener) {
          listeners[kind].add(listener);
          listener(snapshots[kind]);
          return () => listeners[kind].delete(listener);
        },
        ensureLoaded: jest.fn(() =>
          loaded.then(() => {
            snapshots[kind] = { data: persisted, isLoading: false };
            listeners[kind].forEach((listener) => listener(snapshots[kind]));
          })
        ),
        save: jest.fn(),
        remove: jest.fn(),
        load: jest.fn(),
      });
      const fabState = makeState("fab", persistedFab);
      const rulesState = makeState("rules", persistedRules);
      const actualGetStorageState = jest.requireActual(
        "../../libs/storageState"
      ).getStorageState;
      const spy = jest
        .spyOn(storageStateModule, "getStorageState")
        .mockImplementation((key, defaultValue) => {
          if (key === STOKEY_FAB) return fabState;
          if (key === STOKEY_RULES) return rulesState;
          return actualGetStorageState(key, defaultValue);
        });

      const view = renderPopup();
      try {
        await flushEffects();

        const globalSwitch = view.container.querySelector(
          ".kt-popup-fab-control__global input[type='checkbox']"
        );
        const policyButtons = Array.from(
          view.container.querySelectorAll(".kt-popup-policy-mode")
        );
        expect(fabState.ensureLoaded).toHaveBeenCalled();
        expect(rulesState.ensureLoaded).toHaveBeenCalled();
        expect(globalSwitch.disabled).toBe(true);
        expect(policyButtons).toHaveLength(3);
        expect(policyButtons.every((button) => button.disabled)).toBe(true);
        expect(
          policyButtons.some((button) =>
            button.className.includes("kt-popup-policy-mode--active")
          )
        ).toBe(false);

        await act(async () => {
          releaseLoad();
          await loaded;
        });
        await flushEffects();

        expect(globalSwitch.checked).toBe(false);
        expect(globalSwitch.disabled).toBe(false);
        const activePolicy = policyButtons.find((button) =>
          button.className.includes("kt-popup-policy-mode--active")
        );
        expect(activePolicy.textContent).toBe("site_trans_off");

        await act(async () => {
          policyButtons[0].click();
        });
        await flushEffects();

        expect(saveRule).toHaveBeenCalledWith(
          expect.objectContaining({
            pattern: "example.com",
            transOpen: GLOBAL_KEY,
          })
        );
      } finally {
        spy.mockRestore();
        view.cleanup();
      }
    });

    test("falls back to getCurTab when targetTab is provided without url", async () => {
      const view = renderPopup({
        targetTab: { id: 42 }, // no url property
      });
      await flushEffects();

      const siteSelect = view.container.querySelector(".kt-popup-site__select");
      expect(siteSelect).not.toBeNull();
      // Should have retrieved domain options from getCurTab (example.com)
      expect(siteSelect.value).toBe("example.com");

      view.cleanup();
    });
  });

  describe("Site Translation Policy", () => {
    test("renders site translation policy modes (follow, on, off)", async () => {
      const view = renderPopup();
      await flushEffects();

      const policySection = view.container.querySelector(
        ".kt-popup-site-policy"
      );
      expect(policySection).not.toBeNull();

      const buttons = Array.from(
        policySection.querySelectorAll(".kt-popup-policy-mode")
      );
      expect(buttons.length).toBe(3);
      expect(buttons.map((b) => b.textContent)).toEqual([
        "site_trans_follow",
        "site_trans_on",
        "site_trans_off",
      ]);

      view.cleanup();
    });

    test("selecting site policy saves rule and dispatches MSG_TRANS_TOGGLE if state changes", async () => {
      const processActions = jest.fn(async () => ({ ok: true }));
      const view = renderPopup({
        processActions,
        rule: {
          transOpen: "true",
          apiSlug: "openai",
          fromLang: "auto",
          toLang: "zh-CN",
        },
      });
      await flushEffects();

      const policySection = view.container.querySelector(
        ".kt-popup-site-policy"
      );
      const buttons = Array.from(
        policySection.querySelectorAll(".kt-popup-policy-mode")
      );

      // Click "site_trans_off" (false)
      await act(async () => {
        buttons[2].click();
      });
      await flushEffects();

      expect(saveRule).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: expect.any(String),
          transOpen: "false",
        })
      );
      expect(processActions).toHaveBeenCalledWith({
        action: MSG_TRANS_TOGGLE,
        args: { enabled: false, persistSite: true },
      });

      view.cleanup();
    });
  });

  describe("Footer perception and settings button", () => {
    test("renders footer with keyboard shortcuts and settings button even in native popup mode", async () => {
      const handleOpenSetting = jest.fn();
      const view = renderPopup({ isContent: false, handleOpenSetting });
      await flushEffects();

      const footer = view.container.querySelector(".kt-popup-footer");
      expect(footer).not.toBeNull();

      const settingsBtn = footer.querySelector(".MuiButton-root");
      expect(settingsBtn).not.toBeNull();
      expect(settingsBtn.textContent).toBe("popup_all_settings");

      await act(async () => {
        settingsBtn.click();
      });
      expect(handleOpenSetting).toHaveBeenCalledTimes(1);

      const kbds = footer.querySelectorAll("kbd");
      expect(kbds.length).toBeGreaterThan(0);

      view.cleanup();
    });
  });
});

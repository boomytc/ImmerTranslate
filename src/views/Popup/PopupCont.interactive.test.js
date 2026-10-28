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
  MSG_TRANSBOX_TOGGLE,
  STOKEY_FAB,
  STOKEY_RULES,
} from "../../config";
import { DEFAULT_FAB, applyFabSitePolicy } from "../../config/fab";
import * as storageStateModule from "../../libs/storageState";
import { getStorageState } from "../../libs/storageState";
import { saveRule } from "../../libs/rules";
import { fetchModelCatalog } from "../../libs/modelList";

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

jest.mock("../../libs/rules", () => {
  const { isMatch } = jest.requireActual("../../libs/utils");
  const { GLOBAL_KEY } = jest.requireActual("../../config");
  const matchesRulePattern = (href, pattern) =>
    String(pattern || "")
      .split(/\n|,/)
      .some((item) => {
        const text = item.trim();
        return text !== "" && text !== GLOBAL_KEY && isMatch(href, text);
      });
  return {
    saveRule: jest.fn(async () => ({})),
    findMatchingRule: (rules, href) =>
      (rules || []).find(
        (rule) =>
          rule?.pattern !== GLOBAL_KEY &&
          rule?.enabled !== false &&
          matchesRulePattern(href, rule.pattern)
      ),
  };
});

jest.mock("../../libs/sync", () => ({
  syncData: jest.fn(),
}));

jest.mock("../../libs/modelList", () => ({
  fetchModelCatalog: jest.fn(async () => ({
    models: ["gpt-4o", "gpt-4o-mini", "custom-model"],
  })),
}));

function pageReply(message) {
  if (message?.action === MSG_FAB_TOGGLE) {
    return {
      fabVisible:
        typeof message.args?.enabled === "boolean"
          ? message.args.enabled
          : true,
    };
  }
  if (message?.action === MSG_TRANSBOX_TOGGLE) {
    return {
      setting: {
        tranboxSetting: { transOpen: Boolean(message.args?.enabled) },
      },
    };
  }
  if (message?.action === MSG_TRANS_TOGGLE) {
    const enabled = Boolean(message.args?.enabled);
    return {
      ok: true,
      pageSwitch: enabled ? "on" : "off",
      rule: { transOpen: enabled ? "true" : "false" },
    };
  }
  return { ok: true };
}

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
    isPlainText: "false",
  };

  const defaultProps = {
    rule: baseRule,
    setting: baseSetting,
    setRule: jest.fn(),
    handleOpenSetting: jest.fn(),
    processActions: jest.fn(pageReply),
    targetTab: { id: 1, url: "https://example.com/page" },
    documentInfo: { frameId: 0, token: "doc-1" },
    pageSwitch: props.rule?.transOpen === "false" ? "off" : "on",
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
    mockUpdateSetting.mockResolvedValue({ changed: true });
    fetchModelCatalog.mockResolvedValue({
      models: ["gpt-4o", "gpt-4o-mini", "custom-model"],
      thinkingCapabilities: {},
    });
    mockContextSetting = { blacklist: "" };
    const fabState = getStorageState(STOKEY_FAB, DEFAULT_FAB);
    await act(async () => {
      await fabState.save({
        ...DEFAULT_FAB,
        isHide: false,
        hiddenSites: "",
        shownSites: "",
      });
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
      const processActions = jest.fn(pageReply);
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

    test("rolls back model selection and shows error feedback when the page rejects MSG_TRANS_SET_MODEL or persistence fails", async () => {
      const processActions = jest.fn(async (message) => {
        if (message?.action === MSG_TRANS_SET_MODEL) {
          return { error: "Page rejected model switch" };
        }
        return pageReply(message);
      });
      const view = renderPopup({ processActions });
      await flushEffects();

      const modelSelect = view.container.querySelector(
        ".kt-popup-model-select"
      );
      expect(modelSelect.value).toBe("gpt-4o");

      await act(async () => {
        modelSelect.value = "gpt-4o-mini";
        modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flushEffects();

      // Page rejected: must roll back UI selection, skip settings persistence, and show error alert
      expect(modelSelect.value).toBe("gpt-4o");
      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(
        view.container.querySelector('[role="alert"]')?.textContent
      ).toContain("popup_action_failed");

      // Now page accepts, but updateSetting rejects (persistence failure)
      processActions.mockImplementation(async (message) => pageReply(message));
      mockUpdateSetting.mockRejectedValueOnce(
        new Error("Storage write failed")
      );

      await act(async () => {
        modelSelect.value = "custom-model";
        modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flushEffects();

      expect(modelSelect.value).toBe("gpt-4o");
      expect(processActions).toHaveBeenLastCalledWith({
        action: MSG_TRANS_SET_MODEL,
        args: { apiSlug: "openai", model: "gpt-4o" },
      });
      expect(
        view.container.querySelector('[role="alert"]')?.textContent
      ).toContain("popup_action_failed");

      view.cleanup();
    });

    test("consecutive model switches keep the latest confirmed model and ignore late superseded responses", async () => {
      const pendingPageConfirmations = [];
      const processActions = jest.fn((message) => {
        if (message?.action === MSG_TRANS_SET_MODEL) {
          return new Promise((resolve) => {
            pendingPageConfirmations.push({
              model: message.args.model,
              resolve,
            });
          });
        }
        return Promise.resolve(pageReply(message));
      });

      const view = renderPopup({ processActions });
      await flushEffects();

      const modelSelect = view.container.querySelector(
        ".kt-popup-model-select"
      );
      expect(modelSelect.value).toBe("gpt-4o");

      // Switch to gpt-4o-mini (req 1), then immediately to custom-model (req 2)
      await act(async () => {
        modelSelect.value = "gpt-4o-mini";
        modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        modelSelect.value = "custom-model";
        modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(modelSelect.value).toBe("custom-model");
      expect(pendingPageConfirmations).toHaveLength(2);

      // Resolve req 2 first, then req 1 late
      await act(async () => {
        pendingPageConfirmations[1].resolve({ ok: true });
        await Promise.resolve();
      });
      await flushEffects();

      await act(async () => {
        pendingPageConfirmations[0].resolve({ ok: true });
        await Promise.resolve();
      });
      await flushEffects();

      expect(modelSelect.value).toBe("custom-model");
      expect(mockUpdateSetting).toHaveBeenCalledTimes(1);
      const updater = mockUpdateSetting.mock.calls[0][0];
      const updated = updater({
        transApis: [{ apiSlug: "openai", model: "gpt-4o" }],
      });
      expect(updated.transApis[0].model).toBe("custom-model");

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
      const fabText = fabControl.textContent;
      const siteAt = fabText.indexOf("hide_fab_on_site");
      const globalAt = fabText.indexOf("fab_global_switch");
      const selectionAt = fabText.indexOf("selection_translate");
      expect(siteAt).toBeGreaterThanOrEqual(0);
      expect(globalAt).toBeGreaterThan(siteAt);
      expect(selectionAt).toBeGreaterThan(globalAt);

      view.cleanup();
    });

    test("toggling global switch updates fab config and sends MSG_FAB_TOGGLE", async () => {
      const processActions = jest.fn(pageReply);
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

    test("clicking site exception button writes the same hostname entry as the floating menu", async () => {
      const processActions = jest.fn(pageReply);
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
            hiddenSites: "example.com",
            shownSites: "",
          }),
        }),
      });
      expect(processActions.mock.calls[0][0].args.fabConfig).toEqual(
        applyFabSitePolicy(
          { ...DEFAULT_FAB, isHide: false, hiddenSites: "", shownSites: "" },
          "https://example.com/page",
          false
        )
      );

      expect(siteBtn.textContent).toBe("show_fab_on_site");

      // Clicking again removes the hostname and restores the button
      await act(async () => {
        siteBtn.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenLastCalledWith({
        action: MSG_FAB_TOGGLE,
        args: expect.objectContaining({
          enabled: true,
          fabConfig: expect.objectContaining({
            hiddenSites: "",
          }),
        }),
      });
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      view.cleanup();
    });

    test("clicking size preset chip updates fab size and sends MSG_FAB_TOGGLE", async () => {
      const processActions = jest.fn(pageReply);
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

    test("renders selection translation switch and toggles MSG_TRANSBOX_TOGGLE", async () => {
      const processActions = jest.fn(pageReply);
      const view = renderPopup({ processActions });
      await flushEffects();

      const selectionSwitch = view.container.querySelector(
        'input[aria-label="selection_translate"]'
      );
      expect(selectionSwitch).not.toBeNull();
      expect(selectionSwitch.checked).toBe(true);

      await act(async () => {
        selectionSwitch.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_TRANSBOX_TOGGLE,
        args: { enabled: false },
      });
      expect(selectionSwitch.checked).toBe(false);

      await act(async () => {
        selectionSwitch.click();
      });
      await flushEffects();

      expect(processActions).toHaveBeenCalledWith({
        action: MSG_TRANSBOX_TOGGLE,
        args: { enabled: true },
      });
      expect(selectionSwitch.checked).toBe(true);

      view.cleanup();
    });

    test("input dot switch hides only the icon and showing it re-enables input translation", async () => {
      mockContextSetting = {
        blacklist: "",
        inputRule: { transOpen: false, showDot: "always", toLang: "ja" },
      };
      const view = renderPopup();
      await flushEffects();

      const dotSwitch = view.container.querySelector(
        'input[aria-label="input_dot_switch"]'
      );
      expect(dotSwitch.checked).toBe(false);

      await act(async () => {
        dotSwitch.click();
      });
      const show = mockUpdateSetting.mock.calls.at(-1)[0];
      expect(show(mockContextSetting).inputRule).toEqual({
        transOpen: true,
        showDot: "always",
        toLang: "ja",
      });
      view.cleanup();

      mockContextSetting = {
        blacklist: "",
        inputRule: { transOpen: true, showDot: "always" },
      };
      const shown = renderPopup();
      await flushEffects();
      const shownSwitch = shown.container.querySelector(
        'input[aria-label="input_dot_switch"]'
      );
      expect(shownSwitch.checked).toBe(true);

      await act(async () => {
        shownSwitch.click();
      });
      const hide = mockUpdateSetting.mock.calls.at(-1)[0];
      expect(hide(mockContextSetting).inputRule).toEqual({
        transOpen: true,
        showDot: "-",
      });
      shown.cleanup();
    });

    test("input dot switch notes when input translation is blocked on the site", async () => {
      mockContextSetting = {
        blacklist: "",
        inputRule: { transOpen: true, blacklist: "example.com" },
      };
      const view = renderPopup();
      await flushEffects();

      const label = view.container
        .querySelector('input[aria-label="input_dot_switch"]')
        .closest(".kt-popup-fab-control__global");
      expect(label.textContent).toContain("selection_translate_site_blocked");

      view.cleanup();
    });

    test("when global FAB is hidden, site exception button enables FAB for this site", async () => {
      // Set storage to global hidden
      await act(async () => {
        await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
          isHide: true,
          hiddenSites: "",
          shownSites: "",
        });
      });

      const processActions = jest.fn(pageReply);
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
            hiddenSites: "",
            shownSites: "example.com",
          }),
        }),
      });
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      // Reset storage back
      await act(async () => {
        await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
          isHide: false,
          hiddenSites: "",
          shownSites: "",
        });
      });
      view.cleanup();
    });

    test("when hiddenSites contains a wildcard matching the current site, the site button shows the FAB and removes that entry", async () => {
      await act(async () => {
        await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
          isHide: false,
          hiddenSites: "*.example.com",
          shownSites: "",
        });
      });

      const processActions = jest.fn(pageReply);
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
            hiddenSites: "",
          }),
        }),
      });
      expect(siteBtn.textContent).toBe("hide_fab_on_site");

      // Reset storage back
      await act(async () => {
        await getStorageState(STOKEY_FAB, DEFAULT_FAB).save({
          isHide: false,
          hiddenSites: "",
          shownSites: "",
        });
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
        hiddenSites: "",
        shownSites: "",
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

    test("site policy follows the stored rule while page translation is on", async () => {
      const rulesState = {
        snapshot: {
          data: [{ pattern: "*", transOpen: "false" }],
          isLoading: false,
        },
        configureSync: jest.fn(),
        subscribe(listener) {
          listener(this.snapshot);
          return () => {};
        },
        ensureLoaded: jest.fn(async () => {}),
        save: jest.fn(),
      };
      const actualGetStorageState = storageStateModule.getStorageState;
      const spy = jest
        .spyOn(storageStateModule, "getStorageState")
        .mockImplementation((key, defaultValue) => {
          if (key === STOKEY_RULES) return rulesState;
          return actualGetStorageState(key, defaultValue);
        });
      const processActions = jest.fn(async ({ args }) => ({
        rule: { transOpen: args?.enabled ? "true" : "false" },
        pageSwitch: args?.enabled ? "on" : "off",
      }));
      let view;
      try {
        view = renderPopup({ processActions });
        await flushEffects();
        const active = view.container.querySelector(
          ".kt-popup-policy-mode--active"
        );
        expect(active.textContent).toBe("site_trans_follow");
        const mainSwitch = view.container.querySelector(
          'input[aria-label="popup_translate_page"]'
        );
        expect(mainSwitch.checked).toBe(true);
        await act(async () => {
          mainSwitch.click();
        });
        await flushEffects();
        expect(saveRule).not.toHaveBeenCalled();
        expect(processActions).toHaveBeenCalledWith({
          action: MSG_TRANS_TOGGLE,
          args: { enabled: false },
        });
        expect(
          view.container.querySelector(".kt-popup-policy-mode--active")
            .textContent
        ).toBe("site_trans_follow");
      } finally {
        spy.mockRestore();
        view?.cleanup();
      }
    });

    test("a stored personal rule without transOpen follows global in the popup", async () => {
      const rulesState = {
        snapshot: {
          data: [{ pattern: "example.com", selector: "article" }],
          isLoading: false,
        },
        configureSync: jest.fn(),
        subscribe(listener) {
          listener(this.snapshot);
          return () => {};
        },
        ensureLoaded: jest.fn(async () => {}),
        save: jest.fn(),
      };
      const actualGetStorageState = storageStateModule.getStorageState;
      const spy = jest
        .spyOn(storageStateModule, "getStorageState")
        .mockImplementation((key, defaultValue) => {
          if (key === STOKEY_RULES) return rulesState;
          return actualGetStorageState(key, defaultValue);
        });
      let view;
      try {
        view = renderPopup();
        await flushEffects();
        expect(
          view.container.querySelector(".kt-popup-policy-mode--active")
            .textContent
        ).toBe("site_trans_follow");
      } finally {
        spy.mockRestore();
        view?.cleanup();
      }
    });

    test("an illegal stored transOpen is not shown as follow", async () => {
      const rulesState = {
        snapshot: {
          data: [{ pattern: "example.com", transOpen: "bogus" }],
          isLoading: false,
        },
        configureSync: jest.fn(),
        subscribe(listener) {
          listener(this.snapshot);
          return () => {};
        },
        ensureLoaded: jest.fn(async () => {}),
        save: jest.fn(),
      };
      const actualGetStorageState = storageStateModule.getStorageState;
      const spy = jest
        .spyOn(storageStateModule, "getStorageState")
        .mockImplementation((key, defaultValue) => {
          if (key === STOKEY_RULES) return rulesState;
          return actualGetStorageState(key, defaultValue);
        });
      let view;
      try {
        view = renderPopup();
        await flushEffects();
        expect(
          view.container.querySelector(".kt-popup-policy-mode--active")
        ).toBeNull();
        expect(
          view.container.querySelector(".kt-popup-site-policy__error")
            .textContent
        ).toMatch(/Unknown site translation policy/);
      } finally {
        spy.mockRestore();
        view?.cleanup();
      }
    });

    test("selecting site policy saves the rule and leaves the page switch to storage", async () => {
      const processActions = jest.fn(pageReply);
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
      expect(processActions).not.toHaveBeenCalled();

      view.cleanup();
    });

    test("switching the domain dropdown highlights that domain and writes the click there", async () => {
      const rulesState = getStorageState(STOKEY_RULES, DEFAULT_RULES);
      await act(async () => {
        await rulesState.save([
          { pattern: "*", transOpen: "false" },
          { pattern: "example.com", transOpen: "false" },
          { pattern: "*.example.com", transOpen: "true" },
        ]);
      });
      const view = renderPopup({
        targetTab: { id: 1, url: "https://example.com/page" },
      });
      try {
        await flushEffects();
        const select = view.container.querySelector(".kt-popup-site__select");
        const active = () =>
          view.container.querySelector(".kt-popup-policy-mode--active")
            ?.textContent;
        expect(select.value).toBe("example.com");
        expect(active()).toBe("site_trans_off");

        await act(async () => {
          select.value = "*.example.com";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await flushEffects();
        expect(select.value).toBe("*.example.com");
        expect(active()).toBe("site_trans_on");

        const follow = Array.from(
          view.container.querySelectorAll(".kt-popup-policy-mode")
        ).find((button) => button.textContent === "site_trans_follow");
        await act(async () => {
          follow.click();
        });
        await flushEffects();

        expect(saveRule).toHaveBeenCalledWith(
          expect.objectContaining({
            pattern: "*.example.com",
            transOpen: GLOBAL_KEY,
          })
        );
        expect(saveRule).not.toHaveBeenCalledWith(
          expect.objectContaining({ pattern: "example.com" })
        );
      } finally {
        view.cleanup();
      }
    });
  });

  test("rolls the FAB switch back when the page replies with an error", async () => {
    const processActions = jest.fn(async () => ({
      error: "Page controls are paused while the rule editor is open.",
    }));
    const view = renderPopup({ processActions });
    await flushEffects();
    const globalSwitch = view.container.querySelector(
      'input[aria-label="fab_global_switch"]'
    );
    expect(globalSwitch.checked).toBe(true);

    await act(async () => {
      globalSwitch.click();
    });
    await flushEffects();

    expect(globalSwitch.checked).toBe(true);
    const stored = getStorageState(STOKEY_FAB, DEFAULT_FAB).snapshot.data;
    expect(stored.isHide).toBe(false);
    expect(
      view.container.querySelector('[role="alert"]').textContent
    ).toContain("popup_action_failed");
    view.cleanup();
  });

  test("keeps the second FAB click when the first page reply fails", async () => {
    let resolveFirst;
    let calls = 0;
    const processActions = jest.fn((message) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          resolveFirst = () =>
            resolve({
              error: "Page controls are paused while the rule editor is open.",
            });
        });
      }
      return pageReply(message);
    });
    const view = renderPopup({ processActions });
    await flushEffects();
    const globalSwitch = view.container.querySelector(
      'input[aria-label="fab_global_switch"]'
    );

    await act(async () => {
      globalSwitch.click();
    });
    await flushEffects();
    expect(globalSwitch.checked).toBe(false);
    expect(getStorageState(STOKEY_FAB, DEFAULT_FAB).snapshot.data.isHide).toBe(
      true
    );

    await act(async () => {
      globalSwitch.click();
    });
    await flushEffects();
    expect(globalSwitch.checked).toBe(true);
    expect(getStorageState(STOKEY_FAB, DEFAULT_FAB).snapshot.data.isHide).toBe(
      false
    );

    await act(async () => {
      resolveFirst();
    });
    await flushEffects();

    const stored = getStorageState(STOKEY_FAB, DEFAULT_FAB).snapshot.data;
    expect(stored.isHide).toBe(false);
    expect(globalSwitch.checked).toBe(true);
    expect(
      view.container.querySelector('[role="alert"]').textContent
    ).toContain("popup_action_failed");
    view.cleanup();
  });

  test("keeps another tab's FAB edits when this change rolls back", async () => {
    let resolveReply;
    const processActions = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveReply = () =>
            resolve({
              error: "Page controls are paused while the rule editor is open.",
            });
        })
    );
    const view = renderPopup({
      processActions,
      targetTab: { id: 1, url: "https://example.com/page" },
    });
    await flushEffects();
    const siteBtn = view.container.querySelector(
      ".kt-popup-fab-control__site-btn"
    );

    await act(async () => {
      siteBtn.click();
    });
    await flushEffects();
    expect(
      getStorageState(STOKEY_FAB, DEFAULT_FAB).snapshot.data.hiddenSites
    ).toBe("example.com");

    await act(async () => {
      await getStorageState(STOKEY_FAB, DEFAULT_FAB).save((current) => ({
        ...current,
        hiddenSites: `${current.hiddenSites}\nother.com`,
        x: 12,
        y: 40,
      }));
    });
    await flushEffects();

    await act(async () => {
      resolveReply();
    });
    await flushEffects();

    const stored = getStorageState(STOKEY_FAB, DEFAULT_FAB).snapshot.data;
    expect(stored.hiddenSites).toBe("other.com");
    expect(stored.x).toBe(12);
    expect(stored.y).toBe(40);
    expect(stored.isHide).toBe(false);
    expect(siteBtn.textContent).toBe("hide_fab_on_site");
    view.cleanup();
  });

  test("disables FAB controls until the page URL is ready", async () => {
    let resolveTab;
    mockGetCurTab.mockReturnValue(
      new Promise((resolve) => {
        resolveTab = resolve;
      })
    );
    const view = renderPopup({ targetTab: undefined });
    await act(async () => {
      await Promise.resolve();
    });
    const globalSwitch = view.container.querySelector(
      'input[aria-label="fab_global_switch"]'
    );
    const sizeChip = view.container.querySelector(
      ".kt-popup-fab-control__size-chip"
    );
    expect(globalSwitch.disabled).toBe(true);
    expect(sizeChip.disabled).toBe(true);

    await act(async () => {
      resolveTab({ url: "https://example.com/ready" });
    });
    await flushEffects();
    expect(globalSwitch.disabled).toBe(false);
    expect(sizeChip.disabled).toBe(false);
    view.cleanup();
  });

  test("echoes selection translation from the page reply and rolls it back on error", async () => {
    const processActions = jest.fn(async (message) => {
      if (message.action === MSG_TRANSBOX_TOGGLE) {
        return {
          setting: { tranboxSetting: { transOpen: message.args.enabled } },
        };
      }
      return pageReply(message);
    });
    const view = renderPopup({ processActions });
    await flushEffects();
    const selectionSwitch = view.container.querySelector(
      'input[aria-label="selection_translate"]'
    );
    expect(selectionSwitch.checked).toBe(true);

    await act(async () => {
      selectionSwitch.click();
    });
    await flushEffects();
    expect(selectionSwitch.checked).toBe(false);
    expect(mockUpdateSetting).toHaveBeenCalled();
    const persisted = mockUpdateSetting.mock.calls.at(-1)[0]({
      tranboxSetting: { transOpen: true },
    });
    expect(persisted.tranboxSetting.transOpen).toBe(false);

    processActions.mockImplementation(async () => ({
      error: "Page controls are paused while the rule editor is open.",
    }));
    await act(async () => {
      selectionSwitch.click();
    });
    await flushEffects();
    expect(selectionSwitch.checked).toBe(false);
    expect(
      view.container.querySelector('[role="alert"]').textContent
    ).toContain("popup_action_failed");
    view.cleanup();
  });

  test("marks selection translation when this site is on the tranbox blacklist", async () => {
    mockContextSetting = {
      blacklist: "",
      tranboxSetting: { transOpen: true, blacklist: "*.example.com" },
    };
    const view = renderPopup({
      targetTab: { id: 1, url: "https://sub.example.com/page" },
      setting: {
        tranboxSetting: { transOpen: true, blacklist: "*.example.com" },
      },
    });
    await flushEffects();
    expect(view.container.textContent).toContain(
      "selection_translate_site_blocked"
    );
    view.cleanup();
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

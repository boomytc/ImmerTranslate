import { act } from "react";
import { createRoot } from "react-dom/client";
import Rules from "./Rules";
import { useRules } from "../../hooks/Rules";
import { OPTIONS_STYLES } from "./styles";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("../../hooks/Rules", () => ({
  useRules: jest.fn(),
}));

const mockAlert = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
};

jest.mock("../../hooks/Alert", () => ({
  useAlert: () => mockAlert,
}));

jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: { injectRules: true },
    updateSetting: jest.fn(),
  }),
}));

jest.mock("../../hooks/Confirm", () => ({
  useConfirm: () => jest.fn(),
}));

jest.mock("../../hooks/Api", () => ({
  useApiList: () => ({
    enabledApis: [{ apiSlug: "Tencent", apiName: "Tencent" }],
  }),
}));

jest.mock("../../hooks/CustomStyles", () => ({
  useAllTextStyles: () => ({
    allTextStyles: [
      { styleSlug: "style_none", styleName: "style_none" },
      { styleSlug: "marker", styleName: "marker" },
    ],
  }),
}));

jest.mock("./HelpButton", () => {
  return function HelpButton() {
    return <span data-testid="help-button" />;
  };
});

jest.mock("../../libs/log", () => ({
  kissLog: jest.fn(),
  LogLevel: {
    INFO: { value: 3 },
  },
}));

const mockPutRule = jest.fn();

function renderRules() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Rules />);
  });

  return {
    container,
    root,
    rerender: () => {
      act(() => {
        root.render(<Rules />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function openPersonalTab(view) {
  const tab = getByRole(view.container, "tab", "personal_rules");
  await act(async () => {
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushEffects();
}

function getByRole(container, role, name) {
  const elements = Array.from(container.querySelectorAll(`[role="${role}"]`));
  const element = elements.find((item) => item.textContent === name);
  if (!element) {
    throw new Error(`Unable to find ${role} named ${name}`);
  }
  return element;
}

function getButtonByText(container, text) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent === text
  );
  if (!button) {
    throw new Error(`Unable to find button named ${text}`);
  }
  return button;
}

async function selectOption(container, inputName, optionName) {
  const input = container.querySelector(`input[name="${inputName}"]`);
  const select = input?.parentElement?.querySelector('[role="combobox"]');
  if (!select) {
    throw new Error(`Unable to find select named ${inputName}`);
  }

  await act(async () => {
    select.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
      })
    );
  });

  const option = getByRole(document.body, "option", optionName);
  await act(async () => {
    option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushEffects();
}

describe("Options Rules switch spacing", () => {
  let optionsStyle;

  beforeEach(() => {
    jest.clearAllMocks();
    useRules.mockReturnValue({
      list: [
        { pattern: "example.com", enabled: true },
        { pattern: "*", selector: "p" },
      ],
      put: mockPutRule,
    });
    optionsStyle = document.createElement("style");
    // jsdom cannot parse the container queries that follow the base page styles.
    optionsStyle.textContent = OPTIONS_STYLES.split("@container")[0];
  });

  afterEach(() => {
    optionsStyle.remove();
  });

  test.each([
    ["personal rules", openPersonalTab, "Toggle personal rule example.com"],
  ])(
    "reserves a title gutter for %s with the page styles applied",
    async (_name, openTab, switchLabel) => {
      const view = renderRules();
      view.container.classList.add("kt-options-page");

      try {
        await openTab(view);
        document.head.appendChild(optionsStyle);
        const input = view.container.querySelector(
          `input[aria-label="${switchLabel}"]`
        );
        const control = input.closest(".kt-rule-enable-control");
        const accordion = control.closest(".kt-rule-accordion");
        const summary = accordion.querySelector(".MuiAccordionSummary-root");
        const switchStyle = getComputedStyle(input.closest(".MuiSwitch-root"));
        const controlStyle = getComputedStyle(control);
        const summaryStyle = getComputedStyle(summary);
        const switchEnd =
          parseFloat(controlStyle.insetInlineStart) +
          parseFloat(switchStyle.width);

        expect(switchStyle.width).toBe("52px");
        expect(controlStyle.position).toBe("absolute");
        expect(summary.contains(control)).toBe(false);
        expect(
          parseFloat(summaryStyle.paddingInlineStart)
        ).toBeGreaterThanOrEqual(switchEnd + 8);
      } finally {
        view.unmount();
      }
    }
  );

  test("keeps the normal page gutter for the global rule without a switch", () => {
    const view = renderRules();
    view.container.classList.add("kt-options-page");
    document.head.appendChild(optionsStyle);

    try {
      const accordion = view.container.querySelector(".kt-rule-accordion");
      const summary = accordion.querySelector(".MuiAccordionSummary-root");

      expect(accordion.querySelector(".kt-rule-enable-control")).toBeNull();
      expect(summary.classList).not.toContain("kt-rule-summary--with-switch");
      expect(getComputedStyle(summary).paddingInline).toBe("18px");
    } finally {
      view.unmount();
    }
  });
});

describe("Options Rules global tab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRules.mockReturnValue({
      list: [
        {
          pattern: "*",
          selector: "p",
          textStyle: "style_none",
          wrapOriginal: "false",
          originalTextStyle: "style_none",
        },
      ],
      put: mockPutRule,
    });
  });

  test("renders one text style control without the duplicate style preview", () => {
    const view = renderRules();

    expect(
      view.container.querySelectorAll('input[name="textStyle"]')
    ).toHaveLength(1);
    expect(view.container.querySelector(".kt-rule-style-grid")).toBeNull();
    expect(
      view.container.querySelector('input[name="wrapOriginal"]')
    ).not.toBeNull();
    expect(view.container.querySelector(".MuiGrid-grid-lg-3")).toBeNull();

    view.unmount();
  });
});

describe("Options Rules personal tab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRules.mockReturnValue({
      list: [
        { pattern: "example.com", enabled: true },
        { pattern: "*", selector: "p" },
      ],
      put: mockPutRule,
    });
    Object.values(mockAlert).forEach((alertMethod) => alertMethod.mockClear());
  });

  test("renders a switch for personal rules but not the global rule", async () => {
    const view = renderRules();
    await openPersonalTab(view);

    const switchInput = view.container.querySelector(
      'input[aria-label="Toggle personal rule example.com"]'
    );

    expect(view.container.textContent).toContain("example.com");
    expect(switchInput).not.toBeNull();
    expect(switchInput.checked).toBe(true);

    view.unmount();
  });

  test("toggles personal rule enabled state without deleting or expanding it", async () => {
    const view = renderRules();
    await openPersonalTab(view);

    const switchInput = view.container.querySelector(
      'input[aria-label="Toggle personal rule example.com"]'
    );
    await act(async () => {
      switchInput.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(mockPutRule).toHaveBeenCalledWith("example.com", {
      enabled: false,
    });
    expect(view.container.querySelector('input[name="pattern"]')).toBeNull();

    view.unmount();
  });

  test("shows original style when a rule enables original wrapping", async () => {
    useRules.mockReturnValue({
      list: [
        {
          pattern: "example.com",
          enabled: true,
          wrapOriginal: "true",
          originalTextStyle: "style_none",
        },
        {
          pattern: "*",
          selector: "p",
          wrapOriginal: "false",
          originalTextStyle: "style_none",
        },
      ],
      put: mockPutRule,
    });
    const view = renderRules();
    await openPersonalTab(view);

    const wrappedRule = Array.from(
      view.container.querySelectorAll('[role="button"]')
    ).find((item) => item.textContent.includes("example.com"));
    expect(wrappedRule).toBeDefined();
    await act(async () => {
      wrappedRule.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(
      view.container.querySelector('input[name="wrapOriginal"]')?.value
    ).toBe("true");
    expect(
      view.container.querySelector('input[name="originalTextStyle"]')?.value
    ).toBe("style_none");
    expect(
      view.container.querySelector(".kt-rule-original-settings")
    ).toBeNull();

    view.unmount();
  });

  test("resolves inherited original wrapping from the global rule", async () => {
    useRules.mockReturnValue({
      list: [
        {
          pattern: "example.com",
          enabled: true,
          wrapOriginal: "*",
          originalTextStyle: "*",
        },
        {
          pattern: "*",
          selector: "p",
          wrapOriginal: "true",
          originalTextStyle: "marker",
        },
      ],
      put: mockPutRule,
    });
    const view = renderRules();
    await openPersonalTab(view);

    const inheritedRule = Array.from(
      view.container.querySelectorAll('[role="button"]')
    ).find((item) => item.textContent.includes("example.com"));
    await act(async () => {
      inheritedRule.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const wrapOriginalControl = view.container.querySelector(
      'input[name="wrapOriginal"]'
    );
    const originalStyleControl = view.container.querySelector(
      'input[name="originalTextStyle"]'
    );
    expect(wrapOriginalControl?.value).toBe("*");
    expect(originalStyleControl?.value).toBe("*");

    view.unmount();
  });

  test("updates original wrapping from the regular form grid", async () => {
    useRules.mockReturnValue({
      list: [
        {
          pattern: "example.com",
          enabled: true,
          wrapOriginal: "false",
          originalTextStyle: "style_none",
        },
        {
          pattern: "*",
          selector: "p",
          wrapOriginal: "false",
          originalTextStyle: "style_none",
        },
      ],
      put: mockPutRule,
    });
    const view = renderRules();
    await openPersonalTab(view);

    const ruleSummary = Array.from(
      view.container.querySelectorAll('[role="button"]')
    ).find((item) => item.textContent.includes("example.com"));
    await act(async () => {
      ruleSummary.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const editButton = getButtonByText(view.container, "edit");
    expect(window.getComputedStyle(editButton.parentElement).flexWrap).toBe(
      "wrap"
    );
    await act(async () => {
      editButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    await selectOption(view.container, "wrapOriginal", "enable");

    expect(
      view.container.querySelector('input[name="wrapOriginal"]')?.value
    ).toBe("true");
    expect(
      view.container.querySelector('input[name="originalTextStyle"]')
    ).not.toBeNull();

    const saveButton = getButtonByText(view.container, "save");
    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(mockPutRule).toHaveBeenCalledWith(
      "example.com",
      expect.objectContaining({ wrapOriginal: "true" })
    );

    view.unmount();
  });
});

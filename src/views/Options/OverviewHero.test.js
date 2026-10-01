import { act } from "react";
import { createRoot } from "react-dom/client";
import OverviewHero from "./OverviewHero";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockRulesLoading = false;
let mockTransApis = [
  { apiSlug: "BuiltinAI", apiName: "BuiltinAI" },
  { apiSlug: "Microsoft", apiName: "Microsoft" },
];

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));
jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: {
      transApis: mockTransApis,
    },
  }),
}));
jest.mock("../../hooks/Rules", () => ({
  useRules: () => ({
    isLoading: mockRulesLoading,
    list: [
      {
        pattern: "*",
        apiSlug: "Microsoft",
        fromLang: "auto",
        toLang: "zh-CN",
      },
    ],
  }),
}));
jest.mock("../../hooks/Commands", () => ({
  useOverviewShortcuts: () => ({
    page: ["Ctrl", "Q"],
    popup: ["Ctrl", "K"],
    separateWindow: ["Alt", "D"],
    style: ["Ctrl", "C"],
    selection: ["Ctrl", "S"],
    input: ["Ctrl", "I"],
    settings: ["Ctrl", "O"],
  }),
}));
describe("OverviewHero", () => {
  beforeEach(() => {
    mockRulesLoading = false;
    mockTransApis = [
      { apiSlug: "BuiltinAI", apiName: "BuiltinAI" },
      { apiSlug: "Microsoft", apiName: "Microsoft" },
    ];
  });

  test("renders the global rule and actual command shortcuts", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));

    expect(container.textContent).toContain("Microsoft");
    expect(container.textContent).not.toContain("BuiltinAI");
    expect(container.textContent).toContain("translate_service");
    expect(container.textContent).toContain("from_lang");
    expect(container.textContent).toContain("to_lang");
    expect(container.textContent).toContain("open_separate_window");
    expect(container.textContent).toContain("Ctrl");

    act(() => root.unmount());
  });

  test("does not render a global enabled state or switch", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.textContent).toContain("options_overview");
    expect(
      container.querySelector(".kt-overview-hero__summary")
    ).not.toBeNull();

    act(() => root.unmount());
  });

  test("does not render default rule details while rules are loading", () => {
    mockRulesLoading = true;
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));

    expect(
      container.querySelector(".kt-overview-top").getAttribute("aria-busy")
    ).toBe("true");
    expect(container.textContent).not.toContain("Microsoft");
    expect(container.textContent).not.toContain("BuiltinAI");
    expect(
      Array.from(
        container.querySelectorAll(".kt-overview-hero__summary-item strong")
      ).map((element) => element.textContent)
    ).toEqual(["—", "— → —"]);

    act(() => root.unmount());
  });

  test("keeps an enabled keyless service out of the empty state", () => {
    mockTransApis = [
      {
        apiSlug: "Microsoft",
        apiName: "Microsoft",
        apiType: "Microsoft",
        key: "",
        isDisabled: false,
      },
    ];
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));

    expect(container.textContent).toContain("Microsoft");
    expect(container.textContent).not.toContain("fab_no_keyed_provider");
    expect(container.textContent).not.toContain("missing_api_key_empty");
    expect(
      container.querySelector(".kt-overview-hero__summary-item--empty")
    ).toBeNull();

    act(() => root.unmount());
  });

  test("uses the no-service copy when nothing usable is enabled", () => {
    mockTransApis = [
      {
        apiSlug: "DeepSeek",
        apiName: "DeepSeek",
        apiType: "DeepSeek",
        key: "",
        isDisabled: false,
      },
      {
        apiSlug: "Google",
        apiName: "Google",
        apiType: "Google",
        key: "",
        isDisabled: true,
      },
    ];
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => root.render(<OverviewHero />));

    const empty = container.querySelector(
      ".kt-overview-hero__summary-item--empty"
    );
    expect(empty.textContent).toContain("fab_no_keyed_provider");
    expect(container.textContent).not.toContain("missing_api_key_empty");
    expect(container.textContent).not.toContain("DeepSeek");
    expect(container.textContent).not.toContain("Google");
    expect(container.textContent).not.toContain("Microsoft");

    act(() => root.unmount());
  });
});

import { act } from "react";
import { createRoot } from "react-dom/client";
import About from "./About";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUseI18nMd = jest.fn();
const mockReactMarkdown = jest.fn(({ children }) => children);

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
  useI18nMd: (...args) => mockUseI18nMd(...args),
}));

jest.mock("react-markdown", () => (props) => {
  mockReactMarkdown(props);
  return props.children;
});
jest.mock("remark-gfm", () => ({ plugin: "gfm" }));
jest.mock("rehype-raw", () => ({ plugin: "raw" }));
jest.mock("rehype-sanitize", () => ({ plugin: "sanitize" }));

describe("About", () => {
  beforeEach(() => {
    mockUseI18nMd.mockReturnValue({
      data: "# Project details",
      loading: false,
      error: null,
    });
  });

  test("loads project details only after expansion", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<About />));

    expect(mockUseI18nMd).not.toHaveBeenCalled();
    const summary = container.querySelector(".MuiAccordionSummary-root");
    act(() => {
      summary.click();
    });
    expect(mockUseI18nMd).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Project details");

    act(() => summary.click());
    act(() => summary.click());
    expect(mockUseI18nMd).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  test("renders trusted README HTML and GFM tables", () => {
    mockUseI18nMd.mockReturnValue({
      data: [
        '<p align="center"><img alt="Logo" src="public/images/logo128.png"></p>',
        "",
        "| 场景 | 说明 |",
        "| --- | --- |",
        "| 整页翻译 | 分批请求 |",
        "",
        "详见 [docs/BYOK.md](docs/BYOK.md)。",
      ].join("\n"),
      loading: false,
      error: null,
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<About />));
    act(() => {
      container.querySelector(".MuiAccordionSummary-root").click();
    });

    expect(container.textContent).toContain("整页翻译");

    const markdownProps = mockReactMarkdown.mock.calls.at(-1)[0];
    expect(markdownProps.children).toContain(
      '<img alt="Logo" src="public/images/logo128.png">'
    );
    expect(markdownProps.children).toContain("| 整页翻译 | 分批请求 |");
    expect(markdownProps.remarkPlugins).toEqual(
      expect.arrayContaining([expect.objectContaining({ plugin: "gfm" })])
    );
    expect(markdownProps.rehypePlugins.map((plugin) => plugin.plugin)).toEqual([
      "raw",
      "sanitize",
    ]);
    expect(markdownProps.components.a).toEqual(expect.any(Function));

    act(() => root.unmount());
  });
});

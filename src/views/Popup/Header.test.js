/* eslint-disable testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import Header from "./Header";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

jest.mock("../../components/Logo", () => () => null);

describe("Popup Header actions", () => {
  let container;
  let root;
  let originalWindowOpen;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalWindowOpen = window.open;
    window.open = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
    window.open = originalWindowOpen;
  });

  test("places window and settings actions without sponsor or review links", () => {
    act(() => {
      root.render(
        <Header openSeparateWindow={jest.fn()} openSettings={jest.fn()} />
      );
    });

    const separate = container.querySelector(".kt-popup-header__window");
    const settings = container.querySelector('[aria-label="setting"]');

    expect(container.querySelector('[aria-label="popup_support"]')).toBeNull();
    expect(container.textContent).not.toContain("appreciate_support");
    expect(container.textContent).not.toContain("comment_support");
    expect(separate.textContent).toBe("popup_open_separate_window");
    expect(separate.getAttribute("aria-label")).toBe(
      "popup_open_separate_window · popup_text_translation"
    );
    expect(separate.compareDocumentPosition(settings)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(container.querySelector(".kt-popup-header__title").textContent).toBe(
      "app_name"
    );
  });

  test("collapses to a close button when hosted in the page", () => {
    const onClose = jest.fn();
    act(() => root.render(<Header onClose={onClose} />));

    const close = container.querySelector('[aria-label="close"]');
    expect(close).not.toBeNull();
    expect(container.querySelector(".kt-popup-header__window")).toBeNull();

    act(() => close.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("opens the separate text window from the visible header action", () => {
    const openSeparateWindow = jest.fn();
    act(() => {
      root.render(
        <Header
          openSeparateWindow={openSeparateWindow}
          openSettings={jest.fn()}
        />
      );
    });

    act(() => container.querySelector(".kt-popup-header__window").click());
    expect(openSeparateWindow).toHaveBeenCalledTimes(1);
  });
});

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Homepage from "./App";
import { homepageContent, LICENSE_SOURCE_URL } from "./content";

jest.mock("@mui/material/styles/ThemeProvider", () => {
  return function MockThemeProvider({ children }) {
    return children;
  };
});

describe("homepage", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  test("does not embed introduction videos", () => {
    act(() => root.render(<Homepage />));

    const markup = container.innerHTML.toLowerCase();

    expect(container.querySelectorAll("iframe")).toHaveLength(0);
    expect(markup).not.toContain("youtube.com/" + "embed");
    expect(markup).not.toContain("youtube.com/" + "watch");
  });

  test("shows one license attribution line in the footer", () => {
    act(() => root.render(<Homepage />));

    const footer = container.querySelector("footer");
    const links = [...footer.querySelectorAll("a")];

    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe(homepageContent.en.licenseAttribution);
    expect(links[0].getAttribute("href")).toBe(LICENSE_SOURCE_URL);
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.querySelectorAll("footer")).toHaveLength(1);
  });
});

import { act } from "react";
import { createRoot } from "react-dom/client";
import About from "./About";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key) => key,
}));

test("shows project information and links without duplicated usage details", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<About />));

  expect(container.textContent).toContain("app_name");
  expect(container.textContent).toContain("settings_about_description");
  expect(container.textContent).toContain("settings_about_license");
  expect(container.querySelector(".MuiAccordion-root")).toBeNull();
  const links = Array.from(container.querySelectorAll("a"));
  expect(links.map((link) => link.textContent)).toEqual([
    "GitHub",
    "settings_project_website",
  ]);
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    process.env.REACT_APP_HOMEPAGE,
    process.env.REACT_APP_SITEURL,
  ]);
  links.forEach((link) => {
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noreferrer");
  });

  act(() => root.unmount());
});

import { DEFAULT_IGNORE_SELECTOR, GLOBLA_RULE } from "./rules";

const PREVIOUS_IGNORE_ENTRIES = [
  "button",
  "footer",
  "pre",
  "mark",
  "nav",
  "svg",
  "img[src*='.svg']",
  "[class*='logo'] svg",
  "[id*='logo'] svg",
];

test("appends role=navigation to the default ignore list and keeps earlier entries", () => {
  expect(DEFAULT_IGNORE_SELECTOR.split(", ")).toEqual([
    ...PREVIOUS_IGNORE_ENTRIES,
    '[role="navigation"]',
  ]);
  expect(GLOBLA_RULE.ignoreSelector).toBe(DEFAULT_IGNORE_SELECTOR);
});

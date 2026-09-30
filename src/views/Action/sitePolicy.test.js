import { GLOBAL_KEY } from "../../config";
import { readSiteTransOpen, siteRulePattern } from "./sitePolicy";

// rules.js imports these modules; keep this unit test off that graph.
jest.mock("../../libs/subRules", () => ({
  loadOrFetchSubRules: jest.fn(),
}));
jest.mock("../../libs/sync", () => ({
  trySyncRules: jest.fn(),
}));

test("reads the matching personal rule and falls back to follow-global", () => {
  const href = "https://news.example.com/item";
  const rules = [
    { pattern: "other.example", transOpen: "true" },
    { pattern: "news.example.com", transOpen: "false", selector: "article" },
    { pattern: "*", transOpen: "true" },
  ];

  expect(readSiteTransOpen(href, rules)).toBe("false");
  expect(siteRulePattern(href, rules)).toBe("news.example.com");
  expect(readSiteTransOpen(href, [{ pattern: "*", transOpen: "true" }])).toBe(
    GLOBAL_KEY
  );
  expect(readSiteTransOpen(href, [{ pattern: "news.example.com" }])).toBe(
    GLOBAL_KEY
  );
  expect(siteRulePattern("https://example.com/post", [])).toBe("example.com");
  expect(siteRulePattern("chrome://extensions", [])).toBe("");
});

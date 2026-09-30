import { EVENT_KISS_INNER, MSG_SAVE_RULE, MSG_TRANS_CURRULE } from "../config";
import { browser } from "./browser";
import { sendBgMsg } from "./msg";
import { saveRule } from "./rules";
import { getRulesWithDefault } from "./storage";
import {
  effectiveTransOpen,
  persistSharedSiteRule,
  pickSharedRulePatch,
  publishPageRule,
} from "./pageRuleSync";

jest.mock("./client", () => ({ isExt: true }));
jest.mock("./msg", () => ({ sendBgMsg: jest.fn() }));
jest.mock("./storage", () => ({ getRulesWithDefault: jest.fn() }));
jest.mock("./rules", () => ({
  findMatchingRule: (rules, href) =>
    (rules || []).find(
      (rule) => rule.pattern !== "*" && href.includes(rule.pattern)
    ),
  saveRule: jest.fn(),
}));
jest.mock("./browser", () => ({
  browser: { runtime: { sendMessage: jest.fn(() => Promise.resolve()) } },
}));
jest.mock("./subRules", () => ({ loadOrFetchSubRules: jest.fn() }));
jest.mock("./sync", () => ({ trySyncRules: jest.fn() }));

describe("page rule sync", () => {
  beforeEach(() => {
    sendBgMsg.mockReset();
    saveRule.mockReset();
    getRulesWithDefault.mockReset();
    browser.runtime.sendMessage.mockClear();
  });

  test("keeps shared rule fields and drops advanced-only ones", () => {
    expect(
      pickSharedRulePatch({
        apiSlug: "deepl",
        toLang: "fr",
        fromLang: "en",
        transOnly: false,
        transOpen: true,
        textStyle: "fuzzy",
        hasRichText: "true",
        scanAll: "true",
        isPlainText: true,
        autoScan: "false",
        empty: "",
      })
    ).toEqual({
      apiSlug: "deepl",
      toLang: "fr",
      fromLang: "en",
      transOnly: "false",
      transOpen: "true",
      textStyle: "fuzzy",
    });
    expect(pickSharedRulePatch(null)).toEqual({});
  });

  test.each([
    ["true", "false", "true"],
    ["false", "true", "false"],
    ["*", "true", "true"],
    ["*", "false", "false"],
    ["*", "*", "false"],
    [undefined, undefined, "false"],
  ])("effective transOpen(%s, global %s) is %s", (site, global, expected) => {
    expect(effectiveTransOpen(site, global)).toBe(expected);
  });

  test("publishes the current rule in-page and to the toolbar popup", () => {
    const received = [];
    const onInner = (event) => received.push(event.detail);
    document.addEventListener(EVENT_KISS_INNER, onInner);
    publishPageRule({
      rule: { apiSlug: "deepl", toLang: "fr", transOpen: "true" },
      isTopFrame: true,
      document: { token: "page" },
    });
    document.removeEventListener(EVENT_KISS_INNER, onInner);

    expect(received).toEqual([
      {
        action: MSG_TRANS_CURRULE,
        rule: { apiSlug: "deepl", toLang: "fr", transOpen: "true" },
        isTopFrame: true,
        document: { token: "page" },
      },
    ]);
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: MSG_TRANS_CURRULE,
      args: received[0],
    });
  });

  test("persists a shared patch on the matching personal rule", async () => {
    getRulesWithDefault.mockResolvedValue([
      { pattern: "example.com", selector: "article", transOpen: "*" },
      { pattern: "*", transOpen: "false" },
    ]);
    await persistSharedSiteRule(
      { toLang: "ja", hasRichText: "true" },
      "https://example.com/post"
    );
    expect(sendBgMsg).toHaveBeenCalledWith(MSG_SAVE_RULE, {
      pattern: "example.com",
      toLang: "ja",
    });
    expect(saveRule).not.toHaveBeenCalled();
  });

  test("does not invent a personal rule when the page has no host pattern", async () => {
    getRulesWithDefault.mockResolvedValue([]);
    await persistSharedSiteRule({ apiSlug: "deepl" }, "chrome://extensions");
    expect(sendBgMsg).not.toHaveBeenCalled();
  });
});

jest.mock("../../libs/subRules", () => ({
  loadOrFetchSubRules: jest.fn(),
}));
jest.mock("../../libs/sync", () => ({
  trySyncRules: jest.fn(),
}));
jest.mock("../../libs/log", () => ({
  kissLog: jest.fn(),
  LogLevel: { INFO: { value: 1, name: "INFO" } },
}));
jest.mock("../../libs/msg", () => ({
  sendBgMsg: jest.fn(),
}));
jest.mock("../../libs/client", () => ({
  isExt: false,
}));

const storedRef = { rules: [] };

jest.mock("../../libs/storage", () => ({
  getRulesWithDefault: jest.fn(async () => storedRef.rules),
  saveEdit: jest.fn(async (_key, update) => {
    storedRef.rules = update(storedRef.rules);
    return { value: storedRef.rules, changed: true };
  }),
  getDisabledSubRules: jest.fn(async () => []),
}));

const { saveRule } = require("../../libs/rules");
const { saveEdit, getRulesWithDefault } = require("../../libs/storage");
const { writeSiteTransOpen } = require("./sitePolicy");
const { GLOBLA_RULE } = require("../../config/rules");

describe("site policy writes", () => {
  beforeEach(() => {
    storedRef.rules = [{ ...GLOBLA_RULE }];
    getRulesWithDefault.mockImplementation(async () =>
      storedRef.rules.map((rule) => ({ ...rule }))
    );
    saveEdit.mockImplementation(async (_key, update) => {
      const value = update(await getRulesWithDefault());
      storedRef.rules = value;
      return { value, changed: true };
    });
  });

  test("two different patterns for one page stay as two rules", async () => {
    await saveRule({ pattern: "*.example.com", transOpen: "true" });
    await saveRule({ pattern: "example.com", transOpen: "true" });
    const personal = storedRef.rules
      .filter((rule) => rule.pattern !== "*")
      .map((rule) => rule.pattern)
      .sort();
    expect(personal).toEqual(["*.example.com", "example.com"]);
  });

  test("toggling the site switch five times leaves one rule", async () => {
    const href = "https://news.example.com/item";
    const values = ["true", "false", "*", "true", "false"];
    for (const transOpen of values) {
      await writeSiteTransOpen(href, transOpen, storedRef.rules);
    }
    const personal = storedRef.rules.filter((rule) => rule.pattern !== "*");
    expect(personal).toHaveLength(1);
    expect(personal[0].pattern).toBe("news.example.com");
    expect(personal[0].transOpen).toBe("false");
  });

  test("each site policy is stored and read back as the same enum", async () => {
    const href = "http://localhost:8765/index.html";
    const { SITE_TRANS_OPEN, readSiteTransOpen } = require("./sitePolicy");
    for (const policy of [
      SITE_TRANS_OPEN.AUTO_TRANSLATE,
      SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE,
    ]) {
      storedRef.rules = [{ ...GLOBLA_RULE }];
      await writeSiteTransOpen(href, policy, storedRef.rules);
      const personal = storedRef.rules.filter((rule) => rule.pattern !== "*");
      expect(personal).toEqual([
        { pattern: "localhost:8765", transOpen: policy },
      ]);
      expect(readSiteTransOpen(href, storedRef.rules)).toBe(policy);
    }
    storedRef.rules = [{ ...GLOBLA_RULE }];
    await writeSiteTransOpen(
      href,
      SITE_TRANS_OPEN.FOLLOW_GLOBAL,
      storedRef.rules
    );
    expect(storedRef.rules.filter((rule) => rule.pattern !== "*")).toEqual([]);
    expect(readSiteTransOpen(href, storedRef.rules)).toBe(
      SITE_TRANS_OPEN.FOLLOW_GLOBAL
    );
    await expect(
      writeSiteTransOpen(href, false, storedRef.rules)
    ).rejects.toThrow(/Unknown site translation policy/);
    await expect(
      writeSiteTransOpen(href, "bogus", storedRef.rules)
    ).rejects.toThrow(/Unknown site translation policy/);
  });
});

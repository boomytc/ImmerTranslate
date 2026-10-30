import { GLOBLA_RULE } from "../config/rules";
import { matchesRulePattern, saveRule, saveRuleMessage } from "./rules";
import { saveEdit } from "./storage";
import { trySyncRules } from "./sync";
import {
  readSiteTransOpen,
  siteRulePattern,
  writeSiteTransOpen,
} from "../views/Action/sitePolicy";

const mockStored = { rules: [] };

jest.mock("./storage", () => ({
  getRulesWithDefault: jest.fn(async () => mockStored.rules),
  saveEdit: jest.fn(async (_key, reducer) => {
    mockStored.rules = reducer(mockStored.rules);
    return { value: mockStored.rules, changed: true };
  }),
}));
jest.mock("./sync", () => ({ trySyncRules: jest.fn() }));

beforeEach(() => {
  mockStored.rules = [{ ...GLOBLA_RULE }];
  saveEdit.mockImplementation(async (_key, reducer) => {
    mockStored.rules = reducer(mockStored.rules);
    return { value: mockStored.rules, changed: true };
  });
});

test.each(["x.com", "hostname:x.com"])(
  "%s matches only the named host, not lookalikes or URL text",
  (pattern) => {
    expect(matchesRulePattern("https://x.com/home", pattern)).toBe(true);
    expect(matchesRulePattern("https://x.com:8443/home", pattern)).toBe(true);
    for (const href of [
      "https://box.com/",
      "https://netflix.com/",
      "https://x.com.evil.test/",
      "https://www.x.com/",
      "https://example.org/x.com",
      "https://example.org/?next=x.com",
    ]) {
      expect(matchesRulePattern(href, pattern)).toBe(false);
    }
  }
);

test("host wildcards and ports have their own explicit scopes", () => {
  expect(matchesRulePattern("https://news.x.com/", "*.x.com")).toBe(true);
  expect(matchesRulePattern("https://x.com/", "*.x.com")).toBe(true);
  expect(matchesRulePattern("https://box.com/", "*.x.com")).toBe(false);
  expect(matchesRulePattern("https://x.com:8443/", "x.com:8443")).toBe(true);
  expect(matchesRulePattern("https://x.com:9443/", "x.com:8443")).toBe(false);
  expect(matchesRulePattern("https://x.com/", "x.com:8443")).toBe(false);
  expect(matchesRulePattern("https://x.com/", "x.com:443")).toBe(true);
  expect(matchesRulePattern("https://x.com:8443/", "x.com")).toBe(true);
  expect(
    matchesRulePattern("https://example.org/path/123", "example.org/path/*")
  ).toBe(true);
});

test("hostnames retain IPv6 and international domain support without matching URL text", () => {
  for (const pattern of ["[::1]", "hostname:[::1]"]) {
    expect(matchesRulePattern("http://[::1]:8080/page", pattern)).toBe(true);
    expect(matchesRulePattern("http://[::2]:8080/?next=[::1]", pattern)).toBe(
      false
    );
  }
  expect(matchesRulePattern("https://例子.测试/page", "例子.测试")).toBe(true);
  expect(
    matchesRulePattern("https://other.test/?next=例子.测试", "例子.测试")
  ).toBe(false);
});

test("file extension and explicit path patterns retain their existing matching behavior", () => {
  expect(matchesRulePattern("file:///tmp/report.txt", "*.txt")).toBe(true);
  expect(matchesRulePattern("file:///tmp/report.txt", "/tmp/*.txt")).toBe(true);
  expect(matchesRulePattern("file:///tmp/x.com", "x.com")).toBe(false);
});

test("IPv6 hostname aliases address one exact rule while distinct ports stay separate", async () => {
  await saveRule({ pattern: "hostname:[::1]", apiSlug: "Google" });
  await saveRule({ pattern: "[::1]", transOpen: "true" });
  await saveRule({ pattern: "[::1]:8080", transOpen: "false" });
  expect(mockStored.rules.filter((rule) => rule.pattern !== "*")).toEqual([
    { pattern: "[::1]:8080", transOpen: "false" },
    { pattern: "hostname:[::1]", apiSlug: "Google", transOpen: "true" },
  ]);
});

test.each([
  ["x.com", "box.com"],
  ["box.com", "x.com"],
])("saving %s then %s keeps independent records", async (first, second) => {
  await saveRule({ pattern: first, apiSlug: "Google" });
  await saveRule({ pattern: second, transOpen: "true" });
  expect(mockStored.rules.filter((rule) => rule.pattern !== "*")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pattern: first, apiSlug: "Google" }),
      expect.objectContaining({ pattern: second, transOpen: "true" }),
    ])
  );
  expect(mockStored.rules.filter((rule) => rule.pattern !== "*")).toHaveLength(
    2
  );
});

test("host aliases update the same rule without merging wildcard or port scopes", async () => {
  await saveRule({ pattern: "hostname:x.com", apiSlug: "Google" });
  await saveRule({ pattern: "x.com", transOpen: "true" });
  await saveRule({ pattern: "*.x.com", transOpen: "false" });
  await saveRule({ pattern: "x.com:8443", apiSlug: "Other" });
  expect(mockStored.rules.filter((rule) => rule.pattern !== "*")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pattern: "hostname:x.com",
        apiSlug: "Google",
        transOpen: "true",
      }),
      expect.objectContaining({ pattern: "*.x.com", transOpen: "false" }),
      expect.objectContaining({ pattern: "x.com:8443", apiSlug: "Other" }),
    ])
  );
  expect(mockStored.rules.filter((rule) => rule.pattern !== "*")).toHaveLength(
    3
  );
});

test("an explicitly saved service remains fixed even when it currently equals the global service", async () => {
  mockStored.rules = [{ ...GLOBLA_RULE, apiSlug: "Google" }];
  await saveRule({ pattern: "x.com", apiSlug: "Google" });
  expect(mockStored.rules).toContainEqual({
    pattern: "x.com",
    apiSlug: "Google",
  });
});

test("updating a selected rule preserves the priority of other personal rules", async () => {
  mockStored.rules = [
    { pattern: "x.com", transOpen: "true" },
    { pattern: "*.x.com", transOpen: "true" },
    { ...GLOBLA_RULE },
  ];
  await saveRule({ pattern: "*.x.com", transOpen: "false" });
  expect(mockStored.rules.map(({ pattern }) => pattern)).toEqual([
    "x.com",
    "*.x.com",
    "*",
  ]);
  expect(readSiteTransOpen("https://x.com/", mockStored.rules)).toBe("true");
});

test("when historical aliases both exist an explicit target updates only that record", async () => {
  mockStored.rules = [
    { pattern: "x.com", transOpen: "true" },
    { pattern: "hostname:x.com", transOpen: "false" },
    { ...GLOBLA_RULE },
  ];
  expect(
    readSiteTransOpen("https://x.com/", mockStored.rules, "hostname:x.com")
  ).toBe("false");
  await saveRule({ pattern: "hostname:x.com", apiSlug: "Google" });
  expect(mockStored.rules[0]).toEqual({ pattern: "x.com", transOpen: "true" });
  expect(mockStored.rules[1]).toEqual({
    pattern: "hostname:x.com",
    transOpen: "false",
    apiSlug: "Google",
  });
});

test("site controls resolve an exact alias without changing a matching wildcard", () => {
  const href = "https://news.x.com/post";
  const rules = [
    { pattern: "*.x.com", transOpen: "true" },
    { pattern: "hostname:news.x.com", transOpen: "false" },
    { ...GLOBLA_RULE },
  ];
  expect(siteRulePattern(href, rules)).toBe("hostname:news.x.com");
  expect(readSiteTransOpen(href, rules, "news.x.com")).toBe("false");
  expect(siteRulePattern(href, [rules[0], rules[2]])).toBe("news.x.com");
});

test("default edits create a host rule; an explicitly selected wildcard edits only that wildcard", async () => {
  const href = "https://news.x.com/post";
  mockStored.rules = [
    { pattern: "*.x.com", transOpen: "true", selector: "article" },
    { ...GLOBLA_RULE },
  ];
  await writeSiteTransOpen(href, "false", mockStored.rules, {
    throughBackground: false,
  });
  expect(mockStored.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pattern: "news.x.com", transOpen: "false" }),
      expect.objectContaining({
        pattern: "*.x.com",
        transOpen: "true",
        selector: "article",
      }),
    ])
  );
  await writeSiteTransOpen(href, "false", mockStored.rules, {
    throughBackground: false,
    pattern: "*.x.com",
  });
  expect(mockStored.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pattern: "news.x.com", transOpen: "false" }),
      expect.objectContaining({
        pattern: "*.x.com",
        transOpen: "false",
        selector: "article",
      }),
    ])
  );
});

test.each([
  ["x.com", "hostname:x.com"],
  ["hostname:x.com", "x.com"],
])(
  "editing %s through %s preserves the other saved fields",
  async (storedPattern, editedPattern) => {
    mockStored.rules = [
      {
        pattern: storedPattern,
        transOpen: "true",
        apiSlug: "Google",
        selector: "article",
      },
      { ...GLOBLA_RULE },
    ];
    await saveRule({ pattern: editedPattern, apiSlug: "Other" });
    expect(mockStored.rules[0]).toMatchObject({
      pattern: storedPattern,
      transOpen: "true",
      apiSlug: "Other",
      selector: "article",
    });
    await saveRule({ pattern: editedPattern, transOpen: "false" });
    expect(mockStored.rules[0]).toMatchObject({
      pattern: storedPattern,
      transOpen: "false",
      apiSlug: "Other",
      selector: "article",
    });
    expect(
      mockStored.rules.filter((rule) => rule.pattern !== "*")
    ).toHaveLength(1);
  }
);

test.each([
  ["x.com", "x.com"],
  ["hostname:x.com", "x.com"],
  ["x.com", "hostname:x.com"],
  ["*.x.com", "*.x.com"],
  ["x.com:800", "x.com:800"],
])(
  "rejects quick saves to disabled %s through %s",
  async (storedPattern, pattern) => {
    const disabled = Object.freeze({
      pattern: storedPattern,
      enabled: false,
      selector: "article",
    });
    const before = Object.freeze([disabled, Object.freeze({ ...GLOBLA_RULE })]);
    mockStored.rules = before;
    for (const patch of [
      { transOpen: "true" },
      { transOpen: "false" },
      { transOpen: "*" },
      { apiSlug: "Google" },
    ]) {
      const request = Object.freeze({ pattern, ...patch });
      await expect(saveRule(request)).rejects.toThrow("rule-disabled");
      await expect(saveRuleMessage(request)).resolves.toEqual({
        error: "rule-disabled",
      });
      expect(mockStored.rules).toBe(before);
      expect(mockStored.rules[0]).toEqual(disabled);
    }
    await expect(
      writeSiteTransOpen("https://x.com/", "true", before, {
        throughBackground: false,
        pattern,
      })
    ).rejects.toThrow("rule-disabled");
    expect(mockStored.rules).toBe(before);
    expect(trySyncRules).not.toHaveBeenCalled();
  }
);

test("a failed save reports an error once without scheduling synchronization", async () => {
  saveEdit.mockRejectedValueOnce(new Error("storage failed"));
  const before = mockStored.rules;
  await expect(
    saveRuleMessage({ pattern: "x.com", transOpen: "true" })
  ).resolves.toEqual({
    error: "storage failed",
  });
  expect(saveEdit).toHaveBeenCalledTimes(1);
  expect(trySyncRules).not.toHaveBeenCalled();
  expect(mockStored.rules).toBe(before);
});

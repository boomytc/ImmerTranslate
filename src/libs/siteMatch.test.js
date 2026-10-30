import { matchesSiteEntry, parseHostEntry, sameRulePattern } from "./siteMatch";

describe("matchesSiteEntry", () => {
  test("does not let x.com match lookalike hosts or query text", () => {
    expect(matchesSiteEntry("https://x.com/home", "x.com")).toBe(true);
    expect(matchesSiteEntry("https://www.netflix.com/", "x.com")).toBe(false);
    expect(matchesSiteEntry("https://box.com/files", "x.com")).toBe(false);
    expect(matchesSiteEntry("https://google.com/search?q=x.com", "x.com")).toBe(
      false
    );
  });

  test("does not let github.com match github.com.cn", () => {
    expect(matchesSiteEntry("https://github.com/immer", "github.com")).toBe(
      true
    );
    expect(matchesSiteEntry("https://github.com.cn/", "github.com")).toBe(
      false
    );
    expect(matchesSiteEntry("https://www.github.com/", "github.com")).toBe(
      false
    );
  });

  test.each([
    ["example.com.", "https://example.com./", "https://example.com.evil/"],
    [
      "my_service.local",
      "http://my_service.local/",
      "http://my_service.local.evil/",
    ],
    [
      "my_service.local:800",
      "http://my_service.local:800/",
      "http://my_service.local:8000/",
    ],
    [
      "my_service.local.:800",
      "http://my_service.local.:800/",
      "http://my_service.local.:8000/",
    ],
  ])("matches URL host entry %s exactly", (pattern, target, lookalike) => {
    expect(parseHostEntry(pattern)).not.toBeNull();
    expect(matchesSiteEntry(target, pattern)).toBe(true);
    expect(matchesSiteEntry(lookalike, pattern)).toBe(false);
    expect(
      matchesSiteEntry(`https://other.test/?next=${pattern}`, pattern)
    ).toBe(false);
    expect(matchesSiteEntry(`https://child.${pattern}/`, pattern)).toBe(false);
    expect(sameRulePattern(pattern, `hostname:${pattern}`)).toBe(true);
  });

  test.each([
    ["example.com:080", "http://example.com/", "80"],
    ["example.com:0443", "https://example.com/", "443"],
    ["my_service.local:0800", "http://my_service.local:800/", "800"],
    ["[::1]:080", "http://[::1]/", "80"],
    ["*.example.com.:0800", "http://child.example.com.:800/", "800"],
    ["example.com:000", "http://example.com:0/", "0"],
  ])("normalizes numeric port in %s", (pattern, target, port) => {
    expect(parseHostEntry(pattern).port).toBe(port);
    expect(matchesSiteEntry(target, pattern)).toBe(true);
    expect(sameRulePattern(pattern, pattern.replace(/:\d+$/, `:${port}`))).toBe(
      true
    );
    const otherPort = new URL(target);
    otherPort.port = "8000";
    expect(matchesSiteEntry(otherPort.href, pattern)).toBe(false);
  });

  test("keeps trailing dots and wildcard label boundaries in host comparisons", () => {
    expect(matchesSiteEntry("https://example.com/", "example.com.")).toBe(
      false
    );
    expect(matchesSiteEntry("https://example.com./", "example.com")).toBe(
      false
    );
    expect(
      matchesSiteEntry("http://my_service.local.:800/", "*.my_service.local.:*")
    ).toBe(true);
    expect(
      matchesSiteEntry(
        "http://a.my_service.local.:800/",
        "*.*.my_service.local.:800"
      )
    ).toBe(true);
    expect(
      matchesSiteEntry(
        "http://my_service.local.:800/",
        "*.*.my_service.local.:800"
      )
    ).toBe(false);
    expect(
      matchesSiteEntry(
        "http://my_service.local.evil:800/",
        "*.my_service.local.:800"
      )
    ).toBe(false);
  });

  test("matches a bare domain and its subdomains for *.example.com", () => {
    expect(matchesSiteEntry("https://example.com/", "*.example.com")).toBe(
      true
    );
    expect(
      matchesSiteEntry("https://sub.example.com/test", "*.example.com")
    ).toBe(true);
    expect(
      matchesSiteEntry("https://a.b.example.com/test", "*.example.com")
    ).toBe(true);
    expect(matchesSiteEntry("https://example.com.cn/", "*.example.com")).toBe(
      false
    );
    expect(matchesSiteEntry("https://notexample.com/", "*.example.com")).toBe(
      false
    );
  });

  test("requires the port when the entry includes one", () => {
    expect(
      matchesSiteEntry("https://example.com:8443/a", "example.com:8443")
    ).toBe(true);
    expect(matchesSiteEntry("https://example.com/a", "example.com:8443")).toBe(
      false
    );
    expect(
      matchesSiteEntry("https://example.com:9443/a", "example.com:8443")
    ).toBe(false);
    expect(
      matchesSiteEntry("https://example.com:8443/a", "*.example.com:8443")
    ).toBe(true);
    expect(
      matchesSiteEntry("https://example.com/a", "*.example.com:8443")
    ).toBe(false);
    expect(matchesSiteEntry("https://example.com:8443/a", "example.com")).toBe(
      true
    );
  });

  test("falls back to isMatch for paths, protocols, and bare wildcards", () => {
    expect(
      matchesSiteEntry(
        "https://example.com/search?q=1",
        "https://example.com/search"
      )
    ).toBe(true);
    expect(
      matchesSiteEntry("https://example.com/search?q=1", "example.com/other")
    ).toBe(false);
    expect(matchesSiteEntry("https://example.com/any", "*")).toBe(true);
    expect(matchesSiteEntry("file:///tmp/report.txt", "*.txt")).toBe(true);
    expect(matchesSiteEntry("file:///tmp/report.csv", "*.txt")).toBe(false);
    expect(
      matchesSiteEntry(
        "https://sub.example.com/a/b?q=1",
        "*example.com/a/*?q=*"
      )
    ).toBe(true);
    expect(
      matchesSiteEntry(
        "https://sub.example.com/c/b?q=1",
        "*example.com/a/*?q=*"
      )
    ).toBe(false);
  });

  test("rejects empty input", () => {
    expect(matchesSiteEntry("", "example.com")).toBe(false);
    expect(matchesSiteEntry("https://example.com/", "")).toBe(false);
    expect(matchesSiteEntry(null, "example.com")).toBe(false);
  });
});

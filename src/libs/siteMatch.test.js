import { matchesSiteEntry } from "./siteMatch";

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
  });

  test("rejects empty input", () => {
    expect(matchesSiteEntry("", "example.com")).toBe(false);
    expect(matchesSiteEntry("https://example.com/", "")).toBe(false);
    expect(matchesSiteEntry(null, "example.com")).toBe(false);
  });
});

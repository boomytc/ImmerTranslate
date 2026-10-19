import {
  isInBlacklist,
  matchingBlacklistEntries,
  removeBlacklistEntry,
} from "./blacklist";

describe("matchingBlacklistEntries", () => {
  const href = "https://news.example.com/item";

  test("isInBlacklist is the non-empty result of the same matcher", () => {
    const list = "localhost\n*.example.com\nkeep.example";
    const hits = matchingBlacklistEntries(list, href);
    expect(hits).toEqual(["*.example.com"]);
    expect(isInBlacklist(href, list)).toBe(hits.length > 0);
    expect(isInBlacklist(href, "keep.example")).toBe(
      matchingBlacklistEntries("keep.example", href).length > 0
    );
  });

  test("keeps wide and legacy substring entries that isMatch already accepts", () => {
    expect(
      matchingBlacklistEntries(
        "localhost\n*.x.com\nx.com",
        "http://localhost:3000/app"
      )
    ).toEqual(["localhost"]);
    expect(
      matchingBlacklistEntries("*.x.com\nx.com", "https://foo.x.com/home")
    ).toEqual(["*.x.com", "x.com"]);
    expect(
      matchingBlacklistEntries("x.com", "https://netflix.com/watch")
    ).toEqual(["x.com"]);
  });

  test("removeBlacklistEntry drops only the named entry", () => {
    expect(
      removeBlacklistEntry("localhost\n*.x.com\nkeep.example", "localhost")
    ).toBe("*.x.com\nkeep.example");
    expect(
      removeBlacklistEntry("example.com, other.example", "example.com")
    ).toBe("other.example");
  });
});

import { readRedditEmbeddingHref, redditEmbeddingHref } from "./redditFrame";

describe("redditEmbeddingHref", () => {
  test("reads a cross-origin GIS frame through ancestorOrigins", () => {
    const win = {
      top: {
        get location() {
          throw new Error("cross-origin");
        },
      },
      location: {
        ancestorOrigins: {
          0: "https://accounts.google.com",
          1: "https://www.reddit.com",
          length: 2,
        },
      },
      document: { referrer: "" },
    };

    expect(readRedditEmbeddingHref(win, true)).toBe("https://www.reddit.com");
  });

  test("reads an about:blank frame from the same-origin top page", () => {
    const topHref =
      "https://new.reddit.com/r/announcements/comments/pg006s/covid/";
    const win = {
      top: { location: { href: topHref } },
      location: {
        href: "about:blank",
        ancestorOrigins: ["https://new.reddit.com"],
      },
      document: { referrer: topHref },
    };

    expect(readRedditEmbeddingHref(win, true)).toBe(topHref);
  });

  test("falls back to document.referrer when the top page is hidden", () => {
    const win = {
      top: {
        get location() {
          throw new Error("cross-origin");
        },
      },
      location: {},
      document: { referrer: "https://sh.reddit.com/r/test/" },
    };

    expect(readRedditEmbeddingHref(win, true)).toBe(
      "https://sh.reddit.com/r/test/"
    );
  });

  test("leaves top documents and non-reddit frames on their own href", () => {
    const redditTop = {
      top: { location: { href: "https://www.reddit.com/r/test/" } },
      location: { ancestorOrigins: ["https://www.reddit.com"] },
      document: { referrer: "https://www.reddit.com/r/test/" },
    };
    expect(readRedditEmbeddingHref(redditTop, false)).toBe("");

    const githubFrame = {
      top: { location: { href: "https://github.com/boomytc/ImmerTranslate" } },
      location: { ancestorOrigins: ["https://github.com"] },
      document: { referrer: "https://github.com/boomytc/ImmerTranslate" },
    };
    expect(readRedditEmbeddingHref(githubFrame, true)).toBe("");

    const oldReddit = {
      top: { location: { href: "https://old.reddit.com/r/test/" } },
      location: { ancestorOrigins: ["https://old.reddit.com"] },
      document: { referrer: "https://old.reddit.com/r/test/" },
    };
    expect(readRedditEmbeddingHref(oldReddit, true)).toBe("");
    expect(
      redditEmbeddingHref({
        isIframe: true,
        topHref: "https://chat.reddit.com/room",
      })
    ).toBe("");
  });
});

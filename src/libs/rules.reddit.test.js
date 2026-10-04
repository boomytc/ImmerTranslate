import { findMatchingRule, mergeRules } from "./rules";
import { BUILTIN_RULES, GLOBLA_RULE } from "../config/rules";
import { visitTranslationTargets } from "./translationTargets";

jest.mock("./storage", () => ({
  getRulesWithDefault: jest.fn(),
  saveEdit: jest.fn(),
  getDisabledSubRules: jest.fn(),
}));

jest.mock("./subRules", () => ({
  loadOrFetchSubRules: jest.fn(),
}));

jest.mock("./sync", () => ({
  trySyncRules: jest.fn(),
}));

jest.mock("./log", () => ({
  kissLog: jest.fn(),
  LogLevel: { INFO: { value: 3 } },
}));

const REDDIT_HOSTS = ["www.reddit.com", "new.reddit.com", "sh.reddit.com"];

function redditRule(pattern = "www.reddit.com") {
  return BUILTIN_RULES.find((rule) => rule.pattern === pattern);
}

function collectTargets(html, pattern = "www.reddit.com") {
  document.body.innerHTML = html;
  const rule = redditRule(pattern);
  const effective = mergeRules(GLOBLA_RULE, rule);
  const targets = [];
  visitTranslationTargets(
    document.body,
    {
      autoScan: effective.autoScan,
      selector: effective.selector,
      ignoreSelector: effective.ignoreSelector,
      isBlock: () => false,
      hasText: () => false,
      wrapperClass: "kiss-wrapper",
    },
    (node) => targets.push(node)
  );
  return { effective, rule, targets };
}

function targetIds(targets) {
  return targets.map((node) => node.id).filter(Boolean);
}

describe("reddit builtin page rules", () => {
  test("adds only the three public hosts and leaves other builtin rules alone", () => {
    const patterns = BUILTIN_RULES.map((rule) => rule.pattern);
    expect(patterns).toEqual(
      expect.arrayContaining([
        ...REDDIT_HOSTS,
        "github.com",
        "en.wikipedia.org",
        "news.ycombinator.com",
      ])
    );
    expect(patterns).not.toContain("old.reddit.com");
    expect(patterns).not.toContain("reddit.com");
    expect(patterns.filter((pattern) => pattern.includes("reddit"))).toEqual(
      REDDIT_HOSTS
    );

    const selectors = REDDIT_HOSTS.map(
      (pattern) => redditRule(pattern).selector
    );
    expect(new Set(selectors).size).toBe(1);
    for (const pattern of REDDIT_HOSTS) {
      const rule = redditRule(pattern);
      expect(rule.autoScan).toBe("false");
      expect(rule.keepSelector).toBeUndefined();
      expect(rule.ignoreSelector).toBe(
        '+header, +[role="navigation"], +[role="banner"]'
      );
      expect(rule.selector).toContain('[id^="post-title"]');
      expect(rule.selector).toContain('[data-testid="post-title-text"]');
      expect(rule.selector).toContain('[slot="text-body"]');
      expect(rule.selector).toContain('[slot="comment"]');
      expect(rule.selector).toContain("recent-posts h3");
      expect(rule.selector).toContain("#AppRouter-main-content");
      expect(rule.selector).toContain("#overlayScrollContainer");
      expect(rule.selector).not.toContain("[class^=");
      expect(rule.selector).not.toContain(">>>");
      expect(rule.selector).not.toContain(".usertext");
      expect(rule.selector).not.toContain("aside");
    }
  });

  test("matches each public host and does not claim old.reddit.com", () => {
    expect(
      findMatchingRule(
        BUILTIN_RULES,
        "https://www.reddit.com/r/test/comments/abc/title/"
      ).pattern
    ).toBe("www.reddit.com");
    expect(
      findMatchingRule(BUILTIN_RULES, "https://new.reddit.com/r/test/").pattern
    ).toBe("new.reddit.com");
    expect(
      findMatchingRule(
        BUILTIN_RULES,
        "https://sh.reddit.com/r/test/comments/abc/title/"
      ).pattern
    ).toBe("sh.reddit.com");
    expect(
      findMatchingRule(
        BUILTIN_RULES,
        "https://old.reddit.com/r/test/comments/abc/title/"
      )
    ).toBeUndefined();
    expect(
      findMatchingRule(BUILTIN_RULES, "https://chat.reddit.com/")
    ).toBeUndefined();
  });

  test("keeps global pre, button, nav and inline code instead of replacing them", () => {
    const { effective, rule } = collectTargets("<p>unused</p>");
    expect(rule.keepSelector).toBeUndefined();
    expect(rule.ignoreSelector.startsWith("+")).toBe(true);
    expect(effective.keepSelector).toBe(GLOBLA_RULE.keepSelector);
    expect(effective.keepSelector).toContain("code");
    expect(effective.ignoreSelector).toContain("pre");
    expect(effective.ignoreSelector).toContain("button");
    expect(effective.ignoreSelector).toContain("nav");
    expect(effective.ignoreSelector).toContain("header");
    expect(effective.ignoreSelector).toContain('[role="navigation"]');
    expect(effective.ignoreSelector).not.toBe(rule.ignoreSelector);
    for (const piece of GLOBLA_RULE.ignoreSelector.split(",")) {
      expect(effective.ignoreSelector).toContain(piece.trim());
    }
    expect(effective.autoScan).toBe("false");
  });

  test("translates feed titles and leaves code, buttons and navigation alone", () => {
    const { targets } = collectTargets(`
      <div id="AppRouter-main-content">
        <nav>
          <h2 id="nav-title">Home</h2>
          <a id="nav-link">Popular</a>
        </nav>
        <header><h1 id="banner">Reddit</h1></header>
        <button id="join">Join</button>
        <button><p id="button-p">Subscribe</p></button>
        <a id="post-title-t3_feed" slot="title">Feed title</a>
        <span id="card-title" data-testid="post-title-text">Card title</span>
        <recent-posts><h3 id="recent">Recent title</h3></recent-posts>
        <pre id="feed-code">const skip = 1;</pre>
      </div>
    `);

    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["post-title-t3_feed", "card-title", "recent"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining([
        "nav-title",
        "nav-link",
        "banner",
        "join",
        "button-p",
        "feed-code",
      ])
    );
    expect(targets.some((node) => node.closest("pre, button, nav"))).toBe(
      false
    );
    expect(targets.some((node) => node.matches("code"))).toBe(false);
  });

  test("translates a post title, body and comments without selecting code blocks", () => {
    const { targets } = collectTargets(`
      <shreddit-post>
        <h1 id="post-title-t3_post">Post title</h1>
        <div slot="text-body" id="body-slot">
          <p id="body">Run <code id="inline">pnpm test</code> first.</p>
          <pre id="body-code"><code>const keep = 1;</code></pre>
        </div>
      </shreddit-post>
      <shreddit-comment>
        <div slot="comment" id="comment-slot">
          <p id="comment">See the steps.</p>
          <ul><li id="step">Open the thread</li></ul>
          <pre id="comment-code"><code>npm start</code></pre>
        </div>
      </shreddit-comment>
      <button id="reply">Reply</button>
      <nav><a id="community">r/test</a></nav>
    `);

    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["post-title-t3_post", "body", "comment", "step"])
    );
    expect(targets.map((node) => node.id)).not.toEqual(
      expect.arrayContaining([
        "body-slot",
        "comment-slot",
        "inline",
        "body-code",
        "comment-code",
        "reply",
        "community",
      ])
    );
    expect(targets.some((node) => node.closest("pre"))).toBe(false);
    expect(targets.some((node) => node.matches("code, pre, button"))).toBe(
      false
    );
    expect(targets.some((node) => node.closest("nav, button"))).toBe(false);
  });

  test("translates an overlay post inside the old app shell", () => {
    const { targets } = collectTargets(`
      <div id="overlayScrollContainer">
        <h1 id="overlay-title">Overlay title</h1>
        <p id="overlay-body">Overlay body</p>
        <blockquote id="overlay-quote">Quoted line</blockquote>
        <pre id="overlay-code">code</pre>
        <nav><h2 id="overlay-nav">Menu</h2></nav>
        <button id="overlay-close">Close</button>
      </div>
    `);

    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["overlay-title", "overlay-body", "overlay-quote"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining(["overlay-code", "overlay-nav", "overlay-close"])
    );
  });

  test("still matches a post after the listing container is replaced", () => {
    document.body.innerHTML = `
      <div id="AppRouter-main-content">
        <a id="post-title-t3_feed">Feed title</a>
        <nav><a>Home</a></nav>
      </div>
    `;
    const shell = document.querySelector("#AppRouter-main-content");
    shell.innerHTML = `
      <h1 id="post-title-t3_post">Post title</h1>
      <div slot="text-body"><p id="body">Post body</p><pre id="fence">const keep = 1;</pre></div>
      <div slot="comment"><p id="comment">Comment body</p></div>
      <button id="reply">Reply</button>
      <nav><a id="nav">Popular</a></nav>
    `;

    const { targets } = collectTargets(shell.outerHTML);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["post-title-t3_post", "body", "comment"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining(["fence", "reply", "nav"])
    );
    expect(targets.some((node) => node.closest("pre, button, nav"))).toBe(
      false
    );
  });
});

import { deriveRuleContext, findMatchingRule, mergeRules } from "./rules";
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

const mediumRule = BUILTIN_RULES.find((rule) => rule.pattern === "medium.com");

function collectTargets(html) {
  document.body.innerHTML = html;
  const effective = mergeRules(GLOBLA_RULE, mediumRule);
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
  return { effective, targets };
}

function targetIds(targets) {
  return targets.map((node) => node.id).filter(Boolean);
}

const HOME_LISTING = `
  <header>
    <p id="signin"><a data-testid="headerSignInButton">Sign in</a></p>
    <a id="write" data-testid="headerWriteButton">Write</a>
    <button id="signup" data-testid="headerSignUpButton">Get started</button>
    <h2 id="hero">Human stories &amp; ideas</h2>
  </header>
  <article data-testid="post-preview">
    <h2 id="card">Listing title</h2>
    <h3 id="dek">Listing deck</h3>
  </article>
`;

const PUBLIC_ARTICLE = `
  <header>
    <p id="signin"><a data-testid="headerSignInButton">Sign in</a></p>
    <a id="write" data-testid="headerWriteButton">Write</a>
    <button id="signup">Get started</button>
    <nav><h2 id="nav-title">Our story</h2></nav>
  </header>
  <article>
    <h1 id="title" class="pw-post-title" data-testid="storyTitle">Public title</h1>
    <h2 id="subtitle" class="pw-subtitle-paragraph">A subtitle</h2>
    <span id="author">Jane Doe</span>
    <p id="body" class="pw-post-body-paragraph">Run <code id="inline">pnpm test</code> first.</p>
    <h2 id="section">Section</h2>
    <ul><li id="item">Open the story</li></ul>
    <blockquote id="quote-block"><p id="quote">Quoted line</p></blockquote>
    <pre id="fence"><code>const keep = 1;</code></pre>
    <button id="follow"><span>Follow</span></button>
    <button><p id="button-p">Clap</p></button>
  </article>
  <section id="paywall">
    <h1 id="paywall-title">This story is for members</h1>
    <p id="paywall-copy">Read the rest with a membership.</p>
    <button id="paywall-btn">Become a member</button>
  </section>
`;

describe("medium.com builtin page rule", () => {
  test("adds only medium.com and leaves github and reddit rules alone", () => {
    const patterns = BUILTIN_RULES.map((rule) => rule.pattern);
    expect(patterns).toContain("medium.com");
    expect(patterns.filter((pattern) => pattern.includes("medium"))).toEqual([
      "medium.com",
    ]);
    for (const host of [
      "www.npmjs.com/package",
      "developer.chrome.com/docs",
      "react.dev",
      "create-react-app.dev",
      "pytorch.org",
    ]) {
      expect(patterns).not.toContain(host);
      expect(patterns.join("\n")).not.toContain(host);
    }
    expect(patterns).toEqual(
      expect.arrayContaining([
        "github.com",
        "www.reddit.com",
        "new.reddit.com",
        "sh.reddit.com",
      ])
    );

    const github = BUILTIN_RULES.find((rule) => rule.pattern === "github.com");
    expect(github.selector).not.toContain("article :is");
    expect(github.ignoreSelector).toBe("button, p.pinned-item-desc+p");
    for (const host of ["www.reddit.com", "new.reddit.com", "sh.reddit.com"]) {
      const reddit = BUILTIN_RULES.find((rule) => rule.pattern === host);
      expect(reddit.selector).toContain('[id^="post-title"]');
      expect(reddit.selector).not.toContain("article :is");
    }

    expect(mediumRule.autoScan).toBe("false");
    expect(mediumRule.keepSelector).toBeUndefined();
    expect(mediumRule.ignoreSelector).toBeUndefined();
    expect(mediumRule.selector).toBe(
      "article :is(h1, h2, h3, h4, h5, h6, li, p, dd, blockquote)"
    );
    expect(mediumRule.selector).not.toContain("span");
    expect(mediumRule.selector).not.toContain("npm");
    expect(mediumRule.selector).not.toContain("react.dev");
    expect(mediumRule.selector).not.toContain("pytorch");
  });

  test("matches medium.com pages and does not claim custom domains", () => {
    expect(findMatchingRule(BUILTIN_RULES, "https://medium.com/").pattern).toBe(
      "medium.com"
    );
    expect(
      findMatchingRule(BUILTIN_RULES, "https://medium.com/tag/programming")
        .pattern
    ).toBe("medium.com");
    expect(
      findMatchingRule(
        BUILTIN_RULES,
        "https://medium.com/@contentjack69/engineering-a-zero-dependency-text-repeater-4941b47e2f8e"
      ).pattern
    ).toBe("medium.com");
    expect(
      findMatchingRule(
        BUILTIN_RULES,
        "https://towardsdatascience.com/writing-better-go"
      )
    ).toBeUndefined();
    expect(
      findMatchingRule(BUILTIN_RULES, "https://react.dev/learn")
    ).toBeUndefined();
    expect(
      findMatchingRule(BUILTIN_RULES, "https://www.npmjs.com/package/react")
    ).toBeUndefined();
    expect(
      findMatchingRule(BUILTIN_RULES, "https://developer.chrome.com/docs")
    ).toBeUndefined();
    expect(
      findMatchingRule(BUILTIN_RULES, "https://pytorch.org/docs")
    ).toBeUndefined();
  });

  test("keeps global pre, code, button and nav instead of replacing them", () => {
    const { effective } = collectTargets("<p>unused</p>");
    expect(mediumRule.keepSelector).toBeUndefined();
    expect(mediumRule.ignoreSelector).toBeUndefined();
    expect(effective.keepSelector).toBe(GLOBLA_RULE.keepSelector);
    expect(effective.keepSelector).toContain("code");
    expect(effective.ignoreSelector).toBe(GLOBLA_RULE.ignoreSelector);
    expect(effective.ignoreSelector).toContain("pre");
    expect(effective.ignoreSelector).toContain("button");
    expect(effective.ignoreSelector).toContain("nav");
    expect(effective.transOnly).toBe("false");
    expect(effective.autoScan).toBe("false");
    expect(effective.selector).toBe(mediumRule.selector);
  });

  test("translates a public article title and body and leaves code, nav, buttons and paywall chrome alone", () => {
    const { targets } = collectTargets(PUBLIC_ARTICLE);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining([
        "title",
        "subtitle",
        "body",
        "section",
        "item",
        "quote",
      ])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining([
        "author",
        "inline",
        "fence",
        "follow",
        "button-p",
        "signin",
        "write",
        "signup",
        "nav-title",
        "paywall-title",
        "paywall-copy",
        "paywall-btn",
      ])
    );
    expect(targets.some((node) => node.closest("pre, button, nav"))).toBe(
      false
    );
    expect(targets.some((node) => node.closest("#paywall"))).toBe(false);
    expect(targets.some((node) => node.matches("code, pre, button"))).toBe(
      false
    );
  });

  test("still translates the article after a homepage listing is replaced", () => {
    const home = collectTargets(HOME_LISTING);
    expect(targetIds(home.targets)).toEqual(
      expect.arrayContaining(["card", "dek"])
    );
    expect(targetIds(home.targets)).not.toEqual(
      expect.arrayContaining(["signin", "write", "signup", "hero"])
    );

    document.body.innerHTML = HOME_LISTING;
    document.body.innerHTML = PUBLIC_ARTICLE;
    const { targets } = collectTargets(document.body.innerHTML);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["title", "body", "item", "quote"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining([
        "card",
        "dek",
        "hero",
        "signin",
        "fence",
        "paywall-title",
        "paywall-copy",
      ])
    );
    expect(findMatchingRule(BUILTIN_RULES, "https://medium.com/").pattern).toBe(
      findMatchingRule(
        BUILTIN_RULES,
        "https://medium.com/@user/public-story-abc123def456"
      ).pattern
    );
  });
});

describe("medium.com after the v2 subscription sync", () => {
  const v2WithoutMedium = [
    { pattern: "old.reddit.com", selector: ".usertext", autoScan: "false" },
    {
      pattern: "github.com",
      selector: ".from-subscription",
      autoScan: "false",
    },
  ];

  test("uses the builtin medium.com rule when v2 has no medium.com", () => {
    const context = deriveRuleContext(
      "https://medium.com/@user/public-story-abc123def456",
      { personalRules: [], subRules: v2WithoutMedium }
    );
    expect(context.effective.pattern).toBe("medium.com");
    expect(context.effective.autoScan).toBe("false");
    expect(context.effective.keepSelector).toContain("code");
    expect(context.effective.ignoreSelector).toContain("pre");
    expect(context.effective.ignoreSelector).toContain("button");
    expect(context.effective.ignoreSelector).toContain("nav");
    expect(context.effective.transOnly).toBe("false");

    document.body.innerHTML = PUBLIC_ARTICLE;
    const targets = [];
    visitTranslationTargets(
      document.body,
      {
        autoScan: context.effective.autoScan,
        selector: context.effective.selector,
        ignoreSelector: context.effective.ignoreSelector,
        isBlock: () => false,
        hasText: () => false,
        wrapperClass: "kiss-wrapper",
      },
      (node) => targets.push(node)
    );
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["title", "body"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining(["fence", "paywall-title", "nav-title", "signin"])
    );
  });

  test("does not fall back when injection is off, and keeps a subscribed github rule", () => {
    const off = deriveRuleContext("https://medium.com/", {
      personalRules: [],
      subRules: [],
    });
    expect(off.effective.pattern).toBe("*");
    expect(off.effective.autoScan).toBe("true");

    const github = deriveRuleContext(
      "https://github.com/boomytc/ImmerTranslate",
      {
        personalRules: [],
        subRules: v2WithoutMedium,
      }
    );
    expect(github.effective.pattern).toBe("github.com");
    expect(github.effective.selector).toBe(".from-subscription");

    const covered = deriveRuleContext("https://medium.com/@user/story", {
      personalRules: [],
      subRules: [
        ...v2WithoutMedium,
        {
          pattern: "medium.com",
          selector: ".from-subscription",
          autoScan: "false",
        },
      ],
    });
    expect(covered.effective.pattern).toBe("medium.com");
    expect(covered.effective.selector).toBe(".from-subscription");
  });
});

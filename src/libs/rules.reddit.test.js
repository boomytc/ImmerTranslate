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
      expect(rule.ignoreSelector.startsWith("+")).toBe(true);
      expect(rule.ignoreSelector).toContain("+#left-sidebar-container");
      expect(rule.ignoreSelector).toContain("+auth-flow-link");
      expect(rule.ignoreSelector).toContain("+.legal-links");
      expect(rule.ignoreSelector).toContain('+[slot="post-locked-banner"]');
      expect(rule.ignoreSelector).toContain("+shreddit-sort-dropdown");
      expect(rule.ignoreSelector).not.toMatch(/^[^+-]/);
      expect(rule.selector).toContain('[id^="post-title"]');
      expect(rule.selector).toContain('[data-testid="post-title-text"]');
      expect(rule.selector).toContain('[slot="text-body"]');
      expect(rule.selector).toContain('[slot="comment"]');
      expect(rule.selector).toContain("-post-rtjson-content");
      expect(rule.selector).toContain("-comment-rtjson-content");
      expect(rule.selector).toContain("recent-posts h3");
      expect(rule.selector).not.toContain("#AppRouter-main-content");
      expect(rule.selector).not.toContain("#overlayScrollContainer");
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
    expect(effective.ignoreSelector).toContain("#left-sidebar-container");
    expect(effective.ignoreSelector).toContain("auth-flow-link");
    expect(effective.ignoreSelector).toContain(".legal-links");
    expect(effective.ignoreSelector).toContain('[slot="post-locked-banner"]');
    expect(effective.ignoreSelector).toContain("shreddit-sort-dropdown");
    expect(effective.ignoreSelector).not.toContain("+auth-flow-link");
    expect(effective.ignoreSelector).not.toBe(rule.ignoreSelector);
    for (const piece of GLOBLA_RULE.ignoreSelector.split(",")) {
      expect(effective.ignoreSelector).toContain(piece.trim());
    }
    expect(effective.autoScan).toBe("false");
  });

  test("translates feed titles and leaves code, buttons and navigation alone", () => {
    const { targets } = collectTargets(`
      <div id="main-content">
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
          <ul><li><p id="step">Open the thread</p></li></ul>
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
        <h1 id="post-title-t3_overlay">Overlay title</h1>
        <div id="t3_overlay-post-rtjson-content">
          <p id="overlay-body">Overlay body</p>
          <blockquote id="overlay-quote">Quoted line</blockquote>
          <pre id="overlay-code">code</pre>
        </div>
        <h2 id="shell-heading">Create Post</h2>
        <p id="shell-copy">Join the worldwide conversation</p>
        <nav><h2 id="overlay-nav">Menu</h2></nav>
        <button id="overlay-close">Close</button>
      </div>
    `);

    expect(targetIds(targets)).toEqual(
      expect.arrayContaining([
        "post-title-t3_overlay",
        "overlay-body",
        "overlay-quote",
      ])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining([
        "overlay-code",
        "overlay-nav",
        "overlay-close",
        "shell-heading",
        "shell-copy",
      ])
    );
  });

  test("leaves the signup card and footer navigation untranslated", () => {
    const { targets } = collectTargets(`
      <main id="main-content">
        <h1 id="post-title-t3_pg006s">COVID denialism and policy clarifications</h1>
        <div id="t3_pg006s-post-rtjson-content" property="schema:articleBody">
          <p id="body">Happy Wednesday</p>
          <pre id="fence"><code id="inline">const keep = 1;</code></pre>
        </div>
        <div id="t1_abc-comment-rtjson-content" slot="comment">
          <p id="comment">Comment body</p>
        </div>
      </main>
      <div id="right-sidebar-container">
        <aside>
          <span id="signup-title">New to Reddit?</span>
          <p id="signup-blurb">Create your account and connect with a world of communities.</p>
          <auth-flow-sso-buttons>
            <button id="google">Continue with Google</button>
          </auth-flow-sso-buttons>
          <auth-flow-link>
            <div><span id="email">Continue with Email</span></div>
          </auth-flow-link>
          <auth-flow-link>
            <div><p id="phone">Continue with Phone Number</p></div>
          </auth-flow-link>
          <a id="login" class="button"><span>Log In</span></a>
          <button id="signup">Sign Up</button>
        </aside>
      </div>
      <div id="left-sidebar-container">
        <h2 id="nav-home">Home</h2>
        <p id="nav-popular">Popular</p>
        <a id="nav-news">News</a>
        <a id="nav-explore">Explore</a>
      </div>
      <div id="footer">
        <h2 id="foot-home">Home</h2>
        <p id="foot-popular">Popular</p>
      </div>
    `);

    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["post-title-t3_pg006s", "body", "comment"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining([
        "signup-title",
        "signup-blurb",
        "google",
        "email",
        "phone",
        "login",
        "signup",
        "nav-home",
        "nav-popular",
        "nav-news",
        "nav-explore",
        "foot-home",
        "foot-popular",
        "fence",
        "inline",
      ])
    );
    expect(targets.some((node) => node.closest("pre, button"))).toBe(false);
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

const BLOCK_TAGS = new Set([
  "DIV",
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "UL",
  "OL",
  "NAV",
  "HEADER",
  "FOOTER",
  "ASIDE",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "BLOCKQUOTE",
  "PRE",
]);

// 与 2026-08 首页、2026-01 帖页存档一致：注册文案是 span/p，页脚是
// .legal-links 里的 a，归档提示和 Sort by 也不在 button/nav/footer 里。
const LIVE_PAGE = `
  <header>
    <nav>
      <a id="login-button" class="button"><span id="login">Log In</span></a>
      <a id="signup-button" class="button"><span id="signup">Sign Up</span></a>
    </nav>
  </header>
  <div id="left-sidebar-container">
    <p id="join-pitch">Join the most real place on the internet</p>
    <auth-flow-sso-buttons>
      <button id="apple">Continue with Apple</button>
    </auth-flow-sso-buttons>
    <div><span id="google">Continue with Google</span></div>
    <auth-flow-link>
      <span id="phone">Continue with Phone Number</span>
    </auth-flow-link>
    <auth-flow-link>
      <span id="email">Continue with Email</span>
    </auth-flow-link>
  </div>
  <shreddit-post>
    <a id="post-title-t3_1vcc9rg" slot="title">Reddit Stock Collapses 23%</a>
    <div id="t3_1vbwgwq-post-rtjson-content">
      <p id="body">In college, I paid for a history paper.</p>
      <pre id="fence"><code id="inline">const keep = 1;</code></pre>
    </div>
    <div slot="post-locked-banner">
      <span id="archived">Archived post. New comments cannot be posted and votes cannot be cast.</span>
    </div>
    <div id="t1_abc-comment-rtjson-content" slot="comment">
      <p id="comment">Comment body</p>
    </div>
    <button id="share">Share</button>
    <button id="award">Award</button>
  </shreddit-post>
  <shreddit-sort-dropdown header-text="Sort by">
    <span id="sort-by">Sort by</span>
    <div slot="selected-item" id="sort-selected">Best</div>
  </shreddit-sort-dropdown>
  <div class="legal-links">
    <ul>
      <li><faceplate-tracker source="nav"><a id="foot-home" href="/?feed=home">Home</a></faceplate-tracker></li>
      <li><faceplate-tracker source="nav"><a id="foot-popular" href="/r/popular/">Popular</a></faceplate-tracker></li>
      <li><faceplate-tracker source="nav"><a id="foot-news" href="/news/">News</a></faceplate-tracker></li>
      <li><faceplate-tracker source="nav"><a id="foot-explore" href="/explore/">Explore</a></faceplate-tracker></li>
    </ul>
  </div>
  <recent-posts><h3 id="recent">List title</h3></recent-posts>
`;

const CHROME_IDS = [
  "login",
  "signup",
  "join-pitch",
  "apple",
  "google",
  "phone",
  "email",
  "archived",
  "share",
  "award",
  "sort-by",
  "sort-selected",
  "foot-home",
  "foot-popular",
  "foot-news",
  "foot-explore",
  "fence",
  "inline",
];

function visitWith(html, rule) {
  document.body.innerHTML = html;
  const targets = [];
  visitTranslationTargets(
    document.body,
    {
      autoScan: rule.autoScan,
      selector: rule.selector,
      ignoreSelector: rule.ignoreSelector,
      isBlock: (node) => BLOCK_TAGS.has(node.nodeName),
      hasText: (node) =>
        Array.from(node.childNodes).some(
          (child) =>
            child.nodeType === Node.TEXT_NODE && /\S/.test(child.nodeValue)
        ),
      wrapperClass: "kiss-wrapper",
    },
    (node) => targets.push(node)
  );
  return targets;
}

function redditAfterSubscription(href) {
  return deriveRuleContext(href, {
    personalRules: [],
    subRules: [
      { pattern: "old.reddit.com", selector: ".usertext", autoScan: "false" },
      {
        pattern: "github.com",
        selector: ".from-subscription",
        autoScan: "false",
      },
    ],
  }).effective;
}

describe("reddit rules after the v2 subscription sync", () => {
  test.each(REDDIT_HOSTS)(
    "uses the builtin %s rule when v2 only has old.reddit.com",
    (host) => {
      const effective = redditAfterSubscription(`https://${host}/r/test/`);
      const targets = visitWith(LIVE_PAGE, effective);

      expect(effective.pattern).toBe(host);
      expect(effective.autoScan).toBe("false");
      expect(effective.keepSelector).toContain("code");
      expect(effective.ignoreSelector).toContain("pre");
      expect(effective.ignoreSelector).toContain("button");
      expect(effective.ignoreSelector).toContain("nav");
      expect(targetIds(targets)).toEqual(
        expect.arrayContaining([
          "post-title-t3_1vcc9rg",
          "body",
          "comment",
          "recent",
        ])
      );
      expect(targetIds(targets)).not.toEqual(
        expect.arrayContaining(CHROME_IDS)
      );
    }
  );

  test("global autoScan still translates the live chrome the builtin rule skips", () => {
    const targets = visitWith(LIVE_PAGE, GLOBLA_RULE);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining([
        "join-pitch",
        "google",
        "phone",
        "email",
        "archived",
        "sort-by",
        "foot-home",
        "foot-popular",
        "foot-news",
        "foot-explore",
        "post-title-t3_1vcc9rg",
        "body",
        "comment",
      ])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining(["login", "signup", "apple", "share", "award"])
    );
  });

  test("does not fall back when injection is off or the subscription already covers the host", () => {
    const off = deriveRuleContext("https://www.reddit.com/", {
      personalRules: [],
      subRules: [],
    });
    expect(off.effective.pattern).toBe("*");
    expect(off.effective.autoScan).toBe("true");

    const disabled = deriveRuleContext("https://www.reddit.com/", {
      personalRules: [],
      subRules: [
        {
          pattern: "www.reddit.com",
          selector: ".from-subscription",
          autoScan: "true",
        },
      ],
      disabledPatterns: ["www.reddit.com"],
    });
    expect(disabled.subscription).toBeNull();
    expect(disabled.effective.pattern).toBe("*");
    expect(disabled.effective.autoScan).toBe("true");

    const turnedOff = deriveRuleContext("https://new.reddit.com/", {
      personalRules: [],
      subRules: [
        {
          pattern: "new.reddit.com",
          enabled: false,
          selector: ".from-subscription",
          autoScan: "true",
        },
        { pattern: "old.reddit.com", selector: ".usertext" },
      ],
    });
    expect(turnedOff.effective.pattern).toBe("*");
    expect(turnedOff.effective.autoScan).toBe("true");
  });

  test("keeps a personal reddit rule and a subscribed github rule ahead of builtins", () => {
    const personal = deriveRuleContext("https://www.reddit.com/r/test/", {
      personalRules: [{ pattern: "www.reddit.com", selector: ".personal" }],
      subRules: [{ pattern: "old.reddit.com", selector: ".usertext" }],
    });
    expect(personal.effective.selector).toBe(".personal");
    expect(personal.effective.pattern).toBe("www.reddit.com");

    const github = deriveRuleContext(
      "https://github.com/boomytc/ImmerTranslate",
      {
        personalRules: [],
        subRules: [
          {
            pattern: "github.com",
            selector: ".from-subscription",
            autoScan: "false",
          },
          { pattern: "old.reddit.com", selector: ".usertext" },
        ],
      }
    );
    expect(github.subscription.pattern).toBe("github.com");
    expect(github.effective.selector).toBe(".from-subscription");
    expect(github.effective.pattern).toBe("github.com");

    const wiki = deriveRuleContext("https://en.wikipedia.org/wiki/Reddit", {
      personalRules: [],
      subRules: [{ pattern: "old.reddit.com", selector: ".usertext" }],
    });
    expect(wiki.effective.pattern).toBe("*");
    expect(wiki.effective.autoScan).toBe("true");
  });
});

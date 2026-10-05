import {
  deriveRuleContext,
  findMatchingRule,
  mergeRules,
  mergeSelectors,
} from "./rules";
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

const STACK_PATTERN = "hostname:stackoverflow.com";
const STACK_SELECTOR = `.s-prose :is(li, p, h1, h2, h3, h4, h5, h6, dd, blockquote), [itemprop="comment"] [itemprop="text"], .question-hyperlink, .s-post-summary--content-title, .s-post-summary--content-excerpt`;
const GLOBAL_KEEP = "code, cite, math, .math, a:has(code)";

const stackRule = BUILTIN_RULES.find((rule) => rule.pattern === STACK_PATTERN);

const OTHER_HOSTS = [
  "https://meta.stackoverflow.com/questions/1",
  "https://pt.stackoverflow.com/questions/1",
  "https://www.stackoverflow.com/questions/1",
  "https://serverfault.com/questions/1",
  "https://superuser.com/questions/1",
  "https://askubuntu.com/questions/1",
  "https://stackexchange.com/",
  "https://math.stackexchange.com/questions/1",
  "https://stackapps.com/questions/1",
  "https://mathoverflow.net/questions/1",
  "https://stackoverflow.blog/",
  "https://example.com/?next=https://stackoverflow.com/questions/1",
  "https://stackoverflow.com.evil.example/questions/1",
];

function collectTargets(html, rule = mergeRules(GLOBLA_RULE, stackRule)) {
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
  return { effective: rule, targets };
}

function targetIds(targets) {
  return targets.map((node) => node.id).filter(Boolean);
}

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
  "DD",
  "DL",
  "DT",
  "BUTTON",
]);

const QUESTION_PAGE = `
  <header class="s-topbar" id="topbar">
    <nav>
      <a id="nav-questions">Questions</a>
      <a id="nav-tags">Tags</a>
    </nav>
    <a id="login" class="s-btn">Log in</a>
    <button id="signup" class="s-btn s-btn__primary">Sign up</button>
    <h2 id="top-label">Stack Overflow</h2>
    <p id="top-search">Search</p>
  </header>
  <div id="question" class="question">
    <h1>
      <a id="title" class="question-hyperlink" href="/questions/1">Why is this faster?</a>
    </h1>
    <div class="s-prose js-post-body" itemprop="text">
      <p id="body">Run <code id="inline">sort</code> then compare.</p>
      <p id="math-line">Energy <span id="math" class="math-container">E=mc^2</span> stays.</p>
      <h1 id="h1">Heading 1</h1>
      <h2 id="h2">Heading 2</h2>
      <h3 id="h3">Heading 3</h3>
      <h4 id="h4">Heading 4</h4>
      <h5 id="h5">Heading 5</h5>
      <h6 id="h6">Heading 6</h6>
      <ul><li id="item">Open the thread</li></ul>
      <blockquote id="quote">Quoted line</blockquote>
      <dl><dd id="definition">A definition</dd></dl>
      <pre id="fence"><code>const keep = 1;</code></pre>
      <p class="kiss-p" id="marker">Paragraph wrapper class is not required</p>
    </div>
  </div>
  <div class="answer">
    <div class="s-prose js-post-body">
      <p id="answer">See the steps.</p>
    </div>
    <ul>
      <li itemprop="comment">
        <div id="comment" itemprop="text">Comment body with <code id="comment-code">npm</code></div>
      </li>
    </ul>
  </div>
  <aside>
    <h2 id="hot">Hot Network Questions</h2>
    <a id="hot-link">Another site</a>
  </aside>
  <button id="share">Share</button>
  <button><p id="button-p">Follow</p></button>
`;

const LISTING_PAGE = `
  <header class="s-topbar">
    <nav><a id="nav-home">Home</a></nav>
    <button id="ask">Ask Question</button>
  </header>
  <div class="s-post-summary">
    <h3 id="summary-title" class="s-post-summary--content-title">
      <a id="summary-link" class="question-hyperlink" href="/questions/2">Listing title</a>
    </h3>
    <div id="excerpt" class="s-post-summary--content-excerpt">Excerpt with <code id="excerpt-code">O(n)</code></div>
  </div>
`;

const CHROME_IDS = [
  "nav-questions",
  "nav-tags",
  "login",
  "signup",
  "top-label",
  "top-search",
  "inline",
  "math",
  "fence",
  "comment-code",
  "hot",
  "hot-link",
  "share",
  "button-p",
];

describe("stackoverflow.com builtin page rule", () => {
  test("adds only stackoverflow.com and leaves github, reddit and medium alone", () => {
    const patterns = BUILTIN_RULES.map((rule) => rule.pattern);
    expect(patterns).toContain(STACK_PATTERN);
    expect(patterns.filter((pattern) => pattern.includes("stack"))).toEqual([
      STACK_PATTERN,
    ]);
    expect(stackRule.pattern).not.toContain(",");
    for (const host of [
      "serverfault.com",
      "superuser.com",
      "askubuntu.com",
      "stackexchange.com",
      "stackapps.com",
      "mathoverflow.net",
    ]) {
      expect(patterns.join("\n")).not.toContain(host);
    }

    const github = BUILTIN_RULES.find((rule) => rule.pattern === "github.com");
    expect(github.selector).toContain(".markdown-body");
    expect(github.ignoreSelector).toBe("button, p.pinned-item-desc+p");
    expect(github.keepSelector).toBeUndefined();
    for (const host of ["www.reddit.com", "new.reddit.com", "sh.reddit.com"]) {
      const reddit = BUILTIN_RULES.find((rule) => rule.pattern === host);
      expect(reddit.selector).toContain('[id^="post-title"]');
      expect(reddit.keepSelector).toBeUndefined();
      expect(reddit.selector).not.toContain(".s-prose");
    }
    const medium = BUILTIN_RULES.find((rule) => rule.pattern === "medium.com");
    expect(medium.selector).toBe(
      "article :is(h1, h2, h3, h4, h5, h6, li, p, dd, blockquote)"
    );
    expect(medium.keepSelector).toBeUndefined();
    expect(medium.autoScan).toBe("false");

    expect(stackRule.autoScan).toBe("false");
    expect(stackRule.ignoreSelector).toBeUndefined();
    expect(stackRule.selector).toBe(STACK_SELECTOR);
    expect(stackRule.selector).not.toContain("kiss-p");
    expect(stackRule.selector).not.toContain(".kiss-p");
    expect(stackRule.keepSelector).toBe("+.math-container");
  });

  test("matches only stackoverflow.com", () => {
    expect(
      findMatchingRule(
        BUILTIN_RULES,
        "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster"
      ).pattern
    ).toBe(STACK_PATTERN);
    expect(
      findMatchingRule(BUILTIN_RULES, "https://stackoverflow.com/questions")
        .pattern
    ).toBe(STACK_PATTERN);
    expect(
      findMatchingRule(BUILTIN_RULES, "http://StackOverflow.com/questions/1")
        .pattern
    ).toBe(STACK_PATTERN);
    for (const href of OTHER_HOSTS) {
      expect(findMatchingRule(BUILTIN_RULES, href)).toBeUndefined();
    }
  });

  test("appends .math-container and keeps the global keep and ignore lists", () => {
    expect(GLOBLA_RULE.keepSelector).toBe(GLOBAL_KEEP);
    expect(mergeSelectors(GLOBLA_RULE.keepSelector, ".math-container")).toBe(
      ".math-container"
    );
    expect(mergeSelectors(GLOBLA_RULE.keepSelector, "+.math-container")).toBe(
      `${GLOBAL_KEEP}, .math-container`
    );

    const { effective } = collectTargets("<p>unused</p>");
    expect(stackRule.keepSelector).toBe("+.math-container");
    expect(stackRule.ignoreSelector).toBeUndefined();
    expect(effective.keepSelector).toBe(`${GLOBAL_KEEP}, .math-container`);
    for (const piece of GLOBAL_KEEP.split(", ")) {
      expect(effective.keepSelector).toContain(piece);
    }
    expect(effective.keepSelector).toContain(".math-container");
    expect(effective.keepSelector).not.toBe(".math-container");
    expect(effective.ignoreSelector).toBe(GLOBLA_RULE.ignoreSelector);
    expect(effective.ignoreSelector).toContain("pre");
    expect(effective.ignoreSelector).toContain("button");
    expect(effective.ignoreSelector).toContain("nav");
    expect(effective.autoScan).toBe("false");
    expect(effective.selector).toBe(STACK_SELECTOR);
  });

  test("translates the question, comments and leaves code, math, nav, buttons and the top bar alone", () => {
    const { targets } = collectTargets(QUESTION_PAGE);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining([
        "title",
        "body",
        "math-line",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "item",
        "quote",
        "definition",
        "answer",
        "comment",
        "marker",
      ])
    );
    expect(targetIds(targets)).not.toEqual(expect.arrayContaining(CHROME_IDS));
    expect(
      targets.some((node) => node.closest("pre, button, nav, header"))
    ).toBe(false);
    expect(
      targets.some((node) => node.matches("code, pre, button, .math-container"))
    ).toBe(false);
    expect(targets.some((node) => node.closest(".s-topbar, #topbar"))).toBe(
      false
    );
  });

  test("translates listing titles and excerpts after the question page is replaced", () => {
    const question = collectTargets(QUESTION_PAGE);
    expect(targetIds(question.targets)).toContain("title");

    document.body.innerHTML = LISTING_PAGE;
    const { targets } = collectTargets(document.body.innerHTML);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["summary-title", "summary-link", "excerpt"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining([
        "nav-home",
        "ask",
        "excerpt-code",
        "title",
        "body",
      ])
    );
    expect(
      targets.some((node) => node.closest("pre, button, nav, header"))
    ).toBe(false);
    expect(
      findMatchingRule(BUILTIN_RULES, "https://stackoverflow.com/questions")
        .pattern
    ).toBe(
      findMatchingRule(
        BUILTIN_RULES,
        "https://stackoverflow.com/questions/1/title"
      ).pattern
    );
  });

  test("global autoScan still translates the top bar the builtin rule skips", () => {
    const scanned = collectTargets(QUESTION_PAGE, GLOBLA_RULE);
    expect(targetIds(scanned.targets)).toEqual(
      expect.arrayContaining(["top-label", "top-search", "body"])
    );
    expect(targetIds(scanned.targets)).not.toEqual(
      expect.arrayContaining(["signup", "share", "fence"])
    );
  });
});

describe("stackoverflow.com after the v2 subscription sync", () => {
  const v2WithoutStack = [
    { pattern: "old.reddit.com", selector: ".usertext", autoScan: "false" },
    {
      pattern: "github.com",
      selector: ".from-subscription",
      autoScan: "false",
    },
    {
      pattern: "medium.com",
      selector: ".from-subscription",
      autoScan: "false",
    },
  ];

  test("uses the builtin stackoverflow.com rule when v2 has no stackoverflow.com", () => {
    const context = deriveRuleContext(
      "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster",
      { personalRules: [], subRules: v2WithoutStack }
    );
    expect(context.effective.pattern).toBe(STACK_PATTERN);
    expect(context.effective.autoScan).toBe("false");
    expect(context.effective.keepSelector).toBe(
      `${GLOBAL_KEEP}, .math-container`
    );
    expect(context.effective.ignoreSelector).toContain("pre");
    expect(context.effective.ignoreSelector).toContain("button");
    expect(context.effective.ignoreSelector).toContain("nav");
    expect(context.effective.selector).toBe(STACK_SELECTOR);

    const { targets } = collectTargets(QUESTION_PAGE, context.effective);
    expect(targetIds(targets)).toEqual(
      expect.arrayContaining(["title", "body", "comment"])
    );
    expect(targetIds(targets)).not.toEqual(
      expect.arrayContaining(["top-label", "signup", "nav-questions", "fence"])
    );
  });

  test("does not fall back when injection is off, the host is covered, or the page is another site", () => {
    const off = deriveRuleContext("https://stackoverflow.com/questions/1", {
      personalRules: [],
      subRules: [],
    });
    expect(off.effective.pattern).toBe("*");
    expect(off.effective.autoScan).toBe("true");

    const covered = deriveRuleContext("https://stackoverflow.com/questions/1", {
      personalRules: [],
      subRules: [
        ...v2WithoutStack,
        {
          pattern: "stackoverflow.com",
          selector: ".from-subscription",
          autoScan: "false",
        },
      ],
    });
    expect(covered.subscription.pattern).toBe("stackoverflow.com");
    expect(covered.effective.selector).toBe(".from-subscription");

    const personal = deriveRuleContext(
      "https://stackoverflow.com/questions/1",
      {
        personalRules: [
          { pattern: "hostname:stackoverflow.com", selector: ".personal" },
        ],
        subRules: v2WithoutStack,
      }
    );
    expect(personal.effective.selector).toBe(".personal");
    expect(personal.effective.pattern).toBe(STACK_PATTERN);

    const serverfault = deriveRuleContext(
      "https://serverfault.com/questions/1",
      {
        personalRules: [],
        subRules: v2WithoutStack,
      }
    );
    expect(serverfault.effective.pattern).toBe("*");
    expect(serverfault.effective.autoScan).toBe("true");

    const github = deriveRuleContext(
      "https://github.com/boomytc/ImmerTranslate",
      { personalRules: [], subRules: v2WithoutStack }
    );
    expect(github.subscription.pattern).toBe("github.com");
    expect(github.effective.selector).toBe(".from-subscription");

    const medium = deriveRuleContext("https://medium.com/@user/story", {
      personalRules: [],
      subRules: v2WithoutStack,
    });
    expect(medium.subscription.pattern).toBe("medium.com");
    expect(medium.effective.selector).toBe(".from-subscription");
  });
});

import { mergeRules } from "./rules";
import { GLOBLA_RULE } from "../config/rules";
import { BUILTIN_RULES } from "../config/rules";
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

const githubRule = BUILTIN_RULES.find((rule) => rule.pattern === "github.com");

function collectTargets(html) {
  document.body.innerHTML = html;
  const effective = mergeRules(GLOBLA_RULE, githubRule);
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

describe("github.com builtin page rule", () => {
  test("inherits inline code protection and does not retarget pre or buttons", () => {
    const { effective, targets } = collectTargets(`
      <article class="markdown-body">
        <h1>ImmerTranslate</h1>
        <p id="readme">需要 Node.js 与 pnpm。</p>
        <div class="highlight highlight-source-shell notranslate">
          <pre id="code-block">git clone https://github.com/boomytc/ImmerTranslate.git</pre>
        </div>
        <p id="inline">运行 <code>pnpm build</code> 生成目录。</p>
        <table>
          <tr><th id="th">命令</th><th>作用</th></tr>
          <tr><td id="td-a">install</td><td id="td-b">安装依赖</td></tr>
        </table>
        <button id="copy"><span>Copy</span></button>
        <button><p id="button-p">Star</p></button>
      </article>
    `);

    expect(githubRule.autoScan).toBe("false");
    expect(githubRule.keepSelector).toBeUndefined();
    expect(githubRule.ignoreSelector).toBe("button, p.pinned-item-desc+p");
    expect(effective.autoScan).toBe("false");
    expect(effective.keepSelector).toContain("code");
    expect(effective.ignoreSelector).toContain("button");
    expect(effective.selector).toContain(".js-wiki-sidebar-page-container");

    const ids = targets.map((node) => node.id).filter(Boolean);
    expect(ids).toEqual(
      expect.arrayContaining(["readme", "inline", "th", "td-a", "td-b"])
    );
    expect(ids).not.toEqual(expect.arrayContaining(["code-block", "button-p"]));
    expect(targets.some((node) => node.closest("pre, button"))).toBe(false);
    expect(targets.some((node) => node.matches("code"))).toBe(false);
  });

  test("translates issue titles and comment paragraphs while leaving code blocks alone", () => {
    const { targets } = collectTargets(`
      <h1><bdi data-testid="issue-title">Bug title</bdi><span>#1145</span></h1>
      <a class="StickyHeaderTitle-module__stickyTitleLink">
        <bdi id="sticky" data-testid="issue-title-sticky">Bug title</bdi>
      </a>
      <div class="comment-body markdown-body js-comment-body">
        <h2>摘要</h2>
        <p id="comment">扩展壳按 <code class="notranslate">chrome.storage.local</code> 选择引擎。</p>
        <ul><li id="item">验收步骤</li></ul>
        <div class="highlight highlight-source-js">
          <pre class="notranslate" id="fence">const keep = 1;</pre>
        </div>
      </div>
      <a role="button" class="prc-Button-ButtonBase"><span>Sign up</span></a>
      <a class="PinnedIssueCard-module__Link__ZVj7s" href="/issues/380">
        <span class="PinnedIssueCard-module__Octicon">icon</span>
        <span id="pinned" data-component="Text">Pinned issue</span>
      </a>
    `);

    const ids = targets.map((node) => node.id).filter(Boolean);
    expect(ids).toEqual(
      expect.arrayContaining(["sticky", "comment", "item", "pinned"])
    );
    expect(targets.some((node) => node.matches("h1, h2"))).toBe(true);
    expect(ids).not.toContain("fence");
    expect(targets.some((node) => node.closest("pre"))).toBe(false);
    expect(targets.some((node) => node.closest("[role='button']"))).toBe(false);
  });

  test("still matches an issue thread after the repo turbo frame is replaced", () => {
    document.body.innerHTML = `
      <turbo-frame id="repo-content-turbo-frame">
        <article class="markdown-body"><p id="readme">Repo readme</p></article>
      </turbo-frame>
    `;
    const frame = document.querySelector("#repo-content-turbo-frame");
    frame.innerHTML = `
      <h1><bdi data-testid="issue-title">Issue title</bdi></h1>
      <bdi id="sticky" data-testid="issue-title-sticky">Issue title</bdi>
      <div class="comment-body markdown-body"><p id="comment">Comment body</p></div>
      <pre id="fence">const keep = 1;</pre>
    `;
    const { targets } = collectTargets(frame.outerHTML);
    const ids = targets.map((node) => node.id).filter(Boolean);
    expect(ids).toEqual(expect.arrayContaining(["sticky", "comment"]));
    expect(targets.some((node) => node.matches("h1"))).toBe(true);
    expect(ids).not.toContain("fence");
  });

  test("keeps translating wiki sidebar links", () => {
    const { targets } = collectTargets(`
      <nav id="wiki-pages-box">
        <div class="js-wiki-sidebar-page-container">
          <div id="wiki" class="Truncate-text">Home</div>
        </div>
      </nav>
    `);
    expect(targets.map((node) => node.id)).toContain("wiki");
  });
});

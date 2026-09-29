#!/usr/bin/env node
/**
 * MVP stage gate (release-0.1.0 prep): mock path must be one source.
 * Does not launch a browser — manual: load unpacked → article → toggle.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (msg) => console.log(`OK: ${msg}`);

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    fail(`${cmd} ${args.join(" ")}\n${r.stdout || ""}${r.stderr || ""}`);
  }
  return r.stdout || "";
}

// 1) vendor sync + identical to package src
run("bash", ["./scripts/sync-translate-core.sh"]);
const diff = spawnSync(
  "diff",
  ["-rq", "packages/translate-core/src", "extension/vendor/translate-core"],
  { cwd: root, encoding: "utf8" }
);
if (diff.status !== 0) {
  fail(`vendor 与 packages/translate-core/src 不一致\n${diff.stdout}${diff.stderr}`);
}
ok("vendor 与 translate-core/src 一致");

// 2) background imports vendor (not inline mock)
const bg = readFileSync(join(root, "extension/background.js"), "utf8");
if (!bg.includes('from "./vendor/translate-core/index.js"')) {
  fail("background.js 未从 vendor/translate-core 导入");
}
if (!bg.includes("buildEngine") || !bg.includes("createOpenAICompatibleEngine")) {
  fail("background.js 未按设置选择 OpenAI 兼容引擎");
}
if (!bg.includes("createAnthropicCompatibleEngine")) {
  fail("background.js 未调用 createAnthropicCompatibleEngine");
}
if (bg.includes("尚未同步")) {
  fail("background.js 仍把引擎导出缺失当成运行错误");
}
for (const needle of [
  'provider: "openai"',
  "https://api.deepseek.com/v1",
  "deepseek-flash",
]) {
  if (!bg.includes(needle)) fail(`background.js 缺少默认值 ${needle}`);
}
if (/async function mockTranslate/.test(bg)) {
  fail("background.js 仍内联 mockTranslate");
}
ok("background 走 vendor translate-core");

// 3) same module path as extension: mock batch
const vendorEntry = pathToFileURL(
  join(root, "extension/vendor/translate-core/index.js")
).href;
const { mockTranslate } = await import(vendorEntry);
const res = await mockTranslate({
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [
    { id: "a", text: "Hello" },
    { id: "b", text: "World" },
  ],
});
if (res.segments[0].text !== "⟦Hello⟧" || res.segments[1].text !== "⟦World⟧") {
  fail(`vendor mock 结果异常: ${JSON.stringify(res)}`);
}
ok("extension/vendor mockTranslate 批次输出 ⟦…⟧");

// 3b) options → buildEngine → vendor factories (stub fetch, no network / no real key)
const { buildEngine } = await import(
  pathToFileURL(join(root, "extension/background.js")).href
);
const sample = {
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [{ id: "a", text: "Hello" }],
};
const mockEngine = buildEngine({
  provider: "anthropic",
  apiKey: "   ",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
});
if (mockEngine !== mockTranslate) fail("空 apiKey 应返回 mockTranslate");
const mockRes = await mockEngine(sample);
if (mockRes.segments[0].text !== "⟦Hello⟧") {
  fail(`空 key 结果异常: ${JSON.stringify(mockRes)}`);
}

/**
 * @param {import("../extension/vendor/translate-core/types.js").TranslateEngine} engine
 * @param {() => Response} respond
 */
async function runWithFetch(engine, respond) {
  const original = globalThis.fetch;
  /** @type {{ url: string, body: { model?: string } } | null} */
  let hit = null;
  globalThis.fetch = async (input, init) => {
    hit = {
      url: String(input),
      body: JSON.parse(String(init && init.body ? init.body : "{}")),
    };
    return respond();
  };
  try {
    const data = await engine(sample);
    return { hit, data };
  } finally {
    globalThis.fetch = original;
  }
}

const openai = await runWithFetch(
  buildEngine({ apiKey: "test-key", baseUrl: "  ", model: " " }),
  () =>
    new Response(
      JSON.stringify({
        choices: [
          { message: { content: JSON.stringify([{ id: "a", text: "你好" }]) } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
);
if (openai.hit?.url !== "https://api.deepseek.com/v1/chat/completions") {
  fail(`OpenAI 默认 URL 异常: ${openai.hit?.url}`);
}
if (openai.hit?.body?.model !== "deepseek-flash") {
  fail(`OpenAI 默认 model 异常: ${openai.hit?.body?.model}`);
}
if (openai.data?.segments?.[0]?.text !== "你好") fail("OpenAI 引擎未映射译文");

const anthropic = await runWithFetch(
  buildEngine({
    apiKey: "test-key",
    provider: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-test",
  }),
  () =>
    new Response(
      JSON.stringify({
        content: [
          { type: "text", text: JSON.stringify([{ id: "a", text: "你好" }]) },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
);
if (anthropic.hit?.url !== "https://api.anthropic.com/v1/messages") {
  fail(`Anthropic URL 异常: ${anthropic.hit?.url}`);
}
if (anthropic.hit?.body?.model !== "claude-test") {
  fail(`Anthropic model 异常: ${anthropic.hit?.body?.model}`);
}
if (anthropic.data?.segments?.[0]?.text !== "你好") {
  fail("Anthropic 引擎未映射译文");
}
ok("background 按设置选择 mock / OpenAI / Anthropic");

// 4) package smoke
run("npm", ["run", "smoke"]);
ok("packages/translate-core smoke");

// 5) manifest + options hard constraints
const manifest = JSON.parse(
  readFileSync(join(root, "extension/manifest.json"), "utf8")
);
if (manifest.manifest_version !== 3) fail("manifest_version 必须为 3");
if (!manifest.background?.service_worker) fail("缺少 service_worker");
if (!manifest.content_scripts?.length) fail("缺少 content_scripts");
ok("manifest MV3 结构");

const optionsHtml = readFileSync(join(root, "extension/options.html"), "utf8");
for (const id of ["provider", "baseUrl", "model", "apiKey", "sourceLang", "targetLang"]) {
  if (!new RegExp(`id="${id}"`).test(optionsHtml)) fail(`设置页缺少 ${id} 字段`);
}
if (!optionsHtml.includes('value="anthropic"') || !optionsHtml.includes('value="openai"')) {
  fail("设置页协议选项必须包含 openai 与 anthropic");
}
const optionsJs = readFileSync(join(root, "extension/options.js"), "utf8");
if (!optionsJs.includes("chrome.storage.local")) fail("设置页未写入 chrome.storage.local");
for (const key of ["provider", "baseUrl", "model", "apiKey", "sourceLang", "targetLang"]) {
  if (!optionsJs.includes(key)) fail(`options.js 未处理 ${key}`);
}
// Allow positive phrasing like「无强制登录」; flag coercive CTAs only.
const coercive = [
  /(?<!无)强制登录/,
  /立即升级/,
  /开通会员/,
  /Subscribe now/i,
  /Upgrade to Pro/i,
];
for (const re of coercive) {
  if (re.test(optionsHtml)) fail(`设置页出现逼付费/登录文案: ${re}`);
}
ok("设置页可填本地 key，无登录/逼付费文案");

// 6) no absolute local paths / obvious secrets in tracked tree
const tracked = run("git", ["ls-files"]);
for (const file of tracked.split("\n").filter(Boolean)) {
  if (!existsSync(join(root, file))) continue;
  if (file.endsWith(".png") || file.endsWith(".jpg")) continue;
  const text = readFileSync(join(root, file), "utf8");
  const homeUsers = "/" + "Users" + "/";
  const homeBoom = "/" + "home" + "/" + "boom" + "/";
  if (file !== "scripts/accept-mvp.mjs") {
    if (text.includes(homeUsers) || text.includes(homeBoom)) {
      fail(`${file} 含本机绝对路径`);
    }
  }
  if (/sk-[a-zA-Z0-9]{20,}/.test(text)) {
    fail(`${file} 疑似含 API key`);
  }
}
ok("仓内无本机路径 / 疑似密钥");

console.log("\naccept-mvp ok — 浏览器手测: 加载 extension/ → 文章页点图标应出现 ⟦原文⟧");

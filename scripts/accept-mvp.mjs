#!/usr/bin/env node
/**
 * MVP stage gate (release-0.1.0 prep): mock path must be one source.
 * Does not launch a browser — manual: load unpacked → article → toggle.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, runInContext } from "node:vm";

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
const corePkg = JSON.parse(
  readFileSync(join(root, "packages/translate-core/package.json"), "utf8")
);
if (corePkg.version !== "0.4.0") {
  fail(`translate-core 版本应为 0.4.0，实际 ${corePkg.version}`);
}
ok("translate-core 包版本 0.4.0，vendor 已与 src 对齐");

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
const { buildEngine, engineFor } = await import(
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

if (!bg.includes("createPipelineEngine") || !bg.includes("engineFor")) {
  fail("background.js 未复用 TransPipe createPipelineEngine");
}
const pipedA = engineFor({
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
});
const pipedB = engineFor({
  provider: "openai",
  apiKey: "   ",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
});
if (pipedA !== pipedB) fail("相同设置应复用同一条管道");
if (pipedA === mockTranslate) fail("管道应包在 mock 之外，buildEngine 仍返回 mock");
const pipedOut = await pipedA(sample);
if (pipedOut.segments[0].text !== "⟦Hello⟧") {
  fail(`管道 mock 结果异常: ${JSON.stringify(pipedOut)}`);
}
const pipedAgain = await pipedA(sample);
if (pipedAgain.segments[0].text !== "⟦Hello⟧") fail("管道缓存未返回同一译文");
const pipedOther = engineFor({
  provider: "openai",
  apiKey: "test-key",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
});
if (pipedOther === pipedA) fail("apiKey 变化应重建管道");
ok("TRANSLATE_BATCH 复用一条 createPipelineEngine，空 key 仍是 ⟦…⟧");

// 4) package smoke
run("npm", ["run", "smoke"]);
ok("packages/translate-core smoke");

// 5) manifest + options hard constraints
const manifest = JSON.parse(
  readFileSync(join(root, "extension/manifest.json"), "utf8")
);
if (manifest.version !== "0.4.0") {
  fail(`manifest version 应为 0.4.0，实际 ${manifest.version}`);
}
if (manifest.action?.default_popup !== "popup.html") {
  fail("工具栏 action 必须设置 default_popup，而不是仅静默切换");
}
if (bg.includes("chrome.action.onClicked") || bg.includes("action.onClicked")) {
  fail("已有 default_popup 时 background 不应再监听 action.onClicked");
}
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

// 5b) hover paragraph + configurable hotkey (default Alt+T), single TRANSLATE_BATCH
const DEFAULT_HOTKEY = "Alt+T";
if (!bg.includes('paragraphHotkey: "Alt+T"')) {
  fail("background.js 未把段落快捷键默认设为 Alt+T");
}
if (!bg.includes("paragraphHotkey")) fail("background.js 未保存 paragraphHotkey");
const hotkeySandbox = {};
createContext(hotkeySandbox);
runInContext(readFileSync(join(root, "extension/hotkey.js"), "utf8"), hotkeySandbox);
const hotkeyApi = hotkeySandbox.ImmerHotkey;
if (!hotkeyApi) fail("hotkey.js 未挂上 ImmerHotkey");
if (hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY !== DEFAULT_HOTKEY) {
  fail(`快捷键默认值应为 ${DEFAULT_HOTKEY}`);
}
if (hotkeyApi.normalizeHotkey("alt+t") !== DEFAULT_HOTKEY) fail("normalize alt+t");
if (hotkeyApi.normalizeHotkey("T") !== "") fail("无修饰键的快捷键必须拒绝");
if (hotkeyApi.normalizeHotkey("Shift+T") !== "") fail("仅 Shift 的快捷键必须拒绝");
if (hotkeyApi.normalizeHotkey("ctrl+shift+k") !== "Ctrl+Shift+K") {
  fail("Ctrl+Shift+K 规范化失败");
}
const altT = { altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, code: "KeyT", key: "t" };
if (!hotkeyApi.eventMatchesHotkey(altT, DEFAULT_HOTKEY)) fail("Alt+T 未匹配 KeyT");
const macOptionT = { altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, code: "KeyT", key: "†" };
if (!hotkeyApi.eventMatchesHotkey(macOptionT, DEFAULT_HOTKEY)) {
  fail("macOS Option+T 应仍匹配 Alt+T");
}
if (hotkeyApi.eventMatchesHotkey({ ...altT, altKey: false, key: "t", code: "KeyT" }, DEFAULT_HOTKEY)) {
  fail("单独 T 不应触发段落翻译");
}
if (hotkeyApi.formatHotkeyEvent(macOptionT) !== DEFAULT_HOTKEY) {
  fail("录制 Option+T 应得到 Alt+T");
}
ok("段落快捷键默认 Alt+T，修饰键规则可测");

const contentJs = readFileSync(join(root, "extension/content.js"), "utf8");
for (const needle of [
  "TOGGLE_TRANSLATE",
  "TRANSLATE_BATCH",
  'CLASS_HOVER = "immer-hover"',
  "placeTranslation",
  "translateSegment",
  "segments: [{ id, text }]",
  "paragraphHotkey",
  "ImmerHotkey",
]) {
  if (!contentJs.includes(needle)) fail(`content.js 缺少 ${needle}`);
}
if (!/function pickParagraphs/.test(contentJs)) fail("content.js 缺少整页段落选择");
const contentCss = readFileSync(join(root, "extension/content.css"), "utf8");
if (!contentCss.includes(".immer-translation") || !contentCss.includes(".immer-hover")) {
  fail("content.css 缺少译文或悬停样式");
}
const contentScripts = manifest.content_scripts?.[0]?.js || [];
if (contentScripts[0] !== "hotkey.js" || !contentScripts.includes("content.js")) {
  fail(`content_scripts 须先加载 hotkey.js: ${contentScripts.join(",")}`);
}
if (!optionsHtml.includes('id="paragraphHotkey"') || !optionsHtml.includes('id="resetHotkey"')) {
  fail("设置页缺少段落快捷键字段");
}
if (!optionsHtml.includes("默认 Alt+T")) fail("设置页未写明默认 Alt+T");
if (!optionsHtml.includes('src="hotkey.js"')) fail("设置页未加载 hotkey.js");
if (!optionsJs.includes("paragraphHotkey") || !optionsJs.includes('paragraphHotkey: "Alt+T"')) {
  fail("options.js 未把 paragraphHotkey 写入 chrome.storage.local 默认值");
}
ok("悬停段落单段翻译走 TRANSLATE_BATCH，快捷键可在设置页更改");

// 5c) per-origin deny/allow + reading style (0.3.0). Default deny list stays empty.
for (const needle of [
  "denyOrigins: []",
  "allowOrigins: []",
  'translationFontSize: "md"',
  'translationContrast: "normal"',
  'displayMode: "bilingual"',
]) {
  if (!bg.includes(needle)) fail(`background.js 缺少默认值 ${needle}`);
}
if (!optionsJs.includes("denyOrigins") || !optionsJs.includes("allowOrigins")) {
  fail("options.js 未把站点名单写入 chrome.storage.local");
}
if (!optionsJs.includes('translationFontSize: "md"') || !optionsJs.includes('displayMode: "bilingual"')) {
  fail("options.js 未保存默认阅读样式");
}
for (const id of [
  "siteEntry",
  "addDeny",
  "addAllow",
  "addCurrentDeny",
  "denyList",
  "allowList",
  "translationFontSize",
  "translationContrast",
  "displayMode",
]) {
  if (!new RegExp(`id="${id}"`).test(optionsHtml)) fail(`设置页缺少 ${id}`);
}
if (!optionsHtml.includes("永不翻译") || !optionsHtml.includes("仅译文")) {
  fail("设置页未说明永不翻译或仅译文");
}
if (!optionsHtml.includes('src="sitelist.js"')) fail("设置页未加载 sitelist.js");
const siteSandbox = { URL };
createContext(siteSandbox);
runInContext(readFileSync(join(root, "extension/sitelist.js"), "utf8"), siteSandbox);
const siteApi = siteSandbox.ImmerSites;
if (!siteApi) fail("sitelist.js 未挂上 ImmerSites");
if (siteApi.normalizeSiteEntry("Example.COM") !== "example.com") fail("裸域名应规范为 hostname");
if (siteApi.normalizeSiteEntry("https://Example.COM/a/b") !== "https://example.com") {
  fail("完整网址应规范为 origin");
}
if (siteApi.normalizeSiteEntry("http://example.com:8080/x") !== "http://example.com:8080") {
  fail("非默认端口应保留");
}
if (siteApi.normalizeSiteEntry("javascript:alert(1)") !== "") fail("非 http(s) 必须拒绝");
if (siteApi.normalizeSiteEntry("") !== "") fail("空来源必须拒绝");
const page = { origin: "https://example.com", hostname: "example.com" };
if (siteApi.siteListMatches([], page)) fail("空名单不应命中（默认所有站点可译）");
if (!siteApi.siteListMatches(["example.com"], page)) fail("裸域名应匹配 https 页");
if (!siteApi.siteListMatches(["example.com"], { origin: "http://example.com", hostname: "example.com" })) {
  fail("裸域名应匹配 http 页");
}
if (siteApi.siteListMatches(["https://example.com"], { origin: "http://example.com", hostname: "example.com" })) {
  fail("指定 https origin 不应匹配 http 页");
}
if (!siteApi.siteListMatches(["https://example.com"], page)) fail("origin 应精确匹配");
if (siteApi.siteListMatches(["example.com"], { origin: "https://www.example.com", hostname: "www.example.com" })) {
  fail("子域名不应被父域名误伤");
}
if (siteApi.siteListMatches(["other.test"], page)) fail("其它域名不应命中");
const deduped = siteApi.normalizeSiteList(["Example.COM", "https://example.com", "example.com", ""]);
if (!deduped.includes("example.com") || !deduped.includes("https://example.com") || deduped.includes("")) {
  fail(`名单去重失败: ${JSON.stringify(deduped)}`);
}
ok("站点名单按来源匹配，空名单不拦截");

for (const needle of [
  "originDenied",
  "denyOrigins",
  "allowOrigins",
  "data-immer-font-size",
  "data-immer-contrast",
  "data-immer-mode",
  "translation-only",
  "chrome.storage.onChanged",
  "paintTranslations",
]) {
  if (!contentJs.includes(needle)) fail(`content.js 缺少 ${needle}`);
}
const toggleSrc = contentJs.slice(contentJs.indexOf("async function toggle"));
const denyAt = toggleSrc.indexOf("originDenied()");
const applyAt = toggleSrc.indexOf("applyTranslations(");
if (denyAt < 0 || applyAt < 0 || denyAt > applyAt) {
  fail("toggle 必须在插入译文前检查黑名单");
}
const placeSrc = contentJs.slice(
  contentJs.indexOf("function placeTranslation"),
  contentJs.indexOf("function clearTranslations")
);
if (!placeSrc.includes("originDenied()")) fail("placeTranslation 必须拒绝黑名单来源");
if (!contentCss.includes("data-immer-font-size") || !contentCss.includes("data-immer-contrast")) {
  fail("content.css 缺少字号或对比度开关");
}
if (!contentCss.includes('data-immer-mode="translation-only"') || !contentCss.includes("data-immer-mode")) {
  fail("content.css 缺少双语/仅译文模式");
}
const siteIdx = contentScripts.indexOf("sitelist.js");
const contentIdx = contentScripts.indexOf("content.js");
if (siteIdx < 0 || contentIdx < 0 || siteIdx > contentIdx) {
  fail(`content_scripts 须在 content.js 之前加载 sitelist.js: ${contentScripts.join(",")}`);
}
const readme = readFileSync(join(root, "README.md"), "utf8");
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
if (!readme.includes("0.4.0") || !readme.includes("dev-0.4.0")) {
  fail("README 未记录 0.4.0 / dev-0.4.0");
}
if (readme.includes("当前开发版本为 **1.0.0**") || readme.includes("当前开发线是 `dev-1.0.0`")) {
  fail("README 仍把 1.0.0 写成当前版本");
}
if (!readme.includes("denyOrigins")) fail("README 未记录 denyOrigins");
if (!readme.includes("本机验收清单")) fail("README 缺少本机验收清单");
if (!readme.includes("加载已解压的扩展程序") || !readme.includes("钉到工具栏")) {
  fail("README 未用中文写明加载已解压的扩展程序，以及把图标钉到工具栏");
}
const readmeEn = readFileSync(join(root, "README.en.md"), "utf8");
if (!readmeEn.includes("Load unpacked") || !readmeEn.toLowerCase().includes("pin")) {
  fail("README.en.md 未写明 Load unpacked 与 pin");
}
if (!readmeEn.includes("0.4.0") || !readmeEn.includes("dev-0.4.0")) {
  fail("README.en.md 未记录 0.4.0 / dev-0.4.0");
}
if (!changelog.includes("## 0.4.0")) fail("CHANGELOG 缺少 0.4.0");
if (!changelog.includes("## 0.3.0")) fail("CHANGELOG 缺少 0.3.0");
if (!changelog.includes("已撤回")) fail("CHANGELOG 未说明过早的 1.0.0 已撤回");
ok("黑名单默认放行，样式开关可在已打开页面生效");

// 5d) toolbar popup + draggable ball (0.4.0). Same on/off state, empty key stays mock.
const popupHtml = readFileSync(join(root, "extension/popup.html"), "utf8");
const popupJs = readFileSync(join(root, "extension/popup.js"), "utf8");
for (const id of ["status", "mock", "translate", "restore", "options", "deny"]) {
  if (!new RegExp(`id="${id}"`).test(popupHtml)) fail(`弹窗缺少 ${id}`);
}
if (!popupHtml.includes("翻译本页") || !popupHtml.includes("还原本页")) {
  fail("弹窗缺少整页翻译或还原");
}
if (!popupHtml.includes("打开设置")) fail("弹窗缺少打开设置");
if (!popupHtml.includes("永不翻译本站")) fail("弹窗缺少永不翻译本站");
if (!popupHtml.includes("Mock 模式") || !popupHtml.includes("⟦原文⟧")) {
  fail("弹窗未标明空 key 的 mock 模式");
}
for (const id of ["baseUrl", "model", "apiKey", "provider"]) {
  if (new RegExp(`id="${id}"`).test(popupHtml)) fail(`弹窗不应包含完整设置字段 ${id}`);
}
for (const re of coercive) {
  if (re.test(popupHtml)) fail(`弹窗出现逼付费/登录文案: ${re}`);
}
for (const needle of [
  "GET_PAGE_STATE",
  "TRANSLATE_PAGE",
  "RESTORE_PAGE",
  "openOptionsPage",
  "apiKey",
  "DENY_THIS_ORIGIN",
  "chrome.storage.local",
]) {
  if (!popupJs.includes(needle)) fail(`popup.js 缺少 ${needle}`);
}
if (!popupJs.includes("已翻译") || !popupJs.includes("未翻译")) {
  fail("popup.js 未区分已翻译 / 未翻译");
}
ok("工具栏弹窗可翻译、还原、打开设置，并标明 mock");

for (const needle of [
  "GET_PAGE_STATE",
  "TRANSLATE_PAGE",
  "RESTORE_PAGE",
  "TOGGLE_TRANSLATE",
  "ballPosition",
  "immer-ball-host",
  "ImmerBall",
  "snapBallPosition",
  "normalizeStoredBallPosition",
  "DENY_THIS_ORIGIN",
  "本站已设为永不翻译",
]) {
  if (!contentJs.includes(needle)) fail(`content.js 缺少 ${needle}`);
}
if (!contentCss.includes("#immer-ball-host")) fail("content.css 缺少悬浮球宿主");
const ballIdx = contentScripts.indexOf("ballpos.js");
if (ballIdx < 0 || ballIdx > contentIdx) {
  fail(`content_scripts 须在 content.js 之前加载 ballpos.js: ${contentScripts.join(",")}`);
}
const ballSandbox = {};
createContext(ballSandbox);
runInContext(readFileSync(join(root, "extension/ballpos.js"), "utf8"), ballSandbox);
const ballApi = ballSandbox.ImmerBall;
if (!ballApi) fail("ballpos.js 未挂上 ImmerBall");
const ballVp = { width: 1200, height: 800 };
const ballDefault = ballApi.defaultBallPosition(ballVp);
if (ballDefault.left !== 1200 - ballApi.BALL_SIZE - ballApi.EDGE_MARGIN) {
  fail(`悬浮球默认应贴右缘: ${JSON.stringify(ballDefault)}`);
}
if (ballDefault.top !== 800 - ballApi.BALL_SIZE - ballApi.EDGE_MARGIN) {
  fail(`悬浮球默认应贴底缘: ${JSON.stringify(ballDefault)}`);
}
const snapLeft = ballApi.snapBallPosition({ left: 10, top: 400 }, ballVp);
if (snapLeft.left !== ballApi.EDGE_MARGIN) fail(`靠近左缘应吸附: ${JSON.stringify(snapLeft)}`);
const snapRight = ballApi.snapBallPosition({ left: 1130, top: 400 }, ballVp);
if (snapRight.left !== ballDefault.left) fail(`靠近右缘应吸附: ${JSON.stringify(snapRight)}`);
const snapTop = ballApi.snapBallPosition({ left: 500, top: 20 }, ballVp);
if (snapTop.top !== ballApi.EDGE_MARGIN) fail(`靠近上缘应吸附: ${JSON.stringify(snapTop)}`);
const snapBottom = ballApi.snapBallPosition({ left: 500, top: 730 }, ballVp);
if (snapBottom.top !== ballDefault.top) fail(`靠近下缘应吸附: ${JSON.stringify(snapBottom)}`);
const stay = ballApi.snapBallPosition({ left: 500, top: 400 }, ballVp);
if (stay.left !== 500 || stay.top !== 400) fail(`远离边缘不应吸附: ${JSON.stringify(stay)}`);
const corner = ballApi.snapBallPosition({ left: 8, top: 740 }, ballVp);
if (corner.left !== ballApi.EDGE_MARGIN || corner.top !== ballDefault.top) {
  fail(`靠近角落应同时吸附两条边: ${JSON.stringify(corner)}`);
}
const clamped = ballApi.clampBallPosition({ left: -100, top: 99999 }, ballVp);
if (clamped.left !== ballApi.EDGE_MARGIN || clamped.top !== ballDefault.top) {
  fail(`位置应夹在视口内: ${JSON.stringify(clamped)}`);
}
if (ballApi.normalizeStoredBallPosition(null, ballVp) !== null) fail("空的 ballPosition 应忽略");
if (ballApi.normalizeStoredBallPosition({ left: "nope", top: 10 }, ballVp) !== null) {
  fail("非法 ballPosition 应忽略");
}
const stored = ballApi.normalizeStoredBallPosition({ left: 500, top: 400 }, ballVp);
if (!stored || stored.left !== 500 || stored.top !== 400) fail("合法 ballPosition 应保留");
const storedOff = ballApi.normalizeStoredBallPosition({ left: 5000, top: -20 }, ballVp);
if (!storedOff || storedOff.left !== ballDefault.left || storedOff.top !== ballApi.EDGE_MARGIN) {
  fail(`越界 ballPosition 应夹回视口: ${JSON.stringify(storedOff)}`);
}
if (!readme.includes("悬浮球") || !readme.includes("弹窗")) fail("README 未记录弹窗或悬浮球");
ok("悬浮球默认为右下角，拖近边缘会吸附，位置可从 storage 还原");

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

// 7) Node/cloud YAML template + merge. Extension stays on chrome.storage.
const configYamlPath = join(root, "config.yaml");
if (!existsSync(configYamlPath)) fail("缺少 config.yaml 模板");
const configRaw = readFileSync(configYamlPath, "utf8");
const apiKeyLine = configRaw.split(/\r?\n/).find((line) => /^\s*apiKey\s*:/.test(line));
if (!apiKeyLine) fail("config.yaml 缺少 apiKey");
const apiKeyValue = apiKeyLine.slice(apiKeyLine.indexOf(":") + 1).trim();
if (apiKeyValue !== '""' && apiKeyValue !== "''" && apiKeyValue !== "") {
  fail("config.yaml 的 apiKey 必须为空");
}
const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
for (const pattern of ["config.local.yaml", "config.local.yml", "*.local.yaml", "*.local.yml"]) {
  if (!gitignore.includes(pattern)) fail(`.gitignore 缺少 ${pattern}`);
}
const ignoreLocal = spawnSync("git", ["check-ignore", "-q", "config.local.yaml"], {
  cwd: root,
});
if (ignoreLocal.status !== 0) fail("config.local.yaml 未被 gitignore");
for (const sample of ["config.local.yml", "notes.local.yaml"]) {
  const sampleIgnore = spawnSync("git", ["check-ignore", "-q", sample], { cwd: root });
  if (sampleIgnore.status !== 0) fail(`${sample} 未被 gitignore`);
}
const ignoreTemplate = spawnSync("git", ["check-ignore", "-q", "config.yaml"], { cwd: root });
if (ignoreTemplate.status === 0) fail("config.yaml 不应被 gitignore");
const trackedLocal = run("git", ["ls-files", "--", "config.local.yaml", "config.local.yml"]).trim();
if (trackedLocal) fail(`本地配置被跟踪: ${trackedLocal}`);

const { loadMergedEngineConfig, createEngineFromMergedConfig } = await import(
  pathToFileURL(join(root, "packages/translate-core/config/load.js")).href
);
const templateCfg = loadMergedEngineConfig({
  cwd: root,
  env: {},
  readFile(filePath) {
    if (basename(filePath) === "config.local.yaml") return null;
    return readFileSync(filePath, "utf8");
  },
});
if (templateCfg.apiKey !== "") fail("config.yaml 合并后 apiKey 必须为空");
if (templateCfg.provider !== "openai") fail(`模板 provider 异常: ${templateCfg.provider}`);
if (templateCfg.baseUrl !== "https://api.deepseek.com/v1") fail("模板 baseUrl 异常");
if (templateCfg.model !== "deepseek-flash") fail("模板 model 异常");
if (templateCfg.sourceLang !== "auto" || templateCfg.targetLang !== "zh-CN") {
  fail("模板 sourceLang/targetLang 异常");
}
const templateEngine = createEngineFromMergedConfig(templateCfg);
const templateOut = await templateEngine({
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [{ id: "a", text: "Hi" }],
});
if (templateOut.segments[0].text !== "⟦Hi⟧") fail("空 apiKey 未走 mockTranslate");

const mergeDir = mkdtempSync(join(tmpdir(), "immer-accept-config-"));
try {
  writeFileSync(
    join(mergeDir, "config.yaml"),
    'provider: openai\nbaseUrl: https://base.example/v1\nmodel: base-model\napiKey: ""\nsourceLang: auto\ntargetLang: zh-CN\n'
  );
  writeFileSync(
    join(mergeDir, "config.local.yaml"),
    "provider: anthropic\nbaseUrl: https://local.example/v1\nmodel: local-model\napiKey: local-test-key\nsourceLang: en\n"
  );
  const merged = loadMergedEngineConfig({
    cwd: mergeDir,
    env: {
      DEEPSEEK_API_KEY: "env-test-key",
      DEEPSEEK_BASE_URL: "https://env.example/v1",
    },
  });
  if (merged.apiKey !== "env-test-key") fail("env apiKey 未覆盖 local yaml");
  if (merged.baseUrl !== "https://env.example/v1") fail("env baseUrl 未覆盖 local yaml");
  if (merged.model !== "local-model") fail("local yaml model 应保留（env 未设置 model）");
  if (merged.provider !== "anthropic") fail("local yaml provider 应保留");
  if (merged.sourceLang !== "en" || merged.targetLang !== "zh-CN") fail("语言合并优先级异常");
} finally {
  rmSync(mergeDir, { recursive: true, force: true });
}
ok("config.yaml 空密钥模板 + local gitignore + 合并优先级");

if (bg.includes("loadMergedEngineConfig") || bg.includes("config.yaml") || bg.includes("config.local")) {
  fail("background.js 不应读取 YAML");
}
if (optionsJs.includes("config.yaml") || optionsJs.includes("config.local")) {
  fail("options.js 不应读取 YAML");
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

for (const file of walk(join(root, "extension"))) {
  const name = basename(file);
  if (
    name === "config.yaml" ||
    name === "config.yml" ||
    name === "config.local.yaml" ||
    name === "config.local.yml" ||
    name.endsWith(".local.yaml") ||
    name.endsWith(".local.yml")
  ) {
    fail(`extension 树不应包含配置文件 ${file}`);
  }
  if (name.endsWith(".png") || name.endsWith(".jpg")) continue;
  const text = readFileSync(file, "utf8");
  if (/sk-[a-zA-Z0-9]{20,}/.test(text)) fail(`${file} 疑似含 API key`);
  if (text.includes("config.local.yaml") || text.includes("config.local.yml")) {
    fail(`${file} 不应引用本地 YAML`);
  }
}
ok("extension/vendor 无 config.local.yaml 与密钥");

console.log(
  "\naccept-mvp ok — 浏览器手测: 加载 extension/ → 点工具栏应打开弹窗（空 key 标明 Mock）；翻译本页出现 ⟦原文⟧，还原后节点消失；右下角悬浮球可拖、刷新后位置还在，点一下与弹窗同一状态；永不翻译的来源点球只提示不插入；悬停一段按 Alt+T 只译该段；改字号/对比度/仅译文后已打开页面立即变样"
);

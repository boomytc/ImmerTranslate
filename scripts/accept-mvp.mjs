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
if (corePkg.version !== "1.0.0") {
  fail(`translate-core 版本应为 1.0.0，实际 ${corePkg.version}`);
}
ok("translate-core 包版本 1.0.0，vendor 已与 src 对齐");

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
const { buildEngine, engineFor, failureResponse } = await import(
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

const rejected = failureResponse(
  Object.assign(new Error("translate HTTP 401: invalid"), {
    kind: "provider",
    code: "invalid_api_key",
    status: 401,
  })
);
if (
  rejected.ok !== false ||
  rejected.error !== "translate HTTP 401: invalid" ||
  rejected.kind !== "provider" ||
  rejected.code !== "invalid_api_key" ||
  rejected.status !== 401
) {
  fail(`TRANSLATE_BATCH 失败回包应带上 message/kind/code/status: ${JSON.stringify(rejected)}`);
}
const networkRejected = failureResponse(
  Object.assign(new Error("translate network: connect ECONNREFUSED"), {
    kind: "network",
    code: "network",
  })
);
if (networkRejected.kind !== "network" || networkRejected.code !== "network" || networkRejected.status != null) {
  fail(`网络失败应带 kind/code 且没有 status: ${JSON.stringify(networkRejected)}`);
}
if (!bg.includes("kind: err?.kind") || !bg.includes("code: err?.code") || !bg.includes("status: err?.status")) {
  fail("background.js 未把 kind/code/status 放进失败回包");
}
if (!bg.includes("failureResponse(err)")) fail("TRANSLATE_BATCH 失败须走 failureResponse");
ok("TRANSLATE_BATCH 失败回包带上 kind、code、status");

// 4) package smoke
run("npm", ["run", "smoke"]);
ok("packages/translate-core smoke");

// 5) manifest + options hard constraints
const manifest = JSON.parse(
  readFileSync(join(root, "extension/manifest.json"), "utf8")
);
if (manifest.version !== "1.0.0") {
  fail(`manifest version 应为 1.0.0，实际 ${manifest.version}`);
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
if (!optionsHtml.includes('href="glass.css"') || !optionsHtml.includes("immer-glass")) {
  fail("选项页未使用共享毛玻璃样式");
}
const navLabels = ["基本", "快捷键", "悬浮球", "站点名单", "引擎与密钥"];
let navCursor = 0;
for (const label of navLabels) {
  const at = optionsHtml.indexOf(`>${label}<`, navCursor);
  if (at < 0) fail(`选项页导航缺少或顺序不对: ${label}`);
  navCursor = at + label.length;
}
if (!optionsHtml.includes('id="pageHotkey"') || !optionsHtml.includes('id="ballEnabled"')) {
  fail("选项页缺少整页快捷键或悬浮球开关");
}
if (!optionsHtml.includes("⟦原文⟧") || !optionsHtml.includes("⟦…⟧")) {
  fail("选项页未标明空密钥的 mock 译文");
}
if (!optionsHtml.includes("无强制登录") || !optionsHtml.includes("无升级弹窗")) {
  fail("选项页未写明无强制登录、无升级弹窗");
}
const optionsCss = readFileSync(join(root, "extension/options.css"), "utf8");
if (!optionsCss.includes("var(--immer-glass-") || !optionsCss.includes("var(--immer-cta-bg)")) {
  fail("选项页样式未复用毛玻璃令牌");
}
if (/#(?:ff69b4|ec4899|ff5c8a|f43f7a|ff4d8d|ff6b9d)/i.test(optionsCss)) {
  fail("选项页不应使用沉浸式翻译的粉色");
}
if (/navigator\.platform|MacIntel|Win32|@supports\s*\(\s*-moz/.test(optionsCss)) {
  fail("选项页布局不应按操作系统分叉");
}
if (/background:\s*#fff\b|background:\s*white\b|background:\s*#ffffff\b/i.test(optionsCss)) {
  fail("选项页不应使用整页纯白底");
}
if (!optionsJs.includes('pageHotkey: "Alt+A"') || !optionsJs.includes("ballEnabled: true")) {
  fail("options.js 未保留整页快捷键与悬浮球默认值");
}
if (!optionsJs.includes("formatHotkeyDisplay") || !optionsJs.includes("modifierHint")) {
  fail("选项页快捷键未走共享的平台格式函数");
}
ok("设置页可填本地 key，无登录/逼付费文案");

// 5b) hover paragraph + configurable hotkey.
// Canonical chord stays Alt+T (Option on macOS). UI shows ⌥T on macOS and Alt+T on Windows/Linux.
const DEFAULT_HOTKEY = "Alt+T";
const DEFAULT_PAGE_HOTKEY = "Alt+A";
if (!bg.includes('paragraphHotkey: "Alt+T"')) {
  fail("background.js 未把段落快捷键的规范默认设为 Alt+T");
}
if (!bg.includes("getPlatformInfo")) {
  fail("service worker 未用 chrome.runtime.getPlatformInfo 识别平台");
}
if (!bg.includes("⌥T")) fail("macOS 未把段落默认存成 ⌥T");
if (!bg.includes("paragraphHotkey")) fail("background.js 未保存 paragraphHotkey");
const hotkeySandbox = {};
createContext(hotkeySandbox);
runInContext(readFileSync(join(root, "extension/hotkey.js"), "utf8"), hotkeySandbox);
const hotkeyApi = hotkeySandbox.ImmerHotkey;
if (!hotkeyApi) fail("hotkey.js 未挂上 ImmerHotkey");
if (hotkeyApi.DEFAULT_PARAGRAPH_HOTKEY !== DEFAULT_HOTKEY) {
  fail(`段落快捷键规范默认值应为 ${DEFAULT_HOTKEY}`);
}
if (hotkeyApi.DEFAULT_PAGE_HOTKEY !== DEFAULT_PAGE_HOTKEY) {
  fail(`整页快捷键规范默认值应为 ${DEFAULT_PAGE_HOTKEY}`);
}
if (hotkeyApi.DEFAULT_PAGE_HOTKEY === "Meta+T") fail("整页快捷键不能默认 Command+T");
if (hotkeyApi.normalizeHotkey("alt+t") !== DEFAULT_HOTKEY) fail("normalize alt+t");
if (hotkeyApi.normalizeHotkey("⌥T") !== DEFAULT_HOTKEY) fail("⌥T 应规范为 Alt+T");
if (hotkeyApi.normalizeHotkey("⌥A") !== DEFAULT_PAGE_HOTKEY) fail("⌥A 应规范为 Alt+A");
if (hotkeyApi.normalizeHotkey("T") !== "") fail("无修饰键的快捷键必须拒绝");
if (hotkeyApi.normalizeHotkey("Shift+T") !== "") fail("仅 Shift 的快捷键必须拒绝");
if (hotkeyApi.normalizeHotkey("ctrl+shift+k") !== "Ctrl+Shift+K") {
  fail("Ctrl+Shift+K 规范化失败");
}
const altT = { altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, code: "KeyT", key: "t" };
if (!hotkeyApi.eventMatchesHotkey(altT, DEFAULT_HOTKEY)) fail("Alt+T 未匹配 KeyT");
if (!hotkeyApi.eventMatchesHotkey(altT, "⌥T")) fail("存储的 ⌥T 应匹配 Option+T");
const macOptionT = { altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, code: "KeyT", key: "†" };
if (!hotkeyApi.eventMatchesHotkey(macOptionT, DEFAULT_HOTKEY)) {
  fail("macOS Option+T 应仍匹配 Alt+T");
}
const macOptionA = { altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, code: "KeyA", key: "å" };
if (!hotkeyApi.eventMatchesHotkey(macOptionA, "⌥A")) fail("macOS Option+A 应匹配整页快捷键");
if (hotkeyApi.eventMatchesHotkey({ ...altT, altKey: false, key: "t", code: "KeyT" }, DEFAULT_HOTKEY)) {
  fail("单独 T 不应触发段落翻译");
}
if (hotkeyApi.formatHotkeyEvent(macOptionT) !== DEFAULT_HOTKEY) {
  fail("录制 Option+T 的规范值应为 Alt+T");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_HOTKEY, "mac") !== "⌥T") fail("macOS 应显示 ⌥T");
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_HOTKEY, "mac").includes("Alt")) {
  fail("macOS 段落默认不应显示 Alt");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_HOTKEY, "windows") !== "Alt+T") fail("Windows 应显示 Alt+T");
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_HOTKEY, "linux") !== "Alt+T") fail("Linux 应显示 Alt+T");
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "mac") !== "⌥A") fail("macOS 整页应显示 ⌥A");
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "windows") !== "Alt+A") {
  fail("Windows 整页应显示 Alt+A");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "linux") !== "Alt+A") {
  fail("Linux 整页应显示 Alt+A");
}
if (hotkeyApi.formatActionLabel("翻译", DEFAULT_PAGE_HOTKEY, "mac") !== "翻译 (⌥A)") {
  fail("macOS 弹窗文案应为「翻译 (⌥A)」");
}
if (hotkeyApi.formatActionLabel("翻译", DEFAULT_PAGE_HOTKEY, "windows") !== "翻译 (Alt+A)") {
  fail("Windows 弹窗文案应为「翻译 (Alt+A)」");
}
if (hotkeyApi.formatActionLabel("翻译", DEFAULT_PAGE_HOTKEY, "linux") !== "翻译 (Alt+A)") {
  fail("Linux 弹窗文案应为「翻译 (Alt+A)」");
}
if (hotkeyApi.formatActionLabel("翻译", DEFAULT_HOTKEY, "mac") !== "翻译 (⌥T)") {
  fail("macOS 段落文案应为「翻译 (⌥T)」");
}
if (hotkeyApi.formatBallHoverTitle(false, "简体中文", DEFAULT_PAGE_HOTKEY, "mac") !== "点击翻译为简体中文 (⌥A)") {
  fail("macOS 未翻译时悬浮球悬停应为「点击翻译为简体中文 (⌥A)」");
}
if (hotkeyApi.formatBallHoverTitle(false, "简体中文", DEFAULT_PAGE_HOTKEY, "windows") !== "点击翻译为简体中文 (Alt+A)") {
  fail("Windows 未翻译时悬浮球悬停应为「点击翻译为简体中文 (Alt+A)」");
}
if (hotkeyApi.formatBallHoverTitle(false, "简体中文", DEFAULT_PAGE_HOTKEY, "linux") !== "点击翻译为简体中文 (Alt+A)") {
  fail("Linux 未翻译时悬浮球悬停应为「点击翻译为简体中文 (Alt+A)」");
}
if (hotkeyApi.formatBallHoverTitle(true, "简体中文", DEFAULT_PAGE_HOTKEY, "mac") !== "已翻译 · 点击显示原文 (⌥A)") {
  fail("macOS 已翻译时悬浮球悬停应为「已翻译 · 点击显示原文 (⌥A)」");
}
if (hotkeyApi.formatBallHoverTitle(true, "简体中文", DEFAULT_PAGE_HOTKEY, "windows") !== "已翻译 · 点击显示原文 (Alt+A)") {
  fail("Windows 已翻译时悬浮球悬停应为「已翻译 · 点击显示原文 (Alt+A)」");
}
if (hotkeyApi.formatBallHoverTitle(true, "简体中文", DEFAULT_PAGE_HOTKEY, "linux") !== "已翻译 · 点击显示原文 (Alt+A)") {
  fail("Linux 已翻译时悬浮球悬停应为「已翻译 · 点击显示原文 (Alt+A)」");
}
if (hotkeyApi.formatBallHoverTitle(false, "English", "Ctrl+B", "windows") !== "点击翻译为English (Ctrl+B)") {
  fail("悬浮球悬停应跟随目标语言和已保存的整页快捷键");
}
if (typeof hotkeyApi.formatBallHoverTitle !== "function") {
  fail("hotkey.js 未导出 formatBallHoverTitle");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "mac") === "⌘T") {
  fail("整页快捷键不能显示成 ⌘T");
}
if (hotkeyApi.formatHotkeyDisplay("Meta+K", "mac") !== "⌘K") fail("macOS 应将 Meta 显示为 ⌘");
if (hotkeyApi.formatHotkeyDisplay("Meta+K", "windows") !== "Win+K") fail("Windows 应将 Meta 显示为 Win");
if (hotkeyApi.platformFromUserAgentData("macOS") !== "mac") fail("userAgentData macOS");
if (hotkeyApi.platformFromUserAgentData("Windows") !== "windows") fail("userAgentData Windows");
if (hotkeyApi.platformFromNavigatorPlatform("MacIntel") !== "mac") fail("navigator.platform MacIntel");
if (hotkeyApi.platformFromNavigatorPlatform("Win32") !== "windows") fail("navigator.platform Win32");
if (hotkeyApi.platformFromChromeOs("mac") !== "mac") fail("getPlatformInfo mac");
if (hotkeyApi.platformFromChromeOs("win") !== "windows") fail("getPlatformInfo win");
if (hotkeyApi.platformFromChromeOs("linux") !== "linux") fail("getPlatformInfo linux");
if (hotkeyApi.platformFromChromeOs("cros") !== "linux") fail("getPlatformInfo cros");
const hotkeySrc = readFileSync(join(root, "extension/hotkey.js"), "utf8");
if (!hotkeySrc.includes("userAgentData") || !hotkeySrc.includes("navigator.platform")) {
  fail("hotkey.js 未用 userAgentData / navigator.platform 识别平台");
}
if (!hotkeySrc.includes("getPlatformInfo")) {
  fail("扩展页面未回退到 chrome.runtime.getPlatformInfo");
}
if (!hotkeySrc.includes("function formatActionLabel") || !hotkeySrc.includes("formatHotkeyDisplay(spec, platform)")) {
  fail("弹窗括号与设置页未共用 formatHotkeyDisplay");
}
ok("段落快捷键按平台显示，修饰键规则可测");

// 5b2) Whole-page Alt+A / ⌥A must win in the capture phase. No Mac in CI:
// these branches prove the macOS display (⌥A) and the Option+A match (key å, code KeyA).
const winAltA = {
  type: "keydown",
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  code: "KeyA",
  key: "a",
  repeat: false,
  isComposing: false,
};
const macAltA = {
  type: "keydown",
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  code: "KeyA",
  key: "å",
  repeat: false,
  isComposing: false,
};
const altTDown = {
  type: "keydown",
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false,
  code: "KeyT",
  key: "t",
  repeat: false,
  isComposing: false,
};
if (typeof hotkeyApi.hotkeyAction !== "function" || typeof hotkeyApi.resolveChord !== "function") {
  fail("hotkey.js 未导出 hotkeyAction / resolveChord");
}
if (typeof hotkeyApi.markChordEvent !== "function") fail("hotkey.js 未导出 markChordEvent");
let chord = hotkeyApi.resolveChord(winAltA, { typing: false, hovered: false, keydownCode: "" });
if (chord.action !== "page" || !chord.prevent || chord.keydownCode !== "KeyA") {
  fail(`Windows/Linux Alt+A 应在 keydown 切换整页: ${JSON.stringify(chord)}`);
}
chord = hotkeyApi.resolveChord(macAltA, { typing: false, hovered: true, keydownCode: "" });
if (chord.action !== "page" || !chord.prevent) {
  fail(`macOS ⌥A（key å / code KeyA）应切换整页: ${JSON.stringify(chord)}`);
}
chord = hotkeyApi.resolveChord(
  { ...winAltA, type: "keyup" },
  { typing: false, hovered: false, keydownCode: "KeyA" }
);
if (chord.action !== "" || chord.prevent || chord.keydownCode !== "") {
  fail("已处理的 keydown 不应在 keyup 再触发");
}
chord = hotkeyApi.resolveChord(
  { ...winAltA, type: "keyup" },
  { typing: false, hovered: false, keydownCode: "", lastToggleAt: 0, now: 2000 }
);
if (chord.action !== "page" || !chord.prevent) {
  fail("keydown 被吃掉时，keyup 应补上一次整页切换");
}
chord = hotkeyApi.resolveChord(
  { ...winAltA, type: "keyup" },
  { typing: false, hovered: false, keydownCode: "", lastToggleAt: 1000, now: 1200 }
);
if (chord.action !== "" || chord.prevent) {
  fail("命令或 keydown 刚切换过时，keyup 不能再翻一次");
}
chord = hotkeyApi.resolveChord(winAltA, {
  typing: false,
  hovered: false,
  keydownCode: "",
  lastToggleAt: 1000,
  now: 1200,
});
if (chord.action !== "page" || !chord.prevent) {
  fail("第二次 keydown 不应被上一次切换的时间窗吃掉");
}
chord = hotkeyApi.resolveChord(altTDown, {
  typing: false,
  hovered: true,
  keydownCode: "",
  paragraphSpec: "Alt+T",
});
if (chord.action !== "paragraph" || !chord.prevent) fail("悬停时 Alt+T 应只译该段");
chord = hotkeyApi.resolveChord(altTDown, { typing: false, hovered: false, keydownCode: "" });
if (chord.action !== "") fail("未悬停时 Alt+T 不应切换整页");
chord = hotkeyApi.resolveChord(
  { ...macAltA, key: "†", code: "KeyT" },
  { typing: false, hovered: true, keydownCode: "", paragraphSpec: "Alt+T" }
);
if (chord.action !== "paragraph") fail("macOS ⌥T 悬停时应译段落");
chord = hotkeyApi.resolveChord(
  { ...altTDown, type: "keyup", key: "†" },
  {
    typing: false,
    hovered: true,
    keydownCode: "",
    paragraphSpec: "⌥T",
    lastToggleAt: 1000,
    now: 1200,
  }
);
if (chord.action !== "paragraph" || !chord.prevent) {
  fail("整页刚切换过时，被吃掉的 ⌥T keyup 仍应只译悬停段");
}
chord = hotkeyApi.resolveChord(altTDown, {
  typing: false,
  hovered: true,
  keydownCode: "",
  paragraphSpec: "Ctrl+Shift+K",
});
if (chord.action !== "") fail("改键后悬停时 Alt+T 必须失效");
const customParagraph = {
  type: "keydown",
  altKey: false,
  ctrlKey: true,
  shiftKey: true,
  metaKey: false,
  code: "KeyK",
  key: "K",
  repeat: false,
  isComposing: false,
};
chord = hotkeyApi.resolveChord(customParagraph, {
  typing: false,
  hovered: true,
  keydownCode: "",
  paragraphSpec: "Ctrl+Shift+K",
});
if (chord.action !== "paragraph" || !chord.prevent) fail("保存的新组合悬停时应只译该段");
chord = hotkeyApi.resolveChord(customParagraph, {
  typing: false,
  hovered: false,
  keydownCode: "",
  paragraphSpec: "Ctrl+Shift+K",
});
if (chord.action !== "") fail("未悬停时新的段落组合不能切换整页");
if (typeof hotkeyApi.sameHotkey !== "function") fail("hotkey.js 未导出 sameHotkey");
if (!hotkeyApi.sameHotkey("⌥T", "Alt+T")) fail("⌥T 与命令里的 Alt+T 应视为同一段落键");
if (!hotkeyApi.sameHotkey("MacCtrl+Shift+K", "Ctrl+Shift+K")) fail("MacCtrl 应等同 Ctrl");
if (hotkeyApi.sameHotkey("Alt+T", "Ctrl+Shift+K")) fail("不同组合不能当成同一快捷键");
if (hotkeyApi.sameHotkey("", "Alt+T") || hotkeyApi.sameHotkey("Alt+T", "")) {
  fail("空的命令快捷键不能匹配段落键");
}
if (hotkeyApi.normalizeHotkey("MacCtrl+T") !== "Ctrl+T") fail("MacCtrl+T 应规范为 Ctrl+T");
chord = hotkeyApi.resolveChord(winAltA, { typing: true, hovered: false, keydownCode: "" });
if (chord.action !== "" || chord.prevent) fail("输入框内不应拦截 Alt+A");
chord = hotkeyApi.resolveChord(
  { ...winAltA, repeat: true },
  { typing: false, hovered: false, keydownCode: "" }
);
if (chord.action !== "") fail("按住 Alt+A 不应重复触发");
const ctrlA = {
  type: "keydown",
  altKey: false,
  ctrlKey: true,
  shiftKey: false,
  metaKey: false,
  code: "KeyA",
  key: "a",
};
if (hotkeyApi.resolveChord(ctrlA, { typing: false, hovered: false, keydownCode: "" }).action !== "") {
  fail("Ctrl+A 必须留给全选");
}
const metaT = {
  type: "keydown",
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  metaKey: true,
  code: "KeyT",
  key: "t",
};
if (hotkeyApi.resolveChord(metaT, { typing: false, hovered: false, keydownCode: "" }).action !== "") {
  fail("⌘T 不能当成整页快捷键");
}
const altShiftA = {
  type: "keydown",
  altKey: true,
  ctrlKey: false,
  shiftKey: true,
  metaKey: false,
  code: "KeyA",
  key: "A",
};
if (hotkeyApi.resolveChord(altShiftA, { typing: false, hovered: false, keydownCode: "" }).action !== "") {
  fail("Alt+Shift+A 不是整页默认");
}
const sameEvent = { type: "keydown", code: "KeyA", timeStamp: 12.5 };
const firstDispatch = hotkeyApi.markChordEvent(null, sameEvent);
const secondDispatch = hotkeyApi.markChordEvent(firstDispatch.slot, sameEvent);
if (firstDispatch.duplicate || !secondDispatch.duplicate) {
  fail("同一按键在 window 与 document 上只能处理一次");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "mac") !== "⌥A") {
  fail("macOS 整页显示分支应为 ⌥A");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "windows") !== "Alt+A") {
  fail("Windows 整页显示分支应为 Alt+A");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_PAGE_HOTKEY, "linux") !== "Alt+A") {
  fail("Linux 整页显示分支应为 Alt+A");
}
if (hotkeyApi.formatHotkeyDisplay(DEFAULT_HOTKEY, "mac") !== "⌥T") {
  fail("macOS 段落显示分支应为 ⌥T");
}
ok("无 Mac 运行时，整页 ⌥A 与 Alt+A 的匹配和显示分支已覆盖");

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
if (!optionsHtml.includes('id="hotkeyHint"')) fail("设置页缺少快捷键说明");
if (optionsHtml.includes("默认 Alt+T") || optionsHtml.includes("恢复默认 Alt+T")) {
  fail("设置页把 Alt+T 写死成各平台都看到的默认文案");
}
if (!optionsHtml.includes('src="hotkey.js"')) fail("设置页未加载 hotkey.js");
if (!optionsJs.includes("paragraphHotkey") || !optionsJs.includes('paragraphHotkey: "Alt+T"')) {
  fail("options.js 未把 paragraphHotkey 的规范默认写入 chrome.storage.local");
}
if (!optionsJs.includes("formatHotkeyDisplay") || !optionsJs.includes("detectPlatform")) {
  fail("设置页未按平台格式化段落快捷键");
}
if (!contentJs.includes("DEFAULT_PAGE_HOTKEY") && !contentJs.includes("PAGE_HOTKEY")) {
  fail("content.js 未绑定整页快捷键");
}
for (const target of ["window", "document"]) {
  for (const type of ["keydown", "keyup"]) {
    const needle = `${target}.addEventListener("${type}", onChordKey, { capture: true })`;
    if (!contentJs.includes(needle)) fail(`content.js 缺少捕获阶段监听 ${needle}`);
  }
}
const chordStart = contentJs.indexOf("function onChordKey");
const chordFn = contentJs.slice(chordStart, contentJs.indexOf("\napplyPageStyle();", chordStart));
if (!chordFn.includes("event.preventDefault()") || !chordFn.includes("event.stopPropagation()")) {
  fail("命中整页或段落快捷键时必须 preventDefault 并 stopPropagation");
}
if (!chordFn.includes("focusIsTyping") || !chordFn.includes("resolveChord")) {
  fail("快捷键必须先判断焦点不在可编辑控件，再决定是否拦截");
}
if (chordFn.indexOf("decision.prevent") > chordFn.indexOf("event.preventDefault()")) {
  fail("必须在确认命中之后才 preventDefault");
}
if (!contentJs.includes("toggleFromChord")) {
  fail("整页热键与扩展命令必须走同一套 toggleFromChord");
}
const pageCommand = manifest.commands?.["toggle-page-translate"];
if (!pageCommand?.description) fail("manifest 缺少整页命令 toggle-page-translate");
const suggested = pageCommand.suggested_key || {};
for (const platform of ["default", "mac", "windows", "linux", "chromeos"]) {
  if (suggested[platform] !== "Alt+A") {
    fail(`整页命令在 ${platform} 上应为 Alt+A，实际 ${suggested[platform] || ""}`);
  }
}
const suggestedText = JSON.stringify(suggested);
if (/Ctrl\+A|Command\+T|Ctrl\+T|Meta\+T/.test(suggestedText)) {
  fail("整页命令不能改成 Ctrl+A 或 ⌘T");
}
if (!bg.includes("chrome.commands.onCommand") || !bg.includes("toggle-page-translate")) {
  fail("service worker 未监听整页命令");
}
if (!bg.includes('type: "TOGGLE_TRANSLATE"')) {
  fail("整页命令必须向当前页发送 TOGGLE_TRANSLATE");
}
const paragraphCommand = manifest.commands?.["translate-hovered-paragraph"];
if (!paragraphCommand?.description) fail("manifest 缺少段落命令 translate-hovered-paragraph");
const paragraphSuggested = paragraphCommand.suggested_key || {};
for (const platform of ["default", "mac", "windows", "linux", "chromeos"]) {
  if (paragraphSuggested[platform] !== "Alt+T") {
    fail(`段落命令在 ${platform} 上应为 Alt+T，实际 ${paragraphSuggested[platform] || ""}`);
  }
}
if (/Ctrl\+T|Command\+T|Meta\+T/.test(JSON.stringify(paragraphSuggested))) {
  fail("段落命令不能改成 Ctrl+T 或 ⌘T");
}
if (!bg.includes("translate-hovered-paragraph") || !bg.includes("paragraphCommandShortcut")) {
  fail("service worker 未按当前绑定处理段落命令");
}
if (!bg.includes('type: "TRANSLATE_HOVERED_PARAGRAPH"')) {
  fail("段落命令必须向当前页发送 TRANSLATE_HOVERED_PARAGRAPH");
}
if (!contentJs.includes("TRANSLATE_HOVERED_PARAGRAPH") || !contentJs.includes("onParagraphFromCommand")) {
  fail("content.js 未处理段落命令");
}
if (!contentJs.includes("sameHotkey")) fail("段落命令未与已保存的 paragraphHotkey 比对");
const onChordBody = contentJs.slice(
  contentJs.indexOf("function onChordKey"),
  contentJs.indexOf("function onStorageChanged")
);
const denyBeforePrevent = onChordBody.indexOf("originDenied()");
const preventInChord = onChordBody.indexOf("event.preventDefault()");
if (denyBeforePrevent < 0 || preventInChord < 0 || denyBeforePrevent > preventInChord) {
  fail("黑名单上的段落热键必须在 preventDefault 之前停手");
}
const segSrc = contentJs.slice(
  contentJs.indexOf("async function translateSegment"),
  contentJs.indexOf("function currentViewport")
);
const pendingSet = segSrc.indexOf('setAttribute(ATTR_PENDING, "1")');
const settingsAwait = segSrc.indexOf("await getPageSettings");
if (pendingSet < 0 || settingsAwait < 0 || pendingSet > settingsAwait) {
  fail("单段翻译必须在 await 之前标上 pending，避免同一次按键插入两块译文");
}
if (!segSrc.includes('getAttribute(ATTR_DONE) === "1"')) fail("已译段落必须直接返回");
const resetAt = optionsJs.indexOf('resetHotkey").addEventListener');
const resetFn = optionsJs.slice(resetAt, resetAt + 500);
if (
  resetAt < 0 ||
  !resetFn.includes("chrome.storage.local.set") ||
  !resetFn.includes("DEFAULT_PARAGRAPH_HOTKEY")
) {
  fail("恢复默认必须写回该平台的段落快捷键");
}
if (bg.includes("chrome.action.onClicked") || bg.includes("action.onClicked")) {
  fail("整页命令不能改回 action.onClicked");
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
if (!optionsJs.includes("replaceEntry") || !optionsJs.includes("编辑") || !optionsJs.includes("完成")) {
  fail("设置页站点名单应能编辑已有条目");
}
if (!optionsJs.includes("persistLists")) fail("设置页编辑名单后应写入 storage");
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
const bothExact = siteApi.sitePolicy(["example.com"], ["example.com"], page);
if (!bothExact.denied || !bothExact.onAllow || bothExact.auto || !bothExact.blocked) {
  fail("同一来源两边都有时，永不翻译优先，且不自动翻译");
}
const bareDeny = siteApi.sitePolicy(["example.com"], ["https://example.com"], page);
if (!bareDeny.blocked || bareDeny.auto || !bareDeny.onAllow) {
  fail("裸域名永不翻译应盖过该 origin 的始终翻译");
}
const originDeny = siteApi.sitePolicy(
  ["https://example.com"],
  ["example.com"],
  page
);
if (!originDeny.blocked || originDeny.auto) {
  fail("指定 origin 的永不翻译应盖过裸域名始终翻译");
}
const allowOnly = siteApi.sitePolicy([], ["example.com"], page);
if (allowOnly.denied || !allowOnly.auto) fail("仅始终翻译时应自动翻译");
const neither = siteApi.sitePolicy([], [], page);
if (neither.denied || neither.auto || neither.blocked) fail("空名单不拦截也不自动翻译");
const removed = siteApi.pageListChange(
  ["example.com", "https://example.com", "other.test"],
  page,
  "https://example.com",
  "remove"
);
if (
  removed.list.includes("example.com") ||
  removed.list.includes("https://example.com") ||
  !removed.list.includes("other.test") ||
  !removed.changed ||
  removed.removed.length !== 2
) {
  fail(`移出本页应去掉所有命中该页的条目: ${JSON.stringify(removed)}`);
}
const added = siteApi.pageListChange(["other.test"], page, "https://example.com/path", "add");
if (!added.changed || !added.list.includes("https://example.com") || added.entry !== "https://example.com") {
  fail(`加入本页应写入 origin: ${JSON.stringify(added)}`);
}
const again = siteApi.pageListChange(added.list, page, "https://example.com", "add");
if (again.changed || again.list.length !== added.list.length) fail("已命中时不应再追加一条");
ok("站点名单按来源匹配，空名单不拦截，两边都有时永不翻译优先");

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
if (!placeSrc.includes("getAttribute(ATTR_DONE)") || !placeSrc.includes("CLASS_TRANS")) {
  fail("placeTranslation 必须拒绝已有译文节点");
}
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
if (!readme.includes("1.0.0") || !readme.includes("dev-1.0.0")) {
  fail("README 未记录 1.0.0 / dev-1.0.0");
}
if (readme.includes("当前开发版本为 **0.8.0**") || readme.includes("当前开发线是 `dev-0.8.0`")) {
  fail("README 仍把 0.8.0 写成当前版本");
}
if (readme.includes("当前开发版本为 **0.7.0**") || readme.includes("当前开发线是 `dev-0.7.0`")) {
  fail("README 仍把 0.7.0 写成当前版本");
}
if (readme.includes("当前开发版本为 **0.6.0**") || readme.includes("当前开发线是 `dev-0.6.0`")) {
  fail("README 仍把 0.6.0 写成当前版本");
}
if (readme.includes("当前开发版本为 **0.5.0**") || readme.includes("当前开发线是 `dev-0.5.0`")) {
  fail("README 仍把 0.5.0 写成当前版本");
}
if (readme.includes("当前开发版本为 **0.4.2**") || readme.includes("当前开发线是 `dev-0.4.2`")) {
  fail("README 仍把 0.4.2 写成当前版本");
}
if (readme.includes("当前开发版本为 **0.4.1**") || readme.includes("当前开发线是 `dev-0.4.1`")) {
  fail("README 仍把 0.4.1 写成当前版本");
}
if (readme.includes("当前开发版本为 **0.4.0**") || readme.includes("当前开发线是 `dev-0.4.0`")) {
  fail("README 仍把 0.4.0 写成当前版本");
}
if (!readme.includes("捕获")) fail("README 未说明整页快捷键在捕获阶段处理");
if (!readme.includes("denyOrigins")) fail("README 未记录 denyOrigins");
if (!readme.includes("⌥T") || !readme.includes("Alt+T")) {
  fail("README 应同时写明 macOS ⌥T 与 Windows/Linux 的 Alt+T");
}
if (!readme.includes("⌥A") || !readme.includes("Alt+A")) {
  fail("README 应同时写明 macOS ⌥A 与 Windows/Linux 的 Alt+A");
}
if (!readme.includes("翻译 (⌥A)") || !readme.includes("翻译 (Alt+A)")) {
  fail("README 应分别写明 macOS「翻译 (⌥A)」与 Windows/Linux「翻译 (Alt+A)」");
}
if (!readme.includes("本机验收清单")) fail("README 缺少本机验收清单");
if (!readme.includes("加载已解压的扩展程序") || !readme.includes("钉到工具栏")) {
  fail("README 未用中文写明加载已解压的扩展程序，以及把图标钉到工具栏");
}
const readmeEn = readFileSync(join(root, "README.en.md"), "utf8");
if (!readmeEn.includes("Load unpacked") || !readmeEn.toLowerCase().includes("pin")) {
  fail("README.en.md 未写明 Load unpacked 与 pin");
}
if (!readmeEn.includes("1.0.0") || !readmeEn.includes("dev-1.0.0")) {
  fail("README.en.md 未记录 1.0.0 / dev-1.0.0");
}
if (readmeEn.includes("The current dev version is **0.8.0**") || readmeEn.includes("currently `dev-0.8.0`")) {
  fail("README.en.md 仍把 0.8.0 写成当前版本");
}
if (readmeEn.includes("The current development line is `dev-0.8.0`")) {
  fail("README.en.md 仍把 dev-0.8.0 写成当前开发线");
}
if (readmeEn.includes("The current dev version is **0.7.0**") || readmeEn.includes("currently `dev-0.7.0`")) {
  fail("README.en.md 仍把 0.7.0 写成当前版本");
}
if (readmeEn.includes("The current development line is `dev-0.7.0`")) {
  fail("README.en.md 仍把 dev-0.7.0 写成当前开发线");
}
if (readmeEn.includes("The current dev version is **0.6.0**") || readmeEn.includes("currently `dev-0.6.0`")) {
  fail("README.en.md 仍把 0.6.0 写成当前版本");
}
if (readmeEn.includes("The current dev version is **0.5.0**") || readmeEn.includes("currently `dev-0.5.0`")) {
  fail("README.en.md 仍把 0.5.0 写成当前版本");
}
if (readmeEn.includes("The current dev version is **0.4.2**") || readmeEn.includes("currently `dev-0.4.2`")) {
  fail("README.en.md 仍把 0.4.2 写成当前版本");
}
if (readmeEn.includes("The current dev version is **0.4.1**") || readmeEn.includes("currently `dev-0.4.1`")) {
  fail("README.en.md 仍把 0.4.1 写成当前版本");
}
if (readmeEn.includes("The current dev version is **0.4.0**") || readmeEn.includes("currently `dev-0.4.0`")) {
  fail("README.en.md 仍把 0.4.0 写成当前版本");
}
if (!changelog.includes("## 1.0.0\n")) fail("CHANGELOG 缺少 1.0.0");
if (!changelog.includes("## 0.8.0")) fail("CHANGELOG 缺少 0.8.0");
if (!changelog.includes("## 0.7.0")) fail("CHANGELOG 缺少 0.7.0");
if (!changelog.includes("## 0.6.0")) fail("CHANGELOG 缺少 0.6.0");
if (!changelog.includes("## 0.5.0")) fail("CHANGELOG 缺少 0.5.0");
if (!changelog.includes("## 0.4.2")) fail("CHANGELOG 缺少 0.4.2");
if (!changelog.includes("## 0.4.1")) fail("CHANGELOG 缺少 0.4.1");
if (!changelog.includes("## 0.4.0")) fail("CHANGELOG 缺少 0.4.0");
if (!changelog.includes("## 0.3.0")) fail("CHANGELOG 缺少 0.3.0");
if (!changelog.includes("已撤回")) fail("CHANGELOG 未说明过早的 1.0.0 已撤回");
ok("黑名单默认放行，样式开关可在已打开页面生效");

// 5d) toolbar popup + draggable ball (0.4.0). Same on/off state, empty key stays mock.
const popupHtml = readFileSync(join(root, "extension/popup.html"), "utf8");
const popupJs = readFileSync(join(root, "extension/popup.js"), "utf8");
for (const id of ["status", "mock", "toggle", "options"]) {
  if (!new RegExp(`id="${id}"`).test(popupHtml)) fail(`弹窗缺少 ${id}`);
}
if (!popupHtml.includes(">翻译<")) fail("弹窗主按钮默认应为「翻译」");
if (!popupHtml.includes('src="hotkey.js"')) fail("弹窗未加载 hotkey.js");
if (!popupJs.includes("显示原文") || !popupJs.includes('"翻译"')) {
  fail("弹窗主按钮应在「翻译」和「显示原文」之间切换");
}
if (!popupJs.includes("formatActionLabel") || !popupJs.includes("DEFAULT_PAGE_HOTKEY")) {
  fail("弹窗主按钮未用与设置页相同的快捷键格式");
}
if (!optionsJs.includes("formatHotkeyDisplay")) {
  fail("设置页未使用共享的 formatHotkeyDisplay");
}
if (popupHtml.includes("翻译 (Alt+A)") || popupJs.includes("翻译 (Alt+A)") || optionsHtml.includes("翻译 (Alt+A)")) {
  fail("界面把「翻译 (Alt+A)」写死成所有平台的文案");
}
if (/默认 Alt\+|恢复默认 Alt\+|翻译 \(Alt\+/.test(optionsHtml + popupHtml)) {
  fail("界面文案把 Alt+ 写死成所有平台");
}
if (popupHtml.includes('id="restore"') || popupHtml.includes("翻译本页")) {
  fail("弹窗主操作应是一个双态按钮，而不是分开的翻译/还原");
}
if (!popupHtml.includes("打开设置")) fail("弹窗缺少打开设置");
if (!popupHtml.includes("本页加入永不翻译") || !popupHtml.includes("本页加入始终翻译")) {
  fail("弹窗应提供本页一键加入永不翻译和始终翻译");
}
if (!popupHtml.includes('id="addPageDeny"') || !popupHtml.includes('id="addPageAllow"')) {
  fail("弹窗缺少本页站点按钮");
}
if (!popupHtml.includes('src="sitelist.js"')) fail("弹窗未加载 sitelist.js");
if (popupHtml.includes('id="deny"') || popupHtml.includes('id="siteEntry"') || popupHtml.includes('id="denyList"')) {
  fail("弹窗只放本页一键按钮，不展开整份名单编辑");
}
if (!popupHtml.includes("Mock 模式") || !popupHtml.includes("⟦原文⟧")) {
  fail("弹窗未标明空 key 的 mock 模式");
}
for (const id of ["baseUrl", "model", "apiKey", "provider", "avatar"]) {
  if (new RegExp(`id="${id}"`).test(popupHtml)) fail(`弹窗不应包含完整设置字段 ${id}`);
}
for (const banned of ["登录", "升级", "会员", "Pro", "promo"]) {
  if (popupHtml.includes(banned)) fail(`弹窗出现不应展示的骨架: ${banned}`);
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
  "chrome.storage.local",
]) {
  if (!popupJs.includes(needle)) fail(`popup.js 缺少 ${needle}`);
}
if (!popupJs.includes("SET_PAGE_LIST") || !popupJs.includes("pageListChange")) {
  fail("弹窗应能把本页来源写入或移出名单");
}
if (!popupJs.includes("本页移出永不翻译") || !popupJs.includes("本页移出始终翻译")) {
  fail("本页已在名单中时，弹窗按钮应改为移出");
}
if (!popupJs.includes("以永不翻译为准")) fail("弹窗应说明两边都有时以永不翻译为准");
if (!popupJs.includes("已翻译") || !popupJs.includes("未翻译")) {
  fail("popup.js 未区分已翻译 / 未翻译");
}
const glassCss = readFileSync(join(root, "extension/glass.css"), "utf8");
const popupCss = readFileSync(join(root, "extension/popup.css"), "utf8");
const blurDecl = glassCss.match(/--immer-glass-blur:\s*(\d+)px/);
const radiusDecl = glassCss.match(/--immer-glass-radius:\s*(\d+)px/);
if (!blurDecl || Number(blurDecl[1]) < 16 || Number(blurDecl[1]) > 24) {
  fail("毛玻璃模糊应在 16–24px");
}
if (!radiusDecl || Number(radiusDecl[1]) < 12 || Number(radiusDecl[1]) > 16) {
  fail("毛玻璃圆角应在 12–16px");
}
for (const token of [
  "--immer-glass-fill",
  "--immer-glass-border",
  "--immer-glass-shadow",
  "--immer-glass-pad",
  "--immer-glass-gap",
  "--immer-cta-bg",
  "--immer-badge",
  "backdrop-filter:",
  "-webkit-backdrop-filter:",
]) {
  if (!glassCss.includes(token)) fail(`glass.css 缺少 ${token}`);
}
if (!popupHtml.includes('href="glass.css"') || !popupHtml.includes("immer-glass")) {
  fail("弹窗未使用共享毛玻璃样式");
}
if (!popupCss.includes("var(--immer-cta-bg)") || !popupCss.includes("var(--immer-glass-pad)")) {
  fail("弹窗主按钮或间距未走共享令牌");
}
if (/#(?:ff69b4|ec4899|ff5c8a|f43f7a|ff4d8d|ff6b9d)/i.test(glassCss + popupCss)) {
  fail("主按钮不应使用沉浸式翻译的粉色");
}
if (/navigator\.platform|MacIntel|Win32|@supports\s*\(\s*-moz/.test(glassCss + popupCss + contentJs)) {
  fail("毛玻璃样式不应按操作系统分叉");
}
if (!contentJs.includes("glass.css") || !contentJs.includes("immer-glass") || !contentJs.includes("badge")) {
  fail("悬浮球未使用共享毛玻璃样式或译文标记");
}
const glassResource = manifest.web_accessible_resources?.some((entry) =>
  (entry.resources || []).includes("glass.css")
);
if (!glassResource) fail("悬浮球阴影树需要把 glass.css 暴露给页面");
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
  "SET_PAGE_LIST",
  "pagePolicy",
  "immer-sites",
  "本页加入永不翻译",
  "显示原文",
  "ballTipSeen",
  "知道了",
  "dispatchPageCta",
  "formatBallHoverTitle",
  "PAGE_STATE",
  "打开弹层",
  "点击翻译为",
  "已翻译 · 点击显示原文",
]) {
  if (!contentJs.includes(needle)) fail(`content.js 缺少 ${needle}`);
}
if (!contentJs.includes('active ? "RESTORE_PAGE" : "TRANSLATE_PAGE"')) {
  fail("悬浮球主点击应与弹层一样在 TRANSLATE_PAGE 与 RESTORE_PAGE 之间切换");
}
const ballTagStart = contentJs.indexOf('id="immer-ball"');
const ballTagEnd = contentJs.indexOf('id="immer-sites"');
const ballTag = ballTagStart >= 0 && ballTagEnd > ballTagStart ? contentJs.slice(ballTagStart, ballTagEnd) : "";
if (!ballTag || ballTag.includes(">翻译<") || ballTag.includes(">显示原文<")) {
  fail("悬浮球本体不应放「翻译」或「显示原文」文字按钮");
}
if (!popupJs.includes("PAGE_STATE")) fail("弹层应订阅内容脚本的页面翻译状态");
if (!bg.includes("OPEN_SHELL_ENTRY") || !bg.includes("openOptionsPage")) {
  fail("打开弹层应走扩展已有的弹层或选项入口");
}
if (!contentJs.includes('display", denied ? "none"')) {
  fail("永不翻译的来源应隐藏悬浮球");
}
const bootSrc = contentJs.slice(contentJs.indexOf("const seenAtBoot"));
if (!bootSrc.includes("policy.blocked") || bootSrc.indexOf("policy.blocked") > bootSrc.indexOf("policy.auto")) {
  fail("打开页面时须先判断永不翻译，再决定是否自动翻译");
}
if (!contentJs.includes("applyListPolicy")) fail("名单变化后应立刻套用永不翻译优先");
if (!contentJs.includes("ballEnabled") || !contentJs.includes("pageHotkey")) {
  fail("content.js 未读取悬浮球开关或整页快捷键");
}
if (!readme.includes("基本") || !readme.includes("引擎与密钥") || !readme.includes("ballEnabled")) {
  fail("README 未记录选项页五个分区或悬浮球开关");
}
if (/登录|升级|会员|Subscribe|Upgrade to Pro/i.test(contentJs)) {
  fail("悬浮球提示不应引导登录或付费");
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
const rightEdge = 1200 - ballApi.BALL_SIZE - ballApi.EDGE_MARGIN;
if (ballDefault.side !== "right" || ballDefault.left !== rightEdge) {
  fail(`悬浮球默认应贴右缘: ${JSON.stringify(ballDefault)}`);
}
if (ballDefault.top !== 800 - ballApi.BALL_SIZE - ballApi.EDGE_MARGIN) {
  fail(`悬浮球默认竖直位置应靠下: ${JSON.stringify(ballDefault)}`);
}
const snapLeft = ballApi.snapBallPosition({ left: 200, top: 400 }, ballVp);
if (snapLeft.side !== "left" || snapLeft.left !== ballApi.EDGE_MARGIN || snapLeft.top !== 400) {
  fail(`松手应贴左缘并保留竖直位置: ${JSON.stringify(snapLeft)}`);
}
const snapRight = ballApi.snapBallPosition({ left: 700, top: 220 }, ballVp);
if (snapRight.side !== "right" || snapRight.left !== rightEdge || snapRight.top !== 220) {
  fail(`松手应贴右缘并保留竖直位置: ${JSON.stringify(snapRight)}`);
}
const keepVertical = ballApi.snapBallPosition({ left: 900, top: 20 }, ballVp);
if (keepVertical.side !== "right" || keepVertical.top !== 20) {
  fail(`贴边时不应改掉竖直位置: ${JSON.stringify(keepVertical)}`);
}
const clamped = ballApi.clampBallPosition({ left: -100, top: 99999 }, ballVp);
if (clamped.left !== ballApi.EDGE_MARGIN || clamped.top !== ballDefault.top) {
  fail(`拖动中的位置应夹在视口内: ${JSON.stringify(clamped)}`);
}
if (ballApi.normalizeStoredBallPosition(null, ballVp) !== null) fail("空的 ballPosition 应忽略");
if (ballApi.normalizeStoredBallPosition({ side: "right", top: "nope" }, ballVp) !== null) {
  fail("非法 ballPosition 应忽略");
}
const stored = ballApi.normalizeStoredBallPosition({ side: "left", top: 400 }, ballVp);
if (!stored || stored.side !== "left" || stored.left !== ballApi.EDGE_MARGIN || stored.top !== 400) {
  fail(`应记住左右边和竖直位置: ${JSON.stringify(stored)}`);
}
const storedOff = ballApi.normalizeStoredBallPosition({ side: "right", top: -20 }, ballVp);
if (!storedOff || storedOff.side !== "right" || storedOff.left !== rightEdge || storedOff.top !== ballApi.EDGE_MARGIN) {
  fail(`越界竖直位置应夹回视口: ${JSON.stringify(storedOff)}`);
}
const legacy = ballApi.normalizeStoredBallPosition({ left: 5000, top: 180 }, ballVp);
if (!legacy || legacy.side !== "right" || legacy.top !== 180) {
  fail(`旧的 left/top 应折成贴边位置: ${JSON.stringify(legacy)}`);
}
if (!readme.includes("悬浮球") || !readme.includes("弹窗") || !readme.includes("显示原文")) {
  fail("README 未记录弹窗、双态按钮或悬浮球");
}
ok("悬浮球默认在右侧，松手贴左右边缘，并记住竖直位置");

// 5e) first-run guide (0.6.0): three skippable steps, no chain with the ball tip.
const onboardingJs = readFileSync(join(root, "extension/onboarding.js"), "utf8");
const onboardIdx = contentScripts.indexOf("onboarding.js");
if (onboardIdx < 0 || onboardIdx > contentIdx) {
  fail(`content_scripts 须在 content.js 之前加载 onboarding.js: ${contentScripts.join(",")}`);
}
const obSandbox = {};
createContext(obSandbox);
runInContext(onboardingJs, obSandbox);
const ob = obSandbox.ImmerOnboarding;
if (!ob) fail("onboarding.js 未挂上 ImmerOnboarding");
if (ob.STORAGE_KEY !== "onboardingDone") fail("引导永久标记应为 onboardingDone");
if (!Array.isArray(ob.STEPS) || ob.STEPS.length !== 3) {
  fail(`首次引导必须正好三步，实际 ${ob.STEPS?.length}`);
}
const stepIds = ob.STEPS.map((step) => step.id).join(",");
const stepTitles = ob.STEPS.map((step) => step.title).join(",");
if (stepIds !== "pin,popup,ball") fail(`步骤顺序应为 pin,popup,ball，实际 ${stepIds}`);
if (stepTitles !== "钉到工具栏,点弹层译一页,认识悬浮球") {
  fail(`步骤标题顺序不对: ${stepTitles}`);
}
for (const step of ob.STEPS) {
  if (!step.body || step.body.length < 12) fail(`步骤 ${step.id} 缺少说明`);
}
const guideCopy = ob.STEPS.map((step) => `${step.title}\n${step.body}`).join("\n");
for (const banned of ["登录", "升级", "会员", "Pro", "Token", "条款", "隐私", "促销", "订阅"]) {
  if (guideCopy.includes(banned) || onboardingJs.includes(banned)) {
    fail(`首次引导出现不应展示的文案: ${banned}`);
  }
}
if (ob.primaryLabel(0) !== "下一步" || ob.primaryLabel(1) !== "下一步" || ob.primaryLabel(2) !== "完成") {
  fail("前两步主按钮应为「下一步」，最后一步应为「完成」");
}
if (!ob.showSkipAll(0) || !ob.showSkipAll(1) || ob.showSkipAll(2)) {
  fail("「全部跳过」只应出现在最后一步之前");
}
if (!ob.guidePending(undefined) || !ob.guidePending(false) || ob.guidePending(true)) {
  fail("只有 onboardingDone === true 才算引导已结束");
}
let guide = ob.initialState();
if (guide.index !== 0 || guide.done || guide.ballIntroduced) fail("引导应从第一步开始");
guide = ob.reduce(guide, "next");
guide = ob.reduce(guide, "skip");
if (guide.index !== 2 || guide.done || !guide.ballIntroduced) {
  fail(`走到第三步应已认识悬浮球且尚未结束: ${JSON.stringify(guide)}`);
}
const finished = ob.reduce(guide, "next");
if (!finished.done || !finished.ballIntroduced) fail("最后一步「完成」应永久结束并记下悬浮球");
const finishedPatch = ob.storagePatch(finished);
if (!finishedPatch || finishedPatch.onboardingDone !== true || finishedPatch.ballTipSeen !== true) {
  fail(`走完第三步应同时写下 onboardingDone 与 ballTipSeen: ${JSON.stringify(finishedPatch)}`);
}
const skippedLast = ob.reduce(guide, "skip");
if (!skippedLast.done || ob.storagePatch(skippedLast)?.ballTipSeen !== true) {
  fail("最后一步「跳过」也应结束，且不再紧接着弹球旁提示");
}
const skipAllEarly = ob.reduce(ob.initialState(), "skip-all");
const skipAllPatch = ob.storagePatch(skipAllEarly);
if (!skipAllEarly.done || skipAllEarly.ballIntroduced || !skipAllPatch || skipAllPatch.onboardingDone !== true) {
  fail("第一步「全部跳过」应永久结束引导");
}
if (Object.prototype.hasOwnProperty.call(skipAllPatch, "ballTipSeen")) {
  fail("未走到悬浮球那一步时，不应提前消耗 ballTipSeen");
}
if (ob.storagePatch(ob.initialState()) !== null) fail("未结束的引导不应写存储");
const tipCtx = {
  ballTipSeen: false,
  guideVisible: false,
  dismissedOnThisDocument: false,
  guidePending: false,
};
if (!ob.allowBallTip(tipCtx)) fail("引导已结束且本页未刚关掉时，球旁提示仍可出现一次");
if (ob.allowBallTip({ ...tipCtx, guidePending: true })) fail("引导未结束时不应弹出球旁提示");
if (ob.allowBallTip({ ...tipCtx, guideVisible: true })) fail("引导卡片可见时不应弹出球旁提示");
if (ob.allowBallTip({ ...tipCtx, dismissedOnThisDocument: true })) {
  fail("刚关掉引导的这一页不应马上连弹球旁提示");
}
if (ob.allowBallTip({ ...tipCtx, ballTipSeen: true })) fail("ballTipSeen 之后不应再弹球旁提示");
const onboardSrc = contentJs.slice(
  contentJs.indexOf("function unmountOnboarding"),
  contentJs.indexOf("function mountBall")
);
for (const needle of [
  "immer-onboarding-host",
  'setProperty("pointer-events", "none"',
  "pointer-events: auto",
  "immer-glass",
  "--immer-cta-bg",
  'data-action="next"',
  'data-action="skip"',
  'data-action="skip-all"',
  "全部跳过",
  "allowBallTip",
  "bootOnboarding",
]) {
  if (!onboardSrc.includes(needle) && !contentJs.includes(needle)) {
    fail(`content.js 引导缺少 ${needle}`);
  }
}
if (
  !onboardSrc.includes('setProperty("pointer-events", "none"') ||
  !onboardSrc.includes("pointer-events: auto")
) {
  fail("引导卡片宿主应不接收页面点击，卡片本身仍可点");
}
if (onboardSrc.includes("aria-modal") || onboardSrc.includes('type="checkbox"')) {
  fail("引导不应是模态框，也不应有条款勾选");
}
if (/#(?:ff69b4|ec4899|ff5c8a|f43f7a|ff4d8d|ff6b9d)/i.test(onboardingJs + onboardSrc)) {
  fail("首次引导不应使用沉浸式翻译的粉色");
}
if (!contentJs.includes("ballTipAllowed") || !contentJs.includes("onboardingDismissedHere")) {
  fail("悬浮球提示必须先经过引导互斥判断");
}
if (!contentCss.includes("#immer-onboarding-host") || !contentCss.includes("pointer-events: none")) {
  fail("content.css 缺少不挡页面的引导宿主");
}
if (!readme.includes("onboardingDone") || !readme.includes("钉到工具栏") || !readme.includes("点弹层译一页") || !readme.includes("认识悬浮球")) {
  fail("README 未记录三步引导与 onboardingDone");
}
if (!readme.includes('chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])')) {
  fail("README 未写明清除 onboardingDone 与 ballTipSeen 后可再次看到引导");
}
if (!readmeEn.includes("onboardingDone") || !readmeEn.includes("认识悬浮球")) {
  fail("README.en.md 未记录首次引导");
}
ok("首次引导三步可跳过，结束前不与悬浮球提示连弹");

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

const failIdx = contentScripts.indexOf("failtip.js");
if (failIdx < 0 || failIdx > contentIdx) {
  fail(`content_scripts 须在 content.js 之前加载 failtip.js: ${contentScripts.join(",")}`);
}
if (!popupHtml.includes('src="failtip.js"')) fail("弹窗未加载 failtip.js");
if (!contentJs.includes("immer-fail-host") || !contentJs.includes("showTranslateFailure")) {
  fail("content.js 未展示页面失败提示");
}
if (!contentJs.includes("kind: err?.kind") || !contentJs.includes("code: err?.code") || !contentJs.includes("status: err?.status")) {
  fail("content.js 未把 kind/code/status 交回弹窗");
}
if (!contentJs.includes("pointer-events: none")) fail("页面失败提示必须不挡住点击");
if (!contentCss.includes("#immer-fail-host")) fail("content.css 缺少失败提示宿主");
if (!popupJs.includes("ImmerFail") || !popupJs.includes("formatFailureTip")) {
  fail("弹窗未使用失败提示");
}
if (!popupCss.includes(".hint.is-fail")) fail("弹窗失败提示未标出");
const failSandbox = {};
createContext(failSandbox);
runInContext(readFileSync(join(root, "extension/failtip.js"), "utf8"), failSandbox);
const failApi = failSandbox.ImmerFail;
if (!failApi?.formatFailureTip || !failApi?.failureError) fail("failtip.js 未挂上 ImmerFail");
const netTip = failApi.formatFailureTip({
  message: "translate network: connect ECONNREFUSED",
  kind: "network",
  code: "network",
});
if (!netTip.kicker.includes("network") || !netTip.text.includes("translate network: connect ECONNREFUSED")) {
  fail(`失败提示应同时有 kind 和说明: ${JSON.stringify(netTip)}`);
}
const providerTip = failApi.formatFailureTip({
  error: "translate HTTP 401: invalid",
  kind: "provider",
  code: "invalid_api_key",
  status: 401,
});
if (
  !providerTip.text.includes("provider") ||
  !providerTip.text.includes("invalid_api_key") ||
  !providerTip.text.includes("401") ||
  !providerTip.text.includes("translate HTTP 401: invalid")
) {
  fail(`失败提示应带上 kind/code/status 和说明: ${providerTip.text}`);
}
const carried = failApi.failureError(
  { error: "translate HTTP 502: bad gateway", kind: "http", code: "http_502", status: 502 },
  "translate failed"
);
if (carried.message !== "translate HTTP 502: bad gateway" || carried.kind !== "http" || carried.code !== "http_502" || carried.status !== 502) {
  fail("failureError 应保留 message/kind/code/status");
}
if (!readme.includes("127.0.0.1:9") || !readme.includes("kind") || !readme.includes("not-a-real-key")) {
  fail("README 未写明失败提示的本机验收（假密钥、不可达地址、kind）");
}
if (!readmeEn.includes("127.0.0.1:9") || !readmeEn.includes("not-a-real-key")) {
  fail("README.en.md 未写明失败提示的本机验收");
}
ok("翻译失败把 kind/code/status 和说明显示到页面、悬浮球和弹窗");

console.log(
  "\naccept-mvp ok — 浏览器手测: 加载 extension/ → 未翻译时主按钮为「翻译 (⌥A)」或「翻译 (Alt+A)」，已翻译为「显示原文」；空 key 标明 Mock；文章页焦点不在输入框时 Alt+A（Windows/Linux）或 ⌥A（macOS）切换整页，Alt+T / ⌥T 仍只译悬停段；热键被系统抢走时弹窗和悬浮球仍能切换；右侧悬浮球拖完贴边，刷新后竖直位置还在；首次出现一次提示；永不翻译的来源不显示球"
);

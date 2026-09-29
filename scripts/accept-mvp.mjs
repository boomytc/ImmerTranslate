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
if (!/id="apiKey"/.test(optionsHtml)) fail("设置页缺少 apiKey 字段");
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
  if (text.includes("/Users/") || text.includes("/home/boom/")) {
    fail(`${file} 含本机绝对路径`);
  }
  if (/sk-[a-zA-Z0-9]{20,}/.test(text)) {
    fail(`${file} 疑似含 API key`);
  }
}
ok("仓内无本机路径 / 疑似密钥");

console.log("\naccept-mvp ok — 浏览器手测: 加载 extension/ → 文章页点图标应出现 ⟦原文⟧");

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mockTranslate,
  translate,
  createOpenAICompatibleEngine,
  createAnthropicCompatibleEngine,
  deepSeekOptionsFromEnv,
} from "../src/index.js";
import { createEngineFromMergedConfig, loadMergedEngineConfig } from "../config/load.js";

function assert(cond, msg) {
  if (!cond) {
    console.error(`smoke failed: ${msg}`);
    process.exit(1);
  }
}

const req = {
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [
    { id: "p1", text: "Hello world" },
    { id: "p2", text: "Immersive translate" },
  ],
};

const viaMock = await mockTranslate(req);
const viaDefault = await translate(req);

assert(translate === mockTranslate, "translate 应是 mockTranslate");
assert(viaMock.segments[0].text === "⟦Hello world⟧", "mock 第 1 段");
assert(viaMock.segments[1].id === "p2", "mock 第 2 段 id");
assert(viaDefault.segments[0].text === viaMock.segments[0].text, "默认引擎与 mock 不一致");
console.log(JSON.stringify(viaMock, null, 2));

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

for (const factory of [createOpenAICompatibleEngine, createAnthropicCompatibleEngine]) {
  for (const apiKey of ["", "   ", undefined, null]) {
    let threw = false;
    try {
      factory({
        apiKey,
        fetchImpl: async () => {
          throw new Error("empty apiKey must throw before fetch");
        },
      });
    } catch (err) {
      threw = err instanceof Error && /apiKey is required/.test(err.message);
    }
    assert(threw, `${factory.name} 空 apiKey 应在工厂抛错`);
  }
}

/** @type {{ url: string, init: RequestInit } | null} */
let openaiHit = null;
const openaiEngine = createOpenAICompatibleEngine({
  apiKey: "  test-key  ",
  baseUrl: "https://api.deepseek.com/v1/",
  model: " deepseek-flash ",
  fetchImpl: async (url, init) => {
    openaiHit = { url: String(url), init };
    return jsonResponse({
      choices: [
        {
          message: {
            content:
              "```json\n" +
              JSON.stringify([
                { id: "p2", text: "沉浸式翻译" },
                { id: "p1", text: "你好世界" },
              ]) +
              "\n```",
          },
        },
      ],
    });
  },
});

const openaiRes = await openaiEngine(req);
assert(openaiHit, "OpenAI fetch 未被调用");
assert(
  openaiHit.url === "https://api.deepseek.com/v1/chat/completions",
  `OpenAI URL 异常: ${openaiHit.url}`
);
assert(openaiHit.init?.method === "POST", "OpenAI method");
const openaiHeaders = /** @type {Record<string, string>} */ (openaiHit.init.headers);
assert(openaiHeaders.Authorization === "Bearer test-key", "OpenAI Authorization");
assert(openaiHeaders["Content-Type"] === "application/json", "OpenAI Content-Type");
const openaiBody = JSON.parse(String(openaiHit.init.body));
assert(openaiBody.model === "deepseek-flash", "OpenAI model");
assert(openaiBody.messages?.[1]?.content?.includes("Hello world"), "OpenAI 未携带原文");
assert(openaiRes.segments[0].id === "p1" && openaiRes.segments[0].text === "你好世界", "OpenAI 映射 p1");
assert(openaiRes.segments[1].text === "沉浸式翻译", "OpenAI 映射 p2");

const openaiMissing = await createOpenAICompatibleEngine({
  apiKey: "test-key",
  baseUrl: "https://example.test/v1",
  model: "m",
  fetchImpl: async () =>
    jsonResponse({
      choices: [{ message: { content: JSON.stringify([{ id: "p1", text: "仅一段" }]) } }],
    }),
})(req);
assert(openaiMissing.segments[1].error === "missing translation", "缺段应带 error");

let openaiHttpThrew = false;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    fetchImpl: async () => jsonResponse({ error: { message: "unauthorized" } }, 401),
  })(req);
} catch (err) {
  openaiHttpThrew = err instanceof Error && /translate HTTP 401/.test(err.message);
}
assert(openaiHttpThrew, "OpenAI 非 2xx 应抛错");

const emptyOpenAI = await createOpenAICompatibleEngine({
  apiKey: "test-key",
  fetchImpl: async () => {
    throw new Error("empty segments must not fetch");
  },
})({ sourceLang: "auto", targetLang: "zh-CN", segments: [] });
assert(emptyOpenAI.segments.length === 0, "空批次");

/**
 * @param {string} baseUrl
 * @param {string} expectedUrl
 */
async function checkAnthropic(baseUrl, expectedUrl) {
  /** @type {{ url: string, init: RequestInit } | null} */
  let hit = null;
  const engine = createAnthropicCompatibleEngine({
    apiKey: "test-key",
    baseUrl,
    model: "claude-test",
    fetchImpl: async (url, init) => {
      hit = { url: String(url), init };
      return jsonResponse({
        content: [
          { type: "text", text: '[{"id":"p1","text":"你好世界"},' },
          { type: "thinking", thinking: "ignore" },
          { type: "text", text: '{"id":"p2","text":"沉浸式翻译"}]' },
        ],
      });
    },
  });
  const res = await engine(req);
  assert(hit, "Anthropic fetch 未被调用");
  assert(hit.url === expectedUrl, `Anthropic URL 异常: ${hit.url} (base ${baseUrl})`);
  assert(hit.init?.method === "POST", "Anthropic method");
  const headers = /** @type {Record<string, string>} */ (hit.init.headers);
  assert(headers["x-api-key"] === "test-key", "Anthropic x-api-key");
  assert(headers["anthropic-version"] === "2023-06-01", "Anthropic version");
  const body = JSON.parse(String(hit.init.body));
  assert(body.model === "claude-test", "Anthropic model");
  assert(body.max_tokens > 0, "Anthropic max_tokens");
  assert(res.segments[0].text === "你好世界" && res.segments[1].text === "沉浸式翻译", "Anthropic 映射");
}

await checkAnthropic("https://api.anthropic.com", "https://api.anthropic.com/v1/messages");
await checkAnthropic("https://api.anthropic.com/v1/", "https://api.anthropic.com/v1/messages");
await checkAnthropic("https://proxy.example/anthropic/v1", "https://proxy.example/anthropic/v1/messages");

assert(deepSeekOptionsFromEnv({}) === null, "无 DEEPSEEK_API_KEY 应返回 null");
assert(deepSeekOptionsFromEnv({ DEEPSEEK_API_KEY: "   " }) === null, "空白 key 应返回 null");
const fromEnv = deepSeekOptionsFromEnv({ DEEPSEEK_API_KEY: " test-key " });
assert(fromEnv?.apiKey === "test-key", "deepSeek apiKey");
assert(fromEnv?.baseUrl === "https://api.deepseek.com/v1", "deepSeek 默认 baseUrl");
assert(fromEnv?.model === "deepseek-flash", "deepSeek model");
const customEnv = deepSeekOptionsFromEnv({
  DEEPSEEK_API_KEY: "test-key",
  DEEPSEEK_BASE_URL: "  https://example.test/v1  ",
});
assert(customEnv?.baseUrl === "https://example.test/v1", "DEEPSEEK_BASE_URL");

const live = deepSeekOptionsFromEnv();
if (typeof process.env.DEEPSEEK_API_KEY === "string" && process.env.DEEPSEEK_API_KEY.trim()) {
  assert(live?.apiKey === process.env.DEEPSEEK_API_KEY.trim(), "默认 env 应读到 DEEPSEEK_API_KEY");
  assert(live?.model === "deepseek-flash", "默认 env model");
} else {
  assert(live === null, "未设置 DEEPSEEK_API_KEY 时默认 env 应为 null");
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const template = loadMergedEngineConfig({
  cwd: repoRoot,
  env: {},
  readFile(filePath) {
    if (filePath.endsWith("config.local.yaml")) return null;
    return readFileSync(filePath, "utf8");
  },
});
assert(template.apiKey === "", "仓库 config.yaml apiKey 应为空");
assert(template.provider === "openai", "模板 provider");
assert(template.baseUrl === "https://api.deepseek.com/v1", "模板 baseUrl");
assert(template.model === "deepseek-flash", "模板 model");
assert(template.sourceLang === "auto" && template.targetLang === "zh-CN", "模板语言");

const configDir = mkdtempSync(join(tmpdir(), "immer-config-"));
try {
  writeFileSync(
    join(configDir, "config.yaml"),
    [
      "provider: openai",
      "baseUrl: https://api.deepseek.com/v1",
      "model: deepseek-flash",
      'apiKey: ""',
      "sourceLang: auto",
      "targetLang: zh-CN",
      "",
    ].join("\n")
  );
  writeFileSync(
    join(configDir, "config.local.yaml"),
    [
      "provider: anthropic",
      "baseUrl: https://local.example/v1",
      "model: local-model",
      'apiKey: "local-test-key"',
      "sourceLang: en",
      "targetLang: ja",
      "",
    ].join("\n")
  );

  const fromFiles = loadMergedEngineConfig({ cwd: configDir, env: {} });
  assert(fromFiles.provider === "anthropic", "local yaml 应覆盖 provider");
  assert(fromFiles.baseUrl === "https://local.example/v1", "local yaml 应覆盖 baseUrl");
  assert(fromFiles.model === "local-model", "local yaml 应覆盖 model");
  assert(fromFiles.apiKey === "local-test-key", "local yaml 应覆盖 apiKey");
  assert(fromFiles.sourceLang === "en" && fromFiles.targetLang === "ja", "local yaml 应覆盖语言");

  const envWins = loadMergedEngineConfig({
    cwd: configDir,
    env: {
      IMMER_TRANSLATE_PROVIDER: "openai",
      IMMER_TRANSLATE_MODEL: "generic-model",
      IMMER_TRANSLATE_API_KEY: "generic-test-key",
      IMMER_TRANSLATE_TARGET_LANG: "zh-CN",
      DEEPSEEK_API_KEY: " env-test-key ",
      DEEPSEEK_BASE_URL: " https://env.example/v1/ ",
    },
  });
  assert(envWins.provider === "openai", "IMMER_TRANSLATE_PROVIDER 应覆盖 local yaml");
  assert(envWins.model === "generic-model", "IMMER_TRANSLATE_MODEL 应覆盖 local yaml");
  assert(envWins.targetLang === "zh-CN", "IMMER_TRANSLATE_TARGET_LANG 应覆盖 local yaml");
  assert(envWins.sourceLang === "en", "未设置的 env 不应清掉 local sourceLang");
  assert(envWins.baseUrl === "https://env.example/v1/", "DEEPSEEK_BASE_URL 应覆盖 yaml（只 trim，不去掉末尾 /）");
  assert(envWins.apiKey === "env-test-key", "DEEPSEEK_API_KEY 应压过 IMMER_TRANSLATE_API_KEY");

  const blankEnv = loadMergedEngineConfig({
    cwd: configDir,
    env: { DEEPSEEK_API_KEY: "   ", DEEPSEEK_BASE_URL: "" },
  });
  assert(blankEnv.apiKey === "local-test-key", "空白 DEEPSEEK_API_KEY 不应覆盖 yaml");
  assert(blankEnv.baseUrl === "https://local.example/v1", "空白 DEEPSEEK_BASE_URL 不应覆盖 yaml");

  const baseOnlyDir = mkdtempSync(join(tmpdir(), "immer-config-base-"));
  try {
    writeFileSync(join(baseOnlyDir, "config.yaml"), 'provider: openai\nmodel: base-model\napiKey: ""\n');
    const baseOnly = loadMergedEngineConfig({ cwd: baseOnlyDir, env: {} });
    assert(baseOnly.model === "base-model", "仅 base yaml 时 model");
    assert(baseOnly.apiKey === "", "仅 base yaml 时 apiKey 为空");
    assert(baseOnly.baseUrl === "https://api.deepseek.com/v1", "缺省 baseUrl 来自默认值");
  } finally {
    rmSync(baseOnlyDir, { recursive: true, force: true });
  }
} finally {
  rmSync(configDir, { recursive: true, force: true });
}

const injected = loadMergedEngineConfig({
  cwd: "/cfg",
  env: { DEEPSEEK_API_KEY: "injected-test-key" },
  readFile(filePath) {
    if (filePath.endsWith("config.local.yaml")) return null;
    if (filePath.endsWith("config.yaml")) return "model: from-readFile\napiKey: \"\"\nbaseUrl: https://yaml.example/v1\n";
    throw new Error(`unexpected path ${filePath}`);
  },
});
assert(injected.model === "from-readFile", "readFile 应提供 base yaml");
assert(injected.apiKey === "injected-test-key", "env 应覆盖 readFile yaml");
assert(injected.baseUrl === "https://yaml.example/v1", "未设置的 DEEPSEEK_BASE_URL 应保留 yaml");

let badYaml = false;
try {
  loadMergedEngineConfig({
    cwd: "/cfg",
    env: {},
    readFile: () => "not-yaml\n",
  });
} catch (err) {
  badYaml = err instanceof Error && /unsupported YAML/.test(err.message);
}
assert(badYaml, "非法 YAML 行应抛错");

const emptyCfg = loadMergedEngineConfig({
  cwd: "/missing",
  env: {},
  readFile() {
    const err = new Error("missing");
    /** @type {NodeJS.ErrnoException} */ (err).code = "ENOENT";
    throw err;
  },
});
assert(emptyCfg.apiKey === "" && emptyCfg.provider === "openai", "缺文件时用默认值");
assert(createEngineFromMergedConfig(emptyCfg) === mockTranslate, "空 apiKey 应返回 mockTranslate");
const mocked = await createEngineFromMergedConfig(template)({
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [{ id: "a", text: "Hi" }],
});
assert(mocked.segments[0].text === "⟦Hi⟧", "空 key 引擎应走 mock 包装");

/** @type {string} */
let pickedUrl = "";
const openaiFromCfg = createEngineFromMergedConfig(
  { provider: "openai", apiKey: "cfg-test-key", baseUrl: "https://api.deepseek.com/v1/", model: "deepseek-flash" },
  {
    fetchImpl: async (url) => {
      pickedUrl = String(url);
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify([{ id: "a", text: "你好" }]) } }],
      });
    },
  }
);
const openaiFromCfgRes = await openaiFromCfg({
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [{ id: "a", text: "Hi" }],
});
assert(pickedUrl === "https://api.deepseek.com/v1/chat/completions", `openai 配置 URL: ${pickedUrl}`);
assert(openaiFromCfgRes.segments[0].text === "你好", "openai 配置映射");

pickedUrl = "";
const anthropicFromCfg = createEngineFromMergedConfig(
  { provider: "Anthropic", apiKey: "cfg-test-key", baseUrl: "https://api.anthropic.com", model: "claude-test" },
  {
    fetchImpl: async (url) => {
      pickedUrl = String(url);
      return jsonResponse({
        content: [{ type: "text", text: JSON.stringify([{ id: "a", text: "你好" }]) }],
      });
    },
  }
);
const anthropicFromCfgRes = await anthropicFromCfg({
  sourceLang: "en",
  targetLang: "zh-CN",
  segments: [{ id: "a", text: "Hi" }],
});
assert(pickedUrl === "https://api.anthropic.com/v1/messages", `anthropic 配置 URL: ${pickedUrl}`);
assert(anthropicFromCfgRes.segments[0].text === "你好", "anthropic 配置映射");

console.log("smoke ok: batch mockTranslate / translate + openai/anthropic/deepseek env + yaml merge");

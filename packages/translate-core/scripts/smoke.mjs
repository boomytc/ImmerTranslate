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
  createPipelineEngine,
  pipelineDefaults,
  withCache,
  withRetry,
  withRateLimit,
  TranslateFailure,
  isTranslateFailure,
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

/** @type {unknown} */
let openaiHttpErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    fetchImpl: async () => jsonResponse({ error: { message: "unauthorized" } }, 401),
  })(req);
} catch (err) {
  openaiHttpErr = err;
}
assert(openaiHttpErr instanceof TranslateFailure, "OpenAI 非 2xx 应为 TranslateFailure");
assert(isTranslateFailure(openaiHttpErr), "isTranslateFailure 应认出上游失败");
const openaiHttpFailure = /** @type {TranslateFailure} */ (openaiHttpErr);
assert(openaiHttpFailure.kind === "provider", "有 error 正文时 kind 为 provider");
assert(openaiHttpFailure.code === "http_401", "无供应商短码时 code 为 http_<status>");
assert(openaiHttpFailure.status === 401, "HTTP status 应可读");
assert(/translate HTTP 401: unauthorized/.test(openaiHttpFailure.message), "HTTP 失败 message 应可读");

/** @type {unknown} */
let openaiProviderErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    fetchImpl: async () =>
      jsonResponse(
        {
          error: {
            message: "Incorrect API key",
            type: "invalid_request_error",
            code: "invalid_api_key",
          },
        },
        401
      ),
  })(req);
} catch (err) {
  openaiProviderErr = err;
}
const openaiProvider = /** @type {TranslateFailure} */ (openaiProviderErr);
assert(openaiProvider.kind === "provider" && openaiProvider.code === "invalid_api_key", "供应商 error.code 应成为 code");
assert(openaiProvider.status === 401, "供应商失败应带 status");
assert(/translate HTTP 401: Incorrect API key/.test(openaiProvider.message), "供应商 message 应来自 error.message");

/** @type {unknown} */
let anthropicProviderErr = null;
try {
  await createAnthropicCompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://api.anthropic.com",
    fetchImpl: async () =>
      jsonResponse(
        { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
        401
      ),
  })(req);
} catch (err) {
  anthropicProviderErr = err;
}
const anthropicProvider = /** @type {TranslateFailure} */ (anthropicProviderErr);
assert(
  anthropicProvider.kind === "provider" && anthropicProvider.code === "authentication_error",
  "Anthropic 无 error.code 时应使用 error.type"
);
assert(/translate HTTP 401: invalid x-api-key/.test(anthropicProvider.message), "Anthropic 失败 message");

/** @type {unknown} */
let httpOnlyErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    fetchImpl: async () => new Response("bad gateway", { status: 502 }),
  })(req);
} catch (err) {
  httpOnlyErr = err;
}
const httpOnly = /** @type {TranslateFailure} */ (httpOnlyErr);
assert(httpOnly.kind === "http" && httpOnly.code === "http_502" && httpOnly.status === 502, "无 error 正文时 kind 为 http");
assert(/translate HTTP 502: bad gateway/.test(httpOnly.message), "纯文本 HTTP 失败应带上正文");

/** @type {unknown} */
let networkErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  })(req);
} catch (err) {
  networkErr = err;
}
const networkFailure = /** @type {TranslateFailure} */ (networkErr);
assert(networkFailure.kind === "network" && networkFailure.code === "network", "fetch 抛错应为 network");
assert(/translate network: fetch failed/.test(networkFailure.message), "网络失败 message");
assert(networkFailure.status == null, "网络失败不应编造 status");

/** @type {unknown} */
let abortErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    fetchImpl: async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    },
  })(req);
} catch (err) {
  abortErr = err;
}
assert(
  /** @type {TranslateFailure} */ (abortErr).kind === "network" &&
    /** @type {TranslateFailure} */ (abortErr).code === "abort",
  "AbortError 的 code 应为 abort"
);

/** @type {unknown} */
let emptyOutputErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    fetchImpl: async () => jsonResponse({ choices: [{ message: { content: "  " } }] }),
  })(req);
} catch (err) {
  emptyOutputErr = err;
}
assert(
  /** @type {TranslateFailure} */ (emptyOutputErr).kind === "output" &&
    /** @type {TranslateFailure} */ (emptyOutputErr).code === "empty_output",
  "空模型正文应为 output/empty_output"
);

/** @type {unknown} */
let invalidOutputErr = null;
try {
  await createOpenAICompatibleEngine({
    apiKey: "test-key",
    fetchImpl: async () => jsonResponse({ choices: [{ message: { content: "not json" } }] }),
  })(req);
} catch (err) {
  invalidOutputErr = err;
}
assert(
  /** @type {TranslateFailure} */ (invalidOutputErr).kind === "output" &&
    /** @type {TranslateFailure} */ (invalidOutputErr).code === "invalid_output" &&
    /** @type {TranslateFailure} */ (invalidOutputErr).message === "model output is not a JSON array",
  "非 JSON 数组应为 output/invalid_output"
);

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

assert(pipelineDefaults.cache.maxEntries === 500, "默认缓存条数");
assert(pipelineDefaults.retry.retries === 2, "默认重试次数");
assert(pipelineDefaults.retry.baseDelayMs === 50, "默认退避基数");
assert(pipelineDefaults.retry.factor === 2, "默认退避倍数");
assert(pipelineDefaults.retry.maxDelayMs === 400, "默认退避上限");
assert(pipelineDefaults.rateLimit.minIntervalMs === 100, "默认最小间隔");
assert(pipelineDefaults.rateLimit.maxConcurrent === 2, "默认并发上限");

/**
 * @param {RequestInit | undefined} init
 */
function segmentsFromOpenAIBody(init) {
  const body = JSON.parse(String(init && init.body));
  return JSON.parse(body.messages[1].content);
}

/** @type {string[][]} */
const cacheBatches = [];
let cacheFetches = 0;
const cachedEngine = createPipelineEngine(
  createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    model: "cache-model",
    fetchImpl: async (_url, init) => {
      cacheFetches++;
      const segs = segmentsFromOpenAIBody(init);
      cacheBatches.push(segs.map((segment) => segment.text));
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(segs.map((segment) => ({ id: segment.id, text: `⟦${segment.text}⟧` }))),
            },
          },
        ],
      });
    },
  }),
  {
    retry: { retries: 0 },
    rateLimit: { minIntervalMs: 0, maxConcurrent: 2 },
    cache: { provider: "openai", model: "cache-model" },
  }
);

const cachedFirst = await cachedEngine(req);
const cachedSecond = await cachedEngine(req);
assert(cacheFetches === 1, "相同段落第二次应命中缓存，不再 fetch");
assert(cachedFirst.segments[0].text === "⟦Hello world⟧", "缓存包装应保留译文");
assert(cachedSecond.segments[0].id === "p1" && cachedSecond.segments[1].id === "p2", "缓存命中应使用请求 id");
assert(cachedSecond.segments[0].text === cachedFirst.segments[0].text, "缓存译文应稳定");
assert(cacheBatches[0].length === 2, "首次应送出两段");

const partial = await cachedEngine({
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [
    { id: "x", text: "Hello world" },
    { id: "y", text: "Only once" },
  ],
});
assert(cacheFetches === 2, "只有未命中段落才应再次 fetch");
assert(cacheBatches[1].length === 1 && cacheBatches[1][0] === "Only once", "已缓存段落不应进入第二次请求");
assert(partial.segments[0].id === "x" && partial.segments[0].text === "⟦Hello world⟧", "部分命中应带回缓存译文");
assert(partial.segments[1].id === "y" && partial.segments[1].text === "⟦Only once⟧", "新段落应映射回原 id");

const duplicated = await cachedEngine({
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [
    { id: "d1", text: "Same line" },
    { id: "d2", text: "Same line" },
  ],
});
assert(cacheBatches.at(-1)?.length === 1, "同批相同段落应只请求一次");
assert(
  duplicated.segments[0].id === "d1" &&
    duplicated.segments[1].id === "d2" &&
    duplicated.segments[0].text === "⟦Same line⟧" &&
    duplicated.segments[1].text === "⟦Same line⟧",
  "重复段落应各自保留 id"
);

const otherLang = await cachedEngine({
  sourceLang: "auto",
  targetLang: "ja",
  segments: [{ id: "j", text: "Hello world" }],
});
assert(cacheFetches === 4, "targetLang 不同应视为未命中");
assert(otherLang.segments[0].text === "⟦Hello world⟧", "其他目标语言仍应译出");

const sharedStore = new Map();
let modelCalls = 0;
const modelBase = async (batch) => {
  modelCalls++;
  return { segments: batch.segments.map((segment) => ({ id: segment.id, text: `m${modelCalls}` })) };
};
const modelA = withCache(modelBase, { store: sharedStore, provider: "openai", model: "m1" });
const modelB = withCache(modelBase, { store: sharedStore, provider: "openai", model: "m2" });
const modelReq = {
  sourceLang: "en",
  targetLang: "zh-CN",
  segments: [{ id: "s", text: "Hello world" }],
};
const fromA = await modelA(modelReq);
await modelA(modelReq);
const fromB = await modelB(modelReq);
assert(modelCalls === 2, "provider/model 不同不应共用缓存");
assert(fromA.segments[0].text === "m1" && fromB.segments[0].text === "m2", "模型键应隔离译文");

let errorCalls = 0;
const errorCached = withCache(async (batch) => {
  errorCalls++;
  return {
    segments: batch.segments.map((segment) => ({ id: segment.id, text: "", error: "missing translation" })),
  };
});
await errorCached(modelReq);
await errorCached(modelReq);
assert(errorCalls === 2, "带 error 的段落不应写入缓存");

let inflightCalls = 0;
const inflightCached = withCache(async (batch) => {
  inflightCalls++;
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { segments: batch.segments.map((segment) => ({ id: segment.id, text: "shared" })) };
});
const [inflightA, inflightB] = await Promise.all([inflightCached(modelReq), inflightCached(modelReq)]);
assert(inflightCalls === 1, "并发相同段落应合并为一次内层调用");
assert(inflightA.segments[0].text === "shared" && inflightB.segments[0].text === "shared", "合并调用应返回译文");

let retryFetches = 0;
const retried = withRetry(
  createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    fetchImpl: async (_url, init) => {
      retryFetches++;
      if (retryFetches < 3) return jsonResponse({ error: { message: "busy" } }, 503);
      const segs = segmentsFromOpenAIBody(init);
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(segs.map((segment) => ({ id: segment.id, text: "retried" }))),
            },
          },
        ],
      });
    },
  }),
  { retries: 2, baseDelayMs: 5, maxDelayMs: 20 }
);
const retriedRes = await retried(req);
assert(retryFetches === 3, "失败后应重试并最终成功");
assert(retriedRes.segments[0].text === "retried" && retriedRes.segments[1].text === "retried", "重试成功应映射译文");

/** @type {number[]} */
const backoff = [];
let exhaustedCalls = 0;
let exhaustedThrew = false;
try {
  await withRetry(
    async () => {
      exhaustedCalls++;
      throw new Error("still down");
    },
    {
      retries: 2,
      baseDelayMs: 10,
      factor: 2,
      maxDelayMs: 100,
      sleep: async (ms) => {
        backoff.push(ms);
      },
    }
  )(req);
} catch (err) {
  exhaustedThrew = err instanceof Error && /still down/.test(err.message);
}
assert(exhaustedThrew, "重试耗尽后应抛出原错误");
assert(exhaustedCalls === 3, "retries: 2 应共调用 3 次");
assert(backoff[0] === 10 && backoff[1] === 20, `退避应为 10, 20，实际 ${backoff.join(",")}`);

/** @type {number[]} */
const spacedAt = [];
const spaced = withRateLimit(
  async (batch) => {
    spacedAt.push(Date.now());
    return { segments: batch.segments.map((segment) => ({ id: segment.id, text: "spaced" })) };
  },
  { minIntervalMs: 50, maxConcurrent: 2 }
);
await Promise.all([
  spaced({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "1", text: "a" }] }),
  spaced({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "2", text: "b" }] }),
  spaced({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "3", text: "c" }] }),
]);
assert(spacedAt.length === 3, "限流应放行全部调用");
assert(spacedAt[1] - spacedAt[0] >= 40, `第 2 次启动过早: ${spacedAt[1] - spacedAt[0]}ms`);
assert(spacedAt[2] - spacedAt[1] >= 40, `第 3 次启动过早: ${spacedAt[2] - spacedAt[1]}ms`);

/** @type {Array<{ start: number, end: number }>} */
const serialSpans = [];
const serial = withRateLimit(
  async (batch) => {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 30));
    serialSpans.push({ start, end: Date.now() });
    return { segments: batch.segments.map((segment) => ({ id: segment.id, text: "serial" })) };
  },
  { minIntervalMs: 0, maxConcurrent: 1 }
);
await Promise.all([
  serial({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "1", text: "a" }] }),
  serial({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "2", text: "b" }] }),
]);
assert(serialSpans.length === 2, "并发上限应完成两次调用");
assert(serialSpans[1].start >= serialSpans[0].end - 5, "maxConcurrent: 1 时第二次应等第一次结束");

let pipeFetches = 0;
/** @type {number[]} */
const pipeTimes = [];
const piped = createPipelineEngine(
  createOpenAICompatibleEngine({
    apiKey: "test-key",
    baseUrl: "https://example.test/v1",
    model: "pipe",
    fetchImpl: async (_url, init) => {
      pipeFetches++;
      pipeTimes.push(Date.now());
      const segs = segmentsFromOpenAIBody(init);
      if (pipeFetches === 1) return jsonResponse({ error: { message: "busy" } }, 503);
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(segs.map((segment) => ({ id: segment.id, text: `⟦${segment.text}⟧` }))),
            },
          },
        ],
      });
    },
  }),
  {
    retry: { retries: 2, baseDelayMs: 5, maxDelayMs: 20 },
    rateLimit: { minIntervalMs: 50, maxConcurrent: 1 },
    cache: { provider: "openai", model: "pipe" },
  }
);
const pipeReq = {
  sourceLang: "en",
  targetLang: "zh-CN",
  segments: [{ id: "a", text: "alpha" }],
};
const pipeFirst = await piped(pipeReq);
assert(pipeFirst.segments[0].id === "a" && pipeFirst.segments[0].text === "⟦alpha⟧", "管道应在重试后返回译文");
assert(pipeFetches === 2, "管道应失败一次后再成功");
assert(pipeTimes[1] - pipeTimes[0] >= 40, "重试的下一次请求应受限流间隔约束");
const pipeAgain = await piped(pipeReq);
assert(pipeAgain.segments[0].text === "⟦alpha⟧", "管道缓存应命中");
assert(pipeFetches === 2, "管道缓存命中不应再 fetch");
const [pipeBeta, pipeGamma] = await Promise.all([
  piped({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "b", text: "beta" }] }),
  piped({ sourceLang: "en", targetLang: "zh-CN", segments: [{ id: "c", text: "gamma" }] }),
]);
assert(pipeBeta.segments[0].text === "⟦beta⟧" && pipeGamma.segments[0].text === "⟦gamma⟧", "管道并发未命中应各自译出");
assert(pipeFetches === 4, "两段新文本应各 fetch 一次");
assert(pipeTimes.at(-1) - pipeTimes.at(-2) >= 40, "管道限流应拉开并发未命中");

let failedPipeCalls = 0;
const failedPipe = createPipelineEngine(
  async () => {
    failedPipeCalls++;
    throw new Error("down");
  },
  {
    retry: { retries: 1, baseDelayMs: 1, maxDelayMs: 1 },
    rateLimit: { minIntervalMs: 0, maxConcurrent: 1 },
  }
);
let failedPipeThrew = false;
try {
  await failedPipe(modelReq);
} catch (err) {
  failedPipeThrew = err instanceof Error && /down/.test(err.message);
}
assert(failedPipeThrew && failedPipeCalls === 2, "管道重试耗尽应抛错");
try {
  await failedPipe(modelReq);
} catch {
  // 失败不入库，下一次仍会打到内层
}
assert(failedPipeCalls === 4, "管道失败结果不应写入缓存");

const transientFailure = new TranslateFailure("translate HTTP 503: busy", {
  kind: "provider",
  code: "server_error",
  status: 503,
});
let transientCalls = 0;
/** @type {unknown} */
let transientErr = null;
try {
  await withRetry(
    async () => {
      transientCalls++;
      throw transientFailure;
    },
    { retries: 2, baseDelayMs: 0, maxDelayMs: 0 }
  )(req);
} catch (err) {
  transientErr = err;
}
assert(transientCalls === 3, "瞬时失败应重试到耗尽（首次 + retries）");
assert(transientErr === transientFailure, "重试耗尽应原样抛出最后一次错误");
assert(
  isTranslateFailure(transientErr) &&
    /** @type {TranslateFailure} */ (transientErr).kind === "provider" &&
    /** @type {TranslateFailure} */ (transientErr).code === "server_error" &&
    /** @type {TranslateFailure} */ (transientErr).status === 503,
  "重试后 kind/code/status 仍可读"
);

let pipe503Calls = 0;
/** @type {unknown} */
let pipe503Err = null;
try {
  await createPipelineEngine(
    createOpenAICompatibleEngine({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      fetchImpl: async () => {
        pipe503Calls++;
        return jsonResponse({ error: { message: "unavailable", type: "server_error" } }, 503);
      },
    }),
    {
      retry: { retries: 1, baseDelayMs: 0, maxDelayMs: 0 },
      rateLimit: { minIntervalMs: 0, maxConcurrent: 1 },
    }
  )(modelReq);
} catch (err) {
  pipe503Err = err;
}
assert(pipe503Calls === 2, "管道对 503 应重试一次后再抛出");
const pipe503 = /** @type {TranslateFailure} */ (pipe503Err);
assert(
  pipe503.kind === "provider" && pipe503.code === "server_error" && pipe503.status === 503,
  "管道不得吞掉上游失败的 kind/code/status"
);
assert(/translate HTTP 503: unavailable/.test(pipe503.message), "管道抛出的 message 应可直接展示");

let pipeNetCalls = 0;
/** @type {unknown} */
let pipeNetErr = null;
try {
  await createPipelineEngine(
    createOpenAICompatibleEngine({
      apiKey: "test-key",
      fetchImpl: async () => {
        pipeNetCalls++;
        throw new TypeError("socket hang up");
      },
    }),
    {
      retry: { retries: 1, baseDelayMs: 0, maxDelayMs: 0 },
      rateLimit: { minIntervalMs: 0, maxConcurrent: 1 },
    }
  )(modelReq);
} catch (err) {
  pipeNetErr = err;
}
assert(pipeNetCalls === 2, "管道对网络错误应重试");
const pipeNet = /** @type {TranslateFailure} */ (pipeNetErr);
assert(
  pipeNet.kind === "network" && pipeNet.code === "network" && /translate network: socket hang up/.test(pipeNet.message),
  "管道应抛出可读的网络失败"
);

console.log("smoke ok: batch mockTranslate / translate + openai/anthropic/deepseek env + yaml merge + pipeline");

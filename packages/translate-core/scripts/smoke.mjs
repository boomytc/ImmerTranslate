import {
  mockTranslate,
  translate,
  createOpenAICompatibleEngine,
  createAnthropicCompatibleEngine,
  deepSeekOptionsFromEnv,
} from "../src/index.js";

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

console.log("smoke ok: batch mockTranslate / translate + openai/anthropic/deepseek env");

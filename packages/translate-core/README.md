# @immer-translate/translate-core

翻译契约、mock 引擎、OpenAI / Anthropic 兼容引擎，以及可选的段落缓存、重试和限流。包版本 `0.4.0`（对齐 `dev-0.4.0` 的 FEATURE 位）。密钥只在调用时传入（扩展本地存储或进程环境），不写入本包。扩展 manifest 不在本包里升级。

## 契约

- `TranslateRequest`: `{ sourceLang, targetLang, segments: [{ id, text }] }`
- `TranslateResponse`: `{ segments: [{ id, text, error? }] }`
- 引擎：`(req) => Promise<TranslateResponse>`

形状保持不变。真引擎把模型返回的 JSON 数组 `[{ id, text }]` 按请求段落 `id` 映射回 `TranslateResponse`。

## 导出

| 导出 | 作用 |
| --- | --- |
| `mockTranslate` | 假译，每段包成 `⟦原文⟧` |
| `translate` | `mockTranslate` 的别名，默认引擎仍是 mock |
| `createOpenAICompatibleEngine({ apiKey, baseUrl?, model?, fetchImpl? })` | `POST {baseUrl}/chat/completions`，`Authorization: Bearer` |
| `createAnthropicCompatibleEngine({ apiKey, baseUrl?, model?, fetchImpl? })` | Anthropic Messages，解析 `type: "text"` 内容块 |
| `deepSeekOptionsFromEnv(env?)` | 从进程环境读 DeepSeek 调用参数；没有密钥时返回 `null` |
| `withCache(engine, opts?)` | 段落缓存。命中则不再调用内层引擎 |
| `withRetry(engine, opts?)` | 内层抛错时按退避重试 |
| `withRateLimit(engine, opts?)` | 限制启动间隔与并发，避免突发打满接口 |
| `createPipelineEngine(engine, opts?)` | 依次套上缓存、重试、限流 |
| `pipelineDefaults` | 上述三项的默认参数 |

空 `apiKey`（缺省、空串、纯空白）在工厂函数里立即抛错，不会发请求。

## 管道（缓存 / 重试 / 限流）

`translate` 默认仍是 `mockTranslate`。真引擎也不会自动包管道；由调用方包一次。`TranslateRequest` / `TranslateResponse` 形状不变。

`createPipelineEngine` 从外到内是：段落缓存 → 失败重试 → 启动间隔限流 → 基础引擎。缓存命中不会重试，也不会发出请求。

- 缓存键：段落 `text` + `sourceLang` + `targetLang`。`cache.provider` / `cache.model` 有值时一并计入，不同模型不共用译文。只缓存成功段落；抛错和段上的 `error` 不入库。同一键的并发未命中共用一次内层调用。
- 重试：只在引擎抛错时进行。默认 2 次重试，退避 `50ms`、`100ms`（`baseDelayMs * factor^attempt`，上限 `400ms`）。
- 限流：默认两次启动至少间隔 `100ms`，同时最多 `2` 个调用。

默认值见 `pipelineDefaults`，传入的字段会覆盖对应项，未写的字段保持默认。

`fetchImpl` 可选，签名与 `fetch(url, init)` 相同，便于测试时替换，不访问网络。

### OpenAI 兼容

- 默认 `baseUrl`: `https://api.openai.com/v1`
- 默认 `model`: `gpt-4o-mini`
- 末尾多余的 `/` 会去掉后再拼接 `/chat/completions`
- 助手消息可以是字符串，或由 text 片段组成的数组；外层 Markdown 代码块会被剥掉

### Anthropic 兼容

- 默认 `baseUrl`: `https://api.anthropic.com`
- 默认 `model`: `claude-3-5-haiku-latest`
- `baseUrl` 不以 `/v1` 结尾时：`POST {baseUrl}/v1/messages`
- `baseUrl` 已以 `/v1` 结尾时：`POST {baseUrl}/messages`
- 请求头：`x-api-key`、`anthropic-version: 2023-06-01`

### DeepSeek 环境变量

`deepSeekOptionsFromEnv` 只认变量名，不在仓库里放值：

- `DEEPSEEK_API_KEY` — 没有或只有空白时返回 `null`
- `DEEPSEEK_BASE_URL` — 可选；缺省 `https://api.deepseek.com/v1`

有密钥时返回 `{ apiKey, baseUrl, model }`，其中 `model` 固定为 `deepseek-flash`。把返回值传给 `createOpenAICompatibleEngine` 即可。

### Node / cloud YAML（扩展不使用）

浏览器扩展只读 `chrome.storage.local`，不要把 `config.yaml` / `config.local.yaml` 拷进 `extension/` 或 `extension/vendor/`。本文件也不要从 MV3 service worker 导入（它依赖 `node:fs`，且不在 `src/` 里，同步脚本不会把它拷进 vendor）。

仓库根目录的 `config.yaml` 是无密钥模板。本地：

```bash
cp config.yaml config.local.yaml
```

在 `config.local.yaml` 里填写 `apiKey`。该文件已被 gitignore。

`packages/translate-core/config/load.js`：

| 导出 | 作用 |
| --- | --- |
| `loadMergedEngineConfig({ cwd, env, readFile })` | 浅合并，后者胜出：默认值 ← `config.yaml` ← `config.local.yaml` ← 环境变量 |
| `createEngineFromMergedConfig(cfg, extra?)` | `anthropic` 用 Anthropic 引擎；其余 provider（含 DeepSeek / openai）用 OpenAI 兼容引擎。`apiKey` 为空时返回 `mockTranslate` |

`readFile` 可选，收到 `join(cwd, "config.yaml")` 与 `join(cwd, "config.local.yaml")`。返回 `null` 或抛 `ENOENT` 视为文件不存在。

YAML 只支持每行一个 `key: value`、可选引号、整行 `#` 注释。不支持缩进、嵌套和行内注释。

环境变量在非空时覆盖 YAML。通用名在前，DeepSeek 名在后（因此非空的 `DEEPSEEK_API_KEY` 压过 `IMMER_TRANSLATE_API_KEY` 和 YAML）：

| 变量 | 字段 |
| --- | --- |
| `IMMER_TRANSLATE_PROVIDER` | `provider` |
| `IMMER_TRANSLATE_BASE_URL` | `baseUrl` |
| `IMMER_TRANSLATE_MODEL` | `model` |
| `IMMER_TRANSLATE_API_KEY` | `apiKey` |
| `IMMER_TRANSLATE_SOURCE_LANG` | `sourceLang` |
| `IMMER_TRANSLATE_TARGET_LANG` | `targetLang` |
| `DEEPSEEK_BASE_URL` | `baseUrl` |
| `DEEPSEEK_API_KEY` | `apiKey` |

空白变量视为未设置。`sourceLang` / `targetLang` 留在配置对象上，由调用方放进 `TranslateRequest`；工厂只接收 `apiKey`、`baseUrl`、`model`。`extra.fetchImpl` 仅用于测试替换 `fetch`。

## 本地跑通一次 batch

```bash
cd packages/translate-core
npm run smoke
```

`smoke` 覆盖 mock、两个工厂（注入假的 `fetchImpl`，不联网、不用真密钥）、`deepSeekOptionsFromEnv`、临时目录里的 YAML 合并（base ← local ← env，无真密钥），以及管道：缓存命中不再次 `fetch`、失败退避后成功、限流拉开调用间隔。期望：先打印 mock JSON（译文为 `⟦原文⟧`），末行 `smoke ok`。

## 给扩展用

```js
import {
  mockTranslate,
  createOpenAICompatibleEngine,
  createAnthropicCompatibleEngine,
} from "../packages/translate-core/src/index.js";
```

MV3 service worker 不能引用扩展目录以外的文件。改完 `src/` 后在仓库根目录执行 `./scripts/sync-translate-core.sh`，再从 `extension/vendor/translate-core/index.js` 导入。

### 给 ExtForge：引擎只包一次

不要改 `TranslateRequest` / `TranslateResponse`。在 service worker 里对「最终那一个」引擎包一层并复用；不要在每条 `TRANSLATE_BATCH` 里新建 `createPipelineEngine`，否则缓存和限流每次都是空的。`provider` / `model` / 是否有密钥变化时再重建。mock、OpenAI 兼容、Anthropic 兼容走同一包装：

```js
import { createPipelineEngine } from "./vendor/translate-core/index.js";

// base = mockTranslate，或 createOpenAICompatibleEngine / createAnthropicCompatibleEngine 的返回值
let wrapped = null;
let wrappedStamp = "";

function engineFor(settings, base) {
  const stamp = [settings.provider, settings.model, settings.apiKey ? "key" : "mock"].join(":");
  if (!wrapped || wrappedStamp !== stamp) {
    wrappedStamp = stamp;
    wrapped = createPipelineEngine(base, {
      cache: { provider: settings.provider, model: settings.model },
    });
  }
  return wrapped;
}
```

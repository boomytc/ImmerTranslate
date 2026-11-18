# 自定义接口说明及示例

如果你要接入的是 **OpenAI 兼容接口**或 **Anthropic Messages 接口**，无需使用 `Custom` 编写脚本——直接在设置页「服务与接口」→「翻译服务」中启用或添加 `OpenAI` / `Claude` 类型，填写 `URL`、`Key` 和 `Model` 即可。

只有对接其他私有或非标准格式的接口时，才需要选择 `Custom` 类型（除 `BuiltinAI` 浏览器内置 AI 外，其他内置接口点击底部「更多」后，也支持配置 `自定义Header参数`、`自定义Body参数`、`Request Hook` 和 `Response Hook`）。

## 默认接口规范（Custom 类型）

如果目标接口的请求和返回本身符合以下 JSON 规范，选择 `Custom` 类型并填写 `URL`（以及可选的 `Key`），无需填写 `Request Hook` 或 `Response Hook` 即可使用。

> 提示：如果不通过 `Request Hook` 覆盖请求头，即使 `Key` 留空，默认请求仍会携带 `Authorization: Bearer <Key>`；此外，`Custom` 不在免钥白名单中——`Key` 留空时虽然可在设置页各翻译场景中选择，但不会出现在浏览器工具栏弹窗和网页悬浮球的服务列表中。如需在弹窗或悬浮球中使用免鉴权的 `Custom` 服务，可在 `Key` 中填写任意占位字符，并用 `Request Hook` 移除或覆盖 `Authorization` 请求头。

### 非聚合翻译

关闭「是否聚合发送翻译请求」时：

Request Body：

```json
{
  "text": "hello", // 需要翻译的单条文本
  "from": "auto", // 原文语言代码
  "to": "zh-CN" // 目标语言代码
}
```

Response：

```json
{
  "text": "你好", // 译文
  "src": "en" // 检测到的原文语言代码（可选）
}
```

也支持用 `"from"` 表示原文语言：

```json
{
  "text": "你好", // 译文
  "from": "en" // 检测到的原文语言代码（可选）
}
```

### 聚合翻译

开启「是否聚合发送翻译请求」时：

Request Body：

```json
{
  "texts": ["hello"], // 需要翻译的文本列表
  "from": "auto", // 原文语言代码
  "to": "zh-CN" // 目标语言代码
}
```

Response：

```json
[
  {
    "text": "你好", // 译文
    "src": "en" // 检测到的原文语言代码（可选）
  }
]
```

也支持以下返回格式：

```json
{
  "translations": [
    {
      "text": "你好", // 译文
      "src": "en" // 检测到的原文语言代码（可选）
    }
  ]
}
```

## Request Hook 与 Response Hook 说明

- **`Request Hook`**：`async (args, req) => { ... }`
  - 第一个参数 `args` 包含待翻译文本 `texts`（字符串数组，非聚合模式下只有 1 项 `texts[0]`）、语言字段 `from` / `to` / `fromLang` / `toLang`、接口配置（`url`、`key`、`model`、`temperature`、`maxTokens`、`tone`、`useBatchFetch`、`useStream`、`batchProtocol` 等）、页面上下文 `docInfo`、Prompt 字段以及 `req`。
  - 第二个参数 `req`（同时也是 `args.req`）是扩展预先构造好的请求对象 `{ url, body, headers, userMsg, method }`。
  - 返回值必须是一个包含 `url` 的对象（例如 `{ url, body, headers, userMsg, method }`；省略 `method` 时默认 `"POST"`）。若返回空值或不含 `url`，Hook 不会生效。
  - 注意：YouTube 字幕断句请求不执行 `Request Hook`。
- **`Response Hook`**：`async ({ res, ...args }) => { ... }`
  - 入参包含响应数据 `res` 以及 `apiType`、`userMsg`、`texts`、`from`、`to`、`fromLang`、`toLang`、`langMap`、`extractJson`（从模型回复文本中提取首个 JSON 子串）、`parseAIRes`（解析大模型返回的聚合 JSON/XML/LINE 或单句译文）。
  - 返回 `{ translations }`（二维数组 `[[译文, 原文语言]]`，聚合模式下按段落顺序对应，或返回带编号的 `[{ id: 0, translation: [译文, 原文语言] }]`），也可以直接返回数组 `[[译文, 原文语言]]`。在支持智能上下文的内置 AI 接口上，开启「是否启用智能上下文」时可一并返回 `modelMsg`（如 `{ role: "assistant", content: "..." }`）写入对话历史。若返回空值，则继续走默认解析逻辑。
  - 注意：`Response Hook` 仅在**非流式翻译**路径生效。**流式翻译**（内置大模型预置默认开启「是否启用流式传输」，仅在流式失败自动回退为非流式时才会进入该 Hook）、**AI 词典**、**YouTube 字幕断句**以及**视频上下文摘要**请求均不执行 `Response Hook`。

## 提示词占位符与字段说明

### Prompt 可替换占位符

```text
{{from}}        // 转换后的原文语言名称或接口专用代码
{{to}}          // 转换后的目标语言名称或接口专用代码
{{fromLang}}    // 扩展标准原文语言代码（如 auto、en）
{{toLang}}      // 扩展标准目标语言代码（如 zh-CN）
{{text}}        // 原文（单句翻译与 AI 词典使用）
{{segments}}    // 聚合翻译文本片段（按聚合协议生成，仅聚合用户提示词使用）
{{tone}}        // 翻译风格
{{glossary}}    // 专业术语表（合并规则与接口中的 AI 专业术语）
{{title}}       // 页面标题
{{description}} // 页面描述（meta description）
{{summary}}     // 页面或视频上下文摘要（如视频简介、AI 视频大纲等）
{{context}}     // 划词文本所在的周边段落上下文
```

此外，在 `Gemini` 原生接口地址中支持 `{{model}}`、`{{key}}`，模型列表地址中支持 `{{key}}`。

### Hook（`args`）中的 Prompt 字段

```text
systemPrompt       // System Prompt（内置 AI 接口会按是否聚合编译替换占位符；Custom 下保持原始模板）
userPrompt         // User Prompt（内置 AI 接口为编译后的最终用户消息；Custom 下默认为空字符串）
batchUserPrompt    // 聚合翻译 User Prompt 模板原文
nobatchPrompt      // 单句（非聚合）翻译 System Prompt 模板原文
nobatchUserPrompt  // 单句（非聚合）翻译 User Prompt 模板原文
subtitlePrompt     // 字幕 AI 断句 System Prompt 模板原文
dictPrompt         // AI 词典 System Prompt 模板原文
dictUserPrompt     // AI 词典 User Prompt 模板原文
```

`args` 中同时提供内置默认提示词常量：`defaultSystemPrompt`、`defaultSystemPromptXml`、`defaultSystemPromptLines`、`defaultSubtitlePrompt`、`defaultNobatchPrompt`、`defaultNobatchUserPrompt`。

## OpenCode 会话请求头

内置的 `OpenCodeGo` 接口会自动为每次请求添加 `x-opencode-session` 请求头。在同一个页面、同一个接口配置与 URL 下，各类请求（聚合翻译、单句翻译、流式传输、AI 词典、YouTube 字幕以及开启「增强智能上下文」时的视频摘要请求）都会复用同一个随机生成的会话 ID；刷新页面或页面地址跳转后会自动开始新的会话。该 ID 仅用于关联会话，不包含页面地址、待译内容或你的 API Key。

如果你使用 `OpenAI` 兼容接口或 `Custom` 接入 OpenCode，或者想手动固定这个会话 ID，可以点击接口设置底部的「更多」，在 `Request Hook` 中填写：

```js
async (args, req = args.req) => {
  // 为当前翻译会话指定固定 ID，同一会话内保持不变
  const sessionId = "8fd946a1-bb92-4aa6-9766-724c9e435832";
  const headers = { ...req.headers };
  // 清除已有的同名请求头（忽略大小写），避免重复发送
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === "x-opencode-session") delete headers[name];
  }
  headers["x-opencode-session"] = sessionId;
  return { ...req, headers };
};
```

第二个参数 `req`（也可通过 `args.req` 读取）是扩展预先构造好的请求对象。保留它的 `url`、`body`、`method` 和 `userMsg`，只修改请求头，原本的翻译协议和返回解析都保持不变，`Response Hook` 无需额外填写。请勿在每次调用时重新生成随机 ID，只在需要开始新会话时更换它。

**字幕请求说明**：YouTube 字幕断句请求不执行 `Request Hook`。如果需要在字幕场景手动指定会话 ID，请展开接口设置底部的「更多」，在「自定义Header参数」中填入 JSON，例如 `{"x-opencode-session":"8fd946a1-bb92-4aa6-9766-724c9e435832"}`；内置 `OpenCodeGo` 接口也会保留你显式配置的这个请求头。

参考：[OpenCode Go 对稳定 session ID 的要求](https://opencode.ai/docs/go/#where-can-i-use-it)。

## 自定义示例

### 谷歌翻译（Custom 非聚合示例）

> 扩展已内置免钥 `Google` 接口，此处仅演示如何用 Hook 接入 `GET` 请求接口（需关闭「是否聚合发送翻译请求」）。如果希望该自定义项出现在弹窗和悬浮球中，可任意填写占位 `Key`；本示例 `Request Hook` 只返回 `{ url, method: "GET" }`，不会发送默认的 `Authorization` 头。

URL

```text
https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&dt=t&ie=UTF-8&q={{text}}&sl={{fromLang}}&tl={{toLang}}
```

Request Hook

```js
async (args) => {
  const url = args.url
    .replace("{{text}}", encodeURIComponent(args.texts[0]))
    .replace("{{fromLang}}", encodeURIComponent(args.fromLang))
    .replace("{{toLang}}", encodeURIComponent(args.toLang));
  return { url, method: "GET" };
};
```

Response Hook

```js
async ({ res }) => {
  const text = res?.sentences?.map((item) => item?.trans || "").join(" ") || "";
  return { translations: [[text, res?.src]] };
};
```

### Ollama（Custom 聚合示例）

> 扩展已内置 `Ollama` 预置，常规使用直接启用预置即可。下方示例演示在 `Custom` 类型中开启「是否聚合发送翻译请求」，借助内置的 JSON 聚合提示词 `args.defaultSystemPrompt` 对接本地模型。如果为本地无鉴权 Ollama 填写了占位 `Key`（以便在弹窗和悬浮球中显示），可删除下方 `if (args.key)` 鉴权代码，避免发送多余的 `Authorization` 请求头。

- 启动 Ollama 时需要配置环境变量 `OLLAMA_ORIGINS=*`（允许扩展从后台发起跨域请求）
- Linux systemd 可用此命令检查环境变量是否生效：`systemctl show ollama | grep OLLAMA_ORIGINS`

URL

```text
http://localhost:11434/v1/chat/completions
```

Request Hook

```js
async (args) => {
  const headers = { "Content-type": "application/json" };
  if (args.key) {
    headers.Authorization = `Bearer ${args.key}`;
  }
  const body = {
    model: args.model || "gemma3",
    messages: [
      {
        role: "system",
        content: args.defaultSystemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLanguage: args.toLang,
          segments: args.texts.map((text, id) => ({ id, text })),
        }),
      },
    ],
    temperature: 0,
    max_tokens: 20480,
    think: false,
    stream: false,
  };

  return { url: args.url, body, headers, method: "POST" };
};
```

Response Hook

```js
async ({ res, parseAIRes }) => {
  const translations = parseAIRes(res?.choices?.[0]?.message?.content);
  return { translations };
};
```

### 硅基流动（Custom 非聚合示例）

> 扩展已内置 `SiliconFlow` 预置，常规使用建议直接启用预置。下方示例演示在 `Custom` 类型中关闭「是否聚合发送翻译请求」，按单句模式调用专用翻译模型（`Custom` 界面没有 Model 输入框，示例直接写明模型 ID）。

URL

```text
https://api.siliconflow.cn/v1/chat/completions
```

Request Hook

```js
async (args) => {
  const headers = {
    "Content-type": "application/json",
    Authorization: `Bearer ${args.key}`,
  };
  const body = {
    model: args.model || "tencent/Hunyuan-MT-7B",
    messages: [
      {
        role: "system",
        content:
          "You are a professional translation engine. Output ONLY the translated text without any explanation.",
      },
      {
        role: "user",
        content: `Translate the following text into ${args.to}:\n${args.texts[0]}`,
      },
    ],
    temperature: 0,
    max_tokens: 20480,
  };

  return { url: args.url, body, headers, method: "POST" };
};
```

Response Hook

```js
async ({ res }) => {
  return { translations: [[res?.choices?.[0]?.message?.content || ""]] };
};
```

## 语言代码表及说明

Hook 参数中的两套语言字段含义不同：

- `fromLang`、`toLang`：扩展内部使用的标准语言代码（见下表，例如 `auto`、`en`、`zh-CN`）。
- `from`、`to`：按接口类型转换后的语言标识。对于 `Custom` 和大模型接口，扩展会将其映射为下表中的英文语言名称（例如 `auto` 转为 `AutoDetect`、`zh-CN` 转为 `Simplified Chinese`）；对于部分传统翻译 API（如 DeepL、微软、腾讯等），会映射为对应平台要求的专用代码。

如果你的自定义接口要求标准语言代码或自有映射规则，请在 `Request Hook` 中直接使用 `fromLang`、`toLang` 或自行转换。

```text
["auto", "AutoDetect - AutoDetect"],
["en", "English - English"],
["zh-CN", "Simplified Chinese - 简体中文"],
["zh-TW", "Traditional Chinese - 繁體中文"],
["ar", "Arabic - العربية"],
["bg", "Bulgarian - Български"],
["ca", "Catalan - Català"],
["hr", "Croatian - Hrvatski"],
["cs", "Czech - Čeština"],
["da", "Danish - Dansk"],
["nl", "Dutch - Nederlands"],
["fa", "Persian - فارسی"],
["fi", "Finnish - Suomi"],
["fr", "French - Français"],
["de", "German - Deutsch"],
["el", "Greek - Ελληνικά"],
["hi", "Hindi - हिन्दी"],
["hu", "Hungarian - Magyar"],
["id", "Indonesian - Indonesia"],
["it", "Italian - Italiano"],
["ja", "Japanese - 日本語"],
["ko", "Korean - 한국어"],
["ms", "Malay - Melayu"],
["mt", "Maltese - Malti"],
["nb", "Norwegian - Norsk Bokmål"],
["pl", "Polish - Polski"],
["pt", "Portuguese - Português"],
["ro", "Romanian - Română"],
["ru", "Russian - Русский"],
["sk", "Slovak - Slovenčina"],
["sl", "Slovenian - Slovenščina"],
["es", "Spanish - Español"],
["sv", "Swedish - Svenska"],
["ta", "Tamil - தமிழ்"],
["te", "Telugu - తెలుగు"],
["th", "Thai - ไทย"],
["tr", "Turkish - Türkçe"],
["uk", "Ukrainian - Українська"],
["vi", "Vietnamese - Tiếng Việt"],
```

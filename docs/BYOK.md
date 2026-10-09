# 预置与 BYOK

Six built-in engines, all disabled until you enable them. Fill base URL, key, and model yourself. Keys stay in the extension's local storage and must not be committed. The project is GPL-3.0 (see `LICENSE`); if you distribute a modified build, keep the license and offer the corresponding source.

## 加载未打包的 Chrome 扩展

需要 Node.js 与 pnpm（建议使用 Node 24）。

```sh
pnpm install
pnpm build:chrome
```

产物在 `build/chrome`。

1. 打开 `chrome://extensions`。
2. 打开「开发者模式」。
3. 「加载已解压的扩展程序」，选择 `build/chrome`（目录内应有 `manifest.json`）。
4. 打开扩展的选项页。

## 预置

这些条目都在 `src/config/api.js` 里，**默认禁用**，Key 为空。没有另做一套协议。已有的 OpenAI、Claude、DeepSeek、XiaomiMimo、AliyunBailian 不重复添加；相对 `dev` 新增的有 ModelScope 与 ModelBest。

启用：选项页「接口设置」→ 选中该预置 → 关掉「是否禁用」→「保存」。然后自填 base、Key、Model，再保存。Model 可改预置占位，也可点「拉取模型列表」或手填。缺 Key 时拉取失败会显示出来，模型 ID 仍可手填。

要用它翻译网页：到「规则设置」→「全局规则」→「编辑」，把「翻译服务」改成该预置，再保存。未改之前全局规则仍是 Microsoft。输入框、划词、字幕的接口需要在对应设置里另选。

| 预置 | 协议 | 默认对话地址 | 模型占位（可改） |
| --- | --- | --- | --- |
| OpenAI | OpenAI 兼容 | `https://api.openai.com/v1/chat/completions` | `gpt-4` |
| Claude | Anthropic | `https://api.anthropic.com/v1/messages` | `claude-3-haiku-20240307` |
| DeepSeek | OpenAI 兼容 | `https://api.deepseek.com/chat/completions` | `deepseek-v4-flash` |
| XiaomiMimo（Mimo） | OpenAI 兼容 | `https://api.xiaomimimo.com/v1/chat/completions` | `mimo-v2.5-pro` |
| AliyunBailian（DashScope） | OpenAI 兼容，对话用 compatible-mode | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` |
| ModelScope | OpenAI 兼容 | `https://api-inference.modelscope.cn/v1/chat/completions` | `Qwen/Qwen3-32B` |
| ModelBest | OpenAI 兼容 | `https://api.modelbest.cn/v1/chat/completions` | `MiniCPM5-2B` |

OpenAI 兼容拉列表时，地址收成 `{base}/models`（已是 `/models` 则保持不变），请求头 `Authorization: Bearer`。DeepSeek 预置列表是 `https://api.deepseek.com/models`。Claude 使用 `x-api-key` 和 `anthropic-version: 2023-06-01`；地址不含 `/v1` 时先 `{base}/v1/models`，404 再 `{base}/models`。百炼的模型目录是原生 `GET https://dashscope.aliyuncs.com/api/v1/models`（分页），不是 compatible-mode。

表里还有其它 OpenAI 兼容行（如 OpenRouter）。同样默认禁用，启用后自填。上面这些是要配置的预置。

ModelBest 托管默认开启思考。关闭思考时请求体写入 `chat_template_kwargs.enable_thinking: false`，避免推理进入译文。输出长度使用 `max_tokens`。Key 在 [platform.modelbest.cn](https://platform.modelbest.cn/console/) 申请。

双语译文默认保留原文（`transOnly` 关闭），译文样式默认无额外装饰，字号、字重、行高、颜色尽量继承所在段落。不要另做一套排版。

## 网站规则

生效顺序：**个人规则 > 订阅规则 > 全局规则**。

没有内置的 x.com 时间线适配器。时间线翻译依赖默认订阅规则地址，并在「基本设置」保持注入订阅规则。订阅规则若写了具体翻译服务而不是 `*`，该站用订阅里的接口。

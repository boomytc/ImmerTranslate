# @immer-translate/translate-core

翻译契约 + mock 引擎。真引擎（OpenAI 兼容）后续接入；密钥只进扩展本地设置 / 运行时环境，不进本包。

## 契约

- `TranslateRequest`: `{ sourceLang, targetLang, segments: [{ id, text }] }`
- `TranslateResponse`: `{ segments: [{ id, text, error? }] }`
- 引擎：`(req) => Promise<TranslateResponse>`

## 本地跑通一次 batch

```bash
cd packages/translate-core
npm run smoke
```

期望：输出 JSON，段落译文为 `⟦原文⟧`，末行 `smoke ok`。

## 给扩展用

```js
import { mockTranslate } from "../packages/translate-core/src/index.js";
// 或打包后：import { translate } from "@immer-translate/translate-core";
```

MV3 service worker 需能解析该 ESM 路径（相对 import 或打包进 background）。

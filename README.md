# ImmerTranslate

Open-source MVP: bilingual (source + translation) reading for webpage main content. Chrome / Edge Manifest V3.

Inspired by immersive bilingual-translate extensions; this repo is an independent implementation focused on a small, local-key-friendly core (no login wall in MVP).

## Status

Early MVP. Current dev version is **1.0.0** (`dev-1.0.0`). With no API key, translation is a **mock** that wraps text as `⟦…⟧`. Saving a key on the options page selects an OpenAI-compatible or Anthropic-compatible engine. Defaults: provider `openai`, base `https://api.deepseek.com/v1`, model `deepseek-flash`. Extension keys stay in `chrome.storage.local`. Hover a main-content paragraph and press **Alt+T** (changeable on the options page, stored as `paragraphHotkey`) to translate that one segment. The extension action icon still toggles the whole page. Options can mark an origin as **never translate** (`denyOrigins`, default empty so every site stays eligible) or **always translate** (`allowOrigins`). A denied origin does not get bilingual nodes from the icon or the hotkey; deny wins if an origin is on both lists. Reading style (`translationFontSize` `sm`/`md`/`lg`, `translationContrast` `normal`/`high`, `displayMode` `bilingual` or `translation-only`) is stored in `chrome.storage.local` and applies to an already open page without a reload. Node and cloud acceptance read a gitignored local YAML file plus environment variables. The service worker wraps the selected engine once with translate-core `createPipelineEngine`; cache, retry, and rate limit are not reimplemented in the shell. `packages/translate-core` is already `1.0.0` on this branch; this seal does not change that package. `TranslateRequest` / `TranslateResponse` stay the same, and an empty key still selects the mock engine.

## Layout

```
extension/                 # Load this folder as an unpacked extension
  manifest.json
  background.js            # Message bus → translate engine
  hotkey.js                # Alt+T codec (options + content script)
  sitelist.js              # Per-origin allow / deny matching
  content.js / content.css # Paragraph detection, hover, bilingual DOM, style attrs
  options.html / options.js
  vendor/translate-core/   # Synced copy of packages/translate-core/src (MV3)
packages/translate-core/   # TranslateRequest/Response + mockTranslate
  config/load.js           # Node-only YAML merge (not synced into the extension)
config.yaml                # Committed template, empty apiKey
scripts/sync-translate-core.sh
```

## Load unpacked

Local load for extension **1.0.0**:

1. Open `chrome://extensions` (Edge: `edge://extensions`)
2. Enable Developer mode
3. **Load unpacked** → select the `extension/` directory in this repo
4. First-time users should **pin the extension icon to the Chrome toolbar**. Known quirk: otherwise open it from the Extensions menu (puzzle icon).
5. Open an article page → click the extension icon to toggle bilingual mock output
6. Hover a main-content paragraph (it picks up a blue outline) → press **Alt+T** to translate only that segment. The line under the original uses the same bilingual style as the full-page toggle. Pressing the hotkey again on an already translated paragraph does nothing. Change the hotkey on the options page (focus the field, press a combo that includes Alt, Ctrl, or Meta, then save). Default is `Alt+T`.
7. Options → 站点名单: add this origin to 永不翻译, go back, click the icon → no bilingual nodes. Remove it to translate again. 始终翻译 is optional and auto-translates that origin on load.
8. Options → 阅读样式: change font size, contrast, or bilingual vs translation-only. An already translated page updates without a reload.

Options: extension details → Extension options. Protocol, base URL, model, API key, languages, `paragraphHotkey`, `denyOrigins`, `allowOrigins`, and the reading-style keys are stored only in `chrome.storage.local`. Leave the key empty to keep the mock engine. The extension does not read `config.yaml`. A bare host in a site list matches that hostname on both http and https; a full URL is stored as its origin only. Subdomains are not included.

## translate-core smoke test

```bash
cd packages/translate-core
npm run smoke
```

Expect JSON segments like `⟦原文⟧` and a final line `smoke ok`.

## Sync vendor copy

MV3 service workers cannot import files outside the extension root. After editing `packages/translate-core/src/`:

```bash
./scripts/sync-translate-core.sh
```

Then reload the extension.

## MVP acceptance (`release-0.1.0` gate)

Current extension version is **1.0.0** (`dev-1.0.0`). The checklist keeps the 0.1.0 gate, the hover hotkey, and the 0.3.0 site lists plus reading-style switches. This seal adds no features.

```bash
npm run accept
```

Checks: vendor sync with `packages/translate-core`, background imports that vendor and selects mock / OpenAI / Anthropic from options, mock batch `⟦…⟧`, package smoke, MV3 manifest, options fields without login/paywall copy, paragraph hotkey default `Alt+T` with a single-segment `TRANSLATE_BATCH`, no absolute local paths or key-shaped secrets in git files, `config.yaml` has an empty `apiKey`, `config.local.yaml` is gitignored, YAML merge precedence, and `extension/` contains neither local YAML nor secrets.

`npm run accept` 通过后，按下面的清单在本机点一遍。加载方式见上文 [Load unpacked](#load-unpacked)（须把图标固定到工具栏）。

### 本机验收清单

除最后一项外，API Key 留空。设置页应写明无强制登录、无升级弹窗。

- [ ] **固定工具栏 + 空密钥整页开关**：文章页点击图标，段落下出现双语 `⟦原文⟧`；再点一次，译文节点消失，页面还原。
- [ ] **悬停 + Alt+T 单段**：悬停主内容一段（蓝色描边），按 **Alt+T**，只有该段出现双语行。
- [ ] **设置页改快捷键**：选项页聚焦「段落快捷键」，按下含 Alt、Ctrl 或 Meta 的组合并保存；悬停另一段用新组合只译该段。可点「恢复默认 Alt+T」回到默认。
- [ ] **永不翻译拦截**：把当前来源加入永不翻译后，图标和 Alt+T 都不再插入译文；从名单移除后可以再译。
- [ ] **样式即时生效**：已译页面上改译文字号、对比度，或双语对照 / 仅译文，当前页马上变样，不用刷新。
- [ ] **可选真实 DeepSeek Key**：协议保持 OpenAI 兼容，填入自备 DeepSeek Key（默认 base / model 即可）翻译一页。密钥只在本机 `chrome.storage.local`。没有登录或升级墙。

## Node / cloud config (not the extension)

The extension reads provider, base URL, model, and API key from `chrome.storage.local` (options page) only. It does not read YAML. Do not copy `config.yaml` or `config.local.yaml` into `extension/` or `extension/vendor/`.

For Node scripts and cloud acceptance, copy the template and fill the key locally:

```bash
cp config.yaml config.local.yaml
```

`config.yaml` is the committed template (`apiKey: ""`). `config.local.yaml` is gitignored. Loader: `packages/translate-core/config/load.js` (`loadMergedEngineConfig`, `createEngineFromMergedConfig`). Empty `apiKey` selects `mockTranslate`. `provider: anthropic` selects the Anthropic-compatible engine; any other provider uses the OpenAI-compatible engine (DeepSeek included).

Merge order (later wins): defaults ← `config.yaml` ← `config.local.yaml` ← environment. YAML is a small subset: one `key: value` per line, optional quotes, `#` comments on their own line. No nesting.

| Variable | Overrides |
| --- | --- |
| `IMMER_TRANSLATE_PROVIDER` | `provider` |
| `IMMER_TRANSLATE_BASE_URL` | `baseUrl` |
| `IMMER_TRANSLATE_MODEL` | `model` |
| `IMMER_TRANSLATE_API_KEY` | `apiKey` |
| `IMMER_TRANSLATE_SOURCE_LANG` | `sourceLang` |
| `IMMER_TRANSLATE_TARGET_LANG` | `targetLang` |
| `DEEPSEEK_BASE_URL` | `baseUrl` (after the generic variables) |
| `DEEPSEEK_API_KEY` | `apiKey` (after the generic variables) |

Blank or whitespace-only variables do not override YAML. `DEEPSEEK_API_KEY` therefore wins over both YAML and `IMMER_TRANSLATE_API_KEY` when it is non-empty.

```js
import { loadMergedEngineConfig, createEngineFromMergedConfig } from "./packages/translate-core/config/load.js";

const cfg = loadMergedEngineConfig({ cwd: process.cwd(), env: process.env });
const engine = createEngineFromMergedConfig(cfg);
```

Pass `cfg.sourceLang` / `cfg.targetLang` on the translate request. The engine factories only receive `apiKey`, `baseUrl`, and `model`.

## Security

- No API keys in the repository
- See [SECURITY.md](SECURITY.md)
- Branching: current dev is `dev-1.0.0` (extension `1.0.0`). Push on `dev-*` (started at `dev-0.1.0`), merge to `release-*` when a stage closes — see CONTRIBUTING.md

## License

[MIT](LICENSE)

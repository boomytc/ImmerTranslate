# ImmerTranslate

Open-source MVP: bilingual (source + translation) reading for webpage main content. Chrome / Edge Manifest V3.

Inspired by immersive bilingual-translate extensions; this repo is an independent implementation focused on a small, local-key-friendly core (no login wall in MVP).

## Status

Early MVP. With no API key, translation is a **mock** that wraps text as `⟦…⟧`. Saving a key on the options page selects an OpenAI-compatible or Anthropic-compatible engine. Defaults: provider `openai`, base `https://api.deepseek.com/v1`, model `deepseek-flash`. Extension keys stay in `chrome.storage.local`. Node and cloud acceptance read a gitignored local YAML file plus environment variables.

## Layout

```
extension/                 # Load this folder as an unpacked extension
  manifest.json
  background.js            # Message bus → translate engine
  content.js / content.css # Paragraph detection + bilingual DOM
  options.html / options.js
  vendor/translate-core/   # Synced copy of packages/translate-core/src (MV3)
packages/translate-core/   # TranslateRequest/Response + mockTranslate
  config/load.js           # Node-only YAML merge (not synced into the extension)
config.yaml                # Committed template, empty apiKey
scripts/sync-translate-core.sh
```

## Load unpacked

1. Open `chrome://extensions` (Edge: `edge://extensions`)
2. Enable Developer mode
3. **Load unpacked** → select the `extension/` directory in this repo
4. Open an article page → click the extension icon to toggle bilingual mock output

Options: extension details → Extension options. Protocol, base URL, model, API key, and languages are stored only in `chrome.storage.local`. Leave the key empty to keep the mock engine. The extension does not read `config.yaml`.

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

```bash
npm run accept
```

Checks: vendor sync with `packages/translate-core`, background imports that vendor and selects mock / OpenAI / Anthropic from options, mock batch `⟦…⟧`, package smoke, MV3 manifest, options fields without login/paywall copy, no absolute local paths or key-shaped secrets in git files, `config.yaml` has an empty `apiKey`, `config.local.yaml` is gitignored, YAML merge precedence, and `extension/` contains neither local YAML nor secrets.

Manual after green: load unpacked `extension/` → open an article → click the action icon → bilingual `⟦…⟧` under paragraphs.

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
- Branching: push on `dev-*` (from `dev-0.1.0`), merge to `release-*` when a stage closes — see CONTRIBUTING.md

## License

[MIT](LICENSE)

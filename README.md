# ImmerTranslate

Open-source MVP: bilingual (source + translation) reading for webpage main content. Chrome / Edge Manifest V3.

Inspired by immersive bilingual-translate extensions; this repo is an independent implementation focused on a small, local-key-friendly core (no login wall in MVP).

## Status

Early MVP. Default engine is a **mock** that wraps text as `⟦…⟧`. Real engines can plug in behind the same contract later; keys stay in browser local storage only.

## Layout

```
extension/                 # Load this folder as an unpacked extension
  manifest.json
  background.js            # Message bus → translate engine
  content.js / content.css # Paragraph detection + bilingual DOM
  options.html / options.js
  vendor/translate-core/   # Synced copy of packages/translate-core/src (MV3)
packages/translate-core/   # TranslateRequest/Response + mockTranslate
scripts/sync-translate-core.sh
```

## Load unpacked

1. Open `chrome://extensions` (Edge: `edge://extensions`)
2. Enable Developer mode
3. **Load unpacked** → select the `extension/` directory in this repo
4. Open an article page → click the extension icon to toggle bilingual mock output

Options: extension details → Extension options. API key field is stored only in `chrome.storage.local` and is unused while the mock engine is active.

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

Checks: vendor sync with `packages/translate-core`, background imports that vendor, mock batch `⟦…⟧`, package smoke, MV3 manifest, options key field without login/paywall copy, no absolute local paths or key-shaped secrets in git files.

Manual after green: load unpacked `extension/` → open an article → click the action icon → bilingual `⟦…⟧` under paragraphs.

## Local engine smoke (no keys in git)

Shell-only for Node smoke / TransPipe scripts — never commit values:

- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_API_KEY`

Extension runtime reads key / base / model from `chrome.storage.local` (options page). Defaults: OpenAI-compatible DeepSeek, model `deepseek-flash`, base `https://api.deepseek.com/v1`.

## Security

- No API keys in the repository
- See [SECURITY.md](SECURITY.md)
- Branching: push on `dev-*` (from `dev-0.1.0`), merge to `release-*` when a stage closes — see CONTRIBUTING.md

## License

[MIT](LICENSE)

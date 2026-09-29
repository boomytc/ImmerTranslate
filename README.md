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

## Security

- No API keys in the repository
- See [SECURITY.md](SECURITY.md)
- Branching: push on `dev-*` (from `dev-0.0.1`), merge to `release-*` when a stage closes — see CONTRIBUTING.md

## License

[MIT](LICENSE)

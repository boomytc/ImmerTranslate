# ImmerTranslate

[中文](README.md)

Open-source MVP: bilingual (source + translation) reading for webpage main content. Chrome / Edge Manifest V3.

Inspired by immersive bilingual-translate extensions. This repo is an independent implementation with a small core and keys kept on the machine (no login wall in the MVP).

## Status

Early MVP. The current dev version is **0.4.2** (branch `dev-0.4.2`, matching `extension/manifest.json`). The premature **1.0.0** label was withdrawn and is not current; the latest published tag is still `v0.3.0`. With no API key, translation is a **mock** that wraps text as `⟦…⟧`. Saving a key on the options page selects an OpenAI-compatible or Anthropic-compatible engine. Defaults: provider `openai`, base `https://api.deepseek.com/v1`, model `deepseek-flash`. Extension keys stay in `chrome.storage.local`.

The toolbar icon opens a **popup** (`default_popup`) instead of toggling silently. The card keeps three things: a status line (translated or not, plus a read-only Mock or engine sentence), a dual-state primary button **翻译** / **显示原文**, and **打开设置**. While the page is untranslated, the button uses the same formatter as the options page and puts the whole-page chord in parentheses: **翻译 (⌥A)** on macOS and **翻译 (Alt+A)** on Windows/Linux (not ⌘T, which opens a new tab). An empty API key is labeled **Mock mode** (`⟦原文⟧`). The popup does not show a login avatar, a Pro toggle, a promo banner, a shortcut grid, or site-list editors. A draggable **floating ball** starts on the lower right and shares the frosted-glass tokens in `extension/glass.css` (blur, radius, translucent fill, hairline, shadow) with the popup. One tap uses the same on/off state. After a translation, a small corner mark appears on the ball. On release it snaps to the left or right edge and keeps its vertical position (`chrome.storage.local` `ballPosition` as `side` and `top`) across refresh. The first time, one non-blocking card sits beside the ball; dismiss it with 知道了 or a click. It is not shown again and does not mention login or payment. On a deny-list origin the ball is hidden. Site lists stay on the options page.

Hover a main-content paragraph and press the paragraph chord (changeable on the options page, stored as `paragraphHotkey`) to translate that one segment. The canonical chord is Option/Alt+T: macOS shows and stores **⌥T**, Windows and Linux show and store **Alt+T**. Whole-page toggle stays Option/Alt+A: **⌥A** on macOS, **Alt+A** on Windows and Linux (not Ctrl+A, which is select-all, and not ⌘T, which opens a new tab). On an article page, when focus is outside an editable field, that chord is matched on `window` / `document` `keydown` in the capture phase; a hit calls `preventDefault` and `stopPropagation` so the browser does not treat Alt+letter as a menu or accelerator. If a host still eats the `keydown` before the page sees it, the matching `keyup` runs that action once. Whole-page also has a manifest command (suggested Alt+A on every platform, ⌥A on macOS). Paragraph has its own (suggested Alt+T, ⌥T on macOS): it translates only the hovered paragraph, and only when that command shortcut still equals the saved `paragraphHotkey`. Changing the chord on the options page and saving, or clicking reset (which writes the platform default), takes effect. The paragraph command does not toggle the page. On a deny-listed origin the paragraph chord inserts nothing. The popup button and the floating ball do not depend on the hotkey; if the chord fails they still toggle and stay on the same page state. Options can mark an origin as **never translate** (`denyOrigins`, default empty so every site stays eligible) or **always translate** (`allowOrigins`). A denied origin does not get bilingual nodes from the popup, the ball, or the hotkey; deny wins if an origin is on both lists. Reading style (`translationFontSize` `sm` / `md` / `lg`, `translationContrast` `normal` / `high`, `displayMode` `bilingual` or `translation-only`) is stored in `chrome.storage.local` and applies to an already open page without a reload.

Node and cloud acceptance read a gitignored local YAML file plus environment variables. The service worker wraps the selected engine once with translate-core `createPipelineEngine`; cache, retry, and rate limit are not reimplemented in the shell. `packages/translate-core` stays package version `0.4.0` (this paragraph-chord shell fix does not change that contract or `src`). `extension/vendor` is synced from that `src` by `scripts/sync-translate-core.sh`. `TranslateRequest` / `TranslateResponse` stay the same, and an empty key still selects the mock engine.

## Layout

```
extension/                 # Load this folder as an unpacked extension
  manifest.json
  background.js            # Message bus → translate engine
  glass.css                # Shared frosted-glass tokens for the popup and the ball
  popup.html / popup.js    # Toolbar popup: status line / dual-state button / options
  hotkey.js                # Hotkey codec and per-OS labels (⌥ / Alt)
  sitelist.js              # Per-origin allow / deny matching
  ballpos.js               # Ball default position, clamp, and edge snap
  content.js / content.css # Paragraph detection, hover, bilingual DOM, ball, style attrs
  options.html / options.js
  vendor/translate-core/   # Synced copy of packages/translate-core/src (MV3)
packages/translate-core/   # TranslateRequest/Response + mockTranslate
  config/load.js           # Node-only YAML merge (not synced into the extension)
config.yaml                # Committed template, empty apiKey
scripts/sync-translate-core.sh
```

## Install

Extension version **0.4.2**. After you have the source, load it unpacked in Chrome or Edge.

1. Clone or download this repository.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `extension/` directory in the repo.
5. **Pin the extension icon to the toolbar.** If it is not pinned, open it from the Extensions menu (puzzle icon).

### From a GitHub Release (optional)

Versions are published as git tags and [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases), not as long-lived `release-*` branches. Existing tags: `v0.1.0`, `v0.1.1`, `v0.2.0`, `v0.2.1`, `v0.3.0`. `v1.0.0` was withdrawn and is not the current version. Later versions are tagged and released the same way.

1. Open the tag you want on Releases and download that tag's source (Source code).
2. Unpack it, then load its `extension/` folder with the steps above and pin the icon to the toolbar.

The current development line is `dev-0.4.2`. To follow that line, clone or download that branch and load its `extension/` folder.

## Use

1. Open an article page and click the toolbar icon to open the popup. The status line shows whether the page is translated and adds a Mock or engine sentence. With an empty API key it labels Mock mode and translations look like `⟦原文⟧`. The primary button switches between **翻译** and **显示原文**. While untranslated it reads **翻译 (⌥A)** on macOS or **翻译 (Alt+A)** on Windows/Linux, using the same formatter as the options page. The same chord toggles the page when focus is outside an editable field: **Alt+A** on Windows/Linux, **⌥A** on macOS. If the OS or browser still takes that chord, use the popup button or the ball; both share the page state with the hotkey. **打开设置** opens the options page. The ball on the lower right does the same tap; a small corner mark shows after translation. Drag it; on release it snaps to the left or right edge and keeps the vertical position. After a refresh it is still on that side at the same height. The first visit shows one tip card beside the ball. Dismiss it with 知道了 or a click.
2. Hover a paragraph in the main content (it picks up a blue outline) and press the default paragraph chord (**⌥T** on macOS, **Alt+T** on Windows/Linux) to translate only that segment. The line under the original uses the same bilingual style as the full-page toggle. Pressing the hotkey again on an already translated paragraph does nothing. If the browser eats the chord, the extension command still translates only that hovered paragraph and does not toggle the page.
3. On the options page (extension details → Extension options, or **Open settings** in the popup) you can:
   - **Change the hotkey.** Focus “段落快捷键”, press a combo that includes a modifier, then save so the new chord takes effect on article pages. macOS shows **⌥T** by default; Windows and Linux show **Alt+T**. Reset writes that platform default and uses the same label.
   - **Site lists.** A **never translate** origin does not get bilingual nodes from the popup, the ball, or the hotkey. **Always translate** is optional and auto-translates that origin on load. Deny wins if an origin is on both lists. A bare host matches that hostname on both http and https; a full URL is stored as its origin only. Subdomains are not included.
   - **Reading style.** Translation font size (small / standard / large), contrast (standard / high), and display (bilingual or translation-only). An already translated page updates without a reload.

Protocol, base URL, model, API key, languages, `paragraphHotkey`, `denyOrigins`, `allowOrigins`, and the reading-style keys are stored only in `chrome.storage.local`. Leave the key empty to keep the mock engine. The extension does not read `config.yaml`.

## Configure keys

Do not commit keys to the repository.

- **Browser extension:** enter the API key on the options page. It is written only to `chrome.storage.local` on this machine. Leave it empty to keep the mock (`⟦…⟧`). The extension does not read YAML.
- **Local Node / cloud acceptance:** copy the template to `config.local.yaml` and fill it in, or set `DEEPSEEK_BASE_URL` and `DEEPSEEK_API_KEY`.

```bash
cp config.yaml config.local.yaml
```

`config.yaml` is the committed template with an empty key (`apiKey: ""`). `config.local.yaml` is gitignored. Blank or whitespace-only environment variables do not override YAML. Merge order and the other variable names are in [Node and cloud config](#node-and-cloud-config) below.

## translate-core smoke test

```bash
cd packages/translate-core
npm run smoke
```

Expect JSON segments like `⟦原文⟧` and a final line `smoke ok`.

## Sync the vendor copy

MV3 service workers cannot import files outside the extension root. After editing `packages/translate-core/src/`:

```bash
./scripts/sync-translate-core.sh
```

Then reload the extension.

## MVP acceptance

The current extension version is **0.4.2** (`dev-0.4.2`). The checklist covers the original MVP checks, the hover hotkey, the 0.3.0 site lists and reading-style switches, the 0.4.0 toolbar popup and floating ball, the 0.4.1 whole-page chord capture, and this version's paragraph chord. `1.0.0` was withdrawn and is not current.

```bash
npm run accept
```

Checks: vendor sync with `packages/translate-core`; background imports that vendor and selects mock / OpenAI / Anthropic from options; mock batch `⟦…⟧`; package smoke; MV3 manifest (shell `0.4.2`, translate-core still `0.4.0`); options fields without login or paywall copy; paragraph hotkey canonical default `Alt+T` (macOS shows **⌥T**, Windows/Linux show **Alt+T**) and whole-page `Alt+A` (macOS **⌥A**), cancelled in the capture phase when it matches, with a single-segment `TRANSLATE_BATCH`; if the browser eats the paragraph chord, manifest command `translate-hovered-paragraph` still translates only the hovered paragraph and only when it matches the saved hotkey; no absolute local paths or key-shaped secrets in git files; `config.yaml` has an empty `apiKey`; `config.local.yaml` is gitignored; YAML merge precedence; `extension/` contains neither local YAML nor secrets.

After `npm run accept` passes, click through the list below on your machine. Load the extension as in [Install](#install) (the icon must be pinned to the toolbar).

### Local acceptance checklist

Leave the API key empty except for the last item. The options page should state that there is no forced login and no upgrade dialog.

- [ ] **Pin + popup:** load `extension/` and pin the icon as in [Install](#install). On an article page the icon opens the popup instead of toggling silently. With an empty API key the status line labels Mock mode. While untranslated the button reads **翻译 (⌥A)** on macOS or **翻译 (Alt+A)** on Windows/Linux. After a click, bilingual `⟦原文⟧` appears, the status is translated, and the button reads **显示原文**. Click again and the nodes disappear. The same chord toggles the page. **打开设置** opens the options page. The popup has no provider, model, key, login, Pro, or shortcut-grid controls.
- [ ] **Whole-page chord:** on an article page, with focus outside an editable field, **Alt+A** (Windows/Linux) or **⌥A** (macOS) toggles translate and restore, and stays in sync with the popup and the ball. Hovering a paragraph, **Alt+T** / **⌥T** still translates only that paragraph. Those chords do nothing while typing in a field. If the OS still takes the page chord, the popup button and the ball still toggle.
- [ ] **Floating ball:** it starts on the lower right and uses the same frosted glass as the popup. Drag and release; it snaps to the left or right edge and keeps the height where you let go. After refresh it is still there. One tap shares state with the popup. A small corner mark shows when the page is translated. A one-time tip card appears the first time; dismiss it with 知道了 or a click. On a never-translate origin the ball is not on the page.
- [ ] **Hover + paragraph chord, one segment:** hover one main-content paragraph (blue outline) and press **⌥T** on macOS or **Alt+T** on Windows/Linux. Only that paragraph gets a bilingual line. Pressing the chord again does not add a second block. Without a hover, that chord does not toggle the page.
- [ ] **Change the hotkey on the options page:** focus “段落快捷键”, press a combo that includes a modifier, and save. Hover another paragraph and use the new combo to translate only that segment; the previous Alt+T / ⌥T no longer does. On macOS the capture field and reset button show ⌥ / ⌘, not a hard-coded Alt+T default. Windows and Linux still show Alt+T. Reset writes that platform's default paragraph key back, and hovering then translates one segment with it again.
- [ ] **Never-translate blocks insertion:** after the current origin is added on the options page, the popup, the page chord, and the paragraph chord do not insert a translation, and the ball is hidden. Remove the origin and the ball returns. The popup only shows that the site is never translated; it does not edit `denyOrigins`.
- [ ] **Style applies immediately:** on an already translated page, change font size, contrast, or bilingual vs translation-only. The open page updates without a reload.
- [ ] **Optional real DeepSeek key:** keep the OpenAI-compatible protocol, paste your own DeepSeek key (default base / model is enough), and translate one page. The key stays in `chrome.storage.local` on this machine. There is no login or upgrade wall.

## Node and cloud config

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

## Branches and releases

Day-to-day remote branches are `main` and the current `dev-*`.

- Develop on `dev-*` (currently `dev-0.4.2`, extension version `0.4.2`)
- Merge into `main` when that stage is done
- Publish with a git tag and a GitHub Release. `v0.1.0` through `v0.3.0` already exist. `v1.0.0` was withdrawn. There is no long-lived `release-*` branch

Unfinished work stays on the current `dev-*` until that stage is merged into `main`.

## Security

- No API keys in the repository
- See [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)

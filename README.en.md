# ImmerTranslate

[中文](README.md)

Open-source MVP: bilingual (source + translation) reading for webpage main content. Chrome / Edge Manifest V3.

Inspired by immersive bilingual-translate extensions. This repo is an independent implementation with a small core and keys kept on the machine (no login wall in the MVP).

## Status

Early MVP. The current dev version is **1.0.0** (branch `dev-1.0.0`, matching `extension/manifest.json`). An earlier premature 1.0.0 label was withdrawn; this 1.0.0 only aligns the version for knives already shipped in 0.4.2–0.8.0. The latest published tag is still `v0.3.0`. With no API key, translation is a **mock** that wraps text as `⟦…⟧`. Saving a key on the options page selects an OpenAI-compatible or Anthropic-compatible engine. Defaults: provider `openai`, base `https://api.deepseek.com/v1`, model `deepseek-flash`. Extension keys stay in `chrome.storage.local`.

The toolbar icon opens a **popup** (`default_popup`) instead of toggling silently. The card keeps a status line (translated or not, plus a read-only Mock or engine sentence), a dual-state primary button **翻译** / **显示原文**, and **打开设置**. Under the primary button, two controls act on this page's origin: **本页加入永不翻译** and **本页加入始终翻译**. When the origin is already on that list, the same control reads **本页移出永不翻译** or **本页移出始终翻译**. The line above them shows the origin that will be stored. While the page is untranslated, the button uses the same formatter as the options page and puts the whole-page chord in parentheses: **翻译 (⌥A)** on macOS and **翻译 (Alt+A)** on Windows/Linux (not ⌘T, which opens a new tab). An empty API key is labeled **Mock mode** (`⟦原文⟧`). The popup does not show a login avatar, a Pro toggle, a promo banner, or a shortcut grid, and it does not edit the full site lists. A draggable **floating ball** starts on the lower right and shares the frosted-glass tokens in `extension/glass.css` (blur, radius, translucent fill, hairline, shadow) with the popup. One tap uses the same on/off state. After a translation, a small corner mark appears on the ball. A **站点** control above the ball opens the same two current-page actions as the popup. On release it snaps to the left or right edge and keeps its vertical position (`chrome.storage.local` `ballPosition` as `side` and `top`) across refresh. The first time, one non-blocking card sits beside the ball; dismiss it with 知道了 or a click. It is not shown again and does not mention login or payment. On first install, while `onboardingDone` is absent, a separate frosted-glass card sits at the top left. It has at most three skippable steps, in order: **钉到工具栏**, **点弹层译一页**, **认识悬浮球**. Skip a step, or choose 全部跳过 on the first two. 完成 on the last step, or skipping through, writes `onboardingDone` and the card stays gone until that key is removed or the extension is reinstalled. The ball tip does not appear while the guide is up, and it does not open on the same document that just dismissed the guide. Finishing after **认识悬浮球** also sets `ballTipSeen`, so the tip does not repeat that introduction. 全部跳过 before that step leaves `ballTipSeen` unset; the tip can still show once on a later page. The card has no login, terms checkbox, Pro offer, feature catalog, or token gift. To see it again, run `chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])` in the extension service worker console and reload the article page. On a deny-list origin the ball, including **站点**, is hidden. The full lists are added, edited, and removed on the options page. The popup and the ball only change the current page's row. Removing this page drops every stored row that matches it, both a bare host and an exact origin. The options page is a left nav and a right pane, five sections in order: **基本**, **快捷键**, **悬浮球**, **站点名单**, **引擎与密钥**. It reuses the `extension/glass.css` frosted-glass tokens rather than a solid white sheet, and the primary button stays a restrained blue. macOS and Windows share that one layout. The ball can be turned off (`ballEnabled`, default on); hiding it leaves `ballPosition` stored. The whole-page chord can be changed too (`pageHotkey`, default Alt+A, shown as **⌥A** on macOS) with the same platform formatter as the paragraph chord.

Hover a main-content paragraph and press the paragraph chord (changeable on the options page, stored as `paragraphHotkey`) to translate that one segment. The canonical chord is Option/Alt+T: macOS shows and stores **⌥T**, Windows and Linux show and store **Alt+T**. Whole-page toggle stays Option/Alt+A: **⌥A** on macOS, **Alt+A** on Windows and Linux (not Ctrl+A, which is select-all, and not ⌘T, which opens a new tab). On an article page, when focus is outside an editable field, that chord is matched on `window` / `document` `keydown` in the capture phase; a hit calls `preventDefault` and `stopPropagation` so the browser does not treat Alt+letter as a menu or accelerator. If a host still eats the `keydown` before the page sees it, the matching `keyup` runs that action once. Whole-page also has a manifest command (suggested Alt+A on every platform, ⌥A on macOS). Paragraph has its own (suggested Alt+T, ⌥T on macOS): it translates only the hovered paragraph, and only when that command shortcut still equals the saved `paragraphHotkey`. Changing the chord on the options page and saving, or clicking reset (which writes the platform default), takes effect. The paragraph command does not toggle the page. On a deny-listed origin the paragraph chord inserts nothing. The popup button and the floating ball do not depend on the hotkey; if the chord fails they still toggle and stay on the same page state. Options can mark an origin as **never translate** (`denyOrigins`, default empty so every site stays eligible) or **always translate** (`allowOrigins`), and can edit or remove an existing row. A denied origin does not get bilingual nodes from the popup, the ball, or the hotkey; deny wins if an origin is on both lists (a bare denied host also covers an allowed origin, and the reverse). The popup and the ball's **站点** control can add or remove the current page origin without typing. Reading style (`translationFontSize` `sm` / `md` / `lg`, `translationContrast` `normal` / `high`, `displayMode` `bilingual` or `translation-only`) is stored in `chrome.storage.local` and applies to an already open page without a reload.

Node and cloud acceptance read a gitignored local YAML file plus environment variables. The service worker wraps the selected engine once with translate-core `createPipelineEngine`; cache, retry, and rate limit are not reimplemented in the shell. `packages/translate-core` and the extension shell are both **1.0.0**. `extension/vendor` is synced from that package's `src` by `scripts/sync-translate-core.sh`, including `TranslateFailure` `kind` / `code` / `status`. `TranslateRequest` / `TranslateResponse` stay the same, and an empty key still selects the mock engine. When translate rejects, a frosted-glass toast at the top right of the page shows the message and the `kind`. The floating ball and the popup hint show the same sentence. The toast does not take clicks. There is no new protocol family and no login or Pro.

## Layout

```
extension/                 # Load this folder as an unpacked extension
  manifest.json
  background.js            # Message bus → translate engine
  glass.css                # Shared frosted-glass tokens for the popup, options page, ball, and failure toast
  options.css              # Options layout (uses glass.css tokens)
  popup.html / popup.js    # Toolbar popup: status line / dual-state button / this page / options
  hotkey.js                # Hotkey codec and per-OS labels (⌥ / Alt)
  sitelist.js              # Per-origin allow / deny matching
  ballpos.js               # Ball default position, clamp, and edge snap
  onboarding.js            # First-run three steps: order, skip, and ball-tip exclusion
  failtip.js               # Translate failure tip: message plus kind / code / status
  content.js / content.css # Paragraph detection, hover, bilingual DOM, ball, failure tip, first-run card, style attrs
  options.html / options.js
  vendor/translate-core/   # Synced copy of packages/translate-core/src (MV3)
packages/translate-core/   # TranslateRequest/Response + mockTranslate
  config/load.js           # Node-only YAML merge (not synced into the extension)
config.yaml                # Committed template, empty apiKey
scripts/sync-translate-core.sh
```

## Install

Extension version **1.0.0**. After you have the source, load it unpacked in Chrome or Edge.

1. Clone or download this repository.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `extension/` directory in the repo.
5. **Pin the extension icon to the toolbar.** If it is not pinned, open it from the Extensions menu (puzzle icon).

### From a GitHub Release (optional)

Versions are published as git tags and [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases), not as long-lived `release-*` branches. Existing tags: `v0.1.0`, `v0.1.1`, `v0.2.0`, `v0.2.1`, `v0.3.0`. The earlier `v1.0.0` tag was withdrawn. Later versions are tagged and released the same way.

1. Open the tag you want on Releases and download that tag's source (Source code).
2. Unpack it, then load its `extension/` folder with the steps above and pin the icon to the toolbar.

The current development line is `dev-1.0.0`. To follow that line, clone or download that branch and load its `extension/` folder.

## Use

On a first run the top-left card offers three skippable steps (**钉到工具栏**, **点弹层译一页**, **认识悬浮球**). The page stays usable: scroll, use the ball, or open the popup. Finishing, skipping through, or 全部跳过 writes `onboardingDone`. To show the card again, run `chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])` in the extension service worker console and reload.

1. Open an article page and click the toolbar icon to open the popup. The status line shows whether the page is translated and adds a Mock or engine sentence. With an empty API key it labels Mock mode and translations look like `⟦原文⟧`. The primary button switches between **翻译** and **显示原文**. While untranslated it reads **翻译 (⌥A)** on macOS or **翻译 (Alt+A)** on Windows/Linux, using the same formatter as the options page. The same chord toggles the page when focus is outside an editable field: **Alt+A** on Windows/Linux, **⌥A** on macOS. If the OS or browser still takes that chord, use the popup button or the ball; both share the page state with the hotkey. **打开设置** opens the options page. The ball on the lower right does the same tap; a small corner mark shows after translation. Drag it; on release it snaps to the left or right edge and keeps the vertical position. After a refresh it is still on that side at the same height. The first visit shows one tip card beside the ball. Dismiss it with 知道了 or a click.
2. Hover a paragraph in the main content (it picks up a blue outline) and press the default paragraph chord (**⌥T** on macOS, **Alt+T** on Windows/Linux) to translate only that segment. The line under the original uses the same bilingual style as the full-page toggle. Pressing the hotkey again on an already translated paragraph does nothing. If the browser eats the chord, the extension command still translates only that hovered paragraph and does not toggle the page.
3. The options page (extension details → Extension options, or **打开设置** in the popup) has five sections in the left nav and the matching pane on the right. Walk them after opening the page. The bottom **保存** writes the form. Font size, contrast, display mode, site lists, and the ball toggle write immediately and do not need that button.
   - **基本.** Target language, display (bilingual or translation-only), font size, and contrast. An already translated page updates without a reload. Source language is here too.
   - **快捷键.** Whole-page toggle and the paragraph chord. Focus the field, press a combo that includes a modifier, then save so the new chord takes effect on article pages. macOS shows **⌥** / **⌘** (defaults **⌥A** and **⌥T**). Windows and Linux show **Alt** / **Ctrl** (defaults **Alt+A** and **Alt+T**). Reset writes that platform default and uses the same label.
   - **悬浮球.** The toggle defaults to on. The note says the ball starts on the right edge, snaps to the left or right edge, and remembers its vertical position. Turning it off hides the ball on an open page and keeps the stored height; turning it on brings the ball back at that height.
   - **站点名单.** A **never translate** origin does not get bilingual nodes from the popup, the ball, or the hotkey. **Always translate** is optional and auto-translates that origin on load. Deny wins if an origin is on both lists. A bare host matches that hostname on both http and https; a full URL is stored as its origin only. Subdomains are not included. Each row can be edited or removed. Adds, edits, and removals save immediately and survive a reload. The popup and the ball's **站点** control can add or remove the current page origin in one step.
   - **引擎与密钥.** OpenAI-compatible and Anthropic-compatible fields only. An empty API key is labeled mock, and translations look like `⟦原文⟧` (`⟦…⟧`). There is no login or paywall.

Protocol, base URL, model, API key, languages, `pageHotkey`, `paragraphHotkey`, `ballEnabled`, `denyOrigins`, `allowOrigins`, and the reading-style keys are stored only in `chrome.storage.local`. Leave the key empty to keep the mock engine. The extension does not read `config.yaml`.

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

The current extension version is **1.0.0** (`dev-1.0.0`). The checklist covers the original MVP checks, the hover hotkey, the 0.3.0 site lists and reading-style switches, the 0.4.0 toolbar popup and floating ball, the 0.4.1 whole-page chord capture, the 0.4.2 paragraph chord, the 0.5.0 five-section options page, the 0.6.0 three-step first-run card, the 0.7.0 editable site lists plus one-click current-page add, and the 0.8.0 visible translate-failure tip (vendor synced with translate-core). This version only aligns the version string.

```bash
npm run accept
```

Checks: vendor sync with `packages/translate-core` (shell and package are both `1.0.0`); background imports that vendor and selects mock / OpenAI / Anthropic from options; mock batch `⟦…⟧`; package smoke; MV3 manifest (shell `1.0.0`, translate-core `1.0.0`); a rejected translate forwards `kind` / `code` / `status` and the message to the page toast, the ball, and the popup, while an empty key stays on mock; site lists can be edited, and the popup and ball can add or remove the current page origin, with deny winning when both lists match; the first-run card is exactly three skippable steps and does not chain with the one-time ball tip; the five options sections and frosted-glass tokens, without login or paywall copy; paragraph hotkey canonical default `Alt+T` (macOS shows **⌥T**, Windows/Linux show **Alt+T**) and whole-page `Alt+A` (macOS **⌥A**), cancelled in the capture phase when it matches, with a single-segment `TRANSLATE_BATCH`; if the browser eats the paragraph chord, manifest command `translate-hovered-paragraph` still translates only the hovered paragraph and only when it matches the saved hotkey; no absolute local paths or key-shaped secrets in git files; `config.yaml` has an empty `apiKey`; `config.local.yaml` is gitignored; YAML merge precedence; `extension/` contains neither local YAML nor secrets.

After `npm run accept` passes, click through the list below on your machine. Load the extension as in [Install](#install) (the icon must be pinned to the toolbar).

### Local acceptance checklist

Leave the API key empty except for the failure-tip check and the last item. The options page should state that there is no forced login and no upgrade dialog.

- [ ] **First-run card:** in the extension service worker console run `chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])` and reload an article page. A frosted-glass card appears at the top left with only three steps: 钉到工具栏, 点弹层译一页, 认识悬浮球. The page still scrolls; the ball still clicks; the popup still opens. There is no login, terms checkbox, Pro offer, or pink primary button. **Skip path:** click 跳过 three times. The card leaves. Reload: the card stays gone, and the ball tip does not open on that same reload. **Complete path:** clear both keys again and reload, then click 下一步, 下一步, 完成. Same result as the skip path. **Skip the rest:** clear both keys again, reload, and click 全部跳过 on step one. This page shows no ball tip. Reload once more: the guide stays gone, and the ball tip appears once. Dismiss it with 知道了 and reload: neither card returns.
- [ ] **Pin + popup:** load `extension/` and pin the icon as in [Install](#install). On an article page the icon opens the popup instead of toggling silently. With an empty API key the status line labels Mock mode. While untranslated the button reads **翻译 (⌥A)** on macOS or **翻译 (Alt+A)** on Windows/Linux. After a click, bilingual `⟦原文⟧` appears, the status is translated, and the button reads **显示原文**. Click again and the nodes disappear. The same chord toggles the page. **打开设置** opens the options page. The popup has no provider, model, key, login, Pro, or shortcut-grid controls. It does have **本页加入永不翻译** and **本页加入始终翻译**, and it does not edit the full lists.
- [ ] **Whole-page chord:** on an article page, with focus outside an editable field, **Alt+A** (Windows/Linux) or **⌥A** (macOS) toggles translate and restore, and stays in sync with the popup and the ball. Hovering a paragraph, **Alt+T** / **⌥T** still translates only that paragraph. Those chords do nothing while typing in a field. If the OS still takes the page chord, the popup button and the ball still toggle.
- [ ] **Floating ball:** it starts on the lower right and uses the same frosted glass as the popup. Drag and release; it snaps to the left or right edge and keeps the height where you let go. After refresh it is still there. One tap shares state with the popup. A small corner mark shows when the page is translated. A one-time tip card appears the first time; dismiss it with 知道了 or a click. **站点** above the ball opens **本页加入永不翻译** and **本页加入始终翻译**. On a never-translate origin the ball is not on the page, and neither is **站点**.
- [ ] **Hover + paragraph chord, one segment:** hover one main-content paragraph (blue outline) and press **⌥T** on macOS or **Alt+T** on Windows/Linux. Only that paragraph gets a bilingual line. Pressing the chord again does not add a second block. Without a hover, that chord does not toggle the page.
- [ ] **Change the hotkey on the options page:** focus “段落快捷键”, press a combo that includes a modifier, and save. Hover another paragraph and use the new combo to translate only that segment; the previous Alt+T / ⌥T no longer does. On macOS the capture field and reset button show ⌥ / ⌘, not a hard-coded Alt+T default. Windows and Linux still show Alt+T. Reset writes that platform's default paragraph key back, and hovering then translates one segment with it again.
- [ ] **Current page and deny-wins:** on an article page open the popup (or **站点** on the ball) and choose **本页加入永不翻译**. The status becomes 本站永不翻译, the primary button cannot translate, the page chord and the paragraph chord insert nothing, and the ball leaves the page. Reload: it stays that way. Open the popup again and choose **本页移出永不翻译**. The ball returns and the page can be translated. Then choose **本页加入始终翻译**. This page, or a reload, should translate on its own. Choose **本页加入永不翻译** again while the allow row is still there: the page stays untranslated, and the popup says deny wins. On the options page the allow row is marked as covered by never-translate. Edit one host to a different host and reload: the list shows the new value. After removal, neither list matches the page.
- [ ] **Five options sections:** open settings. The left side is 基本, 快捷键, 悬浮球, 站点名单, then 引擎与密钥, with the matching pane on the right. The page is frosted glass, not solid white, and the primary button is blue. In 基本, changing font size or bilingual vs translation-only updates an already translated page at once. Hotkey labels follow the machine (⌥/⌘ or Alt/Ctrl). Turning the ball off removes it from the page; turning it on brings it back at the remembered height. The site list can still add a never-translate origin. An empty key in 引擎与密钥 is labeled mock `⟦…⟧`. There is no login or paywall. Reload the options page and the saved values are still there.
- [ ] **Style applies immediately:** on an already translated page, change font size, contrast, or bilingual vs translation-only. The open page updates without a reload.
- [ ] **Visible translate failure:** on the options page, under 引擎与密钥, set a non-empty fake API key (for example `not-a-real-key`) and change Base URL to the unreachable address `https://127.0.0.1:9`, then save. On an article page, start a translation from the popup **翻译** button, the floating ball, or the whole-page chord. After the request fails (the pipeline may retry briefly) a frosted-glass toast appears at the top right. It does not block scrolling or clicks. The text includes the failure message and a `kind` (unreachable host is `network`). The popup hint and the ball show the same sentence. Then clear the API key, save, and translate the page again: paragraphs show `⟦原文⟧` and the failure toast does not return.
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

- Develop on `dev-*` (currently `dev-1.0.0`, extension version `1.0.0`)
- Merge into `main` when that stage is done
- Publish with a git tag and a GitHub Release. `v0.1.0` through `v0.3.0` already exist. The earlier `v1.0.0` tag was withdrawn. There is no long-lived `release-*` branch

Unfinished work stays on the current `dev-*` until that stage is merged into `main`.

## Security

- No API keys in the repository
- See [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)

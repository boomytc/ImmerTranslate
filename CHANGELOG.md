# Changelog

## 1.0.1

- The floating ball's primary click uses the same dual-state page machine as the popup CTA. Untranslated runs `TRANSLATE_PAGE`; translated runs `RESTORE_PAGE`. Both use the content script's `active` flag, which `GET_PAGE_STATE` and the ball indicator already use. An open popup listens for `PAGE_STATE` and re-reads that flag, so the CTA stays aligned with the ball. The ball does not show text buttons 「翻译」 or 「显示原文」.
- The ball hover title follows that state and the saved page chord, with the same formatter as the popup and the options page. Untranslated macOS reads 「点击翻译为简体中文 (⌥A)」; Windows and Linux use Alt+A. Translated reads 「已翻译 · 点击显示原文」 plus that chord. A small 「打开弹层」 control opens the toolbar popup when the browser allows it, otherwise the options page the popup already opens. It does not embed the popup card.
- `extension/manifest.json` version is `1.0.1`. Root status lines name `dev-1.0.1`. `packages/translate-core` stays `1.0.0`; `TranslateRequest` / `TranslateResponse` and engines are unchanged. No login, Pro, or banner.

## 1.0.0

- Version alignment only. `extension/manifest.json` version is `1.0.0`. `packages/translate-core` package version is `1.0.0`. `TranslateRequest` / `TranslateResponse` and translate-core behavior are unchanged. No new engine, login, Pro, or banner. Knives already shipped in 0.4.2–0.8.0 stay as they are.
- Root status lines name `dev-1.0.0`.
- No functional change.

## 0.8.0

- Shell version in `extension/manifest.json` is `0.8.0`. `extension/vendor/translate-core` is the copy of `packages/translate-core` `0.8.0` produced by `scripts/sync-translate-core.sh`. `TranslateRequest` / `TranslateResponse` are unchanged. An empty API key still uses the mock `⟦…⟧` engine. There is no new protocol family and no login or Pro.
- When translate rejects, the service worker answers `TRANSLATE_BATCH` with `ok: false`, `error` (the message), `kind`, `code`, and `status`. The content script keeps those fields on the reply to the popup. A frosted-glass toast (`#immer-fail-host`, shared `extension/glass.css` tokens, no pointer events, auto-dismiss) shows the message and the kind on the page. The floating ball shows the same sentence, and the popup hint line does too. The page stays scrollable and clickable. Clearing the API key returns to mock `⟦…⟧`.
- Root status lines name `dev-0.8.0`.

## 0.7.0

- The options **站点名单** section can add, edit, and remove rows on both **永不翻译** (`denyOrigins`) and **始终翻译** (`allowOrigins`). Edit replaces one stored entry in place. Adds, edits, and removals write `chrome.storage.local` immediately and still apply on refresh. The five-section frosted-glass options layout is unchanged. There is no site-adapter catalog and no copied default rule dump.
- The toolbar popup adds two labeled controls for the current page origin: **本页加入永不翻译** and **本页加入始终翻译**. When that origin is already on the list, the same control reads **本页移出永不翻译** or **本页移出始终翻译**. The line above them shows the origin that will be stored. The popup still does not edit the full lists, and it still has no login, Pro, promo, or shortcut grid. The floating ball keeps its tap-to-translate behavior and adds a **站点** control. That opens the same two labels for this page. On a deny-listed origin the ball, including that control, stays hidden; removal stays available from the popup and the options page.
- Deny still wins when a page matches both lists (`ImmerSites.sitePolicy`: `blocked` when denied, `auto` only when allowed and not denied). A bare host on the deny list covers an origin on the allow list, and the reverse. Removing the current page drops every stored row that matches it, so a bare host and an exact origin are both cleared. An empty deny list still leaves every site eligible. Empty API key stays on the mock `⟦…⟧` engine.
- `extension/manifest.json` version is `0.7.0`. Root status lines name `dev-0.7.0`. `packages/translate-core` stays `0.4.0`; its contract, pipeline, and `src` are unchanged.

## 0.6.0

- First install shows one lightweight card, at most three skippable steps, in order: 钉到工具栏, 点弹层译一页, 认识悬浮球. Each step has 下一步 / 跳过; the last step uses 完成. 全部跳过 dismisses the rest. Finishing or skipping through the end writes `chrome.storage.local` `onboardingDone`, and the card does not return until that key is removed or the extension storage is cleared (reinstall). The card is a frosted-glass overlay (`extension/glass.css`, primary button in the `#1f4e9a` family). It does not cover the page, so scrolling, the popup, and the floating ball keep working. There is no login, terms checkbox, Pro offer, feature catalog, or token gift, and no immersive-translate pink.
- The card does not fight the existing one-time ball tip. While the guide is pending or visible, the tip stays hidden. Dismissing the guide on this document does not open the tip immediately. Reaching 认识悬浮球 and then finishing or skipping that step also sets `ballTipSeen`, so the tip does not repeat the same introduction. 全部跳过 before that step leaves `ballTipSeen` unset; the tip can still appear once on a later page.
- `extension/manifest.json` version is `0.6.0`. Root status lines name `dev-0.6.0`. `packages/translate-core` stays `0.4.0`; its contract, pipeline, and `src` are unchanged.

## 0.5.0

- Options page is a left nav and a right content pane, one layout on macOS and Windows. Five sections, in order: 基本 (target language, bilingual or translation-only, font size, contrast), 快捷键 (whole-page and paragraph chords, labeled with the same platform formatters already used by the popup: ⌘/⌥ on macOS, Ctrl/Alt on Windows and Linux), 悬浮球 (enable toggle plus a short note: right edge, snap, remembered vertical position), 站点名单 (the existing allow/deny UI), 引擎与密钥 (OpenAI-compatible and Anthropic-compatible fields only). An empty API key stays on the labeled mock `⟦…⟧` engine. There is no login wall and no paywall.
- The page uses `extension/glass.css` tokens (frosted fill, blur, radius, hairline, shadow) instead of a solid white sheet. The primary action stays in the `#1f4e9a` family.
- Style switches still write through immediately and update an open translated page without reload. Site-list edits still save immediately. `pageHotkey` (default Alt+A, shown as ⌥A on macOS) is stored beside `paragraphHotkey` and drives the in-page chord. `ballEnabled` defaults to true; turning it off hides the ball and leaves `ballPosition` in place.
- `extension/manifest.json` version is `0.5.0`. Root status lines name `dev-0.5.0`. `packages/translate-core` stays `0.4.0`; its contract, pipeline, and `src` are unchanged.

## 0.4.2

- Paragraph translate stays Option/Alt+T (macOS **⌥T**, Windows/Linux **Alt+T**). Hover a main-content paragraph and the chord still translates only that segment; a second press does not insert another block. The in-page listener remains capture-phase `keydown` / `keyup` on `window` and `document`. `chrome.commands` now also suggests Alt+T (`translate-hovered-paragraph`) so a browser that eats the key messages the active tab. The command translates that paragraph only when its shortcut still matches the saved `paragraphHotkey`, so an options-page change and 「恢复默认」 stay in effect. If the menu clears the hover before the message arrives, the paragraph the pointer was just on is still the target. The command does not toggle the page. On a deny-listed origin the paragraph chord does not insert a translation. Whole-page Alt+A, the popup, and the floating ball are unchanged.
- `extension/manifest.json` version is `0.4.2`. Root status lines name `dev-0.4.2`. `packages/translate-core` stays `0.4.0`; its contract, pipeline, and `src` are unchanged.

## 0.4.1

- Whole-page translate stays Option/Alt+A (macOS **⌥A**, Windows/Linux **Alt+A**). It is no longer only a `document` `keydown` listener. `window` and `document` both listen in the capture phase; when the chord matches and focus is outside an editable field, the handler calls `preventDefault` and `stopPropagation` so the browser does not keep the key as a menu or accelerator. If that `keydown` never arrives, the matching `keyup` toggles once. `chrome.commands` suggests Alt+A on every platform (Option+A on macOS) and messages the active tab with `TOGGLE_TRANSLATE`, the same path as the in-page chord. Paragraph Option/Alt+T is unchanged. The popup CTA and the floating ball still share `setTranslated` and work when the chord cannot fire. Default is not Ctrl+A or ⌘T.
- `extension/manifest.json` version is `0.4.1`. Root status lines name `dev-0.4.1`. `packages/translate-core` stays `0.4.0`; its contract, pipeline, and `src` are unchanged.

## 0.4.0

- Toolbar action opens `default_popup` (`extension/popup.html`) instead of a silent toggle. The skeleton is a status line, a dual-state primary button (**翻译** / **显示原文**), and **打开设置**. The status line names Mock mode when the API key is empty (`⟦原文⟧`) or the current engine plus languages when a key is set. The popup does not show login, Pro, a promo banner, a shortcut grid, or site-list edits. Never-translate stays on the options page; a denied origin still disables the button and reports that state.
- The popup and the floating ball share one frosted-glass sheet (`extension/glass.css`): blur, radius, translucent fill, hairline, and shadow. There is no per-OS stylesheet. The primary button is a solid emphasis control and does not use the immersive-translate pink.
- A draggable floating ball starts on the lower right and shares the same translate/restore state as the popup. On release it snaps to the left or right edge and keeps the vertical position (`chrome.storage.local` `ballPosition`: `{ side, top }`). A small corner mark shows while the page is translated. The first time, one non-blocking card beside the ball explains it; dismiss with 知道了 or a click. It is not shown again and does not mention login or payment. On a deny-list origin the ball is hidden.
- `extension/manifest.json` version is `0.4.0`. Root status lines name `dev-0.4.0`. Paragraph translate stays Option/Alt+T and whole-page translate is Option/Alt+A (not Command+T). macOS shows and stores **⌥T** / **⌥A**; Windows and Linux keep **Alt+T** / **Alt+A**. Deny/allow lists, style switches, and one `createPipelineEngine` wrapper stay. Empty API key still uses the mock `⟦…⟧` engine. `packages/translate-core` is package version `0.4.0`; its contract and `src` are unchanged, and `extension/vendor` is the synced copy of that `src`. Acceptance reads the Chinese README phrases 「加载已解压的扩展程序」 and 「钉到工具栏」.

## 1.0.0（已撤回的过早标号）

- The premature `1.0.0` label was withdrawn: that cut had no productized popup or floating ball. Latest published tag remains `v0.3.0`. The line then continued through `0.8.0` on `dev-0.8.0` before this alignment.

## 0.3.0

- Per-origin site lists in `chrome.storage.local`: `denyOrigins` (never translate; default empty, so every site stays eligible) and optional `allowOrigins` (always translate on load). The icon toggle and Alt+T do not insert bilingual nodes on a denied origin. Deny wins if an origin is on both lists.
- Reading style switches apply to an open page without reload: translation font size (`sm` / `md` / `lg`), contrast (`normal` / `high`), and `displayMode` (`bilingual` under the original, or `translation-only`).
- Options page can add the current tab's origin and edit both lists. Empty API key still uses the mock `⟦…⟧` engine. translate-core is unchanged.

## 0.2.1

- Version and docs alignment only: `extension/manifest.json` version is `0.2.1`
- Root README notes the current dev version `0.2.1`, and that first-time users should pin the extension icon to the Chrome toolbar (otherwise open it from the Extensions menu)
- No functional change

## 0.2.0

- Hover a main-content paragraph to mark it; default hotkey **Alt+T** translates that single segment through `TRANSLATE_BATCH`
- Options page can change the hotkey (`chrome.storage.local` key `paragraphHotkey`); empty API key still uses the mock `⟦…⟧` engine
- Full-page action-icon toggle is unchanged, and the single-segment line uses the same bilingual DOM style
- Service worker wraps the selected engine once with `createPipelineEngine`; cache, retry, and rate limit stay in translate-core

## translate-core 0.2.0

- Paragraph cache, retry with backoff, and rate limit via `withCache` / `withRetry` / `withRateLimit` / `createPipelineEngine`
- `TranslateRequest` / `TranslateResponse` unchanged

## 0.1.1

- Version and docs alignment only: `extension/manifest.json` version is `0.1.1`
- Root README notes the current dev version `0.1.1`
- No functional change

## 0.1.0

- Initial MVP shell: MV3 extension + translate-core mock engine
- Bilingual paragraph overlay with toggle via extension action
- Options page stores protocol, base URL, model, API key, and languages in `chrome.storage.local` only
- Empty API key keeps the mock engine; a key selects the OpenAI-compatible or Anthropic-compatible engine (default DeepSeek `deepseek-flash`)
- Node/cloud: gitignored `config.local.yaml` merged over `config.yaml`, then environment variables; extension stays on `chrome.storage`

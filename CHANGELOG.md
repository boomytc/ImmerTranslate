# Changelog

## 0.4.0

- Toolbar action opens `default_popup` (`extension/popup.html`) instead of a silent toggle. The card translates the whole page, restores (clears) translations, shows whether this page is translated, and opens the options page. An empty API key is labeled Mock mode (`⟦原文⟧`). One click can add the current origin to `denyOrigins` (永不翻译本站). The popup is not a full settings page.
- A draggable floating ball on the page (default bottom-right) shares the same translate/restore state as the popup. Dragging near an edge snaps to that edge. The position is stored in `chrome.storage.local` as `ballPosition` and restored after refresh. On a deny-list origin the tap does not insert a translation and shows 「本站已设为永不翻译」.
- `extension/manifest.json` version is `0.4.0`. Root status lines name `dev-0.4.0`. Hover + Alt+T, deny/allow lists, style switches, and one `createPipelineEngine` wrapper are unchanged. Empty API key still uses the mock `⟦…⟧` engine. `packages/translate-core` is package version `0.4.0`; its contract and `src` are unchanged, and `extension/vendor` is the synced copy of that `src`. Acceptance reads the Chinese README phrases 「加载已解压的扩展程序」 and 「钉到工具栏」.

## 1.0.0（已撤回，不是当前版本）

- The premature `1.0.0` label was withdrawn: that cut had no productized popup or floating ball. It is not the current version. Latest published tag remains `v0.3.0`. Current extension version is `0.4.0` on `dev-0.4.0`.

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

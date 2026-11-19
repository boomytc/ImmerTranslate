<p align="center">
  <img src="public/images/logo128.png" alt="ImmerTranslate" width="96" height="96">
</p>

<h1 align="center">ImmerTranslate</h1>

<p align="center">A bilingual translation extension for Chrome and Edge on desktop: read original and translated text together, use free or bring-your-own-key services, and keep your data local.</p>

<p align="center">
  <a href="https://github.com/boomytc/ImmerTranslate/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/boomytc/ImmerTranslate?label=release"></a>
  <img alt="License GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue">
  <img alt="Supports Chrome and Edge" src="https://img.shields.io/badge/works%20on-Chrome%20%7C%20Edge-informational">
</p>

<p align="center">
  <a href="README.md">中文</a>
</p>

## Why ImmerTranslate

- **Bilingual reading.** After translating a page, each translation appears right below its original paragraph, keeping the original layout and links intact. You can also switch to **Show Only Translations**.
- **Works out of the box.** Keyless services such as Microsoft and Google work immediately after installation with no account required.
- **Bring your own key, direct connection.** Enter your own LLM or cloud translation API keys. Keys stay in your browser's local extension storage, and requests go directly to the endpoint you configure.
- **Built for more than whole pages.** In addition to whole-page translation, it covers text selection, paragraph hover, web input boxes, and YouTube desktop bilingual subtitles.
- **Per-site preferences.** Set any site to auto-translate or never auto-translate, and keep the translation service chosen for that site. Other sites follow the global rule.

## What it does

| Scenario           | Details                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole page         | Translate the current page via the toolbar popup, floating button, or shortcut (default `Alt+Q`). Long pages load in batches as you scroll, and you can switch to **Show Only Translations**.                                          |
| Selection & text   | Select text and click the popup button (or open the panel directly) to view translations, look up words, copy, or read aloud. The toolbar popup also provides **Text translation** and a separate window.                              |
| Paragraph (hover)  | Once enabled under **Paragraph translation**, hover with a shortcut key or hold the left mouse button to translate a paragraph or section inline or in a translation bubble.                                                           |
| Input box          | Translate text in web input fields in place via the input translation icon, shortcut (default `Alt+I`), or a trailing trigger sign (such as `/`).                                                                                      |
| Video subtitles    | Bilingual subtitles on the YouTube desktop website, with built-in or optional AI sentence segmentation, custom styling, and subtitle export.                                                                                           |
| Floating button    | Toggle page translation, switch between bilingual and translation-only, change service, model, target language, or style, set site auto-translate, or hide on the current site. The service chosen for the current site is remembered. |
| Rules and glossary | Follows **Personal rule > Built-in site rule > Global rule**, with a visual **Site rule editor**, CSS selector inheritance (`+`/`-`), and regex or AI glossaries.                                                                      |
| Data sync          | Sync settings and rules via WebDAV (default) or a private GitHub Gist, encrypted with your sync encryption passphrase before upload.                                                                                                   |

Supported platforms: Chrome and Edge desktop browsers (Manifest V3 extension; current codebase baseline version is 0.2.0). Interface languages: English and 简体中文.

## Translation services

- **No key needed:** **Microsoft** and **Google** are enabled by default. Additional keyless presets — **DeepLFree**, **YandexFree**, **Tencent**, **Volcengine**, and browser built-in AI (**BuiltinAI**, requires Chrome 138+ with Translation API enabled in `chrome://flags`) — can be enabled in Settings.
- **Bring your own key (LLMs):** Includes presets for **OpenAI**, **Claude** (Anthropic), **Gemini** / **Gemini (OpenAI 兼容)**, **DeepSeek**, **OpenCodeGo**, **SiliconFlow**, **XiaomiMimo**, **AliyunBailian** (DashScope), **ModelScope**, **ModelBest**, **Cerebras**, **Zai**, **OpenRouter**, **OrcaRouter**, **Requesty**, **ePhoneAI**, and **APIMart**, plus local **Ollama** (optional key) or other compatible endpoints.
- **Bring your own key (Translation APIs & Custom):** Includes **DeepL**, **GoogleCloud**, **AzureAI**, **Yandex**, **QwenMT**, and **CloudflareAI**, plus self-hosted or local **DeepLX** (optional key), and **Custom** endpoints with Request/Response Hooks for other protocols (see [custom-api.md](custom-api.md)).

All preset services except Microsoft and Google start disabled. Open **Translation services** in the extension settings, turn off **Is Disabled** for the service you want (and for keyed services, enter your API key and adjust the URL or model if needed), save, and select it for your scenario. LLM translation requests keep thinking mode disabled by default. See [docs/BYOK.md](docs/BYOK.md) for setup details.

## Install

The extension is not listed on browser stores yet. Download the package for your browser from [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases/latest):

| Browser | Release file                            | How to install                                                                                                                                                             |
| ------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome  | `immer-translate_v<version>_chrome.zip` | Unzip the archive, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the extracted `chrome` folder (containing `manifest.json`). |
| Edge    | `immer-translate_v<version>_edge.zip`   | Unzip the archive, open `edge://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the extracted `edge` folder (containing `manifest.json`).     |

Click the extension icon in your browser toolbar to start; you can try the default Microsoft or Google service right away.

Because the extension is loaded unpacked, it does not update automatically. To update, download the new release archive, unzip it to replace the old directory (or load the new folder), and reload the extension on your browser's extensions page.

## Build from source

Requires Node.js 24 and pnpm (pinned to pnpm 9.14.4 in this repository).

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome   # Build Chrome only into build/chrome
pnpm build          # Sync version and build both Chrome and Edge into build/chrome and build/edge
```

After building, load `build/chrome` or `build/edge` as an unpacked extension using the steps above.

For full local verification or releasing:

- `pnpm check` (or `pnpm check -- v0.2.0` to check all changes since a given tag or commit): checks for leftover test files or disallowed workflows, validates formatting, version files, and `CHANGELOG.md`, builds and zips the Chrome and Edge packages, and verifies artifact manifests and SHA-256 checksums.
- `pnpm release -- --dry-run` and `pnpm release`: used by maintainers on a clean `main` branch matching `origin/main`. It builds in an isolated temporary worktree, saves verified artifacts under `dist-release/`, creates and pushes an annotated version tag, and publishes the Chrome/Edge zip packages and provenance manifest to GitHub Releases via GitHub CLI (`gh`) (this repository does not use GitHub Actions).

See [AGENTS.md](AGENTS.md) for contributor and repository conventions, [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) for versioning and release steps, and [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

This project is a derivative of a GPL-3.0 open-source project and is released under [GPL-3.0](LICENSE) as well. If you distribute a modified build, keep the license and provide the corresponding source.

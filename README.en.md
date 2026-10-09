<p align="center">
  <img src="public/images/logo128.png" alt="ImmerTranslate" width="96" height="96">
</p>

<h1 align="center">ImmerTranslate</h1>

<p align="center">A bilingual web-page translation extension. Read the original and the translation side by side, use your own services and keys, and keep your data on your machine.</p>

<p align="center">
  <a href="https://github.com/boomytc/ImmerTranslate/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/boomytc/ImmerTranslate?label=release"></a>
  <img alt="License GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue">
  <img alt="Chrome, Edge, Firefox, Thunderbird, userscript" src="https://img.shields.io/badge/works%20on-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Thunderbird%20%7C%20userscript-informational">
</p>

<p align="center">
  <a href="README.md">中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

## Why ImmerTranslate

- **Side-by-side reading.** After you translate a page, each translation sits right under its original paragraph. Layout and links stay as they were. You can also show the translation only.
- **Works without a key.** Free services such as Google and Microsoft work right after install, with no account.
- **Bring your own key.** For large language models, enter your own key. It stays in the extension's local storage and never passes through a third party.
- **More than whole pages.** Selected text, hover, input boxes, and video subtitles each have their own entry point.
- **Remembers each site.** Set a site to auto-translate or never translate. Every other site follows the global setting.

## What it does

| Scenario           | Details                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Whole page         | Translate the current page with one click or a shortcut. Long pages are requested in batches.                        |
| Selection          | Select text, click the button, and read, copy, or listen to the translation in a panel.                              |
| Hover              | Rest the pointer on a paragraph to get a translation bubble.                                                         |
| Input box          | Write in an input box and translate it into the target language in place.                                            |
| Video subtitles    | Bilingual subtitles for YouTube.                                                                                     |
| Floating ball      | Switch between bilingual and translation-only, change service and model, and set how the current site is translated. |
| Rules and glossary | Save translation rules per site, subscribe to rule lists, and use a glossary.                                        |
| Sync               | Encrypted settings can be synced, for example over WebDAV.                                                           |

Interface languages: English, 简体中文, 繁體中文, 日本語, 한국어, Türkçe, Tiếng Việt, Русский.

## Translation services

- **No key needed:** Google, Microsoft, the DeepL and Yandex web endpoints, and the browser's built-in AI where your browser supports it.
- **Bring your own key:** LLM services such as OpenAI, Anthropic (Claude), DeepSeek, MiMo, DashScope, ModelScope, and ModelBest; translation APIs such as DeepL, Google Cloud, Azure, Baidu, Tencent, and Volcengine; and any custom OpenAI-compatible endpoint.

Preset LLM services start disabled. Enable one in Options, then fill in the base URL, key, and model. Translation requests keep thinking mode off by default. See [docs/BYOK.md](docs/BYOK.md) for details.

## Install

The extension is not on the browser stores yet. Download the package for your browser from [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases/latest):

| Browser     | File                                        | How to install                                                                       |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Chrome      | `immer-translate_<version>_chrome.zip`      | Unzip, open `chrome://extensions`, turn on Developer mode, and choose Load unpacked. |
| Edge        | `immer-translate_<version>_edge.zip`        | Unzip, open `edge://extensions`, turn on Developer mode, and choose Load unpacked.   |
| Firefox     | `immer-translate_<version>_firefox.zip`     | Open `about:debugging` and choose Load Temporary Add-on.                             |
| Thunderbird | `immer-translate_<version>_thunderbird.zip` | Install from file in the Add-ons Manager.                                            |
| Userscript  | `immer-translate_<version>_userscript.zip`  | Unzip and install `immer-translate.user.js` in Tampermonkey or a similar manager.    |

Click the toolbar icon to start. On first run you can try a free service straight away.

## Build from source

Requires Node.js 24 and pnpm.

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

The output is in `build/chrome`; load it as described above. `pnpm build` builds every client at once and `pnpm test` runs the unit tests. See [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md) for the release process and [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

## License

This project is a derivative of a GPL-3.0 open-source project and is released under [GPL-3.0](LICENSE) as well. If you distribute a modified build, keep the license and provide the corresponding source.

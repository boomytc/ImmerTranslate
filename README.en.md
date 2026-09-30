# ImmerTranslate

[中文](README.md)

ImmerTranslate is a bilingual web-page translation extension. Repository: [boomytc/ImmerTranslate](https://github.com/boomytc/ImmerTranslate). License: GPL-3.0.

Lineage only (not this product's name): [fishjar/kiss-translator](https://github.com/fishjar/kiss-translator), [fishjar/kiss-rules](https://github.com/fishjar/kiss-rules).

## Load

Node.js and pnpm are required.

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

`pnpm build` writes the same folder. In Chrome, open `chrome://extensions`, turn on Developer mode, choose Load unpacked, and select `build/chrome` (it should contain `manifest.json`).

## BYOK

Preset services ship without keys. Keys stay in the extension's local storage and must not be committed. These presets start disabled. Enable one in Options, then fill the base URL, key, and model:

- OpenAI
- Anthropic (preset name Claude)
- DeepSeek
- MiMo (preset name XiaomiMimo)
- DashScope (preset name AliyunBailian)
- ModelScope

Test connection calls `fetchModelCatalog` only. It lists models and does not send a chat/completions request.

Translate requests leave thinking / reasoning off by default (`thinkingMode` is `disabled`, so no thinking parameter is sent).

## Shell behavior in this tree

- Bilingual page translation.
- FAB quick menu:
  - Translation display: bilingual, or translation only.
  - Model for the current engine. There is no second model list.
  - This site's auto-translate, three states: follow global, auto-translate, don't auto-translate (the personal rule's `transOpen`).
  - Translation service: only providers that are enabled and have a non-empty key. If none are configured, that slot shows an empty state and opens Options `#/apis`. When the current service requires a key and the key is empty, the FAB and popup show the same empty state and do not present translation as finished. Choosing one sends `MSG_TRANS_PUTRULE` and writes `apiSlug` on the current site's page rule. It does not change the Options global default. Keyless engines (Microsoft, Google, built-in) keep working.
- UI languages: Simplified Chinese (`zh`) and English (`en`).

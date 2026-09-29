# Changelog

## 0.1.0

- Initial MVP shell: MV3 extension + translate-core mock engine
- Bilingual paragraph overlay with toggle via extension action
- Options page stores protocol, base URL, model, API key, and languages in `chrome.storage.local` only
- Empty API key keeps the mock engine; a key selects the OpenAI-compatible or Anthropic-compatible engine (default DeepSeek `deepseek-flash`)

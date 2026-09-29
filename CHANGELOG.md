# Changelog

## translate-core 0.2.0

- Paragraph cache, retry with backoff, and rate limit via `withCache` / `withRetry` / `withRateLimit` / `createPipelineEngine`
- `TranslateRequest` / `TranslateResponse` unchanged. Extension manifest stays `0.1.1`; ExtForge wraps the vendored engine once

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

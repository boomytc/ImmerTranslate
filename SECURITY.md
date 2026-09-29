# Security

## Secrets

- Never commit API keys, tokens, `.env` files, or `config.local.yaml`.
- `config.yaml` is a template and must keep `apiKey` empty. Real keys belong in gitignored `config.local.yaml` or in environment variables (`DEEPSEEK_API_KEY`, `IMMER_TRANSLATE_API_KEY`, and the other names in the README).
- Extension options store keys only in `chrome.storage.local` on the user's machine. Do not copy YAML config or keys into `extension/` or `extension/vendor/`.
- `packages/translate-core` must not hard-code credentials; pass them at runtime.

## Reporting

If you find a security issue, open a private report via GitHub Security Advisories on this repository (or contact the maintainer). Do not file a public issue with secrets in it.

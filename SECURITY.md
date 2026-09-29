# Security

## Secrets

- Never commit API keys, tokens, or `.env` files.
- Extension options store keys only in `chrome.storage.local` on the user's machine.
- `packages/translate-core` must not hard-code credentials; pass them at runtime.

## Reporting

If you find a security issue, open a private report via GitHub Security Advisories on this repository (or contact the maintainer). Do not file a public issue with secrets in it.

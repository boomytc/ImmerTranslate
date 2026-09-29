# Contributing

## Branches

- `main` — stable default
- `dev-*` — feature / experiment work (e.g. `dev-paragraph-cache`)
- `release-*` — release prep / tags (e.g. `release-0.1.0`)

Open PRs into `main` from a `dev-*` or `release-*` branch.

## Setup

1. Clone this repository.
2. Load the unpacked extension from `extension/` (see README).
3. Optional: `cd packages/translate-core && npm run smoke`

## Sync translate-core into the extension

After changing `packages/translate-core/src/`:

```bash
./scripts/sync-translate-core.sh
```

Then reload the extension in the browser.

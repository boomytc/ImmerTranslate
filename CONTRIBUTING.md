# Contributing

## Branching

- `dev-*` — active development and push (start from `dev-0.0.1`)
- `release-*` — merge from a closed `dev-*` milestone when a stage is done
- `main` — keep aligned with the latest stable release when cutting a public milestone

Do not push unfinished work to `release-*` or `main`.

## Setup

1. Clone this repository.
2. Load the unpacked extension from `extension/` (see README).
3. Optional: `cd packages/translate-core && npm run smoke`

## Sync translate-core into the extension

```bash
./scripts/sync-translate-core.sh
```

Then reload the extension in the browser.

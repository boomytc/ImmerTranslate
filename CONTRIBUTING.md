# Contributing

## Branching

Branch names: `dev-MAJOR.FEATURE.FIX` and `release-MAJOR.FEATURE.FIX`.

- Digit width is flexible (`dev-0.0.1`, `dev-1.12.03`, …)
- **MAJOR** — breaking / large version
- **FEATURE** — feature delivery version
- **FIX** — patch / bugfix version

Workflow:

1. Develop and push on the current `dev-*` (start: `dev-0.0.1`)
2. When that stage closes, merge into the matching `release-*`
3. Delete the closed `dev-*`, then open the next number (`dev-0.0.2`, …)
4. Keep `main` aligned with the latest stable release when cutting a public milestone

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

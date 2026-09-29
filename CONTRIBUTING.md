# Contributing

## Branching

Branch names: `dev-MAJOR.FEATURE.FIX` and `release-MAJOR.FEATURE.FIX`.

- Digit width is flexible (`dev-0.1.0`, `dev-1.12.03`, …)
- **MAJOR** — breaking / large version
- **FEATURE** — feature delivery version
- **FIX** — patch / bugfix version

Workflow:

1. Develop and push on the current `dev-*` (start: `dev-0.1.0`)
2. When that stage closes, merge into the matching `release-*`
3. Delete the closed `dev-*`, then open the next number (`dev-0.1.1`, …)
4. Keep `main` aligned with the latest stable release when cutting a public milestone

Do not push unfinished work to `release-*` or `main`.


## Commit messages

Use short, structured **Chinese** subjects. State the key action only — no filler.

Format: `<类型>: <一句话说明>`

Types: `新增` · `修改` · `修复` · `文档` · `重构` · `构建`

Examples:

- `新增: MV3 扩展壳与假译对照渲染`
- `修改: background 改为调用 vendor translate-core`
- `修复: 同步脚本未覆盖 types.js`
- `文档: 分支号段改为 MAJOR.FEATURE.FIX`

## Setup

1. Clone this repository.
2. Load the unpacked extension from `extension/` (see README).
3. Optional: `cd packages/translate-core && npm run smoke`

## Sync translate-core into the extension

```bash
./scripts/sync-translate-core.sh
```

Then reload the extension in the browser.

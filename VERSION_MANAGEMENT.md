# 更新日期

扩展用最近一次更新的时刻作标识，写成 `YY.MMDD.HHMM`，例如 `26.1119.1740`。

`package.json` 的 `version` 是唯一来源。`.env` 里的 `REACT_APP_VERSION` 和 `public/manifest.json` 里的 `version` 由 `pnpm sync-version` 同步，不要手工分别改。三个文件缺一、字段重复，或不是 `YY.MMDD.HHMM` 时，构建会失败。Chrome 和 Edge 使用同一个标识。

开发完成并准备提交前，运行 `pnpm updated`，把标识写成当前时刻。标识变了，就把 `CHANGELOG.md` 顶部改成 `## <该时刻>`。`package.json`、`.env`、`public/manifest.json` 和因此改动的 `CHANGELOG.md` 放进同一次提交。同一分钟内再次提交时标识不变。

```bash
pnpm updated                   # 写成现在
pnpm version:set -- 26.1119.1740 # 指定某一时刻
```

`pnpm check` 会核对这些文件是否一致，并在本机完成构建。浏览器里加载 `build/chrome` 或 `build/edge`。

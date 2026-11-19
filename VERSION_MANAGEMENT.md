# 版本号

本扩展只在本机从源码构建后加载，不打标签，不上传安装包。

`package.json` 是唯一的版本号来源。`.env` 中的 `REACT_APP_VERSION` 和 `public/manifest.json` 中的 `version` 由 `pnpm sync-version` 同步，不要手工分别改号。三个文件缺一、字段重复，或版本号不是 `X.Y.Z` 时，构建会直接失败。Chrome 和 Edge 使用同一个版本号。

需要改版本号时：

```bash
pnpm version:patch
pnpm version:minor
pnpm version:major
pnpm version:set -- 0.2.1
```

改完后在 `CHANGELOG.md` 顶部保留唯一、非空的 `## v<版本>` 一节。`pnpm check` 会核对这些文件是否一致，并在本机完成构建校验。浏览器里加载的是 `build/chrome` 或 `build/edge`。

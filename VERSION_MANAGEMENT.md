# 版本号管理与发布指南

## 发布原则与工具链

GitHub 只用于代码托管、PR、版本标签和 Releases。本仓库不使用 GitHub Actions，所有检查、构建和发布都在本机执行。`pnpm check` 会拒绝重新引入 `.github/workflows/*.yml` 或 `*.yaml`；推送分支或标签不会触发云端构建、自动发布或页面部署。

`package.json` 是唯一的版本号来源。`.env` 中的 `REACT_APP_VERSION` 和 `public/manifest.json` 中的 `version` 由 `pnpm sync-version` 自动同步，禁止手工分别改号。同步前会校验这三个文件：缺少文件、字段重复或版本号不是合法的 `X.Y.Z` 稳定格式时，都会直接报错阻断构建。Chrome 和 Edge 共用同一个版本号。

推荐使用 Node.js 24，仓库通过 `packageManager` 和 `.pnpm-version` 固定使用 pnpm 9.14.4。安装依赖时保留锁文件：

```bash
corepack pnpm@9.14.4 install --frozen-lockfile
```

发布脚本使用本机 GitHub CLI（`gh auth login`）的登录认证，且需要目标仓库的推送（push）权限，以便同时查询草稿和正式 Release。不要把任何凭证写入仓库文件。

## 本地检查与发布准备

日常开发、版本升级和发布统一在 `main` 分支进行，不再维护独立的 `dev` 分支。默认不额外新建开发或发布分支；确实需要临时分支时，先征得用户同意。

更新版本号请使用以下脚本（不会自动创建 Git 标签）：

```bash
pnpm version:patch          # 修复缺陷或安全问题
pnpm version:minor          # 新增功能
pnpm version:major          # 不兼容的大版本升级
pnpm version:set -- 0.2.1   # 明确指定目标稳定版本
```

升级版本后，在 `CHANGELOG.md` 顶部添加唯一、非空的 `## v<目标版本>` 一节，用通俗中文写清楚用户可见的变化，并保留下方历史条目。格式化时只处理本次改过的文件，不要把无关文件的格式差异混入提交。

源码、构建脚本或发布配置有改动时，在本机运行一次：

```bash
pnpm check                 # 检查当前改动并执行双端构建、打包与产物校验
pnpm check -- v0.2.0       # 检查自指定标签或提交以来的全部改动
```

`pnpm check` 会依次检查 `.github/workflows` 是否存在、工作区是否残留临时测试文件、改动文件是否符合 Prettier 格式、`package.json`/`.env`/`public/manifest.json` 与 `CHANGELOG.md` 顶部版本是否一致，随后在 `CI=true` 下执行 Chrome/Edge 构建和 ZIP 打包（`pnpm build+zip`），最后校验包内版本号并生成带 SHA-256 摘要的 `build/release-manifest.json`。该命令支持在有未提交改动时运行，但如果检查或构建过程中修改了源文件（例如版本号未同步），会直接报错中止。日常开发调试构建仍可单独运行 `pnpm build` 或 `pnpm build:chrome`。

本仓库以代码逻辑正确性为先，不维护常驻测试套件。改完代码后按影响范围做必要的临时验证或主路径试跑，结束后清除测试专用文件。纯文档变更只运行 `pnpm format:check`。同一份改动已经通过检查时，后续提交和推送直接复用结果；只有代码有新改动、上次检查失败或发现新疑点时，才重跑受影响的验证。后续问题通过真实使用反馈定位并迭代。

提交和推送分别按用户授权执行。已授权推送时，检查通过后直接同步到远端 `main`：

```bash
git pull --ff-only origin main
git push origin main
```

如果本地与远端 `main` 的提交历史出现分叉，先查清原因再处理，不要强推（force push）。

## 本机发布

发布前确保当前位于 `main` 分支、与远端 `origin/main` 同步，且版本号文件和 `CHANGELOG.md` 顶部都已更新为目标版本：

```bash
git switch main
git pull --ff-only origin main
pnpm release -- --dry-run
pnpm release
```

`pnpm release` 会按以下步骤执行：

1. 要求工作区干净、当前分支为 `main` 且与最新 `origin/main` 一致，校验 `origin` 仓库地址与 GitHub CLI 登录及推送权限，并查询远端标签、草稿和正式 Release。任一项不满足或认证失败都会立即停止。
2. 基于精确的源提交创建临时隔离工作树，在其中执行 `pnpm install --frozen-lockfile` 并运行全套本地检查（格式检查覆盖自上一个 `vX.Y.Z` 标签以来的改动）。本机工作目录里的旧 `build/`、`.env.local` 和未提交改动不会进入发布包。
3. 校验 Chrome/Edge ZIP 包内的 `manifest.json` 版本号、源提交 SHA、文件大小和 SHA-256，把隔离构建出来的 `build/` 目录保存到 `dist-release/v<版本>-<完整SHA>/build/`。该目录被 Git 忽略，必须保留以便后续校验或恢复上传。
4. 复核 `main` 与远端标签状态未发生变化后，创建并推送注解标签 `v<版本>`，再创建草稿 Release；先上传来源清单，再上传两个扩展压缩包，全部资产与本地原始产物核对无误后才转为正式发布。

执行 `--dry-run` 只会运行到产物校验和保存为止，不会创建或推送标签，也不会创建 Release。紧接着执行正式 `pnpm release` 时，会直接复用并校验已保存的同一份产物，不再重新构建。发布命令不会自动提交或推送分支。

GitHub Release 中上传的文件固定为 `immer-translate_v<版本>_chrome.zip`、`immer-translate_v<版本>_edge.zip` 和 `immer-translate_v<版本>_manifest.json`。平时跑 `pnpm check` 生成在 `build/` 里的文件只用于本机开发验证；正式发布只使用隔离构建并保存在 `dist-release/` 中的原始安装包。

## 失败恢复

- **检查或构建失败、尚未打标签**：修好问题后重新运行 `pnpm release`；临时工作树和发布锁会在退出时自动清理。
- **标签已推送或上传中途中断**：保留本地 `dist-release/` 中的原始产物和远端草稿 Release，重新运行 `pnpm release`；脚本会校验已传文件，只补传缺失的资产，不会覆盖已上传的文件。
- **`main` 已继续推进提交**：使用 `pnpm release -- --tag v<原版本>`。命令会从原标签指向的提交检出源码，校验该提交属于 `main` 历史并复核 `dist-release/` 里的原始产物，只恢复该版本发布，不会移动标签。
- **Release 已经正式发布**：重复执行只会核对线上资产与本地原始产物是否一致，不会重复发布，也不会修改或补传已发布的资产。
- **原始产物丢失、摘要冲突或已有标签指向其他提交**：立即停止操作，不要重新打包替代历史版本，也不要使用 `--clobber` 覆盖资产或删除重打标签。
- **进程被强制中断后残留 `dist-release/.release.lock`**：先确认确实没有发布进程还在运行，再删除该锁文件后重试；注意不要删除 `dist-release/` 中保存的原始构建目录。

如果已发布版本发现问题，请发布新的补丁版本。保留原始构建产物和来源清单是为了中断后能原样续传和校验，不要重新打包去覆盖已发布的版本。

## 发布验收

确认标签指向 `main` 历史中的对应发布提交、Release 已转为正式发布、Chrome/Edge 压缩包与来源清单齐全且包内版本号正确。汇报时说明 `main` 提交 SHA、标签名、Release 链接、本机检查结果和远端同步状态。

把新版本加载到浏览器后，按本次改动走一遍受影响的升级或使用主路径即可，不需要重复验收无关功能；汇报时如实说明实际验证过的内容和未验证部分。

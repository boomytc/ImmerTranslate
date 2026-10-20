# 版本号管理与发布指南

## 发布原则与工具链

GitHub 只用于代码、PR、版本标签和 Releases。仓库不使用 GitHub Actions；检查、测试、构建和发布均在本机执行。`pnpm check` 会拒绝重新引入 `.github/workflows/*.yml` 或 `*.yaml`。推送分支或标签不会自动构建、发布，也不部署 gh-pages。

`package.json` 是唯一版本源。`.env` 的 `REACT_APP_VERSION` 和 `public/manifest.json` 由 `pnpm sync-version` 同步，禁止手工分别改号。同步前会校验所有文件与版本字段；文件缺失、字段重复或版本无效都会阻断构建。Chrome、Edge 仍共用同一个稳定版本。

推荐使用 Node.js 24，仓库通过 `packageManager` 和 `.pnpm-version` 固定 pnpm 9.14.4。安装依赖保留锁文件：

```bash
corepack pnpm@9.14.4 install --frozen-lockfile
```

GitHub CLI 使用本机 `gh auth login` 的认证。发布需要目标仓库的 push 权限，以便同时查询草稿和正式 Release；凭证无需写入仓库或 GitHub Actions secrets。

## 本地检查与发布准备

日常开发和版本升级均在 `dev`，阶段性闭环后先推送远端 `dev`，再将 `dev` 同步到 `main`。`main` 承接稳定提交并作为发布入口，默认不另建任务或发布分支；需要额外分支时先取得用户授权。main 上的热修应同步回 dev，保持两条分支的历史兼容。

更新版本使用现有命令，不会自动创建 Git 标签：

```bash
pnpm version:patch          # Bug / 安全修复
pnpm version:minor          # 新功能
pnpm version:major          # 不兼容的大版本
pnpm version:set -- 1.2.2   # 明确指定稳定版本
```

在 CHANGELOG 顶部添加唯一、非空的 `## v<目标版本>` 节，用中文说明用户可见变化，保留历史条目。格式化仅处理本次变更，不混入全仓格式差异。

提交、推送和合并前在本机运行：

```bash
pnpm check                 # 检查当前改动及未跟踪文件的格式
pnpm check -- origin/main  # dev 检查相对 main 的全部改动
```

该命令依次运行格式检查、版本与 CHANGELOG 校验、发布脚本测试、产品测试、Chrome/Edge 构建及 ZIP 打包、包内版本与 SHA-256 来源清单校验。它允许检查尚未提交的改动，但会拒绝检查或构建对源文件产生新的修改。`CI=true` 只启用非交互测试和严格构建，不调用远端服务。普通开发构建仍可单独运行 `pnpm build`。

提交、推送、同步分支分别按用户授权执行。已授权同步时，检查通过后按以下顺序操作，默认使用快进并保持两条分支的提交历史一致：

```bash
git switch dev
git push -u origin dev
git switch main
git pull --ff-only origin main
git merge --ff-only dev
git push origin main
git switch dev
```

出现分叉时先核对原因，不强推或 squash。若远端分支保护要求 PR，就使用 `dev` → `main` 的 PR；旧 Actions 的 required checks 应先清理，不能等待已停用的任务。

## 本机发布

合并后同步 `main`，版本文件和 CHANGELOG 均须为目标版本：

```bash
git switch main
git pull --ff-only origin main
pnpm release -- --dry-run
pnpm release
```

`pnpm release` 会：

1. 要求工作区干净、当前为 `main` 且等于最新 `origin/main`，核对 origin 和 GitHub push 权限，查询草稿与正式 Release。认证失败会直接停止。
2. 从准确的源提交创建临时 worktree，使用 `pnpm install --frozen-lockfile` 安装依赖，再运行全部本地检查。格式覆盖上个稳定标签以来的改动。工作目录中的旧 build、本机环境覆盖文件和未提交修改不会进入发布包。
3. 校验 Chrome/Edge ZIP 内的版本、源 SHA、大小和 SHA-256，把原始构建保存到 `dist-release/v<版本>-<完整SHA>/build/`。此目录被 Git 忽略，必须保留以便恢复。
4. 复核源提交及远端状态后，创建并推送注解标签，再通过 GitHub CLI 创建草稿。先上传来源清单，再上传两个 ZIP；全部资产校验通过后才正式发布。

`--dry-run` 执行到产物验证与保存为止，不创建或推送标签、不创建 Release。随后正式发布会复用并校验同一份产物，避免再次构建。发布命令不会提交或推送分支。

下载文件仍为 `immer-translate_v<版本>_chrome.zip`、`immer-translate_v<版本>_edge.zip` 和 `immer-translate_v<版本>_manifest.json`。本地 `pnpm check` 的 `build/` 只是开发验证产物；正式发布只接受隔离构建并保存在 `dist-release/` 的原始包。

## 失败恢复

- 检查或构建失败、尚未打标签：修复原因后重新运行。临时 worktree 和发布锁会被清理。
- 标签推送或上传中断：保留本地 `dist-release/` 和远端草稿，再运行 `pnpm release`；仅补传缺失文件，不覆盖已上传资产。
- main 已继续开发：使用 `pnpm release -- --tag v<原版本>`。命令从原标签检出源码、校验 main 历史关系及原产物，只恢复该版本，不移动标签。
- Release 已发布：重复执行只核对原资产，不重复发布、不修补缺失的已发布资产。
- 原始产物缺失、摘要冲突或已有标签指向其他提交：停止，不重建替代历史资产，不使用 `--clobber`，不删除重打标签。历史 Actions 产物可从原运行手动下载到对应的本地 `build/` 位置后校验恢复；不再重跑旧工作流。
- 进程被强制终止后若留下 `dist-release/.release.lock`，先确认没有发布进程运行，再删除锁文件并重试。不要清理原始构建目录。

修复已发布版本时发布新的补丁版本。原始产物和来源清单用于恢复字节一致性，不应重新构建不同字节的包替换历史版本。

## 发布验收

确认标签对应 main 历史中的发布提交、Release 已正式发布、Chrome/Edge ZIP 与来源清单齐全且包内版本正确。报告 dev/main 同步状态、main 提交 SHA、标签、Release URL、本机检查结果和最终分支状态；使用了 PR 时附上链接。

浏览器加载新版本后验证个人选择器规则、双语字幕、模型及接口切换、停止翻译等关键行为。静态测试和构建成功不能替代浏览器实际升级验证。

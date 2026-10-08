# 版本号管理与发布指南

## 版本与工具链

`package.json` 是唯一版本源。`.env` 的 `REACT_APP_VERSION` 和三个 `public/manifest*.json` 由 `pnpm sync-version` 同步，禁止手工分别改号。同步前会校验所有文件与版本字段；文件缺失、字段重复或版本无效都会返回非零，阻断后续构建。

仓库通过 `packageManager` 和 `.pnpm-version` 固定 pnpm 9.14.4，CI 使用 Node.js 24。推荐使用 Corepack，安装依赖时保留锁文件：

```bash
corepack pnpm@9.14.4 install --frozen-lockfile
```

更新版本使用现有命令，不会自动创建 Git 标签：

```bash
pnpm version:patch          # Bug / 安全修复，例如 1.1.0 -> 1.1.1
pnpm version:minor          # 新功能
pnpm version:major          # 不兼容的大版本
pnpm version:set -- 1.1.1   # 明确指定稳定版本
```

## 发布准备：最新 main → 发布分支 → PR

所有开发和发布通过 PR 合入 `main`，禁止直接向 `main` 推送发布提交。开始前要求工作区干净、`main` 与最新 `origin/main` 一致、GitHub 认证有效、目标标签不存在，且没有冲突的发布 PR。

```bash
git fetch origin --prune --tags
git status --short --branch
git rev-list --left-right --count main...origin/main
gh auth status
git switch main
git pull --ff-only origin main
git switch -c codex/release-v1.1.1
pnpm version:patch
```

在 CHANGELOG 顶部添加唯一、非空的 `## v1.1.1` 节，使用中文说明用户可见变化；历史条目保持不变。安全补丁还应交代个人规则钩子的兼容性变化。版本号、标签和 CHANGELOG 首节必须一致。

格式化仅处理本次变更文件，然后检查完整差异。`pnpm format:check` 默认检查相对 HEAD 的变更及未跟踪文件；PR CI 使用 `pnpm format:check origin/main` 检查该 PR。不要把已有的全仓格式差异混入发布提交。

```bash
pnpm format:check
pnpm release:check
pnpm test:release
CI=true pnpm run test --watchAll=false --runInBand
pnpm build+zip
git diff --check
git diff
```

`pnpm build` 会同步版本、清理旧 build 并构建各客户端，不再自动格式化源码。压缩使用锁文件中已安装的 bestzip，不临时下载工具。检查 ZIP 内 manifest、两个用户脚本的 `@version` 及 `build/web/version.txt`，都应为目标版本。

只暂存经过审查的发布文件，提交并推送发布分支，创建标题为 `Release v1.1.1`、目标为 main 的 PR。等待 `release checks / checks` 及其他要求的检查全部通过，再通过 PR 合并；失败时先修复，不绕过检查。仓库工作流提供检查，但分支保护中是否将其设为 required 由仓库设置控制。

## 标签与自动发布

合并后同步 main，核对实际落地提交、所有版本和 CHANGELOG，再检查目标标签仍不存在。创建新的注解标签，禁止覆盖已发布标签或用旧版本号上传新的补丁包。

```bash
git switch main
git pull --ff-only origin main
pnpm release:check
git tag -a v1.1.1 -m "Release version 1.1.1"
git push origin v1.1.1
```

标签触发 `.github/workflows/release.yml`，流程为：

1. 校验稳定版本、CHANGELOG 和标签提交位于 main 历史中。
2. 运行发布脚本测试、产品测试、完整构建，确认构建没有修改受控文件。
3. 校验五端 ZIP、两种用户脚本和 Pages 版本，生成包含源 SHA、ZIP 大小及 SHA-256、Pages 文件摘要的 `release-manifest.json`，保存原构建 artifact 90 天。
4. 用 GitHub CLI 创建 draft，先上传来源清单，再上传五个 ZIP。全部上传并校验后才正式发布。按 tag 的 REST 接口仅返回已发布 Release；草稿通过有 push 权限的 release-state job 分页查询，构建 job 保持只读权限。
5. 发布成功后才部署 Pages；只部署当前 latest 稳定版，且不得低于 gh-pages 的现有 `version.txt`。同版本发布串行，Pages 部署单独串行。推送 gh-pages 后显式请求 Pages 构建，等待该分支提交构建成功并确认线上 `version.txt`；不能仅以分支推送成功判断站点已部署。同一提交已构建且线上版本正确时不会重复请求构建。

下载包命名为 `immer-translate_v1.1.1_<client>.zip`，client 为 chrome、edge、firefox、userscript、thunderbird；另有 `immer-translate_v1.1.1_manifest.json` 用于检查来源和摘要。Safari 原生扩展构建不在本发布矩阵中。

发布和 Pages job 显式使用 `contents: write`，Pages job 另用 `pages: write` 请求构建，构建 job 仅使用读权限。认证错误、版本错误或产物摘要冲突都会停止，不能被解释为“版本不存在”。

## 失败恢复与重复运行

GitHub 的 Re-run 使用原事件 SHA 和 ref，不能通过重跑 v1.1.0 带入 main 的新安全修复；新修复应发布 v1.1.1。

- 构建或测试失败、尚未创建 Release：修复原因后按发布门禁继续。
- 上传失败：保留 draft、已上传资产及原构建 artifact。重跑同一运行时复用原 artifact，验证已上传文件后只补传缺失文件。
- Release 已完整发布：重跑只校验资产，不删除、不覆盖、不重复发布；Pages 仍按 latest 和现有版本决定是否部署。
- 已发布资产冲突、缺少来源清单、原 artifact 缺失或过期：停止自动恢复，保留已发布历史。不要使用 `--clobber`、删旧标签或重新构建不同字节的包替换历史资产。
- Pages 单独失败：原 Release 保持有效，可从原 artifact 恢复部署。使用新版工作流恢复旧版时会跳过 Pages，保护当前站点。v1.1.0 等历史标签保存的旧工作流没有这些保护，不应重跑其 Pages job；main 中的新 YAML 不会替换历史运行所用的 YAML。

也可从 main 的 Actions 页面手动运行发布工作流，指定已有稳定标签和原发布运行 ID：

```bash
gh workflow run release.yml --ref main \
  -f tag=v1.1.1 \
  -f artifact_run_id=<原发布运行ID>
```

手动恢复使用本次工作流提交中的发布工具，但源码检出到原 tag，校验和发布只读取原 tag 的版本、CHANGELOG 与原 artifact。发布工具通过 `RELEASE_ROOT` 指向该源码目录，核对 tag/SHA/版本/原始摘要，不移动标签。这样 main 上的发布工具修复可用于旧 tag，无需重打标签或重建产物。没有原 artifact 时不自动重建部分发布。

仓库默认 `GITHUB_TOKEN` 权限设为 read；新版发布前状态查询、发布和部署 job 显式申请所需写权限。历史工作流未显式申请写权限时，无法再创建 Release 或覆盖 gh-pages。

## 发布验收

确认标签对应 main 中的发布提交、工作流状态查询、构建、发布、部署四个 job 成功、五端 ZIP 与来源清单齐全、包内版本及两个脚本版本正确，并核对线上 `version.txt` 为目标版本。浏览器升级后验证订阅脚本不执行、个人规则仍可运行且看不到密钥、切换模型或接口地址不混用缓存、停止翻译后没有残留重试或错误提示。

报告发布 PR、main 提交 SHA、标签、Release URL、工作流结果和最终分支状态。静态测试及构建通过不能替代浏览器实际升级验证。

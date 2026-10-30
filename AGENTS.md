# AGENTS.md

给在本仓库工作的编码 Agent。先读本文件再改代码。产品说明见 `README.md`，版本、构建与发布细节见 `VERSION_MANAGEMENT.md`，设置与同步存储契约见 `docs/storage-consistency.md`，预置服务与 BYOK 见 `docs/BYOK.md`。

## 1. 这是什么

Chrome/Edge 的 Manifest V3 扩展，做双语对照网页翻译。自带密钥或使用免钥服务，数据留在本机。只针对桌面浏览器，界面语言为简体中文和 English。

技术栈：React 18、MUI 5、CRA 5（react-app-rewired）、JavaScript、pnpm 9.14.4、Node 24。源码在 `src/`，构建产物在 `build/<target>/`，发布产物在 `dist-release/`。

入口是 `background.js`、`content.js`、`popup.js`、`options.js`、`injector-*.js`。页面逻辑主要在 `src/libs/`、`src/apis/`、`src/components/`、`src/views/`、`src/hooks/`。

## 2. 开发与验收

本仓库采用 `confident-development-conventions`：把主要投入放在代码逻辑正确性，完成必要验收后交付，通过真实使用反馈快速迭代。

- 先读实际调用链，明确状态归属、接口边界、异步操作身份和副作用顺序。优先通过代码结构与不变量排除错误。
- 不维护常驻测试套件，不强制 TDD、补回归用例或扩展验证矩阵。需要验证分歧时使用临时测试，完成后清除脚本、样本、mock、快照等测试专用资产，不为它们保留依赖、运行入口或生产代码分支。
- 每次开发完成后，只做与本次改动相称的必要验收。通过后停止验证并交付；没有新改动、失败或明确疑点时，复用已有结果，不因提交、推送或合入重复检查。

```sh
pnpm install
pnpm build:chrome   # 产物在 build/chrome
pnpm build          # 清空后构建 Chrome 与 Edge，Edge 复用 Chrome 产物
pnpm check          # 测试残留、格式、版本与 CHANGELOG、双端构建与 ZIP、产物校验
pnpm check -- origin/main
```

- 源码、构建或发布配置有变更时，完成后运行一次 `pnpm check`；纯文档变更只运行 `pnpm format:check`。检查也会拒绝 GitHub workflows 和检查或构建修改源文件。
- 临时验证优先使用系统临时目录，或使用仓库忽略的 `tmp/` 并在结束后清除。产品的接口连通性检查与发布包完整性校验继续保留。
- `build/` 只是本机验证产物。发布只认 `dist-release/v<版本>-<完整SHA>/build/` 的隔离构建。
- 涉及浏览器交互时，加载未打包扩展走一遍受影响的主路径即可。报告实际验证结果和未验证部分，不把模拟响应说成真实服务验证。

## 3. 版本与发布

- `package.json` 是唯一版本源。`.env` 的 `REACT_APP_VERSION` 与 `public/manifest.json` 的 `version` 由 `pnpm sync-version` 同步，禁止手工分别改号。升版本用 `pnpm version:patch`、`version:minor`、`version:major` 或 `version:set -- <版本>`。
- `CHANGELOG.md` 顶部加唯一、非空的 `## v<目标版本>` 节，用中文写用户可见变化，保留历史条目。
- 日常开发在 `dev`；阶段性闭环后快进同步到 `main`，`main` 是发布入口。热修要合回 `dev`。不用 squash，不强推。
- 发布在干净且等于 `origin/main` 的 `main` 上执行：先 `pnpm release -- --dry-run`，再 `pnpm release`。不手工打标签，不覆盖已上传资产，不重打历史标签。
- `dist-release/` 里的原始产物要保留，用于恢复和校验，不删除、不重建。
- 仓库不使用 GitHub Actions。检查、构建、打包和发布都在本机完成。

## 4. 代码

- 保持现有 JavaScript + React 函数组件/hooks 技术栈。不引入 TypeScript、第二套状态管理、第二套请求层或第二套构建工具，除非用户明确要求。
- 用户可见文案进 `src/config/i18n.js`（`src/config/locales/`、`src/config/i18n.ruleEditor.js`），中英文同时补，不要硬编码在组件里。
- 翻译服务预置放 `src/config/api.js`，默认禁用。新服务沿用 `src/apis/index.js` → `src/apis/trans.js` 的现有分发和 `src/libs/request.js` 的请求层，不要为单个供应商另起客户端或协议栈。
- 设置与规则的持久化走 `src/libs/storage.js`（`saveEdit` / transaction）、`storageState` 与 `storageSyncController`。组件不要绕过 storage 层直接写 `browser.storage`；`background.js` 的窗口边界等平台状态除外。
- 同步值只接受当前版本的加密信封。读取、合并、失败恢复的约束见 `docs/storage-consistency.md`，改存储先读那份文档。
- 规则优先级是个人规则 > 内置网站规则 > 全局规则。CSS 选择器的 `+` 前缀表示在继承结果上追加，`-` 表示剔除；改匹配与合并逻辑先看 `src/libs/rules.js` 和 `src/libs/siteMatch.js` 的契约。
- 样式优先继承页面。译文默认保留原文、不加额外装饰；字号、字重、行高、颜色跟随所在段落。只做桌面布局，不加触屏或移动端适配。
- 格式化用 Prettier（2 空格、双引号、80 列）。只格式化本次改动的文件，不混入全仓格式差异。
- 项目以 GPL-3.0 发布。保留许可证与版权声明；分发修改后的版本时提供对应源码。

## 5. 不要做

- 不要提交 Key、token、`.env.local`、`build/` 或 `dist-release/`。
- 不要手工改 `.env` 或 `public/manifest.json` 的版本，不要手工打标签或创建 Release。
- 不要新增 `.github/workflows`。
- 不要直接改 `main`，不要 force push，不要用 squash 同步分支。
- 不要把 `build/` 当发布包，不要删除或重建 `dist-release` 的原始产物。
- 不要新增移动端或触屏版式。
- 不要为一次性需求新起翻译协议、存储实现或请求客户端，先在现有契约上扩展。
- 不要为了绕过检查而修改检查脚本；检查失败先修实现或文档。

## 6. 提交

- 默认不提交。用户明确要求提交时，只加本会话改过的文件，用明确路径。
- 说明用中文 conventional：`feat|fix|refactor|docs|build|chore[(scope)]: <说明>`，说明写为什么。
- 提交说明、代码和文档里不用表情符号。不要 force push，不要跳过检查。

# AGENTS.md

给在本仓库工作的编码 Agent。修改代码前请先通读本文件。产品说明与安装使用见 `README.md`，版本号、本地检查与发布流程见 `VERSION_MANAGEMENT.md`，设置持久化与同步一致性约束见 `docs/storage-consistency.md`，预置翻译服务与自带密钥（BYOK）说明见 `docs/BYOK.md`。

## 1. 这是什么

面向桌面端 Chrome 和 Edge 的 Manifest V3 网页双语翻译扩展，支持免钥服务与自带密钥（BYOK），配置和密钥只保存在本机。仅针对桌面浏览器，界面语言提供简体中文和 English。

技术栈：React 18、MUI 5、CRA 5（react-app-rewired）、JavaScript、pnpm 9.14.4、Node 24。源码在 `src/`，构建产物在 `build/<target>/`，发布产物在 `dist-release/`。

入口文件在 `src/` 下的 `background.js`、`content.js`、`popup.js`、`options.js` 和 `injector-*.js`。页面与扩展核心逻辑主要在 `src/libs/`、`src/apis/`、`src/components/`、`src/views/`、`src/hooks/`。

## 2. 开发与验收

本仓库采用 `confident-development-conventions`：把主要投入放在代码逻辑正确性，完成必要验收后交付，通过真实使用反馈快速迭代。

- 改代码前先顺着实际调用链读一遍，明确状态归属、接口边界、异步请求如何区分过期结果，以及状态更新和副作用的先后顺序；优先依靠清晰的代码结构与不变约束来排除缺陷。
- 不维护常驻测试套件，不强制 TDD、补回归用例或扩展验证矩阵。需要验证分歧时使用临时测试，完成后清除脚本、样本、mock、快照等测试专用资产，不为它们保留依赖、运行入口或生产代码分支。
- 每次开发完成后，只做与本次改动范围相称的必要验收；通过后停止验证并交付。没有新改动、上次失败或明确疑点时，复用已有检查结果，不因提交、推送或合入重复检查。

```sh
pnpm install
pnpm build:chrome   # 产物在 build/chrome
pnpm build          # 清空后构建 Chrome 与 Edge，Edge 复用 Chrome 产物
pnpm check          # 测试残留、格式、版本与 CHANGELOG、双端构建与 ZIP、产物校验
```

- 源码、构建或发布配置有变更时，完成后运行一次 `pnpm check`；纯文档变更只运行 `pnpm format:check`。`pnpm check` 也会拒绝新增 `.github/workflows` 和检查/构建反过来修改源文件。
- 临时验证优先使用系统临时目录，或使用 `.gitignore` 已忽略的 `tmp/` 并在结束后清除。产品自带的接口连通性检查与发布包完整性校验继续保留。
- `build/` 只是本机开发验证产物；正式发布只认在隔离工作区构建并保存到 `dist-release/v<版本>-<完整SHA>/build/` 的产物。
- 涉及浏览器交互时，加载未打包扩展走一遍受影响的主路径即可。如实汇报实际验证结果和未验证部分，不把模拟响应说成真实服务验证。

## 3. 版本与发布

- `package.json` 是唯一的版本号来源。`.env` 中的 `REACT_APP_VERSION` 与 `public/manifest.json` 中的 `version` 由 `pnpm sync-version` 同步，禁止手工分别改号。升级版本使用 `pnpm version:patch`、`pnpm version:minor`、`pnpm version:major` 或 `pnpm version:set -- <版本>`。
- `CHANGELOG.md` 顶部添加唯一、非空的 `## v<目标版本>` 一节，用通俗中文写清楚用户可见变化，并保留下方历史条目。
- 日常开发与发布统一在 `main` 分支进行，不再维护独立的 `dev` 分支；不要 force push。
- 正式发布在工作区干净且等于 `origin/main` 的 `main` 上执行：先跑 `pnpm release -- --dry-run`，再跑 `pnpm release`。不手工打标签，不覆盖已上传资产，不重打历史标签。
- `dist-release/` 里的原始构建产物用于中断恢复和校验，不删除、不重建。
- 仓库不使用 GitHub Actions。检查、构建、打包和发布都在本机完成。

## 4. 代码

- 保持现有 JavaScript + React 函数组件/hooks 技术栈。不引入 TypeScript、第二套状态管理、第二套请求层或第二套构建工具，除非用户明确要求。
- 用户可见文案放进 `src/config/i18n.js`（以及 `src/config/locales/`、`src/config/i18n.ruleEditor.js`），中英文同时补齐，不要硬编码在组件里。
- 翻译服务预置放 `src/config/api.js`，默认禁用。新服务沿用 `src/apis/index.js` → `src/apis/trans.js` 的现有分发和 `src/libs/request.js` 的请求层，不要为单个供应商另起客户端或协议栈。
- 设置与规则的持久化走 `src/libs/storage.js`（`saveEdit` / `transaction`）、`src/libs/storageState.js` 与 `src/libs/storageSyncController.js`。组件不要绕过 storage 层直接写 `browser.storage`（`src/background.js` 中的窗口边界等平台状态除外）。
- 同步值只接受当前版本的加密信封。读取、合并与异常恢复的约束见 `docs/storage-consistency.md`，改存储前先通读该文档。
- 规则优先级是：个人规则 > 内置网站规则 > 全局规则。CSS 选择器的 `+` 前缀表示在继承结果上追加，`-` 表示剔除；改匹配与合并逻辑前先确认 `src/libs/rules.js` 和 `src/libs/siteMatch.js` 的契约。
- 译文样式优先继承网页：默认保留原文、不加额外装饰，字号、字重、行高、颜色跟随所在段落。只做桌面布局，不加触屏或移动端适配。
- 格式化用 Prettier（2 空格缩进、双引号、80 列）。只格式化本次改动的文件，不混入全仓格式差异。
- 项目以 GPL-3.0 发布。保留许可证与版权声明；分发修改后的版本时提供对应源码。

## 5. 不要做

- 不要提交 Key、token、`.env.local`、`build/` 或 `dist-release/`。
- 不要手工改 `.env` 或 `public/manifest.json` 的版本，不要手工打标签或创建 Release。
- 不要新增 `.github/workflows`。
- 不要 force push，不要跳过本地检查或绕过钩子。
- 不要把 `build/` 当发布包，不要删除或重建 `dist-release/` 的原始产物。
- 不要新增移动端或触屏版式。
- 不要为一次性需求新起翻译协议、存储实现或请求客户端，先在现有契约上扩展。
- 不要为了绕过检查而修改检查脚本；检查失败先修实现或文档。

## 6. 提交

- 默认不提交。用户明确要求提交时，只加本会话改过的文件，用明确路径。
- 说明用中文 conventional：`feat|fix|refactor|docs|build|chore[(scope)]: <说明>`，说明写为什么。
- 提交说明、代码和文档里不用表情符号。不要 force push，不要跳过检查。

# ImmerTranslate

[English](README.en.md)

## 简介

开源 MVP：网页主内容双语（原文 + 译文）阅读。适用于 Chrome / Edge Manifest V3。

受沉浸式双语翻译类扩展启发。本仓库是独立实现，核心保持小巧，密钥留在本机（MVP 没有登录墙）。

## 状态

早期 MVP。当前开发版本为 **1.0.0**（分支 `dev-1.0.0`，与 `extension/manifest.json` 一致）。未填写 API Key 时，翻译是 **mock**：把原文包成 `⟦…⟧`。在选项页保存密钥后，会选用 OpenAI 兼容或 Anthropic 兼容引擎。默认：协议 `openai`，base `https://api.deepseek.com/v1`，模型 `deepseek-flash`。扩展里的密钥只存在 `chrome.storage.local`。

悬停主内容段落，按 **Alt+T**（可在选项页修改，存储键 `paragraphHotkey`）只翻译这一段。扩展图标仍用来开关整页。选项页可以把某个来源标成 **永不翻译**（`denyOrigins`，默认空，因此所有站点都可译）或 **始终翻译**（`allowOrigins`）。列入永不翻译的来源，图标和快捷键都不会插入双语节点；同一来源两边都有时，以永不翻译为准。阅读样式（`translationFontSize`：`sm` / `md` / `lg`；`translationContrast`：`normal` / `high`；`displayMode`：`bilingual` 或 `translation-only`）存在 `chrome.storage.local`，对已经打开的页面立即生效，不用刷新。

Node 与云端验收读取已 gitignore 的本地 YAML，以及环境变量。Service worker 用 translate-core 的 `createPipelineEngine` 把所选引擎包一层；缓存、重试和限流不在扩展壳里另写一套。`packages/translate-core` 在本分支已经是 `1.0.0`，本次对齐不改该包。`TranslateRequest` / `TranslateResponse` 保持不变；密钥为空时仍走 mock 引擎。

## 目录

```
extension/                 # 作为「已解压的扩展程序」加载这一目录
  manifest.json
  background.js            # 消息总线 → 翻译引擎
  hotkey.js                # Alt+T 编解码（选项页 + content script）
  sitelist.js              # 按来源匹配始终翻译 / 永不翻译
  content.js / content.css # 段落识别、悬停、双语 DOM、样式属性
  options.html / options.js
  vendor/translate-core/   # packages/translate-core/src 的同步副本（MV3）
packages/translate-core/   # TranslateRequest/Response + mockTranslate
  config/load.js           # 仅 Node 的 YAML 合并（不会同步进扩展）
config.yaml                # 已提交的模板，apiKey 为空
scripts/sync-translate-core.sh
```

## 安装

扩展版本 **1.0.0**。从本仓库拿到源码后，在 Chrome 或 Edge 里以未打包方式加载。

1. 克隆或下载本仓库。
2. 打开 `chrome://extensions`（Edge：`edge://extensions`）。
3. 打开 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择仓库里的 `extension/` 目录。
5. **把扩展图标钉到工具栏**。不钉的话，只能从扩展菜单（拼图图标）里点开。

### 从 GitHub Release 安装（可选）

版本用 git tag 和 [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases) 发布，不维护长期 `release-*` 分支。已有 tag：`v0.1.0`、`v0.1.1`、`v0.2.0`、`v0.2.1`、`v0.3.0`。之后的版本（含 `v1.0.0`）同样打 tag 并建 Release。

1. 在 Releases 里打开要装的 tag，下载该 tag 的源码（Source code）。
2. 解压后，按上面的步骤加载其中的 `extension/`，并把图标钉到工具栏。

当前开发线是 `dev-1.0.0`。要跟这条线，克隆或下载该分支，再加载其中的 `extension/`。

## 使用

1. 打开一篇文章页，点击工具栏上的扩展图标，开关整页双语。未填 API Key 时，译文是 mock，形如 `⟦原文⟧`。再点一次图标，译文节点消失，页面还原。
2. 悬停主内容里的一段（会出现蓝色描边），按默认 **Alt+T**，只翻译这一段。译文行的样式与整页对照相同。已经译过的段再按一次不会重复插入。
3. 选项页（扩展详情 → 扩展选项）可以：
   - **改热键**：聚焦「段落快捷键」，按下含 Alt、Ctrl 或 Meta 的组合，然后保存。默认 `Alt+T`。可点「恢复默认 Alt+T」。
   - **站点名单**：**永不翻译** 的来源不会插入双语节点（图标和快捷键都不会）。**始终翻译** 可选，打开该来源时自动翻译。同一来源两边都有时，以永不翻译为准。只填域名则同时匹配 http 与 https；填完整网址则只保存其 origin。子域名不会跟着生效。
   - **阅读样式**：译文字号（小 / 标准 / 大）、对比度（标准 / 高对比）、显示方式（双语对照或仅译文）。已经译过的页面会马上换样式，不用刷新。

协议、Base URL、模型、API Key、语言、`paragraphHotkey`、`denyOrigins`、`allowOrigins` 和阅读样式都只存在 `chrome.storage.local`。密钥留空则继续用 mock。扩展不读取 `config.yaml`。

## 配置密钥

密钥不要提交进仓库。

- **浏览器扩展**：在选项页填写 API Key，只写入本机 `chrome.storage.local`。留空则继续 mock（`⟦…⟧`）。扩展不读 YAML。
- **本机 Node / 云端验收**：把模板抄成 `config.local.yaml` 再填写，或设置环境变量 `DEEPSEEK_BASE_URL` 与 `DEEPSEEK_API_KEY`。

```bash
cp config.yaml config.local.yaml
```

`config.yaml` 是已提交的空密钥模板（`apiKey: ""`）。`config.local.yaml` 已被 gitignore。空白或只有空格的环境变量不会覆盖 YAML。合并顺序和其余变量名见下文 [Node 与云端配置](#node-与云端配置)。

## translate-core 冒烟测试

```bash
cd packages/translate-core
npm run smoke
```

期望输出里有形如 `⟦原文⟧` 的 JSON 段落，最后一行是 `smoke ok`。

## 同步 vendor 副本

MV3 service worker 不能导入扩展根目录以外的文件。改完 `packages/translate-core/src/` 之后：

```bash
./scripts/sync-translate-core.sh
```

然后在浏览器里重新加载扩展。

## MVP 验收

当前扩展版本是 **1.0.0**（`dev-1.0.0`）。清单仍覆盖最初的 MVP 检查、悬停热键，以及 0.3.0 的站点名单和阅读样式开关。本次对齐不新增功能。

```bash
npm run accept
```

检查内容：vendor 与 `packages/translate-core` 同步；background 导入该 vendor，并按选项在 mock / OpenAI / Anthropic 之间选择；mock 批量结果为 `⟦…⟧`；包内 smoke；MV3 manifest；选项页字段，且没有登录或付费墙文案；段落热键默认 `Alt+T`，单段走一次 `TRANSLATE_BATCH`；git 文件里没有本机绝对路径或形如密钥的秘密；`config.yaml` 的 `apiKey` 为空；`config.local.yaml` 已被 gitignore；YAML 合并优先级；`extension/` 里既没有本地 YAML，也没有密钥。

`npm run accept` 通过后，按下面的清单在本机点一遍。加载方式见上文 [安装](#安装)（须把图标钉到工具栏）。

### 本机验收清单

除最后一项外，API Key 留空。设置页应写明无强制登录、无升级弹窗。

- [ ] **钉到工具栏 + 空密钥整页开关**：按 [安装](#安装) 加载 `extension/` 并钉到工具栏。文章页点击图标，段落下出现双语 `⟦原文⟧`；再点一次，译文节点消失，页面还原。
- [ ] **悬停 + Alt+T 单段**：悬停主内容一段（蓝色描边），按 **Alt+T**，只有该段出现双语行。
- [ ] **设置页改快捷键**：选项页聚焦「段落快捷键」，按下含 Alt、Ctrl 或 Meta 的组合并保存；悬停另一段用新组合只译该段。可点「恢复默认 Alt+T」回到默认。
- [ ] **永不翻译拦截**：把当前来源加入永不翻译后，图标和 Alt+T 都不再插入译文；从名单移除后可以再译。
- [ ] **样式即时生效**：已译页面上改译文字号、对比度，或双语对照 / 仅译文，当前页马上变样，不用刷新。
- [ ] **可选真实 DeepSeek Key**：协议保持 OpenAI 兼容，填入自备 DeepSeek Key（默认 base / model 即可）翻译一页。密钥只在本机 `chrome.storage.local`。没有登录或升级墙。

## Node 与云端配置

扩展只从 `chrome.storage.local`（选项页）读取协议、Base URL、模型和 API Key，不读 YAML。不要把 `config.yaml` 或 `config.local.yaml` 复制进 `extension/` 或 `extension/vendor/`。

Node 脚本和云端验收：复制模板，在本地填写密钥。

```bash
cp config.yaml config.local.yaml
```

`config.yaml` 是已提交模板（`apiKey: ""`）。`config.local.yaml` 已被 gitignore。加载器：`packages/translate-core/config/load.js`（`loadMergedEngineConfig`、`createEngineFromMergedConfig`）。`apiKey` 为空时选用 `mockTranslate`。`provider: anthropic` 选用 Anthropic 兼容引擎；其他 provider 用 OpenAI 兼容引擎（含 DeepSeek）。

合并顺序（后者胜出）：默认值 ← `config.yaml` ← `config.local.yaml` ← 环境变量。YAML 只支持很小的子集：每行一个 `key: value`，可选引号，`#` 注释必须单独成行。不支持嵌套。

| 变量 | 覆盖字段 |
| --- | --- |
| `IMMER_TRANSLATE_PROVIDER` | `provider` |
| `IMMER_TRANSLATE_BASE_URL` | `baseUrl` |
| `IMMER_TRANSLATE_MODEL` | `model` |
| `IMMER_TRANSLATE_API_KEY` | `apiKey` |
| `IMMER_TRANSLATE_SOURCE_LANG` | `sourceLang` |
| `IMMER_TRANSLATE_TARGET_LANG` | `targetLang` |
| `DEEPSEEK_BASE_URL` | `baseUrl`（在通用变量之后） |
| `DEEPSEEK_API_KEY` | `apiKey`（在通用变量之后） |

空白或只有空格的变量不会覆盖 YAML。因此非空的 `DEEPSEEK_API_KEY` 会压过 YAML 和 `IMMER_TRANSLATE_API_KEY`。

```js
import { loadMergedEngineConfig, createEngineFromMergedConfig } from "./packages/translate-core/config/load.js";

const cfg = loadMergedEngineConfig({ cwd: process.cwd(), env: process.env });
const engine = createEngineFromMergedConfig(cfg);
```

把 `cfg.sourceLang` / `cfg.targetLang` 放进翻译请求。引擎工厂只接收 `apiKey`、`baseUrl` 和 `model`。

## 分支与 Release

日常远程分支是 `main` 和当前的 `dev-*`。

- 开发在 `dev-*`（当前 `dev-1.0.0`，扩展版本 `1.0.0`）
- 阶段完成后合入 `main`
- 发布时打 tag，并创建 GitHub Release。已有 `v0.1.0` 至 `v0.3.0`；之后（含 `v1.0.0`）同样处理。没有长期 `release-*` 分支

未完成的工作留在当前 `dev-*`，该阶段合入 `main` 后再作为稳定线。

## 安全要点

- 仓库里不放 API Key
- 见 [SECURITY.md](SECURITY.md)

## 许可证

[MIT](LICENSE)

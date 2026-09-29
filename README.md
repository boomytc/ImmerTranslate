# ImmerTranslate

[English](README.en.md)

## 简介

开源 MVP：网页主内容双语（原文 + 译文）阅读。适用于 Chrome / Edge Manifest V3。

受沉浸式双语翻译类扩展启发。本仓库是独立实现，核心保持小巧，密钥留在本机（MVP 没有登录墙）。

## 状态

早期 MVP。当前开发版本为 **1.0.1**（分支 `dev-1.0.1`，与 `extension/manifest.json` 一致）。早先过早标成的 1.0.0 已撤回；1.0.0 是 0.4.2–0.8.0 已交付能力的版本对齐。1.0.1 让悬浮球单击与弹层主按钮共用同一套整页翻译状态，悬停文案随状态显示本机快捷键。已发布的最新 tag 仍是 `v0.3.0`。未填写 API Key 时，翻译是 **mock**：把原文包成 `⟦…⟧`。在选项页保存密钥后，会选用 OpenAI 兼容或 Anthropic 兼容引擎。默认：协议 `openai`，base `https://api.deepseek.com/v1`，模型 `deepseek-flash`。扩展里的密钥只存在 `chrome.storage.local`。

点击工具栏图标会打开 **弹窗**（`default_popup`），而不是静默切换。弹窗骨架是一行状态（已翻译 / 未翻译，以及 Mock 或当前引擎的只读一句）、双态主按钮 **翻译** ↔ **显示原文**、以及 **打开设置**。主按钮下方有两个本页按钮：**本页加入永不翻译** 和 **本页加入始终翻译**。本页已经在对应名单里时，按钮变成 **本页移出永不翻译** 或 **本页移出始终翻译**。按钮上方写着将要写入的来源（带协议的 origin）。未翻译时，主按钮用和选项页相同的格式函数，把整页快捷键放进括号：macOS 为 **翻译 (⌥A)**，Windows / Linux 为 **翻译 (Alt+A)**（不用 ⌘T，那是新建标签页）。已翻译时按钮仍是 **显示原文**。API Key 为空时，状态行标明 **Mock 模式**（译文为 `⟦原文⟧`）。弹窗不放登录头像、Pro 开关、促销条或快捷宫格，也不在弹窗里编辑整份名单。页面右侧偏下有一颗可拖拽的 **悬浮球**，和弹窗共用 `extension/glass.css` 里的毛玻璃令牌（模糊、圆角、半透明底、细边和阴影）。单击与弹窗主按钮走同一套双态：未翻译时翻译整页，已翻译时显示原文。悬停提示随状态变化，并带上与弹层相同的本机快捷键（macOS **⌥A**，Windows / Linux **Alt+A**，或选项里改过的整页键）。已翻译时球角上有一枚小标记。球旁有一个 **打开弹层** 的小入口，打开工具栏弹层；浏览器不允许时则打开弹层里已有的选项页，不把整张弹窗嵌进球里。球上方有一个标成 **站点** 的按钮，打开后是和弹窗相同的两条本页操作。松手后球会贴到左缘或右缘，并记住竖直位置（`chrome.storage.local` 的 `ballPosition`：`side` 与 `top`）。第一次出现时，球旁边有一张不挡操作的提示卡，点「知道了」或点这张卡就关掉，看过不再出现，也不会引导登录或付费。第一次安装、且还没有 `onboardingDone` 时，页面左上角另有一张不挡操作的毛玻璃卡片，最多三步，依次是 **钉到工具栏**、**点弹层译一页**、**认识悬浮球**。每一步都可以「跳过」；前两步也可以「全部跳过」。点最后一步的「完成」，或把步骤走完/跳完，会写入 `onboardingDone`，之后不再出现。引导还在、或刚在本页关掉时，球旁那张提示不会同时或紧接着弹出。若已经看到「认识悬浮球」再结束，会一并写下 `ballTipSeen`，球旁提示不再重复同一段说明。若在前两步就「全部跳过」，`ballTipSeen` 仍留空，球旁提示留到下一次打开页面，并且仍然只出现一次。卡片没有登录、条款勾选、Pro、功能目录或 Token。重新安装，或在扩展的 Service Worker 控制台执行 `chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])` 后刷新，可以再看。来源在永不翻译名单里时，悬浮球连同「站点」按钮一起不显示。完整名单在选项页增删改；弹窗和悬浮球只动当前页这一条来源。移出本页时，会去掉所有命中该页的条目（裸域名和精确 origin 都算）。选项页是左侧导航加右侧内容，五个分区依次为 **基本**、**快捷键**、**悬浮球**、**站点名单**、**引擎与密钥**。整页复用 `extension/glass.css` 的毛玻璃令牌，不是整页纯白；主按钮保持克制的蓝色。Mac 与 Windows 共用这一套布局。悬浮球可关闭（`ballEnabled`，默认开）；关掉后页面上不显示，竖直位置仍留在 `ballPosition`。整页快捷键也可改（`pageHotkey`，默认 Alt+A，macOS 显示 **⌥A**），和段落键用同一套平台格式函数。

悬停主内容段落，按段落快捷键只翻译这一段（可在选项页修改，存储键 `paragraphHotkey`）。规范键位是 Option / Alt + T：macOS 显示并保存 **⌥T**，Windows / Linux 显示并保存 **Alt+T**。整页切换仍是 Option / Alt + A：macOS **⌥A**，Windows / Linux **Alt+A**（不用 Ctrl+A，那是全选；也不用 ⌘T，那是新建标签页）。文章页上，焦点不在输入框时，这个组合在 `window` / `document` 的捕获阶段 `keydown` 里匹配；命中后 `preventDefault` 并 `stopPropagation`，避免浏览器把 Alt+字母当成菜单或加速键。若某环境仍在事件到达页面前吃掉 `keydown`，同一次按键的 `keyup` 会补上一次。整页另有 manifest 命令（各平台建议键 Alt+A，macOS 上即 ⌥A）。段落也有一条（建议键 Alt+T，macOS 上即 ⌥T）：只翻译当前悬停的那一段，并且只在命令快捷键与已保存的 `paragraphHotkey` 一致时生效。选项页改键并保存，或点「恢复默认」（会写回该平台的默认段落键），都以新值为准。段落命令不会切换整页。黑名单来源上，段落快捷键不插入译文。弹窗主按钮和悬浮球不依赖热键，热键失效时两者仍能切换，并和页面状态保持一致。选项页可以把某个来源标成 **永不翻译**（`denyOrigins`，默认空，因此所有站点都可译）或 **始终翻译**（`allowOrigins`），也可以编辑或移除已有条目。列入永不翻译的来源，弹窗、悬浮球和快捷键都不会插入双语节点；同一来源两边都有时，以永不翻译为准（裸域名在永不翻译、该 origin 在始终翻译时同样如此）。弹窗和悬浮球上的「站点」可以把当前页 origin 一键加入或移出，不用手打。阅读样式（`translationFontSize`：`sm` / `md` / `lg`；`translationContrast`：`normal` / `high`；`displayMode`：`bilingual` 或 `translation-only`）存在 `chrome.storage.local`，对已经打开的页面立即生效，不用刷新。

Node 与云端验收读取已 gitignore 的本地 YAML，以及环境变量。Service worker 用 translate-core 的 `createPipelineEngine` 把所选引擎包一层；缓存、重试和限流不在扩展壳里另写一套。`packages/translate-core` 仍是 **1.0.0**，扩展壳是 **1.0.1**。`extension/vendor` 由 `scripts/sync-translate-core.sh` 从该包的 `src` 同步，与 0.8.0 的 `TranslateFailure`（`kind` / `code` / `status`）一致。`TranslateRequest` / `TranslateResponse` 保持不变；密钥为空时仍走 mock 引擎。翻译被拒绝时，页面右上角出现一条不挡点击的毛玻璃提示，悬浮球旁和弹窗提示行显示同一句（含失败种类 `kind` 和说明）。没有新的协议族，也没有登录或 Pro。

## 目录

```
extension/                 # 作为「已解压的扩展程序」加载这一目录
  manifest.json
  background.js            # 消息总线 → 翻译引擎
  glass.css                # 弹窗、选项页、悬浮球与失败提示共用的毛玻璃令牌
  options.css              # 选项页布局（复用 glass.css 令牌）
  popup.html / popup.js    # 工具栏弹窗：状态行 / 双态按钮 / 本页站点 / 设置入口
  hotkey.js                # 快捷键编解码与按系统显示（⌥ / Alt）
  sitelist.js              # 按来源匹配始终翻译 / 永不翻译
  ballpos.js               # 悬浮球默认位置、夹取与贴边
  onboarding.js            # 首次三步引导：顺序、跳过，以及与球旁提示互斥
  failtip.js               # 翻译失败提示：说明与 kind / code / status
  content.js / content.css # 段落识别、悬停、双语 DOM、悬浮球、失败提示、首次引导、样式属性
  options.html / options.js
  vendor/translate-core/   # packages/translate-core/src 的同步副本（MV3）
packages/translate-core/   # TranslateRequest/Response + mockTranslate
  config/load.js           # 仅 Node 的 YAML 合并（不会同步进扩展）
config.yaml                # 已提交的模板，apiKey 为空
scripts/sync-translate-core.sh
```

## 安装

扩展版本 **1.0.1**。从本仓库拿到源码后，在 Chrome 或 Edge 里以未打包方式加载。

1. 克隆或下载本仓库。
2. 打开 `chrome://extensions`（Edge：`edge://extensions`）。
3. 打开 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择仓库里的 `extension/` 目录。
5. **把扩展图标钉到工具栏**。不钉的话，只能从扩展菜单（拼图图标）里点开。

### 从 GitHub Release 安装（可选）

版本用 git tag 和 [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases) 发布，不维护长期 `release-*` 分支。已有 tag：`v0.1.0`、`v0.1.1`、`v0.2.0`、`v0.2.1`、`v0.3.0`。早先的 `v1.0.0` tag 已撤回。之后的版本同样打 tag 并建 Release。

1. 在 Releases 里打开要装的 tag，下载该 tag 的源码（Source code）。
2. 解压后，按上面的步骤加载其中的 `extension/`，并把图标钉到工具栏。

当前开发线是 `dev-1.0.1`。要跟这条线，克隆或下载该分支，再加载其中的 `extension/`。

## 使用

若是第一次使用，文章页左上角会先出现一张可跳过的三步卡片（**钉到工具栏**、**点弹层译一页**、**认识悬浮球**）。它不挡住页面：可以继续滚动、点悬浮球或打开弹层。走完、跳完，或点「全部跳过」之后写入 `onboardingDone`，不再出现。想再看一遍，在扩展的 Service Worker 控制台执行 `chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])`，然后刷新文章页。

1. 打开一篇文章页，点击工具栏上的扩展图标，打开弹窗。状态行显示本页是「已翻译」还是「未翻译」，并带一句 Mock 或当前引擎说明。未填 API Key 时标明 Mock 模式，译文形如 `⟦原文⟧`。主按钮在 **翻译** 和 **显示原文** 之间切换。未翻译时，按钮文案是 **翻译 (⌥A)**（macOS）或 **翻译 (Alt+A)**（Windows / Linux），括号里的快捷键与选项页同一个格式函数。焦点不在输入框时，按同一组合也会切换整页：Windows / Linux 为 **Alt+A**，macOS 为 **⌥A**。若系统或浏览器抢走该组合，用弹窗主按钮或悬浮球即可，两者和热键共用同一页面状态。「打开设置」打开选项页。页面右侧偏下的悬浮球单击做同一件事：未翻译时译整页，已翻译时显示原文。悬停时，macOS 为「点击翻译为简体中文 (⌥A)」，Windows / Linux 为「点击翻译为简体中文 (Alt+A)」；已翻译时为「已翻译 · 点击显示原文」并带同一快捷键。译过之后球角有一枚小标记。球旁的「打开弹层」打开工具栏弹层或选项页。球可以拖动，松手后贴到左边或右边，并记住上下位置；刷新后还在那一侧的同一高度。第一次会在球旁边出现一张提示，点「知道了」或点这张卡即消失，之后不再挡页面。
2. 悬停主内容里的一段（会出现蓝色描边），按默认段落快捷键（macOS **⌥T**，Windows / Linux **Alt+T**），只翻译这一段。译文行的样式与整页对照相同。已经译过的段再按一次不会重复插入。若浏览器吃掉这次按键，扩展命令仍只译悬停的这一段，不会改整页。
3. 选项页（扩展详情 → 扩展选项，或弹窗里的「打开设置」）左侧有五个分区，右侧是对应内容。打开后可按下面走一遍；改完点底部「保存」。字号、对比度、显示方式、站点名单和悬浮球开关会立刻写入，不用再点保存。
   - **基本**：目标语言、显示方式（双语对照或仅译文）、译文字号、对比度。已经译过的页面会马上换样式，不用刷新。源语言也在这里。
   - **快捷键**：整页切换和段落快捷键。聚焦输入框，按下含修饰键的组合，然后保存，新组合才会在阅读页生效。macOS 显示 **⌥** / **⌘**（默认整页 **⌥A**、段落 **⌥T**），Windows / Linux 显示 **Alt** / **Ctrl**（默认 **Alt+A**、**Alt+T**）。点「恢复默认」会写回该平台的默认键，按钮文案与这一显示相同。
   - **悬浮球**：开关默认开。说明写明默认贴右缘，松手贴左右边缘，并记住竖直位置。关掉后已打开的页面上球会消失，位置仍留着；再打开后回到上次的高度。
   - **站点名单**：**永不翻译** 的来源不会插入双语节点（弹窗、悬浮球和快捷键都不会）。**始终翻译** 可选，打开该来源时自动翻译。同一来源两边都有时，以永不翻译为准。只填域名则同时匹配 http 与 https；填完整网址则只保存其 origin。子域名不会跟着生效。每一条都可以 **编辑** 或 **移除**。加入、编辑和移除会立刻保存，刷新后还在。弹窗和悬浮球上的「站点」可以把当前页 origin 一键加入或移出。
   - **引擎与密钥**：只有 OpenAI 兼容和 Anthropic 兼容。API Key 留空时页面标明 mock，译文为 `⟦原文⟧`（`⟦…⟧`）。没有登录或付费墙。

协议、Base URL、模型、API Key、语言、`pageHotkey`、`paragraphHotkey`、`ballEnabled`、`denyOrigins`、`allowOrigins` 和阅读样式都只存在 `chrome.storage.local`。密钥留空则继续用 mock。扩展不读取 `config.yaml`。

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

当前扩展版本是 **1.0.1**（`dev-1.0.1`）。清单覆盖最初的 MVP 检查、悬停热键、0.3.0 的站点名单和阅读样式开关、0.4.0 的工具栏弹窗和悬浮球、0.4.1 的整页热键捕获、0.4.2 的段落热键、0.5.0 的选项页五分区、0.6.0 的三步首次引导、0.7.0 的站点名单编辑和本页一键加入，以及 0.8.0 的翻译失败提示（vendor 已与 translate-core 同步）。1.0.0 只对齐版本号。1.0.1 让悬浮球单击与弹层主按钮共用整页翻译状态，悬停文案跟随该状态和本机快捷键。

```bash
npm run accept
```

检查内容：vendor 与 `packages/translate-core` 同步（壳 `1.0.1`，包 `1.0.0`）；background 导入该 vendor，并按选项在 mock / OpenAI / Anthropic 之间选择；mock 批量结果为 `⟦…⟧`；包内 smoke；MV3 manifest（壳版本 `1.0.1`，translate-core `1.0.0`）；翻译失败把 `kind` / `code` / `status` 和说明传到页面毛玻璃提示、悬浮球和弹窗，空密钥仍是 mock；站点名单可编辑，弹窗和悬浮球可把本页 origin 加入或移出，两边都有时以永不翻译为准；首次引导正好三步且可跳过，结束前不与悬浮球一次性提示连弹；选项页五个分区和毛玻璃令牌，且没有登录或付费墙文案；段落热键规范值是 `Alt+T`（macOS 显示 **⌥T**，Windows / Linux 显示 **Alt+T**），整页是 `Alt+A`（macOS **⌥A**），捕获阶段命中后取消默认动作，单段走一次 `TRANSLATE_BATCH`；浏览器吃掉段落键时，manifest 命令 `translate-hovered-paragraph` 仍只译悬停段，且须与已保存的快捷键一致；git 文件里没有本机绝对路径或形如密钥的秘密；`config.yaml` 的 `apiKey` 为空；`config.local.yaml` 已被 gitignore；YAML 合并优先级；`extension/` 里既没有本地 YAML，也没有密钥。

`npm run accept` 通过后，按下面的清单在本机点一遍。加载方式见上文 [安装](#安装)（须把图标钉到工具栏）。

### 本机验收清单

除失败提示和最后一项外，API Key 留空。设置页应写明无强制登录、无升级弹窗。

- [ ] **首次引导**：扩展 Service Worker 控制台执行 `chrome.storage.local.remove(["onboardingDone", "ballTipSeen"])`，刷新文章页。左上角出现毛玻璃卡片，依次只有三步：钉到工具栏、点弹层译一页、认识悬浮球。页面仍可滚动；悬浮球可点，弹层也能打开。没有登录、条款勾选、Pro 或粉色主按钮。**跳过路径**：点三次「跳过」，卡片消失；再刷新，卡片不回来，这一页也不会马上冒出球旁提示。**完成路径**：再清一次上述两个键并刷新，点「下一步」「下一步」「完成」，结果与跳过路径相同。**全部跳过**：再清一次两个键并刷新，在第一步点「全部跳过」。本页没有球旁提示；再刷新一次，引导不出现，球旁提示出现一次。点「知道了」后再刷新，两张卡都不再出现。
- [ ] **钉到工具栏 + 弹窗**：按 [安装](#安装) 加载 `extension/` 并钉到工具栏。文章页点击图标应打开弹窗，而不是直接静默切换。空 API Key 时状态行标明 Mock 模式。主按钮在未翻译时为「翻译 (⌥A)」（macOS）或「翻译 (Alt+A)」（Windows / Linux）；点后段落下出现双语 `⟦原文⟧`，状态变为已翻译，按钮变为「显示原文」；再点一次，译文节点消失。同一快捷键也会切换整页。「打开设置」会打开选项页。弹窗里没有协议、模型、密钥、登录、Pro 或快捷宫格。弹窗另有「本页加入永不翻译」和「本页加入始终翻译」，不编辑整份名单。
- [ ] **整页快捷键**：文章页焦点不在输入框时，Windows / Linux 按 **Alt+A**、macOS 按 **⌥A**，应在翻译和显示原文之间切换，并和弹窗、悬浮球是同一状态。悬停一段时 **Alt+T** / **⌥T** 仍只译该段。输入框里按这些组合不会触发。若系统仍抢走整页组合，弹窗主按钮和悬浮球仍能切换。
- [ ] **悬浮球**：默认在右侧偏下，外观与弹窗同一套毛玻璃。拖动后松开，会贴到左缘或右缘，竖直位置保持刚才松开的高度；刷新后还在。单击与弹窗主按钮共用同一状态：未翻译时整页出现 `⟦原文⟧`，再点一次恢复原文；球上没有「翻译」「显示原文」文字按钮。悬停文案在 macOS 为「点击翻译为简体中文 (⌥A)」或「已翻译 · 点击显示原文 (⌥A)」，Windows / Linux 把括号换成 Alt+A。打开弹窗，主按钮与球一致。球旁「打开弹层」能打开工具栏弹层或选项页。已翻译时球角有一枚小标记。第一次出现一张提示，点「知道了」或点这张卡后不再出现。球上方的「站点」打开「本页加入永不翻译」和「本页加入始终翻译」。来源在永不翻译名单里时，页面上没有这颗球，也没有「站点」按钮。
- [ ] **悬停 + 段落快捷键**：悬停主内容一段（蓝色描边），按 macOS **⌥T** 或 Windows / Linux **Alt+T**，只有该段出现双语行。再按一次不会多出一块译文。未悬停时这个键不切换整页。
- [ ] **设置页改快捷键**：选项页聚焦「段落快捷键」，按下含修饰键的组合并保存；悬停另一段用新组合只译该段，原来的 Alt+T / ⌥T 不再译段。macOS 上捕获和「恢复默认」都显示 ⌥ / ⌘，不会把「Alt+T」当作默认文案。Windows / Linux 仍显示 Alt+T。点「恢复默认」写回该平台的默认段落键，悬停后该默认键又能只译一段。
- [ ] **本页站点与永不翻译优先**：在文章页打开弹窗（或点悬浮球上的「站点」），点 **本页加入永不翻译**。状态变为「本站永不翻译」，主按钮不能再译，整页快捷键和段落快捷键都不插入译文，悬浮球从页面上消失。刷新后仍然如此。再打开弹窗，点 **本页移出永不翻译**，球回来，也可以再译。然后点 **本页加入始终翻译**，刷新或留在本页应自动出现译文。再点 **本页加入永不翻译**（始终翻译那一条还在）：本页仍不翻译，弹窗会说明以永不翻译为准；选项页里始终翻译那一行标着「已被永不翻译覆盖」。在选项页把一条域名改成另一个域名再刷新，名单里是新值。移出后两条名单都不再命中该页。
- [ ] **选项页五分区**：打开设置。左侧依次是基本、快捷键、悬浮球、站点名单、引擎与密钥，右侧是对应内容，外观为毛玻璃而不是整页纯白，主按钮为蓝色。基本里改字号或双语对照 / 仅译文，已译页面马上变样。快捷键区的整页与段落键按本机显示 ⌥/⌘ 或 Alt/Ctrl。关掉悬浮球后页面上没有球，再打开后球回来，高度仍是上次记住的。站点名单仍可加入永不翻译。引擎区密钥留空时标明 mock `⟦…⟧`。没有登录或付费墙。刷新选项页后，刚才保存的项还在。
- [ ] **样式即时生效**：已译页面上改译文字号、对比度，或双语对照 / 仅译文，当前页马上变样，不用刷新。
- [ ] **翻译失败可见**：选项页「引擎与密钥」填一个非空假 API Key（例如 `not-a-real-key`），把 Base URL 改成到不了的地址 `https://127.0.0.1:9`，保存。文章页用弹窗「翻译」、悬浮球或整页快捷键发起翻译。请求失败后（管道会先短暂重试）页面右上角出现毛玻璃提示，不挡住滚动和点击。文字里有失败说明，并带 `kind`（连不上主机时为 `network`）。弹窗提示行和悬浮球旁是同一句。然后清空 API Key 并保存，再译一页：段落下出现 `⟦原文⟧`，不再出现失败提示。
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

- 开发在 `dev-*`（当前 `dev-1.0.1`，扩展版本 `1.0.1`）
- 阶段完成后合入 `main`
- 发布时打 tag，并创建 GitHub Release。已有 `v0.1.0` 至 `v0.3.0`。早先的 `v1.0.0` tag 已撤回。没有长期 `release-*` 分支

未完成的工作留在当前 `dev-*`，该阶段合入 `main` 后再作为稳定线。

## 安全要点

- 仓库里不放 API Key
- 见 [SECURITY.md](SECURITY.md)

## 许可证

[MIT](LICENSE)

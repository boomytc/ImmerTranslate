<p align="center">
  <img src="public/images/logo128.png" alt="ImmerTranslate" width="96" height="96">
</p>

<h1 align="center">ImmerTranslate</h1>

<p align="center">面向 Chrome 与 Edge 桌面浏览器的双语对照网页翻译扩展：原文与译文同屏对照，支持免钥服务与自带密钥，配置与密钥只留在本机。</p>

<p align="center">
  <img alt="许可证 GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue">
  <img alt="支持 Chrome 与 Edge" src="https://img.shields.io/badge/%E6%94%AF%E6%8C%81-Chrome%20%7C%20Edge-informational">
</p>

<p align="center">
  <a href="README.en.md">English</a>
</p>

## 为什么用它

- **双语对照阅读。** 整页翻译后，译文紧跟在原文下方，尽量保留网页原有排版与链接；也可以切换为「仅显示译文」。
- **免钥即可上手。** 装好就能直接使用 Microsoft、Google 等免钥服务，无需注册账号。
- **自带密钥直连。** 填写自己的大模型或云端翻译 API Key，密钥只存在本机扩展存储中，请求直接发往你配置的接口地址。
- **覆盖常见阅读与输入场景。** 除整页翻译外，还支持划词翻译、段落悬停翻译、输入框翻译与 YouTube 桌面端双语字幕。
- **按网站记住偏好。** 每个站点都可单独设为自动翻译或不自动翻译，也可以记住该站使用的翻译服务。未单独设置的站点跟随全局规则。

## 能做什么

| 场景               | 说明                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 整页翻译           | 通过工具栏弹窗、悬浮球或快捷键（默认 `Alt+Q`）翻译当前页；长页面支持滚动分批加载，也可切换「仅显示译文」。                         |
| 划词与文本翻译     | 选中文字后点击弹出按钮（或直接弹出面板）看译文、查词典、复制或朗读；工具栏弹窗也支持文本翻译并可打开独立窗口。                     |
| 段落（悬停）翻译   | 在「段落翻译」中开启后，配合快捷键悬停或按住鼠标左键，可在当前位置双语对照或以译文气泡形式翻译段落。                               |
| 输入框翻译         | 在网页输入框中写完后，点击输入框旁的翻译图标、按快捷键（默认 `Alt+I`）或输入结尾符号（如 `/`）直接译成目标语言。                   |
| 视频字幕           | 支持 YouTube 桌面网站双语字幕，内置规则断句并可选 AI 智能断句，支持样式调整与字幕导出。                                            |
| 悬浮球（悬浮按钮） | 一键翻译整页、切换双语或仅译文、切换翻译服务/模型/目标语言与样式、设置当前站点自动翻译，或在此网站隐藏。当前网站的翻译服务会记住。 |
| 规则与术语         | 遵循「个人规则 > 内置网站规则 > 全局规则」优先级，支持可视化「编辑网站规则」、CSS 选择器增删（`+`/`-`）与专业术语替换。            |
| 数据同步           | 支持 WebDAV（默认）和私密 GitHub Gist 同步设置与规则，数据在上传前先使用同步加密口令加密。                                         |

适用环境：Chrome 与 Edge 桌面浏览器（Manifest V3 扩展，当前代码基线版本为 0.2.0）。界面语言支持简体中文与 English。

## 翻译服务

- **免钥服务：** 默认开启 **Microsoft** 与 **Google**；另预置 **DeepLFree**、**YandexFree**、**Tencent**、**Volcengine** 以及浏览器内置 AI（**BuiltinAI**，需 Chrome 138+ 并在 `chrome://flags` 开启 Translation API），可在设置页按需启用。
- **自带密钥（大模型）：** 预置 **OpenAI**、**Claude**（Anthropic）、**Gemini** / **Gemini (OpenAI 兼容)**、**DeepSeek**、**OpenCodeGo**、**SiliconFlow**、**XiaomiMimo**、**AliyunBailian**（DashScope）、**ModelScope**、**ModelBest**、**Cerebras**、**Zai**（智谱）、**OpenRouter**、**OrcaRouter**、**Requesty**、**ePhoneAI**、**APIMart** 等，也支持接入本地 **Ollama**（密钥可选）或其他兼容接口。
- **自带密钥（翻译 API 与自定义）：** 预置 **DeepL**、**GoogleCloud**、**AzureAI**、**Yandex**、**QwenMT** 与 **CloudflareAI**；另支持自建或本地 **DeepLX**（密钥可选），以及使用 **Custom** 接口配合请求/响应钩子接入其他协议（见 [custom-api.md](custom-api.md)）。

除 Microsoft 和 Google 外，其余预置服务默认处于禁用状态。到扩展设置页的「翻译服务」关闭「是否禁用」（需要密钥的服务再填写自己的 API Key，并按需修改接口地址或模型），保存后即可选用。大模型翻译默认关闭思考模式。详细配置见 [docs/BYOK.md](docs/BYOK.md)。

## 安装

供个人使用。不发布安装包，也不上架浏览器商店。在本机克隆源码、构建后，用开发者模式加载未打包目录。

需要 Node.js 24 与 pnpm（仓库固定为 pnpm 9.14.4）。

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome   # 仅构建 Chrome，输出到 build/chrome
pnpm build          # 同步版本号后构建 Chrome 与 Edge，输出到 build/chrome 与 build/edge
```

| 浏览器 | 加载目录       | 步骤                                                                                                                              |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Chrome | `build/chrome` | 打开 `chrome://extensions`，开启右上角「开发者模式」，点击「加载已解压的扩展程序」，选择 `build/chrome`（内含 `manifest.json`）。 |
| Edge   | `build/edge`   | 打开 `edge://extensions`，开启「开发人员模式」，点击「加载解压缩的扩展」，选择 `build/edge`（内含 `manifest.json`）。             |

装好后点击浏览器工具栏的扩展图标即可开始使用，首次使用可直接用默认的 Microsoft 或 Google 免钥服务。

更新时在仓库里拉取最新源码，重新执行上面的构建，再在扩展管理页点击刷新。扩展不会自动更新。改坏了就重新构建并重新加载；本机扩展存储可以在扩展管理页移除后重装。

本地检查：

- `pnpm check`（也可指定基准标签或提交，如 `pnpm check -- v0.2.0`）：检查是否有遗留的测试文件，校验代码格式、版本号与 `CHANGELOG.md`，并完成 Chrome / Edge 构建与产物校验。

维护约定见 [AGENTS.md](AGENTS.md)，版本号见 [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md)，历史变更见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

本项目基于 GPL-3.0 开源项目二次开发，同样以 [GPL-3.0](LICENSE) 协议发布。分发修改后的版本时，请保留许可证并附带对应源码。

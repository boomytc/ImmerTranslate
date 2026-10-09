<p align="center">
  <img src="public/images/logo128.png" alt="ImmerTranslate" width="96" height="96">
</p>

<h1 align="center">ImmerTranslate</h1>

<p align="center">双语对照的网页翻译扩展：原文和译文并排阅读，用自己的服务和密钥，数据留在本机。</p>

<p align="center">
  <a href="https://github.com/boomytc/ImmerTranslate/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/boomytc/ImmerTranslate?label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC"></a>
  <img alt="许可证 GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue">
  <img alt="Chrome Edge Firefox Thunderbird 用户脚本" src="https://img.shields.io/badge/%E6%94%AF%E6%8C%81-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Thunderbird%20%7C%20%E7%94%A8%E6%88%B7%E8%84%9A%E6%9C%AC-informational">
</p>

<p align="center">
  <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

## 为什么用它

- **双语对照。** 整页翻译后，译文紧跟在原文下面，排版和链接不变；也可以只看译文。
- **免钥即用。** Google、Microsoft 等免钥服务装好就能翻，不用注册账号。
- **自带密钥。** 想用大模型就填自己的 Key，密钥只存在本机的扩展存储里，不经过任何第三方。
- **不止整页。** 划词、悬停、输入框、视频字幕，各有对应的入口。
- **记住每个网站。** 每个站点可以单独设为自动翻译或不翻译，其余跟随全局设置。

## 能做什么

| 场景       | 说明                                                     |
| ---------- | -------------------------------------------------------- |
| 整页翻译   | 一键或快捷键翻译当前页，长页面会分批请求。               |
| 划词翻译   | 选中文字后点浮钮，在面板里看译文、复制、朗读。           |
| 悬停翻译   | 鼠标停在段落上，弹出译文气泡。                           |
| 输入框翻译 | 在输入框里写完，直接译成目标语言。                       |
| 视频字幕   | 支持 YouTube 字幕的双语显示。                            |
| 悬浮球     | 切换双语或仅译文、换翻译服务和模型、设置当前站点怎么翻。 |
| 规则与术语 | 按网站保存翻译规则，可订阅规则列表，支持术语表。         |
| 同步       | 设置可加密后经 WebDAV 等方式同步。                       |

界面语言：English、简体中文、繁體中文、日本語、한국어、Türkçe、Tiếng Việt、Русский。

## 翻译服务

- **免钥：** Google、Microsoft、DeepL 网页接口、Yandex 网页接口，以及浏览器内置 AI（浏览器支持时可用）。
- **自带密钥：** OpenAI、Anthropic（Claude）、DeepSeek、MiMo、DashScope、ModelScope、ModelBest 等大模型服务，以及 DeepL、Google Cloud、Azure、百度、腾讯、火山等翻译 API，也可接入任何兼容 OpenAI 的自定义接口。

预置的大模型服务默认禁用，在选项页启用后填地址、Key 和模型即可。翻译请求默认关闭思考模式。详细说明见 [docs/BYOK.md](docs/BYOK.md)。

## 安装

目前还没有上架浏览器商店，请从 [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases/latest) 下载对应的压缩包：

| 浏览器      | 文件                                     | 安装方式                                                                         |
| ----------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| Chrome      | `immer-translate_<版本>_chrome.zip`      | 解压，打开 `chrome://extensions`，开启开发者模式，选择「加载已解压的扩展程序」。 |
| Edge        | `immer-translate_<版本>_edge.zip`        | 解压，打开 `edge://extensions`，开启开发人员模式，选择「加载解压缩的扩展」。     |
| Firefox     | `immer-translate_<版本>_firefox.zip`     | 打开 `about:debugging`，选择「临时载入附加组件」。                               |
| Thunderbird | `immer-translate_<版本>_thunderbird.zip` | 在附加组件管理器里从文件安装。                                                   |
| 用户脚本    | `immer-translate_<版本>_userscript.zip`  | 解压后把 `immer-translate.user.js` 装进 Tampermonkey 等脚本管理器。              |

装好后点击工具栏图标即可开始；第一次可以直接用免钥服务试一下。

## 从源码构建

需要 Node.js 24 与 pnpm。

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

构建结果在 `build/chrome`，按上面的方法加载即可。`pnpm build` 会一次生成所有客户端，`pnpm test` 运行单元测试。版本与发布流程见 [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

本项目基于 GPL-3.0 开源项目二次开发，同样以 [GPL-3.0](LICENSE) 发布。分发修改后的版本时，请保留许可证并提供对应源码。

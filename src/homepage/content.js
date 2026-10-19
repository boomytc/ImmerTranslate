export const THEME_STORAGE_KEY = "kiss-homepage-theme";
export const LICENSE_SOURCE_URL = "https://github.com/fishjar/kiss-translator";
export const languageOptions = [
  {
    value: "en",
    label: "English",
  },
  {
    value: "zh_CN",
    label: "简体中文",
  },
];
const RELEASES_URL = "https://github.com/boomytc/ImmerTranslate/releases";
const createInstalls = (meta = {}) => {
  return [
    {
      name: "Chrome",
      meta: meta.extension || "Browser extension",
      href: RELEASES_URL,
    },
    {
      name: "Edge",
      meta: meta.extension || "Browser extension",
      href: RELEASES_URL,
    },
    {
      name: "Thunderbird",
      meta: meta.release || "Release package",
      href: RELEASES_URL,
    },
  ];
};
const baseContent = {
  en: {
    navGithub: "GitHub",
    languageLabel: "Language",
    themeLight: "Switch to light mode",
    themeDark: "Switch to dark mode",
    version: "Version",
    eyebrow: "Open-source translation toolkit",
    title:
      "Minimalist. Open-source. An all-scenario geek-style translation tool.",
    subtitle:
      "ImmerTranslate brings page translation, selection lookup, input-box translation, and YouTube subtitles into one lightweight browser extension.",
    installExtension: "Install Extension",
    openOptions: "Open Script Settings",
    github: "GitHub",
    status: ["Extension", "AI APIs", "Rules", "Sync"],
    installTitle: "Install targets",
    installSubtitle: "Pick the client that fits your browser and workflow.",
    featureTitle: "Translation workspace",
    featureSubtitle:
      "A compact dashboard for reading, selecting, writing, watching, and building with your preferred translation providers.",
    features: [
      {
        title: "Webpage bilingual translation",
        body: "Translate page text while keeping the original content readable beside the result.",
      },
      {
        title: "Selection popup",
        body: "Open a compact translation box on any page, compare providers, use dictionary lookup, and save words.",
      },
      {
        title: "Input-box translation",
        body: "Translate what you are writing directly from input fields with shortcuts.",
      },
      {
        title: "Hover translation",
        body: "Translate the paragraph under your pointer without leaving the page.",
      },
      {
        title: "YouTube subtitles",
        body: "Translate subtitles bilingually with merging, sentence breaking, AI segmentation, and custom styling.",
      },
      {
        title: "Custom API hooks",
        body: "Connect traditional services, AI providers, local models, and custom endpoints with request and response hooks.",
      },
      {
        title: "Streaming results",
        body: "Show AI translation output as it arrives and keep context memory for better long-form translation.",
      },
      {
        title: "Rules and terminology",
        body: "Use automatic detection, manual site rules, subscriptions, shared rules, and custom terminology.",
      },
      {
        title: "Private sync",
        body: "Synchronize settings through WebDAV or a self-hosted proxy while keeping data under your control.",
      },
    ],
    providers: [
      "OpenAI",
      "Gemini",
      "Claude",
      "Ollama",
      "DeepSeek",
      "OpenRouter",
      "DeepL",
      "Google",
      "Microsoft",
      "Tencent",
      "Volcengine",
      "BuiltinAI",
    ],
  },
};
const licenseAttribution = {
  en: "Based on a GPL-3.0 open-source project",
  zh_CN: "基于 GPL-3.0 开源项目二次开发",
};
const translations = {
  zh_CN: {
    navGithub: "GitHub",
    languageLabel: "语言",
    themeLight: "切换到亮色模式",
    themeDark: "切换到暗色模式",
    version: "版本",
    eyebrow: "开源翻译工具箱",
    title: "简约。开源。全场景极客式翻译工具。",
    subtitle:
      "ImmerTranslate 将网页翻译、划词查询、输入框翻译和 YouTube 字幕整合到一个轻量的浏览器扩展中。",
    installExtension: "安装扩展",
    openOptions: "打开脚本设置",
    github: "GitHub",
    status: ["浏览器扩展", "AI 接口", "规则", "同步"],
    installTitle: "安装入口",
    installSubtitle: "选择适合你的浏览器和使用方式的客户端。",
    featureTitle: "翻译工作台",
    featureSubtitle:
      "覆盖阅读、划词、写作、视频字幕和自定义接口的紧凑能力面板。",
    features: [
      {
        title: "网页双语翻译",
        body: "在保留原文可读性的同时显示译文，尽量不破坏页面结构。",
      },
      {
        title: "划词翻译",
        body: "在任意页面打开翻译框，对比多个服务，查询词典并收藏词汇。",
      },
      {
        title: "输入框翻译",
        body: "通过快捷键直接翻译输入框中的内容，适合写作与回复。",
      },
      {
        title: "悬停翻译",
        body: "鼠标停留在段落上即可翻译，不打断当前阅读。",
      },
      {
        title: "YouTube 字幕",
        body: "支持双语字幕、合并断句、AI 断句和自定义字幕样式。",
      },
      {
        title: "自定义 API Hook",
        body: "接入传统翻译、AI 服务、本地模型和任意自定义接口。",
      },
      {
        title: "流式翻译",
        body: "实时展示 AI 翻译结果，并可利用上下文记忆提升长文效果。",
      },
      {
        title: "规则与术语",
        body: "支持自动识别、站点规则、规则订阅、规则分享和专业术语。",
      },
      {
        title: "私有同步",
        body: "通过 WebDAV 或自托管代理同步配置，数据自己掌控。",
      },
    ],
  },
};
export const homepageContent = Object.fromEntries(
  languageOptions.map(({ value }) => [
    value,
    {
      ...baseContent.en,
      ...translations[value],
      installs: createInstalls(translations[value]?.installMeta),
      licenseAttribution: licenseAttribution[value],
      providers: translations[value]?.providers ?? baseContent.en.providers,
    },
  ])
);

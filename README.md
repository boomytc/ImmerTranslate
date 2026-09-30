# ImmerTranslate

[English](README.en.md)

ImmerTranslate 是双语网页翻译扩展。仓库：[boomytc/ImmerTranslate](https://github.com/boomytc/ImmerTranslate)。许可证：GPL-3.0。

谱系参考（不是本产品名称）：[fishjar/kiss-translator](https://github.com/fishjar/kiss-translator)、[fishjar/kiss-rules](https://github.com/fishjar/kiss-rules)。

## 加载

需要 Node.js 与 pnpm。

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

`pnpm build` 也会生成同一目录。Chrome 打开 `chrome://extensions`，打开开发者模式，加载已解压的扩展程序，选择 `build/chrome`（目录内应有 `manifest.json`）。

## BYOK

预置服务不带密钥。Key 只留在本机扩展存储，不要写入仓库。下列预置默认禁用，在选项页启用后再填地址、Key 和模型：

- OpenAI
- Anthropic（预置名 Claude）
- DeepSeek
- MiMo（预置名 XiaomiMimo）
- DashScope（预置名 AliyunBailian）
- ModelScope

选项页的测试连接只调用 `fetchModelCatalog` 拉模型列表，不发 chat/completions。

翻译请求默认关闭思考 / 推理（`thinkingMode` 为 `disabled`，不注入思考参数）。

## 壳上已有的能力

- 网页双语对照翻译。
- 悬浮球快捷菜单：
  - 译文开关：双语对照，或仅显示译文。
  - 当前引擎的模型。没有第二套模型列表。
  - 当前站自动翻译三态：跟随全局、自动翻译、不自动翻译（个人规则的 `transOpen`）。
  - 翻译服务：只列出已启用且 Key 非空的供应商。选中后用 `MSG_TRANS_PUTRULE` 把 `apiSlug` 写进当前站的页面规则，不改选项页里的全局默认服务。
- 界面语言：简体中文（`zh`）与 English（`en`）。

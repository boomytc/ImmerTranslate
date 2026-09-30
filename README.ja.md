# ImmerTranslate

[中文](README.md) | [English](README.en.md) | [한국어](README.ko.md)

ImmerTranslate はバイリンガルウェブ翻訳拡張機能です。リポジトリ：[boomytc/ImmerTranslate](https://github.com/boomytc/ImmerTranslate)。ライセンス：GPL-3.0。

系譜の参照（本製品の名称ではありません）：[fishjar/kiss-translator](https://github.com/fishjar/kiss-translator)、[fishjar/kiss-rules](https://github.com/fishjar/kiss-rules)。

## 読み込み

Node.js と pnpm が必要です。

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

`pnpm build` も同じディレクトリを生成します。Chrome で `chrome://extensions` を開き、デベロッパーモードをオンにして「パッケージ化されていない拡張機能を読み込む」から `build/chrome` を選びます（中に `manifest.json` があること）。

## BYOK

プリセットのサービスにキーは含まれません。キーは拡張機能のローカルストレージにのみ置き、リポジトリへ書き込まないでください。次のプリセットは初期状態で無効です。オプションページで有効にしてから、アドレス、キー、モデルを入力します。

- OpenAI
- Anthropic（プリセット名 Claude）
- DeepSeek
- MiMo（プリセット名 XiaomiMimo）
- DashScope（プリセット名 AliyunBailian）
- ModelScope

オプションページの接続テストは `fetchModelCatalog` でモデル一覧を取得するだけで、chat/completions は送りません。

翻訳リクエストは既定で思考 / 推論をオフにします（`thinkingMode` は `disabled`。思考パラメータは注入しません）。

## シェル上にある機能

- ウェブページのバイリンガル対照翻訳。
- フローティングボールのショートカットメニュー：
  - 訳文の表示：バイリンガル対照、または訳文のみ。
  - 現在のエンジンのモデル。モデル一覧は一つだけです。
  - 現在のサイトの自動翻訳（三態）：グローバルに従う、自動翻訳、自動翻訳しない（個人ルールの `transOpen`）。
  - 翻訳サービス：有効かつキーが空でないプロバイダだけを列挙します。一つもないときは、その位置に空状態を出し、オプションページ `#/apis` を開きます。現在のサービスがキーを必要とし、キーが空のとき、フローティングボールとポップアップは同じ空状態を表示し、翻訳が完了したようには見せません。選択すると `MSG_TRANS_PUTRULE` で、現在のサイトのページルールに `apiSlug` を書き込みます。オプションページのグローバル既定サービスは変えません。キー不要のエンジン（Microsoft、Google、内蔵翻訳など）はそのまま使えます。
- 界面言語：簡体字中国語（`zh`）と English（`en`）。

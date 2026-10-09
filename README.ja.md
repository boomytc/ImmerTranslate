<p align="center">
  <img src="public/images/logo128.png" alt="ImmerTranslate" width="96" height="96">
</p>

<h1 align="center">ImmerTranslate</h1>

<p align="center">原文と訳文を並べて読めるバイリンガルのウェブ翻訳拡張機能。自分のサービスとキーを使え、データは手元に残ります。</p>

<p align="center">
  <a href="https://github.com/boomytc/ImmerTranslate/releases/latest"><img alt="最新リリース" src="https://img.shields.io/github/v/release/boomytc/ImmerTranslate?label=release"></a>
  <img alt="License GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue">
  <img alt="Chrome, Edge, Firefox, Thunderbird, ユーザースクリプト" src="https://img.shields.io/badge/works%20on-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Thunderbird%20%7C%20userscript-informational">
</p>

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.ko.md">한국어</a>
</p>

## 特長

- **対訳表示。** ページを翻訳すると、各段落の原文の下に訳文が並びます。レイアウトやリンクはそのままで、訳文のみの表示にもできます。
- **キーなしで使える。** Google や Microsoft などの無料サービスは、インストール後すぐ、アカウント不要で使えます。
- **自分のキーを使える。** 大規模言語モデルを使うときは自分のキーを入力します。キーは拡張機能のローカルストレージにだけ保存され、第三者を経由しません。
- **ページ全体だけではない。** 選択範囲、ホバー、入力欄、動画の字幕それぞれに入口があります。
- **サイトごとに記憶。** サイトごとに自動翻訳・翻訳しないを設定でき、それ以外はグローバル設定に従います。

## できること

| 場面                 | 内容                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| ページ全体           | ワンクリックまたはショートカットで翻訳。長いページは分割して要求します。                   |
| 選択翻訳             | 文字を選んでボタンを押すと、パネルで訳文の確認、コピー、読み上げができます。               |
| ホバー翻訳           | 段落にポインターを置くと訳文の吹き出しが出ます。                                           |
| 入力欄の翻訳         | 入力欄に書いた文章をその場で目的言語に翻訳します。                                         |
| 動画字幕             | YouTube の字幕をバイリンガルで表示します。                                                 |
| フローティングボール | 対訳と訳文のみの切り替え、サービスとモデルの変更、現在のサイトの翻訳方法の設定ができます。 |
| ルールと用語集       | サイトごとの翻訳ルールを保存し、ルール一覧の購読や用語集も使えます。                       |
| 同期                 | 暗号化した設定を WebDAV などで同期できます。                                               |

表示言語：English、简体中文、繁體中文、日本語、한국어、Türkçe、Tiếng Việt、Русский。

## 翻訳サービス

- **キー不要：** Google、Microsoft、DeepL と Yandex の Web エンドポイント、ブラウザ内蔵 AI（対応ブラウザのみ）。
- **自分のキーを使う：** OpenAI、Anthropic（Claude）、DeepSeek、MiMo、DashScope、ModelScope、ModelBest などの LLM サービス、DeepL、Google Cloud、Azure、百度、Tencent、Volcengine などの翻訳 API、OpenAI 互換のカスタムエンドポイント。

プリセットの LLM サービスは初期状態で無効です。オプションで有効にし、ベース URL、キー、モデルを入力してください。翻訳リクエストでは思考モードを既定でオフにしています。詳しくは [docs/BYOK.md](docs/BYOK.md) を参照してください。

## インストール

ブラウザストアにはまだ公開していません。[GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases/latest) からお使いのブラウザ用パッケージをダウンロードしてください。

| ブラウザ           | ファイル                                    | インストール方法                                                                                                         |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Chrome             | `immer-translate_<version>_chrome.zip`      | 展開し、`chrome://extensions` でデベロッパーモードをオンにして「パッケージ化されていない拡張機能を読み込む」を選びます。 |
| Edge               | `immer-translate_<version>_edge.zip`        | 展開し、`edge://extensions` で開発者モードをオンにして「展開して読み込み」を選びます。                                   |
| Firefox            | `immer-translate_<version>_firefox.zip`     | `about:debugging` を開き「一時的なアドオンを読み込む」を選びます。                                                       |
| Thunderbird        | `immer-translate_<version>_thunderbird.zip` | アドオンマネージャーでファイルからインストールします。                                                                   |
| ユーザースクリプト | `immer-translate_<version>_userscript.zip`  | 展開して `immer-translate.user.js` を Tampermonkey などに追加します。                                                    |

ツールバーのアイコンをクリックすれば開始できます。最初は無料サービスをそのまま試せます。

## ソースからビルド

Node.js 24 と pnpm が必要です。

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

出力は `build/chrome` にあります。上の手順で読み込んでください。`pnpm build` はすべてのクライアントをまとめてビルドし、`pnpm test` は単体テストを実行します。リリース手順は [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md)、各バージョンの変更点は [CHANGELOG.md](CHANGELOG.md) を参照してください。

## ライセンス

このプロジェクトは GPL-3.0 のオープンソースプロジェクトを基に二次開発したもので、同じく [GPL-3.0](LICENSE) で公開しています。改変版を配布する場合は、ライセンスを保持し、対応するソースコードを提供してください。

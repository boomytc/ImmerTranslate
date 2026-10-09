<p align="center">
  <img src="public/images/logo128.png" alt="ImmerTranslate" width="96" height="96">
</p>

<h1 align="center">ImmerTranslate</h1>

<p align="center">원문과 번역문을 나란히 읽는 이중 언어 웹 번역 확장 프로그램. 원하는 서비스와 키를 쓰고, 데이터는 내 기기에 남습니다.</p>

<p align="center">
  <a href="https://github.com/boomytc/ImmerTranslate/releases/latest"><img alt="최신 릴리스" src="https://img.shields.io/github/v/release/boomytc/ImmerTranslate?label=release"></a>
  <img alt="License GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue">
  <img alt="Chrome, Edge, Firefox, Thunderbird, 유저스크립트" src="https://img.shields.io/badge/works%20on-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Thunderbird%20%7C%20userscript-informational">
</p>

<p align="center">
  <a href="README.md">中文</a> · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a>
</p>

## 특징

- **대조 보기.** 페이지를 번역하면 각 문단의 원문 바로 아래에 번역문이 붙습니다. 레이아웃과 링크는 그대로이고, 번역문만 볼 수도 있습니다.
- **키 없이 사용.** Google, Microsoft 같은 무료 서비스는 설치 후 계정 없이 바로 쓸 수 있습니다.
- **내 키 사용.** 대규모 언어 모델을 쓸 때는 내 키를 입력합니다. 키는 확장 프로그램의 로컬 저장소에만 저장되며 제3자를 거치지 않습니다.
- **전체 페이지만이 아닙니다.** 선택한 텍스트, 마우스 오버, 입력창, 동영상 자막에 각각 진입점이 있습니다.
- **사이트별 기억.** 사이트마다 자동 번역 또는 번역 안 함으로 설정할 수 있고, 나머지는 전체 설정을 따릅니다.

## 할 수 있는 일

| 상황             | 설명                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| 전체 페이지      | 한 번의 클릭이나 단축키로 번역합니다. 긴 페이지는 나누어 요청합니다.                              |
| 선택 번역        | 텍스트를 선택하고 버튼을 누르면 패널에서 번역문을 보고, 복사하고, 들을 수 있습니다.               |
| 마우스 오버 번역 | 문단 위에 포인터를 두면 번역 말풍선이 나타납니다.                                                 |
| 입력창 번역      | 입력창에 쓴 글을 그 자리에서 대상 언어로 번역합니다.                                              |
| 동영상 자막      | YouTube 자막을 이중 언어로 표시합니다.                                                            |
| 플로팅 볼        | 대조 보기와 번역문만 보기를 전환하고, 서비스와 모델을 바꾸며, 현재 사이트의 번역 방식을 정합니다. |
| 규칙과 용어집    | 사이트별 번역 규칙을 저장하고, 규칙 목록을 구독하며, 용어집을 쓸 수 있습니다.                     |
| 동기화           | 암호화한 설정을 WebDAV 등으로 동기화할 수 있습니다.                                               |

인터페이스 언어: English, 简体中文, 繁體中文, 日本語, 한국어, Türkçe, Tiếng Việt, Русский.

## 번역 서비스

- **키 불필요:** Google, Microsoft, DeepL과 Yandex 웹 엔드포인트, 브라우저 내장 AI(지원하는 브라우저에서).
- **내 키 사용:** OpenAI, Anthropic(Claude), DeepSeek, MiMo, DashScope, ModelScope, ModelBest 등의 LLM 서비스, DeepL, Google Cloud, Azure, 바이두, Tencent, Volcengine 등의 번역 API, OpenAI 호환 사용자 지정 엔드포인트.

프리셋 LLM 서비스는 처음에 비활성 상태입니다. 옵션에서 활성화한 뒤 기본 URL, 키, 모델을 입력하세요. 번역 요청은 기본적으로 사고 모드를 끕니다. 자세한 내용은 [docs/BYOK.md](docs/BYOK.md)를 참고하세요.

## 설치

아직 브라우저 스토어에는 올라가 있지 않습니다. [GitHub Releases](https://github.com/boomytc/ImmerTranslate/releases/latest)에서 브라우저에 맞는 패키지를 내려받으세요.

| 브라우저     | 파일                                        | 설치 방법                                                                                                         |
| ------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Chrome       | `immer-translate_<version>_chrome.zip`      | 압축을 풀고 `chrome://extensions`에서 개발자 모드를 켠 뒤 「압축해제된 확장 프로그램을 로드합니다」를 선택합니다. |
| Edge         | `immer-translate_<version>_edge.zip`        | 압축을 풀고 `edge://extensions`에서 개발자 모드를 켠 뒤 「압축 풀기 로드」를 선택합니다.                          |
| Firefox      | `immer-translate_<version>_firefox.zip`     | `about:debugging`을 열고 「임시 부가 기능 로드」를 선택합니다.                                                    |
| Thunderbird  | `immer-translate_<version>_thunderbird.zip` | 부가 기능 관리자에서 파일로 설치합니다.                                                                           |
| 유저스크립트 | `immer-translate_<version>_userscript.zip`  | 압축을 풀고 `immer-translate.user.js`를 Tampermonkey 등에 추가합니다.                                             |

도구 모음 아이콘을 누르면 시작할 수 있습니다. 처음에는 무료 서비스로 바로 시험해 볼 수 있습니다.

## 소스에서 빌드

Node.js 24와 pnpm이 필요합니다.

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

결과물은 `build/chrome`에 있으며 위 방법으로 로드하면 됩니다. `pnpm build`는 모든 클라이언트를 한 번에 빌드하고, `pnpm test`는 단위 테스트를 실행합니다. 릴리스 절차는 [VERSION_MANAGEMENT.md](VERSION_MANAGEMENT.md), 버전별 변경 사항은 [CHANGELOG.md](CHANGELOG.md)를 참고하세요.

## 라이선스

이 프로젝트는 GPL-3.0 오픈 소스 프로젝트를 바탕으로 2차 개발했으며, 마찬가지로 [GPL-3.0](LICENSE)으로 공개합니다. 수정한 빌드를 배포할 때는 라이선스를 유지하고 해당 소스 코드를 제공하세요.

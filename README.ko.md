# ImmerTranslate

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

ImmerTranslate는 이중 언어 웹 페이지 번역 확장 프로그램입니다. 저장소: [boomytc/ImmerTranslate](https://github.com/boomytc/ImmerTranslate). 라이선스: GPL-3.0.

[GPL-3.0 오픈소스 프로젝트를 기반으로 이차 개발](https://github.com/fishjar/kiss-translator)

## 불러오기

Node.js와 pnpm이 필요합니다.

```sh
git clone https://github.com/boomytc/ImmerTranslate.git
cd ImmerTranslate
pnpm install
pnpm build:chrome
```

`pnpm build`도 같은 디렉터리를 만듭니다. Chrome에서 `chrome://extensions`를 열고 개발자 모드를 켠 뒤, 압축해제된 확장 프로그램을 로드하여 `build/chrome`을 선택합니다(안에 `manifest.json`이 있어야 합니다).

## BYOK

사전 설정 서비스에는 키가 들어 있지 않습니다. 키는 확장 프로그램의 로컬 저장소에만 두고, 저장소에 커밋하지 마세요. 아래 사전 설정은 기본적으로 꺼져 있습니다. 옵션 페이지에서 켠 다음 주소, 키, 모델을 입력합니다.

- OpenAI
- Anthropic(사전 설정 이름 Claude)
- DeepSeek
- MiMo(사전 설정 이름 XiaomiMimo)
- DashScope(사전 설정 이름 AliyunBailian)
- ModelScope
- ModelBest

옵션 페이지의 연결 테스트는 `fetchModelCatalog`로 모델 목록만 가져오며, chat/completions는 보내지 않습니다.

번역 요청은 기본적으로 사고 / 추론을 끕니다(`thinkingMode`는 `disabled`이며, 사고 파라미터를 넣지 않습니다).

## 셸에 있는 기능

- 웹 페이지 이중 언어 대조 번역.
- 플로팅 볼 바로가기 메뉴:
  - 번역문 표시: 이중 언어 대조, 또는 번역문만.
  - 현재 엔진의 모델. 모델 목록은 하나뿐입니다.
  - 현재 사이트의 자동 번역 세 가지 상태: 전역 설정을 따름, 자동 번역, 자동 번역 안 함(개인 규칙의 `transOpen`).
  - 번역 서비스: 켜져 있고 키가 비어 있지 않은 공급자만 나열합니다. 하나도 없으면 그 자리에 빈 상태를 보여주고 옵션 페이지 `#/apis`를 엽니다. 현재 서비스에 키가 필요한데 키가 비어 있으면, 플로팅 볼과 팝업은 같은 빈 상태를 보여주고 번역이 끝난 것처럼 표시하지 않습니다. 선택하면 `MSG_TRANS_PUTRULE`로 현재 사이트의 페이지 규칙에 `apiSlug`를 씁니다. 옵션 페이지의 전역 기본 서비스는 바꾸지 않습니다. 키가 필요 없는 엔진(Microsoft, Google, 내장 번역)은 그대로 쓸 수 있습니다.
- 인터페이스 언어: 간체 중국어(`zh`)와 English(`en`).

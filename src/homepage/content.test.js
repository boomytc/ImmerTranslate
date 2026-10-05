import {
  homepageContent,
  languageOptions,
  LICENSE_SOURCE_URL,
} from "./content";

const expectedStoreLocales = {
  en: { chromium: "en", firefox: "en-US" },
  zh_CN: { chromium: "zh-CN", firefox: "zh-CN" },
  zh_TW: { chromium: "zh-TW", firefox: "zh-TW" },
  ja: { chromium: "ja", firefox: "ja" },
  ko: { chromium: "ko", firefox: "ko" },
  fr: { chromium: "fr", firefox: "fr" },
  de: { chromium: "de", firefox: "de" },
  es: { chromium: "es", firefox: "es" },
  vi: { chromium: "vi", firefox: "vi" },
  ru: { chromium: "ru", firefox: "ru" },
};

const removedContentKeys = [
  "videoTitle",
  "videoSubtitle",
  "videoLabel",
  "watchOnYouTube",
  "ecosystemTitle",
  "ecosystemSubtitle",
  "ecosystemProjects",
];

const expectedLicenseAttribution = {
  en: "Based on a GPL-3.0 open-source project",
  zh_CN: "基于 GPL-3.0 开源项目二次开发",
  zh_TW: "基於 GPL-3.0 開源專案二次開發",
  ja: "GPL-3.0 のオープンソースプロジェクトを基に二次開発",
  ko: "GPL-3.0 오픈소스 프로젝트를 기반으로 이차 개발",
  fr: "Développement dérivé d'un projet open source GPL-3.0",
  de: "Weiterentwicklung eines Open-Source-Projekts unter GPL-3.0",
  es: "Desarrollo derivado de un proyecto de código abierto GPL-3.0",
  vi: "Phát triển dựa trên dự án mã nguồn mở GPL-3.0",
  ru: "Вторичная разработка на основе проекта с открытым кодом под GPL-3.0",
};

const expectedOpenOptions = {
  en: "Open Script Settings",
  zh_CN: "打开脚本设置",
  zh_TW: "開啟腳本設定",
  ja: "スクリプト設定を開く",
  ko: "스크립트 설정 열기",
  fr: "Ouvrir les paramètres du script",
  de: "Skripteinstellungen öffnen",
  es: "Abrir configuración del script",
  vi: "Mở cài đặt tập lệnh",
  ru: "Открыть настройки скрипта",
};

describe("homepage content", () => {
  test("provides complete content for every homepage language", () => {
    expect(languageOptions.map(({ value }) => value)).toEqual(
      Object.keys(expectedStoreLocales)
    );

    const upstreamName = ["ki", "ss"].join("");
    const upstreamAuthor = ["fish", "jar"].join("");

    languageOptions.forEach(({ value }) => {
      const content = homepageContent[value];

      expect(content.title).toBeTruthy();
      expect(content.subtitle).toBeTruthy();
      expect(content.features).toHaveLength(9);
      expect(content.installs).toHaveLength(6);
      expect(content.licenseAttribution).toBe(
        expectedLicenseAttribution[value]
      );
      removedContentKeys.forEach((key) => {
        expect(content[key]).toBeUndefined();
      });
      expect(JSON.stringify(content)).not.toMatch(
        new RegExp(`${upstreamName}|${upstreamAuthor}`, "i")
      );
    });
  });

  test("keeps a single license source link", () => {
    expect(LICENSE_SOURCE_URL.startsWith("https://github.com/")).toBe(true);
    expect(
      Object.values(homepageContent).map(
        (content) => content.licenseAttribution
      )
    ).toEqual(
      languageOptions.map(({ value }) => expectedLicenseAttribution[value])
    );
  });

  test("uses localized browser store links", () => {
    Object.entries(expectedStoreLocales).forEach(
      ([language, { chromium, firefox }]) => {
        const [chrome, edge, firefoxInstall] =
          homepageContent[language].installs;

        expect(chrome.href).toBe(
          "https://github.com/boomytc/ImmerTranslate/releases"
        );
        expect(edge.href).toBe(
          "https://github.com/boomytc/ImmerTranslate/releases"
        );
        expect(firefoxInstall.href).toBe(
          "https://github.com/boomytc/ImmerTranslate/releases"
        );
      }
    );
  });

  test("keeps non-store download targets unchanged", () => {
    const englishTargets = homepageContent.en.installs
      .slice(3)
      .map(({ href }) => href);

    languageOptions.forEach(({ value }) => {
      expect(
        homepageContent[value].installs.slice(3).map(({ href }) => href)
      ).toEqual(englishTargets);
    });
  });

  test("labels the options action as script settings in every language", () => {
    Object.entries(expectedOpenOptions).forEach(([language, label]) => {
      expect(homepageContent[language].openOptions).toBe(label);
    });
  });
});

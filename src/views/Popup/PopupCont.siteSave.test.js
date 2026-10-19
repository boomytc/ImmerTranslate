/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import PopupCont from "./PopupCont";
import { GLOBLA_RULE, MSG_TRANS_PUTRULE, STOKEY_RULES } from "../../config";
import { getRulesWithDefault, setRules } from "../../libs/storage";
import { findStorageState } from "../../libs/storageState";
import { readSiteTransOpen, SITE_TRANS_OPEN } from "../Action/sitePolicy";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../../hooks/Setting", () => ({
  useSetting: () => ({
    setting: { blacklist: "" },
    updateSetting: jest.fn(),
  }),
}));

jest.mock("../../hooks/CustomStyles", () => ({
  ...jest.requireActual("../../hooks/CustomStyles"),
  useAllTextStyles: () => ({
    allTextStyles: [{ styleSlug: "style_1", styleName: "Style 1" }],
  }),
}));

jest.mock("../../libs/msg", () => ({
  getCurTab: jest.fn(async () => ({ url: "https://example.com/page" })),
  sendBgMsg: jest.fn(async () => ({})),
  sendTabMsg: jest.fn(async () => undefined),
  sendTopFrameMsg: jest.fn(async () => undefined),
}));

jest.mock("../../libs/sync", () => ({
  trySyncRules: jest.fn(),
  syncData: jest.fn(),
}));

jest.mock("../../libs/modelList", () => ({
  fetchModelCatalog: jest.fn(async () => ({ models: [] })),
}));

jest.mock("../../libs/log", () => ({
  ...jest.requireActual("../../libs/log"),
  kissLog: jest.fn(),
}));

const HREF = "https://example.com/page";
const PATTERN = "example.com";

const setting = {
  transApis: [
    { apiSlug: "Google", apiName: "Google", apiType: "Google" },
    {
      apiSlug: "DeepL",
      apiName: "DeepL",
      apiType: "DeepL",
      key: "deepl-key",
    },
  ],
  tranboxSetting: { transOpen: true },
  mouseHoverSetting: { useMouseHover: false },
  inputRule: { transOpen: true },
  shortcuts: { toggleTranslate: ["AltLeft", "KeyQ"] },
};

function foldedRule(transOpen) {
  return {
    pattern: "*",
    enabled: true,
    transOpen,
    apiSlug: "Google",
    fromLang: "en",
    toLang: "ja",
    textStyle: "style_1",
    autoScan: "true",
    transOnly: "false",
    hasRichText: "true",
    scanAll: "false",
    isPlainText: "false",
    selector: "h1, p, folded",
    keepSelector: "code, folded",
    blockSelector: ".folded-block",
    rootsSelector: ".folded-root",
    ignoreSelector: ".folded-ignore",
    terms: "Folded=折叠",
    aiTerms: "Folded=AI",
    injectCss: ".folded { color: red }",
    wrapOriginal: "true",
    hasShadowroot: "true",
    transTitle: "true",
    blacklist: "should-not-save.example",
  };
}

async function seedRules(rules) {
  window.localStorage.clear();
  await setRules(rules);
  const state = findStorageState(STOKEY_RULES);
  if (state) await state.load();
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function buttonByText(container, text) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent === text
  );
}

async function clickText(container, text) {
  const button = buttonByText(container, text);
  expect(button).toBeTruthy();
  expect(button.disabled).toBe(false);
  await act(async () => {
    button.click();
  });
  await flush();
}

function renderPopup(rule) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function Harness() {
    const [currentRule, setCurrentRule] = useState(rule);
    return (
      <PopupCont
        rule={currentRule}
        setRule={setCurrentRule}
        setting={setting}
        handleOpenSetting={jest.fn()}
        processActions={async ({ action, args }) =>
          action === MSG_TRANS_PUTRULE ? { rule: { ...args } } : {}
        }
        targetTab={{ id: 1, url: HREF }}
        documentInfo={{ frameId: 0, token: "doc-1" }}
        isContent={false}
      />
    );
  }

  act(() => {
    root.render(<Harness />);
  });

  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function storedSiteRule() {
  const rules = await getRulesWithDefault();
  return rules.find((rule) => rule.pattern === PATTERN);
}

describe("popup Save leaves site policy to the policy control", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("Auto then Save keeps the stored policy and saves language and service", async () => {
    await seedRules([{ ...GLOBLA_RULE }]);
    const view = renderPopup(foldedRule("false"));
    try {
      await flush();
      await clickText(view.container, "site_trans_on");
      await clickText(view.container, "DeepL");
      await clickText(view.container, "save_rule");

      const saved = await storedSiteRule();
      expect(saved.transOpen).toBe("true");
      expect(readSiteTransOpen(HREF, await getRulesWithDefault())).toBe(
        SITE_TRANS_OPEN.AUTO_TRANSLATE
      );
      expect(saved.apiSlug).toBe("DeepL");
      expect(saved.fromLang).toBe("en");
      expect(saved.toLang).toBe("ja");
      expect(saved.textStyle).toBe("style_1");
      expect(saved.selector).toBeUndefined();
      expect(saved.terms).toBeUndefined();
      expect(saved.injectCss).toBeUndefined();
      expect(saved.blacklist).toBeUndefined();
      expect(saved.enabled).toBeUndefined();
    } finally {
      view.cleanup();
    }
  });

  test("Don't auto-translate then Save keeps that policy", async () => {
    await seedRules([{ ...GLOBLA_RULE }]);
    const view = renderPopup(foldedRule("true"));
    try {
      await flush();
      await clickText(view.container, "site_trans_off");
      await clickText(view.container, "save_rule");

      const saved = await storedSiteRule();
      expect(saved.transOpen).toBe("false");
      expect(readSiteTransOpen(HREF, await getRulesWithDefault())).toBe(
        SITE_TRANS_OPEN.DONT_AUTO_TRANSLATE
      );
      expect(saved.apiSlug).toBe("Google");
      expect(saved.toLang).toBe("ja");
    } finally {
      view.cleanup();
    }
  });

  test("Save without a site policy keeps Follow global", async () => {
    await seedRules([
      { ...GLOBLA_RULE },
      { pattern: PATTERN, selector: "article" },
    ]);
    const view = renderPopup(foldedRule("true"));
    try {
      await flush();
      await clickText(view.container, "save_rule");

      const saved = await storedSiteRule();
      const rules = await getRulesWithDefault();
      expect(readSiteTransOpen(HREF, rules, PATTERN)).toBe(
        SITE_TRANS_OPEN.FOLLOW_GLOBAL
      );
      expect(saved.transOpen).toBeUndefined();
      expect(saved.selector).toBe("article");
      expect(saved.apiSlug).toBe("Google");
      expect(saved.fromLang).toBe("en");
      expect(saved.toLang).toBe("ja");
      expect(saved.terms).toBeUndefined();
      expect(saved.blacklist).toBeUndefined();
    } finally {
      view.cleanup();
    }
  });
});

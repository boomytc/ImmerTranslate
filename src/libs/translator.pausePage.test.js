jest.mock("../apis", () => ({
  apiTranslate: jest.fn(async () => ({ trText: "译文", isSame: false })),
  apiMicrosoftDict: jest.fn(),
  apiYoudaoDict: jest.fn(),
}));

jest.mock("./detect", () => ({
  tryDetectLang: jest.fn(async () => "en"),
}));

jest.mock("./msg", () => ({
  sendBgMsg: jest.fn(),
}));

const { Translator } = require("./translator");
const { getFetchPool } = require("./pool");
const { getBatchQueue } = require("./batchQueue");

const translators = [];
let inputController;

beforeEach(() => {
  document.documentElement.innerHTML = "<head></head><body></body>";
  global.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.CSSStyleSheet = class {
    replaceSync() {}
  };
});

function createTranslator() {
  document.body.innerHTML =
    '<main id="root"><p>The quick brown fox jumps over the lazy dog.</p></main>';
  const translator = new Translator({
    rule: {
      transOpen: "true",
      rootsSelector: "#root",
      fromLang: "en",
      toLang: "zh-CN",
      autoScan: "true",
      hasShadowroot: "false",
      scanAll: "false",
      transTitle: "false",
    },
    setting: {
      transInterval: 0,
      rootMargin: 0,
      preInit: false,
      mouseHoverSetting: {},
      customStyles: [],
      transApis: [],
    },
  });
  translators.push(translator);
  return translator;
}

describe("Translator.pausePage", () => {
  afterEach(() => {
    translators.splice(0).forEach((translator) => translator.stop());
    inputController?.abort();
    inputController = null;
    document.body.innerHTML = "";
  });

  test("pause and continue drop only this page translator and leave shared pool work running", async () => {
    const translator = createTranslator();
    const disable = jest.spyOn(translator, "disable");
    const rescan = jest.spyOn(translator, "rescan");
    let selectionFinished = false;
    const selection = getFetchPool().push(async () => {
      selectionFinished = true;
      return "selection";
    });
    let inputSettled = false;
    inputController = new AbortController();
    const inputQueue = getBatchQueue(
      "pause-page-input",
      async () => ["input"],
      {
        batchInterval: 60000,
      }
    );
    const input = inputQueue.addTask(
      { text: "input box" },
      { signal: inputController.signal }
    );
    input.then(
      () => {
        inputSettled = true;
      },
      () => {
        inputSettled = true;
      }
    );

    translator.pausePage();
    await selection;

    expect(selectionFinished).toBe(true);
    await Promise.resolve();
    expect(inputSettled).toBe(false);
    expect(disable).not.toHaveBeenCalled();
    expect(rescan).not.toHaveBeenCalled();
    expect(translator.rule.transOpen).toBe("false");

    translator.continuePage();
    expect(rescan).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
    expect(translator.rule.transOpen).toBe("true");
    expect(inputSettled).toBe(false);
  });
});

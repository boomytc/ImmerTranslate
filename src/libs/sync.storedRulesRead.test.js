import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  KV_RULES_KEY,
  KV_SETTING_KEY,
  KV_WORDS_KEY,
  OPT_SYNCTYPE_GIST,
  STOKEY_RULES,
  STOKEY_SETTING,
  STOKEY_WORDS,
} from "../config";
import FabQuickOptions from "../views/Action/FabQuickOptions";
import PopupCont from "../views/Popup/PopupCont";
import * as storageStateModule from "./storageState";
import { syncSettingAndRules } from "./sync";
import { apiGetGist, apiUpdateGistFile } from "../apis";
import {
  getRulesWithDefault,
  getSettingWithDefault,
  getSyncWithDefault,
  getWordsWithDefault,
  setRules,
  setSetting,
  setWords,
  storage,
  updateSyncState,
} from "./storage";
import { decryptSyncValue, encryptSyncValue } from "./syncCrypto";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockLandedRules = [];

jest.mock("./storage", () => ({
  getSyncWithDefault: jest.fn(),
  putSync: jest.fn(),
  updateSyncState: jest.fn(),
  getSettingWithDefault: jest.fn(),
  getRulesWithDefault: jest.fn(),
  getWordsWithDefault: jest.fn(),
  getSetting: jest.fn(),
  getRules: jest.fn(),
  getWords: jest.fn(),
  setSetting: jest.fn(),
  setRules: jest.fn(),
  setWords: jest.fn(),
  storage: { withTransaction: jest.fn(), readSyncSnapshot: jest.fn() },
}));

jest.mock("../apis", () => ({
  apiSyncData: jest.fn(),
  apiCreateGist: jest.fn(),
  apiListGists: jest.fn(),
  apiGetGist: jest.fn(),
  apiUpdateGistFile: jest.fn(),
  apiFetchText: jest.fn(),
}));

jest.mock("./log", () => ({
  ...jest.requireActual("./log"),
  kissLog: jest.fn(),
}));

jest.mock("./syncCrypto", () => ({
  encryptSyncValue: jest.fn(),
  decryptSyncValue: jest.fn(),
}));

jest.mock("webdav", () => ({
  createClient: jest.fn(),
  getPatcher: jest.fn(() => ({ patch: jest.fn() })),
}));

jest.mock("./fetch", () => ({
  fetchPatcher: jest.fn(),
}));

jest.mock("../hooks/I18n", () => ({
  useI18n: () => (key, fallback) => fallback || key,
}));

jest.mock("../hooks/Setting", () => ({
  useSetting: () => ({
    setting: { blacklist: "", transApis: [], shortcuts: {} },
    updateSetting: jest.fn(),
  }),
}));

jest.mock("../hooks/Rules", () => ({
  useRules: () => ({ list: mockLandedRules, isLoading: false }),
}));

jest.mock("../hooks/CustomStyles", () => ({
  ...jest.requireActual("../hooks/CustomStyles"),
  useAllTextStyles: () => ({ allTextStyles: [] }),
}));

jest.mock("@emotion/react", () => ({
  ...jest.requireActual("@emotion/react"),
  ClassNames: ({ children }) => children({ css: () => "mock-css" }),
}));

jest.mock("./modelList", () => ({
  fetchModelCatalog: jest.fn(async () => ({ models: [] })),
}));

jest.mock("./msg", () => ({
  getCurTab: jest.fn(async () => ({ url: "http://localhost/" })),
  sendBgMsg: jest.fn(async () => ({})),
  sendTabMsg: jest.fn(async () => undefined),
  sendTopFrameMsg: jest.fn(async () => undefined),
}));

const SYNC_KEY = "github-token";
const SYNC_ENCRYPT_KEY = "sync-encrypt-passphrase";

const encryptedGistFileContent = (value, updateAt) =>
  JSON.stringify({
    key: KV_RULES_KEY,
    value: `cipher:${Buffer.from(JSON.stringify(value)).toString("base64")}`,
    updateAt,
  });

function render(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    cleanup() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("ordinary sync lands rules that popup and FAB can read", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLandedRules = [];
    encryptSyncValue.mockImplementation((value) =>
      Promise.resolve(`cipher:${Buffer.from(value).toString("base64")}`)
    );
    decryptSyncValue.mockImplementation((value) => {
      if (!value.startsWith("cipher:")) {
        return Promise.reject(new Error("Unsupported sync encryption format"));
      }
      return Promise.resolve({
        value: Buffer.from(value.slice("cipher:".length), "base64").toString(),
        encrypted: true,
      });
    });
    jest.spyOn(Date, "now").mockReturnValue(1000);
    const transaction = {
      getObj: () => getSyncWithDefault(),
      setObj: (key, value) =>
        ({
          [STOKEY_SETTING]: setSetting,
          [STOKEY_RULES]: setRules,
          [STOKEY_WORDS]: setWords,
        })[key](value),
    };
    storage.withTransaction.mockImplementation((operation) =>
      operation(transaction)
    );
    storage.readSyncSnapshot.mockImplementation(async (key) => ({
      value: await {
        [STOKEY_SETTING]: getSettingWithDefault,
        [STOKEY_RULES]: getRulesWithDefault,
        [STOKEY_WORDS]: getWordsWithDefault,
      }[key](),
      syncConfig: await getSyncWithDefault(),
    }));
    updateSyncState.mockImplementation(async (updater) => {
      const current = await getSyncWithDefault();
      await updater(current, transaction);
    });
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  test("a remote bogus transOpen is readable by the popup and the FAB", async () => {
    const remoteRules = [{ pattern: "localhost", transOpen: "bogus" }];
    getSyncWithDefault.mockResolvedValue({
      syncType: OPT_SYNCTYPE_GIST,
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [KV_SETTING_KEY]: { updateAt: 10, syncAt: 1 },
        [KV_RULES_KEY]: { updateAt: 10, syncAt: 1 },
        [KV_WORDS_KEY]: { updateAt: 10, syncAt: 1 },
      },
    });
    getSettingWithDefault.mockResolvedValue({ setting: true });
    getRulesWithDefault.mockResolvedValue([
      { pattern: "local.example", transOpen: "true" },
    ]);
    getWordsWithDefault.mockResolvedValue({ hello: true });
    apiGetGist.mockResolvedValue({
      files: {
        [KV_SETTING_KEY]: {
          content: encryptedGistFileContent({ setting: true }, 50),
        },
        [KV_RULES_KEY]: {
          content: encryptedGistFileContent(remoteRules, 50),
        },
        [KV_WORDS_KEY]: {
          content: encryptedGistFileContent({ hello: true }, 50),
        },
      },
    });

    await expect(syncSettingAndRules()).resolves.toBeDefined();
    expect(apiUpdateGistFile).not.toHaveBeenCalled();
    const stored = setRules.mock.calls[0][0];
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern: "localhost", transOpen: "*" }),
      ])
    );
    mockLandedRules = stored;

    const rulesState = {
      snapshot: { data: stored, isLoading: false },
      configureSync: jest.fn(),
      subscribe(listener) {
        listener(this.snapshot);
        return () => {};
      },
      ensureLoaded: jest.fn(async () => {}),
      save: jest.fn(),
    };
    const spy = jest
      .spyOn(storageStateModule, "getStorageState")
      .mockImplementation((key, defaultValue) => {
        if (key === STOKEY_RULES) return rulesState;
        return {
          snapshot: { data: defaultValue, isLoading: false },
          configureSync: jest.fn(),
          subscribe(listener) {
            listener(this.snapshot);
            return () => {};
          },
          ensureLoaded: jest.fn(async () => {}),
          save: jest.fn(),
        };
      });

    let popup;
    let fab;
    try {
      expect(() => {
        popup = render(
          <PopupCont
            rule={{
              transOpen: "false",
              apiSlug: "microsoft",
              fromLang: "auto",
              toLang: "zh-CN",
            }}
            setting={{
              transApis: [],
              tranboxSetting: {},
              mouseHoverSetting: {},
              inputRule: {},
              shortcuts: {},
              blacklist: "",
            }}
            setRule={jest.fn()}
            handleOpenSetting={jest.fn()}
            targetTab={{ id: 1, url: window.location.href }}
          />
        );
      }).not.toThrow();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(
        popup.container.querySelector(".kt-popup-site-policy__error")
      ).toBeNull();
      expect(
        popup.container.querySelector(".kt-popup-policy-mode--active")
          .textContent
      ).toBe("site_trans_follow");

      expect(() => {
        fab = render(<FabQuickOptions />);
      }).not.toThrow();
      expect(
        fab.container.querySelector(".kt-content-fab-menu__site-select").value
      ).toBe("*");
    } finally {
      spy.mockRestore();
      popup?.cleanup();
      fab?.cleanup();
    }
  });
});

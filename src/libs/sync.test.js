jest.mock("../config", () => ({
  ...jest.requireActual("../config/client"),
  APP_LCNAME: "immertranslate",
  GLOBAL_KEY: "*",
  KV_SETTING_KEY: "kiss-setting_v2.json",
  KV_RULES_KEY: "kiss-rules_v2.json",
  STOKEY_SETTING: "setting",
  STOKEY_RULES: "rules",
  STOKEY_SYNC: "sync",
  OPT_SYNCTYPE_WEBDAV: "WebDAV",
  OPT_SYNCTYPE_GIST: "GitHub Gist",
}));

jest.mock("./storage", () => ({
  getSyncWithDefault: jest.fn(),
  putSync: jest.fn(),
  updateSyncState: jest.fn(),
  getSettingWithDefault: jest.fn(),
  getRulesWithDefault: jest.fn(),
  getSetting: jest.fn(),
  getRules: jest.fn(),
  setSetting: jest.fn(),
  setRules: jest.fn(),
  storage: { withTransaction: jest.fn(), readSyncSnapshot: jest.fn() },
}));

jest.mock("../apis", () => ({
  apiCreateGist: jest.fn(),
  apiListGists: jest.fn(),
  apiGetGist: jest.fn(),
  apiUpdateGistFile: jest.fn(),
  apiFetchText: jest.fn(),
}));

jest.mock("./utils", () => ({
  sha256: jest.fn(),
  removeEndchar: jest.fn((value) => value.replace(/\/$/, "")),
}));

jest.mock("webdav", () => ({
  createClient: jest.fn(),
  getPatcher: jest.fn(() => ({
    patch: jest.fn(),
  })),
}));

jest.mock("./fetch", () => ({
  fetchPatcher: jest.fn(),
}));

jest.mock("./log", () => ({
  kissLog: jest.fn(),
}));

jest.mock("./rules", () => ({
  checkRules: jest.fn((rules) =>
    rules.map((rule) => ({
      ...rule,
      transOpen: ["*", "true", "false"].includes(rule.transOpen)
        ? rule.transOpen
        : "*",
    }))
  ),
}));

jest.mock("./syncCrypto", () => ({
  encryptSyncValue: jest.fn(),
  decryptSyncValue: jest.fn(),
}));

import { changeSyncEncryptKey, syncData, syncSettingAndRules } from "./sync";
import {
  apiCreateGist,
  apiGetGist,
  apiListGists,
  apiUpdateGistFile,
} from "../apis";
import {
  getSettingWithDefault,
  getRulesWithDefault,
  getSyncWithDefault,
  putSync,
  setSetting,
  setRules,
  updateSyncState,
  storage,
} from "./storage";
import { decryptSyncValue, encryptSyncValue } from "./syncCrypto";
import { checkRules } from "./rules";
import { createClient, getPatcher } from "webdav";

const SYNC_DESCRIPTION = "kiss translator sync files";
const SYNC_KEY = "github-token";
const SYNC_ENCRYPT_KEY = "sync-encrypt-passphrase";
const RECOVERY_OLD_ENCRYPT_KEY = "recovery-old-passphrase";
const NEW_SYNC_ENCRYPT_KEY = "new-sync-encrypt-passphrase";
const SETTING_KEY = "kiss-setting_v2.json";
const RULES_KEY = "kiss-rules_v2.json";

beforeEach(() => {
  const transaction = {
    getObj: () => getSyncWithDefault(),
    setObj: (key, value) =>
      ({
        setting: setSetting,
        rules: setRules,
      })[key](value),
  };
  storage.withTransaction.mockImplementation((operation) =>
    operation(transaction)
  );
  storage.readSyncSnapshot.mockImplementation(async (key) => ({
    value: await {
      setting: getSettingWithDefault,
      rules: getRulesWithDefault,
    }[key](),
    syncConfig: await getSyncWithDefault(),
  }));
  updateSyncState.mockImplementation(async (updater) => {
    const current = await getSyncWithDefault();
    const next = await updater(current, transaction);
    if (next !== undefined) await putSync({ syncMeta: next.syncMeta });
    return next ?? current;
  });
});

const encryptedGistFileContent = (value, updateAt) =>
  JSON.stringify({
    key: SETTING_KEY,
    value: `cipher:${Buffer.from(JSON.stringify(value)).toString("base64")}`,
    updateAt,
  });

describe("WebDAV sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPatcher.mockReturnValue({ patch: jest.fn() });
    encryptSyncValue.mockImplementation((value) =>
      Promise.resolve(`cipher:${Buffer.from(value).toString("base64")}`)
    );
    decryptSyncValue.mockImplementation((value) =>
      Promise.resolve({
        value: Buffer.from(value.slice("cipher:".length), "base64").toString(),
        encrypted: true,
      })
    );
  });

  test("applies different remote data with an equal initial timestamp", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "WebDAV",
      syncUrl: "https://dav.example.com",
      syncUser: "user",
      syncKey: "password",
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {},
    });
    const client = {
      exists: jest.fn().mockResolvedValue(true),
      getFileContents: jest.fn().mockResolvedValue(
        JSON.stringify({
          key: SETTING_KEY,
          value: `cipher:${Buffer.from(
            JSON.stringify({ remote: true })
          ).toString("base64")}`,
          updateAt: 0,
        })
      ),
      putFileContents: jest.fn(),
    };
    createClient.mockReturnValue(client);

    const result = await syncData(SETTING_KEY, { local: true });

    expect(client.putFileContents).not.toHaveBeenCalled();
    expect(result).toEqual({ value: { remote: true }, isNew: true });
  });

  test("does not mark equal-timestamp legacy remote data as new after a prior sync", async () => {
    const remoteLegacySetting = {
      version: 1,
      transApis: [{ systemPrompt: "legacy inline prompt" }],
    };
    const localMigratedSetting = {
      version: 3,
      prompts: [{ slug: "migrated-prompt" }],
      transApis: [{ batchPromptSlug: "migrated-prompt" }],
    };
    getSyncWithDefault.mockResolvedValue({
      syncType: "WebDAV",
      syncUrl: "https://dav.example.com",
      syncUser: "user",
      syncKey: "password",
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 100,
          syncAt: 1,
        },
      },
    });
    const client = {
      exists: jest.fn().mockResolvedValue(true),
      getFileContents: jest.fn().mockResolvedValue(
        JSON.stringify({
          key: SETTING_KEY,
          value: `cipher:${Buffer.from(
            JSON.stringify(remoteLegacySetting)
          ).toString("base64")}`,
          updateAt: 100,
        })
      ),
      putFileContents: jest.fn(),
    };
    createClient.mockReturnValue(client);

    const result = await syncData(SETTING_KEY, localMigratedSetting);

    expect(client.putFileContents).not.toHaveBeenCalled();
    expect(result.isNew).toBe(false);
  });
});

describe("GitHub Gist sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    encryptSyncValue.mockImplementation((value) =>
      Promise.resolve(`cipher:${Buffer.from(value).toString("base64")}`)
    );
    decryptSyncValue.mockImplementation((value) => {
      if (value.startsWith("bad-cipher:")) {
        return Promise.reject(new Error("decrypt failed"));
      }
      if (value.startsWith("cipher:")) {
        return Promise.resolve({
          value: Buffer.from(
            value.slice("cipher:".length),
            "base64"
          ).toString(),
          encrypted: true,
        });
      }
      return Promise.reject(new Error("Unsupported sync encryption format"));
    });
    jest.spyOn(Date, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  test("skips sync when encryption passphrase is missing", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: "",
      syncMeta: {},
    });

    const result = await syncData(SETTING_KEY, { local: true });

    expect(result).toBeUndefined();
    expect(apiGetGist).not.toHaveBeenCalled();
    expect(encryptSyncValue).not.toHaveBeenCalled();
  });

  test("reuses the newest existing fixed-description gist when syncUrl is empty", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 100,
          syncAt: 1,
        },
      },
    });
    apiListGists.mockResolvedValue([
      {
        id: "legacy-timestamped",
        description: `${SYNC_DESCRIPTION}-1780891711256`,
        updated_at: "2026-06-08T01:00:00Z",
      },
      {
        id: "fixed-old",
        description: SYNC_DESCRIPTION,
        updated_at: "2026-06-08T02:00:00Z",
      },
      {
        id: "fixed-new",
        description: SYNC_DESCRIPTION,
        updated_at: "2026-06-08T03:00:00Z",
      },
    ]);
    apiGetGist.mockResolvedValue({
      files: {
        [SETTING_KEY]: {
          content: encryptedGistFileContent({ remote: true }, 200),
        },
      },
    });

    const result = await syncData(SETTING_KEY, { local: true });

    expect(apiCreateGist).not.toHaveBeenCalled();
    expect(apiGetGist).toHaveBeenCalledWith("fixed-new", SYNC_KEY);
    expect(putSync).toHaveBeenCalledWith(
      { syncUrl: "fixed-new" },
      {
        preserveDestination: true,
        expectedDestinationRevision: 0,
      }
    );
    expect(result).toEqual({ value: { remote: true }, isNew: true });
  });

  test("creates one fixed-description gist when syncUrl is empty and none exists", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {},
    });
    apiListGists.mockResolvedValue([]);
    apiCreateGist.mockResolvedValue({ id: "created-gist" });

    const result = await syncData(SETTING_KEY, { local: true });

    expect(apiCreateGist).toHaveBeenCalledWith(
      SYNC_KEY,
      {
        key: SETTING_KEY,
        content: JSON.stringify(
          {
            key: SETTING_KEY,
            value: `cipher:${Buffer.from(
              JSON.stringify({ local: true })
            ).toString("base64")}`,
            updateAt: 0,
          },
          null,
          2
        ),
      },
      SYNC_DESCRIPTION
    );
    expect(putSync).toHaveBeenCalledWith(
      { syncUrl: "created-gist" },
      {
        preserveDestination: true,
        expectedDestinationRevision: 0,
      }
    );
    expect(encryptSyncValue).toHaveBeenCalledWith(
      JSON.stringify({ local: true }),
      SYNC_ENCRYPT_KEY
    );
    expect(encryptSyncValue).not.toHaveBeenCalledWith(
      expect.any(String),
      SYNC_KEY
    );
    expect(result).toEqual({ value: { local: true }, isNew: false });
  });

  test("returns remote value when an existing gist file is newer", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "https://gist.github.com/example-user/existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 10,
          syncAt: 1,
        },
      },
    });
    apiGetGist.mockResolvedValue({
      files: {
        [SETTING_KEY]: {
          content: encryptedGistFileContent({ remote: true }, 50),
        },
      },
    });

    const result = await syncData(SETTING_KEY, { local: true });

    expect(apiListGists).not.toHaveBeenCalled();
    expect(apiUpdateGistFile).not.toHaveBeenCalled();
    expect(result).toEqual({ value: { remote: true }, isNew: true });
  });

  test("decrypts encrypted remote value when an existing gist file is newer", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 10,
          syncAt: 1,
        },
      },
    });
    apiGetGist.mockResolvedValue({
      files: {
        [SETTING_KEY]: {
          content: encryptedGistFileContent({ remote: true }, 50),
        },
      },
    });

    const result = await syncData(SETTING_KEY, { local: true });

    expect(apiUpdateGistFile).not.toHaveBeenCalled();
    expect(decryptSyncValue).toHaveBeenCalledWith(
      expect.any(String),
      SYNC_ENCRYPT_KEY
    );
    expect(decryptSyncValue).not.toHaveBeenCalledWith(
      expect.any(String),
      SYNC_KEY
    );
    expect(result).toEqual({ value: { remote: true }, isNew: true });
  });

  test("patches the existing gist file when local data is newer", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 200,
          syncAt: 1,
        },
      },
    });
    apiGetGist.mockResolvedValue({
      files: {
        [SETTING_KEY]: {
          content: encryptedGistFileContent({ remote: true }, 100),
        },
      },
    });

    const result = await syncData(SETTING_KEY, { local: true });

    expect(apiUpdateGistFile).toHaveBeenCalledWith(
      "existing-gist",
      SYNC_KEY,
      SETTING_KEY,
      JSON.stringify(
        {
          key: SETTING_KEY,
          value: `cipher:${Buffer.from(
            JSON.stringify({ local: true })
          ).toString("base64")}`,
          updateAt: 200,
        },
        null,
        2
      )
    );
    expect(result).toEqual({ value: { local: true }, isNew: false });
  });

  test("stops setting sync when encrypted remote data cannot be decrypted", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 10,
          syncAt: 1,
        },
      },
    });
    getSettingWithDefault.mockResolvedValue({ local: true });
    apiGetGist.mockResolvedValue({
      files: {
        [SETTING_KEY]: {
          content: JSON.stringify({
            key: SETTING_KEY,
            value: "bad-cipher:value",
            updateAt: 50,
          }),
        },
      },
    });

    await expect(syncSettingAndRules()).rejects.toThrow("decrypt failed");

    expect(setSetting).not.toHaveBeenCalled();
    expect(apiUpdateGistFile).not.toHaveBeenCalled();
  });

  test("changes encryption passphrase after re-encrypting personal sync data", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 200,
          syncAt: 1,
        },
        [RULES_KEY]: {
          updateAt: 201,
          syncAt: 1,
        },
      },
    });
    getSettingWithDefault.mockResolvedValue({ setting: true });
    getRulesWithDefault.mockResolvedValue([{ pattern: "*" }]);
    apiGetGist.mockResolvedValue({ files: {} });

    Date.now.mockReturnValue(9999);

    await changeSyncEncryptKey({
      oldEncryptKey: SYNC_ENCRYPT_KEY,
      newEncryptKey: NEW_SYNC_ENCRYPT_KEY,
    });

    expect(encryptSyncValue).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ setting: true }),
      SYNC_ENCRYPT_KEY
    );
    expect(encryptSyncValue).toHaveBeenNthCalledWith(
      2,
      JSON.stringify([{ pattern: "*" }]),
      SYNC_ENCRYPT_KEY
    );
    expect(encryptSyncValue).toHaveBeenNthCalledWith(
      3,
      JSON.stringify({ setting: true }),
      NEW_SYNC_ENCRYPT_KEY
    );
    expect(encryptSyncValue).toHaveBeenNthCalledWith(
      4,
      JSON.stringify([{ pattern: "*" }]),
      NEW_SYNC_ENCRYPT_KEY
    );
    const uploadedSetting = JSON.parse(apiUpdateGistFile.mock.calls[2][3]);
    const uploadedRules = JSON.parse(apiUpdateGistFile.mock.calls[3][3]);
    expect(uploadedSetting.updateAt).toBe(9999);
    expect(uploadedRules.updateAt).toBe(9999);
    expect(putSync).toHaveBeenCalledWith({
      syncMeta: expect.objectContaining({
        [SETTING_KEY]: {
          updateAt: 9999,
          syncAt: 9999,
        },
      }),
    });
    expect(putSync).toHaveBeenCalledWith({
      syncMeta: expect.objectContaining({
        [RULES_KEY]: {
          updateAt: 9999,
          syncAt: 9999,
        },
      }),
    });
    expect(putSync).toHaveBeenLastCalledWith(
      {
        syncEncryptKey: NEW_SYNC_ENCRYPT_KEY,
      },
      expect.objectContaining({ preserveDestination: true })
    );
  });

  test.each([
    ["password change", changeSyncEncryptKey],
    ["ordinary sync", syncSettingAndRules],
  ])(
    "writes a missing remote transOpen as follow during %s",
    async (_label, sync) => {
      const remoteRules = [
        { pattern: "news.example.com", selector: "article" },
        { pattern: "ok.example.com", transOpen: "true" },
      ];
      getSyncWithDefault.mockResolvedValue({
        syncType: "GitHub Gist",
        syncUrl: "existing-gist",
        syncKey: SYNC_KEY,
        syncEncryptKey: SYNC_ENCRYPT_KEY,
        syncMeta: {
          [SETTING_KEY]: { updateAt: 10, syncAt: 1 },
          [RULES_KEY]: { updateAt: 10, syncAt: 1 },
        },
      });
      getSettingWithDefault.mockResolvedValue({ setting: true });
      getRulesWithDefault.mockResolvedValue([
        { pattern: "local.example.com", transOpen: "true" },
      ]);
      apiGetGist.mockResolvedValue({
        files: {
          [SETTING_KEY]: {
            content: encryptedGistFileContent({ setting: true }, 50),
          },
          [RULES_KEY]: {
            content: encryptedGistFileContent(remoteRules, 50),
          },
        },
      });

      if (sync === changeSyncEncryptKey) {
        await changeSyncEncryptKey({
          oldEncryptKey: SYNC_ENCRYPT_KEY,
          newEncryptKey: NEW_SYNC_ENCRYPT_KEY,
        });
      } else {
        await syncSettingAndRules();
      }

      expect(setRules).toHaveBeenCalledWith(checkRules(remoteRules));
    }
  );

  test("keeps old encryption passphrase when re-encryption fails on the second file upload", async () => {
    const rulesFilename = `sync-rules_${RULES_KEY}`;
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {
        [SETTING_KEY]: {
          updateAt: 200,
          syncAt: 1,
        },
        [RULES_KEY]: {
          updateAt: 201,
          syncAt: 1,
        },
      },
    });
    getSettingWithDefault.mockResolvedValue({ setting: true });
    getRulesWithDefault.mockResolvedValue([{ pattern: "*" }]);
    apiGetGist.mockResolvedValue({
      files: {
        [SETTING_KEY]: {
          content: encryptedGistFileContent({ setting: true }, 50),
        },
        [rulesFilename]: {
          content: JSON.stringify({
            key: RULES_KEY,
            value: `cipher:${Buffer.from(
              JSON.stringify([{ pattern: "*" }])
            ).toString("base64")}`,
            updateAt: 50,
          }),
        },
      },
    });
    apiUpdateGistFile
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("upload failed on second file"));

    await expect(
      changeSyncEncryptKey({
        oldEncryptKey: SYNC_ENCRYPT_KEY,
        newEncryptKey: NEW_SYNC_ENCRYPT_KEY,
      })
    ).rejects.toThrow("upload failed on second file");

    // Pre-read must not have uploaded; both apiUpdateGistFile calls belong to newEncryptKey re-encryption
    expect(apiUpdateGistFile).toHaveBeenCalledTimes(2);
    expect(encryptSyncValue).toHaveBeenCalledWith(
      JSON.stringify({ setting: true }),
      NEW_SYNC_ENCRYPT_KEY
    );
    expect(encryptSyncValue).toHaveBeenCalledWith(
      JSON.stringify([{ pattern: "*" }]),
      NEW_SYNC_ENCRYPT_KEY
    );
    expect(putSync).not.toHaveBeenCalledWith(
      expect.objectContaining({
        syncEncryptKey: NEW_SYNC_ENCRYPT_KEY,
      }),
      expect.anything()
    );
  });

  test("uses the supplied old passphrase instead of a stale local passphrase", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "GitHub Gist",
      syncUrl: "existing-gist",
      syncKey: SYNC_KEY,
      syncEncryptKey: "stale-local-passphrase",
      syncMeta: {},
    });
    getSettingWithDefault.mockResolvedValue({ setting: true });
    getRulesWithDefault.mockResolvedValue([]);
    apiGetGist.mockResolvedValue({ files: {} });

    await changeSyncEncryptKey({
      oldEncryptKey: RECOVERY_OLD_ENCRYPT_KEY,
      newEncryptKey: NEW_SYNC_ENCRYPT_KEY,
    });

    expect(encryptSyncValue).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ setting: true }),
      RECOVERY_OLD_ENCRYPT_KEY
    );
    expect(encryptSyncValue).not.toHaveBeenCalledWith(
      JSON.stringify({ setting: true }),
      "stale-local-passphrase"
    );
  });
});

describe("removed sync types", () => {
  beforeEach(() => {
    encryptSyncValue.mockImplementation((value) =>
      Promise.resolve(`cipher:${Buffer.from(value).toString("base64")}`)
    );
    decryptSyncValue.mockImplementation((value) =>
      Promise.resolve({
        value: Buffer.from(value.slice("cipher:".length), "base64").toString(),
        encrypted: true,
      })
    );
  });

  test("rejects a stored worker sync type without calling WebDAV or Gist", async () => {
    getSyncWithDefault.mockResolvedValue({
      syncType: "KISS-Worker",
      syncUrl: "https://sync.example",
      syncUser: "user",
      syncKey: SYNC_KEY,
      syncEncryptKey: SYNC_ENCRYPT_KEY,
      syncMeta: {},
    });

    await expect(syncData(SETTING_KEY, { local: true })).rejects.toThrow(
      "unsupported sync type: KISS-Worker"
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(apiCreateGist).not.toHaveBeenCalled();
    expect(apiGetGist).not.toHaveBeenCalled();
    expect(apiUpdateGistFile).not.toHaveBeenCalled();
    expect(putSync).not.toHaveBeenCalledWith(
      expect.objectContaining({ syncType: expect.anything() })
    );
  });
});

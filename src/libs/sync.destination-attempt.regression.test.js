import { createClient } from "webdav";
import { storage, putSync, getSync, getSettingWithDefault } from "./storage";
import { getStorageState } from "./storageState";
import { changeSyncEncryptKey, trySyncRules } from "./sync";
import { checkRules } from "./rules";
import {
  STOKEY_SETTING,
  STOKEY_RULES,
  STOKEY_SYNC,
  KV_SETTING_KEY,
  KV_RULES_KEY,
  OPT_SYNCTYPE_WEBDAV,
} from "../config";

jest.mock("./client", () => ({ isExt: false }));
jest.mock("./browser", () => ({ isOptions: () => true }));
jest.mock("./log", () => ({
  ...jest.requireActual("./log"),
  kissLog: jest.fn(),
}));
jest.mock("./fetch", () => ({ fetchPatcher: jest.fn() }));
jest.mock("webdav", () => ({
  createClient: jest.fn(),
  getPatcher: () => ({ patch: jest.fn() }),
}));
jest.mock("../apis", () => ({ apiSyncData: jest.fn() }));
jest.mock("./syncCrypto", () => ({
  encryptSyncValue: async (value, key) => `cipher:${key}:${value}`,
  decryptSyncValue: async (value, key) => {
    if (value.startsWith(`cipher:${key}:`)) {
      return {
        value: value.slice(`cipher:${key}:`.length),
        encrypted: true,
      };
    }
    if (value.startsWith("cipher:[") || value.startsWith("cipher:{")) {
      return {
        value: value.slice(7),
        encrypted: true,
      };
    }
    const err = new Error("decrypt failed");
    err.code = "SYNC_DECRYPT_FAILED";
    throw err;
  },
}));

const rules = (...patterns) =>
  checkRules(patterns.map((pattern) => ({ pattern })));

test("a previous destination's attempt cannot change the new destination's first-sync policy", async () => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(100);
  await storage.setObj(STOKEY_RULES, rules("initial"));
  await storage.setObj(STOKEY_SYNC, {
    syncType: OPT_SYNCTYPE_WEBDAV,
    syncUrl: "https://first.example.invalid",
    syncUser: "review-user",
    syncKey: "review-token",
    syncEncryptKey: "review-passphrase",
    syncMeta: { [KV_RULES_KEY]: { updateAt: 20, syncAt: 0 } },
  });
  const state = getStorageState(STOKEY_RULES, {});
  state.configureSync(KV_RULES_KEY);
  const unsubscribe = state.subscribe(() => {});
  try {
    await state.ensureLoaded();
    const oldClient = {
      exists: jest.fn(async () => true),
      getFileContents: jest.fn(async () => {
        throw new Error("First destination offline");
      }),
      putFileContents: jest.fn(async () => {}),
    };
    createClient.mockReturnValue(oldClient);
    await trySyncRules();
    expect(oldClient.getFileContents).toHaveBeenCalledTimes(1);
    expect((await getSync()).syncMeta[KV_RULES_KEY].firstAttemptAt).toBe(100);
    await putSync({ syncUrl: "https://second.example.invalid" });
    expect((await getSync()).syncMeta).toEqual({});
    await state.save(rules("newEdit"));
    const cloudRules = rules("cloud");
    let remote = {
      key: KV_RULES_KEY,
      value: `cipher:${JSON.stringify(cloudRules)}`,
      updateAt: 50,
    };
    const client = {
      exists: jest.fn(async () => true),
      getFileContents: jest.fn(async () => JSON.stringify(remote)),
      putFileContents: jest.fn(async (_path, content) => {
        remote = JSON.parse(content);
      }),
    };
    createClient.mockReturnValue(client);
    await trySyncRules();
    expect(client.putFileContents).not.toHaveBeenCalled();
    expect(await storage.getObj(STOKEY_RULES)).toEqual(cloudRules);
  } finally {
    state.cancelSync();
    unsubscribe();
    jest.useRealTimers();
  }
});

test("a non-array remote rules value is not written to storage", async () => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(100);
  const localRules = rules("local");
  const remoteObject = { not: "rules" };
  await storage.setObj(STOKEY_RULES, localRules);
  await storage.setObj(STOKEY_SYNC, {
    syncType: OPT_SYNCTYPE_WEBDAV,
    syncUrl: "https://sync.example.invalid",
    syncUser: "review-user",
    syncKey: "review-token",
    syncEncryptKey: "review-passphrase",
    syncMeta: { [KV_RULES_KEY]: { updateAt: 10, syncAt: 0 } },
  });
  const state = getStorageState(STOKEY_RULES, []);
  state.configureSync(KV_RULES_KEY);
  const unsubscribe = state.subscribe(() => {});
  try {
    await state.ensureLoaded();
    createClient.mockReturnValue({
      exists: jest.fn(async () => true),
      getFileContents: jest.fn(async () =>
        JSON.stringify({
          key: KV_RULES_KEY,
          value: `cipher:${JSON.stringify(remoteObject)}`,
          updateAt: 50,
        })
      ),
      putFileContents: jest.fn(),
    });
    await trySyncRules();
    expect(await storage.getObj(STOKEY_RULES)).toEqual(localRules);
    expect(await storage.getObj(STOKEY_RULES)).not.toEqual(remoteObject);
  } finally {
    state.cancelSync();
    unsubscribe();
    jest.useRealTimers();
  }
});

describe("passphrase rotation races and partial failure with real storage", () => {
  const OLD_KEY = "old-passphrase";
  const NEW_KEY = "new-passphrase";

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  test("does not overwrite a concurrent setting edit saved while rules validation is in flight", async () => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(1000);

    const baseSetting = await getSettingWithDefault();
    const initialSetting = { ...baseSetting, darkMode: "light" };
    const remoteOldSetting = { ...baseSetting, darkMode: "dark" };
    const concurrentEditedSetting = {
      ...baseSetting,
      darkMode: "auto",
      uiLang: "en",
    };
    const initialRules = rules("local-initial");
    const remoteNewerRules = rules("remote-updated");

    await storage.setObj(STOKEY_SETTING, initialSetting);
    await storage.setObj(STOKEY_RULES, initialRules);
    await storage.setObj(STOKEY_SYNC, {
      syncType: OPT_SYNCTYPE_WEBDAV,
      syncUrl: "https://sync.example.invalid",
      syncUser: "review-user",
      syncKey: "review-token",
      syncEncryptKey: OLD_KEY,
      syncMeta: {
        [KV_SETTING_KEY]: { updateAt: 100, syncAt: 100 },
        [KV_RULES_KEY]: { updateAt: 100, syncAt: 100 },
      },
    });

    const remoteFiles = {
      [KV_SETTING_KEY]: {
        key: KV_SETTING_KEY,
        value: `cipher:${OLD_KEY}:${JSON.stringify(remoteOldSetting)}`,
        updateAt: 500,
      },
      [KV_RULES_KEY]: {
        key: KV_RULES_KEY,
        value: `cipher:${OLD_KEY}:${JSON.stringify(remoteNewerRules)}`,
        updateAt: 500,
      },
    };

    const rulesReadStarted = deferred();
    const releaseRulesRead = deferred();

    const client = {
      exists: jest.fn(async () => true),
      getFileContents: jest.fn(async (filePath) => {
        const key = filePath.split("/").pop();
        if (key === KV_RULES_KEY) {
          rulesReadStarted.resolve();
          await releaseRulesRead.promise;
        }
        return JSON.stringify(remoteFiles[key]);
      }),
      putFileContents: jest.fn(async (filePath, content) => {
        const key = filePath.split("/").pop();
        remoteFiles[key] = JSON.parse(content);
      }),
    };
    createClient.mockReturnValue(client);

    const rotationPromise = changeSyncEncryptKey({
      oldEncryptKey: OLD_KEY,
      newEncryptKey: NEW_KEY,
    });

    await rulesReadStarted.promise;

    // Another page saves a new setting edit while rules pre-read is paused on the network
    jest.setSystemTime(2000);
    await storage.saveEdit(
      STOKEY_SETTING,
      concurrentEditedSetting,
      KV_SETTING_KEY
    );
    expect((await storage.getObj(STOKEY_SETTING)).darkMode).toBe("auto");
    expect((await storage.getObj(STOKEY_SETTING)).uiLang).toBe("en");

    jest.setSystemTime(3000);
    releaseRulesRead.resolve();
    await rotationPromise;

    // Stale remoteOldSetting (darkMode: "dark") must not overwrite concurrentEditedSetting (darkMode: "auto")
    const finalStoredSetting = await storage.getObj(STOKEY_SETTING);
    expect(finalStoredSetting.darkMode).toBe("auto");
    expect(finalStoredSetting.uiLang).toBe("en");

    // Rules had no concurrent local edit, so remoteNewerRules was adopted
    expect(await storage.getObj(STOKEY_RULES)).toEqual(remoteNewerRules);

    // Remote files are encrypted with NEW_KEY and contain the preserved concurrent setting edit
    expect(remoteFiles[KV_SETTING_KEY].value).toBe(
      `cipher:${NEW_KEY}:${JSON.stringify(finalStoredSetting)}`
    );
    expect(remoteFiles[KV_RULES_KEY].value).toBe(
      `cipher:${NEW_KEY}:${JSON.stringify(remoteNewerRules)}`
    );
    expect((await getSync()).syncEncryptKey).toBe(NEW_KEY);
  });

  test("aborts rotation when sync destination changes during pre-read or upload without clobbering new destination state", async () => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(1000);

    const baseSetting = await getSettingWithDefault();
    const localSetting = { ...baseSetting, darkMode: "light" };
    const remoteOldDestSetting = { ...baseSetting, darkMode: "dark" };
    const localRules = rules("local-rule");
    const remoteOldDestRules = rules("old-dest-rule");

    await storage.setObj(STOKEY_SETTING, localSetting);
    await storage.setObj(STOKEY_RULES, localRules);
    await storage.setObj(STOKEY_SYNC, {
      syncType: OPT_SYNCTYPE_WEBDAV,
      syncUrl: "https://old-dest.example.invalid",
      syncUser: "review-user",
      syncKey: "review-token",
      syncEncryptKey: OLD_KEY,
      syncMeta: {
        [KV_SETTING_KEY]: { updateAt: 100, syncAt: 100 },
        [KV_RULES_KEY]: { updateAt: 100, syncAt: 100 },
      },
    });

    const rulesReadStarted = deferred();
    const releaseRulesRead = deferred();
    const putCalls = [];

    createClient.mockReturnValue({
      exists: jest.fn(async () => true),
      getFileContents: jest.fn(async (filePath) => {
        const key = filePath.split("/").pop();
        if (key === KV_RULES_KEY) {
          rulesReadStarted.resolve();
          await releaseRulesRead.promise;
          return JSON.stringify({
            key: KV_RULES_KEY,
            value: `cipher:${OLD_KEY}:${JSON.stringify(remoteOldDestRules)}`,
            updateAt: 500,
          });
        }
        return JSON.stringify({
          key: KV_SETTING_KEY,
          value: `cipher:${OLD_KEY}:${JSON.stringify(remoteOldDestSetting)}`,
          updateAt: 500,
        });
      }),
      putFileContents: jest.fn(async (filePath, content) => {
        putCalls.push({ filePath, content: JSON.parse(content) });
      }),
    });

    const rotation = changeSyncEncryptKey({
      oldEncryptKey: OLD_KEY,
      newEncryptKey: NEW_KEY,
    });
    const rotationOutcome =
      expect(rotation).rejects.toThrow(/destination changed/i);

    await rulesReadStarted.promise;
    // User switches sync destination while pre-read is in flight
    await putSync({ syncUrl: "https://new-dest.example.invalid" });
    releaseRulesRead.resolve();

    await rotationOutcome;

    expect((await storage.getObj(STOKEY_SETTING)).darkMode).toBe("light");
    expect(await storage.getObj(STOKEY_RULES)).toEqual(localRules);
    expect(putCalls).toHaveLength(0);
    const finalSync = await getSync();
    expect(finalSync.syncUrl).toBe("https://new-dest.example.invalid");
    expect(finalSync.syncEncryptKey).toBe(OLD_KEY);
    expect(finalSync.syncMeta).toEqual({});
  });

  test("preserves local old passphrase and reports exact stored and remote state when second file upload fails", async () => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(1000);

    const baseSetting = await getSettingWithDefault();
    const localSetting = { ...baseSetting, darkMode: "light" };
    const localRules = rules("local-rule");

    await storage.setObj(STOKEY_SETTING, localSetting);
    await storage.setObj(STOKEY_RULES, localRules);
    await storage.setObj(STOKEY_SYNC, {
      syncType: OPT_SYNCTYPE_WEBDAV,
      syncUrl: "https://sync.example.invalid",
      syncUser: "review-user",
      syncKey: "review-token",
      syncEncryptKey: OLD_KEY,
      syncMeta: {
        [KV_SETTING_KEY]: { updateAt: 200, syncAt: 100 },
        [KV_RULES_KEY]: { updateAt: 200, syncAt: 100 },
      },
    });

    const remoteFiles = {
      [KV_SETTING_KEY]: {
        key: KV_SETTING_KEY,
        value: `cipher:${OLD_KEY}:${JSON.stringify(localSetting)}`,
        updateAt: 100,
      },
      [KV_RULES_KEY]: {
        key: KV_RULES_KEY,
        value: `cipher:${OLD_KEY}:${JSON.stringify(localRules)}`,
        updateAt: 100,
      },
    };

    createClient.mockReturnValue({
      exists: jest.fn(async () => true),
      getFileContents: jest.fn(async (filePath) => {
        const key = filePath.split("/").pop();
        return JSON.stringify(remoteFiles[key]);
      }),
      putFileContents: jest.fn(async (filePath, content) => {
        const key = filePath.split("/").pop();
        if (key === KV_RULES_KEY) {
          throw new Error("second file upload failed");
        }
        remoteFiles[key] = JSON.parse(content);
      }),
    });

    await expect(
      changeSyncEncryptKey({
        oldEncryptKey: OLD_KEY,
        newEncryptKey: NEW_KEY,
      })
    ).rejects.toThrow("second file upload failed");

    const finalSync = await getSync();
    expect(finalSync.syncEncryptKey).toBe(OLD_KEY);
    expect(await storage.getObj(STOKEY_SETTING)).toEqual(localSetting);
    expect(await storage.getObj(STOKEY_RULES)).toEqual(localRules);
    expect(remoteFiles[KV_SETTING_KEY].value).toContain(`cipher:${NEW_KEY}:`);
    expect(remoteFiles[KV_RULES_KEY].value).toContain(`cipher:${OLD_KEY}:`);
  });
});

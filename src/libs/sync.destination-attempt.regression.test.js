import { createClient } from "webdav";
import { storage, putSync, getSync } from "./storage";
import { getStorageState } from "./storageState";
import { trySyncRules } from "./sync";
import { checkRules } from "./rules";
import {
  STOKEY_RULES,
  STOKEY_SYNC,
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
  encryptSyncValue: async (value) => `cipher:${value}`,
  decryptSyncValue: async (value) => ({
    value: value.slice(7),
    encrypted: true,
  }),
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

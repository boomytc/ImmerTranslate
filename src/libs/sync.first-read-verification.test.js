import { createClient } from "webdav";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  apiCreateGist,
  apiGetGist,
  apiListGists,
  apiUpdateGistFile,
} from "../apis";
import {
  KV_RULES_KEY,
  OPT_SYNCTYPE_GIST,
  OPT_SYNCTYPE_WEBDAV,
  STOKEY_SYNC,
  STOKEY_RULES,
} from "../config";
import { getSyncWithDefault, putSync, storage } from "./storage";
import { trySyncRules } from "./sync";
import { decryptSyncValue, encryptSyncValue } from "./syncCrypto";
import { findStorageState } from "./storageState";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./client", () => ({ isExt: false, isGm: false }));
jest.mock("./browser", () => ({ isOptions: () => true }));
jest.mock("./log", () => ({
  ...jest.requireActual("./log"),
  kissLog: jest.fn(),
}));
jest.mock("./fetch", () => ({ fetchPatcher: jest.fn(), fetchGM: jest.fn() }));
jest.mock("webdav", () => ({
  createClient: jest.fn(),
  getPatcher: () => ({ patch: jest.fn() }),
}));
jest.mock("../apis", () => ({
  apiCreateGist: jest.fn(),
  apiListGists: jest.fn(),
  apiGetGist: jest.fn(),
  apiUpdateGistFile: jest.fn(),
  apiFetchText: jest.fn(),
}));
jest.mock("./syncCrypto", () => {
  const { webcrypto } = require("crypto");
  const { TextDecoder, TextEncoder } = require("util");
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
  Object.defineProperty(globalThis, "TextEncoder", {
    value: TextEncoder,
    configurable: true,
  });
  Object.defineProperty(globalThis, "TextDecoder", {
    value: TextDecoder,
    configurable: true,
  });
  Object.defineProperty(globalThis, "btoa", {
    value: (value) => Buffer.from(value, "binary").toString("base64"),
    configurable: true,
  });
  Object.defineProperty(globalThis, "atob", {
    value: (value) => Buffer.from(value, "base64").toString("binary"),
    configurable: true,
  });
  return jest.requireActual("./syncCrypto");
});

const CORRECT_KEY = "correct-review-passphrase";
const WRONG_KEY = "incorrect-review-passphrase";
const CLOUD_WORDS = { irreplaceable: { createdAt: 1 } };
const LOCAL_WORDS = { "new-local-word": { createdAt: 100000 } };
const GIST_FILENAME = `sync-rules_${KV_RULES_KEY}`;
const PROVIDERS = [
  ["WebDAV", OPT_SYNCTYPE_WEBDAV],
  ["Gist", OPT_SYNCTYPE_GIST],
];

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { resolve, promise };
}

async function seedConfiguration(syncType, syncEncryptKey = CORRECT_KEY) {
  await storage.setObj(STOKEY_RULES, {});
  await storage.setObj(STOKEY_SYNC, {
    syncType,
    syncUrl:
      syncType === OPT_SYNCTYPE_GIST
        ? "review-gist"
        : "https://review.example.invalid",
    syncUser: "review-user",
    syncKey: "review-token",
    syncEncryptKey,
    syncMeta: {},
  });
}

async function createRemote() {
  let remote = {
    key: KV_RULES_KEY,
    value: await encryptSyncValue(JSON.stringify(CLOUD_WORDS), CORRECT_KEY),
    updateAt: 50000,
  };
  let onRead;
  const writes = [];
  const read = jest.fn(async () => {
    const snapshot = JSON.stringify(remote);
    if (onRead) await onRead();
    return snapshot;
  });
  const write = (value) => {
    remote = JSON.parse(value);
    writes.push(remote);
  };
  createClient.mockReturnValue({
    exists: jest.fn(async () => true),
    getFileContents: read,
    putFileContents: jest.fn(async (_path, value) => write(value)),
  });
  apiGetGist.mockImplementation(async () => ({
    files: { [GIST_FILENAME]: { content: await read() } },
  }));
  apiUpdateGistFile.mockImplementation(async (_id, _token, _file, value) =>
    write(value)
  );
  apiListGists.mockResolvedValue([
    { id: "review-gist", description: "kiss translator sync files" },
  ]);
  return {
    read,
    writes,
    get packet() {
      return remote;
    },
    setValue(value) {
      remote = { ...remote, value };
    },
    beforeRead(handler) {
      onRead = handler;
    },
  };
}

async function retainEditAfterOfflineAttempt(remote) {
  remote.beforeRead(() => {
    throw new Error("The first remote request is offline");
  });
  await trySyncRules();
  remote.beforeRead(undefined);
  await storage.saveEdit(STOKEY_RULES, LOCAL_WORDS, KV_RULES_KEY);
  expect((await getSyncWithDefault()).syncMeta[KV_RULES_KEY]).toMatchObject({
    pendingUpload: true,
    updateAt: 100000,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(100000);
});

afterEach(() => {
  jest.useRealTimers();
});

describe.each(PROVIDERS)(
  "first-read verification through %s",
  (_name, type) => {
    test("repeated retries after failed decryption preserve the encrypted backup", async () => {
      await seedConfiguration(type, WRONG_KEY);
      const remote = await createRemote();
      const originalPacket = remote.packet;
      await trySyncRules();
      expect(remote.writes).toHaveLength(0);
      await storage.saveEdit(STOKEY_RULES, LOCAL_WORDS, KV_RULES_KEY);
      for (let retry = 0; retry < 3; retry += 1) {
        await trySyncRules();
        expect(remote.writes).toHaveLength(0);
        expect(remote.packet).toEqual(originalPacket);
      }
      expect(await storage.getObj(STOKEY_RULES)).toEqual(LOCAL_WORDS);
      expect((await getSyncWithDefault()).syncMeta[KV_RULES_KEY]).toMatchObject(
        {
          pendingUpload: true,
          updateAt: 100000,
        }
      );
      await expect(
        decryptSyncValue(remote.packet.value, CORRECT_KEY)
      ).resolves.toMatchObject({ value: JSON.stringify(CLOUD_WORDS) });
    });

    test("a correct passphrase uploads the retained edit after an offline attempt", async () => {
      await seedConfiguration(type);
      const remote = await createRemote();
      await retainEditAfterOfflineAttempt(remote);
      await trySyncRules();
      expect(remote.writes).toHaveLength(1);
      await expect(
        decryptSyncValue(remote.packet.value, CORRECT_KEY)
      ).resolves.toMatchObject({ value: JSON.stringify(LOCAL_WORDS) });
      const metadata = (await getSyncWithDefault()).syncMeta[KV_RULES_KEY];
      expect(metadata).toEqual({ updateAt: 100000, syncAt: 100000 });
      expect(await storage.getObj(STOKEY_RULES)).toEqual(LOCAL_WORDS);
    });

    test.each(["authenticated ciphertext", "invalid legacy JSON"])(
      "a damaged %s is not overwritten on a pending first sync",
      async (format) => {
        await seedConfiguration(type);
        const remote = await createRemote();
        await retainEditAfterOfflineAttempt(remote);
        if (format === "authenticated ciphertext") {
          const envelope = JSON.parse(remote.packet.value);
          envelope.data =
            (envelope.data[0] === "A" ? "B" : "A") + envelope.data.slice(1);
          remote.setValue(JSON.stringify(envelope));
        } else {
          remote.setValue("{incomplete JSON");
        }
        const originalPacket = remote.packet;
        await trySyncRules();
        expect(remote.writes).toHaveLength(0);
        expect(remote.packet).toEqual(originalPacket);
        expect(await storage.getObj(STOKEY_RULES)).toEqual(LOCAL_WORDS);
      }
    );

    test.each(["destination", "passphrase"])(
      "changing the %s during verification prevents the following upload",
      async (change) => {
        await seedConfiguration(type);
        const remote = await createRemote();
        await retainEditAfterOfflineAttempt(remote);
        const originalPacket = remote.packet;
        const started = deferred();
        const resume = deferred();
        remote.beforeRead(async () => {
          started.resolve();
          await resume.promise;
        });
        const pending = trySyncRules();
        try {
          await started.promise;
          if (change === "destination") {
            await putSync({
              syncUrl:
                type === OPT_SYNCTYPE_GIST
                  ? "new-destination-gist"
                  : "https://new-destination.example.invalid",
            });
          } else {
            await putSync(
              { syncEncryptKey: "a-new-passphrase" },
              { preserveDestination: true }
            );
          }
          const metadataAfterChange = (await getSyncWithDefault()).syncMeta;
          resume.resolve();
          await pending;
          expect(remote.writes).toHaveLength(0);
          expect(remote.packet).toEqual(originalPacket);
          expect(await storage.getObj(STOKEY_RULES)).toEqual(LOCAL_WORDS);
          expect((await getSyncWithDefault()).syncMeta).toEqual(
            metadataAfterChange
          );
        } finally {
          resume.resolve();
          await pending;
        }
      }
    );
  }
);

test("a pending first upload reuses the Gist created by verification", async () => {
  await seedConfiguration(OPT_SYNCTYPE_GIST);
  await putSync({ syncUrl: "" });
  await putSync({
    syncMeta: {
      [KV_RULES_KEY]: {
        updateAt: 100000,
        firstAttemptAt: 90000,
        pendingUpload: true,
      },
    },
  });
  await storage.setObj(STOKEY_RULES, LOCAL_WORDS);
  let createdPacket;
  // A new Gist may not yet appear in the eventually updated listing response.
  apiListGists.mockResolvedValue([]);
  apiCreateGist.mockImplementation(async (_token, { content }) => {
    createdPacket = JSON.parse(content);
    return { id: "newly-created-gist" };
  });
  apiGetGist.mockImplementation(async () => ({
    files: { [GIST_FILENAME]: { content: JSON.stringify(createdPacket) } },
  }));
  apiUpdateGistFile.mockImplementation(async (_id, _token, _file, content) => {
    createdPacket = JSON.parse(content);
  });
  await trySyncRules();
  expect(apiCreateGist).toHaveBeenCalledTimes(1);
  expect((await getSyncWithDefault()).syncUrl).toBe("newly-created-gist");
  expect(createdPacket.updateAt).toBe(100000);
  await expect(
    decryptSyncValue(createdPacket.value, CORRECT_KEY)
  ).resolves.toMatchObject({ value: JSON.stringify(LOCAL_WORDS) });
});

test("a local edit preserves the backup on manual sync after a wrong-passphrase failure", async () => {
  await seedConfiguration(OPT_SYNCTYPE_WEBDAV, WRONG_KEY);
  const remote = await createRemote();
  const originalPacket = remote.packet;
  try {
    await act(async () => {
      await trySyncRules();
    });
    expect(remote.writes).toHaveLength(0);
    await act(async () => {
      await storage.saveEdit(
        STOKEY_RULES,
        (current) => ({
          ...current,
          "new-local-word": { createdAt: Date.now() },
        }),
        KV_RULES_KEY
      );
    });
    await act(async () => {
      jest.advanceTimersByTime(350);
      for (let step = 0; step < 100; step += 1) await Promise.resolve();
    });
    await act(async () => {
      await trySyncRules();
    });
    expect(remote.writes).toHaveLength(0);
    expect(remote.packet).toEqual(originalPacket);
    await expect(
      decryptSyncValue(remote.packet.value, CORRECT_KEY)
    ).resolves.toMatchObject({ value: JSON.stringify(CLOUD_WORDS) });
  } finally {
    const state = findStorageState(STOKEY_RULES);
    state?.markSynced(state.revision);
    jest.clearAllTimers();
  }
});

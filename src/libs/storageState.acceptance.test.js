import {
  STOKEY_RULES,
  STOKEY_SYNC,
  KV_RULES_KEY,
  OPT_SYNCTYPE_WEBDAV,
} from "../config";
import { createClient } from "webdav";

jest.mock("./log", () => ({
  ...jest.requireActual("./log"),
  kissLog: jest.fn(),
}));
jest.mock("./fetch", () => ({ fetchPatcher: jest.fn() }));
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
jest.mock("./syncCrypto", () => ({
  encryptSyncValue: async (value) => `cipher:${value}`,
  decryptSyncValue: async (value) => ({
    value: value.slice(7),
    encrypted: true,
  }),
}));
function createEvent() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    emit: (...args) => [...listeners].forEach((listener) => listener(...args)),
  };
}

function createRuntime() {
  const values = {};
  const onChanged = createEvent();
  const runtime = {
    values,
    ports: [],
    onConnect: createEvent(),
    storage: {
      onChanged,
      local: {
        get: jest.fn(async (keys) =>
          Object.fromEntries(
            keys.filter((key) => key in values).map((key) => [key, values[key]])
          )
        ),
        set: jest.fn(async (entries) => {
          const changes = Object.fromEntries(
            Object.entries(entries).map(([key, newValue]) => [
              key,
              { oldValue: values[key], newValue },
            ])
          );
          Object.assign(values, entries);
          if (!runtime.pauseEvents) onChanged.emit(changes, "local");
        }),
        remove: jest.fn(async (keys) => {
          keys.forEach((key) => delete values[key]);
        }),
      },
    },
  };
  runtime.connect = ({ name }) => {
    let disconnected = false;
    const front = {
      name,
      onMessage: createEvent(),
      onDisconnect: createEvent(),
    };
    const back = {
      name,
      onMessage: createEvent(),
      onDisconnect: createEvent(),
    };
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true;
      front.onDisconnect.emit(front);
      back.onDisconnect.emit(back);
    };
    front.disconnect = disconnect;
    back.disconnect = disconnect;
    front.postMessage = (message) => {
      if (disconnected) throw new Error("Port disconnected");
      Promise.resolve().then(() => {
        if (!disconnected) back.onMessage.emit(message, back);
      });
    };
    back.postMessage = (message) => {
      if (disconnected) throw new Error("Port disconnected");
      Promise.resolve().then(() => {
        if (!disconnected) front.onMessage.emit(message, front);
      });
    };
    runtime.ports.push({ front, back });
    Promise.resolve().then(() => runtime.onConnect.emit(back));
    return front;
  };
  return runtime;
}

function loadContext(runtime, background = false) {
  let context;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({ isExt: true }));
    jest.doMock("./browser", () => ({
      browser: { runtime, storage: runtime.storage },
      isBg: () => background,
    }));
    context = {
      ...require("./storageCoordination"),
      ...require("./storage"),
      ...require("./storageState"),
      ...require("./storageSyncController"),
    };
  });
  return context;
}

let cleanups;

beforeEach(() => {
  cleanups = [];
  jest.spyOn(Date, "now").mockReturnValue(300);
});

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  jest.restoreAllMocks();
  jest.dontMock("./client");
  jest.dontMock("./browser");
});

async function setup() {
  const runtime = createRuntime();
  runtime.values[STOKEY_RULES] = JSON.stringify({ original: {} });
  const background = loadContext(runtime, true);
  background.installStorageCoordinator();
  const first = loadContext(runtime);
  const second = loadContext(runtime);
  return { runtime, first, second };
}

async function mountState(page) {
  const state = page.getStorageState(STOKEY_RULES, {});
  state.configureSync(KV_RULES_KEY);
  cleanups.push(state.subscribe(() => {}));
  await state.ensureLoaded();
  return state;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("a pure read returns while another page holds the storage lock", async () => {
  const { runtime, first, second } = await setup();
  runtime.values[STOKEY_RULES] = JSON.stringify({ original: { kept: true } });
  const release = deferred();
  const holder = first.withStorageLock(() => release.promise);
  const holderResult = holder.catch(() => undefined);
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
  const state = second.getStorageState(STOKEY_RULES, {});
  const loaded = state.load();
  let timer;
  const hung = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("read waited for the write lock")),
      400
    );
  });
  try {
    await Promise.race([loaded, hung]);
    expect(state.snapshot.data).toEqual({ original: { kept: true } });
  } finally {
    clearTimeout(timer);
    release.resolve();
    await holderResult;
    await loaded.catch(() => undefined);
  }
});

test("a recovering read waits for a commit whose reply was lost", async () => {
  const { runtime, first } = await setup();
  runtime.pauseEvents = true;
  const state = await mountState(first);
  const writeStarted = deferred();
  const commitGate = deferred();
  runtime.storage.local.set.mockImplementationOnce(async (entries) => {
    writeStarted.resolve();
    await commitGate.promise;
    Object.assign(runtime.values, entries);
  });
  const save = state.save((previous) => ({ ...previous, kept: true }));
  await writeStarted.promise;
  const readsBeforeRecovery = runtime.storage.local.get.mock.calls.length;
  runtime.ports[0].front.disconnect();
  for (let step = 0; step < 30; step += 1) await Promise.resolve();

  expect(state.isRecovering).toBe(true);
  expect(runtime.storage.local.get.mock.calls.length).toBe(readsBeforeRecovery);
  expect(state.snapshot.data).toEqual({ original: {} });

  commitGate.resolve();
  await expect(save).rejects.toMatchObject({ storageOutcome: "unknown" });
  expect(state.isRecovering).toBe(false);
  expect(state.snapshot.data).toEqual({ original: {}, kept: true });
  expect(state.editTimestamp).toBe(300);
});

test("concurrent read-then-write transactions stay serial and keep both writes", async () => {
  const { runtime, first, second } = await setup();
  runtime.pauseEvents = true;
  await Promise.all([
    first.withTransaction(async (transaction) => {
      const current = (await transaction.getObj(STOKEY_RULES)) || {};
      await transaction.setObj(STOKEY_RULES, { ...current, first: {} });
    }),
    second.withTransaction(async (transaction) => {
      const current = (await transaction.getObj(STOKEY_RULES)) || {};
      await transaction.setObj(STOKEY_RULES, { ...current, second: {} });
    }),
  ]);
  expect(JSON.parse(runtime.values[STOKEY_RULES])).toEqual({
    original: {},
    first: {},
    second: {},
  });
});

test("two independent page states preserve sequential edits to different words", async () => {
  const { runtime, first, second } = await setup();
  runtime.pauseEvents = true;
  const firstState = await mountState(first);
  const secondState = await mountState(second);
  expect(firstState).not.toBe(secondState);
  await firstState.save((previous) => ({ ...previous, first: {} }));
  expect(await first.getRules()).toEqual({ original: {}, first: {} });
  await secondState.save((previous) => ({ ...previous, second: {} }));
  const actual = await second.getRules();
  expect(runtime.storage.local.set).toHaveBeenCalledTimes(2);
  expect(actual).toEqual({ original: {}, first: {}, second: {} });
  expect(secondState.snapshot.data).toEqual(actual);
});

test("control: a single page state preserves both sequential edits", async () => {
  const { first } = await setup();
  const state = await mountState(first);
  await state.save((previous) => ({ ...previous, first: {} }));
  await state.save((previous) => ({ ...previous, second: {} }));
  expect(await first.getRules()).toEqual({
    original: {},
    first: {},
    second: {},
  });
});

test("control: independent pages passing updater functions directly to saveEdit preserve both edits", async () => {
  const { first, second } = await setup();
  await first.saveEdit(
    STOKEY_RULES,
    (previous) => ({ ...previous, first: {} }),
    KV_RULES_KEY
  );
  await second.saveEdit(
    STOKEY_RULES,
    (previous) => ({ ...previous, second: {} }),
    KV_RULES_KEY
  );
  expect(await second.getRules()).toEqual({
    original: {},
    first: {},
    second: {},
  });
});

test("concurrent independent page reducers merge against the coordinated value", async () => {
  const { runtime, first, second } = await setup();
  runtime.pauseEvents = true;
  const firstState = await mountState(first);
  const secondState = await mountState(second);
  await Promise.all([
    firstState.save((previous) => ({ ...previous, first: {} })),
    secondState.save((previous) => ({ ...previous, second: {} })),
  ]);
  expect(await first.getRules()).toEqual({
    original: {},
    first: {},
    second: {},
  });
  expect(secondState.snapshot.data).toEqual({
    original: {},
    first: {},
    second: {},
  });
});

test("a storage change refreshes another mounted page without a manual reload", async () => {
  const { first, second } = await setup();
  const firstState = await mountState(first);
  const secondState = await mountState(second);
  await firstState.save((previous) => ({ ...previous, first: {} }));
  let stop;
  const observed = new Promise((resolve) => {
    stop = firstState.subscribe(({ data }) => {
      if (data?.second) resolve(data);
    });
  });
  cleanups.push(() => stop());
  await secondState.save((previous) => ({ ...previous, second: {} }));
  expect(await observed).toEqual({ original: {}, first: {}, second: {} });
});

test("an explicit replacement is checked against storage rather than a stale preview", async () => {
  const { runtime, first, second } = await setup();
  runtime.pauseEvents = true;
  const firstState = await mountState(first);
  const secondState = await mountState(second);
  await firstState.save((previous) => ({ ...previous, first: {} }));
  const result = await secondState.save({ original: {} });
  expect(result.changed).toBe(true);
  expect(await second.getRules()).toEqual({ original: {} });
});

test("an explicit removal remains null after real storage invalidations", async () => {
  const { first } = await setup();
  const state = await mountState(first);
  await state.remove();
  await state.load();
  expect(await first.getRules()).toBeNull();
  expect(state.snapshot.data).toBeNull();
  expect(state.dirty).toBe(false);
});

test("hydration waits for a replacement read when an event invalidates its first read", async () => {
  const { runtime, first } = await setup();
  let releaseFirstRead;
  const firstRead = new Promise((resolve) => {
    releaseFirstRead = resolve;
  });
  const getValues = runtime.storage.local.get.getMockImplementation();
  let reads = 0;
  runtime.storage.local.get.mockImplementation(async (keys) => {
    const values = await getValues(keys);
    if (keys.includes(STOKEY_RULES) && reads++ === 0) await firstRead;
    return values;
  });
  const state = first.getStorageState(STOKEY_RULES, {});
  cleanups.push(state.subscribe(() => {}));
  const hydrated = state.ensureLoaded();
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
  runtime.values[STOKEY_RULES] = JSON.stringify({ latest: {} });
  runtime.storage.onChanged.emit({ [STOKEY_RULES]: {} }, "local");
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
  releaseFirstRead();
  await hydrated;
  expect(state.snapshot.isLoading).toBe(false);
  expect(state.snapshot.data).toEqual({ latest: {} });
});

test("unknown sync commit outcome enters recovering state, cancels dependent edits, waits for accepted commit via coordinator, and stays blocked if recovery fails", async () => {
  const { runtime, first } = await setup();
  runtime.pauseEvents = true;
  const initialRules = [{ pattern: "local.example", transOpen: "true" }];
  const remoteRules = [{ pattern: "remote.example", transOpen: "true" }];
  runtime.values[STOKEY_RULES] = JSON.stringify(initialRules);
  runtime.values[STOKEY_SYNC] = JSON.stringify({
    syncType: OPT_SYNCTYPE_WEBDAV,
    syncUrl: "https://sync.example.invalid",
    syncUser: "user",
    syncKey: "token",
    syncEncryptKey: "passphrase",
    syncMeta: {
      [KV_RULES_KEY]: { updateAt: 100, syncAt: 50 },
    },
  });

  createClient.mockReturnValue({
    exists: jest.fn(async () => true),
    getFileContents: jest.fn(async () =>
      JSON.stringify({
        key: KV_RULES_KEY,
        value: `cipher:${JSON.stringify(remoteRules)}`,
        updateAt: 500,
      })
    ),
    putFileContents: jest.fn(),
  });

  const state = first.getStorageState(STOKEY_RULES, []);
  state.configureSync(KV_RULES_KEY, (targetState, rev, val) =>
    first.syncStorageState(STOKEY_RULES, KV_RULES_KEY, targetState, rev, val)
  );
  cleanups.push(state.subscribe(() => {}));
  await state.ensureLoaded();

  // Make state dirty so syncStorageState runs
  await state.save(initialRules);
  await state.save([
    ...initialRules,
    { pattern: "dirty.example", transOpen: "true" },
  ]);
  const dirtyValue = state.snapshot.data;
  const dirtyRevision = state.revision;

  const commitWriteStarted = deferred();
  const commitWriteGate = deferred();
  const baseSet = runtime.storage.local.set.getMockImplementation();
  runtime.storage.local.set.mockImplementationOnce(async (entries) => {
    commitWriteStarted.resolve();
    await commitWriteGate.promise;
    return baseSet(entries);
  });

  const syncPromise = first.syncStorageState(
    STOKEY_RULES,
    KV_RULES_KEY,
    state,
    dirtyRevision,
    dirtyValue
  );
  await commitWriteStarted.promise;

  // Queue a dependent edit while the sync commit is in flight in the background
  const dependentReducer = jest.fn((prev) => [
    ...prev,
    { pattern: "dependent.example", transOpen: "true" },
  ]);
  const dependentEdit = state.save(dependentReducer);
  const dependentExpectation = expect(dependentEdit).rejects.toThrow(
    /earlier storage edit failed/i
  );

  const readsBeforeDisconnect = runtime.storage.local.get.mock.calls.length;
  // Disconnect the active sync commit port before the background replies "committed"
  runtime.ports[runtime.ports.length - 1].front.disconnect();
  for (let step = 0; step < 30; step += 1) await Promise.resolve();

  // Must enter recovering immediately and wait for the accepted background commit instead of doing an unlocked get
  expect(state.isRecovering).toBe(true);
  expect(runtime.storage.local.get.mock.calls.length).toBe(
    readsBeforeDisconnect
  );

  // New edits while recovering must be rejected immediately
  await expect(
    state.save([{ pattern: "blocked.example", transOpen: "true" }])
  ).rejects.toMatchObject({
    storageOutcome: "unknown",
  });

  // First let the recovery read fail to verify writes remain blocked when recovery fails
  const setCallsBeforeResolve = runtime.storage.local.set.mock.calls.length;
  runtime.storage.local.get.mockRejectedValueOnce(
    new Error("Transient recovery read failure")
  );
  commitWriteGate.resolve();
  await syncPromise;
  await dependentExpectation;
  expect(runtime.storage.local.set.mock.calls.length).toBe(
    setCallsBeforeResolve
  );
  expect(JSON.parse(runtime.values[STOKEY_RULES])).toEqual(remoteRules);

  // Recovery failed -> must remain in recovering state and continue blocking edits
  expect(state.isRecovering).toBe(true);
  expect(state.dirty).toBe(false);
  await expect(
    state.save([{ pattern: "still-blocked.example", transOpen: "true" }])
  ).rejects.toMatchObject({
    storageOutcome: "unknown",
  });

  // Subsequent load succeeds through coordinator and adopts authoritative value + sync metadata
  await state.load();
  expect(state.isRecovering).toBe(false);
  expect(state.snapshot.data).toEqual(remoteRules);
  expect(state.editTimestamp).toBe(500);
  expect(state.dirty).toBe(false);
});

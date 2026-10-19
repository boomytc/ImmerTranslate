jest.mock("./log", () => ({ kissLog: jest.fn() }));

const flushPromises = async () => {
  for (let step = 0; step < 6; step += 1) {
    await Promise.resolve();
  }
};

const createChangeEvent = () => {
  const listeners = new Set();
  return {
    addListener: jest.fn((listener) => listeners.add(listener)),
    removeListener: jest.fn((listener) => listeners.delete(listener)),
    emit: (...args) => [...listeners].forEach((listener) => listener(...args)),
  };
};

const loadEvents = ({ extension = false, browser } = {}) => {
  let events;
  jest.isolateModules(() => {
    jest.doMock("./client", () => ({
      isExt: extension,
    }));
    jest.doMock("./browser", () => ({ browser }));
    events = require("./storageEvents");
  });
  return events;
};

describe("external storage invalidation", () => {
  let cleanups;

  const subscribe = (events, key, listener) => {
    const unsubscribe = events.subscribeStorageInvalidation(key, listener);
    const cleanup = () => {
      cleanups.delete(cleanup);
      unsubscribe();
    };
    cleanups.add(cleanup);
    return cleanup;
  };

  beforeEach(() => {
    cleanups = new Set();
  });

  afterEach(async () => {
    [...cleanups].forEach((cleanup) => cleanup());
    await flushPromises();
    jest.dontMock("./client");
    jest.dontMock("./browser");
    jest.restoreAllMocks();
  });

  test("shares an extension listener and invalidates only changed local keys", () => {
    const onChanged = createChangeEvent();
    const events = loadEvents({
      extension: true,
      browser: { storage: { onChanged } },
    });
    const first = jest.fn();
    const second = jest.fn();
    const rules = jest.fn();
    const stopFirst = subscribe(events, "settings", first);
    const stopSecond = subscribe(events, "settings", second);
    const stopRules = subscribe(events, "rules", rules);

    expect(onChanged.addListener).toHaveBeenCalledTimes(1);
    onChanged.emit({ settings: { newValue: "dark" } }, "sync");
    onChanged.emit({ unknown: { newValue: "ignored" } }, "local");
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(rules).not.toHaveBeenCalled();

    onChanged.emit({ settings: { newValue: "dark" } }, "local");
    expect(first.mock.calls).toEqual([[]]);
    expect(second.mock.calls).toEqual([[]]);
    expect(rules).not.toHaveBeenCalled();

    stopFirst();
    onChanged.emit({ settings: { newValue: "light" } }, "local");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopSecond();
    expect(onChanged.removeListener).not.toHaveBeenCalled();
    stopRules();
    expect(onChanged.removeListener).toHaveBeenCalledTimes(1);
    expect(onChanged.removeListener).toHaveBeenCalledWith(
      onChanged.addListener.mock.calls[0][0]
    );
  });

  test("filters web storage areas and invalidates every subscribed key on clear", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");
    const removeEventListener = jest.spyOn(window, "removeEventListener");
    const events = loadEvents();
    const settings = jest.fn();
    const rules = jest.fn();
    const stopSettings = subscribe(events, "settings", settings);
    const stopRules = subscribe(events, "rules", rules);
    const emit = (key, storageArea) =>
      window.dispatchEvent(new StorageEvent("storage", { key, storageArea }));

    emit("settings", window.sessionStorage);
    emit("unknown", window.localStorage);
    expect(settings).not.toHaveBeenCalled();
    expect(rules).not.toHaveBeenCalled();

    emit("settings", window.localStorage);
    expect(settings.mock.calls).toEqual([[]]);
    expect(rules).not.toHaveBeenCalled();
    emit(null, window.localStorage);
    expect(settings).toHaveBeenCalledTimes(2);
    expect(rules.mock.calls).toEqual([[]]);

    stopSettings();
    stopRules();
    for (const type of ["storage", "focus", "pageshow"]) {
      const registrations = addEventListener.mock.calls.filter(
        ([eventType]) => eventType === type
      );
      expect(registrations).toHaveLength(1);
      expect(removeEventListener).toHaveBeenCalledWith(
        type,
        registrations[0][1]
      );
    }
    emit(null, window.localStorage);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    expect(settings).toHaveBeenCalledTimes(2);
    expect(rules).toHaveBeenCalledTimes(1);
  });
});

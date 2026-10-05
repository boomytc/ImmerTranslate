jest.mock("../config", () => ({
  DEFAULT_FETCH_INTERVAL: 0,
  DEFAULT_FETCH_LIMIT: 1,
}));
jest.mock("./log", () => ({ kissLog: jest.fn() }));
jest.mock("./cache", () => ({ getHttpCachePolyfill: jest.fn() }));
jest.mock("./request", () => ({
  mergeAbortSignals: (signals) => {
    const active = signals.filter(Boolean);
    if (active.length <= 1) return active[0];
    const controller = new AbortController();
    const abort = () => {
      if (!controller.signal.aborted) controller.abort();
    };
    for (const signal of active) {
      if (signal.aborted) {
        abort();
        break;
      }
      signal.addEventListener("abort", abort, { once: true });
    }
    return controller.signal;
  },
  attachPoolSignal: (args, signal) =>
    signal ? { ...args, opts: { ...args?.opts, signal } } : args,
  fnPolyfill: jest.fn(),
}));
jest.mock("./requestStream", () => ({ requestStream: jest.fn() }));
jest.mock("@streamparser/json", () =>
  jest.requireActual("../../node_modules/@streamparser/json/dist/cjs/index.js")
);

import { fetchData, fetchStream } from "./fetch";
import { clearFetchPool } from "./pool";
import { fnPolyfill } from "./request";
import { requestStream } from "./requestStream";

describe("pooled stream lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    requestStream.mockReset();
    fnPolyfill.mockReset();
  });

  afterEach(() => {
    clearFetchPool();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("rejects the iterator when the pool is cleared before transport starts", async () => {
    const stream = fetchStream("https://example.test", {}, { usePool: true });
    const next = stream.next();
    const expectation = expect(next).rejects.toMatchObject({
      name: "AbortError",
    });

    clearFetchPool();
    await expectation;
    expect(requestStream).not.toHaveBeenCalled();
    await expect(stream.next()).resolves.toEqual({ done: true });
  });

  test("aborts the signal of an in-flight pooled fetch", async () => {
    let seenSignal;
    fnPolyfill.mockImplementation(
      (args) =>
        new Promise((_resolve, reject) => {
          seenSignal = args.opts.signal;
          const abort = () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError")
            );
          if (seenSignal?.aborted) {
            abort();
            return;
          }
          seenSignal?.addEventListener("abort", abort, { once: true });
        })
    );
    const pending = fetchData("https://example.test", {}, { usePool: true });
    const expectation = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    expect(fnPolyfill).toHaveBeenCalledTimes(1);
    expect(seenSignal.aborted).toBe(false);

    clearFetchPool();
    expect(seenSignal.aborted).toBe(true);
    await expectation;
  });

  test("aborts an in-flight pooled stream when the pool is cleared", async () => {
    let streamSignal;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    requestStream.mockImplementation(async function* (_input, _init, opts) {
      streamSignal = opts.signal;
      await gate;
      if (opts.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      yield "late chunk";
    });
    const stream = fetchStream("https://example.test", {}, { usePool: true });
    const next = stream.next();
    const expectation = expect(next).rejects.toMatchObject({
      name: "AbortError",
    });

    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
    expect(requestStream).toHaveBeenCalledTimes(1);
    expect(streamSignal.aborted).toBe(false);

    clearFetchPool();
    expect(streamSignal.aborted).toBe(true);
    release();
    await expectation;
    await expect(stream.next()).resolves.toEqual({ done: true });
  });

  test("continues delivering and completing a normally scheduled stream", async () => {
    requestStream.mockImplementation(async function* () {
      yield "first chunk";
      yield "second chunk";
    });
    const stream = fetchStream("https://example.test", {}, { usePool: true });
    const first = stream.next();

    jest.runOnlyPendingTimers();
    await expect(first).resolves.toEqual({ done: false, value: "first chunk" });
    await expect(stream.next()).resolves.toEqual({
      done: false,
      value: "second chunk",
    });
    await expect(stream.next()).resolves.toEqual({ done: true });
    expect(requestStream).toHaveBeenCalledTimes(1);
  });
});

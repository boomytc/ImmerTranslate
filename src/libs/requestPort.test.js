jest.mock("./client", () => ({ isExt: true }));
jest.mock("./browser", () => ({
  isBg: () => false,
  browser: { runtime: { connect: jest.fn() } },
}));
jest.mock("./msg", () => ({ sendBgMsg: jest.fn() }));
jest.mock("./storage", () => ({ getSettingWithDefault: jest.fn() }));
jest.mock("./log", () => ({ kissLog: jest.fn() }));
jest.mock("../config", () => ({
  DEFAULT_FETCH_INTERVAL: 0,
  DEFAULT_FETCH_LIMIT: 1,
  DEFAULT_HTTP_TIMEOUT: 30,
  MSG_FETCH: "immertranslate_fetch",
  PORT_REQUEST_FETCH: "immertranslate_request_fetch",
}));

import { browser } from "./browser";
import { sendBgMsg } from "./msg";
import { getFetchPool } from "./pool";
import { attachPoolSignal, fetchHandle, fnPolyfill } from "./request";
import { handleRequestPort } from "./requestPort";

const event = () => {
  const listeners = new Set();
  return {
    listeners,
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    emit: (...args) => [...listeners].forEach((fn) => fn(...args)),
  };
};
const ports = () => {
  const client = { onMessage: event(), onDisconnect: event() };
  const server = { onMessage: event(), onDisconnect: event() };
  let disconnected = false;
  const disconnect = () => {
    if (disconnected) return;
    disconnected = true;
    client.onDisconnect.emit();
    server.onDisconnect.emit();
  };
  for (const [from, to] of [
    [client, server],
    [server, client],
  ]) {
    from.disconnect = jest.fn(disconnect);
    from.postMessage = jest.fn((message) => {
      if (disconnected) throw new Error("disconnected");
      to.onMessage.emit(JSON.parse(JSON.stringify(message)));
    });
  }
  return { client, server };
};
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("ordinary extension request port lifecycle", () => {
  let pair;
  let execute;
  beforeEach(() => {
    pair = ports();
    execute = jest.fn().mockResolvedValue({ translated: "OK" });
    browser.runtime.connect.mockImplementation(() => {
      handleRequestPort(pair.server, execute);
      return pair.client;
    });
    sendBgMsg.mockReset();
  });
  afterEach(() => jest.restoreAllMocks());
  const request = (signal, init = {}) =>
    fnPolyfill({
      input: "https://example.test",
      init,
      opts: { signal, expect: "json" },
    });
  const expectClean = () => {
    for (const port of [pair.client, pair.server]) {
      expect(port.onMessage.listeners.size).toBe(0);
      expect(port.onDisconnect.listeners.size).toBe(0);
    }
  };

  test("routes fetch without a caller signal through the port", async () => {
    await expect(request(undefined)).resolves.toEqual({ translated: "OK" });
    expect(browser.runtime.connect).toHaveBeenCalledWith({
      name: "immertranslate_request_fetch",
    });
    expect(sendBgMsg).not.toHaveBeenCalled();
    expectClean();
  });

  test("uses the cancellable port and preserves ordinary response data", async () => {
    const controller = new AbortController();
    await expect(request(controller.signal)).resolves.toEqual({
      translated: "OK",
    });
    expect(browser.runtime.connect).toHaveBeenCalledWith({
      name: "immertranslate_request_fetch",
    });
    expect(sendBgMsg).not.toHaveBeenCalled();
    expect(execute.mock.calls[0][0].opts.signal).toBeInstanceOf(AbortSignal);
    expect(pair.client.disconnect).toHaveBeenCalledTimes(1);
    expectClean();
  });

  test("caller cancellation aborts the in-flight background transport", async () => {
    let signal;
    execute.mockImplementation(
      ({ opts }) =>
        new Promise((_resolve, reject) => {
          signal = opts.signal;
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        })
    );
    const controller = new AbortController();
    const pending = request(controller.signal);
    const result = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await flush();
    controller.abort();
    await result;
    expect(signal.aborted).toBe(true);
    await flush();
    expectClean();
  });

  test("pre-aborted requests create no port and no background work", async () => {
    browser.runtime.connect.mockClear();
    const controller = new AbortController();
    controller.abort();
    await expect(request(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(browser.runtime.connect).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  test("abort between connection and start causes no HTTP side effect", async () => {
    const controller = new AbortController();
    browser.runtime.connect.mockImplementation(() => {
      handleRequestPort(pair.server, execute);
      controller.abort();
      return pair.client;
    });
    await expect(request(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    await flush();
    expect(execute).not.toHaveBeenCalled();
    expect(pair.client.postMessage).not.toHaveBeenCalled();
    expectClean();
  });

  test("ignores late completion from a disconnected operation", async () => {
    let complete;
    execute.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const controller = new AbortController();
    const pending = request(controller.signal);
    const result = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await flush();
    controller.abort();
    await result;
    complete({ stale: true });
    await flush();
    expect(pair.server.postMessage).not.toHaveBeenCalled();
    expectClean();
  });

  test("propagates real background failures with their error name", async () => {
    execute.mockRejectedValue(new TypeError("HTTP request failed"));
    await expect(request(new AbortController().signal)).rejects.toMatchObject({
      name: "TypeError",
      message: "HTTP request failed",
    });
    expectClean();
  });

  test("unexpected disconnect rejects and aborts the backend operation", async () => {
    let signal;
    execute.mockImplementation(
      ({ opts }) =>
        new Promise(() => {
          signal = opts.signal;
        })
    );
    const pending = request(new AbortController().signal);
    const result = expect(pending).rejects.toThrow(
      "Background request port disconnected"
    );
    await flush();
    pair.server.disconnect();
    await result;
    expect(signal.aborted).toBe(true);
    expectClean();
  });

  test("merges init cancellation without serializing its AbortSignal", async () => {
    const initController = new AbortController();
    let signal;
    execute.mockImplementation(
      ({ opts, init }) =>
        new Promise((_resolve, reject) => {
          expect(init.signal).toBeUndefined();
          signal = opts.signal;
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        })
    );
    const pending = request(new AbortController().signal, {
      signal: initController.signal,
    });
    const result = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await flush();
    initController.abort();
    await result;
    expect(signal.aborted).toBe(true);
    await flush();
    expectClean();
  });

  test("admits exactly one start message on a connection", async () => {
    let complete;
    execute.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const pending = request(new AbortController().signal);
    pair.client.postMessage({
      action: "start",
      args: { input: "https://second.test" },
    });
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
    complete({ ok: true });
    await expect(pending).resolves.toEqual({ ok: true });
    expectClean();
  });

  describe("HTTP status preservation across port and TaskPool retry", () => {
    let baseTime = Date.now();

    beforeEach(() => {
      baseTime += 10000;
      jest.useFakeTimers();
      jest.setSystemTime(baseTime);
      getFetchPool(0, 1).clear();
      browser.runtime.connect.mockImplementation(() => {
        pair = ports();
        handleRequestPort(pair.server, fetchHandle);
        return pair.client;
      });
    });

    afterEach(() => {
      getFetchPool(0, 1).clear();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    const flushAsync = async () => {
      for (let i = 0; i < 25; i++) await Promise.resolve();
    };
    const advancePool = async (ms = 1000) => {
      jest.advanceTimersByTime(ms);
      await flushAsync();
    };
    const pooledFetch = (input, init, opts = {}) =>
      getFetchPool(0, 1).push(
        (args, signal) => fnPolyfill(attachPoolSignal(args, signal)),
        { fn: fetchHandle, input, init, opts }
      );

    test.each([429, 503])(
      "preserves HTTP %s from real Response across port so TaskPool retries",
      async (status) => {
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ error: "service busy" }), {
              status,
              statusText: "Busy",
              headers: { "Content-Type": "application/json" },
            })
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ translated: "retried-ok" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );

        const pending = pooledFetch("https://example.test/translate", {
          method: "POST",
        });

        await advancePool();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        await advancePool();
        await advancePool();

        await expect(pending).resolves.toEqual({ translated: "retried-ok" });
        expect(global.fetch).toHaveBeenCalledTimes(2);
      }
    );

    test.each([400, 401])(
      "preserves HTTP %s across port so network-like error body is not retried",
      async (status) => {
        global.fetch = jest.fn(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                error: "upstream network error and timeout hint",
              }),
              {
                status,
                statusText: "Client Error",
                headers: { "Content-Type": "application/json" },
              }
            )
          )
        );

        const pending = pooledFetch("https://example.test/translate", {
          method: "POST",
        });
        const expectation = expect(pending).rejects.toMatchObject({
          status,
          message: expect.stringContaining("network error"),
        });

        await advancePool();
        await expectation;
        jest.advanceTimersByTime(5000);
        await flush();

        expect(global.fetch).toHaveBeenCalledTimes(1);
      }
    );

    test("does not retry AbortError across port", async () => {
      const controller = new AbortController();
      global.fetch = jest.fn(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true }
            );
          })
      );

      const pending = pooledFetch(
        "https://example.test/translate",
        { method: "POST" },
        { signal: controller.signal }
      );
      const expectation = expect(pending).rejects.toMatchObject({
        name: "AbortError",
      });

      await advancePool();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      controller.abort();
      await expectation;

      jest.advanceTimersByTime(5000);
      await flush();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("keeps error semantics when error has no valid HTTP status", async () => {
      const invalidStatusError = new Error("application failure");
      invalidStatusError.status = "503";
      browser.runtime.connect.mockImplementation(() => {
        pair = ports();
        handleRequestPort(
          pair.server,
          jest.fn().mockRejectedValueOnce(invalidStatusError)
        );
        return pair.client;
      });

      const pending = pooledFetch("https://example.test/translate", {
        method: "POST",
      });
      const caughtPromise = pending.catch((err) => err);

      await advancePool();
      const caught = await caughtPromise;
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toBe("application failure");
      expect(caught.status).toBeUndefined();
      expect("status" in caught).toBe(false);
    });
  });
});

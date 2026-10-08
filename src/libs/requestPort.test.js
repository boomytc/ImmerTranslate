jest.mock("./client", () => ({ isExt: true, isGm: false }));
jest.mock("./browser", () => ({
  isBg: () => false,
  browser: { runtime: { connect: jest.fn() } },
}));
jest.mock("./msg", () => ({ sendBgMsg: jest.fn() }));
jest.mock("./storage", () => ({ getSettingWithDefault: jest.fn() }));
jest.mock("./log", () => ({ kissLog: jest.fn() }));
jest.mock("../config", () => ({
  DEFAULT_HTTP_TIMEOUT: 30,
  MSG_FETCH: "kiss_fetch",
  PORT_REQUEST_FETCH: "kiss_request_fetch",
}));

import { browser } from "./browser";
import { sendBgMsg } from "./msg";
import { fnPolyfill } from "./request";
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

  test("uses the cancellable port and preserves ordinary response data", async () => {
    const controller = new AbortController();
    await expect(request(controller.signal)).resolves.toEqual({
      translated: "OK",
    });
    expect(browser.runtime.connect).toHaveBeenCalledWith({
      name: "kiss_request_fetch",
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
});

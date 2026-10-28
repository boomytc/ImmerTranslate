const { TextDecoder: UtilTextDecoder } = require("util");
const originalTextDecoder = global.TextDecoder || UtilTextDecoder;

const mockClient = { isExt: false };
const mockBrowserState = { isBg: false };

jest.mock("webextension-polyfill", () => ({
  runtime: {
    connect: jest.fn(),
    lastError: undefined,
  },
}));

jest.mock("./client", () => ({
  get isExt() {
    return mockClient.isExt;
  },
}));

jest.mock("./browser", () => ({
  isBg: () => mockBrowserState.isBg,
}));

jest.mock("@streamparser/json", () => ({
  JSONParser: jest.fn(),
}));

jest.mock("./log", () => ({
  ...jest.requireActual("./log"),
  kissLog: jest.fn(),
}));

jest.mock("./storage", () => ({
  getSettingWithDefault: jest.fn(() => Promise.resolve({ httpTimeout: 1000 })),
}));

import browser from "webextension-polyfill";
import { getBatchQueue } from "./batchQueue";
import { fetchStream } from "./fetch";
import { getFetchPool } from "./pool";
import { fetchStreamNative, requestStream } from "./requestStream";

describe("fetchStreamNative", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    global.TextDecoder = originalTextDecoder;
  });

  test("cancels the reader when stream consumption stops early", async () => {
    global.TextDecoder = class {
      decode() {
        return "data: one\n\n";
      }
    };
    const cancel = jest.fn(() => Promise.resolve());
    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([
            100, 97, 116, 97, 58, 32, 111, 110, 101, 10, 10,
          ]),
        })
        .mockResolvedValue(new Promise(() => {})),
      cancel,
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        body: { getReader: () => reader },
      })
    );

    const iterator = fetchStreamNative(
      "https://example.test",
      {},
      {
        httpTimeout: 1000,
      }
    );
    await expect(iterator.next()).resolves.toEqual({
      value: "one",
      done: false,
    });
    await iterator.return();

    expect(cancel).toHaveBeenCalled();
  });

  test("includes the HTTP error body and status", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "quota exceeded" }), {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const iterator = fetchStreamNative(
      "https://example.test",
      {},
      { httpTimeout: 1000 }
    );

    await expect(iterator.next()).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining("quota exceeded"),
    });
  });
});

const createEvent = () => {
  const listeners = new Set();
  return {
    listeners,
    addListener: jest.fn((fn) => listeners.add(fn)),
    removeListener: jest.fn((fn) => listeners.delete(fn)),
    emit: (...args) => [...listeners].forEach((fn) => fn(...args)),
  };
};

const createPortPair = () => {
  const client = { onMessage: createEvent(), onDisconnect: createEvent() };
  const server = { onMessage: createEvent(), onDisconnect: createEvent() };
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
      if (disconnected) throw new Error("Port is disconnected");
      to.onMessage.emit(JSON.parse(JSON.stringify(message)));
    });
  }
  return {
    client,
    server,
    get disconnected() {
      return disconnected;
    },
  };
};

const withTimeout = (promise, ms = 100) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timed out waiting for stream")), ms)
    ),
  ]);

describe("requestStream over extension Port", () => {
  let pair;

  beforeEach(() => {
    mockClient.isExt = true;
    mockBrowserState.isBg = false;
    browser.runtime.lastError = undefined;
    pair = createPortPair();
    browser.runtime.connect.mockReset().mockImplementation(() => pair.client);
    getFetchPool(0, 1).clear();
  });

  afterEach(() => {
    mockClient.isExt = false;
    mockBrowserState.isBg = false;
    browser.runtime.lastError = undefined;
    getFetchPool(0, 1).clear();
    jest.restoreAllMocks();
  });

  const expectPortClean = (port = pair.client) => {
    expect(port.onMessage.listeners.size).toBe(0);
    expect(port.onDisconnect.listeners.size).toBe(0);
  };

  test("disconnect before done/error without runtime.lastError rejects waiting consumer and cleans up listeners", async () => {
    const controller = new AbortController();
    const removeAbort = jest.spyOn(controller.signal, "removeEventListener");
    const iterator = requestStream(
      "https://example.test/stream",
      { method: "POST" },
      { signal: controller.signal }
    );

    const firstNext = iterator.next();
    pair.server.postMessage({ type: "delta", data: "chunk-1" });
    await expect(withTimeout(firstNext)).resolves.toEqual({
      value: "chunk-1",
      done: false,
    });

    const secondNext = iterator.next();
    pair.server.disconnect();

    await expect(withTimeout(secondNext)).rejects.toThrow("Port disconnected");
    expect(removeAbort).toHaveBeenCalledTimes(1);
    expectPortClean();
  });

  test("disconnect after done does not reverse success even before buffered chunks are drained", async () => {
    const iterator = requestStream("https://example.test/stream", {});
    const firstNext = iterator.next();

    pair.server.postMessage({ type: "delta", data: "alpha" });
    pair.server.postMessage({ type: "delta", data: "beta" });
    pair.server.postMessage({ type: "done" });
    browser.runtime.lastError = { message: "Late disconnect after done" };
    pair.server.disconnect();

    await expect(withTimeout(firstNext)).resolves.toEqual({
      value: "alpha",
      done: false,
    });
    await expect(withTimeout(iterator.next())).resolves.toEqual({
      value: "beta",
      done: false,
    });
    await expect(withTimeout(iterator.next())).resolves.toEqual({
      value: undefined,
      done: true,
    });
    expectPortClean();
  });

  test("interleaved error, abort, and disconnect settle once with the first terminal error", async () => {
    const abortFirstController = new AbortController();
    const abortFirstIterator = requestStream(
      "https://example.test/stream",
      {},
      { signal: abortFirstController.signal }
    );
    const abortFirstPending = abortFirstIterator.next();

    abortFirstController.abort();
    pair.client.onMessage.emit({ type: "error", error: "late server error" });
    pair.server.disconnect();

    await expect(withTimeout(abortFirstPending)).rejects.toMatchObject({
      name: "AbortError",
    });
    expectPortClean();

    pair = createPortPair();
    const errorFirstController = new AbortController();
    const errorFirstIterator = requestStream(
      "https://example.test/stream",
      {},
      { signal: errorFirstController.signal }
    );
    const errorFirstPending = errorFirstIterator.next();

    pair.server.postMessage({ type: "error", error: "upstream stream error" });
    browser.runtime.lastError = { message: "disconnect after error" };
    pair.server.disconnect();
    errorFirstController.abort();

    await expect(withTimeout(errorFirstPending)).rejects.toThrow(
      "upstream stream error"
    );
    expectPortClean();
  });

  test("early consumer exit removes listeners and aborts underlying background stream", async () => {
    const cancelReader = jest.fn(() => Promise.resolve());
    let bgSignal;
    global.TextDecoder = class {
      decode() {
        return "data: first\n\n";
      }
    };
    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([1, 2, 3]),
        })
        .mockImplementation(() => new Promise(() => {})),
      cancel: cancelReader,
    };
    global.fetch = jest.fn((_input, init) => {
      bgSignal = init.signal;
      return Promise.resolve({
        ok: true,
        body: { getReader: () => reader },
      });
    });

    pair.server.onMessage.addListener(async (msg) => {
      if (msg.action !== "start") return;
      const bgController = new AbortController();
      pair.server.onDisconnect.addListener(() => bgController.abort());
      try {
        for await (const chunk of fetchStreamNative(
          msg.args.input,
          msg.args.init,
          { ...msg.args.opts, signal: bgController.signal }
        )) {
          pair.server.postMessage({ type: "delta", data: chunk });
        }
      } catch {
        // aborted on disconnect
      }
    });

    const callerController = new AbortController();
    const removeAbort = jest.spyOn(
      callerController.signal,
      "removeEventListener"
    );
    const iterator = requestStream(
      "https://example.test/stream",
      {},
      { signal: callerController.signal }
    );

    await expect(withTimeout(iterator.next())).resolves.toEqual({
      value: "first",
      done: false,
    });
    await withTimeout(iterator.return());

    expect(pair.client.disconnect).toHaveBeenCalled();
    expect(removeAbort).toHaveBeenCalledTimes(1);
    expectPortClean();
    expect(bgSignal.aborted).toBe(true);
    expect(cancelReader).toHaveBeenCalled();
  });

  test("disconnect without lastError releases TaskPool and BatchQueue concurrency slots", async () => {
    const firstPair = createPortPair();
    const secondPair = createPortPair();
    let connectCount = 0;
    browser.runtime.connect.mockImplementation(() => {
      connectCount += 1;
      return connectCount === 1 ? firstPair.client : secondPair.client;
    });

    secondPair.server.onMessage.addListener((msg) => {
      if (msg.action === "start") {
        secondPair.server.postMessage({
          type: "delta",
          data: '{"id":0,"text":"recovered"}',
        });
        secondPair.server.postMessage({ type: "done" });
      }
    });

    const queue = getBatchQueue(
      "stream-disconnect-slot-release",
      async function* (_payloads, batchArgs) {
        let index = 0;
        for await (const chunk of fetchStream(
          "https://example.test/stream",
          { method: "POST" },
          {
            usePool: true,
            fetchInterval: 0,
            fetchLimit: 1,
            signal: batchArgs?.signal,
          }
        )) {
          const parsed = JSON.parse(chunk);
          yield { id: parsed.id ?? index++, result: [parsed.text, "en"] };
        }
      },
      { batchSize: 1, batchInterval: 0, batchConcurrency: 1 }
    );

    const firstTask = queue.addTask("first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    firstPair.server.disconnect();

    await expect(withTimeout(firstTask)).rejects.toThrow("Port disconnected");

    const secondTask = queue.addTask("second");
    await expect(withTimeout(secondTask)).resolves.toEqual(["recovered", "en"]);
  });
});

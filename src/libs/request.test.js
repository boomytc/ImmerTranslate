jest.mock("../config", () => ({
  CLIENT_EXTS: [],
  DEFAULT_HTTP_TIMEOUT: 30,
  MSG_FETCH: "immertranslate_fetch",
}));

jest.mock("./log", () => ({
  kissLog: jest.fn(),
}));

import { fetchPatcher, resolveHttpTimeout } from "./request";

describe("resolveHttpTimeout", () => {
  test("converts second-based timeout values to milliseconds", () => {
    expect(resolveHttpTimeout({ httpTimeout: 30 })).toBe(30000);
    expect(resolveHttpTimeout({ httpTimeout: 600 })).toBe(600000);
  });

  test("falls back to the default timeout in seconds", () => {
    expect(resolveHttpTimeout()).toBe(30000);
    expect(resolveHttpTimeout({ httpTimeout: 0 })).toBe(30000);
  });
});

describe("fetchPatcher", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("passes external abort signal to native fetch", async () => {
    const controller = new AbortController();
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    );

    await fetchPatcher(
      "https://example.test",
      {},
      { signal: controller.signal }
    );

    expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  test("merged signal aborts when external signal aborts", async () => {
    const controller = new AbortController();
    let capturedSignal;
    global.fetch = jest.fn((_, init) => {
      capturedSignal = init.signal;
      return new Promise(() => {});
    });

    fetchPatcher("https://example.test", {}, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    expect(capturedSignal.aborted).toBe(true);
  });
});

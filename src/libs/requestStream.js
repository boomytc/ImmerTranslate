/**
 * @file requestStream.js
 * @description 流式网络请求适配层。负责 native fetch stream、
 * WebExtension Port 代理，以及 SSE 数据帧的增量解包与取消传播。
 */

import browser from "webextension-polyfill";
import { isExt } from "./client";
import { isBg } from "./browser";
import { PORT_STREAM_FETCH } from "../config";
import { createSSEParser, createAsyncQueue } from "./stream";
import {
  createTimeoutSignal,
  DEFAULT_HTTP_TIMEOUT_MS,
  mergeAbortSignals,
  resolveHttpTimeout,
} from "./request";
import { createHttpError } from "./response";

/**
 * 浏览器原生 fetch 的 SSE 流式请求。
 *
 * @param {string} input 请求 URL。
 * @param {Object} [init={}] Fetch 初始化参数。
 * @param {Object} [opts] 请求选项。
 * @param {number} [opts.httpTimeout] 超时时间。
 * @param {AbortSignal} [opts.signal] 外部取消信号。
 * @returns {AsyncGenerator<string>} 逐条产出 SSE data 字段。
 */
export async function* fetchStreamNative(input, init = {}, opts = {}) {
  const options = opts || {};
  const timeout = options.httpTimeout || DEFAULT_HTTP_TIMEOUT_MS;
  const signal = mergeAbortSignals([
    init.signal,
    options.signal,
    createTimeoutSignal(timeout),
  ]);
  const response = await fetch(input, { ...init, signal });

  if (!response.ok) {
    throw await createHttpError(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parseSSE = createSSEParser();
  const cancelOnAbort = () => {
    void reader.cancel?.();
  };
  signal?.addEventListener?.("abort", cancelOnAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const data of parseSSE(decoder.decode(value, { stream: true }))) {
        yield data;
      }
    }
  } finally {
    signal?.removeEventListener?.("abort", cancelOnAbort);
    // 当调用方提前结束 async generator 时，主动释放 reader 锁并推动底层连接关闭。
    await reader.cancel?.();
  }
}

/**
 * WebExtension content script 通过 Port 代理发起 SSE 请求。
 *
 * @param {string} input 请求 URL。
 * @param {Object} init Fetch 初始化参数。
 * @param {Object} opts 请求选项。
 * @returns {AsyncGenerator<string>} 逐条产出 background 推送的 SSE data 字段。
 */
async function* fetchStreamViaPort(input, init, opts) {
  const { signal: optSignal, ...serializableOpts } = opts || {};
  const { signal: initSignal, ...serializableInit } = init || {};
  const signal = mergeAbortSignals([initSignal, optSignal]);
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }

  const asyncQueue = createAsyncQueue();

  let port;
  try {
    port = browser.runtime.connect({ name: PORT_STREAM_FETCH });
  } catch (e) {
    throw new Error("Failed to connect to background: " + e.message);
  }

  let settled = false;
  let cleanedUp = false;
  const disconnectPort = () => {
    try {
      port.disconnect();
    } catch {
      // Port 可能已被对端关闭，重复断开不应覆盖真正的流式请求错误。
    }
  };
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    signal?.removeEventListener?.("abort", abortBySignal);
    port.onMessage.removeListener?.(onMessage);
    port.onDisconnect.removeListener?.(onDisconnect);
  };
  const settleDone = () => {
    if (settled) return;
    settled = true;
    cleanup();
    asyncQueue.finish();
  };
  const settleError = (error) => {
    if (settled) return;
    settled = true;
    cleanup();
    asyncQueue.error(error);
  };

  const onMessage = (message) => {
    if (settled) return;
    switch (message?.type) {
      case "delta":
        asyncQueue.push(message.data);
        break;
      case "done":
        settleDone();
        break;
      case "error":
        settleError(new Error(message.error || "Stream request failed."));
        break;
      default:
        break;
    }
  };

  const onDisconnect = () => {
    if (settled) return;
    const lastError = browser.runtime.lastError;
    settleError(
      signal?.aborted
        ? new DOMException("The operation was aborted.", "AbortError")
        : new Error(lastError?.message || "Port disconnected")
    );
  };

  const abortBySignal = () => {
    settleError(new DOMException("The operation was aborted.", "AbortError"));
    disconnectPort();
  };

  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(onDisconnect);
  signal?.addEventListener?.("abort", abortBySignal, { once: true });

  if (signal?.aborted) {
    abortBySignal();
  } else {
    try {
      port.postMessage({
        action: "start",
        // AbortSignal 不能可靠穿过 Port 结构化克隆，background 端会为本次连接重新创建控制器。
        args: {
          input,
          init: init ? serializableInit : init,
          opts: serializableOpts,
        },
      });
    } catch (error) {
      settleError(error);
      disconnectPort();
    }
  }

  try {
    yield* asyncQueue.iterate();
  } finally {
    settled = true;
    cleanup();
    // 前台停止消费流时断开 Port，background 会据此 abort 底层 fetch，避免请求继续空跑。
    disconnectPort();
  }
}

/**
 * 根据当前运行环境选择合适的 SSE 流式请求通道。
 *
 * @param {string} input 请求 URL。
 * @param {Object} init Fetch 初始化参数。
 * @param {Object} opts 请求选项。
 * @returns {AsyncGenerator<string>} 逐条产出 SSE data 字段。
 */
export async function* requestStream(input, init, opts = {}) {
  const httpTimeout = resolveHttpTimeout(opts);
  opts = {
    ...opts,
    httpTimeout,
  };

  if (isExt && !isBg()) {
    yield* fetchStreamViaPort(input, init, opts);
    return;
  }

  yield* fetchStreamNative(input, init, opts);
}

import { browser } from "./browser";
import { PORT_REQUEST_FETCH } from "../config";

const aborted = () =>
  new DOMException("The operation was aborted.", "AbortError");

/** A dedicated port binds one ordinary request to its caller's lifetime. */
export function requestThroughPort(args, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(aborted());
      return;
    }
    const port = browser.runtime.connect({ name: PORT_REQUEST_FETCH });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
      try {
        port.disconnect();
      } catch {
        /* The context may already be gone. */
      }
      callback(value);
    };
    const onAbort = () => finish(reject, aborted());
    const onDisconnect = () => {
      const message = browser.runtime.lastError?.message;
      finish(
        reject,
        signal?.aborted
          ? aborted()
          : new Error(message || "Background request port disconnected.")
      );
    };
    const onMessage = (message) => {
      if (message.type === "result") finish(resolve, message.data);
      else if (message.type === "error") {
        const error = new Error(
          message.error?.message || "Background request failed."
        );
        error.name = message.error?.name || "Error";
        finish(reject, error);
      }
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    try {
      port.postMessage({ action: "start", args });
    } catch (error) {
      finish(reject, error);
    }
  });
}

/** Register cancellation before admitting the first request message. */
export function handleRequestPort(port, execute) {
  const controller = new AbortController();
  let disconnected = false;
  let started = false;
  const cleanup = () => {
    port.onMessage.removeListener(onMessage);
    port.onDisconnect.removeListener(onDisconnect);
  };
  const onDisconnect = () => {
    disconnected = true;
    controller.abort();
    cleanup();
  };
  const post = (message) => {
    if (disconnected) return;
    try {
      port.postMessage(message);
    } catch {
      onDisconnect();
    }
  };
  const start = async (args = {}) => {
    if (started || disconnected) return;
    started = true;
    try {
      // Disconnecting immediately after connect must cause no HTTP side effect.
      await Promise.resolve();
      if (disconnected) return;
      const data = await execute({
        ...args,
        opts: { ...args.opts, signal: controller.signal },
      });
      post({ type: "result", data });
    } catch (error) {
      post({
        type: "error",
        error: { name: error.name, message: error.message },
      });
    } finally {
      cleanup();
    }
  };
  const onMessage = (message) => {
    if (message.action === "start") start(message.args);
  };
  port.onDisconnect.addListener(onDisconnect);
  port.onMessage.addListener(onMessage);
}

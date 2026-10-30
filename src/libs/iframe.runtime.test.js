import {
  applyParentRuntime,
  frameRuntimeState,
  installFrameRuntimeBridge,
  MSG_FRAME_RUNTIME_QUERY,
  MSG_FRAME_RUNTIME_STATE,
  queryParentFrameRuntime,
  replyFrameRuntime,
} from "./iframe";
import { MSG_TRANS_TOGGLE } from "../config";

test("frame runtime state carries translation and fab visibility", () => {
  expect(frameRuntimeState({ transOpen: "true", fabVisible: false })).toEqual({
    transOpen: true,
    fabVisible: false,
  });
  expect(
    applyParentRuntime(
      { transOpen: "false", apiSlug: "google" },
      {
        transOpen: true,
        fabVisible: false,
      }
    )
  ).toEqual({ transOpen: "true", apiSlug: "google" });
  expect(
    applyParentRuntime({ transOpen: "true" }, { transOpen: false })
  ).toEqual({ transOpen: "false" });
});

test("late frames inherit only temporary presentation fields, not selectors or settings", () => {
  const pagePatch = {
    apiSlug: "Google",
    toLang: "ja",
    textStyle: "highlight",
    transOnly: "true",
    selector: "#parent-only",
    transOpen: "false",
    transApis: [{ apiKey: "must-not-leave-the-runtime" }],
  };
  const state = frameRuntimeState({ transOpen: true, pagePatch });
  expect(state.pagePatch).toEqual({
    apiSlug: "Google",
    toLang: "ja",
    textStyle: "highlight",
    transOnly: "true",
  });
  expect(
    applyParentRuntime({ selector: "article", apiSlug: "Microsoft" }, state)
  ).toEqual({
    selector: "article",
    apiSlug: "Google",
    toLang: "ja",
    textStyle: "highlight",
    transOnly: "true",
    transOpen: "true",
  });
});

test("runtime replies from a sibling cannot satisfy a parent query", async () => {
  const parent = { postMessage: jest.fn() };
  const listeners = new Set();
  const frame = {
    top: parent,
    parent,
    setTimeout,
    clearTimeout,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  const pending = queryParentFrameRuntime(1000, frame);
  const { requestId } = parent.postMessage.mock.calls[0][0];
  const data = {
    action: MSG_FRAME_RUNTIME_STATE,
    requestId,
    transOpen: true,
    pagePatch: { apiSlug: "Google" },
  };
  listeners.forEach((listener) => listener({ data, source: {} }));
  expect(listeners.size).toBe(1);
  listeners.forEach((listener) => listener({ data, source: parent }));
  await expect(pending).resolves.toMatchObject({
    transOpen: true,
    pagePatch: { apiSlug: "Google" },
  });
});

test("the top frame replies with its current runtime", () => {
  const source = { postMessage: jest.fn() };
  expect(
    replyFrameRuntime(
      { data: { action: MSG_FRAME_RUNTIME_QUERY, requestId: "child" }, source },
      { transOpen: "true", fabVisible: true }
    )
  ).toBe(true);
  expect(source.postMessage).toHaveBeenCalledWith(
    {
      action: MSG_FRAME_RUNTIME_STATE,
      requestId: "child",
      transOpen: true,
      fabVisible: true,
    },
    "*"
  );
});

test("a bridge answers a child query from the live getter", () => {
  let transOpen = "true";
  const remove = installFrameRuntimeBridge(() => ({
    transOpen,
    fabVisible: transOpen === "true",
  }));
  const source = { postMessage: jest.fn() };
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { action: MSG_FRAME_RUNTIME_QUERY, requestId: "late-frame" },
      source,
    })
  );
  expect(source.postMessage.mock.calls[0][0].transOpen).toBe(true);
  transOpen = "false";
  source.postMessage.mockClear();
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { action: MSG_FRAME_RUNTIME_QUERY, requestId: "late-frame" },
      source,
    })
  );
  expect(source.postMessage.mock.calls[0][0]).toMatchObject({
    transOpen: false,
    fabVisible: false,
  });
  remove();
});

test("a parent startup broadcast resolves an outstanding child query only from an ancestor", async () => {
  const parent = { postMessage: jest.fn() };
  const listeners = new Set();
  const frame = {
    top: parent,
    parent,
    setTimeout,
    clearTimeout,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  const pending = queryParentFrameRuntime(1000, frame);
  const message = { action: MSG_TRANS_TOGGLE, args: { enabled: true } };
  listeners.forEach((listener) => listener({ data: message, source: {} }));
  expect(listeners.size).toBe(1);
  listeners.forEach((listener) => listener({ data: message, source: parent }));
  await expect(pending).resolves.toEqual({
    transOpen: true,
    fabVisible: false,
  });
  expect(listeners.size).toBe(0);
});

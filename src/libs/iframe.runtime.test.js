import {
  applyParentRuntime,
  frameRuntimeState,
  installFrameRuntimeBridge,
  MSG_FRAME_RUNTIME_QUERY,
  MSG_FRAME_RUNTIME_STATE,
  replyFrameRuntime,
} from "./iframe";

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

import {
  LOCATION_CHANGE_EVENT,
  LOCATION_HOOK_MARKER,
  installLocationHook,
  locationHookInjection,
} from "./locationHook";

describe("installLocationHook", () => {
  test("pushState and replaceState dispatch one event and a second install does not wrap again", () => {
    const events = [];
    const page = {
      history: {
        pushState: jest.fn(() => "pushed"),
        replaceState: jest.fn(() => "replaced"),
      },
      Event,
      dispatchEvent(event) {
        events.push(event.type);
      },
    };

    expect(installLocationHook(page)).toBe(true);
    const wrappedPush = page.history.pushState;
    const wrappedReplace = page.history.replaceState;
    expect(installLocationHook(page)).toBe(false);
    expect(page.history.pushState).toBe(wrappedPush);
    expect(page.history.replaceState).toBe(wrappedReplace);
    expect(page[LOCATION_HOOK_MARKER]).toBe(true);

    expect(page.history.pushState({}, "", "/next")).toBe("pushed");
    expect(page.history.replaceState({}, "", "/replaced")).toBe("replaced");
    expect(events).toEqual([LOCATION_CHANGE_EVENT, LOCATION_CHANGE_EVENT]);
  });

  test("wrapping the real page history leaves History.prototype.pushState alone", () => {
    const nativePush = History.prototype.pushState;
    const nativeReplace = History.prototype.replaceState;
    const events = [];
    const onEvent = () => events.push(LOCATION_CHANGE_EVENT);
    window.addEventListener(LOCATION_CHANGE_EVENT, onEvent);
    try {
      expect(installLocationHook(window)).toBe(true);
      expect(window.history.pushState).not.toBe(nativePush);
      expect(History.prototype.pushState).toBe(nativePush);
      const wrapped = window.history.pushState;
      expect(installLocationHook(window)).toBe(false);
      expect(window.history.pushState).toBe(wrapped);

      window.history.pushState({}, "", "/hooked");
      expect(window.location.pathname).toBe("/hooked");
      expect(events).toEqual([LOCATION_CHANGE_EVENT]);
    } finally {
      window.removeEventListener(LOCATION_CHANGE_EVENT, onEvent);
      window.history.pushState = nativePush;
      window.history.replaceState = nativeReplace;
      delete window[LOCATION_HOOK_MARKER];
    }
  });
});

test("location hook injection targets the sender frame in the main world", () => {
  expect(locationHookInjection({ tab: { id: 3 }, frameId: 0 })).toMatchObject({
    target: { tabId: 3, frameIds: [0] },
    world: "MAIN",
    func: installLocationHook,
  });
  expect(locationHookInjection({ tab: { id: 3 } })).toMatchObject({
    target: { tabId: 3, allFrames: true },
    world: "MAIN",
  });
  expect(locationHookInjection({})).toBeNull();
});

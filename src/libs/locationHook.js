export const LOCATION_CHANGE_EVENT = "immertranslate:locationchange";

const LOCATION_HOOK_MARKER = "__immertranslateLocationHook";

/**
 * 包住页面自己的 history。必须能被 scripting.executeScript 原样序列化进 MAIN world，
 * 所以事件名和标记都写在函数体内，不引用外层变量。
 * 传入 target 时包那一页（用户脚本的 unsafeWindow）；否则在当前 window 上包。
 */
export function installLocationHook(target) {
  const eventName = "immertranslate:locationchange";
  const marker = "__immertranslateLocationHook";
  const win =
    target || (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
  if (!win || win[marker]) return false;
  const history = win.history;
  if (!history) return false;

  const wrap = (method) => {
    const original = history[method];
    if (typeof original !== "function") return false;
    const wrapped = function immertranslateLocationHook(...args) {
      const result = original.apply(this, args);
      win.dispatchEvent(new win.Event(eventName));
      return result;
    };
    history[method] = wrapped;
    return history[method] === wrapped;
  };

  const pushWrapped = wrap("pushState");
  const replaceWrapped = wrap("replaceState");
  if (!pushWrapped && !replaceWrapped) return false;
  try {
    Object.defineProperty(win, marker, { value: true, configurable: true });
  } catch {
    win[marker] = true;
  }
  return true;
}

/** 后台按发送方所在框架注入，写法与 injectToCurrentTab 的 world:"MAIN" 相同。 */
export function locationHookInjection(sender) {
  const tabId = sender?.tab?.id;
  if (!Number.isInteger(tabId)) return null;
  const target = Number.isInteger(sender?.frameId)
    ? { tabId, frameIds: [sender.frameId] }
    : { tabId, allFrames: true };
  return {
    target,
    func: installLocationHook,
    world: "MAIN",
  };
}

export { LOCATION_HOOK_MARKER };

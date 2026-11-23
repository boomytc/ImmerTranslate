export const LOCATION_CHANGE_EVENT = "immertranslate:locationchange";

const LOCATION_HOOK_MARKER = "__immertranslateLocationHook";

/**
 * 包住页面自己的 history。必须能被 scripting.executeScript 原样序列化进 MAIN world，
 * 所以事件名和标记都写在函数体内，不引用外层变量。
 * 传入 target 时包那一页；否则包当前 window。
 */
export function installLocationHook(target) {
  const eventName = "immertranslate:locationchange";
  const marker = "__immertranslateLocationHook";
  const win = target || window;
  if (!win) return false;
  let history;
  try {
    history = win.history;
  } catch {
    return false;
  }
  if (!history) return false;

  const readHref = () => {
    try {
      return String(win.location?.href || "");
    } catch {
      return "";
    }
  };

  const wrap = (method) => {
    let original;
    try {
      original = history[method];
    } catch {
      return false;
    }
    if (typeof original !== "function" || original[marker]) return false;

    const wrapped = function immertranslateLocationHook(...args) {
      const prevHref = readHref();
      const result = original.apply(this, args);
      try {
        const nextHref = readHref();
        if (nextHref !== prevHref) {
          win.dispatchEvent(new win.Event(eventName));
        }
      } catch {
        // 派发自定义事件失败时不能影响宿主页面自身的 history 调用
      }
      return result;
    };

    try {
      Object.defineProperty(wrapped, marker, {
        value: true,
        configurable: true,
      });
    } catch {
      try {
        wrapped[marker] = true;
      } catch {
        // 忽略无法挂载标记的受限函数对象
      }
    }

    try {
      history[method] = wrapped;
      return history[method] === wrapped;
    } catch {
      return false;
    }
  };

  const pushWrapped = wrap("pushState");
  const replaceWrapped = wrap("replaceState");
  if (!pushWrapped && !replaceWrapped) return false;
  try {
    Object.defineProperty(win, marker, { value: true, configurable: true });
  } catch {
    try {
      win[marker] = true;
    } catch {
      // 忽略只读 window 属性
    }
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

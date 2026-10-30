import { MSG_TRANS_TOGGLE } from "../config";

/**
 * 判定当前脚本是否运行在 Iframe 嵌套子页面中。
 */
export const isIframe = window.self !== window.top;

/**
 * 从当前页面向所有页面内的 iframe 子元素广播 HTML5 postMessage 消息。
 * REVIEW: 安全警告！
 * postMessage 的 targetOrigin 参数使用了通配符星号 "*"，这意味着如果子 iframe
 * 重定向至非受信任的第三方域，发送的数据可能会被泄露。建议在有安全合规要求的场景中，
 * 将 "*" 替换为具体的受信任域名。
 * @param {string} action 指令动作名称
 * @param {Object} args 指令参数
 */
export const sendIframeMsg = (action, args) => {
  document.querySelectorAll("iframe").forEach((iframe) => {
    iframe.contentWindow.postMessage({ action, args }, "*");
  });
};

export const MSG_FRAME_RUNTIME_QUERY = "frame_runtime_query";
export const MSG_FRAME_RUNTIME_STATE = "frame_runtime_state";

export function frameRuntimeState(state) {
  const pagePatch = Object.fromEntries(
    [
      "apiSlug",
      "fromLang",
      "toLang",
      "textStyle",
      "originalTextStyle",
      "wrapOriginal",
      "transOnly",
      "transOnlyRevert",
      "transOnlyRevertDelay",
      "transOrder",
    ]
      .filter((key) => typeof state?.pagePatch?.[key] === "string")
      .map((key) => [key, state.pagePatch[key]])
  );
  return {
    transOpen: state?.transOpen === true || state?.transOpen === "true",
    fabVisible: Boolean(state?.fabVisible),
    ...(Object.keys(pagePatch).length ? { pagePatch } : {}),
  };
}

/** 把存储里的规则改成顶层此刻的运行态。没有父页面回复时保持原规则。 */
export function applyParentRuntime(rule, state) {
  if (!rule || !state) return rule;
  const runtime = frameRuntimeState(state);
  return {
    ...rule,
    ...runtime.pagePatch,
    transOpen: runtime.transOpen ? "true" : "false",
  };
}

export function replyFrameRuntime(event, state) {
  if (event?.data?.action !== MSG_FRAME_RUNTIME_QUERY) return false;
  const requestId = event.data.requestId;
  event.source?.postMessage(
    {
      action: MSG_FRAME_RUNTIME_STATE,
      requestId,
      ...frameRuntimeState(state),
    },
    "*"
  );
  return true;
}

export function installFrameRuntimeBridge(getState) {
  const handler = (event) => {
    replyFrameRuntime(event, getState?.());
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export function queryParentFrameRuntime(timeout = 300, frameWindow = window) {
  let topWindow = null;
  try {
    topWindow = frameWindow.top;
  } catch {
    topWindow = frameWindow.parent;
  }
  if (!topWindow || topWindow === frameWindow) return Promise.resolve(null);

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const finish = (value) => {
      frameWindow.clearTimeout(timer);
      frameWindow.removeEventListener("message", onMessage);
      resolve(value);
    };
    const onMessage = (event) => {
      const data = event.data;
      if (
        data?.action === MSG_TRANS_TOGGLE &&
        typeof data.args?.enabled === "boolean" &&
        (event.source === topWindow || event.source === frameWindow.parent)
      ) {
        finish(
          frameRuntimeState({
            transOpen: data.args.enabled,
            pagePatch: data.args.pagePatch,
          })
        );
        return;
      }
      if (!data || data.action !== MSG_FRAME_RUNTIME_STATE) return;
      if (event.source !== topWindow || data.requestId !== requestId) return;
      finish(frameRuntimeState(data));
    };
    const timer = frameWindow.setTimeout(() => finish(null), timeout);
    frameWindow.addEventListener("message", onMessage);
    topWindow.postMessage({ action: MSG_FRAME_RUNTIME_QUERY, requestId }, "*");
  });
}

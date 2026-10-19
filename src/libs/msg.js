import { browser } from "./browser";
import { MSG_TRANS_TOGGLE } from "../config/msg";

export const MSG_NO_RECEIVER = "NO_RECEIVER";

function missingPageReceiver(err) {
  const message = err?.message || "";
  return (
    message.includes("Could not establish connection") ||
    message.includes("Receiving end does not exist")
  );
}

const sendMessage = (tabId, message, options) => {
  const sendPromise = options
    ? browser.tabs.sendMessage(tabId, message, options)
    : browser.tabs.sendMessage(tabId, message);
  return sendPromise.catch((err) => {
    if (missingPageReceiver(err)) {
      return { error: err.message, code: MSG_NO_RECEIVER };
    }
    throw err;
  });
};

/**
 * 获取当前用户正在浏览且聚焦的活跃标签页 (Tab) 信息。
 * @returns {Promise<Object|undefined>} 活跃的标签页对象
 */
export const getCurTab = async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab;
};

/**
 * 获取当前活跃标签页的 ID。
 * @returns {Promise<number|undefined>} 标签页 ID
 */
export const getCurTabId = async () => {
  const tab = await getCurTab();
  return tab?.id;
};

/**
 * 向扩展后台 Service Worker (Background) 发送单向或双向消息。
 * REVIEW: 该方法依赖 `browser?.runtime` API，只能在浏览器扩展环境（Content Script, Popup, Options 等）下工作。
 * 在油猴 Userscript 环境中不可使用（油猴需使用特定 GM 接口或 CustomEvent 传递信息）。
 * @param {string} action 指令动作名称
 * @param {Object} args 指令参数数据
 * @returns {Promise<*>} 后台响应的数据
 */
export const sendBgMsg = (action, args) =>
  browser?.runtime.sendMessage({ action, args });

/**
 * Send a message to a specific tab, or the active tab when no target is supplied.
 * @param {string} action Message action.
 * @param {Object} args Message arguments.
 * @param {Object} options Browser message options, such as frameId.
 * @param {number} targetTabId The tab whose state initiated this operation.
 * @param {string} expectedDocumentToken Restrict execution to this document.
 * @param {string} responseDocumentToken Authorize a broadcast with this document.
 * @returns {Promise<*>} Content-script response.
 */
export const sendTabMsg = async (
  action,
  args,
  options,
  targetTabId,
  expectedDocumentToken,
  responseDocumentToken
) => {
  const tabId = targetTabId ?? (await getCurTabId());
  if (tabId == null) return;

  const message = { action, args };
  if (expectedDocumentToken)
    message.expectedDocumentToken = expectedDocumentToken;
  if (responseDocumentToken)
    message.responseDocumentToken = responseDocumentToken;
  // frameId 0 只应落到顶层。消息体里再带一标记，避免子 frame 抢先回复。
  if (options?.frameId === 0) message.targetTopFrame = true;
  if (!responseDocumentToken || options || expectedDocumentToken) {
    return sendMessage(tabId, message, options);
  }

  // Only the selected document can authorize the operation. Other frames must
  // verify that document again when they receive the subsequent broadcast.
  const response = await sendMessage(tabId, message);
  if (
    response?.error ||
    response?.document?.token !== responseDocumentToken ||
    !Number.isInteger(response?.document?.frameId)
  ) {
    return response;
  }
  await sendMessage(tabId, {
    action,
    args,
    sourceDocument: response.document,
  }).catch(() => undefined);
  // Optional recipients can disappear or leave no response channel. The
  // selected document's completed operation remains the authoritative result.
  return response;
};

/**
 * Send a query or frame-local command to a tab's top frame.
 * Commands intended for every frame should continue to use sendTabMsg.
 *
 * @param {string} action Message action.
 * @param {Object} args Message arguments.
 * @param {number} targetTabId Explicit target, or the active tab when omitted.
 * @returns {Promise<*>} Top-frame response.
 */
export const sendTopFrameMsg = (
  action,
  args,
  targetTabId,
  expectedDocumentToken
) =>
  sendTabMsg(action, args, { frameId: 0 }, targetTabId, expectedDocumentToken);

/** 顶层查询带 targetTopFrame。子 frame 看到后必须不回复、不执行。 */
export function acceptsFrameMessage(message, { isIframe = false } = {}) {
  if (message?.targetTopFrame === true && isIframe) return false;
  return true;
}

/**
 * 快捷键和右键菜单不知道各 frame 当前是否已开启翻译。
 * 先问顶层拿到目标值，再把同一个 enabled 发给其余 frame。
 */
export async function broadcastTranslateToggle(targetTabId) {
  const top = await sendTopFrameMsg(MSG_TRANS_TOGGLE, undefined, targetTabId);
  const transOpen = top?.rule?.transOpen;
  if (transOpen !== "true" && transOpen !== "false") return top;
  await sendTabMsg(
    MSG_TRANS_TOGGLE,
    { enabled: transOpen === "true" },
    undefined,
    targetTabId
  );
  return top;
}

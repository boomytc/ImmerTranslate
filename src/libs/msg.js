import { browser } from "./browser";
import {
  MSG_TRANS_TOGGLE,
  MSG_TRANS_TOGGLE_ONLY,
  MSG_TRANS_TOGGLE_STYLE,
  MSG_TRANS_PUTRULE,
} from "../config/msg";
import { PAGE_SWITCH } from "./pageSwitch";

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
 * 该方法依赖 `browser.runtime`，在扩展的 Content Script、Popup 和 Options 页面里使用。
 * @param {string} action 指令动作名称
 * @param {Object} args 指令参数数据
 * @returns {Promise<*>} 后台响应的数据
 */
export const sendBgMsg = (action, args) =>
  browser?.runtime.sendMessage({ action, args });

// Receivers apply the source's result, never their own relative toggle.
export function getResolvedPageCommand(action, args, response) {
  if (response?.error) return null;
  if (action === MSG_TRANS_TOGGLE || action === MSG_TRANS_TOGGLE_ONLY) {
    const pageSwitch = response?.pageSwitch;
    if (pageSwitch !== PAGE_SWITCH.ON && pageSwitch !== PAGE_SWITCH.OFF) {
      return null;
    }
    const enabled = pageSwitch === PAGE_SWITCH.ON;
    if (action === MSG_TRANS_TOGGLE) return { action, args: { enabled } };

    const transOnly = response?.rule?.transOnly;
    if (transOnly !== "true" && transOnly !== "false") return null;
    return { action, args: { transOnly, enabled } };
  }
  if (action === MSG_TRANS_TOGGLE_STYLE) {
    const textStyle = response?.rule?.textStyle;
    if (typeof textStyle !== "string") return null;
    return { action: MSG_TRANS_PUTRULE, args: { textStyle } };
  }
  return { action, args };
}

function hasValidDocument(document) {
  return (
    typeof document?.token === "string" &&
    document.token !== "" &&
    Number.isInteger(document.frameId) &&
    document.frameId >= 0
  );
}

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
    response?.document?.token !== responseDocumentToken ||
    !hasValidDocument(response?.document)
  ) {
    return response;
  }
  const command = getResolvedPageCommand(action, args, response);
  if (!command) return response;
  await sendMessage(tabId, {
    ...command,
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

// Keep the second delivery on the originating tab and exclude its document.
export async function broadcastPageCommand(action, targetTabId) {
  const tabId = targetTabId ?? (await getCurTabId());
  if (tabId == null) return;

  const response = await sendTopFrameMsg(action, undefined, tabId);
  if (!hasValidDocument(response?.document)) return response;
  const command = getResolvedPageCommand(action, undefined, response);
  if (!command) return response;
  await sendMessage(tabId, {
    ...command,
    sourceDocument: response.document,
  }).catch(() => undefined);
  return response;
}

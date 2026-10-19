/**
 * @file client.js
 * @description 根据编译时的环境变量 (REACT_APP_CLIENT) 自动判定当前的运行客户端环境类型，对外暴露布尔判定变量。
 */

import { CLIENT_EXTS, CLIENT_CHROME, CLIENT_FIREFOX } from "../config";

export const client = process.env.REACT_APP_CLIENT; // 获取当前的客户端标识
export const isExt = CLIENT_EXTS.includes(client); // 是否为浏览器扩展环境
export const isFirefox = client === CLIENT_FIREFOX; // 是否在 Firefox 浏览器扩展环境中运行
// Edge 产物直接复用 Chrome 构建，因此编译时同样以 CLIENT_CHROME 标识。
export const isAutoTranslateClipboardSupported =
  client === CLIENT_CHROME || client === CLIENT_FIREFOX;

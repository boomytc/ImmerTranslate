/**
 * @file client.js
 * @description 客户端类型常量。产品构建只有 Chrome 与 Edge 扩展。
 */

export const CLIENT_CHROME = "chrome"; // Chrome 扩展程序
export const CLIENT_EDGE = "edge"; // Edge 扩展程序
export const CLIENT_FIREFOX = "firefox"; // Firefox 运行时判断仍保留，当前不再单独构建

// 浏览器扩展类客户端的集合
export const CLIENT_EXTS = [CLIENT_CHROME, CLIENT_EDGE, CLIENT_FIREFOX];

// 默认 User-Agent，在某些 API 请求（如 DeepLFree 或部分防爬虫的机器翻译 API）时作为 Headers 模拟浏览器发送
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

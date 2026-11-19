/**
 * @file storage.js
 * @description 存储相关的常量配置模块。定义保存在本地（如 chrome.storage.local）和云端同步（如 WebDAV）中的键名。
 */

import { APP_NAME } from "./app";

// 云端同步文件名。更新日期不进入键名，改日期不会换一套配置。
export const KV_RULES_KEY = "kiss-rules.json";
export const KV_SETTING_KEY = "kiss-setting.json";

// 浏览器本地存储键名。
export const STOKEY_SETTING = `${APP_NAME}_setting`;
export const STOKEY_RULES = `${APP_NAME}_rules`;
export const STOKEY_SYNC = `${APP_NAME}_sync`; // 同步接口及凭证配置缓存键名
export const STOKEY_FAB = `${APP_NAME}_fab`; // 网页翻译悬浮球最近一次位置等配置缓存键名
export const STOKEY_TRANBOX = `${APP_NAME}_tranbox`; // 划词翻译框的最后状态缓存键名
export const STOKEY_RULE_EDITOR_POSITION = `${APP_NAME}_rule_editor_position`;
export const STOKEY_RULE_INSPECTOR_POSITION = `${APP_NAME}_rule_inspector_position`;
export const STOKEY_SEPARATE_WINDOW = `${APP_NAME}_separate_window`; // 划词翻译独立小窗口的最后边界尺寸(坐标及宽高)缓存键名
// --- 翻译 HTTP 请求的缓存配置 ---
export const CACHE_NAME = `${APP_NAME}_cache`; // 翻译接口响应缓存的 CacheStorage 名称
export const DEFAULT_CACHE_TIMEOUT = 3600 * 24 * 7; // 默认翻译请求缓存有效期 (单位：秒，即 7 天)

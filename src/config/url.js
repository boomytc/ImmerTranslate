/**
 * @file url.js
 * @description 应用链接与接口 URL 常量定义模块。定义本地 CacheStorage 所需的伪 HTTP URL 作为拦截 Key，以及 GitHub 仓库相关的外部文档链接。
 */

import { APP_LCNAME } from "./app";

// --- 缓存拦截用的虚拟伪 URL，用于本地 Cache 系统的键名区分 ---
export const URL_CACHE_TRAN = `https://${APP_LCNAME}/translate`; // 网页正文翻译结果缓存 Key
export const URL_CACHE_SUBTITLE = `https://${APP_LCNAME}/subtitle`; // 字幕翻译结果缓存 Key
export const URL_CACHE_DELANG = `https://${APP_LCNAME}/detectlang`; // 语言判定结果缓存 Key
export const URL_CACHE_BINGDICT = `https://${APP_LCNAME}/bingdict`; // 必应词典查询结果缓存 Key
export const URL_CACHE_DICT = `https://${APP_LCNAME}/dict`; // AI 词典结果缓存 Key
export const URL_CACHE_CONTEXT = `https://${APP_LCNAME}/context`; // 智能上下文分析结果缓存 Key

// --- 外部相关的开源仓库及文档地址 ---
export const URL_KISS_WORKER = "https://github.com/boomytc/ImmerTranslate"; // 自建同步服务说明
export const URL_GITHUB_GIST_TOKEN =
  "https://github.com/settings/personal-access-tokens"; // GitHub Fine-grained Token 设置页
export const URL_KISS_PROXY = "https://github.com/boomytc/ImmerTranslate"; // 翻译接口代理说明
export const URL_KISS_RULES = "https://github.com/boomytc/ImmerTranslate"; // 网页翻译规则说明
export const URL_KISS_RULES_NEW_ISSUE =
  "https://github.com/boomytc/ImmerTranslate/issues/new"; // 反馈网页翻译规则问题
export const URL_RAW_PREFIX =
  "https://raw.githubusercontent.com/boomytc/ImmerTranslate/main"; // 访问本仓库原始文件的 URL 前缀 (用于拉取 README 等)

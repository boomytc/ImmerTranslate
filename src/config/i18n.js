import { TOUCH_I18N } from "./i18n.touch";
/**
 * @file i18n.js
 * @description 国际化本地化字典文件，包含支持的界面语言和多语言文案对照。
 */

import { SETTINGS_I18N } from "./locales/settings";
import { RULE_EDITOR_I18N } from "./i18n.ruleEditor";
export const UI_LANGS = [
  ["en", "English"],
  ["zh", "简体中文"],
];
const requestHookHelperZH = `1、第一个参数包含如下字段：'texts', 'from', 'to', 'url', 'key', 'model', 'systemPrompt', ...
2、返回值必须是包含以下字段的对象： 'url', 'body', 'headers', 'method'
3、如返回空值，则hook函数不会产生任何效果。

// 示例
async (args, { url, body, headers, userMsg, method } = {}) => {
  return { url, body, headers, userMsg, method };
}`;
const requestHookHelperEN = `1. The first parameter contains the following fields: 'texts', 'from', 'to', 'url', 'key', 'model', 'systemPrompt', ...
2. The return value must be an object containing the following fields: 'url', 'body', 'headers', 'method'
3. If a null value is returned, the hook function will have no effect.

// Example
async (args, { url, body, headers, userMsg, method } = {}) => {
  return { url, body, headers, userMsg, method };
}`;
const responsetHookHelperZH = `1、第一个参数包含如下字段：'res', ...
2、返回值必须是包含以下字段的对象： 'translations'
  （'translations' 应为一个二维数组：[[译文, 原文语言]]）
3、如返回空值，则hook函数不会产生任何效果。

// 示例
async ({ res, ...args }) => {
  const translations = [["你好", "en"]];
  const modelMsg = {}; // 用于AI上下文
  return { translations, modelMsg };
}`;
const responsetHookHelperEN = `1. The first parameter contains the following fields: 'res', ...
2. The return value must be an object containing the following fields: 'translations'
  ('translations' should be a two-dimensional array: [[translation, source language]]).
3. If a null value is returned, the hook function will have no effect.

// Example
async ({ res, ...args }) => {
  const translations = [["你好", "en"]];
  const modelMsg = {}; // For AI context
  return { translations, modelMsg };
}`;
export const I18N = {
  ...TOUCH_I18N,
  ...SETTINGS_I18N,
  ...RULE_EDITOR_I18N,
  app_name: {
    zh: `ImmerTranslate`,
    en: `ImmerTranslate`,
  },
  general: {
    zh: `通用`,
    en: `General`,
  },
  translate: {
    zh: `翻译`,
    en: `Translate`,
  },
  dictionary: {
    zh: `词典`,
    en: `Dictionary`,
  },
  request_hook_helper: {
    zh: requestHookHelperZH,
    en: requestHookHelperEN,
  },
  response_hook_helper: {
    zh: responsetHookHelperZH,
    en: responsetHookHelperEN,
  },
  translate_alt: {
    zh: `网页翻译`,
    en: `Translate`,
  },
  rules_setting: {
    zh: `规则设置`,
    en: `Rules Setting`,
  },
  apis_setting: {
    zh: `接口设置`,
    en: `Apis Setting`,
  },
  prompt_management: {
    zh: `提示词管理`,
    en: `Prompt Management`,
  },
  about: {
    zh: `关于`,
    en: `About`,
  },
  about_md: {
    zh: `README.md`,
    en: `README.en.md`,
  },
  about_md_local: {
    zh: `请 [点击这里](${process.env.REACT_APP_HOMEPAGE}) 查看详情。`,
    en: `Please [click here](${process.env.REACT_APP_HOMEPAGE}) for details.`,
  },
  ui_lang: {
    zh: `界面语言`,
    en: `Interface Language`,
  },
  popup_default_view: {
    zh: `工具栏弹窗默认界面`,
    en: `Toolbar Popup Default View`,
  },
  popup_default_view_page: {
    zh: `网页翻译`,
    en: `Web page translation`,
  },
  popup_default_view_text: {
    zh: `文本翻译`,
    en: `Text translation`,
  },
  fetch_limit: {
    zh: `最大并发请求数量 (1-100)`,
    en: `Maximum Number Of Concurrent Requests (1-100)`,
  },
  thinking_mode: {
    zh: `思考模式`,
    en: `Thinking Mode`,
  },
  thinking_mode_default: {
    zh: `接口默认`,
    en: `API Default`,
  },
  thinking_mode_enabled: {
    zh: `开启思考`,
    en: `Enable Thinking`,
  },
  thinking_mode_disabled: {
    zh: `关闭思考`,
    en: `Disable Thinking`,
  },
  thinking_mode_helper: {
    zh: `目前各家接口混乱，如果出现异常，请使用接口默认选项`,
    en: `The thinking parameters vary across APIs. If you encounter errors, please use the "API Default" option.`,
  },
  thinking_unknown_model_helper: {
    zh: `无法识别当前模型支持的思考参数，本次请求不会发送思考设置。`,
    en: `The current model's thinking parameters are unknown, so no thinking settings will be sent.`,
  },
  gemini_thinking_minimum_helper: {
    zh: `当前模型不支持完全关闭思考，将自动使用最低思考级别。`,
    en: `This model cannot disable thinking completely and will use its lowest supported level.`,
  },
  thinking_effort: {
    zh: `思考强度`,
    en: `Thinking Effort`,
  },
  thinking_effort_default: {
    zh: `接口默认`,
    en: `API Default`,
  },
  fetch_interval: {
    zh: `每次请求间隔时间 (0-5000ms)`,
    en: `Time Between Requests (0-5000ms)`,
  },
  translate_interval: {
    zh: `翻译间隔时间 (1-2000ms)`,
    en: `Translation Interval (1-2000ms)`,
  },
  http_timeout: {
    zh: `请求超时时间 (1-600s)`,
    en: `Request Timeout Time (1-600s)`,
  },
  custom_header: {
    zh: `自定义Header参数`,
    en: `Custom Header Params`,
  },
  custom_header_help: {
    zh: `使用JSON格式，例如 "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0"`,
    en: `Use JSON format, for example "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0"`,
  },
  custom_body: {
    zh: `自定义Body参数`,
    en: `Custom Body Params`,
  },
  custom_body_help: {
    zh: `使用JSON格式，例如 "top_p": 0.7`,
    en: `Use JSON format, for example "top_p": 0.7`,
  },
  gemini_interactions_custom_body_help: {
    zh: `使用 Interactions API 顶层 JSON 字段；Request Hook 收到的也是 Interactions 请求结构。`,
    en: `Use top-level Interactions API JSON fields. Request Hook also receives the Interactions request shape.`,
  },
  custom_url_help: {
    zh: `只提交 {text, from, to}，不发送模型和对话。OpenAI 兼容请改选 OpenAI 类型；Anthropic Messages 请改选 Claude 类型并填写地址。`,
    en: `Posts {text, from, to} only. It does not send a model or chat messages. For OpenAI-compatible services, use the OpenAI type. For Anthropic Messages, use the Claude type and set its URL.`,
  },
  gemini_url_help: {
    zh: `Google AI Studio 官方原生接口规范（支持 Interactions 协议与 generateContent）`,
    en: `Official Google AI Studio native API (supports Interactions protocol and generateContent)`,
  },
  gemini_2_url_help: {
    zh: `Google AI Studio 的 OpenAI 兼容接口（/v1beta/openai/chat/completions），适用于中转或代理`,
    en: `Google AI Studio OpenAI-compatible API (/v1beta/openai/chat/completions), suitable for proxies/relays`,
  },
  min_translate_length: {
    zh: `最小翻译字符数 (1-100)`,
    en: `Minimum number Of Translated Characters (1-100)`,
  },
  max_translate_length: {
    zh: `最大翻译字符数 (100-100000)`,
    en: `Maximum number Of Translated Characters (100-100000)`,
  },
  num_of_newline_characters: {
    zh: `换行字符数 (1-1000)`,
    en: `Number of Newline Characters (1-1000)`,
  },
  translate_service: {
    zh: `翻译服务`,
    en: `Translate Service`,
  },
  translate_service_multiple: {
    zh: `翻译服务 (支持多选)`,
    en: `Translation service (multiple supported)`,
  },
  single_word_no_trans: {
    zh: `单个单词划词不调用翻译服务`,
    en: `Do not use translation services for single word`,
  },
  auto_fav_word: {
    zh: `自动收藏词汇`,
    en: `Automatically favorite words`,
  },
  mk_pagescroll: {
    zh: `滚动加载翻译（推荐）`,
    en: `Rolling Loading (Suggested)`,
  },
  mk_pageopen: {
    zh: `立即全部翻译`,
    en: `Translate all now`,
  },
  from_lang: {
    zh: `原文语言`,
    en: `Source Language`,
  },
  to_lang: {
    zh: `目标语言`,
    en: `Target Language`,
  },
  to_lang2: {
    zh: `第二目标语言`,
    en: `Target Language 2`,
  },
  to_lang2_helper: {
    zh: `设定后，与目标语言产生互译效果，但依赖远程语言识别。`,
    en: `After setting, it will produce mutual translation effect with the target language, but it relies on remote language recognition.`,
  },
  text_style: {
    zh: `译文样式`,
    en: `Text Style`,
  },
  original_text_style: {
    zh: `原文样式`,
    en: `Original Text Style`,
  },
  text_style_alt: {
    zh: `译文样式`,
    en: `Text Style`,
  },
  save: {
    zh: `保存`,
    en: `Save`,
  },
  edit: {
    zh: `编辑`,
    en: `Edit`,
  },
  cancel: {
    zh: `取消`,
    en: `Cancel`,
  },
  delete: {
    zh: `删除`,
    en: `Delete`,
  },
  add: {
    zh: `添加`,
    en: `Add`,
  },
  bulk_actions: {
    zh: `批量操作`,
    en: `Bulk Actions`,
  },
  select_all: {
    zh: `全选`,
    en: `Select All`,
  },
  deselect_all: {
    zh: `全不选`,
    en: `Deselect All`,
  },
  pin_to_top: {
    zh: `置顶`,
    en: `Pin to Top`,
  },
  delete_selected_apis_confirm: {
    zh: `确定删除已选的 {count} 个接口吗？`,
    en: `Delete {count} selected interfaces?`,
  },
  copy_api: {
    zh: `复制接口`,
    en: `Copy Interface`,
  },
  prompt_name: {
    zh: `名称`,
    en: `Name`,
  },
  system_prompt: {
    zh: `系统提示词`,
    en: `System Prompt`,
  },
  user_prompt: {
    zh: `用户提示词`,
    en: `User Prompt`,
  },
  copy_as_template: {
    zh: `复制为模板`,
    en: `Copy as Template`,
  },
  delete_prompt_confirm: {
    zh: `确定删除这份提示词吗？`,
    en: `Delete this prompt?`,
  },
  custom_prompt: {
    zh: `自定义提示词`,
    en: `Custom Prompt`,
  },
  add_prompt: {
    zh: `新增提示词`,
    en: `Add Prompt`,
  },
  prompt_category_batch_system: {
    zh: `聚合系统提示词`,
    en: `Batch System Prompt`,
  },
  prompt_category_user: {
    zh: `用户提示词`,
    en: `User Prompt`,
  },
  prompt_category_subtitle: {
    zh: `字幕提示词`,
    en: `Subtitle Prompt`,
  },
  prompt_category_dictionary: {
    zh: `词典提示词`,
    en: `Dictionary Prompt`,
  },
  translation_prompt: {
    zh: `翻译提示词`,
    en: `Translation Prompt`,
  },
  subtitle_prompt: {
    zh: `AI断句提示词`,
    en: `AI Segmentation Prompt`,
  },
  seg_prompt_mode: {
    zh: `AI断句提示词`,
    en: `AI Segmentation Prompt`,
  },
  follow_api_prompt: {
    zh: `接口默认`,
    en: `Interface Default`,
  },
  preset_prompt_nobatch_translation_concise: {
    zh: `单句翻译 (Concise)`,
    en: `Single-sentence translation (Concise)`,
  },
  preset_prompt_nobatch_translation: {
    zh: `单句翻译 (Legacy)`,
    en: `Single-sentence translation (Legacy)`,
  },
  preset_prompt_batch_translation_json: {
    zh: `聚合翻译（JSON）`,
    en: `Batch Translation (JSON)`,
  },
  preset_prompt_batch_translation_xml: {
    zh: `聚合翻译（XML）`,
    en: `Batch Translation (XML)`,
  },
  preset_prompt_batch_translation_line: {
    zh: `聚合翻译（LINE）`,
    en: `Batch Translation (LINE)`,
  },
  preset_prompt_subtitle_segmentation: {
    zh: `字幕 AI 断句`,
    en: `Subtitle AI Segmentation`,
  },
  preset_prompt_dictionary_en_zh: {
    zh: `AI 英汉词典`,
    en: `AI English-Chinese Dictionary`,
  },
  preset_prompt_dictionary_en_ja: {
    zh: `AI 英日词典`,
    en: `AI English-Japanese Dictionary`,
  },
  preset_prompt_dictionary_en_ko: {
    zh: `AI 英韩词典`,
    en: `AI English-Korean Dictionary`,
  },
  preset_prompt_dictionary_en_vi: {
    zh: `AI 英越词典`,
    en: `AI English-Vietnamese Dictionary`,
  },
  preset_prompt_dictionary_en_ru: {
    zh: `AI 英俄词典`,
    en: `AI English-Russian Dictionary`,
  },
  inject_rules: {
    zh: `注入订阅规则`,
    en: `Inject Subscribe Rules`,
  },
  personal_rules: {
    zh: `个人规则`,
    en: `Rules`,
  },
  subscribe_rules: {
    zh: `订阅规则`,
    en: `Subscribe`,
  },
  overwrite_subscribe_rules: {
    zh: `覆写订阅规则`,
    en: `Overwrite`,
  },
  subscribe_url: {
    zh: `订阅地址`,
    en: `Subscribe URL`,
  },
  rules_warn_1: {
    zh: `1、规则生效的优先级依次为：个人规则 > 订阅规则 > 全局规则。"全局规则"相当于兜底规则。`,
    en: `1. The priority of rules is: personal rules > subscription rules > global rules. "Global rules" are like a fallback rule.`,
  },
  rules_warn_2: {
    zh: `2、“订阅规则”选择注入后才会生效。`,
    en: `2. "Subscription rules" will take effect only after injection is selected.`,
  },
  rules_warn_3: {
    zh: `3、关于规则填写：输入框留空或下拉框选“*”表示采用全局规则。CSS选择器支持 + 号前缀表示在全局规则基础上追加，- 号表示剔除。`,
    en: `3. Regarding filling in the rules: Leave the input box blank or select "*" in the drop-down box to use global rule. CSS selectors support prefixes: "+" means add to the global rules, "-" means exclude.`,
  },
  sync_warn: {
    zh: `1、涉及隐私数据的同步请谨慎选择第三方同步服务，建议自行搭建 Cloudflare Worker 或 WebDAV 服务。`,
    en: `1. When synchronizing data that involves privacy, please be cautious about choosing third-party sync services. It is recommended to set up your own Cloudflare Worker or WebDAV service.`,
  },
  sync_warn_gist: {
    zh: `3、GitHub Gist 不会出现在公开搜索或发现页面中，但任何拥有该链接的人都可以查看内容。`,
    en: `3. GitHub Gists do not appear in public searches or discovery pages, but anyone with the link can view the content.`,
  },
  sync_warn_2: {
    zh: `2、如果服务器存在其他客户端同步的数据，第一次同步将直接覆盖本地配置，后面则根据修改时间，新的覆盖旧的。`,
    en: `2. If the server has data synchronized by other clients, the first synchronization will directly overwrite the local configuration, and later, according to the modification time, the new one will overwrite the old one.`,
  },
  sync_warn_encryption: {
    zh: `同步加密口令独立用于数据解密，请妥善保存，遗失后无法读取已加密的云端数据。`,
    en: `The sync encryption passphrase is used independently for data decryption, so keep it safe; encrypted cloud data cannot be read if it is lost.`,
  },
  about_sync_api: {
    zh: `自建数据同步服务`,
    en: `Self-host a data sync service`,
  },
  about_api: {
    zh: `1、其中 BuiltinAI 为浏览器内置AI翻译，目前仅 Chrome 138 及以上版本得到支持。`,
    en: `1. BuiltinAI is the browser's built-in AI translation, which is currently only supported by Chrome 138 and above.`,
  },
  about_api_2: {
    zh: `2、大部分AI接口都与OpenAI兼容，因此选择OpenAI类型即可。`,
    en: `2. Most AI interfaces are compatible with OpenAI, so you can simply select the OpenAI type.`,
  },
  about_api_3: {
    zh: `3、对于一些小模型（如 Hy-MT2-1.8B），建议优先选用 单句翻译 (Concise) 或 聚合翻译（LINE）。`,
    en: `3. For smaller models (e.g. Hy-MT2-1.8B), it is recommended to prioritize Single-sentence Translation (Concise) or Batch Translation (LINE).`,
  },
  about_api_4: {
    zh: `4、自定义接口只提交 {text, from, to}，不发送模型和对话。OpenAI 兼容服务选 OpenAI 类型；Anthropic Messages 选 Claude 类型并修改地址。其他协议再用 Custom 的 Hook。`,
    en: `4. Custom posts {text, from, to} and does not send a model or chat messages. Use the OpenAI type for OpenAI-compatible services, and the Claude type with your own URL for Anthropic Messages. Use Custom hooks for other protocols.`,
  },
  style_none: {
    zh: `无`,
    en: `None`,
  },
  under_line: {
    zh: `下划直线`,
    en: `Underline`,
  },
  dot_line: {
    zh: `下划点状线`,
    en: `Dotted Underline`,
  },
  dash_line: {
    zh: `下划虚线`,
    en: `Dashed Underline`,
  },
  dash_box: {
    zh: `虚线框`,
    en: `Dashed Box`,
  },
  dash_line_bold: {
    zh: `下划虚线加粗`,
    en: `Dashed Underline Bold`,
  },
  dash_box_bold: {
    zh: `虚线框加粗`,
    en: `Dashed Box Bold`,
  },
  marker: {
    zh: `马克笔`,
    en: `Marker`,
  },
  gradient_marker: {
    zh: `渐变马克笔`,
    en: `Gradient Marker`,
  },
  wavy_line: {
    zh: `下划波浪线`,
    en: `Wavy Underline`,
  },
  wavy_line_bold: {
    zh: `下划波浪线加粗`,
    en: `Wavy Underline Bold`,
  },
  fuzzy: {
    zh: `模糊`,
    en: `Fuzzy`,
  },
  highlight: {
    zh: `高亮`,
    en: `Highlight`,
  },
  blockquote: {
    zh: `引用`,
    en: `Blockquote`,
  },
  gradient: {
    zh: `渐变`,
    en: `Gradient`,
  },
  blink: {
    zh: `闪现`,
    en: `Blink`,
  },
  glow: {
    zh: `发光`,
    en: `Glow`,
  },
  colorful: {
    zh: `多彩`,
    en: `Colorful`,
  },
  setting: {
    zh: `设置`,
    en: `Setting`,
  },
  pattern: {
    zh: `匹配网址`,
    en: `URL pattern`,
  },
  pattern_helper: {
    zh: `1、支持星号(*)通配符。2、多个URL用换行或英文逗号“,”分隔。3、hostname:example.com 仅匹配该主机，不包含子域名；此格式单独使用。`,
    en: `1. Supports the asterisk (*) wildcard character. 2. Separate multiple URLs with newlines or English commas ",". 3. hostname:example.com matches only that host, without subdomains; use this format alone.`,
  },
  selector_helper: {
    zh: `1、需要翻译的目标元素。2、开启自动扫描页面后，本设置无效。3、遵循CSS选择器语法。`,
    en: `1. The target element to be translated. 2. This setting is invalid when automatic page scanning is enabled. 3. Follow the CSS selector syntax.`,
  },
  translate_switch: {
    zh: `切换网页翻译`,
    en: `Translate Switch`,
  },
  default_enabled: {
    zh: `默认开启`,
    en: `Enabled`,
  },
  default_disabled: {
    zh: `默认关闭`,
    en: `Disabled`,
  },
  selector: {
    zh: `选择器`,
    en: `Selector`,
  },
  target_selector: {
    zh: `需翻译节点选择器`,
    en: `Target element selector`,
  },
  keep_selector: {
    zh: `保留元素选择器`,
    en: `Keep unchanged selector`,
  },
  keep_selector_helper: {
    zh: `1、目标元素下面需要原样保留的子节点。2、遵循CSS选择器语法。`,
    en: `1. The child nodes under the target element need to remain intact. 2. Follow the CSS selector syntax.`,
  },
  block_selector: {
    zh: `块级元素选择器`,
    en: `Block element selector`,
  },
  block_selector_helper: {
    zh: `1、匹配到的元素会被当作块级节点处理。2、遵循CSS选择器语法。`,
    en: `1. Matched elements will be treated as block nodes. 2. Follow the CSS selector syntax.`,
  },
  root_selector: {
    zh: `根节点选择器`,
    en: `Root node selector`,
  },
  root_selector_helper: {
    zh: `1、用于缩小页面翻译范围。2、遵循CSS选择器语法。`,
    en: `1. Used to narrow the translation scope of the page. 2. Follow the CSS selector syntax.`,
  },
  ignore_selector: {
    zh: `不翻译节点选择器`,
    en: `Ignore node selectors`,
  },
  ignore_selector_helper: {
    zh: `1、需要忽略的节点。2、遵循CSS选择器语法。`,
    en: `1. Nodes to be ignored. 2. Follow CSS selector syntax.`,
  },
  terms: {
    zh: `专业术语`,
    en: `Terms`,
  },
  terms_helper: {
    zh: `1、支持正则表达式匹配，无需斜杆，不支持修饰符。2、多条术语用换行或分号“;”隔开。3、术语和译文用英文逗号“,”隔开。4、没有译文视为不翻译术语。`,
    en: `1. Supports regular expression matching, no slash required, and no modifiers are supported. 2. Separate multiple terms with newlines or semicolons ";". 3. Terms and translations are separated by English commas ",". 4. If there is no translation, the term will be deemed not to be translated.`,
  },
  ai_terms: {
    zh: `AI专业术语`,
    en: `AI Terms`,
  },
  ai_terms_helper: {
    zh: `1、AI智能替换，不支持正则表达式。2、多条术语用换行或分号“;”隔开。3、术语和译文用英文逗号“,”隔开。4、没有译文视为不翻译术语。`,
    en: `1. AI intelligent replacement does not support regular expressions.2. Separate multiple terms with newlines or semicolons ";". 3. Terms and translations are separated by English commas ",". 4. If there is no translation, the term will be deemed not to be translated.`,
  },
  text_ext_style: {
    zh: `译文附加样式`,
    en: `Translation additional styles`,
  },
  selector_style: {
    zh: `选择器节点样式`,
    en: `Selector Style`,
  },
  terms_style: {
    zh: `专业术语样式`,
    en: `Terms Style`,
  },
  highlight_style: {
    zh: `词汇高亮样式`,
    en: `Fav Words highlight style`,
  },
  selector_parent_style: {
    zh: `选择器父节点样式`,
    en: `Parent Selector Style`,
  },
  selector_grand_style: {
    zh: `选择器祖节点样式`,
    en: `Grand Selector Style`,
  },
  inject_css: {
    zh: `注入CSS`,
    en: `Inject CSS`,
  },
  inject_css_helper: {
    zh: `预加载时注入，一个页面仅运行一次。`,
    en: `Injected during preload, runs only once per page.`,
  },
  import: {
    zh: `导入`,
    en: `Import`,
  },
  export: {
    zh: `导出`,
    en: `Export`,
  },
  export_translation: {
    zh: `导出释义`,
    en: `Export Translation`,
  },
  error_cant_be_blank: {
    zh: `不能为空`,
    en: `Can not be blank`,
  },
  error_duplicate_values: {
    zh: `存在重复的值`,
    en: `There are duplicate values`,
  },
  error_wrong_file_type: {
    zh: `错误的文件类型`,
    en: `Wrong file type`,
  },
  error_fetch_url: {
    zh: `请检查url地址是否正确或稍后再试。`,
    en: `Please check if the url address is correct or try again later.`,
  },
  if_clear_cache: {
    zh: `是否清除缓存（默认缓存7天）`,
    en: `Whether clear cache (Default cache is 7 days)`,
  },
  clear_cache_never: {
    zh: `不清除缓存`,
    en: `Never clear cache`,
  },
  clear_cache_restart: {
    zh: `重启浏览器时清除缓存`,
    en: `Clear cache when restarting browser`,
  },
  data_sync_type: {
    zh: `同步方式`,
    en: `Sync Type`,
  },
  data_sync_url: {
    zh: `同步接口`,
    en: `Sync API`,
  },
  gist_sync_tip: {
    zh: `选择 GitHub Gist 时会自动创建私密 Gist。GitHub PAT 需要 Gists 读写权限。`,
    en: `A secret gist will be created automatically when GitHub Gist is selected. GitHub PAT needs Gists read and write permission.`,
  },
  data_sync_user: {
    zh: `同步账户`,
    en: `Sync Account`,
  },
  data_sync_key: {
    zh: `同步密钥`,
    en: `Sync Key`,
  },
  data_sync_encrypt_key: {
    zh: `加密口令`,
    en: `Encryption Passphrase`,
  },
  set_sync_encrypt_key: {
    zh: `设定口令`,
    en: `Set Passphrase`,
  },
  change_sync_encrypt_key: {
    zh: `修改口令`,
    en: `Change Passphrase`,
  },
  sync_encrypt_key_not_set: {
    zh: `口令未设置，同步功能不可用。`,
    en: `Passphrase is not set. Sync is unavailable.`,
  },
  old_sync_encrypt_key: {
    zh: `旧口令`,
    en: `Old Passphrase`,
  },
  new_sync_encrypt_key: {
    zh: `新口令`,
    en: `New Passphrase`,
  },
  confirm_sync_encrypt_key: {
    zh: `确认口令`,
    en: `Confirm Passphrase`,
  },
  sync_encrypt_key_too_short: {
    zh: `口令长度至少 6 位。`,
    en: `Passphrase must be at least 6 characters.`,
  },
  sync_encrypt_key_mismatch: {
    zh: `两次输入的口令不一致。`,
    en: `The two passphrases do not match.`,
  },
  old_sync_encrypt_key_invalid: {
    zh: `旧口令不正确。`,
    en: `Old passphrase is incorrect.`,
  },
  clear_sync_encrypt_key: {
    zh: `清除本地口令`,
    en: `Clear local passphrase`,
  },
  clear_sync_encrypt_key_title: {
    zh: `清除本地同步口令？`,
    en: `Clear local sync passphrase?`,
  },
  clear_sync_encrypt_key_message: {
    zh: `这不会修改云端数据。之后必须重新填入能解密云端数据的口令，才能继续同步。`,
    en: `This does not change cloud data. You must enter the passphrase that decrypts it before syncing again.`,
  },
  clear_sync_encrypt_key_confirm: {
    zh: `确认清除`,
    en: `Clear passphrase`,
  },
  clear_sync_encrypt_key_success: {
    zh: `已清除本地同步口令。`,
    en: `The local sync passphrase has been cleared.`,
  },
  sync_encrypt_key_change_failed: {
    zh: `修改口令失败。请保留旧口令和新口令，检查网络后重试；如果曾有部分数据已用新口令写入云端，必要时请清空远端同步文件后重新同步。`,
    en: `Failed to change the passphrase. Keep both the old and new passphrases, check your network, and retry. If some cloud data was already written with the new passphrase, clear the remote sync files and sync again if needed.`,
  },
  sync_now: {
    zh: `立即同步`,
    en: `Sync Now`,
  },
  sync_success: {
    zh: `同步成功！`,
    en: `Sync Success`,
  },
  sync_failed: {
    zh: `同步失败！`,
    en: `Sync Error`,
  },
  error_got_some_wrong: {
    zh: `抱歉，出错了！`,
    en: `Sorry, something went wrong!`,
  },
  error_sync_setting: {
    zh: `同步类型必须为自建 Worker，且地址与密钥需填写完整`,
    en: `The sync type must be the self-hosted Worker, and the address and key must be filled in`,
  },
  click_test: {
    zh: `点击测试`,
    en: `Click Test`,
  },
  test_success: {
    zh: `测试成功`,
    en: `Test success`,
  },
  test_failed: {
    zh: `测试失败`,
    en: `Test failed`,
  },
  test_connection: {
    zh: `测试连接`,
    en: `Test connection`,
  },
  test_connection_ok: {
    zh: `已连通`,
    en: `Connected`,
  },
  test_connection_ok_empty: {
    zh: `已连通，模型列表为空`,
    en: `Connected. The model list is empty.`,
  },
  test_connection_missing: {
    zh: `请先填写密钥和接口地址。配置后请刷新页面再译`,
    en: `Enter an API key and endpoint first. After you finish the setup, refresh the page and translate again.`,
  },
  test_connection_invalid_key: {
    zh: `密钥无效。请核对密钥，必要时检查接口地址`,
    en: `The API key is invalid. Check the key, and the endpoint if needed.`,
  },
  test_connection_http: {
    zh: `连接失败，请检查接口地址或稍后重试`,
    en: `Connection failed. Check the endpoint or try again later`,
  },
  test_connection_network: {
    zh: `网络错误，请稍后重试，或检查网络与接口地址`,
    en: `Network error. Try again later, or check your network and the endpoint.`,
  },
  test_connection_unparseable: {
    zh: `服务已响应，但模型列表无法解析`,
    en: `The service responded, but the model list could not be parsed.`,
  },
  builtin_ai_unsupported_hint: {
    zh: `当前浏览器环境不支持内置 AI，需 Chrome 138+ 并在 chrome://flags 中开启 Translation API`,
    en: `Current browser environment does not support Built-in AI. Requires Chrome 138+ with Translation API enabled in chrome://flags`,
  },
  builtin_ai_ready: {
    zh: `原生就绪`,
    en: `Native Ready`,
  },
  builtin_ai_status_readily: {
    zh: `模型已就绪`,
    en: `Model is readily available`,
  },
  builtin_ai_status_after_download: {
    zh: `支持但本地模型正在下载`,
    en: `Supported, but local model is downloading`,
  },
  builtin_ai_status_unavailable: {
    zh: `内置 AI 当前不可用`,
    en: `Built-in AI is currently unavailable`,
  },
  page_translate_failed: {
    zh: `页面翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口`,
    en: `Page translation failed. Check your network, switch translation service, or open settings and check the endpoint.`,
  },
  page_translate_service_unavailable: {
    zh: `当前翻译服务不可用或已停用。请换一个翻译服务，或打开设置检查接口`,
    en: `This translation service is unavailable or turned off. Switch translation service, or open settings and check the endpoint.`,
  },
  hover_translate_failed: {
    zh: `悬停翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口`,
    en: `Hover translation failed. Check your network, switch translation service, or open settings and check the endpoint.`,
  },
  selection_translate_failed: {
    zh: `划词翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口`,
    en: `Selection translation failed. Check your network, switch translation service, or open settings and check the endpoint.`,
  },
  input_translate_failed: {
    zh: `输入框翻译失败。请检查网络，或换一个翻译服务，也可以打开设置核对接口`,
    en: `Input box translation failed. Check your network, switch translation service, or open settings and check the endpoint.`,
  },
  fab_translation_mode: {
    zh: `译文显示`,
    en: `Translation display`,
  },
  fab_bilingual: {
    zh: `双语对照`,
    en: `Bilingual`,
  },
  fab_model: {
    zh: `模型`,
    en: `Model`,
  },
  missing_api_key_status: {
    zh: `未配置密钥，尚未翻译`,
    en: `No API key yet, so nothing is translated`,
  },
  missing_api_key_empty: {
    zh: `当前翻译服务需要密钥，页面还没有译出。填写密钥后请刷新页面再翻译。`,
    en: `This translation service needs an API key, so the page has not been translated. Add a key, then refresh the page and translate again.`,
  },
  missing_api_key_action: {
    zh: `打开接口设置`,
    en: `Open API settings`,
  },
  fab_no_keyed_provider: {
    zh: `没有可用的翻译服务。请到接口设置启用服务，或填写密钥。`,
    en: `No translation service is available. Enable one in API settings, or add an API key.`,
  },
  site_trans_open: {
    zh: `当前站`,
    en: `This site`,
  },
  site_trans_follow: {
    zh: `跟随全局`,
    en: `Follow global`,
  },
  site_trans_on: {
    zh: `自动翻译`,
    en: `Auto-translate`,
  },
  site_trans_off: {
    zh: `不自动翻译`,
    en: `Don't auto-translate`,
  },
  clear_all_cache_now: {
    zh: `立即清除全部缓存`,
    en: `Clear all cache now`,
  },
  clear_cache: {
    zh: `清除缓存`,
    en: `Clear Cache`,
  },
  disable_on_mobile: {
    zh: `移动端禁用`,
    en: `Disable on Mobile`,
  },
  clear_success: {
    zh: `清除成功`,
    en: `Clear success`,
  },
  clear_failed: {
    zh: `清除失败`,
    en: `Clear failed`,
  },
  share: {
    zh: `分享`,
    en: `Share`,
  },
  clear_all: {
    zh: `清空`,
    en: `Clear All`,
  },
  help: {
    zh: `求助`,
    en: `Help`,
  },
  restore_default: {
    zh: `恢复默认`,
    en: `Restore Default`,
  },
  toggle_translate_shortcut: {
    zh: `"切换网页翻译"快捷键`,
    en: `"Toggle Translate" Shortcut`,
  },
  toggle_transonly_shortcut: {
    zh: `"切换仅显示译文"快捷键`,
    en: `"Hide Original" Shortcut`,
  },
  toggle_style_shortcut: {
    zh: `"切换样式"快捷键`,
    en: `"Toggle Style" Shortcut`,
  },
  toggle_popup_shortcut: {
    zh: `"打开弹窗"快捷键`,
    en: `"Open Popup" Shortcut`,
  },
  open_setting_shortcut: {
    zh: `"打开设置"快捷键`,
    en: `"Open Setting" Shortcut`,
  },
  firefox_shortcut_edit_hint: {
    zh: `Firefox 不支持直接打开扩展快捷键管理页。请在地址栏输入 about:addons，然后点击齿轮菜单中的“管理扩展快捷键”。`,
    en: `Firefox cannot open the extension shortcut manager directly. Enter about:addons in the address bar, then select Manage Extension Shortcuts from the gear menu.`,
  },
  hide_fab_button: {
    zh: `隐藏悬浮按钮`,
    en: `Hide Fab Button`,
  },
  fab_control: {
    zh: `悬浮球`,
    en: `Floating Button`,
  },
  fab_global_switch: {
    zh: `全局悬浮球`,
    en: `Global Floating Button`,
  },
  hide_fab_on_site: {
    zh: `在此网站隐藏`,
    en: `Hide on this site`,
  },
  show_fab_on_site: {
    zh: `在此网站显示`,
    en: `Show on this site`,
  },
  fab_shown_on_site_toast: {
    zh: `已在此网站显示悬浮球`,
    en: `Floating button visible on this site`,
  },
  fab_hidden_on_site_toast: {
    zh: `已在此网站隐藏悬浮球`,
    en: `Floating button hidden on this site`,
  },
  fab_undo: {
    zh: `撤销`,
    en: `Undo`,
  },
  site_trans_policy: {
    zh: `站点翻译策略`,
    en: `Site Translation Policy`,
  },
  fab_hidden_sites: {
    zh: `全局显示时隐藏的网站`,
    en: `Sites hidden while the button is shown globally`,
  },
  fab_shown_sites: {
    zh: `全局隐藏时显示的网站`,
    en: `Sites shown while the button is hidden globally`,
  },
  fab_exception_list_helper: {
    zh: `「隐藏网站」在全局显示时隐藏悬浮球；「显示网站」在全局隐藏时显示悬浮球。不带斜杠和协议的条目按主机名匹配，*.example.com 含该域名及子域名；带路径或协议的条目仍支持星号(*)。多个网址用换行或逗号分隔。`,
    en: `Hidden sites hide the button while it is shown globally. Shown sites keep it visible while it is hidden globally. Entries without a slash or protocol match the hostname; *.example.com includes that domain and its subdomains. Entries with a path or protocol still support *. Separate URLs with newlines or commas.`,
  },
  selection_translate_site_blocked: {
    zh: `此站已禁用`,
    en: `Disabled on this site`,
  },
  fab_click_action: {
    zh: `单击悬浮按钮动作`,
    en: `Single Click Fab Action`,
  },
  fab_click_menu: {
    zh: `弹出菜单`,
    en: `Popup Menu`,
  },
  fab_click_translate: {
    zh: `直接翻译`,
    en: `Translate`,
  },
  hide_tran_button: {
    zh: `隐藏翻译按钮`,
    en: `Hide Translate Button`,
  },
  hide_click_away: {
    zh: `点击外部关闭弹窗`,
    en: `Click outside to close the pop-up window`,
  },
  use_simple_style: {
    zh: `使用简洁界面`,
    en: `Use a simple interface`,
  },
  show: {
    zh: `显示`,
    en: `Show`,
  },
  hide: {
    zh: `隐藏`,
    en: `Hide`,
  },
  save_rule: {
    zh: `保存本站规则`,
    en: `Save this site rule`,
  },
  domain: {
    zh: `网域`,
    en: `Domain`,
  },
  global_rule: {
    zh: `全局规则`,
    en: `Global Rule`,
  },
  input_translate: {
    zh: `输入框翻译`,
    en: `Input Box Translation`,
  },
  use_input_box_translation: {
    zh: `启用输入框翻译`,
    en: `Input Box Translation`,
  },
  trigger_trans_shortcut: {
    zh: `触发翻译快捷键`,
    en: `Trigger Translation Shortcut Keys`,
  },
  trigger_trans_shortcut_help: {
    zh: `默认为单击“AltLeft+KeyI”`,
    en: `Default is "AltLeft+KeyI"`,
  },
  shortcut_press_count: {
    zh: `快捷键连击次数`,
    en: `Shortcut Press Number`,
  },
  combo_timeout: {
    zh: `连击超时时间 (10-1000ms)`,
    en: `Combo Timeout (10-1000ms)`,
  },
  input_trans_start_sign: {
    zh: `翻译起始标识`,
    en: `Translation Start Sign`,
  },
  input_trans_start_sign_help: {
    zh: `标识后面可以加目标语言代码，如： “/en 你好”、“/zh hello”`,
    en: `The target language code can be added after the sign, such as: "/en 你好", "/zh hello"`,
  },
  disable: {
    zh: `禁用`,
    en: `Disable`,
  },
  enable: {
    zh: `启用`,
    en: `Enable`,
  },
  selection_translate: {
    zh: `划词翻译`,
    en: `Selection Translation`,
  },
  tranbtn_label: {
    zh: `翻译选中文字`,
    en: `Translate selection`,
  },
  trigger_tranbox_shortcut: {
    zh: `显示翻译框/翻译选中文字快捷键`,
    en: `Open Translate Popup/Translate Selected Shortcut`,
  },
  tranbtn_offset_x: {
    zh: `翻译按钮偏移X（±200）`,
    en: `Translate Button Offset X (±200)`,
  },
  tranbtn_offset_y: {
    zh: `翻译按钮偏移Y（±200）`,
    en: `Translate Button Offset Y (±200)`,
  },
  tranbox_offset_x: {
    zh: `翻译框偏移X（±200）`,
    en: `Translate Box Offset X (±200)`,
  },
  tranbox_offset_y: {
    zh: `翻译框偏移Y（±200）`,
    en: `Translate Box Offset Y (±200)`,
  },
  translated_text: {
    zh: `译文`,
    en: `Translated Text`,
  },
  original_text: {
    zh: `原文`,
    en: `Original Text`,
  },
  favorite_words: {
    zh: `收藏词汇`,
    en: `Favorite Words`,
  },
  touch_translate_shortcut: {
    zh: `触屏翻译快捷方式 (支持多选)`,
    en: `Touch Translate Shortcut (multiple supported)`,
  },
  touch_tap_0: {
    zh: `禁用`,
    en: `Disable`,
  },
  touch_tap_2: {
    zh: `双指轻触`,
    en: `Two finger tap`,
  },
  touch_tap_3: {
    zh: `三指轻触`,
    en: `Three finger tap`,
  },
  touch_tap_4: {
    zh: `四指轻触`,
    en: `Four finger tap`,
  },
  touch_tap_5: {
    zh: `单指双击`,
    en: `Double-click`,
  },
  touch_tap_6: {
    zh: `单指三击`,
    en: `Triple-click`,
  },
  touch_tap_7: {
    zh: `双指双击`,
    en: `Two-finger double-click`,
  },
  translate_blacklist: {
    zh: `禁用翻译名单`,
    en: `Translate Blacklist`,
  },
  blacklist: {
    zh: `禁用黑名单`,
    en: `Blacklist`,
  },
  add_to_blacklist: {
    zh: `加入黑名单`,
    en: `Add to Blacklist`,
  },
  remove_from_blacklist: {
    zh: `移出黑名单`,
    en: `Remove from Blacklist`,
  },
  disabled_orilist: {
    zh: `禁用Origin名单`,
    en: `Disabled Origin List`,
  },
  disabled_csplist: {
    zh: `禁用CSP名单`,
    en: `Disabled CSP List`,
  },
  disabled_csplist_helper: {
    zh: `3、通过调整CSP策略，使得某些页面能够注入JS/CSS/Media，请谨慎使用，除非您已知晓相关风险。`,
    en: `3. By adjusting the CSP policy, some pages can inject JS/CSS/Media. Please use it with caution unless you are aware of the related risks.`,
  },
  skip_langs: {
    zh: `不翻译的语言`,
    en: `Disable Languages`,
  },
  skip_langs_helper: {
    zh: `此功能依赖准确的语言检测，建议启用远程语言检测。`,
    en: `This feature relies on accurate language detection. It is recommended to enable remote language detection.`,
  },
  translate_variants: {
    zh: `变体互译`,
    en: `Translate Language Variants`,
  },
  translate_variants_helper: {
    zh: `开启后，简体中文与繁体中文等语言变体会继续翻译；关闭后将其视为同一语言并跳过。`,
    en: `When enabled, variants such as Simplified and Traditional Chinese are translated between each other. When disabled, they are treated as the same language and skipped.`,
  },
  parse_latex: {
    zh: `LaTeX 公式转换`,
    en: `Parse LaTeX Math`,
  },
  parse_latex_helper: {
    zh: `将译文中的行内 LaTeX 公式转换为可读的 Unicode 文本（如 \\dot{x}_1 → ẋ₁）。作用于字幕、划词翻译、输入翻译与悬停气泡。`,
    en: `Convert inline LaTeX in translated text to readable Unicode (e.g. \\dot{x}_1 → ẋ₁). Applies to subtitles, selection popup, input translate and hover bubble.`,
  },
  context_menus: {
    zh: `右键菜单`,
    en: `Context Menus`,
  },
  hide_context_menus: {
    zh: `隐藏右键菜单`,
    en: `Hide Context Menus`,
  },
  simple_context_menus: {
    zh: `简单右键菜单`,
    en: `Simple_context_menus Context Menus`,
  },
  secondary_context_menus: {
    zh: `二级右键菜单`,
    en: `Secondary Context Menus`,
  },
  mulkeys_help: {
    zh: `支持用换行或英文逗号“,”分隔，轮询调用。`,
    en: `Supports polling calls separated by newlines or English commas ",".`,
  },
  translation_element_tag: {
    zh: `译文元素标签`,
    en: `Translation Element Tag`,
  },
  show_only_translations: {
    zh: `仅显示译文`,
    en: `Show Only Translations`,
  },
  trans_order: {
    zh: `文本顺序`,
    en: `Translation Order`,
  },
  wrap_original: {
    zh: `包裹原文`,
    en: `Wrap Original Text`,
  },
  original_first: {
    zh: `原文在上方`,
    en: `Original First`,
  },
  translation_first: {
    zh: `译文在上方`,
    en: `Translation First`,
  },
  transonly_revert: {
    zh: `悬浮显示原文`,
    en: `Hover to Show Original`,
  },
  transonly_revert_delay: {
    zh: `悬浮延迟(秒)`,
    en: `Hover Delay (seconds)`,
  },
  translate_page_title: {
    zh: `是否翻译页面标题`,
    en: `Translate Page Title`,
  },
  more: {
    zh: `更多`,
    en: `More`,
  },
  popup_advanced_options: {
    zh: `高级选项`,
    en: `Advanced options`,
  },
  popup_all_settings: {
    zh: `全部设置`,
    en: `All settings`,
  },
  popup_all_styles: {
    zh: `全部样式`,
    en: `All styles`,
  },
  popup_collapse: {
    zh: `收起`,
    en: `Collapse`,
  },
  popup_disabled: {
    zh: `已关闭`,
    en: `Disabled`,
  },
  popup_domain_allowed: {
    zh: `未屏蔽`,
    en: `Not blocked`,
  },
  popup_domain_blocked: {
    zh: `已屏蔽`,
    en: `Blocked`,
  },
  popup_enabled: {
    zh: `已开启`,
    en: `Enabled`,
  },
  popup_page_translation: {
    zh: `本页翻译`,
    en: `Page translation`,
  },
  popup_loading: {
    zh: `正在加载…`,
    en: `Loading…`,
  },
  popup_page_unavailable: {
    zh: `当前页面暂时无法使用网页翻译，可能是浏览器特殊页面、扩展页面，或扩展没有访问此页面的权限。你仍可使用文本翻译。`,
    en: `Page translation is currently unavailable. This may be a special browser page, an extension page, or a page the extension does not have permission to access. You can still use text translation.`,
  },
  popup_action_failed: {
    zh: `当前页面未能应用更改，请重试。`,
    en: `The page could not apply this change. Please try again.`,
  },
  popup_unavailable: {
    zh: `当前页面不可用`,
    en: `Unavailable on this page`,
  },
  popup_more_services: {
    zh: `更多翻译服务`,
    en: `More translation services`,
  },
  popup_support: {
    zh: `支持`,
    en: `Support`,
  },
  popup_text_translation: {
    zh: `文本翻译`,
    en: `Text translation`,
  },
  popup_open_separate_window: {
    zh: `打开独立窗`,
    en: `Open separate window`,
  },
  popup_translating: {
    zh: `正在翻译…`,
    en: `Translating…`,
  },
  read_aloud: {
    zh: `朗读`,
    en: `Read aloud`,
  },
  swap_languages: {
    zh: `互换语言`,
    en: `Swap languages`,
  },
  popup_translate_page: {
    zh: `翻译此页`,
    en: `Translate this page`,
  },
  options_overview: {
    zh: `概览`,
    en: `Overview`,
  },
  options_appearance: {
    zh: `外观与样式`,
    en: `Appearance & styles`,
  },
  options_web_translation: {
    zh: `网页翻译`,
    en: `Web translation`,
  },
  options_translation_services: {
    zh: `翻译服务`,
    en: `Translation services`,
  },
  options_data_sync: {
    zh: `数据同步`,
    en: `Data sync`,
  },
  options_group_general: {
    zh: `通用`,
    en: `General`,
  },
  options_group_scenarios: {
    zh: `翻译场景`,
    en: `Translation scenarios`,
  },
  options_group_services: {
    zh: `服务与接口`,
    en: `Services & APIs`,
  },
  options_group_data: {
    zh: `数据`,
    en: `Data`,
  },
  options_search: {
    zh: `在设置中搜索`,
    en: `Search settings`,
  },
  options_open_navigation: {
    zh: `打开设置导航`,
    en: `Open settings navigation`,
  },
  options_close_navigation: {
    zh: `关闭设置导航`,
    en: `Close settings navigation`,
  },
  options_overview_description: {
    zh: `全局默认行为与通用设置`,
    en: `Global defaults and general settings`,
  },
  options_appearance_description: {
    zh: `界面主题与译文视觉呈现`,
    en: `Interface theme and translation presentation`,
  },
  options_web_description: {
    zh: `网页扫描、译文呈现与站点规则`,
    en: `Page scanning, presentation, and site rules`,
  },
  options_services_description: {
    zh: `管理翻译接口与 AI 模型`,
    en: `Manage translation APIs and AI models`,
  },
  options_sync_description: {
    zh: `跨设备同步配置、规则与生词本`,
    en: `Sync settings, rules, and vocabulary across devices`,
  },
  options_words_description: {
    zh: `生词本与学习记录`,
    en: `Vocabulary and learning history`,
  },
  favorite_words_empty: {
    zh: `还没有收藏词汇`,
    en: `No saved words yet`,
  },
  favorite_words_empty_hint: {
    zh: `在划词翻译或字幕查词时点击收藏，词汇会出现在这里。`,
    en: `Save a word from selection translation or subtitle lookup to see it here.`,
  },
  options_selection_description: {
    zh: `控制划词后的翻译面板、词典与触发方式`,
    en: `Configure the selection panel, dictionaries, and triggers`,
  },
  options_input_description: {
    zh: `控制输入框翻译的语言、快捷键与提交方式`,
    en: `Configure input translation languages, shortcuts, and submission`,
  },
  options_subtitle_description: {
    zh: `配置双语字幕、断句、显示顺序与学习功能`,
    en: `Configure bilingual captions, segmentation, order, and learning tools`,
  },
  options_prompts_description: {
    zh: `管理 AI 翻译、断句与词典提示词`,
    en: `Manage prompts for AI translation, segmentation, and dictionaries`,
  },
  settings_interface_theme: {
    zh: `界面主题`,
    en: `Interface theme`,
  },
  settings_appearance_mode: {
    zh: `外观模式`,
    en: `Appearance mode`,
  },
  settings_appearance_mode_transition: {
    zh: `外观模式：当前 {0}，下一项 {1}`,
    en: `Appearance mode: current {0}; next {1}`,
  },
  settings_theme_light: {
    zh: `浅色`,
    en: `Light`,
  },
  settings_theme_dark: {
    zh: `深色`,
    en: `Dark`,
  },
  settings_theme_system: {
    zh: `跟随系统`,
    en: `System`,
  },
  settings_translation_styles: {
    zh: `译文样式`,
    en: `Translation styles`,
  },
  settings_custom_css: {
    zh: `自定义 CSS`,
    en: `Custom CSS`,
  },
  settings_custom_css_description: {
    zh: `为译文编写附加样式规则`,
    en: `Create additional presentation rules for translated text`,
  },
  settings_style_library: {
    zh: `样式库`,
    en: `Style library`,
  },
  settings_style_library_description: {
    zh: `{0} 个自定义样式 · {1} 个内置样式`,
    en: `{0} custom styles · {1} built-in styles`,
  },
  settings_detailed_controls: {
    zh: `详细设置`,
    en: `Detailed settings`,
  },
  settings_trigger_group: {
    zh: `触发`,
    en: `Trigger`,
  },
  settings_follow_selection_description: {
    zh: `结果浮窗贴近选中文本`,
    en: `Keep the result panel close to the selected text`,
  },
  settings_selection_shortcut_description: {
    zh: `打开翻译框或翻译选中文字`,
    en: `Open the panel or translate the selected text`,
  },
  settings_single_word_dictionary_description: {
    zh: `划选单词时优先展示词典`,
    en: `Open the dictionary first for a selected word`,
  },
  settings_ai_dictionary_description: {
    zh: `用大模型生成释义与例句`,
    en: `Generate definitions and examples with an AI model`,
  },
  settings_auto_favorite_description: {
    zh: `查询过的单词自动加入生词本`,
    en: `Automatically save looked-up words`,
  },
  settings_subtitle_auto_start: {
    zh: `自动开始`,
    en: `Start automatically`,
  },
  settings_subtitle_auto_start_description: {
    zh: `解析到字幕后立即翻译`,
    en: `Start translating as soon as captions are available`,
  },
  settings_quality_group: {
    zh: `质量`,
    en: `Quality`,
  },
  settings_learning_group: {
    zh: `学习`,
    en: `Learning`,
  },
  settings_skip_ad_description: {
    zh: `检测到广告时自动快进或点击跳过按钮`,
    en: `Automatically fast-forward ads or click the skip button`,
  },
  settings_blur_translation_description: {
    zh: `悬停显示译文，适合听力练习`,
    en: `Reveal the translation on hover for listening practice`,
  },
  settings_appearance_group: {
    zh: `外观`,
    en: `Appearance`,
  },
  settings_simple_style_description: {
    zh: `使用无边框轻量浮窗`,
    en: `Use a lightweight borderless panel`,
  },
  settings_about_description: {
    zh: `一个简约、开源的双语对照翻译扩展。`,
    en: `A minimalist, open-source bilingual translation extension.`,
  },
  settings_about_license: {
    zh: `基于 GPLv3 协议开放源代码。`,
    en: `Open source under the GPLv3 license.`,
  },
  settings_project_website: {
    zh: `项目网站`,
    en: `Website`,
  },
  settings_project_details: {
    zh: `项目详情与使用说明`,
    en: `Project details and usage guide`,
  },
  options_no_results: {
    zh: `没有匹配的设置`,
    en: `No matching settings`,
  },
  options_shortcuts: {
    zh: `快捷键`,
    en: `Shortcuts`,
  },
  less: {
    zh: `更少`,
    en: `Less`,
  },
  trigger_mode: {
    zh: `触发方式`,
    en: `Trigger Mode`,
  },
  trigger_click: {
    zh: `点击触发`,
    en: `Click Trigger`,
  },
  trigger_hover: {
    zh: `鼠标悬停触发`,
    en: `Hover Trigger`,
  },
  trigger_select: {
    zh: `选中触发`,
    en: `Select Trigger`,
  },
  trigger_dblclick: {
    zh: `双击触发`,
    en: `Double-click Trigger`,
  },
  tranbtn_position_mode: {
    zh: `弹出按钮位置`,
    en: `Popup Button Position`,
  },
  tranbtn_position_fixed: {
    zh: `固定位置`,
    en: `Fixed Position`,
  },
  tranbtn_position_mouse: {
    zh: `跟随鼠标`,
    en: `Follow Mouse`,
  },
  custom_option: {
    zh: `自定义选项`,
    en: `Custom Option`,
  },
  translate_selected_text: {
    zh: `翻译选中文字`,
    en: `Translate Selected Text`,
  },
  toggle_style: {
    zh: `切换样式`,
    en: `Toggle Style`,
  },
  open_menu: {
    zh: `打开弹窗菜单`,
    en: `Open Popup Menu`,
  },
  open_setting: {
    zh: `打开设置`,
    en: `Open Setting`,
  },
  follow_selection: {
    zh: `翻译框跟随选中文本`,
    en: `Transbox Follow Selection`,
  },
  tranbox_auto_height: {
    zh: `翻译框自适应高度`,
    en: `Translation box adaptive height`,
  },
  tranbox_interact_mode: {
    zh: `翻译框内交互模式`,
    en: `Transbox Interact Mode`,
  },
  tranbox_interact_click: {
    zh: `单击选中文本触发翻译`,
    en: `Click selected text to translate`,
  },
  tranbox_interact_dblclick: {
    zh: `双击选中文本触发翻译`,
    en: `Double-click selected text to translate`,
  },
  selection_skip_langs: {
    zh: `忽略的语言`,
    en: `Ignore Languages`,
  },
  selection_skip_langs_helper: {
    zh: `列表中的语言不弹窗（设定后，第二目标语言互译功能将自动禁用）`,
    en: `Don't show popup for languages in this list (when enabled, will automatically disable bidirectional translation for the second target language)`,
  },
  english_dict: {
    zh: `英文词典`,
    en: `English Dictionary`,
  },
  default_dict: {
    zh: `默认词典`,
    en: `Default Dictionary`,
  },
  ai_dict: {
    zh: `AI 词典`,
    en: `AI Dictionary`,
  },
  ai_dict_api: {
    zh: `AI 词典接口`,
    en: `AI Dictionary API`,
  },
  ai_dict_prompt: {
    zh: `AI 词典提示词`,
    en: `AI Dictionary Prompt`,
  },
  english_suggest: {
    zh: `英文建议`,
    en: `English Suggest`,
  },
  api_name: {
    zh: `接口名称`,
    en: `API Name`,
  },
  model_list_loading: {
    zh: `正在加载模型列表...`,
    en: `Loading model list...`,
  },
  model_list_fetch_failed: {
    zh: `模型列表加载失败`,
    en: `Failed to load model list`,
  },
  model_list_missing_key: {
    zh: `请先填写 Key。仍可手动填写模型 ID`,
    en: `Enter a key first. You can still type a model ID manually.`,
  },
  fetch_model_list: {
    zh: `拉取模型列表`,
    en: `Fetch model list`,
  },
  byok_key_help: {
    zh: `Key 只保存在本机，不会写入仓库。`,
    en: `The key stays on this device and is never committed.`,
  },
  get_api_key: {
    zh: `获取 API Key`,
    en: `Get API Key`,
  },
  key_configured: {
    zh: `已配置`,
    en: `Configured`,
  },
  key_required: {
    zh: `需要密钥`,
    en: `Key Required`,
  },
  api_key_missing_tip: {
    zh: `此服务需要配置 API Key 才能调用。如尚未获取，可点击右侧链接前往官方控制台申请。`,
    en: `This service requires an API key. If you don't have one yet, click the link to visit the official console.`,
  },
  service_category_ai: {
    zh: `AI 模型`,
    en: `AI Model`,
  },
  service_category_machine: {
    zh: `专业翻译`,
    en: `Dedicated MT`,
  },
  service_category_free_machine: {
    zh: `免费翻译`,
    en: `Free MT`,
  },
  service_category_custom: {
    zh: `自定义`,
    en: `Custom`,
  },
  model_list_empty: {
    zh: `未获取到模型列表，可手动填写`,
    en: `No models found. You can enter one manually.`,
  },
  is_disabled: {
    zh: `是否禁用`,
    en: `Is Disabled`,
  },
  is_pinned: {
    zh: `是否置顶`,
    en: `Is Pinned`,
  },
  sort_alphabetically: {
    zh: `按字母排序`,
    en: `Sort Alphabetically`,
  },
  use_batch_fetch: {
    zh: `是否聚合发送翻译请求`,
    en: `Whether to aggregate and send translation requests`,
  },
  batch_interval: {
    zh: `聚合请求等待时间(10-10000)`,
    en: `Aggregation request waiting time (10-10000)`,
  },
  batch_size: {
    zh: `聚合请求最大段落数(1-100)`,
    en: `Maximum number of paragraphs in an aggregation request (1-100)`,
  },
  batch_length: {
    zh: `聚合请求最大文本长度(1000-100000)`,
    en: `Maximum text length for aggregation requests (1000-100000)`,
  },
  batch_concurrency: {
    zh: `聚合批次并发数(1-100)`,
    en: `Concurrent aggregation batches (1-100)`,
  },
  batch_concurrency_context_hint: {
    zh: `上下文会话要求批次按顺序执行，因此并发数固定为 1`,
    en: `Context sessions require ordered batches, so concurrency is fixed at 1`,
  },
  use_stream: {
    zh: `是否启用流式传输`,
    en: `Whether to enable streaming`,
  },
  stream_render_mode: {
    zh: `流式渲染模式`,
    en: `Stream render mode`,
  },
  stream_render_realtime: {
    zh: `实时渲染`,
    en: `Realtime render`,
  },
  stream_render_segment: {
    zh: `片段渲染`,
    en: `Segment render`,
  },
  use_context: {
    zh: `是否启用智能上下文`,
    en: `Whether to enable AI context`,
  },
  context_size: {
    zh: `上下文会话数量(1-20)`,
    en: `Number of context sessions(1-20)`,
  },
  auto_scan_page: {
    zh: `自动扫描页面`,
    en: `Auto scan page`,
  },
  has_rich_text: {
    zh: `启用富文本翻译`,
    en: `Enable rich text translation`,
  },
  has_shadowroot: {
    zh: `扫描Shadowroot`,
    en: `Scan Shadowroot`,
  },
  mousehover_translate: {
    zh: `鼠标悬停翻译`,
    en: `Mouseover Translation`,
  },
  use_mousehover_translation: {
    zh: `启用鼠标悬停翻译`,
    en: `Enable mouseover translation`,
  },
  use_mousehover_translation_helper: {
    zh: `开启后，按当前快捷键或按住方式悬停，会显示译文气泡或双语结果。关闭后不再出现悬停入口。`,
    en: `When on, hovering with the current shortcut or hold gesture shows a translation bubble or bilingual result. When off, that hover entry stays hidden.`,
  },
  mousehover_key_help: {
    zh: `当快捷键置空时表示鼠标懸停直接翻译`,
    en: `When the shortcut key is empty, it means that the mouse hovers to translate directly`,
  },
  mousehover_hold_key: {
    zh: `按住鼠标左键触发翻译/还原`,
    en: `Hold the left mouse button to translate/restore`,
  },
  mousehover_hold_key_helper: {
    zh: `按住鼠标左键不放约设定的延迟时间后，翻译光标所在的整块文字区域；松开后再按住一次即可还原。译文按“显示方式”设置呈现为独立块或行内。`,
    en: `Hold the left mouse button for the configured delay to translate the whole text block under the cursor; hold again to restore it. The translation is shown as an independent block or inline according to the display setting.`,
  },
  mousehover_hold_delay: {
    zh: `按住触发延迟 (毫秒)`,
    en: `Hold trigger delay (ms)`,
  },
  mousehover_hold_delay_helper: {
    zh: `鼠标左键需要按住多长时间才触发翻译，默认 800 毫秒。`,
    en: `How long the left mouse button must be held before translation is triggered. Defaults to 800 ms.`,
  },
  mousehover_hold_scope: {
    zh: `按住左键翻译范围`,
    en: `Hold translation scope`,
  },
  mousehover_hold_scope_paragraph: {
    zh: `只翻译当前段`,
    en: `Translate current paragraph only`,
  },
  mousehover_hold_scope_region: {
    zh: `翻译最近区域`,
    en: `Translate the nearest region`,
  },
  mousehover_hold_scope_area: {
    zh: `翻译整篇文章`,
    en: `Translate the whole article`,
  },
  mousehover_hold_scope_helper: {
    zh: `“只翻译当前段”与旧版悬停翻译一致；“翻译最近区域”从鼠标所在位置向上定位到最近的、包含多个文字块的容器；“翻译整篇文章”优先定位到文章/邮件正文容器，从上到下翻译其中全部内容。`,
    en: `"Current paragraph only" behaves like the legacy hover translation. "Nearest region" locates the closest container with multiple text blocks above the cursor. "Whole article" prefers the article/mail body container and translates all its content from top to bottom.`,
  },
  mousehover_hold_display: {
    zh: `按住左键译文显示方式`,
    en: `Hold translation display mode`,
  },
  mousehover_hold_display_inline: {
    zh: `跟随原文行内`,
    en: `Inline with original`,
  },
  mousehover_hold_display_block: {
    zh: `独立成块`,
    en: `Independent block`,
  },
  mousehover_hold_display_helper: {
    zh: `“独立成块”会把译文显示在原文下方并留出间距，适合邮件、长文对照阅读；“跟随原文行内”与普通悬停翻译一致。`,
    en: `"Independent block" shows the translation below the original with spacing, ideal for mail and long-form reading. "Inline with original" behaves like the regular hover translation.`,
  },
  mousehover_hold_prevent_click: {
    zh: `按住链接/按钮翻译后，松开不触发点击跳转`,
    en: `Suppress click/navigation after hold-to-translate on links and buttons`,
  },
  mousehover_hold_prevent_click_helper: {
    zh: `开启后，按住链接或按钮翻译成功并松开时，不会触发链接跳转或按钮点击；默认关闭。`,
    en: `When enabled, releasing after a successful hold-to-translate on a link or button will not trigger navigation or a button click. Disabled by default.`,
  },
  mousehover_display_mode: {
    zh: `展示模式`,
    en: `Display mode`,
  },
  mousehover_display_bilingual: {
    zh: `双语模式`,
    en: `Bilingual mode`,
  },
  mousehover_display_bubble: {
    zh: `气泡模式`,
    en: `Bubble mode`,
  },
  mousehover_bubble_label: {
    zh: `悬停翻译`,
    en: `Hover translation`,
  },
  mousehover_bubble_style: {
    zh: `气泡样式 CSS`,
    en: `Bubble style CSS`,
  },
  mousehover_bubble_style_helper: {
    zh: `用于自定义气泡容器样式；定位和视口防溢出由程序自动处理。`,
    en: `Customize the bubble container style. Positioning and viewport overflow are handled automatically.`,
  },
  mousehover_follow_page_rule: {
    zh: `跟随网页规则`,
    en: `Follow page rule`,
  },
  mousehover_bubble_api_helper: {
    zh: `仅用于气泡翻译；双语模式仍使用当前网页规则的翻译服务。`,
    en: `Used only for bubble translations; bilingual mode still uses the current page rule.`,
  },
  autoscan_alt: {
    zh: `自动扫描`,
    en: `Auto Scan`,
  },
  scan_all_nodes: {
    zh: `扫描全部节点`,
    en: `Scan All Nodes`,
  },
  richtext_alt: {
    zh: `保留富文本`,
    en: `Rich Text`,
  },
  transonly_alt: {
    zh: `切换仅显示译文`,
    en: `Hide Original`,
  },
  confirm_title: {
    zh: `确认`,
    en: `Confirm`,
  },
  confirm_message: {
    zh: `确定操作吗？`,
    en: `Are you sure you want to proceed?`,
  },
  confirm_action: {
    zh: `确定`,
    en: `Confirm`,
  },
  cancel_action: {
    zh: `取消`,
    en: `Cancel`,
  },
  pls_press_shortcut: {
    zh: `请按下快捷键组合`,
    en: `Please press the shortcut key combination`,
  },
  translation_style: {
    zh: `翻译风格`,
    en: `Translation style`,
  },
  placeholder: {
    zh: `占位符`,
    en: `Placeholder`,
  },
  if_pre_init: {
    zh: `是否预初始化`,
    en: `Whether to pre-initialize`,
  },
  favorite_words_helper: {
    zh: `导入词汇请使用txt文件，每一行一个单词。`,
    en: `To import vocabulary, please use a txt file with one word per line.`,
  },
  btn_tip_click_away: {
    zh: `失焦隐藏/显示`,
    en: `Loss of focus hide/show`,
  },
  btn_tip_follow_selection: {
    zh: `跟随/固定模式`,
    en: `Follow/Fixed Mode`,
  },
  btn_tip_simple_style: {
    zh: `迷你/常规模式`,
    en: `Mini/Regular Mode`,
  },
  btn_tip_dark_mode: {
    zh: `亮色/暗色/跟随系统`,
    en: `Light/Dark/Auto`,
  },
  api_placeholder: {
    zh: `占位符`,
    en: `Placeholder`,
  },
  api_placetag: {
    zh: `占位标签`,
    en: `Placeholder tags`,
  },
  placetag_format: {
    zh: `占位符格式`,
    en: `Placeholder Format`,
  },
  format_compact: {
    zh: `简洁格式 <a1>`,
    en: `Compact Format <a1>`,
  },
  format_attribute: {
    zh: `属性格式 <a i=1>`,
    en: `Attribute Format <a i=1>`,
  },
  detected_lang: {
    zh: `语言检测`,
    en: `Language detection`,
  },
  detected_result: {
    zh: `检测结果`,
    en: `Detect result`,
  },
  subtitle_translate: {
    zh: `字幕翻译`,
    en: `Subtitle Translation`,
  },
  bilingual_subtitles: {
    zh: `双语字幕`,
    en: `Bilingual subtitles`,
  },
  vocabulary_book: {
    zh: `生词本`,
    en: `Vocabulary`,
  },
  download_subtitles_vtt: {
    zh: `下载字幕 (VTT)`,
    en: `Download subtitles (VTT)`,
  },
  download_raw_subtitle_events_json: {
    zh: `下载源数据 (JSON)`,
    en: `Download source data (JSON)`,
  },
  download_translation_subtitles_vtt: {
    zh: `下载译文字幕 (VTT)`,
    en: `Download translation subtitles (VTT)`,
  },
  toggle_subtitle_translate: {
    zh: `启用字幕翻译`,
    en: `Enable subtitle translation`,
  },
  enable_subtitle_translate: {
    zh: `开启翻译`,
    en: `Enable translation`,
  },
  is_bilingual_view: {
    zh: `双语显示`,
    en: `Enable bilingual display`,
  },
  is_blur_translation: {
    zh: `模糊译文`,
    en: `Blur Translation`,
  },
  is_skip_ad: {
    zh: `快进广告`,
    en: `Skip AD`,
  },
  download_subtitles: {
    zh: `下载字幕`,
    en: `Download subtitles`,
  },
  background_styles: {
    zh: `背景样式`,
    en: `Background Style`,
  },
  origin_styles: {
    zh: `原文样式`,
    en: `Original style`,
  },
  translation_styles: {
    zh: `译文样式`,
    en: `Translation style`,
  },
  ai_segmentation: {
    zh: `AI智能断句`,
    en: `AI intelligent punctuation`,
  },
  force_subtitle_retranslate: {
    zh: `强制重翻`,
    en: `Force re-translate`,
  },
  ai_enhanced_context: {
    zh: `增强智能上下文`,
    en: `Enhanced Intelligent Context`,
  },
  ai_context_analyzing: {
    zh: `AI正在分析视频内容...`,
    en: `AI is analyzing video content...`,
  },
  ai_chunk_length: {
    zh: `AI处理切割长度(200-20000)`,
    en: `AI processing chunk length(200-20000)`,
  },
  subtitle_helper_1: {
    zh: `1、目前仅支持Youtube桌面网站。`,
    en: `1. Currently only supports Youtube desktop website.`,
  },
  subtitle_helper_2: {
    zh: `2、插件内置基础的字幕合并、断句算法，可满足大部分情况。`,
    en: `2. The plug-in has built-in basic subtitle merging and sentence segmentation algorithms, which can meet most situations.`,
  },
  subtitle_helper_3: {
    zh: `3、亦可以启用AI智能断句，但需考虑切割长度及AI接口能力，可能处理时间会很长。若处理失败，将自动降级为内置断句并翻译。`,
    en: `3. You can also enable AI intelligent segmentation, but consider the chunk length and AI interface capacity, as processing may take a long time. If it fails, it will automatically fall back to built-in sentence break and translation.`,
  },
  show_subtitle_list: {
    zh: `显示字幕列表`,
    en: `Show Subtitle List`,
  },
  subtitle_loading_notification: {
    zh: `字幕加载通知`,
    en: `Subtitle loading notification`,
  },
  hide_subtitle_button: {
    zh: `隐藏功能按钮`,
    en: `Hide function button`,
  },
  remember_subtitle_position: {
    zh: `记住字幕位置`,
    en: `Remember subtitle position`,
  },
  subtitle_hover_lookup: {
    zh: `悬停查词`,
    en: `Hover Word Lookup`,
  },
  subtitle_load_succeed: {
    zh: `双语字幕加载成功！`,
    en: `Bilingual subtitles loaded successfully!`,
  },
  subtitle_load_failed: {
    zh: `双语字幕加载失败！`,
    en: `Failed to load bilingual subtitles!`,
  },
  starting_to_process_subtitle: {
    zh: `开始处理字幕数据...`,
    en: `Starting to process subtitle data...`,
  },
  starting_reprocess_events: {
    zh: `重新处理字幕数据...`,
    en: `Reprocess the subtitle data...`,
  },
  waitting_for_subtitle: {
    zh: `请等待字幕数据`,
    en: `Please wait for the subtitle data.`,
  },
  ai_processing_pls_wait: {
    zh: `AI处理中，请稍等...`,
    en: `AI processing in progress, please wait...`,
  },
  processing_subtitles: {
    zh: `字幕处理中...`,
    en: `Subtitle processing...`,
  },
  waiting_subtitles: {
    zh: `等待字幕中`,
    en: `Waiting for subtitles`,
  },
  log_level: {
    zh: `日志级别`,
    en: `Log Level`,
  },
  goto_custom_api_example: {
    zh: `点击查看【自定义接口示例】`,
    en: `Click to view [Custom Interface Example]`,
  },
  split_paragraph: {
    zh: `切分长段落`,
    en: `Split long paragraph`,
  },
  split_length: {
    zh: `切分长度 (0-10000)`,
    en: `Segmentation length(0-10000)`,
  },
  highlight_words: {
    zh: `高亮收藏词汇`,
    en: `Highlight favorite words`,
  },
  split_disable: {
    zh: `禁用`,
    en: `Disable`,
  },
  split_textlength: {
    zh: `按照长度切分`,
    en: `Split by length`,
  },
  split_punctuation: {
    zh: `按照句子切分`,
    en: `Split by sentence`,
  },
  highlight_disable: {
    zh: `禁用`,
    en: `Disable`,
  },
  highlight_beforetrans: {
    zh: `翻译前高亮`,
    en: `Highlight before translation`,
  },
  highlight_aftertrans: {
    zh: `翻译后高亮`,
    en: `Highlight after translation`,
  },
  pagescroll_root_margin: {
    zh: `滚动加载提前触发 (0-10000px)`,
    en: `Early triggering of scroll loading (0-10000px)`,
  },
  style_name: {
    zh: `样式名称`,
    en: `Style Name`,
  },
  style_code: {
    zh: `样式代码`,
    en: `Style Code`,
  },
  custom_styles: {
    zh: `自定义样式`,
    en: `Custom styles`,
  },
  builtin_styles: {
    zh: `内置样式`,
    en: `Built-in styles`,
  },
  style_preview_source: {
    zh: `Hello, world`,
    en: `Hello, world`,
  },
  style_preview_translation: {
    zh: `你好，世界`,
    en: `Hello, world`,
  },
  long_sentence_threshold: {
    zh: `规则断句阈值 (20-300字符)`,
    en: `Rule-based segmentation threshold (20-300 chars)`,
  },
  pre_trans_seconds: {
    zh: `提前翻译时长 (10-36000s)`,
    en: `Pre translation seconds (10-36000s)`,
  },
  throttle_trans_interval: {
    zh: `节流翻译间隔 (1-3600s)`,
    en: `Throttling translation interval (1-3600s)`,
  },
  subtitle_same_lang: {
    zh: `原语言与目标语言相同，字幕不予处理`,
    en: `The source language is the same as the target language, subtitles will not be processed`,
  },
  plain_text_translate: {
    zh: `纯文本翻译`,
    en: `Plain text translation`,
  },
  open_separate_window: {
    zh: `独立窗口打开`,
    en: `Open in Separate Window`,
  },
  auto_translate_clipboard: {
    zh: `自动翻译剪贴板`,
    en: `Auto-translate Clipboard`,
  },
  auto_translate_clipboard_helper: {
    zh: `打开文本翻译面板或重新聚焦独立窗口时自动翻译剪贴板文本`,
    en: `Translate clipboard text when the text panel opens or its separate window regains focus`,
  },
  clipboard_permission_required: {
    zh: `剪贴板权限已失效，点击重新授权`,
    en: `Clipboard permission is missing. Click to grant it again`,
  },
  clipboard_permission_granted: {
    zh: `已开启自动翻译剪贴板`,
    en: `Clipboard auto-translation enabled`,
  },
  clipboard_permission_denied: {
    zh: `未获得剪贴板读取权限，功能保持关闭`,
    en: `Clipboard access was not granted, so the feature remains disabled`,
  },
  comment_support: {
    zh: `好评支持`,
    en: `Leave a Positive Review`,
  },
  appreciate_support: {
    zh: `赞赏支持`,
    en: `Support with a Tip`,
  },
  toggle_transbox: {
    zh: `切换翻译窗`,
    en: `Toggle Translation Box`,
  },
  copy: {
    zh: `复制`,
    en: `Copy`,
  },
  copy_success: {
    zh: `已复制`,
    en: `Copied`,
  },
  paste: {
    zh: `黏贴`,
    en: `Paste`,
  },
  submit: {
    zh: `提交`,
    en: `Submit`,
  },
  collect: {
    zh: `收藏`,
    en: `Save`,
  },
  favorite_word_lookup_loading: {
    zh: `正在查询释义…`,
    en: `Looking up definition…`,
  },
  favorite_word_lookup_unavailable: {
    zh: `当前词典无法查询该词。`,
    en: `The selected dictionary cannot look up this word.`,
  },
  favorite_word_definition_not_found: {
    zh: `未找到释义。`,
    en: `No definition found.`,
  },
  favorite_word_lookup_failed: {
    zh: `释义加载失败。`,
    en: `Failed to load definition.`,
  },
  show_translation_dot: {
    zh: `显示翻译圆点`,
    en: `Show Translation Dot`,
  },
  show_dot_mobile: {
    zh: `仅移动端`,
    en: `Mobile Only`,
  },
  show_dot_always: {
    zh: `总是显示`,
    en: `Always`,
  },
  show_dot_disable: {
    zh: `禁用`,
    en: `Disable`,
  },
  rule_disabled: {
    zh: `规则已禁用`,
    en: `Rule Disabled`,
  },
  rule_enabled: {
    zh: `规则已启用`,
    en: `Rule Enabled`,
  },
  rule_toggle_failed: {
    zh: `规则切换失败`,
    en: `Failed to toggle rule`,
  },
  seg_trans_diff_warning: {
    zh: `断句和翻译服务不同，翻译引擎会重复翻译字幕`,
    en: `Segmentation and translation engines differ; subtitles will be re-translated.`,
  },
  subtitle_style_preview: {
    zh: `样式预览`,
    en: `Style Preview`,
  },
  subtitle_preview_sample: {
    zh: `这是示例字幕文本`,
    en: `This is an example subtitle`,
  },
  font_size: {
    zh: `字体大小`,
    en: `Font Size`,
  },
  font_color: {
    zh: `字体颜色`,
    en: `Font Color`,
  },
  background_color: {
    zh: `背景颜色`,
    en: `Background Color`,
  },
  opacity: {
    zh: `透明度`,
    en: `Opacity`,
  },
  line_height: {
    zh: `行高`,
    en: `Line Height`,
  },
  padding: {
    zh: `内边距`,
    en: `Padding`,
  },
  vertical: {
    zh: `上下`,
    en: `Vertical`,
  },
  horizontal: {
    zh: `左右`,
    en: `Horizontal`,
  },
  text_shadow: {
    zh: `文字阴影`,
    en: `Text Shadow`,
  },
  advanced_css: {
    zh: `高级 CSS 编辑`,
    en: `Advanced CSS`,
  },
  close: {
    zh: `关闭`,
    en: `Close`,
  },
};

export const normalizeUiLang = (lang) =>
  typeof lang === "string" && lang.toLowerCase().startsWith("zh") ? "zh" : "en";

export const newI18n = (lang) => {
  const locale = normalizeUiLang(lang);
  return (key, defaultText = key) => I18N[key]?.[locale] ?? defaultText;
};

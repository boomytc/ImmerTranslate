import {
  defaultNobatchPrompt,
  defaultNobatchUserPrompt,
  defaultNobatchPromptConcise,
  defaultNobatchUserPromptConcise,
  defaultSystemPromptLines,
  defaultSystemPromptXml,
  defaultSystemPromptJson,
  defaultBatchUserPromptJson,
  defaultBatchUserPromptLines,
  defaultBatchUserPromptXml,
  defaultDictPrompt,
  defaultDictPromptEnJa,
  defaultDictPromptEnKo,
  defaultDictPromptEnRu,
  defaultDictPromptEnVi,
  defaultDictUserPrompt,
  defaultSubtitlePrompt,
} from "./api";

// 聚合翻译协议定义
export const PROMPT_PROTOCOL_LINE = "line";
export const PROMPT_PROTOCOL_XML = "xml";
export const PROMPT_PROTOCOL_JSON = "json";
export const PROMPT_PROTOCOLS = [
  PROMPT_PROTOCOL_LINE,
  PROMPT_PROTOCOL_XML,
  PROMPT_PROTOCOL_JSON,
];

// 定义各类预设提示词的唯一标识符 (Slug)
export const PROMPT_SLUG_NOBATCH_TRANSLATION = "nobatch-translation";
export const PROMPT_SLUG_NOBATCH_TRANSLATION_CONCISE =
  "nobatch-translation-concise";
export const PROMPT_SLUG_BATCH_TRANSLATION_JSON = "batch-translation-json";
export const PROMPT_SLUG_BATCH_TRANSLATION_XML = "batch-translation-xml";
export const PROMPT_SLUG_BATCH_TRANSLATION_LINE = "batch-translation-line";
export const PROMPT_SLUG_SUBTITLE_SEGMENTATION = "subtitle-segmentation";
export const PROMPT_SLUG_DICTIONARY_EN_ZH = "dictionary-en-zh";
export const PROMPT_SLUG_DICTIONARY_EN_JA = "dictionary-en-ja";
export const PROMPT_SLUG_DICTIONARY_EN_KO = "dictionary-en-ko";
export const PROMPT_SLUG_DICTIONARY_EN_VI = "dictionary-en-vi";
export const PROMPT_SLUG_DICTIONARY_EN_RU = "dictionary-en-ru";

// 提示词应用模式：跟随接口内部配置，或使用全局统一配置
export const PROMPT_MODE_FOLLOW_API = "follow_api";
export const PROMPT_MODE_GLOBAL = "global";

// 定义提示词所属的分类，用于在界面和逻辑中进行归类区分
export const PROMPT_CATEGORY_BATCH_SYSTEM = "batch system prompt";
export const PROMPT_CATEGORY_USER = "user prompt";
export const PROMPT_CATEGORY_SUBTITLE = "subtitle prompt";
export const PROMPT_CATEGORY_DICTIONARY = "dictionary prompt";
// 允许在设置界面“提示词管理”中展示和维护的分类列表
export const PROMPT_TEMPLATE_CATEGORIES = [
  PROMPT_CATEGORY_USER,
  PROMPT_CATEGORY_BATCH_SYSTEM,
  PROMPT_CATEGORY_SUBTITLE,
  PROMPT_CATEGORY_DICTIONARY,
];

// 各类功能默认使用的提示词 Slug，当未配置时作为后备默认值
export const DEFAULT_NOBATCH_PROMPT_SLUG =
  PROMPT_SLUG_NOBATCH_TRANSLATION_CONCISE;
export const DEFAULT_BATCH_PROMPT_SLUG = PROMPT_SLUG_BATCH_TRANSLATION_JSON;
export const DEFAULT_SUBTITLE_PROMPT_SLUG = PROMPT_SLUG_SUBTITLE_SEGMENTATION;
export const DEFAULT_DICTIONARY_PROMPT_SLUG = PROMPT_SLUG_DICTIONARY_EN_ZH;

// 当前设置版本。导入时写入；读取时缺省版本回落到它。
export const SETTINGS_VERSION_V3 = 3;
export const CURRENT_SETTINGS_VERSION = SETTINGS_VERSION_V3;

/**
 * 预设的提示词列表。包含了系统出厂自带的各种场景提示词模板。
 * 用户不能删除预设提示词，但可以基于它们复制出自定义的模板。
 */
export const PRESET_PROMPTS = [
  {
    slug: PROMPT_SLUG_NOBATCH_TRANSLATION_CONCISE,
    category: PROMPT_CATEGORY_USER,
    nameKey: "preset_prompt_nobatch_translation_concise",
    name: "Single-sentence translation (Concise)",
    systemPrompt: defaultNobatchPromptConcise,
    userPrompt: defaultNobatchUserPromptConcise,
  },
  {
    slug: PROMPT_SLUG_NOBATCH_TRANSLATION,
    category: PROMPT_CATEGORY_USER,
    nameKey: "preset_prompt_nobatch_translation",
    name: "Single-sentence translation (Legacy)",
    systemPrompt: defaultNobatchPrompt,
    userPrompt: defaultNobatchUserPrompt,
  },
  {
    slug: PROMPT_SLUG_BATCH_TRANSLATION_JSON,
    category: PROMPT_CATEGORY_BATCH_SYSTEM,
    nameKey: "preset_prompt_batch_translation_json",
    name: "Batch translation (JSON)",
    protocol: PROMPT_PROTOCOL_JSON,
    systemPrompt: defaultSystemPromptJson,
    userPrompt: defaultBatchUserPromptJson,
  },
  {
    slug: PROMPT_SLUG_BATCH_TRANSLATION_XML,
    category: PROMPT_CATEGORY_BATCH_SYSTEM,
    nameKey: "preset_prompt_batch_translation_xml",
    name: "Batch translation (XML)",
    protocol: PROMPT_PROTOCOL_XML,
    systemPrompt: defaultSystemPromptXml,
    userPrompt: defaultBatchUserPromptXml,
  },
  {
    slug: PROMPT_SLUG_BATCH_TRANSLATION_LINE,
    category: PROMPT_CATEGORY_BATCH_SYSTEM,
    nameKey: "preset_prompt_batch_translation_line",
    name: "Batch translation (LINE)",
    protocol: PROMPT_PROTOCOL_LINE,
    systemPrompt: defaultSystemPromptLines,
    userPrompt: defaultBatchUserPromptLines,
  },
  {
    slug: PROMPT_SLUG_SUBTITLE_SEGMENTATION,
    category: PROMPT_CATEGORY_SUBTITLE,
    nameKey: "preset_prompt_subtitle_segmentation",
    name: "Subtitle AI segmentation",
    systemPrompt: defaultSubtitlePrompt,
    userPrompt: "",
  },
  {
    slug: PROMPT_SLUG_DICTIONARY_EN_ZH,
    category: PROMPT_CATEGORY_DICTIONARY,
    nameKey: "preset_prompt_dictionary_en_zh",
    name: "AI English-Chinese Dictionary",
    systemPrompt: defaultDictPrompt,
    userPrompt: defaultDictUserPrompt,
  },
  {
    slug: PROMPT_SLUG_DICTIONARY_EN_JA,
    category: PROMPT_CATEGORY_DICTIONARY,
    nameKey: "preset_prompt_dictionary_en_ja",
    name: "AI English-Japanese Dictionary",
    systemPrompt: defaultDictPromptEnJa,
    userPrompt: defaultDictUserPrompt,
  },
  {
    slug: PROMPT_SLUG_DICTIONARY_EN_KO,
    category: PROMPT_CATEGORY_DICTIONARY,
    nameKey: "preset_prompt_dictionary_en_ko",
    name: "AI English-Korean Dictionary",
    systemPrompt: defaultDictPromptEnKo,
    userPrompt: defaultDictUserPrompt,
  },
  {
    slug: PROMPT_SLUG_DICTIONARY_EN_VI,
    category: PROMPT_CATEGORY_DICTIONARY,
    nameKey: "preset_prompt_dictionary_en_vi",
    name: "AI English-Vietnamese Dictionary",
    systemPrompt: defaultDictPromptEnVi,
    userPrompt: defaultDictUserPrompt,
  },
  {
    slug: PROMPT_SLUG_DICTIONARY_EN_RU,
    category: PROMPT_CATEGORY_DICTIONARY,
    nameKey: "preset_prompt_dictionary_en_ru",
    name: "AI English-Russian Dictionary",
    systemPrompt: defaultDictPromptEnRu,
    userPrompt: defaultDictUserPrompt,
  },
];

const PRESET_PROMPT_SLUGS = new Set(
  PRESET_PROMPTS.map((prompt) => prompt.slug)
);

/**
 * 规范化提示词对象，确保所有必填字段为字符串格式。
 * 避免因为 undefined 等值导致报错或判断异常。
 *
 * @param {Object} prompt 原始提示词对象
 * @returns {Object} 规范化后的提示词对象
 */
export function normalizePrompt(prompt = {}) {
  const normalized = {
    slug: String(prompt.slug || ""),
    category: String(prompt.category || ""),
    nameKey: String(prompt.nameKey || ""),
    name: String(prompt.name || ""),
    systemPrompt: String(prompt.systemPrompt || ""),
    userPrompt: String(prompt.userPrompt || ""),
  };

  if (prompt.protocol) {
    normalized.protocol = String(prompt.protocol);
  }

  return normalized;
}

/**
 * 判断给定的提示词标识符是否属于系统预设提示词。
 *
 * @param {string} promptSlug 提示词标识符
 * @returns {boolean} 是否为预设提示词
 */
export function isPresetPromptSlug(promptSlug) {
  return PRESET_PROMPT_SLUGS.has(promptSlug);
}

/**
 * 获取所有可用的提示词（包含预设的提示词与用户自定义的提示词）。
 *
 * @param {Array} userPrompts 用户自定义提示词列表
 * @returns {Array} 组合后的提示词列表
 */
export function getAllPrompts(userPrompts = []) {
  const customPrompts = normalizeCustomPrompts(userPrompts);

  return [...PRESET_PROMPTS, ...customPrompts];
}

/**
 * 过滤并规范化用户自定义的提示词列表，去除无效或与预设冲突的项。
 *
 * @param {Array} userPrompts 用户自定义提示词列表
 * @returns {Array} 清洗后的自定义提示词列表
 */
export function normalizeCustomPrompts(userPrompts = []) {
  return (Array.isArray(userPrompts) ? userPrompts : [])
    .map(normalizePrompt)
    .filter((prompt) => prompt.slug && !isPresetPromptSlug(prompt.slug))
    .map(({ slug, category, name, protocol, systemPrompt, userPrompt }) => ({
      slug,
      category,
      name,
      ...(protocol ? { protocol } : {}),
      systemPrompt,
      userPrompt,
    }));
}

/**
 * 根据 Slug 查找对应的提示词对象（优先从全部列表中查找）。
 *
 * @param {Array} userPrompts 用户自定义提示词列表
 * @param {string} promptSlug 需要查找的提示词 Slug
 * @returns {Object|null} 匹配的提示词对象，未找到返回 null
 */
export function findPromptBySlug(userPrompts = [], promptSlug) {
  if (!promptSlug) {
    return null;
  }

  return getAllPrompts(userPrompts).find(
    (prompt) => prompt?.slug === promptSlug
  );
}

function findPromptBySlugOrDefault(userPrompts, promptSlug, defaultPromptSlug) {
  return (
    findPromptBySlug(userPrompts, promptSlug) ||
    findPromptBySlug(userPrompts, defaultPromptSlug)
  );
}

/**
 * 获取指定提示词的名称（未进行本地化翻译的原始名称）。
 *
 * @param {Array} userPrompts 用户自定义提示词列表
 * @param {string} promptSlug 提示词标识符
 * @returns {string} 提示词名称，未找到则返回空字符串
 */
export function getPromptName(userPrompts = [], promptSlug) {
  return findPromptBySlug(userPrompts, promptSlug)?.name || "";
}

function hasOwn(source = {}, fieldName) {
  return Object.prototype.hasOwnProperty.call(source, fieldName);
}

function getPromptFieldValue(source = {}, fieldName, defaultValue = "") {
  if (!hasOwn(source, fieldName)) {
    return defaultValue;
  }

  return source[fieldName];
}

function hasPromptReferenceField(source = {}, promptSlugFieldName) {
  return hasOwn(source, promptSlugFieldName);
}

/**
 * 获取提示词在界面上显示的名称（支持国际化 i18n 翻译）。
 *
 * @param {Object} prompt 提示词对象
 * @param {Function} i18n 多语言翻译函数
 * @returns {string} 对应的展示名称
 */
export function getPromptDisplayName(prompt = {}, i18n) {
  const normalizedPrompt = normalizePrompt(prompt);
  if (normalizedPrompt.nameKey && typeof i18n === "function") {
    return i18n(normalizedPrompt.nameKey, normalizedPrompt.name);
  }

  return normalizedPrompt.name || normalizedPrompt.slug;
}

/**
 * 获取提示词分类在界面上显示的名称（支持国际化）。
 *
 * @param {string} category 提示词分类常量
 * @param {Function} i18n 多语言翻译函数
 * @returns {string} 分类的展示名称
 */
export function getPromptCategoryDisplayName(category, i18n) {
  if (typeof i18n !== "function") {
    return category || "";
  }

  const keyMap = {
    [PROMPT_CATEGORY_BATCH_SYSTEM]: "prompt_category_batch_system",
    [PROMPT_CATEGORY_USER]: "prompt_category_user",
    [PROMPT_CATEGORY_SUBTITLE]: "prompt_category_subtitle",
    [PROMPT_CATEGORY_DICTIONARY]: "prompt_category_dictionary",
  };

  return i18n(keyMap[category], category || "");
}

function getPromptOptions(prompts = [], category) {
  return (Array.isArray(prompts) ? prompts : []).filter(
    (prompt) => prompt?.category === category
  );
}

/**
 * 获取所有可用的“非聚合翻译 (Non-batch)”提示词选项
 *
 * @param {Array} prompts 全部可用提示词列表
 * @returns {Array}
 */
export function getNobatchPromptOptions(prompts = []) {
  return getPromptOptions(prompts, PROMPT_CATEGORY_USER);
}

/**
 * 获取所有可用的“聚合翻译 (Batch)”提示词选项
 *
 * @param {Array} prompts 全部可用提示词列表
 * @returns {Array}
 */
export function getBatchPromptOptions(prompts = []) {
  return getPromptOptions(prompts, PROMPT_CATEGORY_BATCH_SYSTEM);
}

/**
 * 获取所有翻译提示词综合选项（聚合与单句合并）
 *
 * @param {Array} prompts 全部可用提示词列表
 * @returns {Array} 聚合与单句提示词集合，每项带有 isBatch 标记
 */
export function getAllTranslationPromptOptions(prompts = []) {
  const batchOptions = getBatchPromptOptions(prompts).map((item) => ({
    ...item,
    isBatch: true,
  }));
  const nobatchOptions = getNobatchPromptOptions(prompts).map((item) => ({
    ...item,
    isBatch: false,
  }));
  return [...batchOptions, ...nobatchOptions];
}

/**
 * 获取带 [聚合] / [单句] 前缀的翻译提示词展示名称
 *
 * @param {Object} prompt 提示词对象
 * @param {Function} i18n 多语言翻译函数
 * @returns {string} 带有模式前缀的展示名称
 */
export function getTranslationPromptDisplayName(prompt = {}, i18n) {
  const baseName = getPromptDisplayName(prompt, i18n);
  const isBatch =
    prompt.isBatch !== undefined
      ? Boolean(prompt.isBatch)
      : prompt.category === PROMPT_CATEGORY_BATCH_SYSTEM;
  const prefix = isBatch ? "[聚合] " : "[单句] ";
  return `${prefix}${baseName}`;
}

/**
 * 获取所有可用的“字幕翻译/分句”提示词选项
 *
 * @param {Array} prompts 全部可用提示词列表
 * @returns {Array}
 */
export function getSubtitlePromptOptions(prompts = []) {
  return getPromptOptions(prompts, PROMPT_CATEGORY_SUBTITLE);
}

/**
 * 获取 AI 词典可选提示词列表。
 *
 * 仅返回词典分类，供接口配置页和划词翻译框设置页复用。
 *
 * @param {Array<Object>} prompts 用户与预设提示词集合
 * @returns {Array<Object>} 可用于 AI 词典的提示词选项
 */
export function getDictionaryPromptOptions(prompts = []) {
  return getPromptOptions(prompts, PROMPT_CATEGORY_DICTIONARY);
}

function hasPromptReference(source = {}, promptSlugFieldName, promptSlug) {
  return (
    hasOwn(source, promptSlugFieldName) &&
    source[promptSlugFieldName] === promptSlug
  );
}

/**
 * 删除某个自定义提示词后，级联更新所有引用了该提示词的接口配置。
 * 遍历各个 API 和字幕设置，如果它们正在使用被删除的提示词（根据 promptSlug 判断），
 * 则将它们回退重置为对应类型的系统默认提示词（DEFAULT_***_PROMPT_SLUG）。
 *
 * @param {Object} setting 完整的配置对象
 * @param {string} promptSlug 被删除的提示词 Slug
 * @returns {Object} 更新引用后的配置对象副本
 */
export function removePromptReferences(setting = {}, promptSlug) {
  if (!promptSlug || isPresetPromptSlug(promptSlug)) {
    return setting;
  }

  let hasApiChanges = false;

  const transApis = (
    Array.isArray(setting?.transApis) ? setting.transApis : []
  ).map((api) => {
    let nextApi = api;

    if (hasPromptReference(api, "batchPromptSlug", promptSlug)) {
      nextApi = {
        ...nextApi,
        batchPromptSlug: DEFAULT_BATCH_PROMPT_SLUG,
      };
      delete nextApi.systemPrompt;
      delete nextApi.batchUserPrompt;
      delete nextApi.batchProtocol;
      hasApiChanges = true;
    }

    if (hasPromptReference(api, "nobatchPromptSlug", promptSlug)) {
      nextApi = {
        ...nextApi,
        nobatchPromptSlug: DEFAULT_NOBATCH_PROMPT_SLUG,
      };
      delete nextApi.nobatchPrompt;
      delete nextApi.nobatchUserPrompt;
      hasApiChanges = true;
    }

    if (hasPromptReference(api, "subtitlePromptSlug", promptSlug)) {
      nextApi = {
        ...nextApi,
        subtitlePromptSlug: DEFAULT_SUBTITLE_PROMPT_SLUG,
      };
      delete nextApi.subtitlePrompt;
      hasApiChanges = true;
    }

    if (hasPromptReference(api, "dictPromptSlug", promptSlug)) {
      nextApi = {
        ...nextApi,
        dictPromptSlug: DEFAULT_DICTIONARY_PROMPT_SLUG,
      };
      delete nextApi.dictPrompt;
      delete nextApi.dictUserPrompt;
      hasApiChanges = true;
    }

    return nextApi;
  });

  const hasSubtitlePromptReference = hasPromptReference(
    setting?.subtitleSetting,
    "segPromptSlug",
    promptSlug
  );
  const hasTranboxDictPromptReference = hasPromptReference(
    setting?.tranboxSetting,
    "aiDictPromptSlug",
    promptSlug
  );

  if (
    !hasApiChanges &&
    !hasSubtitlePromptReference &&
    !hasTranboxDictPromptReference
  ) {
    return setting;
  }

  const nextSetting = { ...setting };

  if (hasApiChanges) {
    nextSetting.transApis = transApis;
  }

  if (hasSubtitlePromptReference) {
    nextSetting.subtitleSetting = {
      ...(setting?.subtitleSetting || {}),
      segPromptMode: PROMPT_MODE_FOLLOW_API,
      segPromptSlug: DEFAULT_SUBTITLE_PROMPT_SLUG,
    };
  }

  if (hasTranboxDictPromptReference) {
    nextSetting.tranboxSetting = {
      ...(setting?.tranboxSetting || {}),
      aiDictPromptSlug: PROMPT_MODE_FOLLOW_API,
    };
  }

  return nextSetting;
}

/**
 * 在运行时，将接口配置中引用的提示词 Slug 解析展开。
 * 它会根据配置中的 `***PromptSlug` 字段，去 `userPrompts` 或预设列表中寻找实际的提示词文本，
 * 并把解析后的实际 `systemPrompt` 和 `userPrompt` 内容注入到 API 配置对象副本中，供翻译时直接取用。
 *
 * @param {Object} apiSetting 单个接口配置
 * @param {Array} userPrompts 用户自定义提示词列表
 * @param {Object} subtitleSetting 字幕相关的特殊全局配置
 * @returns {Object} 填充了实际提示词文本的 API 配置副本
 */
export function resolveApiPromptSettings(
  apiSetting = {},
  userPrompts = [],
  subtitleSetting = {}
) {
  if (!apiSetting) {
    return apiSetting;
  }

  const nextApiSetting = { ...apiSetting };
  const hasBatchPromptReference = hasPromptReferenceField(
    nextApiSetting,
    "batchPromptSlug"
  );
  const hasBatchPromptInlineValue = hasOwn(nextApiSetting, "systemPrompt");
  const batchPromptSlug = getPromptFieldValue(
    nextApiSetting,
    "batchPromptSlug",
    DEFAULT_BATCH_PROMPT_SLUG
  );
  const batchPrompt = findPromptBySlugOrDefault(
    userPrompts,
    batchPromptSlug,
    DEFAULT_BATCH_PROMPT_SLUG
  );

  if (batchPrompt && (hasBatchPromptReference || !hasBatchPromptInlineValue)) {
    nextApiSetting.batchPromptSlug = batchPrompt.slug;
    nextApiSetting.systemPrompt = batchPrompt.systemPrompt;
    nextApiSetting.batchUserPrompt = batchPrompt.userPrompt;
    if (batchPrompt.protocol) {
      nextApiSetting.batchProtocol = batchPrompt.protocol;
    } else {
      delete nextApiSetting.batchProtocol;
    }
  } else if (batchPrompt) {
    if (
      nextApiSetting.batchUserPrompt === undefined &&
      batchPrompt.userPrompt
    ) {
      nextApiSetting.batchUserPrompt = batchPrompt.userPrompt;
    }
    if (!nextApiSetting.batchProtocol && batchPrompt.protocol) {
      nextApiSetting.batchProtocol = batchPrompt.protocol;
    }
  }

  const hasNobatchPromptReference = hasPromptReferenceField(
    nextApiSetting,
    "nobatchPromptSlug"
  );
  const hasNobatchPromptInlineValue =
    hasOwn(nextApiSetting, "nobatchPrompt") ||
    hasOwn(nextApiSetting, "nobatchUserPrompt");
  const nobatchPromptSlug = getPromptFieldValue(
    nextApiSetting,
    "nobatchPromptSlug",
    DEFAULT_NOBATCH_PROMPT_SLUG
  );
  const nobatchPrompt = findPromptBySlugOrDefault(
    userPrompts,
    nobatchPromptSlug,
    DEFAULT_NOBATCH_PROMPT_SLUG
  );

  if (
    nobatchPrompt &&
    (hasNobatchPromptReference || !hasNobatchPromptInlineValue)
  ) {
    nextApiSetting.nobatchPromptSlug = nobatchPrompt.slug;
    nextApiSetting.nobatchPrompt = nobatchPrompt.systemPrompt;
    nextApiSetting.nobatchUserPrompt = nobatchPrompt.userPrompt;
  }

  const useGlobalSubtitlePrompt =
    subtitleSetting?.segPromptMode === PROMPT_MODE_GLOBAL;
  const hasSubtitlePromptReference = hasPromptReferenceField(
    nextApiSetting,
    "subtitlePromptSlug"
  );
  const hasSubtitlePromptInlineValue = hasOwn(nextApiSetting, "subtitlePrompt");
  const subtitlePromptSlug = useGlobalSubtitlePrompt
    ? getPromptFieldValue(
        subtitleSetting,
        "segPromptSlug",
        DEFAULT_SUBTITLE_PROMPT_SLUG
      )
    : getPromptFieldValue(
        nextApiSetting,
        "subtitlePromptSlug",
        DEFAULT_SUBTITLE_PROMPT_SLUG
      );
  const subtitlePrompt = findPromptBySlugOrDefault(
    userPrompts,
    subtitlePromptSlug,
    DEFAULT_SUBTITLE_PROMPT_SLUG
  );

  if (
    subtitlePrompt &&
    (useGlobalSubtitlePrompt ||
      hasSubtitlePromptReference ||
      !hasSubtitlePromptInlineValue)
  ) {
    if (!useGlobalSubtitlePrompt) {
      nextApiSetting.subtitlePromptSlug = subtitlePrompt.slug;
    }
    nextApiSetting.subtitlePrompt = subtitlePrompt.systemPrompt;
  }

  const hasDictPromptReference = hasPromptReferenceField(
    nextApiSetting,
    "dictPromptSlug"
  );
  const hasDictPromptInlineValue =
    hasOwn(nextApiSetting, "dictPrompt") ||
    hasOwn(nextApiSetting, "dictUserPrompt");
  const dictPromptSlug = getPromptFieldValue(
    nextApiSetting,
    "dictPromptSlug",
    DEFAULT_DICTIONARY_PROMPT_SLUG
  );
  const dictPrompt = findPromptBySlugOrDefault(
    userPrompts,
    dictPromptSlug,
    DEFAULT_DICTIONARY_PROMPT_SLUG
  );

  if (dictPrompt && (hasDictPromptReference || !hasDictPromptInlineValue)) {
    nextApiSetting.dictPromptSlug = dictPrompt.slug;
    nextApiSetting.dictPrompt = dictPrompt.systemPrompt;
    nextApiSetting.dictUserPrompt = dictPrompt.userPrompt;
  }

  return nextApiSetting;
}

/**
 * 批量解析 API 列表中的提示词配置。
 * 遍历所有 API，逐个调用 resolveApiPromptSettings，返回展开实际提示词文本后的新数组。
 *
 * @param {Array} transApis 接口配置列表
 * @param {Array} userPrompts 用户自定义提示词列表
 * @param {Object} subtitleSetting 字幕配置
 * @returns {Array} 解析后的接口配置列表
 */
export function resolveApiPromptList(
  transApis = [],
  userPrompts = [],
  subtitleSetting = {}
) {
  return (Array.isArray(transApis) ? transApis : []).map((api) =>
    resolveApiPromptSettings(api, userPrompts, subtitleSetting)
  );
}

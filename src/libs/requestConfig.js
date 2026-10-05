import { getCacheDigest } from "./cacheDigest";

/** 缓存签名盐。字段集合变化时递增，避免新旧指纹撞车。 */
export const REQUEST_CONFIG_SALT = "request-config-v1";

/**
 * 进入指纹的请求配置。
 * 这些字段会改变实际请求目标或模型输出。提示词、语气、术语表已由 promptSig 覆盖。
 * API Key 故意不在此列：它只用于鉴权，多 Key 轮询还会在单次请求时才选定具体密钥。
 */
export const REQUEST_CONFIG_FIELDS = [
  "apiSlug",
  "apiType",
  "model",
  "url",
  "temperature",
  "maxTokens",
  "thinkingMode",
  "thinkingEffort",
  "region",
  "folderId",
  "customHeader",
  "customBody",
  "reqHook",
  "resHook",
  "useContext",
  "contextSize",
];

const BOOLEAN_FIELDS = new Set(["useContext"]);
const MIN_SECRET_LENGTH = 8;

const collectSecrets = (key) => {
  const secrets = String(key ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= MIN_SECRET_LENGTH);

  return [...new Set(secrets)].sort(
    (left, right) => right.length - left.length
  );
};

const encodeField = (field, value) => {
  if (BOOLEAN_FIELDS.has(field)) {
    return value ? "1" : "0";
  }
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return JSON.stringify(value);
};

const redactSecrets = (text, secrets) => {
  let redacted = text;
  for (const secret of secrets) {
    if (!redacted.includes(secret)) continue;
    redacted = redacted.split(secret).join("");
  }
  return redacted;
};

/**
 * 构造稳定的请求配置原文。
 * 自由文本字段里出现的密钥会被去掉，避免摘要原文或后台代算消息携带密钥。
 * @param {Object} [apiSetting]
 * @returns {string}
 */
export const buildRequestConfigPayload = (apiSetting = {}) => {
  const secrets = collectSecrets(apiSetting.key);
  const source = {
    ...apiSetting,
    // 上下文关闭时历史条数不会进入请求，避免只改这个数字就拆散缓存。
    contextSize: apiSetting.useContext ? apiSetting.contextSize : "",
  };
  const entries = REQUEST_CONFIG_FIELDS.map((field) => [
    field,
    redactSecrets(encodeField(field, source[field]), secrets),
  ]);
  return JSON.stringify(entries);
};

/**
 * 请求配置指纹。只返回摘要前 16 位，调用方把它放进缓存键或批队列键。
 * @param {Object} [apiSetting]
 * @returns {Promise<string>}
 */
export const getRequestConfigSig = async (apiSetting = {}) =>
  (
    await getCacheDigest(
      buildRequestConfigPayload(apiSetting),
      REQUEST_CONFIG_SALT
    )
  ).slice(0, 16);

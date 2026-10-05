/**
 * 规则脚本的来源与执行边界。
 * 远程订阅可以继续保存 injectJs / hook 文本，但这些字段默认不执行。
 * 个人规则仍执行；传进沙盒的接口信息只保留不含密钥的窄字段。
 */

export const SCRIPT_SOURCE_PERSONAL = "personal";
export const SCRIPT_SOURCE_SUBSCRIPTION = "subscription";
export const SCRIPT_SOURCE_BUILTIN = "builtin";

/** 会在规则层被当成脚本执行，或与 hook 同类的字段。 */
export const RULE_SCRIPT_FIELDS = [
  "injectJs",
  "transStartHook",
  "transEndHook",
  "transRemoveHook",
  "reqHook",
  "resHook",
  "fixerFunc",
];

const NARROW_API_FIELDS = ["apiSlug", "apiName", "apiType", "model", "url"];
const START_HOOK_RESULT_FIELDS = [
  "text",
  "fromLang",
  "toLang",
  "glossary",
  "onStreamChunk",
  "textFormat",
  "translateVariants",
];
const SECRET_FIELD_NAMES = new Set([
  "key",
  "apikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "secret",
  "clientsecret",
  "password",
  "passwd",
  "credential",
  "credentials",
  "authorization",
  "privatekey",
  "secretkey",
  "sessionkey",
  "appsecret",
  "appkey",
  "bearertoken",
]);
const SECRET_QUERY_NAMES =
  /^(?:key|api[_-]?key|token|access[_-]?token|refresh[_-]?token|secret|password|auth|authorization|client[_-]?secret)$/i;
const MIN_SECRET_LENGTH = 8;

const scriptText = (value) =>
  typeof value === "string" && value.trim() ? value : "";

const normalizeFieldName = (name) =>
  String(name).replace(/[_-]/g, "").toLowerCase();

const collectSecretValues = (apiSetting) => {
  if (!apiSetting || typeof apiSetting !== "object") return [];
  const values = [];
  for (const [name, value] of Object.entries(apiSetting)) {
    if (!SECRET_FIELD_NAMES.has(normalizeFieldName(name))) continue;
    String(value ?? "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= MIN_SECRET_LENGTH)
      .forEach((item) => values.push(item));
  }
  return [...new Set(values)].sort((left, right) => right.length - left.length);
};

const redactUrlSecrets = (url, secrets) => {
  let redacted = url;
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    for (const name of [...parsed.searchParams.keys()]) {
      if (SECRET_QUERY_NAMES.test(name)) parsed.searchParams.delete(name);
    }
    redacted = parsed.toString();
  } catch {
    redacted = url;
  }
  for (const secret of secrets) {
    if (!redacted.includes(secret)) continue;
    redacted = redacted.split(secret).join("");
  }
  return redacted;
};

/**
 * 给一条规则的非空脚本字段打来源。不修改入参。
 * 没有脚本字段时返回原对象，避免给存储中的规则附上来源标记。
 */
export function withScriptSources(rule, source) {
  if (!rule) return rule;
  const scriptFieldOrigins = {};
  for (const field of RULE_SCRIPT_FIELDS) {
    if (scriptText(rule[field])) scriptFieldOrigins[field] = source;
  }
  if (!Object.keys(scriptFieldOrigins).length) return rule;
  return { ...rule, scriptFieldOrigins };
}

/** 高优先级规则里的非空脚本字段覆盖低优先级，文本本身保留。 */
export function mergeRuleScriptFields(merged, overrideRule) {
  if (!overrideRule) return merged;
  for (const field of RULE_SCRIPT_FIELDS) {
    const value = scriptText(overrideRule[field]);
    if (value) merged[field] = value;
  }
  return merged;
}

/**
 * 根据合并结果记录每个脚本字段来自哪一侧。
 * 未标记的覆盖值视为个人/本地规则，只有显式的 subscription 来源会被跳过。
 */
export function assignScriptSources(merged, baseRule, overrideRule) {
  const origins = {};
  const baseOrigins = baseRule?.scriptFieldOrigins || {};
  const overrideOrigins = overrideRule?.scriptFieldOrigins || {};
  for (const field of RULE_SCRIPT_FIELDS) {
    if (!scriptText(merged?.[field])) continue;
    const fromOverride = Boolean(scriptText(overrideRule?.[field]));
    origins[field] = fromOverride
      ? overrideOrigins[field] || SCRIPT_SOURCE_PERSONAL
      : baseOrigins[field] || SCRIPT_SOURCE_PERSONAL;
  }
  if (Object.keys(origins).length) {
    merged.scriptFieldOrigins = origins;
  } else if (
    merged &&
    Object.prototype.hasOwnProperty.call(merged, "scriptFieldOrigins")
  ) {
    delete merged.scriptFieldOrigins;
  }
  return merged;
}

/** 订阅来源的脚本默认不执行。没有来源标记的个人/旧规则保持可执行。 */
export function shouldRunRuleScript(rule, field) {
  if (!RULE_SCRIPT_FIELDS.includes(field)) return false;
  if (!scriptText(rule?.[field])) return false;
  return rule?.scriptFieldOrigins?.[field] !== SCRIPT_SOURCE_SUBSCRIPTION;
}

/**
 * 规则脚本可见的接口信息。只留标识和地址，不传 apiSetting / apisMap，
 * 并去掉 URL 用户信息、密钥查询参数，以及字段值里出现的密钥。
 */
export function narrowApiConfig(apiSetting) {
  if (!apiSetting || typeof apiSetting !== "object") return {};
  const secrets = collectSecretValues(apiSetting);
  const api = {};
  for (const field of NARROW_API_FIELDS) {
    const value = apiSetting[field];
    if (typeof value !== "string" || !value.trim()) continue;
    api[field] =
      field === "url" ? redactUrlSecrets(value.trim(), secrets) : value;
  }
  return api;
}

/** 只采纳翻译文本、语言和词典等结果，忽略 hook 回传的接口对象。 */
export function applyRuleStartHookResult(args, hookResult) {
  if (!hookResult || typeof hookResult !== "object") return args;
  for (const field of START_HOOK_RESULT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(hookResult, field)) {
      args[field] = hookResult[field];
    }
  }
  return args;
}

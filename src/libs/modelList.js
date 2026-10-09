import {
  DASHSCOPE_NATIVE_MODELS_URL,
  OPT_TRANS_CLAUDE,
  OPT_TRANS_GEMINI,
} from "../config/api";
import { fetchHandle, fnPolyfill } from "./request";

// 模型列表 URL 中可显式放置该占位符；存在占位符时不会额外注入 Authorization 头。
const MODEL_KEY_PLACEHOLDER = "{{key}}";

/**
 * 判断 URL 是否为 Google Gemini 原生模型列表端点。
 *
 * 原生端点（如 `https://generativelanguage.googleapis.com/v1beta/models`）使用
 * `?key=...` 鉴权，而不使用 `Authorization: Bearer`。
 *
 * @param {string} url 待检验的 URL。
 * @returns {boolean} 是否为 Gemini 原生模型列表 URL。
 */
const GEMINI_NATIVE_MODELS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const isGeminiNativeModelListUrl = (url = "") =>
  /^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta\d*)?\/models(?:[/?]|$)/i.test(
    url
  ) && !/\/openai\//i.test(url);

/**
 * 原生 Gemini 的对话地址和模型目录不是同一条路径。
 * 官方域名收成 v1beta/models；自定义代理去掉 generateContent 或 interactions 后缀。
 *
 * @param {string} url 用户填写的 Gemini 接口地址
 * @returns {string} 模型目录地址
 */
const resolveGeminiCatalogUrl = (url = "") => {
  const trimmed = String(url || "").trim();
  if (!trimmed || isGeminiNativeModelListUrl(trimmed)) return trimmed;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (/(^|\.)generativelanguage\.googleapis\.com$/i.test(parsed.hostname)) {
    return GEMINI_NATIVE_MODELS_URL;
  }

  const generateContent = parsed.pathname.match(
    /^(.*)\/models\/[^/]+:generateContent$/i
  );
  if (generateContent) {
    parsed.pathname = `${generateContent[1]}/models`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  if (/\/interactions$/i.test(path)) {
    parsed.pathname = path.replace(/\/interactions$/i, "/models");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  }

  return trimmed;
};

/**
 * 去掉 Gemini 原生模型列表返回的资源名前缀。
 *
 * Gemini `models.list` 返回的 `name` 通常是 `models/gemini-xxx`，但生成接口里
 * 实际填写的是 `gemini-xxx`，因此下拉选项需要展示可直接用于配置的模型 ID。
 *
 * @param {string} model 原始模型名称。
 * @returns {string} 去除 `models/` 前缀后的模型名称。
 */
const stripGeminiModelPrefix = (model) =>
  typeof model === "string" && model.startsWith("models/")
    ? model.slice("models/".length)
    : model;

/**
 * 标准化模型名并追加到结果列表，同时保持原始返回顺序和去重。
 *
 * @param {string[]} models 已收集的模型名称列表。
 * @param {Set<string>} seen 已出现过的模型名称集合。
 * @param {unknown} model 候选模型名称。
 * @returns {void}
 */
const addUniqueModel = (models, seen, model) => {
  const normalizedModel = stripGeminiModelPrefix(
    typeof model === "string" ? model.trim() : ""
  );

  // 空字符串或重复模型不进入下拉列表，避免出现无效选项。
  if (!normalizedModel || seen.has(normalizedModel)) {
    return;
  }

  seen.add(normalizedModel);
  models.push(normalizedModel);
};

/**
 * 从不同供应商的模型列表响应中提取可填入 `model` 字段的模型名称。
 *
 * 目前兼容三类常见结构：
 * - OpenAI 兼容接口：`{ data: [{ id: "model-id" }] }`
 * - Gemini 原生接口：`{ models: [{ name: "models/xxx", baseModelId: "xxx" }] }`
 * - Ollama 本地接口：`{ models: [{ name: "model:tag" }] }`
 *
 * @param {unknown} data 模型列表接口返回的 JSON 数据。
 * @returns {string[]} 标准化、去重后的模型名称列表。
 */
export function parseModelCatalogResponse(data) {
  if (!data || typeof data !== "object") {
    return { models: [], thinkingCapabilities: {} };
  }

  const models = [];
  const thinkingCapabilities = {};
  const seen = new Set();
  // 兼容 OpenAI-compatible 的 `data` 和 Gemini/Ollama 的 `models` 两种列表字段。
  const lists = [data.data, data.models].filter(Array.isArray);

  lists.forEach((list) => {
    list.forEach((item) => {
      if (typeof item === "string") {
        addUniqueModel(models, seen, item);
        return;
      }

      // 部分接口可能混入 null 或非对象项，直接忽略即可。
      if (!item || typeof item !== "object") {
        return;
      }

      // 每条记录只对应一个可填入 `model` 的值。OpenRouter 等接口会同时返回
      // `id`（请求使用的模型 ID）和 `name`（展示标题），因此必须优先选择
      // `id`，不能把同一模型的多个描述字段都展开成下拉选项。
      const model = [item.id, item.name, item.baseModelId].find(
        (value) => typeof value === "string" && value.trim()
      );
      addUniqueModel(models, seen, model);

      const normalizedModel = stripGeminiModelPrefix(model?.trim?.() || "");
      if (
        normalizedModel &&
        item.reasoning &&
        typeof item.reasoning === "object"
      ) {
        // OpenRouter 会在 Models API 中动态公布各模型的推理等级和强制推理状态。
        // 这里只保留请求规范化需要的字段，避免把整条易变的模型记录写入设置。
        const rawEfforts = item.reasoning.supported_efforts;
        const supportedEfforts =
          rawEfforts === null
            ? ["max", "xhigh", "high", "medium", "low", "minimal"]
            : Array.isArray(rawEfforts)
              ? rawEfforts
              : [];
        if (supportedEfforts.length) {
          thinkingCapabilities[normalizedModel] = {
            model: normalizedModel,
            supportedEfforts,
            defaultEffort: item.reasoning.default_effort,
            defaultEnabled: item.reasoning.default_enabled,
            mandatory: item.reasoning.mandatory === true,
          };
        }
      }
    });
  });

  return { models, thinkingCapabilities };
}

export function parseModelListResponse(data) {
  return parseModelCatalogResponse(data).models;
}

/**
 * 给 URL 追加或覆盖一个 query 参数。
 *
 * 优先使用标准 `URL` API 处理绝对 URL；如果用户填写的是非标准 URL 片段，
 * 则回退到字符串拼接，尽量不阻塞用户自定义地址。
 *
 * @param {string} url 原始 URL。
 * @param {string} name 参数名。
 * @param {string} value 参数值。
 * @returns {string} 追加参数后的 URL。
 */
const appendQueryParam = (url, name, value) => {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set(name, value);
    return parsedUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${encodeURIComponent(name)}=${encodeURIComponent(
      value
    )}`;
  }
};

/**
 * 根据 API 类型和用户配置生成模型列表请求参数。
 *
 * 鉴权规则：
 * - URL 包含 `{{key}}` 时，将 key 写入 URL，不再添加请求头，兼容特殊服务。
 * - Gemini 原生模型列表使用 `?key=...` 鉴权。
 * - 其他接口默认使用 OpenAI 兼容的 `Authorization: Bearer ...`。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.apiType 当前 API 类型。
 * @param {string} params.modelListUrl 模型列表接口地址。
 * @param {string} params.key API Key。
 * @returns {{input: string, init: Object}|null} 可传给请求层的参数；配置不足时返回 null。
 */
export function createModelListRequest({ apiType, modelListUrl, key }) {
  let trimmedUrl = (modelListUrl || "").trim();
  const trimmedKey = (key || "").trim();
  if (apiType === OPT_TRANS_GEMINI) {
    trimmedUrl = resolveGeminiCatalogUrl(trimmedUrl);
  }

  // 用户没有同时配置模型列表 URL 和 Key 时，不发起网络请求。
  if (!trimmedUrl || !trimmedKey) {
    return null;
  }

  // 显式占位符优先，允许用户自行决定 key 位于 path、query 或其他自定义位置。
  if (trimmedUrl.includes(MODEL_KEY_PLACEHOLDER)) {
    return {
      input: trimmedUrl.replaceAll(
        MODEL_KEY_PLACEHOLDER,
        encodeURIComponent(trimmedKey)
      ),
      init: {
        method: "GET",
      },
    };
  }

  // Google Gemini 原生 REST API 不使用 Bearer header，而是通过 key query 参数鉴权。
  if (apiType === OPT_TRANS_GEMINI || isGeminiNativeModelListUrl(trimmedUrl)) {
    return {
      input: appendQueryParam(trimmedUrl, "key", trimmedKey),
      init: {
        method: "GET",
      },
    };
  }

  // Anthropic Models API 使用 x-api-key，而不是 OpenAI Bearer。
  if (apiType === OPT_TRANS_CLAUDE) {
    const [input] = buildAnthropicModelListUrls(trimmedUrl);
    if (!input) return null;
    return {
      input,
      init: {
        method: "GET",
        headers: anthropicModelListHeaders(trimmedKey),
      },
    };
  }

  // DashScope 一律走原生模型目录，不用 compatible-mode 冒充。
  const dashscopeUrl = resolveDashscopeNativeModelListUrl(trimmedUrl);
  if (dashscopeUrl) {
    return {
      input: dashscopeUrl,
      init: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
        },
      },
    };
  }

  // OpenAI 兼容：对话地址或 API 根都会收成 `{base}/models`。
  return {
    input: resolveOpenAIModelListUrl(trimmedUrl),
    init: {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
      },
    },
  };
}

export const ANTHROPIC_VERSION = "2023-06-01";
export const DASHSCOPE_MODEL_PAGE_SIZE = 100;
export const DASHSCOPE_MODEL_PAGE_LIMIT = 50;

/**
 * Anthropic 模型列表请求头。
 * @param {string} key API Key
 * @returns {Object} 请求头
 */
export function anthropicModelListHeaders(key) {
  return {
    "x-api-key": key,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

/**
 * 生成 Anthropic 模型列表候选地址。
 * 地址里已经包含 `/v1` 时直接请求（必要时补上 `/models`）。
 * 不含 `/v1` 时先试 `{base}/v1/models`，由调用方在 404 时再试 `{base}/models`。
 *
 * @param {string} modelListUrl 用户填写的模型列表地址或 API 根地址
 * @returns {string[]} 按尝试顺序排列的 URL
 */
export function buildAnthropicModelListUrls(modelListUrl = "") {
  const base = String(modelListUrl || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/messages$/i, "")
    .replace(/\/chat\/completions$/i, "");
  if (!base) return [];

  const hasV1 = /\/v1(?:\/|$)/i.test(base);
  const hasModels = /\/models(?:\/|$)/i.test(base);
  if (hasV1) {
    return [hasModels ? base : `${base}/models`];
  }

  const root = base.replace(/\/models$/i, "");
  return [`${root}/v1/models`, `${root}/models`];
}

/**
 * 判断是否为 DashScope 原生模型目录（不是 compatible-mode）。
 * @param {string} url 模型列表 URL
 * @returns {boolean}
 */
export function isDashscopeNativeModelListUrl(url = "") {
  return /https?:\/\/dashscope\.aliyuncs\.com\/api\/v1\/models(?:[/?#]|$)/i.test(
    String(url || "").trim()
  );
}

const stripTrailingSlashes = (pathname = "") =>
  String(pathname || "").replace(/\/+$/, "");

/**
 * 识别 OpenAI 兼容服务的路径形态。
 * origin 和以 `/v1` 结尾的根地址需要补全；已经指向对话或模型列表的地址保持原样。
 *
 * @param {string} pathname URL pathname
 * @returns {"origin"|"v1"|"chat"|"models"|"other"}
 */
const classifyOpenAIServicePath = (pathname = "") => {
  const path = stripTrailingSlashes(pathname) || "/";
  if (path === "/") return "origin";
  if (/\/chat\/completions$/i.test(path)) return "chat";
  if (/\/models$/i.test(path)) return "models";
  if (/\/v1$/i.test(path)) return "v1";
  return "other";
};

/**
 * 把用户填写的服务根地址补成 OpenAI 兼容对话地址。
 * `http://host:4000` 和 `http://host:4000/v1` 都会变成 `.../v1/chat/completions`。
 * 已经是完整对话地址，或带有其它路径的地址，保持原样。
 *
 * @param {string} url 用户填写的接口地址
 * @returns {string} 可用于 chat completions 的地址
 */
export function resolveOpenAIChatCompletionsUrl(url = "") {
  const trimmed = String(url || "").trim();
  if (!trimmed || trimmed.includes(MODEL_KEY_PLACEHOLDER)) return trimmed;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const kind = classifyOpenAIServicePath(parsed.pathname);
  if (kind === "chat" || kind === "other") return trimmed;

  const path = stripTrailingSlashes(parsed.pathname).replace(/\/v1$/i, "/v1");
  if (kind === "origin") parsed.pathname = "/v1/chat/completions";
  else if (kind === "v1") parsed.pathname = `${path}/chat/completions`;
  else parsed.pathname = `${path.replace(/\/models$/i, "")}/chat/completions`;
  return parsed.toString();
}

/**
 * 把 OpenAI 兼容的对话地址或 API 根收成模型列表地址。
 * 裸主机补成 `/v1/models`，以 `/v1` 结尾的地址补成 `{path}/models`。
 * 不含 `/v1` 的 `/chat/completions`（如 DeepSeek）仍收成 `/models`。
 * 已经以 `/models` 结尾的地址保持不变。
 *
 * @param {string} modelListUrl 模型列表地址、API 根或 chat completions 地址
 * @returns {string} 模型列表地址
 */
export function resolveOpenAIModelListUrl(modelListUrl = "") {
  const trimmed = String(modelListUrl || "").trim();
  if (!trimmed || trimmed.includes(MODEL_KEY_PLACEHOLDER)) return trimmed;

  const applyPath = (pathname) => {
    let next = stripTrailingSlashes(pathname);
    const wasChat = /\/chat\/completions$/i.test(next);
    if (wasChat) next = next.replace(/\/chat\/completions$/i, "");
    if (!next) return wasChat ? "/models" : "/v1/models";
    next = next.replace(/\/v1$/i, "/v1");
    if (/\/models$/i.test(next)) return next;
    return `${next}/models`;
  };

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = applyPath(parsed.pathname);
    return parsed.toString();
  } catch {
    return applyPath(trimmed);
  }
}

/**
 * DashScope 模型目录固定走原生 `GET /api/v1/models`。
 * compatible-mode 或同主机上的对话地址都改写成原生目录；其它主机返回空串。
 *
 * @param {string} modelListUrl 用户填写的地址
 * @returns {string} 原生目录地址；不是 DashScope 时返回空串
 */
export function resolveDashscopeNativeModelListUrl(modelListUrl = "") {
  const trimmed = String(modelListUrl || "").trim();
  if (!/^https?:\/\/dashscope\.aliyuncs\.com\//i.test(trimmed)) return "";
  if (isDashscopeNativeModelListUrl(trimmed)) return trimmed;
  return DASHSCOPE_NATIVE_MODELS_URL;
}

/**
 * 从错误对象中读取 HTTP 状态码。统一请求层把非 2xx 编成 JSON 字符串。
 * @param {unknown} error 请求错误
 * @returns {number} 状态码；无法识别时返回 0
 */
export function httpStatusFromError(error) {
  const message = String(error?.message || error || "");
  try {
    const parsed = JSON.parse(message);
    const status = Number(parsed?.status);
    if (Number.isFinite(status)) return status;
  } catch {
    // 非 JSON 错误继续用正则兜底。
  }
  const matched = message.match(/"status"\s*:\s*(\d+)/);
  return matched ? Number(matched[1]) : 0;
}

const dashscopeModelId = (item) => {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  const value = [item.model, item.model_name, item.name, item.id].find(
    (field) => typeof field === "string" && field.trim()
  );
  return value ? value.trim() : "";
};

/**
 * 解析 DashScope 原生模型目录的一页结果。
 * 只读取 `output.models`，字段优先级为 model、model_name、name、id。
 *
 * @param {unknown} data 单页 JSON
 * @returns {{models: string[], total: number|null}} 本页模型 ID 与总数
 */
export function parseDashscopeModelsPage(data) {
  const output =
    data &&
    typeof data === "object" &&
    data.output &&
    typeof data.output === "object"
      ? data.output
      : null;
  const rows = Array.isArray(output?.models) ? output.models : [];
  const models = [];
  const seen = new Set();
  rows.forEach((item) => {
    const modelId = dashscopeModelId(item);
    if (!modelId || seen.has(modelId)) return;
    seen.add(modelId);
    models.push(modelId);
  });

  const totalValue = Number(output?.total ?? output?.total_count);
  return {
    models,
    total: Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : null,
  };
}

/**
 * 按 page_no / page_size 拉完 DashScope 模型目录。
 * @param {Function} fetchPage 拉取单页，参数为 { pageNo, pageSize }
 * @param {Object} [options]
 * @param {number} [options.pageSize]
 * @param {number} [options.pageLimit]
 * @returns {Promise<string[]>} 去重后的模型 ID
 */
export async function collectDashscopeModelIds(
  fetchPage,
  {
    pageSize = DASHSCOPE_MODEL_PAGE_SIZE,
    pageLimit = DASHSCOPE_MODEL_PAGE_LIMIT,
  } = {}
) {
  const models = [];
  const seen = new Set();

  for (let pageNo = 1; pageNo <= pageLimit; pageNo += 1) {
    const data = await fetchPage({ pageNo, pageSize });
    const page = parseDashscopeModelsPage(data);
    if (!page.models.length) break;

    let added = 0;
    page.models.forEach((modelId) => {
      if (seen.has(modelId)) return;
      seen.add(modelId);
      models.push(modelId);
      added += 1;
    });

    const reachedTotal = page.total !== null && models.length >= page.total;
    const shortPage = page.models.length < pageSize;
    if (reachedTotal || added === 0) break;
    // 未声明总数时，短页就是最后一页；声明了总数但本页不满，继续向后翻。
    if (shortPage && page.total === null) break;
  }

  return models;
}

/**
 * 拉取并解析当前 API 配置对应的模型列表。
 *
 * 这里使用项目统一的普通请求代理层，确保 WebExtension、userscript、background
 * 等运行环境都能复用已有的跨域、超时和错误解析逻辑。
 *
 * @param {Object} params 参数对象。
 * @param {string} params.apiType 当前 API 类型。
 * @param {string} params.modelListUrl 模型列表接口地址。
 * @param {string} params.key API Key。
 * @param {number} [params.httpTimeout] 请求超时时间配置。
 * @returns {Promise<string[]>} 可用于模型下拉选项的模型名称列表。
 */
export async function fetchModelCatalog({
  apiType,
  modelListUrl,
  key,
  httpTimeout,
}) {
  const request = createModelListRequest({ apiType, modelListUrl, key });

  if (!request) {
    return { models: [], thinkingCapabilities: {} };
  }

  const fetchJson = (input, init) =>
    fnPolyfill({
      fn: fetchHandle,
      input,
      init,
      opts: {
        httpTimeout,
        // 模型列表接口按 JSON 响应处理，非 JSON 或 HTTP 错误交给统一请求层抛错。
        expect: "json",
      },
    });

  if (apiType === OPT_TRANS_CLAUDE) {
    const urls = buildAnthropicModelListUrls(modelListUrl);
    let lastError;
    for (let index = 0; index < urls.length; index += 1) {
      try {
        const data = await fetchJson(urls[index], request.init);
        return parseModelCatalogResponse(data);
      } catch (error) {
        lastError = error;
        const canTryNext =
          index < urls.length - 1 && httpStatusFromError(error) === 404;
        if (!canTryNext) throw error;
      }
    }
    throw lastError;
  }

  if (isDashscopeNativeModelListUrl(request.input)) {
    const models = await collectDashscopeModelIds(({ pageNo, pageSize }) =>
      fetchJson(
        appendQueryParam(
          appendQueryParam(request.input, "page_no", String(pageNo)),
          "page_size",
          String(pageSize)
        ),
        request.init
      )
    );
    return { models, thinkingCapabilities: {} };
  }

  const data = await fetchJson(request.input, request.init);
  return parseModelCatalogResponse(data);
}

// 兼容只消费字符串模型 ID 的现有调用方。
export async function fetchModelList(params) {
  const catalog = await fetchModelCatalog(params);
  return catalog.models;
}

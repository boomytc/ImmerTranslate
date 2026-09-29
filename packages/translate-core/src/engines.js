/**
 * OpenAI-compatible and Anthropic-compatible translate engines.
 * Callers pass apiKey / baseUrl / model at runtime. Nothing here is persisted.
 *
 * @typedef {import('./types.js').TranslateRequest} TranslateRequest
 * @typedef {import('./types.js').TranslateResponse} TranslateResponse
 * @typedef {import('./types.js').TranslateEngine} TranslateEngine
 */

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * @param {unknown} apiKey
 * @returns {string}
 */
function requireApiKey(apiKey) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("apiKey is required");
  }
  return apiKey.trim();
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function normalizeBase(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  return (raw || fallback).replace(/\/+$/, "");
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function normalizeModel(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || fallback;
}

/**
 * @param {TranslateRequest} req
 */
function assertRequest(req) {
  if (!req || !Array.isArray(req.segments)) {
    throw new Error("TranslateRequest.segments must be an array");
  }
}

/**
 * @param {TranslateRequest} req
 */
function instructionFor(req) {
  const source = req.sourceLang || "auto";
  const target = req.targetLang || "zh-CN";
  return [
    "You are a translation engine.",
    `Source language: ${source}. Target language: ${target}.`,
    "If the source language is auto, detect it per segment.",
    "Translate each segment. Preserve meaning. Do not add commentary.",
    'Reply with ONLY a JSON array of {"id":string,"text":string} using the same ids.',
    "No markdown fences.",
  ].join(" ");
}

/**
 * @param {TranslateRequest} req
 */
function userPayload(req) {
  return JSON.stringify(
    req.segments.map((segment) => ({
      id: segment.id,
      text: segment.text == null ? "" : String(segment.text),
    }))
  );
}

/**
 * @param {string} text
 * @returns {Array<{ id?: string, text?: string, error?: string }>}
 */
function extractJsonArray(text) {
  let body = String(text ?? "").replace(/^\uFEFF/, "").trim();
  const fence = body.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) body = fence[1].trim();

  const parsed = parseJsonArray(body);
  if (parsed) return parsed;

  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start !== -1 && end > start) {
    const sliced = parseJsonArray(body.slice(start, end + 1));
    if (sliced) return sliced;
  }
  throw new Error("model output is not a JSON array");
}

/**
 * @param {string} body
 * @returns {Array<{ id?: string, text?: string, error?: string }> | null}
 */
function parseJsonArray(body) {
  try {
    const value = JSON.parse(body);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {TranslateRequest} req
 * @param {Array<{ id?: string, text?: string, error?: string }>} items
 * @returns {TranslateResponse}
 */
function mapSegments(req, items) {
  /** @type {Map<string, { id?: string, text?: string, error?: string }>} */
  const byId = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object" || item.id == null) continue;
    byId.set(String(item.id), item);
  }
  return {
    segments: req.segments.map((segment) => {
      const hit = byId.get(String(segment.id));
      if (!hit) {
        return { id: segment.id, text: "", error: "missing translation" };
      }
      const text = hit.text == null ? "" : String(hit.text);
      if (hit.error) {
        return { id: segment.id, text, error: String(hit.error) };
      }
      return { id: segment.id, text };
    }),
  };
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") {
          if (part.type && part.type !== "text") return "";
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * @param {string} url
 * @param {{ headers: Record<string, string>, body: unknown, fetchImpl?: typeof fetch }} opts
 */
async function postJson(url, opts) {
  const fetchFn = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("fetch is not available");
  }
  const res = await fetchFn(url, {
    method: "POST",
    headers: opts.headers,
    body: JSON.stringify(opts.body),
  });
  const raw = await res.text();
  /** @type {any} */
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  }
  if (!res.ok) {
    const detail = data?.error?.message || data?.error || data?.raw || res.statusText || "request failed";
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`translate HTTP ${res.status}: ${message.slice(0, 300)}`);
  }
  return data;
}

/**
 * @param {TranslateRequest} req
 * @param {string} modelText
 * @returns {TranslateResponse}
 */
function responseFromModelText(req, modelText) {
  if (!String(modelText || "").trim()) {
    throw new Error("model output is empty");
  }
  return mapSegments(req, extractJsonArray(modelText));
}

/**
 * @param {{ apiKey: string, baseUrl?: string, model?: string, fetchImpl?: typeof fetch }} opts
 * @returns {TranslateEngine}
 */
export function createOpenAICompatibleEngine(opts = {}) {
  const apiKey = requireApiKey(opts.apiKey);
  const baseUrl = normalizeBase(opts.baseUrl, DEFAULT_OPENAI_BASE_URL);
  const model = normalizeModel(opts.model, DEFAULT_OPENAI_MODEL);
  const fetchImpl = opts.fetchImpl;

  return async function openaiCompatibleEngine(req) {
    assertRequest(req);
    if (req.segments.length === 0) return { segments: [] };

    const data = await postJson(`${baseUrl}/chat/completions`, {
      fetchImpl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model,
        temperature: 0,
        stream: false,
        messages: [
          { role: "system", content: instructionFor(req) },
          { role: "user", content: userPayload(req) },
        ],
      },
    });

    const content = data?.choices?.[0]?.message?.content;
    return responseFromModelText(req, textFromContent(content));
  };
}

/**
 * Messages URL: `{base}/v1/messages`, or `{base}/messages` when base already ends in `/v1`.
 * @param {string} baseUrl
 */
function anthropicMessagesUrl(baseUrl) {
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/messages`;
  return `${baseUrl}/v1/messages`;
}

/**
 * @param {{ apiKey: string, baseUrl?: string, model?: string, fetchImpl?: typeof fetch }} opts
 * @returns {TranslateEngine}
 */
export function createAnthropicCompatibleEngine(opts = {}) {
  const apiKey = requireApiKey(opts.apiKey);
  const baseUrl = normalizeBase(opts.baseUrl, DEFAULT_ANTHROPIC_BASE_URL);
  const model = normalizeModel(opts.model, DEFAULT_ANTHROPIC_MODEL);
  const fetchImpl = opts.fetchImpl;
  const url = anthropicMessagesUrl(baseUrl);

  return async function anthropicCompatibleEngine(req) {
    assertRequest(req);
    if (req.segments.length === 0) return { segments: [] };

    const data = await postJson(url, {
      fetchImpl,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: {
        model,
        max_tokens: 4096,
        temperature: 0,
        system: instructionFor(req),
        messages: [{ role: "user", content: userPayload(req) }],
      },
    });

    const blocks = Array.isArray(data?.content) ? data.content : [];
    const text = blocks
      .filter((block) => block && block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    return responseFromModelText(req, text);
  };
}

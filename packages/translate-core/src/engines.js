/**
 * OpenAI-compatible and Anthropic-compatible translate engines.
 * Callers pass apiKey / baseUrl / model at runtime. Nothing here is persisted.
 * Upstream failures reject with TranslateFailure (message, kind, code, status).
 *
 * @typedef {import('./types.js').TranslateRequest} TranslateRequest
 * @typedef {import('./types.js').TranslateResponse} TranslateResponse
 * @typedef {import('./types.js').TranslateEngine} TranslateEngine
 */

import { TranslateFailure } from "./errors.js";

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
  throw new TranslateFailure("model output is not a JSON array", {
    kind: "output",
    code: "invalid_output",
  });
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
 * @param {unknown} value
 * @returns {string}
 */
function shortCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 80);
}

/**
 * @param {unknown} err
 * @returns {TranslateFailure}
 */
function networkFailure(err) {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  const message = err instanceof Error ? err.message : String(err ?? "request failed");
  return new TranslateFailure(`translate network: ${message.slice(0, 300)}`, {
    kind: "network",
    code: name === "AbortError" ? "abort" : "network",
    cause: err,
  });
}

/**
 * @param {Response} res
 * @param {any} data
 * @returns {TranslateFailure}
 */
function failureFromResponse(res, data) {
  const status = res.status;
  const errorBody = data && typeof data === "object" ? data.error : undefined;
  const hasProvider = errorBody != null && errorBody !== "";
  /** @type {string} */
  let providerCode = "";
  /** @type {string} */
  let detail = "";

  if (errorBody && typeof errorBody === "object") {
    providerCode = shortCode(errorBody.code) || shortCode(errorBody.type);
    if (typeof errorBody.message === "string" && errorBody.message.trim()) {
      detail = errorBody.message.trim();
    } else {
      detail = JSON.stringify(errorBody);
    }
  } else if (typeof errorBody === "string" && errorBody.trim()) {
    detail = errorBody.trim();
  } else if (data && typeof data.raw === "string" && data.raw.trim()) {
    detail = data.raw.trim();
  } else if (typeof res.statusText === "string" && res.statusText.trim()) {
    detail = res.statusText.trim();
  } else {
    detail = "request failed";
  }

  return new TranslateFailure(`translate HTTP ${status}: ${detail.slice(0, 300)}`, {
    kind: hasProvider ? "provider" : "http",
    code: providerCode || `http_${status}`,
    status,
  });
}

/**
 * @param {string} url
 * @param {{ headers: Record<string, string>, body: unknown, fetchImpl?: typeof fetch }} opts
 */
async function postJson(url, opts) {
  const fetchFn = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new TranslateFailure("fetch is not available", {
      kind: "network",
      code: "no_fetch",
    });
  }
  let res;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: opts.headers,
      body: JSON.stringify(opts.body),
    });
  } catch (err) {
    if (err instanceof TranslateFailure) throw err;
    throw networkFailure(err);
  }
  let raw = "";
  try {
    raw = await res.text();
  } catch (err) {
    if (res && res.ok === false) {
      throw new TranslateFailure(`translate HTTP ${res.status}: failed to read body`, {
        kind: "http",
        code: `http_${res.status}`,
        status: res.status,
        cause: err,
      });
    }
    throw networkFailure(err);
  }
  /** @type {any} */
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  }
  if (!res.ok) throw failureFromResponse(res, data);
  return data;
}

/**
 * @param {TranslateRequest} req
 * @param {string} modelText
 * @returns {TranslateResponse}
 */
function responseFromModelText(req, modelText) {
  if (!String(modelText || "").trim()) {
    throw new TranslateFailure("model output is empty", {
      kind: "output",
      code: "empty_output",
    });
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

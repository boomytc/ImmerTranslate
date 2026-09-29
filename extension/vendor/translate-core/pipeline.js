/**
 * Opt-in wrappers around a TranslateEngine.
 * TranslateRequest / TranslateResponse stay unchanged.
 *
 * createPipelineEngine order (outside → in):
 * paragraph cache → retry → rate limit → base engine.
 * A cache hit does not retry or touch the network.
 *
 * @typedef {import('./types.js').TranslateRequest} TranslateRequest
 * @typedef {import('./types.js').TranslateResponse} TranslateResponse
 * @typedef {import('./types.js').TranslateEngine} TranslateEngine
 */

/** @typedef {{ text: string, error?: string }} CacheEntry */

export const pipelineDefaults = Object.freeze({
  cache: Object.freeze({
    maxEntries: 500,
  }),
  retry: Object.freeze({
    retries: 2,
    baseDelayMs: 50,
    factor: 2,
    maxDelayMs: 400,
  }),
  rateLimit: Object.freeze({
    minIntervalMs: 100,
    maxConcurrent: 2,
  }),
});

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function nonNegative(value, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function tag(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Paragraph cache. Key is text + sourceLang + targetLang.
 * provider / model are included when passed, so different models do not share rows.
 * Successful segment text is stored. Thrown errors and segment.error are not.
 * Concurrent misses for the same key share one underlying call.
 *
 * @param {TranslateEngine} engine
 * @param {{
 *   store?: Map<string, string>,
 *   provider?: string,
 *   model?: string,
 *   maxEntries?: number,
 * }} [options]
 * @returns {TranslateEngine}
 */
export function withCache(engine, options = {}) {
  const store = options.store instanceof Map ? options.store : new Map();
  const provider = tag(options.provider);
  const model = tag(options.model);
  const maxEntries = nonNegative(options.maxEntries, pipelineDefaults.cache.maxEntries);
  /** @type {Map<string, Promise<CacheEntry>>} */
  const inflight = new Map();

  /**
   * @param {string} key
   * @param {string} text
   */
  function remember(key, text) {
    if (maxEntries <= 0) return;
    if (store.has(key)) store.delete(key);
    store.set(key, text);
    while (store.size > maxEntries) {
      const oldest = store.keys().next().value;
      store.delete(oldest);
    }
  }

  return async function cachedEngine(req) {
    if (!req || !Array.isArray(req.segments)) return engine(req);
    if (req.segments.length === 0) return engine(req);

    const sourceLang = typeof req.sourceLang === "string" ? req.sourceLang : "";
    const targetLang = typeof req.targetLang === "string" ? req.targetLang : "";

    /** @type {Array<{ id: string, text: string, key: string }>} */
    const rows = [];
    for (const segment of req.segments) {
      if (!segment || typeof segment !== "object") return engine(req);
      rows.push({
        id: segment.id,
        text: segment.text == null ? "" : String(segment.text),
        key: "",
      });
    }
    for (const row of rows) {
      row.key = JSON.stringify([row.text, sourceLang, targetLang, provider, model]);
    }

    /** @type {Array<{ id: string, text: string, error?: string } | undefined>} */
    const out = new Array(rows.length);
    /** @type {Map<string, string>} */
    const missText = new Map();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (store.has(row.key)) {
        out[i] = { id: row.id, text: /** @type {string} */ (store.get(row.key)) };
      } else if (!missText.has(row.key)) {
        missText.set(row.key, row.text);
      }
    }
    if (missText.size === 0) {
      return { segments: /** @type {TranslateResponse["segments"]} */ (out) };
    }

    /** @type {Map<string, Promise<CacheEntry>>} */
    const needed = new Map();
    /** @type {Array<{ key: string, text: string }>} */
    const fresh = [];
    for (const [key, text] of missText) {
      const existing = inflight.get(key);
      if (existing) needed.set(key, existing);
      else fresh.push({ key, text });
    }

    if (fresh.length > 0) {
      /** @type {Map<string, { resolve: (value: CacheEntry) => void, reject: (err: unknown) => void }>} */
      const slots = new Map();
      for (const item of fresh) {
        /** @type {(value: CacheEntry) => void} */
        let resolve;
        /** @type {(err: unknown) => void} */
        let reject;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        inflight.set(item.key, promise);
        needed.set(item.key, promise);
        slots.set(item.key, { resolve, reject });
      }

      const innerReq = {
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
        segments: fresh.map((item, index) => ({ id: `$${index}`, text: item.text })),
      };

      Promise.resolve()
        .then(() => engine(innerReq))
        .then((res) => {
          if (!res || !Array.isArray(res.segments)) {
            throw new Error("TranslateResponse.segments must be an array");
          }
          /** @type {Map<string, { id?: string, text?: string, error?: string }>} */
          const byId = new Map();
          for (const segment of res.segments) {
            if (!segment || segment.id == null) continue;
            byId.set(String(segment.id), segment);
          }
          for (let index = 0; index < fresh.length; index++) {
            const item = fresh[index];
            const hit = byId.get(`$${index}`);
            if (!hit || hit.error) {
              slots.get(item.key).resolve({
                text: hit && hit.text != null ? String(hit.text) : "",
                error: hit && hit.error ? String(hit.error) : "missing translation",
              });
              continue;
            }
            const text = hit.text == null ? "" : String(hit.text);
            remember(item.key, text);
            slots.get(item.key).resolve({ text });
          }
        })
        .catch((err) => {
          for (const slot of slots.values()) slot.reject(err);
        })
        .finally(() => {
          for (const item of fresh) inflight.delete(item.key);
        });
    }

    const pairs = [...needed.entries()];
    const values = await Promise.all(pairs.map(([, promise]) => promise));
    /** @type {Map<string, CacheEntry>} */
    const settled = new Map();
    pairs.forEach(([key], index) => settled.set(key, values[index]));

    for (let i = 0; i < rows.length; i++) {
      if (out[i]) continue;
      const result = settled.get(rows[i].key);
      if (!result) {
        out[i] = { id: rows[i].id, text: "", error: "missing translation" };
        continue;
      }
      if (result.error) out[i] = { id: rows[i].id, text: result.text, error: result.error };
      else out[i] = { id: rows[i].id, text: result.text };
    }
    return { segments: /** @type {TranslateResponse["segments"]} */ (out) };
  };
}

/**
 * Retry when the engine throws. Segment-level `error` fields are returned as-is
 * and do not retry. The last thrown value is rethrown unchanged, so a
 * TranslateFailure keeps message, kind, code, and status.
 * Delay is baseDelayMs * factor^attempt, capped by maxDelayMs.
 *
 * @param {TranslateEngine} engine
 * @param {{
 *   retries?: number,
 *   baseDelayMs?: number,
 *   factor?: number,
 *   maxDelayMs?: number,
 *   sleep?: (ms: number) => Promise<void>,
 *   retryOn?: (err: unknown) => boolean,
 * }} [options]
 * @returns {TranslateEngine}
 */
export function withRetry(engine, options = {}) {
  const retries = nonNegative(options.retries, pipelineDefaults.retry.retries);
  const baseDelayMs = nonNegative(options.baseDelayMs, pipelineDefaults.retry.baseDelayMs);
  const factor = nonNegative(options.factor, pipelineDefaults.retry.factor);
  const maxDelayMs = nonNegative(options.maxDelayMs, pipelineDefaults.retry.maxDelayMs);
  const sleep = options.sleep || delay;
  const retryOn = options.retryOn || (() => true);

  return async function retriedEngine(req) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await engine(req);
      } catch (err) {
        if (attempt >= retries || !retryOn(err)) throw err;
        const wait = Math.min(maxDelayMs, baseDelayMs * factor ** attempt);
        if (wait > 0) await sleep(wait);
      }
    }
  };
}

/**
 * Spaces underlying calls with a minimum start interval and a concurrency cap.
 *
 * @param {TranslateEngine} engine
 * @param {{ minIntervalMs?: number, maxConcurrent?: number }} [options]
 * @returns {TranslateEngine}
 */
export function withRateLimit(engine, options = {}) {
  const minIntervalMs = nonNegative(options.minIntervalMs, pipelineDefaults.rateLimit.minIntervalMs);
  const requested = nonNegative(options.maxConcurrent, pipelineDefaults.rateLimit.maxConcurrent);
  const maxConcurrent = Math.max(1, Math.floor(requested));
  let inFlight = 0;
  let nextAt = 0;
  /** @type {Array<() => void>} */
  const queue = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  let wakeTimer = null;

  function pump() {
    while (queue.length > 0 && inFlight < maxConcurrent) {
      const wait = Math.max(0, nextAt - Date.now());
      if (wait > 0) {
        if (wakeTimer == null) {
          wakeTimer = setTimeout(() => {
            wakeTimer = null;
            pump();
          }, wait);
        }
        return;
      }
      const start = queue.shift();
      nextAt = Date.now() + minIntervalMs;
      inFlight++;
      start();
    }
  }

  return function rateLimitedEngine(req) {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        Promise.resolve()
          .then(() => engine(req))
          .then(resolve, reject)
          .finally(() => {
            inFlight--;
            pump();
          });
      });
      pump();
    });
  };
}

/**
 * Cache, then retry, then rate limit, around baseEngine.
 * Pass partial overrides; omitted fields keep pipelineDefaults.
 *
 * @param {TranslateEngine} baseEngine
 * @param {{
 *   cache?: {
 *     store?: Map<string, string>,
 *     provider?: string,
 *     model?: string,
 *     maxEntries?: number,
 *   },
 *   retry?: {
 *     retries?: number,
 *     baseDelayMs?: number,
 *     factor?: number,
 *     maxDelayMs?: number,
 *     sleep?: (ms: number) => Promise<void>,
 *     retryOn?: (err: unknown) => boolean,
 *   },
 *   rateLimit?: { minIntervalMs?: number, maxConcurrent?: number },
 * }} [options]
 * @returns {TranslateEngine}
 */
export function createPipelineEngine(baseEngine, options = {}) {
  if (typeof baseEngine !== "function") {
    throw new Error("baseEngine must be a function");
  }
  const rateLimited = withRateLimit(baseEngine, options.rateLimit);
  const retried = withRetry(rateLimited, options.retry);
  return withCache(retried, options.cache);
}

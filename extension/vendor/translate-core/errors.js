/**
 * Rejection shape for upstream engine failures.
 * TranslateRequest / TranslateResponse stay unchanged; callers still get a thrown Error.
 *
 * kind:
 * - network: fetch threw, or fetch is missing
 * - http: non-2xx without a provider error body
 * - provider: non-2xx with a provider error body
 * - output: model text empty or not a JSON array
 *
 * code: provider `error.code`, else provider `error.type`, else `http_<status>`,
 * or `network` / `abort` / `no_fetch` / `empty_output` / `invalid_output`.
 * status: HTTP status when kind is `http` or `provider`.
 */

/** @typedef {"network" | "http" | "provider" | "output"} TranslateFailureKind */

export class TranslateFailure extends Error {
  /**
   * @param {string} message
   * @param {{
   *   kind: TranslateFailureKind,
   *   code: string,
   *   status?: number,
   *   cause?: unknown,
   * }} info
   */
  constructor(message, info) {
    super(message, info.cause !== undefined ? { cause: info.cause } : undefined);
    this.name = "TranslateFailure";
    /** @type {TranslateFailureKind} */
    this.kind = info.kind;
    this.code = info.code;
    if (info.status != null) this.status = info.status;
  }
}

/**
 * @param {unknown} err
 * @returns {err is TranslateFailure}
 */
export function isTranslateFailure(err) {
  return (
    err instanceof TranslateFailure ||
    (!!err &&
      typeof err === "object" &&
      /** @type {{ name?: string, kind?: unknown, code?: unknown, message?: unknown }} */ (err).name ===
        "TranslateFailure" &&
      typeof /** @type {{ kind?: unknown }} */ (err).kind === "string" &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string" &&
      typeof /** @type {{ message?: unknown }} */ (err).message === "string")
  );
}

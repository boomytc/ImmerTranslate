import { MSG_OPEN_OPTIONS } from "../config";
import { sendBgMsg } from "./msg";

/** Options HashRouter path for API keys and providers. */
export const OPTIONS_APIS_PATH = "/apis";

/**
 * Optional deep link carried by MSG_OPEN_OPTIONS.
 * Callers that omit it keep the existing settings open (no hash).
 * @param {unknown} args
 * @returns {"#/apis" | ""}
 */
export function optionsApisHash(args) {
  if (!args || typeof args !== "object") return "";
  const raw = typeof args.hash === "string" ? args.hash.trim() : "";
  if (
    raw === OPTIONS_APIS_PATH ||
    raw === `#${OPTIONS_APIS_PATH}` ||
    raw === "apis"
  ) {
    return `#${OPTIONS_APIS_PATH}`;
  }
  return "";
}

/**
 * Open the API settings page from a page-translate failure.
 */
export function openOptionsApisPage() {
  sendBgMsg(MSG_OPEN_OPTIONS, { hash: OPTIONS_APIS_PATH });
}

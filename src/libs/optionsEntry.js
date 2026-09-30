import { MSG_OPEN_OPTIONS } from "../config";
import { isExt } from "./client";
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
 * The extension reuses MSG_OPEN_OPTIONS. A userscript opens the hosted options page.
 */
export function openOptionsApisPage() {
  if (isExt) {
    sendBgMsg(MSG_OPEN_OPTIONS, { hash: OPTIONS_APIS_PATH });
    return;
  }
  const page = process.env.REACT_APP_OPTIONSPAGE;
  if (
    !page ||
    typeof window === "undefined" ||
    typeof window.open !== "function"
  ) {
    return;
  }
  const base = String(page).split("#")[0];
  window.open(`${base}#${OPTIONS_APIS_PATH}`, "_blank", "noopener,noreferrer");
}

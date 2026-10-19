import { EVENT_KISS_INNER, MSG_TRANS_CURRULE } from "../config";
import { browser } from "./browser";
import { isExt } from "./client";

/** Tell open popups and FABs in this document, and the toolbar popup, the current rule. */
export function publishPageRule(response) {
  if (!response?.rule || typeof document === "undefined") return;
  const detail = {
    action: MSG_TRANS_CURRULE,
    rule: response.rule,
    isTopFrame: response.isTopFrame,
    document: response.document,
  };
  if (response.pageSwitch) detail.pageSwitch = response.pageSwitch;
  document.dispatchEvent(new CustomEvent(EVENT_KISS_INNER, { detail }));
  if (!isExt || typeof browser?.runtime?.sendMessage !== "function") return;
  Promise.resolve(
    browser.runtime.sendMessage({ action: MSG_TRANS_CURRULE, args: detail })
  ).catch(() => {});
}

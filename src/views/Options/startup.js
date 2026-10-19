import { STOKEY_RULES, STOKEY_SETTING, STOKEY_SYNC } from "../../config";
import { kissLog } from "../../libs/log";

import { refreshStorageKeys } from "../../libs/storageRefresh";
import { trySyncRules, trySyncSetting } from "../../libs/sync";
import { normalizeOptionsPath } from "./paths";

export const OPTIONS_SYNC_KEYS = [STOKEY_SETTING, STOKEY_RULES];

export function getRequiredOptionsSyncKeys(path) {
  const pathname = normalizeOptionsPath(path);
  if (pathname === "/sync") return OPTIONS_SYNC_KEYS;
  if (
    pathname === "/" ||
    pathname === "/rules" ||
    pathname.startsWith("/rules/")
  ) {
    return [STOKEY_SETTING, STOKEY_RULES];
  }
  return [STOKEY_SETTING];
}

async function syncAndRefresh(key, sync) {
  try {
    await sync();
  } catch (error) {
    kissLog(`sync options ${key}`, error?.message || error);
  }

  // Failed network requests may still update sync metadata or local storage.
  await refreshStorageKeys([key, STOKEY_SYNC]);
}

export function createOptionsStartup() {
  // Settings initialize the shared remote destination before other syncs start.
  let previous = syncAndRefresh(STOKEY_SETTING, trySyncSetting);
  const completed = { [STOKEY_SETTING]: previous };
  const remaining = [[STOKEY_RULES, trySyncRules]];
  // Complete the entry page first without racing shared sync metadata writes.
  remaining.forEach(([key, sync]) => {
    previous = previous.then(() => syncAndRefresh(key, sync));
    completed[key] = previous;
  });
  return { completed };
}

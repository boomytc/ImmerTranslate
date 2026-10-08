import { assertVersion } from "./version-files.mjs";

export function shouldDeployPages(tag, latest, currentVersion = "") {
  const version = assertVersion(tag.replace(/^v/, ""));
  if (tag !== latest) return false;
  if (!currentVersion) return true;
  const before = assertVersion(currentVersion.trim()).split(".").map(Number);
  const after = version.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (after[index] !== before[index]) return after[index] > before[index];
  }
  return true;
}

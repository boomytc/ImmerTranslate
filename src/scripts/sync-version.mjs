import { fileURLToPath } from "node:url";
import { syncVersion } from "./version-files.mjs";

try {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const { version, updated } = await syncVersion(root);
  console.log(`Version ${version}: updated ${updated} files`);
} catch (error) {
  console.error(`Version synchronization failed: ${error.message}`);
  process.exitCode = 1;
}

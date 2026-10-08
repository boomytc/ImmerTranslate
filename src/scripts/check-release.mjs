import { fileURLToPath } from "node:url";
import { readVersionFiles, validateReleaseSources } from "./version-files.mjs";

try {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const [{ version }] = await readVersionFiles(root);
  const tag = process.env.RELEASE_TAG || `v${version}`;
  await validateReleaseSources(root, tag);
  console.log(`Release sources verified: ${tag}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

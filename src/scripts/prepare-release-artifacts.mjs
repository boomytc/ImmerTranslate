import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readVersionFiles } from "./version-files.mjs";
import {
  writeArtifactManifest,
  verifyArtifactManifest,
} from "./release-artifacts.mjs";

try {
  const root = path.resolve(
    process.env.RELEASE_ROOT ||
      fileURLToPath(new URL("../../", import.meta.url))
  );
  const [{ version }] = await readVersionFiles(root);
  const tag = process.env.RELEASE_TAG || `v${version}`;
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const check = process.argv.includes("--check");
  await (check ? verifyArtifactManifest : writeArtifactManifest)(
    root,
    tag,
    sha
  );
  console.log(
    `${check ? "Verified" : "Prepared"} release artifacts: ${tag} (${sha})`
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { getGithubRelease } from "./github-release.mjs";

try {
  const release = getGithubRelease(
    process.env.GITHUB_REPOSITORY,
    process.env.RELEASE_TAG,
    (...args) =>
      execFileSync("gh", args, {
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      })
  );
  appendFileSync(process.env.GITHUB_OUTPUT, `exists=${!!release}\n`);
  console.log(
    release
      ? "Existing release requires original artifact"
      : "No release exists"
  );
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
}

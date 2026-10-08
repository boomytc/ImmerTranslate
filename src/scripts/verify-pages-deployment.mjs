import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertVersion } from "./version-files.mjs";

export async function verifyPagesDeployment({
  client,
  sha,
  version,
  attempts = 60,
}) {
  let build = await client.latestBuild();
  if (
    build.commit !== sha ||
    !["built", "building", "queued"].includes(build.status)
  ) {
    await client.requestBuild();
    build = await client.latestBuild();
  }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (build.commit === sha) {
      if (build.status === "errored")
        throw new Error(`Pages build failed: ${build.error?.message || sha}`);
      if (build.status === "built" && (await client.liveVersion()) === version)
        return;
    }
    if (attempt < attempts - 1) {
      await client.wait();
      build = await client.latestBuild();
    }
  }
  throw new Error(`Pages did not serve version ${version} from ${sha}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo))
      throw new Error("Invalid GITHUB_REPOSITORY");
    const tag = process.env.RELEASE_TAG;
    if (!tag?.startsWith("v")) throw new Error("Invalid release tag");
    const version = assertVersion(tag.slice(1));
    const api = (endpoint, ...args) =>
      JSON.parse(
        execFileSync("gh", ["api", `repos/${repo}/${endpoint}`, ...args], {
          stdio: ["ignore", "pipe", "pipe"],
        })
      );
    const site = api("pages");
    if (
      site.build_type !== "legacy" ||
      site.source?.branch !== "gh-pages" ||
      site.source?.path !== "/"
    )
      throw new Error(
        "Unexpected Pages configuration; preserve repository settings"
      );
    const sha = api("git/ref/heads/gh-pages").object.sha;
    const url = new URL(
      `version.txt?release=${sha}`,
      `${site.html_url.replace(/\/$/, "")}/`
    );
    await verifyPagesDeployment({
      sha,
      version,
      client: {
        latestBuild: async () => api("pages/builds/latest"),
        requestBuild: async () => api("pages/builds", "--method", "POST"),
        liveVersion: async () => {
          const response = await fetch(url, {
            headers: { "Cache-Control": "no-cache" },
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok)
            throw new Error(`Pages version returned HTTP ${response.status}`);
          return (await response.text()).trim();
        },
        wait: async () => {
          console.log(`Waiting for Pages version ${version} (${sha})`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        },
      },
    });
    console.log(`Pages serves ${version} from ${sha}`);
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  }
}

import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseSources } from "./version-files.mjs";
import { verifyArtifactManifest } from "./release-artifacts.mjs";
import { publishRelease } from "./publish-release.mjs";

const gh = (...args) =>
  execFileSync("gh", args, {
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
let staging;
try {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const tag = process.env.RELEASE_TAG;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    throw new Error("Invalid GITHUB_REPOSITORY");
  const { notes } = await validateReleaseSources(root, tag);
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const manifest = await verifyArtifactManifest(root, tag, sha);
  const api = (endpoint) => JSON.parse(gh("api", `repos/${repo}/${endpoint}`));
  let ref = api(`git/ref/tags/${tag}`);
  const remoteSha =
    ref.object.type === "tag"
      ? api(`git/tags/${ref.object.sha}`).object.sha
      : ref.object.sha;
  if (remoteSha !== sha)
    throw new Error("Remote release tag changed; refusing publication");
  staging = await mkdtemp(path.join(os.tmpdir(), "immer-release-"));
  const notesFile = path.join(staging, "notes.md");
  await writeFile(notesFile, notes);
  const client = {
    async getRelease() {
      try {
        return api(`releases/tags/${tag}`);
      } catch (error) {
        if (error.stderr?.toString().includes("(HTTP 404)")) return null;
        throw error;
      }
    },
    async createDraft() {
      gh(
        "release",
        "create",
        tag,
        "--repo",
        repo,
        "--verify-tag",
        "--draft",
        "--title",
        `Release ${tag}`,
        "--notes-file",
        notesFile
      );
    },
    async upload(name, bytes) {
      const file = path.join(staging, name);
      await writeFile(file, bytes);
      gh("release", "upload", tag, file, "--repo", repo);
    },
    async readAsset(asset) {
      return gh(
        "api",
        `repos/${repo}/releases/assets/${asset.id}`,
        "-H",
        "Accept: application/octet-stream"
      );
    },
    async publish() {
      gh("release", "edit", tag, "--repo", repo, "--draft=false");
    },
  };
  console.log(await publishRelease({ client, root, manifest, notes }));
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (staging) await rm(staging, { recursive: true, force: true });
}

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateReleaseSources } from "./version-files.mjs";

export const RELEASE_CLIENTS = ["chrome", "edge"];
export const manifestAssetName = (tag) =>
  `immer-translate_${tag}_manifest.json`;
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const unzip = (file, entry) =>
  execFileSync("unzip", ["-p", file, entry], {
    maxBuffer: 32 * 1024 * 1024,
  }).toString();

export async function describeArtifacts(root, tag, sha) {
  const { version } = await validateReleaseSources(root, tag);
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Invalid release source SHA");
  const build = path.join(root, "build");
  for (const client of RELEASE_CLIENTS) {
    const manifest = JSON.parse(
      await readFile(path.join(build, client, "manifest.json"), "utf8")
    );
    const zipped = JSON.parse(
      unzip(path.join(build, `${client}.zip`), `${client}/manifest.json`)
    );
    if (manifest.version !== version || zipped.version !== version) {
      throw new Error(`Wrong ${client} artifact version`);
    }
  }
  const files = await Promise.all(
    RELEASE_CLIENTS.map(async (client) => {
      const file = `${client}.zip`;
      const bytes = await readFile(path.join(build, file));
      if (!bytes.length) throw new Error(`Empty release asset: ${file}`);
      return {
        file,
        name: `immer-translate_${tag}_${client}.zip`,
        size: bytes.length,
        sha256: sha256(bytes),
      };
    })
  );
  return {
    schema: 1,
    tag,
    sha,
    files,
  };
}

export async function writeArtifactManifest(root, tag, sha) {
  const manifest = await describeArtifacts(root, tag, sha);
  await writeFile(
    path.join(root, "build/release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}

export async function verifyArtifactManifest(root, tag, sha) {
  const manifest = JSON.parse(
    await readFile(path.join(root, "build/release-manifest.json"), "utf8")
  );
  const actual = await describeArtifacts(root, tag, sha);
  if (JSON.stringify(manifest) !== JSON.stringify(actual)) {
    throw new Error("Release artifact provenance or checksums do not match");
  }
  return manifest;
}

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateReleaseSources } from "./version-files.mjs";

export const RELEASE_CLIENTS = [
  "chrome",
  "edge",
  "firefox",
  "userscript",
  "thunderbird",
];
export const manifestAssetName = (tag) =>
  `immer-translate_${tag}_manifest.json`;
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const userscriptVersion = (content) =>
  content.match(/^\/\/ @version\s+(\S+)/m)?.[1];
const unzip = (file, entry) =>
  execFileSync("unzip", ["-p", file, entry], {
    maxBuffer: 32 * 1024 * 1024,
  }).toString();

async function webDigest(root, relative = "") {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries.sort((a, b) =>
    a.name.localeCompare(b.name, "en")
  )) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await webDigest(root, name)));
    else if (entry.isFile())
      files.push([name, sha256(await readFile(path.join(root, name)))]);
    else throw new Error(`Unexpected build entry: ${name}`);
  }
  return files;
}

export async function describeArtifacts(root, tag, sha) {
  const { version } = await validateReleaseSources(root, tag);
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Invalid release source SHA");
  const build = path.join(root, "build");
  for (const client of RELEASE_CLIENTS.filter(
    (name) => name !== "userscript"
  )) {
    const manifest = JSON.parse(
      await readFile(path.join(build, client, "manifest.json"), "utf8")
    );
    const zipEntry = ["chrome", "edge"].includes(client)
      ? `${client}/manifest.json`
      : "manifest.json";
    const zipped = JSON.parse(
      unzip(path.join(build, `${client}.zip`), zipEntry)
    );
    if (manifest.version !== version || zipped.version !== version) {
      throw new Error(`Wrong ${client} artifact version`);
    }
  }
  for (const name of [
    "immer-translate.user.js",
    "immer-translate-ios-safari.user.js",
  ]) {
    const loose = await readFile(path.join(build, "userscript", name), "utf8");
    const web = await readFile(path.join(build, "web", name), "utf8");
    const zipped = unzip(
      path.join(build, "userscript.zip"),
      `userscript/${name}`
    );
    if (
      [loose, web, zipped].some(
        (content) => userscriptVersion(content) !== version
      ) ||
      loose !== web ||
      loose !== zipped
    ) {
      throw new Error(`Wrong userscript artifact: ${name}`);
    }
  }
  if (
    (await readFile(path.join(build, "web/version.txt"), "utf8")).trim() !==
    version
  ) {
    throw new Error("Wrong Pages artifact version");
  }
  await readFile(path.join(build, "web/index.html"));
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
    webSha256: sha256(JSON.stringify(await webDigest(path.join(build, "web")))),
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

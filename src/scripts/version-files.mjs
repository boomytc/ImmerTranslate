import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const VERSION_FILES = [
  "package.json",
  ".env",
  "public/manifest.json",
  "public/manifest.firefox.json",
  "public/manifest.thunderbird.json",
];

export function assertVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Invalid stable version: ${version}`);
  }
  return version;
}

// Read and validate every destination before writing any file.
export async function readVersionFiles(root) {
  return Promise.all(
    VERSION_FILES.map(async (name) => {
      const content = await readFile(path.join(root, name), "utf8");
      let version;
      if (name === ".env") {
        const matches = [
          ...content.matchAll(/^REACT_APP_VERSION=([^\r\n]+)\r?$/gm),
        ];
        if (matches.length !== 1) {
          throw new Error(".env must contain exactly one REACT_APP_VERSION");
        }
        version = matches[0][1];
      } else {
        version = JSON.parse(content).version;
      }
      assertVersion(version);
      return { name, content, version };
    })
  );
}

export async function syncVersion(root) {
  const files = await readVersionFiles(root);
  const version = files[0].version;
  let updated = 0;
  for (const file of files.slice(1)) {
    if (file.version === version) continue;
    const content =
      file.name === ".env"
        ? file.content.replace(
            /^REACT_APP_VERSION=[^\r\n]+/m,
            `REACT_APP_VERSION=${version}`
          )
        : `${JSON.stringify({ ...JSON.parse(file.content), version }, null, 2)}\n`;
    await writeFile(path.join(root, file.name), content);
    updated += 1;
  }
  return { version, updated };
}

export async function validateReleaseSources(root, tag) {
  const files = await readVersionFiles(root);
  const version = files[0].version;
  if (tag !== `v${version}` || files.some((file) => file.version !== version)) {
    throw new Error(`Tag and all version files must agree: ${tag}`);
  }
  const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
  const sections = changelog.split(/^## /m);
  const [heading, ...body] = (sections[1] || "").split("\n");
  if (heading.trim() !== tag || !body.join("\n").trim()) {
    throw new Error(`First CHANGELOG section must be non-empty ## ${tag}`);
  }
  return { version, notes: body.join("\n").trim() };
}

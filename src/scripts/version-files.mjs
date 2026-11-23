import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const VERSION_FILES = ["package.json", ".env", "public/manifest.json"];

const UPDATED_DATE =
  /^\d{2}\.(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\.([01]\d|2[0-3])[0-5]\d$/;

/** 更新日期，形如 26.1119.1740。 */
export function assertVersion(version) {
  if (!UPDATED_DATE.test(version)) {
    throw new Error(`Update date must be YY.MMDD.HHMM, received ${version}`);
  }
  return version;
}

/** 将点分数字版本转为每段无前导零的扩展清单 version。 */
export function toManifestVersion(version) {
  if (typeof version !== "string" || !/^\d+(?:\.\d+)*$/.test(version)) {
    throw new Error(`Invalid version for manifest: ${version}`);
  }
  return version
    .split(".")
    .map((part) => String(Number(part)))
    .join(".");
}

async function readFileVersion(root, name) {
  const content = await readFile(path.join(root, name), "utf8");
  if (name === ".env") {
    const matches = [
      ...content.matchAll(/^REACT_APP_VERSION=([^\r\n]+)\r?$/gm),
    ];
    if (matches.length !== 1) {
      throw new Error(".env must contain exactly one REACT_APP_VERSION");
    }
    return { name, content, version: matches[0][1] };
  }
  const parsed = JSON.parse(content);
  if (name === "public/manifest.json") {
    return {
      name,
      content,
      version: parsed.version,
      versionName: parsed.version_name,
    };
  }
  return { name, content, version: parsed.version };
}

export async function readVersionFiles(root) {
  const files = await Promise.all(
    VERSION_FILES.map((name) => readFileVersion(root, name))
  );
  for (const file of files) {
    if (file.name === "public/manifest.json") {
      const expectedVersion = toManifestVersion(
        assertVersion(file.versionName)
      );
      if (file.version !== expectedVersion) {
        throw new Error(
          `public/manifest.json version must be ${expectedVersion}, received ${file.version}`
        );
      }
    } else {
      assertVersion(file.version);
    }
  }
  return files;
}

function withManifestVersions(manifest, manifestVersion, versionName) {
  const next = {};
  let inserted = false;
  for (const [key, value] of Object.entries(manifest)) {
    if (key === "version") {
      next.version = manifestVersion;
      next.version_name = versionName;
      inserted = true;
    } else if (key === "version_name") {
      continue;
    } else {
      next[key] = value;
    }
  }
  if (!inserted) {
    next.version = manifestVersion;
    next.version_name = versionName;
  }
  return next;
}

export async function syncVersion(root) {
  const source = await readFileVersion(root, VERSION_FILES[0]);
  const version = assertVersion(source.version);
  const manifestVersion = toManifestVersion(version);
  let updated = 0;
  for (const name of VERSION_FILES.slice(1)) {
    const file = await readFileVersion(root, name);
    if (name === ".env") {
      if (file.version === version) continue;
      const content = file.content.replace(
        /^REACT_APP_VERSION=[^\r\n]+/m,
        `REACT_APP_VERSION=${version}`
      );
      await writeFile(path.join(root, name), content);
      updated += 1;
      continue;
    }
    if (file.version === manifestVersion && file.versionName === version) {
      continue;
    }
    const nextManifest = withManifestVersions(
      JSON.parse(file.content),
      manifestVersion,
      version
    );
    await writeFile(
      path.join(root, name),
      `${JSON.stringify(nextManifest, null, 2)}\n`
    );
    updated += 1;
  }
  return { version, updated };
}

export async function validateReleaseSources(root, tag) {
  const files = await readVersionFiles(root);
  const version = files[0].version;
  const manifestVersion = toManifestVersion(version);
  const inconsistent = files.some((file) =>
    file.name === "public/manifest.json"
      ? file.version !== manifestVersion || file.versionName !== version
      : file.version !== version
  );
  if (tag !== version || inconsistent) {
    throw new Error(`Update date and version files must agree: ${tag}`);
  }
  const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
  const sections = changelog.split(/^## /m);
  const [heading, ...body] = (sections[1] || "").split("\n");
  if (heading.trim() !== version || !body.join("\n").trim()) {
    throw new Error(`First CHANGELOG section must be non-empty ## ${version}`);
  }
  return { version, notes: body.join("\n").trim() };
}

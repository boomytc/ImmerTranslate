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

async function readFileVersion(root, name) {
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
  return { name, content, version };
}

export async function readVersionFiles(root) {
  const files = await Promise.all(
    VERSION_FILES.map((name) => readFileVersion(root, name))
  );
  files.forEach((file) => assertVersion(file.version));
  return files;
}

export async function syncVersion(root) {
  const source = await readFileVersion(root, VERSION_FILES[0]);
  const version = assertVersion(source.version);
  let updated = 0;
  for (const name of VERSION_FILES.slice(1)) {
    const file = await readFileVersion(root, name);
    if (file.version === version) continue;
    const content =
      name === ".env"
        ? file.content.replace(
            /^REACT_APP_VERSION=[^\r\n]+/m,
            `REACT_APP_VERSION=${version}`
          )
        : `${JSON.stringify({ ...JSON.parse(file.content), version }, null, 2)}\n`;
    await writeFile(path.join(root, name), content);
    updated += 1;
  }
  return { version, updated };
}

export async function validateReleaseSources(root, tag) {
  const files = await readVersionFiles(root);
  const version = files[0].version;
  if (tag !== version || files.some((file) => file.version !== version)) {
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

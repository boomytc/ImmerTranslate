import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { crc32, inflateRawSync } from "node:zlib";
import { toManifestVersion, validateReleaseSources } from "./version-files.mjs";

export const RELEASE_CLIENTS = ["chrome", "edge"];
export const manifestAssetName = (tag) =>
  `immer-translate_${tag}_manifest.json`;
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const EOCD_SIGNATURE = 0x06054b50;
const CDFH_SIGNATURE = 0x02014b50;
const LFH_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_ZIP_COMMENT = 0xffff;

function findEocdOffset(buffer) {
  const minOffset = Math.max(
    0,
    buffer.length - EOCD_MIN_SIZE - MAX_ZIP_COMMENT
  );
  for (
    let offset = buffer.length - EOCD_MIN_SIZE;
    offset >= minOffset;
    offset -= 1
  ) {
    if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + EOCD_MIN_SIZE + commentLength === buffer.length) {
      return offset;
    }
  }
  return -1;
}

export async function readZipEntry(zipPath, entryPath) {
  const buffer = await readFile(zipPath);
  const eocdOffset = findEocdOffset(buffer);
  if (eocdOffset === -1) {
    throw new Error(`Invalid ZIP archive (missing EOCD): ${zipPath}`);
  }

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const cdStartDisk = buffer.readUInt16LE(eocdOffset + 6);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (diskNumber !== 0 || cdStartDisk !== 0) {
    throw new Error(`Multi-disk ZIP archives are not supported: ${zipPath}`);
  }
  if (
    totalEntries === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff
  ) {
    throw new Error(`ZIP64 archives are not supported: ${zipPath}`);
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new Error(`Corrupt ZIP central directory bounds: ${zipPath}`);
  }

  const target = entryPath.replace(/\\/g, "/");
  let cursor = cdOffset;
  const cdEnd = cdOffset + cdSize;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > cdEnd || buffer.readUInt32LE(cursor) !== CDFH_SIGNATURE) {
      throw new Error(`Corrupt ZIP central directory header: ${zipPath}`);
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);

    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    const nextCursor = nameEnd + extraLength + commentLength;
    if (nextCursor > cdEnd) {
      throw new Error(`Corrupt ZIP central directory entry bounds: ${zipPath}`);
    }

    const name = buffer
      .subarray(nameStart, nameEnd)
      .toString("utf8")
      .replace(/\\/g, "/");

    if (name === target) {
      if (
        compressedSize === 0xffffffff ||
        uncompressedSize === 0xffffffff ||
        localHeaderOffset === 0xffffffff
      ) {
        throw new Error(`ZIP64 entries are not supported: ${entryPath}`);
      }
      if (
        localHeaderOffset + 30 > buffer.length ||
        buffer.readUInt32LE(localHeaderOffset) !== LFH_SIGNATURE
      ) {
        throw new Error(`Corrupt ZIP local file header for ${entryPath}`);
      }

      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart =
        localHeaderOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) {
        throw new Error(`Corrupt ZIP entry data bounds for ${entryPath}`);
      }

      const compressed = buffer.subarray(dataStart, dataEnd);
      let content;
      if (method === 0) {
        content = compressed;
      } else if (method === 8) {
        content = inflateRawSync(compressed);
      } else {
        throw new Error(
          `Unsupported ZIP compression method ${method} for ${entryPath}`
        );
      }

      if (content.length !== uncompressedSize) {
        throw new Error(`ZIP entry size mismatch for ${entryPath}`);
      }
      if (crc32(content) !== expectedCrc) {
        throw new Error(`ZIP entry CRC mismatch for ${entryPath}`);
      }

      return content.toString("utf8");
    }

    cursor = nextCursor;
  }

  throw new Error(`ZIP entry not found: ${entryPath} in ${zipPath}`);
}

export async function describeArtifacts(root, tag, sha) {
  const { version } = await validateReleaseSources(root, tag);
  const manifestVersion = toManifestVersion(version);
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Invalid release source SHA");
  const build = path.join(root, "build");
  for (const client of RELEASE_CLIENTS) {
    const manifest = JSON.parse(
      await readFile(path.join(build, client, "manifest.json"), "utf8")
    );
    const zipped = JSON.parse(
      await readZipEntry(
        path.join(build, `${client}.zip`),
        `${client}/manifest.json`
      )
    );
    if (
      manifest.version !== manifestVersion ||
      manifest.version_name !== version ||
      zipped.version !== manifestVersion ||
      zipped.version_name !== version
    ) {
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

import { readFile } from "node:fs/promises";
import path from "node:path";
import { manifestAssetName, sha256 } from "./release-artifacts.mjs";

async function verifyAsset(client, asset, bytes) {
  const digest = `sha256:${sha256(bytes)}`;
  if (
    asset.size !== bytes.length ||
    (asset.digest
      ? asset.digest !== digest
      : sha256(await client.readAsset(asset)) !== sha256(bytes))
  ) {
    throw new Error(
      `Published asset conflicts with original artifact: ${asset.name}`
    );
  }
}

// The caller verifies the original artifact manifest and remote tag before any write.
export async function publishRelease({ client, root, manifest, notes }) {
  const manifestName = manifestAssetName(manifest.tag);
  const files = [
    { name: manifestName, file: "release-manifest.json" },
    ...manifest.files,
  ];
  const payloads = await Promise.all(
    files.map(async (file) => ({
      ...file,
      bytes: await readFile(path.join(root, "build", file.file)),
    }))
  );
  let release = await client.getRelease();
  if (release) {
    const provenance = release.assets.find(
      (asset) => asset.name === manifestName
    );
    if (!provenance && (release.assets.length || !release.draft)) {
      throw new Error(
        "Existing release has no provenance; automatic replacement is forbidden"
      );
    }
    if (provenance) await verifyAsset(client, provenance, payloads[0].bytes);
    // Check every existing asset before uploading any missing file.
    for (const file of payloads) {
      const asset = release.assets.find((item) => item.name === file.name);
      if (asset) await verifyAsset(client, asset, file.bytes);
      else if (!release.draft)
        throw new Error(`Published release is incomplete: ${file.name}`);
    }
  } else {
    await client.createDraft(notes);
    release = await client.getRelease();
    if (!release?.draft)
      throw new Error("Expected a draft release after creation");
  }

  for (const file of payloads) {
    if (!release.assets.some((asset) => asset.name === file.name)) {
      await client.upload(file.name, file.bytes);
    }
  }
  release = await client.getRelease();
  for (const file of payloads) {
    const asset = release.assets.find((item) => item.name === file.name);
    if (!asset) throw new Error(`Upload is incomplete: ${file.name}`);
    await verifyAsset(client, asset, file.bytes);
  }
  if (release.draft) await client.publish();
  const published = await client.getRelease();
  if (!published || published.draft)
    throw new Error("Release publication did not complete");
  return published.html_url;
}

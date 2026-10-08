import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  copyFile,
  appendFile,
  symlink,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bestzip from "bestzip";
import {
  VERSION_FILES,
  syncVersion,
  validateReleaseSources,
} from "./version-files.mjs";
import {
  RELEASE_CLIENTS,
  manifestAssetName,
  sha256,
  writeArtifactManifest,
  verifyArtifactManifest,
} from "./release-artifacts.mjs";
import { publishRelease } from "./publish-release.mjs";
import { shouldDeployPages } from "./pages-guard.mjs";
import { selectOriginalArtifact } from "./find-release-artifact.mjs";
import { getGithubRelease } from "./github-release.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tag = "v1.1.1";
const sha = "a".repeat(40);

function httpError(status) {
  return Object.assign(new Error(`HTTP ${status}`), {
    stderr: Buffer.from(`gh: failure (HTTP ${status})`),
  });
}

test("draft lookup falls back from tag 404 to all release pages", () => {
  const calls = [];
  const draft = { id: 12, tag_name: tag, draft: true, assets: [] };
  const gh = (...args) => {
    calls.push(args);
    if (args[1].includes("/tags/")) throw httpError(404);
    return JSON.stringify([[{ tag_name: "v1.1.0" }], [draft]]);
  };
  assert.deepEqual(getGithubRelease("owner/repo", tag, gh), draft);
  assert.deepEqual(calls[1].slice(2), ["--paginate", "--slurp"]);
});

test("published lookup skips draft listing and missing releases return null", () => {
  const release = { tag_name: tag, draft: false };
  assert.deepEqual(
    getGithubRelease("owner/repo", tag, () => JSON.stringify(release)),
    release
  );
  assert.equal(
    getGithubRelease("owner/repo", tag, (...args) => {
      if (args[1].includes("/tags/")) throw httpError(404);
      return "[[]]";
    }),
    null
  );
});

test("release lookup propagates authentication, listing and ambiguous-tag errors", () => {
  assert.throws(
    () =>
      getGithubRelease("owner/repo", tag, () => {
        throw httpError(403);
      }),
    /403/
  );
  assert.throws(
    () =>
      getGithubRelease("owner/repo", tag, (...args) => {
        throw httpError(args[1].includes("/tags/") ? 404 : 401);
      }),
    /401/
  );
  assert.throws(
    () =>
      getGithubRelease("owner/repo", tag, (...args) => {
        if (args[1].includes("/tags/")) throw httpError(404);
        return JSON.stringify([[{ tag_name: tag }, { tag_name: tag }]]);
      }),
    /Ambiguous/
  );
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "immer-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "public"));
  for (const file of VERSION_FILES) {
    await writeFile(
      path.join(root, file),
      file === ".env" ? "REACT_APP_VERSION=1.1.1\n" : '{"version":"1.1.1"}\n'
    );
  }
  await writeFile(
    path.join(root, "CHANGELOG.md"),
    "## v1.1.1\n\n- Security fix\n\n## v1.1.0\n\n- Old notes\n"
  );
  return root;
}

async function artifacts(t) {
  const root = await fixture(t);
  const build = path.join(root, "build");
  for (const client of RELEASE_CLIENTS) {
    await mkdir(path.join(build, client), { recursive: true });
    if (client !== "userscript")
      await writeFile(
        path.join(build, client, "manifest.json"),
        '{"version":"1.1.1"}'
      );
  }
  await mkdir(path.join(build, "web"));
  for (const name of [
    "immer-translate.user.js",
    "immer-translate-ios-safari.user.js",
  ]) {
    for (const client of ["userscript", "web"]) {
      await writeFile(
        path.join(build, client, name),
        "// @version       1.1.1\nconsole.log('translation');\n"
      );
    }
  }
  await writeFile(path.join(build, "web/version.txt"), "1.1.1");
  await writeFile(
    path.join(build, "web/index.html"),
    "<html>Translation</html>"
  );
  for (const client of RELEASE_CLIENTS) {
    const flat = ["firefox", "thunderbird"].includes(client);
    await bestzip({
      cwd: flat ? path.join(build, client) : build,
      source: flat ? "*" : client,
      destination: path.join(build, `${client}.zip`),
    });
  }
  const manifest = await writeArtifactManifest(root, tag, sha);
  return { root, manifest };
}

function releaseClient() {
  let release = null;
  let nextId = 1;
  const bytes = new Map();
  const mutations = [];
  return {
    mutations,
    bytes,
    get value() {
      return release;
    },
    set value(value) {
      release = value;
    },
    async getRelease() {
      return release;
    },
    async createDraft() {
      mutations.push("create");
      release = {
        draft: true,
        assets: [],
        html_url: "https://example.test/release",
      };
    },
    async upload(name, content) {
      mutations.push(`upload:${name}`);
      const asset = {
        id: nextId++,
        name,
        size: content.length,
        digest: `sha256:${sha256(content)}`,
      };
      bytes.set(asset.id, content);
      release.assets.push(asset);
    },
    async readAsset(asset) {
      return bytes.get(asset.id);
    },
    async publish() {
      mutations.push("publish");
      release.draft = false;
    },
  };
}

async function publishedFixture(t) {
  const data = await artifacts(t);
  const client = releaseClient();
  await publishRelease({ ...data, client, notes: "Security fix" });
  client.mutations.length = 0;
  return { ...data, client };
}

test("synchronizes all versions and can be repeated without writes", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "package.json"), '{"version":"1.1.2"}\n');
  assert.deepEqual(await syncVersion(root), { version: "1.1.2", updated: 4 });
  assert.deepEqual(await syncVersion(root), { version: "1.1.2", updated: 0 });
});

test("missing destination fails before modifying any other destination", async (t) => {
  const root = await fixture(t);
  await rm(path.join(root, ".env"));
  await writeFile(path.join(root, "package.json"), '{"version":"1.1.2"}\n');
  await assert.rejects(syncVersion(root), /ENOENT/);
  assert.equal(
    JSON.parse(await readFile(path.join(root, "public/manifest.json"))).version,
    "1.1.1"
  );
});

for (const content of [
  "NO_VERSION=true\n",
  "REACT_APP_VERSION=1.1.1\nREACT_APP_VERSION=1.1.2\n",
  "REACT_APP_VERSION=broken\n",
]) {
  test(`rejects missing, duplicate or invalid env versions: ${content.trim()}`, async (t) => {
    const root = await fixture(t);
    await writeFile(path.join(root, ".env"), content);
    await assert.rejects(syncVersion(root));
  });
}

test("sync CLI returns nonzero for a missing file", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "src/scripts"), { recursive: true });
  for (const name of ["sync-version.mjs", "version-files.mjs"]) {
    await copyFile(
      path.join(repository, "src/scripts", name),
      path.join(root, "src/scripts", name)
    );
  }
  await rm(path.join(root, ".env"));
  const result = spawnSync(process.execPath, [
    path.join(root, "src/scripts/sync-version.mjs"),
  ]);
  assert.equal(result.status, 1);
});

test("version update rejects prerelease input before changing package.json", async (t) => {
  const root = await fixture(t);
  await symlink(
    path.join(repository, "node_modules"),
    path.join(root, "node_modules"),
    "dir"
  );
  await mkdir(path.join(root, "src/scripts"), { recursive: true });
  for (const name of ["update-version.mjs", "version-files.mjs"]) {
    await copyFile(
      path.join(repository, "src/scripts", name),
      path.join(root, "src/scripts", name)
    );
  }
  const original = await readFile(path.join(root, "package.json"), "utf8");
  const result = spawnSync(
    path.join(repository, "node_modules/.bin/zx"),
    [path.join(root, "src/scripts/update-version.mjs"), "set", "1.1.2-beta.1"],
    { cwd: root }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr.toString(), /Invalid stable version/);
  assert.equal(
    await readFile(path.join(root, "package.json"), "utf8"),
    original
  );
});

test("rejects a manifest with no version instead of inventing the field", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "public/manifest.json"), "{}");
  await assert.rejects(syncVersion(root), /Invalid stable version/);
});

test("validates tag, all versions and exact nonempty changelog section", async (t) => {
  const root = await fixture(t);
  assert.equal(
    (await validateReleaseSources(root, tag)).notes,
    "- Security fix"
  );
  await assert.rejects(validateReleaseSources(root, "v1.1.0"), /must agree/);
  await writeFile(
    path.join(root, "public/manifest.json"),
    '{"version":"1.1.0"}'
  );
  await assert.rejects(validateReleaseSources(root, tag), /must agree/);
});

for (const content of [
  "## v1.1.0\n- Wrong section\n",
  "## v1.1.1\n\n## v1.1.0\n- Old\n",
]) {
  test("rejects wrong or empty release notes", async (t) => {
    const root = await fixture(t);
    await writeFile(path.join(root, "CHANGELOG.md"), content);
    await assert.rejects(validateReleaseSources(root, tag), /First CHANGELOG/);
  });
}

test("verifies all five ZIPs, both userscripts and Pages provenance", async (t) => {
  const { root, manifest } = await artifacts(t);
  assert.deepEqual(await verifyArtifactManifest(root, tag, sha), manifest);
  await assert.rejects(
    verifyArtifactManifest(root, tag, "b".repeat(40)),
    /provenance/
  );
});

test("recovery tooling verifies the tagged source root rather than its own checkout", async (t) => {
  const { root } = await artifacts(t);
  for (const args of [
    ["init", "--quiet"],
    ["add", "."],
    [
      "-c",
      "user.name=Release test",
      "-c",
      "user.email=test@example.test",
      "commit",
      "--quiet",
      "-m",
      "Tagged source",
    ],
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.trim();
  await writeArtifactManifest(root, tag, sourceSha);
  const result = spawnSync(
    process.execPath,
    [
      path.join(repository, "src/scripts/prepare-release-artifacts.mjs"),
      "--check",
    ],
    {
      env: { ...process.env, RELEASE_ROOT: root, RELEASE_TAG: tag },
      encoding: "utf8",
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(sourceSha));
});

test("rejects changed ZIP bytes even if version metadata remains valid", async (t) => {
  const { root } = await artifacts(t);
  await appendFile(path.join(root, "build/chrome.zip"), "changed");
  await assert.rejects(verifyArtifactManifest(root, tag, sha), /checksums/);
});

test("rejects changed Pages content", async (t) => {
  const { root } = await artifacts(t);
  await writeFile(path.join(root, "build/web/index.html"), "changed website");
  await assert.rejects(verifyArtifactManifest(root, tag, sha), /checksums/);
});

test("rejects incorrect built version before creating a manifest", async (t) => {
  const { root } = await artifacts(t);
  await writeFile(
    path.join(root, "build/edge/manifest.json"),
    '{"version":"1.1.0"}'
  );
  await assert.rejects(writeArtifactManifest(root, tag, sha), /Wrong edge/);
});

test("first publication uploads provenance first and publishes only after every upload", async (t) => {
  const data = await artifacts(t);
  const client = releaseClient();
  await publishRelease({ ...data, client, notes: "Security fix" });
  assert.equal(client.mutations[0], "create");
  assert.equal(client.mutations[1], `upload:${manifestAssetName(tag)}`);
  assert.equal(client.mutations.at(-1), "publish");
  assert.equal(client.value.assets.length, 6);
});

test("draft API semantics work during creation, upload verification and repeat", async (t) => {
  const data = await artifacts(t);
  const client = releaseClient();
  const gh = (...args) => {
    const release = client.value && { ...client.value, tag_name: tag };
    if (args[1].includes("/tags/")) {
      if (!release || release.draft) throw httpError(404);
      return JSON.stringify(release);
    }
    return JSON.stringify([release ? [release] : []]);
  };
  client.getRelease = async () => getGithubRelease("owner/repo", tag, gh);
  await publishRelease({ ...data, client, notes: "Security fix" });
  assert.equal(client.value.draft, false);
  assert.equal(client.value.assets.length, 6);
  client.mutations.length = 0;
  await publishRelease({ ...data, client, notes: "Security fix" });
  assert.deepEqual(client.mutations, []);
});

test("repeat publication verifies existing assets without any write", async (t) => {
  const data = await publishedFixture(t);
  await publishRelease({ ...data, notes: "Security fix" });
  assert.deepEqual(data.client.mutations, []);
});

test("partial upload leaves a draft and resumes only missing original files", async (t) => {
  const data = await artifacts(t);
  const client = releaseClient();
  const upload = client.upload.bind(client);
  client.upload = async (name, bytes) => {
    if (name.endsWith("_edge.zip")) throw new Error("network interrupted");
    await upload(name, bytes);
  };
  await assert.rejects(
    publishRelease({ ...data, client, notes: "Security fix" }),
    /interrupted/
  );
  assert.equal(client.value.draft, true);
  assert.equal(client.value.assets.length, 2);
  client.upload = upload;
  client.mutations.length = 0;
  await publishRelease({ ...data, client, notes: "Security fix" });
  assert.equal(client.mutations.length, 5);
  assert.equal(client.mutations.at(-1), "publish");
  assert.ok(
    !client.mutations.some(
      (item) => item.includes("_chrome.zip") || item.includes("_manifest.json")
    )
  );
});

test("draft conflicts stop before uploading any missing asset", async (t) => {
  const data = await publishedFixture(t);
  data.client.value.draft = true;
  data.client.value.assets.find((asset) =>
    asset.name.endsWith("_chrome.zip")
  ).digest = "sha256:wrong";
  data.client.value.assets.pop();
  await assert.rejects(
    publishRelease({ ...data, notes: "Security fix" }),
    /conflicts/
  );
  assert.deepEqual(data.client.mutations, []);
});

test("published releases with missing assets are never silently repaired", async (t) => {
  const data = await publishedFixture(t);
  data.client.value.assets.pop();
  await assert.rejects(
    publishRelease({ ...data, notes: "Security fix" }),
    /incomplete/
  );
  assert.deepEqual(data.client.mutations, []);
});

test("existing release without provenance is preserved", async (t) => {
  const data = await artifacts(t);
  const client = releaseClient();
  client.value = { draft: false, assets: [] };
  await assert.rejects(
    publishRelease({ ...data, client, notes: "Security fix" }),
    /no provenance/
  );
  assert.deepEqual(client.mutations, []);
});

test("permission errors do not get mistaken for a missing release", async (t) => {
  const data = await artifacts(t);
  const client = releaseClient();
  client.getRelease = async () => {
    throw new Error("HTTP 403");
  };
  await assert.rejects(
    publishRelease({ ...data, client, notes: "Security fix" }),
    /403/
  );
  assert.deepEqual(client.mutations, []);
});

test("falls back to actual asset bytes when GitHub supplies no digest", async (t) => {
  const data = await publishedFixture(t);
  for (const asset of data.client.value.assets) delete asset.digest;
  await publishRelease({ ...data, notes: "Security fix" });
  assert.deepEqual(data.client.mutations, []);
  data.client.bytes.set(
    data.client.value.assets[1].id,
    Buffer.from("conflicting bytes")
  );
  await assert.rejects(
    publishRelease({ ...data, notes: "Security fix" }),
    /conflicts/
  );
});

test("Pages only deploys the current stable release and never downgrades", () => {
  assert.equal(shouldDeployPages(tag, tag, "1.1.0"), true);
  assert.equal(shouldDeployPages(tag, tag, "1.1.1"), true);
  assert.equal(shouldDeployPages(tag, "v1.1.2", "1.1.0"), false);
  assert.equal(shouldDeployPages(tag, tag, "1.1.2"), false);
  assert.equal(shouldDeployPages("v1.10.0", "v1.10.0", "1.9.0"), true);
  assert.throws(() => shouldDeployPages(tag, tag, "broken"));
});

test("recovery accepts only the original unexpired release artifact", () => {
  const args = {
    run: { path: ".github/workflows/release.yml", event: "push" },
    artifacts: [],
    name: "build-v1.1.1-sha",
    runId: "10",
    currentRunId: "10",
  };
  assert.equal(selectOriginalArtifact(args), false);
  assert.throws(
    () => selectOriginalArtifact({ ...args, currentRunId: "11" }),
    /missing or expired/
  );
  const artifact = { name: args.name, expired: false };
  assert.equal(
    selectOriginalArtifact({
      ...args,
      artifacts: [artifact],
      currentRunId: "11",
    }),
    true
  );
  assert.throws(
    () =>
      selectOriginalArtifact({
        ...args,
        artifacts: [{ ...artifact, expired: true }],
        currentRunId: "11",
      }),
    /expired/
  );
  assert.throws(
    () =>
      selectOriginalArtifact({
        ...args,
        run: { ...args.run, event: "pull_request" },
      }),
    /original release/
  );
  assert.throws(
    () => selectOriginalArtifact({ ...args, artifacts: [artifact, artifact] }),
    /Ambiguous/
  );
});

test("artifact finder refuses to rebuild when a draft exists or state is unknown", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "original-run.json"),
    JSON.stringify({
      path: ".github/workflows/release.yml",
      event: "push",
    })
  );
  await writeFile(
    path.join(root, "original-artifacts.json"),
    '{"artifacts":[]}'
  );
  const output = path.join(root, "output");
  for (const exists of ["true", "", "false"]) {
    const result = spawnSync(
      process.execPath,
      [path.join(repository, "src/scripts/find-release-artifact.mjs")],
      {
        env: {
          ...process.env,
          RUNNER_TEMP: root,
          RELEASE_EXISTS: exists,
          ARTIFACT_NAME: "original",
          ARTIFACT_RUN_ID: "10",
          GITHUB_RUN_ID: "10",
          GITHUB_OUTPUT: output,
        },
        encoding: "utf8",
      }
    );
    assert.equal(result.status, exists === "false" ? 0 : 1, result.stderr);
  }
  assert.equal(await readFile(output, "utf8"), "found=false\nrun_id=10\n");
});

test("archive script creates all five packages without invoking npx", async (t) => {
  const { root } = await artifacts(t);
  const fakeBin = path.join(root, "fake-bin");
  await mkdir(fakeBin);
  await writeFile(path.join(fakeBin, "npx"), "#!/bin/sh\nexit 87\n", {
    mode: 0o755,
  });
  await writeFile(path.join(root, "build/obsolete.zip"), "old");
  const result = spawnSync(
    path.join(repository, "node_modules/.bin/zx"),
    [path.join(repository, "src/scripts/archive.mjs")],
    {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${path.join(repository, "node_modules/.bin")}:${process.env.PATH}`,
      },
      encoding: "utf8",
    }
  );
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(
    readFile(path.join(root, "build/obsolete.zip")),
    /ENOENT/
  );
  await writeArtifactManifest(root, tag, sha);
});

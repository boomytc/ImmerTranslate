import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  appendFile,
  readdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import bestzip from "bestzip";
import {
  releaseLocal,
  releaseOptions,
  saveArtifacts,
} from "./local-release.mjs";
import { runCommand, runChecks } from "./check.mjs";
import { writeArtifactManifest } from "./release-artifacts.mjs";
import { getGithubRelease } from "./github-release.mjs";

const tag = "v1.1.1";

test("command errors preserve the 404 needed for new releases without hiding auth failures", () => {
  for (const status of [404, 401, 403]) {
    const lookup = () =>
      getGithubRelease("owner/repo", tag, (...args) => {
        if (!args[1].includes("/tags/")) return "[[]]";
        return runCommand(
          process.execPath,
          [
            "-e",
            `process.stderr.write('gh: failure (HTTP ${status})'); process.exit(1)`,
          ],
          { capture: true }
        );
      });
    if (status === 404) assert.equal(lookup(), null);
    else assert.throws(lookup, new RegExp(`HTTP ${status}`));
  }
});

test("interrupted artifact copies leave no reusable partial output and permit a retry", async (t) => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "immer-artifact-save-test-")
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const build = path.join(root, "build");
  const output = path.join(root, "release");
  await mkdir(build);
  await writeFile(path.join(build, "chrome.zip"), "original bytes");
  await assert.rejects(
    saveArtifacts(build, output, async (_, destination) => {
      await mkdir(destination);
      await writeFile(path.join(destination, "chrome.zip"), "partial");
      throw new Error("Copy interrupted");
    }),
    /Copy interrupted/
  );
  assert.deepEqual(await readdir(root), ["build"]);
  await saveArtifacts(build, output);
  assert.equal(
    await readFile(path.join(output, "build/chrome.zip"), "utf8"),
    "original bytes"
  );
});

async function fixture(t) {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "immer-local-release-test-")
  );
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "repo");
  const origin = path.join(temporary, "origin.git");
  await mkdir(root);
  const git = (...args) =>
    runCommand("git", args, { cwd: root, capture: true });
  git("init", "--quiet", "--bare", origin);
  git("init", "--quiet", "-b", "main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release@example.test");
  git("remote", "add", "origin", origin);
  await mkdir(path.join(root, "public"));
  await writeFile(path.join(root, ".gitignore"), "/dist-release/\n/build/\n");
  await writeFile(path.join(root, "package.json"), '{"version":"1.1.1"}\n');
  await writeFile(path.join(root, ".env"), "REACT_APP_VERSION=1.1.1\n");
  await writeFile(
    path.join(root, "public/manifest.json"),
    '{"version":"1.1.1"}\n'
  );
  await writeFile(path.join(root, "CHANGELOG.md"), "## v1.1.1\n\n- Fixed\n");
  git(
    "add",
    ".gitignore",
    "package.json",
    ".env",
    "public/manifest.json",
    "CHANGELOG.md"
  );
  git("commit", "--quiet", "-m", "Release source");
  git("push", "--quiet", "-u", "origin", "main");
  const sha = git("rev-parse", "HEAD");
  const calls = [];
  const state = {
    release: null,
    authError: false,
    failBuild: false,
    failPublish: false,
    wrongBuildSha: false,
  };
  const run = (command, args, options) => {
    calls.push([command, ...args]);
    if (command === "gh") {
      if (state.authError) throw new Error("HTTP 403");
      if (args[0] === "auth") return "";
      if (args.includes(".permissions.push")) return "true";
      if (args[1].includes("/tags/")) {
        if (state.release && !state.release.draft)
          return JSON.stringify(state.release);
        throw Object.assign(new Error("HTTP 404"), {
          stderr: Buffer.from("(HTTP 404)"),
        });
      }
      return JSON.stringify([state.release ? [state.release] : []]);
    }
    if (command === "pnpm") return "";
    if (command === process.execPath) {
      // The publication subprocess must see the exact source and an already pushed tag.
      assert.equal(
        runCommand("git", ["rev-parse", "HEAD"], {
          cwd: options.cwd,
          capture: true,
        }),
        sha
      );
      assert.match(
        git("ls-remote", "--tags", "origin", `refs/tags/${tag}^{}`),
        new RegExp(sha)
      );
      assert.equal(options.env.RELEASE_ROOT, options.cwd);
      if (state.failPublish) throw new Error("Upload interrupted");
      return "";
    }
    if (command === "git" && args.join(" ") === "remote get-url origin")
      return "https://github.com/boomytc/ImmerTranslate.git";
    return runCommand(command, args, options);
  };
  const check = async (source) => {
    calls.push(["check"]);
    if (state.failBuild) throw new Error("Build failed");
    for (const client of ["chrome", "edge"]) {
      await mkdir(path.join(source, "build", client), { recursive: true });
      await writeFile(
        path.join(source, "build", client, "manifest.json"),
        '{"version":"1.1.1"}'
      );
      await bestzip({
        cwd: path.join(source, "build"),
        source: client,
        destination: `${client}.zip`,
      });
    }
    await writeArtifactManifest(
      source,
      tag,
      state.wrongBuildSha ? "a".repeat(40) : sha
    );
  };
  return { root, git, run, check, calls, state, sha };
}

test("release options reject misspelled flags and invalid recovery versions", () => {
  assert.deepEqual(releaseOptions(["--", "--dry-run", "--tag", tag]), {
    dryRun: true,
    tag,
  });
  for (const args of [
    ["--dryrun"],
    ["--tag"],
    ["--tag", "v1.1.1-beta.1"],
    ["--dry-run", "--dry-run"],
  ])
    assert.throws(() => releaseOptions(args));
});

test("dry run saves verified artifacts, then publication reuses the same bytes", async (t) => {
  const data = await fixture(t);
  const output = await releaseLocal({ root: data.root, dryRun: true }, data);
  const bytes = await readFile(path.join(output, "build/chrome.zip"));
  assert.equal(data.git("tag", "--list"), "");
  assert.ok(!data.calls.some(([command]) => command === process.execPath));
  assert.equal(
    data.git("worktree", "list", "--porcelain").match(/^worktree /gm).length,
    1
  );
  await releaseLocal({ root: data.root }, data);
  assert.deepEqual(
    await readFile(path.join(output, "build/chrome.zip")),
    bytes
  );
  assert.equal(data.calls.filter(([command]) => command === "check").length, 1);
  assert.equal(
    data.calls.filter(([command]) => command === process.execPath).length,
    1
  );
  assert.equal(data.git("cat-file", "-t", `refs/tags/${tag}`), "tag");
});

test("dirty source and a non-main branch fail before authentication or building", async (t) => {
  const data = await fixture(t);
  await appendFile(path.join(data.root, "CHANGELOG.md"), "changed");
  await assert.rejects(
    releaseLocal({ root: data.root }, data),
    /clean worktree/
  );
  assert.ok(
    !data.calls.some(([command]) => command === "gh" || command === "check")
  );
  await writeFile(
    path.join(data.root, "CHANGELOG.md"),
    "## v1.1.1\n\n- Fixed\n"
  );
  data.git("switch", "--quiet", "-c", "feature");
  await assert.rejects(releaseLocal({ root: data.root }, data), /from main/);
});

test("auth errors and builds with a wrong source SHA cannot create tags", async (t) => {
  const data = await fixture(t);
  data.state.authError = true;
  await assert.rejects(releaseLocal({ root: data.root }, data), /403/);
  data.state.authError = false;
  data.state.wrongBuildSha = true;
  await assert.rejects(releaseLocal({ root: data.root }, data), /provenance/);
  assert.equal(data.git("tag", "--list"), "");
});

test("build failure cleans up the worktree and lock and permits a retry", async (t) => {
  const data = await fixture(t);
  data.state.failBuild = true;
  await assert.rejects(releaseLocal({ root: data.root }, data), /Build failed/);
  assert.equal(data.git("tag", "--list"), "");
  assert.equal(
    data.git("worktree", "list", "--porcelain").match(/^worktree /gm).length,
    1
  );
  data.state.failBuild = false;
  await releaseLocal({ root: data.root, dryRun: true }, data);
});

test("existing drafts or tags without original artifacts never cause a rebuild", async (t) => {
  const data = await fixture(t);
  data.state.release = { tag_name: tag, draft: true, assets: [] };
  await assert.rejects(
    releaseLocal({ root: data.root }, data),
    /Original local artifacts/
  );
  data.state.release = null;
  data.git("tag", "-a", tag, "-m", "Release");
  data.git("push", "--quiet", "origin", tag);
  await assert.rejects(
    releaseLocal({ root: data.root }, data),
    /Original local artifacts/
  );
  assert.ok(!data.calls.some(([command]) => command === "check"));
});

test("saved artifacts are checked before publication and are never overwritten", async (t) => {
  const data = await fixture(t);
  const output = await releaseLocal({ root: data.root, dryRun: true }, data);
  await appendFile(path.join(output, "build/chrome.zip"), "tampered");
  await assert.rejects(releaseLocal({ root: data.root }, data), /checksums/);
  assert.equal(data.git("tag", "--list"), "");
  assert.equal(data.calls.filter(([command]) => command === "check").length, 1);
});

test("old-tag recovery checks out its original source after main advances", async (t) => {
  const data = await fixture(t);
  await releaseLocal({ root: data.root, dryRun: true }, data);
  data.git("tag", "-a", tag, "-m", "Release");
  data.git("push", "--quiet", "origin", tag);
  await writeFile(
    path.join(data.root, "package.json"),
    '{"version":"1.1.2"}\n'
  );
  await writeFile(path.join(data.root, ".env"), "REACT_APP_VERSION=1.1.2\n");
  await writeFile(
    path.join(data.root, "public/manifest.json"),
    '{"version":"1.1.2"}\n'
  );
  await writeFile(
    path.join(data.root, "CHANGELOG.md"),
    "## v1.1.2\n\n- Next\n\n## v1.1.1\n\n- Fixed\n"
  );
  data.git(
    "add",
    "package.json",
    ".env",
    "public/manifest.json",
    "CHANGELOG.md"
  );
  data.git("commit", "--quiet", "-m", "Continue development");
  data.git("push", "--quiet", "origin", "main");
  await releaseLocal({ root: data.root, tag }, data);
  assert.equal(data.calls.filter(([command]) => command === "check").length, 1);
});

test("interrupted publication preserves the tag and artifacts for a retry", async (t) => {
  const data = await fixture(t);
  data.state.failPublish = true;
  await assert.rejects(
    releaseLocal({ root: data.root }, data),
    /Upload interrupted/
  );
  const output = path.join(data.root, "dist-release", `${tag}-${data.sha}`);
  const original = await readFile(path.join(output, "build/chrome.zip"));
  assert.match(
    data.git("ls-remote", "--tags", "origin", `refs/tags/${tag}^{}`),
    new RegExp(data.sha)
  );
  data.state.failPublish = false;
  await releaseLocal({ root: data.root }, data);
  assert.deepEqual(
    await readFile(path.join(output, "build/chrome.zip")),
    original
  );
  assert.equal(data.calls.filter(([command]) => command === "check").length, 1);
});

test("a main change during the build stops before tagging or publication", async (t) => {
  const data = await fixture(t);
  const check = async (...args) => {
    await data.check(...args);
    await appendFile(
      path.join(data.root, "CHANGELOG.md"),
      "\n- Concurrent fix\n"
    );
    data.git("add", "CHANGELOG.md");
    data.git("commit", "--quiet", "-m", "Concurrent change");
    data.git("push", "--quiet", "origin", "main");
  };
  await assert.rejects(
    releaseLocal({ root: data.root }, { ...data, check }),
    /main changed/
  );
  assert.equal(data.git("tag", "--list"), "");
  assert.ok(!data.calls.some(([command]) => command === process.execPath));
});

test("concurrent releases cannot share the artifact directory", async (t) => {
  const data = await fixture(t);
  await mkdir(path.join(data.root, "dist-release"));
  await writeFile(path.join(data.root, "dist-release/.release.lock"), "held");
  await assert.rejects(
    releaseLocal({ root: data.root }, data),
    /Another release/
  );
  assert.ok(!data.calls.some(([command]) => command === "check"));
});

test("local checks stop on a failing test and reject source mutations", async (t) => {
  const data = await fixture(t);
  const calls = [];
  assert.throws(
    () =>
      runChecks(data.root, "HEAD", (_, args) => {
        calls.push(args[0]);
        if (args[0] === "test:release") throw new Error("Tests failed");
      }),
    /Tests failed/
  );
  assert.ok(!calls.includes("build+zip"));
  assert.throws(
    () =>
      runChecks(data.root, "HEAD", (_, args) => {
        if (args[0] === "release:artifacts")
          data.git("mv", "CHANGELOG.md", "changed.md");
      }),
    /changed source/
  );
});

test("local checks reject reintroduced workflows before running any commands", async (t) => {
  const data = await fixture(t);
  await mkdir(path.join(data.root, ".github/workflows"), { recursive: true });
  await writeFile(
    path.join(data.root, ".github/workflows/ci.yml"),
    "name: obsolete\n"
  );
  assert.throws(
    () =>
      runChecks(data.root, "HEAD", () =>
        assert.fail("must stop before running checks")
      ),
    /workflows are disabled/
  );
});

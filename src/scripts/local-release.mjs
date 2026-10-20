import { cp, mkdir, mkdtemp, open, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand, runChecks } from "./check.mjs";
import {
  readVersionFiles,
  validateReleaseSources,
  assertVersion,
} from "./version-files.mjs";
import { verifyArtifactManifest } from "./release-artifacts.mjs";
import { getGithubRelease } from "./github-release.mjs";

const repository = "boomytc/ImmerTranslate";
const scripts = fileURLToPath(new URL("./", import.meta.url));

export function releaseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--") continue;
    if (args[i] === "--dry-run" && !options.dryRun) options.dryRun = true;
    else if (args[i] === "--tag" && !options.tag) {
      options.tag = args[++i];
      if (!options.tag?.startsWith("v"))
        throw new Error("Expected --tag v<version>");
      assertVersion(options.tag.slice(1));
    } else throw new Error(`Unknown or repeated option: ${args[i]}`);
  }
  return options;
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

export async function saveArtifacts(build, output, copy = cp) {
  const staging = await mkdtemp(path.join(path.dirname(output), ".staging-"));
  try {
    await copy(build, path.join(staging, "build"), { recursive: true });
    await rename(staging, output);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

// Inject the command runner and build only for offline lifecycle tests.
export async function releaseLocal(
  { root, dryRun = false, tag: requestedTag },
  { run = runCommand, check = runChecks } = {}
) {
  const git = (...args) => run("git", args, { cwd: root, capture: true });
  const gh = (...args) => run("gh", args, { cwd: root, capture: true });
  const cleanMain = () => {
    if (git("branch", "--show-current") !== "main")
      throw new Error("Release from main");
    if (git("status", "--porcelain=v1"))
      throw new Error("Release requires a clean worktree");
  };
  cleanMain();
  if (
    !/^(?:https:\/\/github\.com\/|git@github\.com:)boomytc\/ImmerTranslate(?:\.git)?$/.test(
      git("remote", "get-url", "origin")
    )
  )
    throw new Error("origin must be boomytc/ImmerTranslate on GitHub");
  git("fetch", "--quiet", "--tags", "origin", "main");
  const head = git("rev-parse", "HEAD");
  if (head !== git("rev-parse", "origin/main"))
    throw new Error("main must equal origin/main");
  const [{ version }] = await readVersionFiles(root);
  const tag = requestedTag || `v${version}`;
  assertVersion(tag.slice(1));
  const remoteTag = () => {
    const refs = git(
      "ls-remote",
      "--tags",
      "origin",
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`
    );
    const entries = refs
      ? refs.split("\n").map((line) => line.split(/\s+/))
      : [];
    return (
      entries.find((entry) => entry[1].endsWith("^{}"))?.[0] || entries[0]?.[0]
    );
  };
  const remoteSha = remoteTag();
  if (requestedTag && !remoteSha)
    throw new Error("Recovery requires an existing remote tag");
  const sha = requestedTag ? remoteSha : head;
  if (remoteSha && remoteSha !== sha)
    throw new Error(
      "Remote tag differs from HEAD; use --tag to recover its original commit"
    );
  git("merge-base", "--is-ancestor", sha, "origin/main");
  const localTag = git("tag", "--list", tag);
  if (localTag && git("rev-parse", `${tag}^{commit}`) !== sha)
    throw new Error("Local release tag points to another commit");
  if (
    !remoteSha &&
    localTag &&
    git("cat-file", "-t", `refs/tags/${tag}`) !== "tag"
  )
    throw new Error("New release requires an annotated tag");
  gh("auth", "status");
  if (gh("api", `repos/${repository}`, "--jq", ".permissions.push") !== "true")
    throw new Error(
      "GitHub push access is required to find drafts and publish"
    );
  const release = getGithubRelease(repository, tag, gh);
  const output = path.join(root, "dist-release", `${tag}-${sha}`);
  const saved = await exists(output);
  if ((release || remoteSha || localTag) && !saved)
    throw new Error(
      "Original local artifacts are missing; refusing to rebuild an existing tag or release"
    );

  await mkdir(path.dirname(output), { recursive: true });
  const lockPath = path.join(root, "dist-release", ".release.lock");
  const lock = await open(lockPath, "wx").catch((error) => {
    if (error.code === "EEXIST")
      throw new Error(
        `Another release holds ${lockPath}; check for an interrupted process before removing the lock`
      );
    throw error;
  });
  let temporary;
  let source;
  try {
    temporary = await mkdtemp(path.join(os.tmpdir(), "immer-release-"));
    source = path.join(temporary, "source");
    git("worktree", "add", "--quiet", "--detach", source, sha);
    await validateReleaseSources(source, tag);
    if (saved) {
      await cp(path.join(output, "build"), path.join(source, "build"), {
        recursive: true,
      });
    } else {
      run("pnpm", ["install", "--frozen-lockfile"], { cwd: source });
      // Check every change since the previous release, including the first commit.
      const tags = git("tag", "--merged", sha, "--sort=-version:refname")
        .split("\n")
        .filter((value) => /^v\d+\.\d+\.\d+$/.test(value));
      const base = tags[0] || git("hash-object", "-t", "tree", "--stdin");
      await check(source, base);
      await verifyArtifactManifest(source, tag, sha);
      await saveArtifacts(path.join(source, "build"), output);
    }
    await verifyArtifactManifest(source, tag, sha);
    if (dryRun) {
      console.log(
        `Verified ${tag} (${sha}); artifacts: ${output}\nDry run: no tag or Release was created.`
      );
      return output;
    }
    cleanMain();
    if (
      git("rev-parse", "HEAD") !== head ||
      git("ls-remote", "--heads", "origin", "refs/heads/main").split(
        /\s+/
      )[0] !== head
    )
      throw new Error("main changed during release; refusing publication");
    if (remoteTag() !== remoteSha)
      throw new Error(
        "Remote tag changed during release; refusing publication"
      );
    if (!remoteSha) {
      if (!localTag)
        git("tag", "-a", tag, "-m", `Release version ${version}`, sha);
      git("push", "origin", `refs/tags/${tag}`);
    }
    run(process.execPath, [path.join(scripts, "publish-release-cli.mjs")], {
      cwd: source,
      env: {
        ...process.env,
        RELEASE_ROOT: source,
        RELEASE_TAG: tag,
        GITHUB_REPOSITORY: repository,
      },
    });
    return output;
  } finally {
    try {
      if (source && (await exists(source)))
        git("worktree", "remove", "--force", source);
      if (temporary) await rm(temporary, { recursive: true, force: true });
    } finally {
      await lock.close();
      await rm(lockPath);
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await releaseLocal({
      root: fileURLToPath(new URL("../../", import.meta.url)),
      ...releaseOptions(process.argv.slice(2)),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

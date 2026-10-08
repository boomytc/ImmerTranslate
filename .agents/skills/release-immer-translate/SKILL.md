---
name: release-immer-translate
description: Safely automate a complete ImmerTranslate release using the repository's version scripts, Chinese CHANGELOG convention, pull requests into main, annotated version tags, and GitHub Actions release workflow. Use when asked to bump the project version, prepare a release, update release notes, create and merge the release PR, publish a version tag, or complete the end-to-end ImmerTranslate release process without intermediate confirmations.
---

# Release ImmerTranslate

Follow the version-script sections of `VERSION_MANAGEMENT.md` and the repository's current scripts and workflow files. This repository integrates and publishes on `main`. Ignore any `dev` → `master` procedure still written in `VERSION_MANAGEMENT.md`. Treat `package.json` as the only version source. Never perform only part of a requested full release silently: report the exact completed stage and any remaining gate.

## Safety rules

- Treat a request to complete a release as authorization to merge the release PR into `main` and create and push the release tag after every required check passes. Do not pause for confirmation at either step.
- Never push commits directly to `main`, force-push, overwrite a tag, bypass a failed check, or merge a release PR before all required checks pass.
- Stop on a dirty worktree, a base other than the latest `origin/main`, divergent local/remote `main`, invalid GitHub authentication, an existing target tag, version disagreement, unexpected formatted files, failed checks, or failed builds.
- Do not stash, reset, discard, or absorb unrelated user changes. Do not repair authentication or change repository settings without a separate request.
- Use the repository's existing `pnpm version:*` commands. Do not manually edit `.env` or manifest versions.

## 1. Inspect and choose the release

1. Read `VERSION_MANAGEMENT.md` for the version source and `pnpm version:*` commands, `package.json`, the top of `CHANGELOG.md`, `src/scripts/update-version.mjs`, `src/scripts/sync-version.mjs`, and `.github/workflows/release.yml`. Current repository files override examples in this skill. The `main` branch model in this skill overrides any `dev` / `master` instructions.
2. Run read-only preflight checks:

   ```bash
   git status --short --branch
   git branch --show-current
   git fetch origin --prune --tags
   git rev-list --left-right --count main...origin/main
   gh auth status
   git tag --sort=-version:refname
   ```

3. Require a clean worktree and `main...origin/main` equal to `0 0`. Check out `main` only when the worktree is clean, run `git pull --ff-only origin main`, and recheck.
4. If the user did not specify the bump, ask them to choose `patch`, `minor`, `major`, or an exact SemVer version. Do not infer the release class from commits.
5. Compute the target version before changing files. Verify that `v<target>` does not exist locally or remotely and that no open pull request into `main` conflicts with this release.

## 2. Prepare the release from main

1. From the updated `main`, create a release branch. Do not commit the version bump on `main`:

   ```bash
   git checkout -b codex/release-v<target>
   ```

2. Run exactly one matching command:

   ```bash
   pnpm version:patch
   pnpm version:minor
   pnpm version:major
   pnpm version:set -- <version>
   ```

3. Confirm `package.json`, `.env`, `public/manifest.json`, `public/manifest.firefox.json`, and `public/manifest.thunderbird.json` all contain the target version.
4. Find the latest version tag with `git tag --sort=-version:refname`. When a tag exists, review `git log --oneline --no-merges <latest-tag>..HEAD`. When none exists, review commits since the current top `CHANGELOG.md` heading. Then prepend one `## v<target>` section to `CHANGELOG.md`:
   - Write concise Chinese bullets describing user-visible changes.
   - Summarize behavior rather than copying commit messages mechanically.
   - Exclude merges, formatting-only work, and internal implementation detail unless release-relevant.
   - Preserve UTF-8 and every existing historical entry unchanged.
5. Format only reviewed changed files, then run `pnpm format:check origin/main`, `pnpm release:check`, `pnpm test:release` and `CI=true pnpm run test --watchAll=false --runInBand`. Inspect the complete diff and stop on unrelated formatting. `pnpm build` must not format source files.
6. Run `pnpm build+zip`, then recheck all version values, the top CHANGELOG heading, `git diff --check`, and the complete diff.
7. Stage only the reviewed release files. Commit as `chore: bump version to <target>` and push the release branch with `git push -u origin codex/release-v<target>`. Do not use `git add .`. Do not push this commit to `main`.

## 3. Create and merge the release PR

1. Create or reuse the single open pull request into `main` titled `Release v<target>`. Include the new CHANGELOG section in its body.
2. Watch all required checks to completion. If any check fails, stop and report it; do not merge.
3. Present the PR URL, target version, checks, and release-note summary as a progress update without pausing.
4. After all required checks pass, merge into `main` using the repository's current pull-request merge method. Verify the PR is merged and record the commit that landed on `main`.

## 4. Publish the tag

1. Synchronize `main` without writing the release commit directly to it:

   ```bash
   git checkout main
   git pull --ff-only origin main
   ```

2. Verify `main` contains the recorded release commit, the target version in every version file, and `## v<target>` as the first CHANGELOG section. Recheck that `v<target>` does not exist locally or remotely.
3. Report the exact tag command and explain that pushing an annotated `v*` tag triggers `.github/workflows/release.yml`, then continue without pausing.
4. After every verification passes, run automatically:

   ```bash
   git tag -a v<target> -m "Release version <target>"
   git push origin v<target>
   ```

5. Find the tag-triggered `release.yml` run, watch it to completion, and verify `gh release view v<target>`. Confirm all five `immer-translate_v<target>_<client>.zip` assets and `immer-translate_v<target>_manifest.json` are present, and Pages version agrees. For a failed upload or Pages deploy, use the original run artifact with the documented guarded recovery workflow; never clobber assets or rebuild replacements. Report failures without retrying destructive or publication steps automatically.

## 5. Report

Report the released version, PR URL, the commit on `main`, tag, workflow result, GitHub Release URL, and final branch state. If a step fails after the tag or Release exists, leave published history untouched and report the exact recovery point.

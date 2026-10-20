---
name: release-immer-translate
description: Prepare and publish an ImmerTranslate version using the existing version scripts, Chinese CHANGELOG, a PR into main, and the local pnpm release command. Use for version bumps, release preparation, publication, or recovery. The repository does not use GitHub Actions.
---

# Release ImmerTranslate

Read `VERSION_MANAGEMENT.md`, `package.json`, the top of `CHANGELOG.md`, and `src/scripts/local-release.mjs`. Treat `package.json` as the only version source; Chrome and Edge use stable versions. GitHub hosts code, PRs, tags, and Releases; checks and publication run locally.

A request to complete a release authorizes its release PR merge and `pnpm release` after checks pass; do not ask for intermediate confirmations. A request only to prepare a release or change tooling does not authorize publication. Never force-push, overwrite tags/assets, absorb unrelated edits, or push release commits directly to main.

## Prepare

1. Require a clean worktree, valid GitHub authentication, and local main equal to the latest `origin/main`. Fetch tags and inspect open release PRs before choosing the target. Ask for patch/minor/major or an exact stable version when unspecified; do not infer the bump from commits.
2. Create `codex/release-v<target>` from current main. Run the matching `pnpm version:patch`, `version:minor`, `version:major`, or `version:set -- <version>` command. Do not edit `.env` or manifest versions separately.
3. Review changes since the previous version and prepend a nonempty Chinese `## v<target>` CHANGELOG section describing user-visible behavior. Preserve historical entries. Confirm all version files agree and the target tag and Release do not exist locally or remotely.
4. Format only reviewed files, run `pnpm check -- origin/main`, and inspect the complete diff. Stop on failed checks, version disagreement, source changes caused by the build, or unrelated formatting.
5. Commit only reviewed release files as `chore: bump version to <target>`, push the release branch, and create or reuse the release PR into main. Attach the PR to the current chat using the available app tool. Record local check results in its description. There is no Actions run to wait for; report blocking branch protections rather than bypassing them or changing settings without authorization.

## Publish

After checks pass, merge the PR using the repository's normal merge method. Synchronize main and record its landed SHA. Run `pnpm release -- --dry-run`, then `pnpm release`. The command enforces clean main, current remote state, isolated builds, versions and checksums, preserved original artifacts, annotated tags, and verified draft publication. Do not manually tag as a substitute or reintroduce workflows.

Verify `gh release view v<target>` and its Chrome/Edge ZIPs plus `immer-translate_v<target>_manifest.json`. Report PR, source SHA, tag, Release URL, local checks, and final branch state. Distinguish automated checks from actual browser upgrade validation.

## Recover

Preserve `dist-release/v<version>-<sourceSHA>/build/` and any remote draft. Re-run `pnpm release` to resume missing uploads; if main has advanced, run `pnpm release -- --tag v<original-version>`. Recovery uses the original tag source and byte-identical local artifacts. Missing original artifacts, provenance conflicts, or incomplete published Releases stop recovery; never clobber, retag, or rebuild replacements. See `VERSION_MANAGEMENT.md` for recovering historical downloaded artifacts and interrupted local locks.

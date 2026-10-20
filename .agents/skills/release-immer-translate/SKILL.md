---
name: release-immer-translate
description: Prepare and publish an ImmerTranslate version using the existing version scripts, Chinese CHANGELOG, dev-to-main synchronization, and the local pnpm release command. Use for version bumps, release preparation, publication, or recovery. The repository does not use GitHub Actions.
---

# Release ImmerTranslate

Read `VERSION_MANAGEMENT.md`, `package.json`, the top of `CHANGELOG.md`, and `src/scripts/local-release.mjs`. Treat `package.json` as the only version source; Chrome and Edge use stable versions. GitHub hosts code, PRs, tags, and Releases; checks and publication run locally.

A request to complete a release authorizes pushing dev, synchronizing main from dev, and `pnpm release` after checks pass; do not ask for intermediate confirmations. A request only to prepare a release or change tooling does not authorize publication. Never force-push, overwrite tags/assets, absorb unrelated edits, or commit version changes directly on main.

Use the existing `dev` branch for development and version preparation. Do not create task or release branches without explicit user authorization. Whether an extra branch is authorized depends on the current request and cannot be inferred by repository code.

## Prepare

1. Require a clean worktree and valid GitHub authentication. Fetch remote branches and tags, switch to dev, and inspect divergence from `origin/dev` and `origin/main`; do not absorb unrelated pending work into a release. Ask for patch/minor/major or an exact stable version when unspecified; do not infer the bump from commits.
2. On dev, run the matching `pnpm version:patch`, `version:minor`, `version:major`, or `version:set -- <version>` command. Do not edit `.env` or manifest versions separately.
3. Review changes since the previous version and prepend a nonempty Chinese `## v<target>` CHANGELOG section describing user-visible behavior. Preserve historical entries. Confirm all version files agree and the target tag and Release do not exist locally or remotely.
4. Format only reviewed files, run `pnpm check -- origin/main`, and inspect the complete diff. Stop on failed checks, version disagreement, source changes caused by the build, or unrelated formatting.
5. Commit only reviewed release files on dev as `chore: bump version to <target>` and push dev first. Synchronize local main with origin/main, fast-forward main from dev, then push main and return to dev. Stop on divergent histories rather than forcing or squashing. If branch protection requires a PR, use dev → main and attach that PR to the current chat. There is no Actions run to wait for; report blocking branch protections rather than bypassing them or changing settings without authorization.

## Publish

After dev → main synchronization, switch to clean main equal to origin/main and record its landed SHA. Run `pnpm release -- --dry-run`, then `pnpm release`. The command enforces clean main, current remote state, isolated builds, versions and checksums, preserved original artifacts, annotated tags, and verified draft publication. Do not manually tag as a substitute or reintroduce workflows. Return to dev after publication.

Verify `gh release view v<target>` and its Chrome/Edge ZIPs plus `immer-translate_v<target>_manifest.json`. Report dev/main synchronization, source SHA, tag, Release URL, local checks, and final branch state; include a PR link when one was used. Distinguish automated checks from actual browser upgrade validation.

## Recover

Preserve `dist-release/v<version>-<sourceSHA>/build/` and any remote draft. Re-run `pnpm release` to resume missing uploads; if main has advanced, run `pnpm release -- --tag v<original-version>`. Recovery uses the original tag source and byte-identical local artifacts. Missing original artifacts, provenance conflicts, or incomplete published Releases stop recovery; never clobber, retag, or rebuild replacements. See `VERSION_MANAGEMENT.md` for recovering historical downloaded artifacts and interrupted local locks.

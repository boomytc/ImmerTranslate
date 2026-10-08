import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function selectOriginalArtifact({
  run,
  artifacts,
  name,
  runId,
  currentRunId,
}) {
  if (
    run.path !== ".github/workflows/release.yml" ||
    !["push", "workflow_dispatch"].includes(run.event)
  ) {
    throw new Error("Recovery requires an original release workflow run");
  }
  const matches = artifacts.filter(
    (item) => item.name === name && !item.expired
  );
  if (matches.length > 1)
    throw new Error("Ambiguous original release artifact");
  if (!matches.length && runId !== currentRunId) {
    throw new Error(
      "Original build artifact is missing or expired; do not rebuild a partial release"
    );
  }
  return matches.length === 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const run = JSON.parse(
      readFileSync(`${process.env.RUNNER_TEMP}/original-run.json`)
    );
    const { artifacts } = JSON.parse(
      readFileSync(`${process.env.RUNNER_TEMP}/original-artifacts.json`)
    );
    const found = selectOriginalArtifact({
      run,
      artifacts,
      name: process.env.ARTIFACT_NAME,
      runId: process.env.ARTIFACT_RUN_ID,
      currentRunId: process.env.GITHUB_RUN_ID,
    });
    if (!found && process.env.RELEASE_EXISTS !== "false") {
      throw new Error(
        "Release exists or its state is unknown; recover using its original artifact_run_id"
      );
    }
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `found=${found}\nrun_id=${process.env.ARTIFACT_RUN_ID}\n`
    );
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  }
}

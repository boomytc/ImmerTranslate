import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function runCommand(
  command,
  args,
  { cwd, capture = false, ...options } = {}
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32" && command === "pnpm",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Object.assign(
      new Error(
        result.stderr?.trim() ||
          `${command} ${args.join(" ")} failed (${result.status})`
      ),
      { status: result.status, stderr: result.stderr }
    );
  return result.stdout?.trim() || "";
}

function sourceState(root) {
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  return git("status", "--porcelain=v1") + git("diff", "HEAD", "--binary");
}

export function runChecks(root, base = "HEAD", run = runCommand) {
  let workflows = [];
  try {
    workflows = readdirSync(path.join(root, ".github/workflows"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (workflows.some((file) => /\.ya?ml$/.test(file)))
    throw new Error(
      "GitHub workflows are disabled; use local check and release commands"
    );
  const before = sourceState(root);
  for (const args of [
    ["format:check", base],
    ["release:check"],
    ["test:release"],
    ["run", "test", "--watchAll=false", "--runInBand"],
    ["build+zip"],
    ["release:artifacts"],
  ]) {
    run("pnpm", args, { cwd: root, env: { ...process.env, CI: "true" } });
  }
  if (sourceState(root) !== before)
    throw new Error(
      "Checks or build changed source files; review the diff before continuing"
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2).filter((arg) => arg !== "--");
    if (args.length > 1)
      throw new Error("Usage: pnpm check [-- <format-base>]");
    runChecks(fileURLToPath(new URL("../../", import.meta.url)), args[0]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

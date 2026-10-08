import { execFileSync, spawnSync } from "node:child_process";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\0");
const base = process.argv[2] || "HEAD";
const files = [
  ...new Set([
    ...git("diff", "--name-only", "--diff-filter=ACMR", "-z", base),
    ...git("ls-files", "--others", "--exclude-standard", "-z"),
  ]),
].filter((file) => /\.(?:js|mjs|json|html|md|ya?ml)$/.test(file));

if (files.length) {
  const result = spawnSync("prettier", ["--check", ...files], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  console.log("No changed files require formatting checks.");
}

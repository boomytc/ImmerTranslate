#!/usr/bin/env zx
import { fileURLToPath } from "node:url";
import { chalk, fs, path, quote, $, ProcessOutput } from "zx";

// 在 Windows 上使用 cmd.exe，避免 zx 默认使用 WSL bash 导致 node not found
if (process.platform === "win32") {
  $.shell = "cmd.exe";
  $.prefix = "";
  $.quote = quote;
}

const VALID_TARGETS = new Set(["chrome", "edge"]);
const scriptPath = fileURLToPath(import.meta.url);

function resolvePath(value) {
  const resolved = path.resolve(value);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function getScriptArgs(rawArgv = process.argv) {
  const canonicalScript = resolvePath(scriptPath);
  const scriptIndex = rawArgv.findIndex(
    (arg, index) => index >= 1 && resolvePath(arg) === canonicalScript
  );
  return scriptIndex === -1 ? [] : rawArgv.slice(scriptIndex + 1);
}

function parseBuildTarget(args) {
  let target;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") continue;
    let value;
    if (arg === "--target") {
      if (i + 1 >= args.length || args[i + 1] === "--") {
        throw new Error(
          "Error: Please specify a target, e.g., --target=chrome"
        );
      }
      value = args[++i];
    } else if (arg.startsWith("--target=")) {
      value = arg.slice("--target=".length);
    } else {
      throw new Error(`Unknown or repeated option: ${arg}`);
    }
    if (target !== undefined) {
      throw new Error(`Unknown or repeated option: ${arg}`);
    }
    target = value;
  }
  if (!target) {
    throw new Error("Error: Please specify a target, e.g., --target=chrome");
  }
  if (!VALID_TARGETS.has(target)) {
    throw new Error(`Unsupported build target: ${target}`);
  }
  return target;
}

// 用法: zx src/scripts/build-task.mjs --target=chrome
let target;

try {
  target = parseBuildTarget(getScriptArgs());
  const buildRoot = "build";
  const targetDir = path.join(buildRoot, target);
  const inDest = (file) => path.join(targetDir, file);

  console.log(
    chalk.blue(`\n🚀 Starting build task for: ${chalk.bold(target)}`)
  );

  if (target === "edge") {
    const chromeDir = path.join(buildRoot, "chrome");
    if (!(await fs.pathExists(chromeDir))) {
      throw new Error(
        'Chrome build not found! Please run "pnpm build:chrome" first.'
      );
    }
    await fs.remove(targetDir);
    await fs.copy(chromeDir, targetDir);
    console.log(chalk.green("✅ Copied Chrome build to Edge."));
  } else {
    await fs.remove(targetDir);
    process.env.BUILD_PATH = `./${targetDir}`;
    process.env.REACT_APP_CLIENT = target;
    process.env.FORCE_COLOR = "1";
    process.env.NODE_OPTIONS = [
      process.env.NODE_OPTIONS,
      "--disable-warning=DEP0176",
    ]
      .filter(Boolean)
      .join(" ");

    console.log(chalk.gray(`Running react-app-rewired build...`));
    await $({ stdio: "inherit" })`react-app-rewired build`;
  }

  // 后处理：文件清理
  console.log(chalk.gray(`Running post-build cleanups...`));

  await fs.remove(inDest("content.html"));

  console.log(
    chalk.green(`✅ Build task for [${target}] completed successfully!`)
  );
} catch (err) {
  console.error(
    chalk.red(`\n❌ Build failed${target ? ` for ${target}` : ""}:`)
  );
  if (!(err instanceof ProcessOutput)) {
    console.error(err);
  }
  process.exit(1);
}

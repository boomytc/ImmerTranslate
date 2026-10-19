#!/usr/bin/env zx
import { argv, quote, $, ProcessOutput } from "zx";

// 在 Windows 上使用 cmd.exe，避免 zx 默认使用 WSL bash 导致 node not found
if (process.platform === "win32") {
  $.shell = "cmd.exe";
  $.prefix = "";
  $.quote = quote;
}

// 用法: zx src/scripts/build-task.mjs --target=chrome
const target = argv.target;

if (!target) {
  console.error(
    chalk.red("Error: Please specify a target, e.g., --target=chrome")
  );
  process.exit(1);
}

const buildRoot = "build";
const targetDir = path.join(buildRoot, target);

// 辅助：获取构建目录下的文件路径
const inDest = (file) => path.join(targetDir, file);

console.log(chalk.blue(`\n🚀 Starting build task for: ${chalk.bold(target)}`));

try {
  // 1. 【清理】 清空当前目标的构建目录
  await fs.remove(targetDir);

  // 2. 【构建】 区分普通构建和特殊构建（如 Edge）
  if (target !== "chrome" && target !== "edge") {
    throw new Error(`Unsupported build target: ${target}`);
  }

  if (target === "edge") {
    // Edge 特殊逻辑：直接复制 Chrome 构建结果
    const chromeDir = path.join(buildRoot, "chrome");
    if (!(await fs.pathExists(chromeDir))) {
      throw new Error(
        'Chrome build not found! Please run "pnpm build:chrome" first.'
      );
    }
    await fs.copy(chromeDir, targetDir);
    console.log(chalk.green("✅ Copied Chrome build to Edge."));
  } else {
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

  // 3. 【后处理】 文件清理与移动
  console.log(chalk.gray(`Running post-build cleanups...`));

  await fs.remove(inDest("content.html"));

  console.log(
    chalk.green(`✅ Build task for [${target}] completed successfully!`)
  );
} catch (err) {
  console.error(chalk.red(`\n❌ Build failed for ${target}:`));
  if (!(err instanceof ProcessOutput)) {
    console.error(err);
  }
  process.exit(1);
}

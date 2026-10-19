#!/usr/bin/env zx

console.log(chalk.cyan("\nStarting compression tasks...\n"));

// 1. 进入 build 目录
cd("build");

// 2. 清理旧的 zip 文件
for (const file of await fs.readdir(".")) {
  if (file.endsWith(".zip")) await fs.remove(file);
}

/**
 * 定义打包任务配置
 * * @property {string} output - 输出文件名
 * @property {string} source - 要打包的源（文件或目录名）
 * @property {string} [cwd]  - (可选) 执行打包命令时所在的目录。
 */
const tasks = [
  { output: "chrome.zip", source: "chrome" },
  { output: "edge.zip", source: "edge" },
];

try {
  for (const task of tasks) {
    console.log(`Zipping folder ${task.source}...`);
    await $`bestzip ${task.output} ${task.source}`;
  }
  console.log(chalk.green("\n✅ All zip files created successfully."));
} catch (err) {
  console.error(chalk.red("❌ Error during zipping:"), err);
  process.exit(1);
}

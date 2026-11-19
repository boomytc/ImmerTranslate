#!/usr/bin/env zx
import { argv } from "zx";
import { assertVersion, syncVersion } from "./version-files.mjs";

/**
 * 把更新日期写成 YY.MMDD.HHMM，并同步到 .env 与扩展清单。
 *
 * 用法:
 *   pnpm updated
 *   pnpm version:set -- 26.1119.1740
 */

const rootDir = path.resolve(__dirname, "../..");
const command = argv._[0] || "today";

const todayId = () => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}.${month}${day}.${hour}${minute}`;
};

console.log(chalk.blue(`\n更新扩展日期...\n`));

try {
  const next = command === "set" ? argv._[1] : todayId();
  if (command === "set" && !next) {
    throw new Error("请指定日期，例如: pnpm version:set -- 26.1119.1740");
  }
  if (!["today", "set"].includes(command)) {
    throw new Error(`Unsupported update command: ${command}`);
  }
  assertVersion(next);

  const pkgPath = path.join(rootDir, "package.json");
  const pkg = await fs.readJSON(pkgPath);
  const previous = pkg.version;
  pkg.version = next;
  await fs.writeJSON(pkgPath, pkg, { spaces: 2 });
  await fs.appendFile(pkgPath, "\n");
  console.log(chalk.gray(`${previous} -> ${next}`));

  const { version, updated } = await syncVersion(rootDir);
  console.log(chalk.green(`日期已同步: ${version}（${updated} 个文件）`));
  console.log(chalk.gray(`CHANGELOG.md 顶部写 ## ${version}\n`));
} catch (err) {
  console.error(chalk.red("\n更新日期失败:"));
  console.error(err.message);
  process.exit(1);
}

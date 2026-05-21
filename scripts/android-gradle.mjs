import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const androidDir = path.resolve(repoRoot, "android-app");
const taskArgs = process.argv.slice(2);

if (taskArgs.length === 0) {
  console.error("No Gradle tasks provided. Example: npm run android:gradle -- assembleRelease");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const gradleExecutable = isWindows ? "gradlew.bat" : "./gradlew";
const command = isWindows ? "cmd.exe" : gradleExecutable;
const commandArgs = isWindows ? ["/c", gradleExecutable, ...taskArgs] : taskArgs;

const processRef = spawn(command, commandArgs, {
  cwd: androidDir,
  stdio: "inherit",
  env: process.env
});

processRef.on("close", (code) => {
  process.exit(code ?? 1);
});

processRef.on("error", (error) => {
  console.error("Failed to run Android Gradle wrapper.");
  console.error(error);
  process.exit(1);
});

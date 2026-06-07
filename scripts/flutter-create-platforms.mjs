import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const flutterAppDir = path.resolve(repoRoot, "flutter-app");

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

try {
  await run("flutter", ["--version"], { cwd: flutterAppDir });
  await run("flutter", ["create", ".", "--platforms=ios,android", "--project-name", "boardstate_flutter"], {
    cwd: flutterAppDir,
  });
  await run("flutter", ["pub", "get"], { cwd: flutterAppDir });
  console.log("Flutter iOS/Android platform folders are ready.");
} catch (error) {
  console.error("Could not create Flutter platform folders.");
  console.error("Install Flutter first, then rerun `npm run flutter:create-platforms` from the repo root.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

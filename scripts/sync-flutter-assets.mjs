import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const flutterWebBuildDir = path.resolve(repoRoot, "output", "flutter-web");
const flutterAssetsDir = path.resolve(repoRoot, "flutter-app", "assets", "boardstate");

async function ensureFlutterWebBuildExists() {
  try {
    const buildStats = await stat(flutterWebBuildDir);
    if (!buildStats.isDirectory()) {
      throw new Error("Flutter web build path is not a directory.");
    }
  } catch (error) {
    throw new Error(
      "Could not find /output/flutter-web. Run `npm run flutter:web` first so Flutter can bundle the current BoardState web app.",
      { cause: error }
    );
  }
}

async function syncFlutterAssets() {
  await ensureFlutterWebBuildExists();
  await rm(flutterAssetsDir, { recursive: true, force: true });
  await mkdir(flutterAssetsDir, { recursive: true });
  await cp(flutterWebBuildDir, flutterAssetsDir, { recursive: true });
}

try {
  await syncFlutterAssets();
  console.log(`Synced Flutter web assets: ${flutterWebBuildDir} -> ${flutterAssetsDir}`);
} catch (error) {
  console.error("Flutter asset sync failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

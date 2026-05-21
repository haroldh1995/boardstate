import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.resolve(repoRoot, "dist");
const androidAssetsDir = path.resolve(repoRoot, "android-app", "app", "src", "main", "assets", "www");

async function ensureDistExists() {
  try {
    const distStats = await stat(distDir);
    if (!distStats.isDirectory()) {
      throw new Error("dist path is not a directory");
    }
  } catch (error) {
    throw new Error(
      "Could not find /dist. Run `npm run build` first so Android can bundle the production web app.",
      { cause: error }
    );
  }
}

async function syncAssets() {
  await ensureDistExists();
  await rm(androidAssetsDir, { recursive: true, force: true });
  await mkdir(androidAssetsDir, { recursive: true });
  await cp(distDir, androidAssetsDir, { recursive: true });
}

try {
  await syncAssets();
  console.log(`Synced web assets: ${distDir} -> ${androidAssetsDir}`);
} catch (error) {
  console.error("Android asset sync failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

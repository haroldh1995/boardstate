import { createStore } from "./state/store.js";
import { createLoadingScreenController } from "./ui/loadingScreen.js";
import { mountApp } from "./ui/render.js";
import loadingDragonUrl from "../assets/boardstate-loading-dragon.jpg";
import landscapeWallpaperUrl from "../assets/boardstate-bg-landscape.png";

const LANDSCAPE_LOCK_MODES = Object.freeze(["landscape", "landscape-primary"]);
const root = document.querySelector("#app");
const loading = createLoadingScreenController({
  assets: [loadingDragonUrl, landscapeWallpaperUrl],
});

bootstrap();

async function bootstrap() {
  try {
    requestBoardStateLandscapeLock();
    await loading.waitForFirstPaint();
    await loading.runStep(12, "Awakening the board...", () => Promise.resolve());
    await loading.runStep(26, "Loading dragon wards...", () => loading.preloadVisualAssets());
    await loading.runStep(38, "Checking local storage...", () => {
      try {
        return Promise.resolve(localStorage.length);
      } catch {
        return Promise.resolve(0);
      }
    });
    await loading.runStep(48, "Creating battlefield systems...", () => Promise.resolve());
    const store = createStore();
    await loading.runStep(62, "Mounting BoardState HUD...", () => {
      mountApp(root, store);
    }, { critical: true });
    await loading.runStep(76, "Restoring profile and settings...", () => store.init(), { timeoutMs: 2800 });
    await loading.runStep(88, "Preparing rules engine...", () => Promise.resolve());
    await loading.runStep(96, "Preparing the battlefield...", () => loading.waitForAppStable(root), { critical: true });
    await loading.complete("Entering BoardState...");
    preloadAfterStartup();
  } catch (error) {
    console.error("BoardState startup failed", error);
    loading.fail(error);
  }
}

async function requestBoardStateLandscapeLock() {
  document.documentElement.dataset.boardstateOrientation = "landscape";
  document.body.dataset.requestedOrientation = "landscape";
  const orientation = globalThis.screen?.orientation;
  if (typeof orientation?.lock !== "function") {
    return false;
  }
  for (const mode of LANDSCAPE_LOCK_MODES) {
    try {
      await orientation.lock(mode);
      document.body.dataset.orientationLock = "landscape";
      return true;
    } catch {
      // Browser and PWA support varies; CSS/native wrappers still enforce landscape presentation.
    }
  }
  document.body.dataset.orientationLock = "css-landscape";
  return false;
}

function preloadAfterStartup(assetUrl = "") {
  const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1000));
  schedule(() => {
    if (!assetUrl) {
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.src = assetUrl;
  });
}

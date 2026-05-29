import { createStore } from "./state/store.js";
import { createLoadingScreenController } from "./ui/loadingScreen.js";
import { mountApp } from "./ui/render.js";
import loadingDragonUrl from "../assets/boardstate-loading-dragon.png";
import landscapeWallpaperUrl from "../assets/boardstate-bg-landscape.png";
import portraitWallpaperUrl from "../assets/boardstate-bg-portrait.png";

const root = document.querySelector("#app");
const loading = createLoadingScreenController({
  assets: [loadingDragonUrl, portraitWallpaperUrl, landscapeWallpaperUrl],
});

bootstrap();

async function bootstrap() {
  try {
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
    });
    await loading.runStep(76, "Restoring profile and settings...", () => store.init());
    await loading.runStep(88, "Preparing rules engine...", () => Promise.resolve());
    await loading.runStep(96, "Preparing the battlefield...", () => Promise.resolve());
    await loading.complete("Entering BoardState...");
  } catch (error) {
    console.error("BoardState startup failed", error);
    loading.fail(error);
  }
}

const STARTUP_TIMEOUT_MS = 11000;
const MIN_VISIBLE_MS = 620;

export function createLoadingScreenController({ assets = [] } = {}) {
  const node = document.querySelector("#boardstate-loader");
  const fill = node?.querySelector("[data-loading-fill]");
  const status = node?.querySelector("[data-loading-status]");
  const percent = node?.querySelector("[data-loading-percent]");
  const actions = node?.querySelector("[data-loading-actions]");
  const details = node?.querySelector("[data-loading-details]");
  let progress = 0;
  let ready = false;
  const startedAt = performance.now();
  const stallTimer = window.setTimeout(() => {
    if (!ready) {
      showRecovery("BoardState is still preparing. You can continue or reset the guest session if the loader is stuck.");
    }
  }, STARTUP_TIMEOUT_MS);

  wireRecoveryActions();
  setProgress(0, "Awakening the board...");

  async function preloadVisualAssets() {
    const uniqueAssets = [...new Set(assets.filter(Boolean))];
    await Promise.allSettled(uniqueAssets.map(preloadImage));
  }

  async function waitForFirstPaint() {
    await nextFrame();
    await delay(160);
  }

  async function runStep(target, message, task) {
    setProgress(Math.max(progress, target - 8), message);
    if (typeof task === "function") {
      await task();
    }
    setProgress(target, message);
    await nextFrame();
  }

  async function complete(message = "Entering BoardState...") {
    ready = true;
    window.clearTimeout(stallTimer);
    setProgress(100, message);
    const elapsed = performance.now() - startedAt;
    if (elapsed < MIN_VISIBLE_MS) {
      await delay(MIN_VISIBLE_MS - elapsed);
    }
    node?.classList.add("is-ready");
    document.body.classList.add("boardstate-app-ready");
    document.querySelector("#app")?.removeAttribute("aria-busy");
    window.setTimeout(() => {
      node?.remove();
    }, 720);
  }

  function fail(error) {
    ready = false;
    window.clearTimeout(stallTimer);
    showRecovery("BoardState hit a startup snag. You can continue with the current session or reset the guest state.");
    if (details) {
      details.textContent = error?.message || String(error || "Unknown startup error");
    }
  }

  function showRecovery(message) {
    node?.classList.add("is-stalled");
    if (status) {
      status.textContent = message;
    }
    actions?.removeAttribute("hidden");
  }

  function setProgress(target, message) {
    progress = Math.max(progress, Math.min(100, Math.round(target)));
    node?.style.setProperty("--load-progress", `${progress}%`);
    if (fill) {
      fill.style.width = `${progress}%`;
    }
    if (percent) {
      percent.textContent = `${progress}%`;
    }
    if (status && message) {
      status.textContent = message;
    }
  }

  function wireRecoveryActions() {
    actions?.querySelector("[data-loading-continue]")?.addEventListener("click", () => {
      complete("Continuing into BoardState...");
    });
    actions?.querySelector("[data-loading-reset]")?.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("boardstate-guest-session");
      } catch {
        // Recovery must remain available even if storage is unavailable.
      }
      location.hash = "#life";
      location.reload();
    });
    actions?.querySelector("[data-loading-fresh]")?.addEventListener("click", () => {
      location.hash = "#life";
      location.reload();
    });
  }

  return {
    complete,
    fail,
    preloadVisualAssets,
    runStep,
    setProgress,
    waitForFirstPaint,
  };
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
    if (image.complete) {
      resolve(src);
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

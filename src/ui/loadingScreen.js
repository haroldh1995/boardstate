const STARTUP_TIMEOUT_MS = 11000;
const MIN_VISIBLE_MS = 900;
const DEFAULT_STEP_TIMEOUT_MS = 3500;
const APP_STABLE_TIMEOUT_MS = 6000;
const APP_SETTLE_MS = 180;
const PROGRESS_STEP_MS = 16;

export function createLoadingScreenController({ assets = [] } = {}) {
  const node = document.querySelector("#boardstate-loader");
  const fill = node?.querySelector("[data-loading-fill]");
  const status = node?.querySelector("[data-loading-status]");
  const percent = node?.querySelector("[data-loading-percent]");
  const actions = node?.querySelector("[data-loading-actions]");
  const details = node?.querySelector("[data-loading-details]");
  let progress = 0;
  let ready = false;
  let progressAnimation = Promise.resolve();
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

  async function waitForAppStable(root = document.querySelector("#app")) {
    const started = performance.now();
    await waitForCondition(() => isAppShellPainted(root), APP_STABLE_TIMEOUT_MS);
    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready.catch(() => undefined), delay(1200)]);
    }
    await nextFrame();
    await nextFrame();
    await delay(APP_SETTLE_MS);
    await nextFrame();
    if (!isAppShellPainted(root)) {
      throw new Error("BoardState app shell did not finish painting before loader handoff.");
    }
    const elapsed = Math.round(performance.now() - started);
    if (elapsed > 900) {
      console.info(`BoardState startup handoff waited ${elapsed}ms for a stable app paint.`);
    }
  }

  async function runStep(target, message, task, options = {}) {
    const { critical = false, timeoutMs = DEFAULT_STEP_TIMEOUT_MS } = options;
    await setProgress(Math.max(progress, target - 8), message);
    if (typeof task === "function") {
      const result = await runStartupTask(task, { message, timeoutMs });
      if (result.status === "error" && critical) {
        throw result.error;
      }
      if (result.status !== "ok") {
        console.warn(`BoardState startup continued after ${message.toLowerCase()}:`, result.error?.message || result.reason);
      }
    }
    await setProgress(target, message);
    await nextFrame();
  }

  async function complete(message = "Entering BoardState...") {
    ready = true;
    window.clearTimeout(stallTimer);
    await setProgress(100, message, { durationMs: 380 });
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

  function setProgress(target, message, options = {}) {
    const nextProgress = Math.max(progress, Math.min(100, Math.round(target)));
    const distance = nextProgress - progress;
    const durationMs = Number.isFinite(options.durationMs)
      ? Math.max(0, options.durationMs)
      : Math.max(90, Math.min(240, distance * 9));
    if (status && message) {
      status.textContent = message;
    }
    progressAnimation = progressAnimation.then(() => animateProgress(nextProgress, durationMs));
    return progressAnimation;
  }

  function renderProgress(value) {
    progress = Math.max(progress, Math.min(100, Math.round(value)));
    node?.style.setProperty("--load-progress", `${progress}%`);
    if (fill) {
      fill.style.width = `${progress}%`;
    }
    if (percent) {
      percent.textContent = `${progress}%`;
    }
  }

  function animateProgress(target, durationMs) {
    if (target <= progress || durationMs <= 0) {
      renderProgress(target);
      return Promise.resolve();
    }
    const from = progress;
    const distance = target - from;
    const started = performance.now();
    return new Promise((resolve) => {
      function tick(now) {
        const elapsed = now - started;
        const ratio = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - ratio, 3);
        renderProgress(from + distance * eased);
        if (ratio < 1) {
          requestAnimationFrame(tick);
          return;
        }
        renderProgress(target);
        resolve();
      }
      window.setTimeout(() => requestAnimationFrame(tick), PROGRESS_STEP_MS);
    });
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
    waitForAppStable,
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

function runStartupTask(task, { message, timeoutMs }) {
  let timedOut = false;
  const taskPromise = Promise.resolve()
    .then(task)
    .then(() => ({ status: timedOut ? "late" : "ok" }))
    .catch((error) => ({ status: "error", error }));

  taskPromise.then((result) => {
    if (timedOut && result.status === "error") {
      console.warn(`BoardState startup task later failed after timeout (${message}):`, result.error);
    }
  });

  return Promise.race([
    taskPromise,
    delay(timeoutMs).then(() => {
      timedOut = true;
      return { status: "timeout", reason: `Timed out after ${timeoutMs}ms` };
    }),
  ]);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForCondition(predicate, timeoutMs) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (predicate()) {
        resolve();
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        reject(new Error("Timed out waiting for BoardState to finish painting."));
        return;
      }
      requestAnimationFrame(check);
    }
    check();
  });
}

function isAppShellPainted(root) {
  if (!root || !root.childElementCount) {
    return false;
  }
  const shell = root.querySelector(".app-shell");
  const activePage = document.body.dataset.page;
  if (!shell || !activePage) {
    return false;
  }
  const page = root.querySelector(`.${activePage}-page`) || root.querySelector("main");
  const rect = shell.getBoundingClientRect();
  return Boolean(page && rect.width > 0 && rect.height > 0);
}

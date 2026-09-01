import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DUAL_HAND_MODEL_VERSION,
  moveOrderedId,
  resolveArenaHandLayout,
  validateArenaHandContinuity,
} from "../src/gameplay/dualHandModel.js";
import {
  RUNTIME_ENVIRONMENT_VERSION,
  createMemoryKeyValueStore,
  createRuntimeEnvironment,
  getRuntimeLocation,
  getRuntimeNavigator,
} from "../src/platform/runtimeEnvironment.js";

const REPOSITORY_ROOT = new URL("../", import.meta.url);
const REPOSITORY_ROOT_PATH = fileURLToPath(REPOSITORY_ROOT);

function readRepositoryFile(path) {
  return readFileSync(new URL(path, REPOSITORY_ROOT), "utf8");
}

function collectFiles(path) {
  const fullPath = fileURLToPath(new URL(path, REPOSITORY_ROOT));
  const entries = readdirSync(fullPath);
  return entries.flatMap((entry) => {
    const entryPath = join(fullPath, entry);
    const stats = statSync(entryPath);
    return stats.isDirectory() ? collectFiles(relative(REPOSITORY_ROOT_PATH, entryPath).replaceAll("\\", "/")) : [entryPath];
  });
}

function assertNoDirectWebRuntimeAccess(file) {
  const source = readFileSync(file, "utf8");
  const relativePath = relative(REPOSITORY_ROOT_PATH, file).replaceAll("\\", "/");
  const forbidden = [
    { token: "document.", allowed: [] },
    { token: "window.", allowed: [] },
    { token: "localStorage.", allowed: ["defaultRuntimeEnvironment.localStorage"] },
    { token: "sessionStorage.", allowed: ["defaultRuntimeEnvironment.sessionStorage"] },
    { token: "navigator.", allowed: ["defaultRuntimeEnvironment.navigator"] },
    { token: "indexedDB.", allowed: [] },
    { token: "crypto.", allowed: [] },
    { token: "btoa(", allowed: [] },
    { token: "atob(", allowed: [] },
    { token: "new TextEncoder(", allowed: [] },
    { token: "globalThis.location", allowed: [] },
    { token: "globalThis.navigator", allowed: [] },
    { token: "globalThis.localStorage", allowed: [] },
    { token: "globalThis.sessionStorage", allowed: [] },
    { token: "globalThis.indexedDB", allowed: [] },
    { token: "globalThis.crypto", allowed: [] },
    { token: "fetch(", allowed: ["defaultRuntimeEnvironment.fetch(", "runtimeFetch("] },
  ];

  for (const line of source.split(/\r?\n/)) {
    for (const rule of forbidden) {
      if (!line.includes(rule.token)) continue;
      if (rule.allowed.some((allowed) => line.includes(allowed))) continue;
      assert.fail(`${relativePath} must use a platform adapter instead of direct ${rule.token}`);
    }
  }
}

test("dual hand layout model is platform-neutral and drives renderer geometry", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const model = readRepositoryFile("src/gameplay/dualHandModel.js");

  assert.equal(DUAL_HAND_MODEL_VERSION, "boardstate-dual-hand-dock-1.0.0");
  assert.match(render, /from "\.\.\/gameplay\/dualHandModel\.js"/);
  assert.equal(render.includes("function resolveArenaHandLayout"), false);
  assert.equal(model.includes("document."), false);
  assert.equal(model.includes("window."), false);
  assert.equal(model.includes("localStorage"), false);
  assert.equal(model.includes("sessionStorage"), false);
  assert.equal(model.includes("navigator."), false);

  const layout = resolveArenaHandLayout(
    ["phase", "library", "rules", "undo"].map((id) => ({ id })),
    { availableWidth: 360, cardWidth: 120 },
  );
  assert.equal(validateArenaHandContinuity(layout).valid, true);
  assert.equal(layout.circular, false);
  assert.equal(layout.clones, false);
  assert.equal(layout.entries.at(-1).zIndex, Math.max(...layout.entries.map((entry) => entry.zIndex)));
  assert.deepEqual(moveOrderedId(["phase", "library", "rules"], "phase", "front"), ["library", "rules", "phase"]);
});

test("runtime environment adapter provides storage, location, navigator, and encoding fallbacks", () => {
  const storage = createMemoryKeyValueStore({ existing: "value" });
  storage.setItem("answer", 42);
  assert.equal(storage.getItem("existing"), "value");
  assert.equal(storage.getItem("answer"), "42");
  storage.removeItem("answer");
  assert.equal(storage.getItem("answer"), null);

  const runtime = createRuntimeEnvironment({
    localStorage: createMemoryKeyValueStore(),
    sessionStorage: createMemoryKeyValueStore(),
    location: { origin: "app://boardstate", pathname: "/game", search: "?x=1", hash: "#battlefield" },
    navigator: { userAgent: "NativeHarness", platform: "SwiftPlayground", language: "en", onLine: false },
    fetch: null,
    indexedDB: null,
  });
  assert.equal(RUNTIME_ENVIRONMENT_VERSION, "boardstate-runtime-environment-0.1.0");
  assert.equal(runtime.location.origin, "app://boardstate");
  assert.equal(runtime.navigator.online, false);
  assert.equal(getRuntimeLocation({ pathname: "/native" }).pathname, "/native");
  assert.equal(getRuntimeNavigator({ onLine: true }).online, true);

  const encoded = runtime.encodeBase64Bytes(Uint8Array.from([66, 83]));
  assert.deepEqual(Array.from(runtime.decodeBase64Bytes(encoded)), [66, 83]);
  assert.deepEqual(Array.from(runtime.encodeText("BS")), [66, 83]);
});

test("non-UI gameplay, storage, service, bridge, and support code avoids direct web-only APIs", () => {
  const auditedRoots = [
    "src/authoritative-core",
    "src/bridge",
    "src/ecosystem",
    "src/effects",
    "src/game",
    "src/gameplay",
    "src/migration",
    "src/multiplayer",
    "src/onboarding",
    "src/persistence",
    "src/rules-engine",
    "src/services",
    "src/shared-contracts",
    "src/shared-session",
    "src/social",
    "src/state",
    "src/storage",
    "src/support",
  ];
  const files = auditedRoots.flatMap((root) => collectFiles(root)).filter((file) => file.endsWith(".js"));
  for (const file of files) {
    assertNoDirectWebRuntimeAccess(file);
  }
});

test("platform adapter is the only non-UI source allowed to resolve browser globals", () => {
  const runtime = readRepositoryFile("src/platform/runtimeEnvironment.js");
  assert.match(runtime, /resolveGlobalValue/);
  assert.match(runtime, /createRuntimeEnvironment/);
  assert.match(runtime, /createMemoryKeyValueStore/);

  const adapterConsumers = [
    "src/services/scryfallService.js",
    "src/storage/localDatabase.js",
    "src/support/debugExport.js",
    "src/bridge/appLinkAdapters.js",
    "src/social/friendSystem.js",
  ];
  for (const file of adapterConsumers) {
    assert.match(readRepositoryFile(file), /runtimeEnvironment\.js/);
  }
});

test("production decisions use BoardState modal intents instead of browser dialogs", () => {
  const render = readRepositoryFile("src/ui/render.js");
  assert.doesNotMatch(render, /\b(?:prompt|confirm|alert)\s*\(/);
  assert.match(render, /data-confirmation-form/);
  assert.match(render, /data-confirmation-input/);
  assert.match(render, /type === "textarea"/);
  assert.match(render, /type === "select"/);
  assert.match(render, /case "cast-scryfall-x"/);
  assert.match(render, /beginCanonicalSearchCardAction/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { createDefaultProfile } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";
import {
  applySharedPreferencePatch,
  createSharedPreferenceSnapshot,
} from "../src/ecosystem/ecosystemIntegration.js";
import {
  BOARDSTATE_VISUAL_LANGUAGE_VERSION,
  VISUAL_LAYERS,
  VISUAL_MATERIALS,
  createVisualCssVariables,
  createVisualDebugSnapshot,
  createVisualTokenSet,
} from "../src/ui/visualTokens.js";

function repositoryPath(path) {
  return new URL(`../${path}`, import.meta.url);
}

function readRepositoryFile(path) {
  return readFileSync(repositoryPath(path), "utf8");
}

test("native game visual architecture documents permanent landscape battlefield laws", () => {
  const doc = readRepositoryFile("docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md");
  assert.match(doc, /The battlefield is the application/i);
  assert.match(doc, /Landscape Is Canonical/i);
  assert.match(doc, /Digital Game First/i);
  assert.match(doc, /Responsive Without Redesign/i);
  assert.match(doc, /Portrait gameplay.*BoardState Lite/i);
  assert.match(doc, /must not copy Arena artwork/i);
});

test("default profile and reducer keep gameplay composition landscape-only", () => {
  const profile = createDefaultProfile();
  assert.equal(profile.settings.appearance.compositionMode, "landscape");
  assert.equal("edgeSwipeShortcuts" in profile.settings.navigation, false);
  assert.equal("compactMobileHud" in profile.settings.navigation, false);

  const attemptedMobile = reduceProfile(profile, {
    type: "SET_SETTING",
    path: "appearance.compositionMode",
    value: "mobile",
  });
  assert.equal(attemptedMobile.settings.appearance.compositionMode, "landscape");

  const attemptedEdgeSwipe = reduceProfile(profile, {
    type: "SET_SETTING",
    path: "navigation.edgeSwipeShortcuts",
    value: true,
  });
  assert.equal("edgeSwipeShortcuts" in attemptedEdgeSwipe.settings.navigation, false);
});

test("ecosystem preferences report landscape and reject portrait/mobile patches", () => {
  const profile = createDefaultProfile();
  const snapshot = createSharedPreferenceSnapshot(profile);
  assert.equal(snapshot.animation.compositionMode, "landscape");
  assert.equal("edgeSwipeShortcuts" in snapshot.interaction, false);
  assert.equal(snapshot.synchronizedThroughHub, false);

  const patched = applySharedPreferencePatch(profile, {
    interaction: { edgeSwipeShortcuts: true },
    animation: { compositionMode: "mobile" },
  });
  assert.equal(patched.settings.appearance.compositionMode, "landscape");
  assert.equal("edgeSwipeShortcuts" in patched.settings.navigation, false);
});

test("battlefield model treats noncanonical viewport hints as landscape-safe desktop", () => {
  const model = createLandscapeBattlefieldModel(createDefaultProfile(), {
    viewport: "invalid-orientation",
  });
  assert.equal(model.orientation, "landscape-first");
  assert.equal(model.viewport, "desktop");
});

test("runtime contains landscape enforcement without portrait gameplay scaffolding", () => {
  const main = readRepositoryFile("src/main.js");
  const loadingScreen = readRepositoryFile("src/ui/loadingScreen.js");
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const index = readRepositoryFile("index.html");
  const manifest = readRepositoryFile("public/manifest.webmanifest");
  const androidManifest = readRepositoryFile("android-app/app/src/main/AndroidManifest.xml");
  const mainActivity = readRepositoryFile("android-app/app/src/main/java/com/boardstate/app/MainActivity.java");
  const flutter = readRepositoryFile("flutter-app/lib/main.dart");

  assert.equal(existsSync(repositoryPath("assets/boardstate-bg-landscape.png")), true);
  assert.equal(existsSync(repositoryPath("assets/boardstate-bg-portrait.png")), false);
  assert.match(main, /requestBoardStateLandscapeLock/);
  assert.match(main, /activatePostLoadingLandscapeEnforcement/);
  assert.match(main, /orientation\.lock\(mode\)/);
  assert.match(index, /boardstate-landscape-gate/);
  assert.match(loadingScreen, /location\.hash = "#battlefield"/);
  assert.equal(styles.includes("boardstate-bg-portrait"), false);
  assert.equal(render.includes("portrait-allowed"), false);
  assert.equal(render.includes("mobile-bottom-sheet"), false);
  assert.equal(styles.includes("rotate(90deg)"), false);
  assert.match(index, /<meta name="screen-orientation" content="landscape"/);
  assert.match(manifest, /"orientation": "landscape"/);
  assert.match(androidManifest, /android:screenOrientation="landscape"/);
  assert.match(mainActivity, /SCREEN_ORIENTATION_LANDSCAPE/);
  assert.match(flutter, /DeviceOrientation\.landscapeLeft/);
  assert.match(flutter, /DeviceOrientation\.landscapeRight/);
});

test("battlefield runtime uses the Dual Hand Dock and has no retired wheel path", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const canonicalDoc = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");
  const dualHandModel = readRepositoryFile("src/gameplay/dualHandModel.js");
  const schema = readRepositoryFile("src/state/schema.js");
  const localDatabase = readRepositoryFile("src/storage/localDatabase.js");

  assert.match(render, /DUAL_HAND_DOCK_VERSION = DUAL_HAND_MODEL_VERSION/);
  assert.match(render, /function renderDualHandDock/);
  assert.match(render, /function renderCommanderActionCard/);
  assert.match(render, /function renderPlayerHandCard/);
  assert.match(render, /data-dual-hand-dock/);
  assert.match(render, /data-active-hand-surface/);
  assert.match(render, /data-rightmost-frontmost="true"/);
  assert.match(render, /data-player-hand-card/);
  assert.match(render, /data-add-to-player-hand/);
  assert.doesNotMatch(render, /commandDeckModel|command-deck|rotating-command|data-command-deck-center/);
  assert.match(styles, /\.dual-hand-dock\b/);
  assert.match(styles, /\.player-hand-card\b/);
  assert.match(styles, /\.dual-hand-card\.is-dragging/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /\.command-deck\b|\.commander-action-hand\b|data-command-deck-center/);
  assert.match(dualHandModel, /mode: "ordered-overlapping-tcg-hand"/);
  assert.match(dualHandModel, /circular: false/);
  assert.match(dualHandModel, /clones: false/);
  assert.match(schema, /dualHandDock:/);
  assert.match(localDatabase, /normalizePersistentCommandOrder/);
  assert.match(canonicalDoc, /Dual Hand Dock/i);
  assert.equal(existsSync(repositoryPath("src/gameplay/commandDeckModel.js")), false);
  assert.equal(existsSync(repositoryPath("docs/ecosystem/ROTATING_COMMAND_DECK_ARCHITECTURE.md")), false);
});

test("visual tokens centralize material, elevation, shadow, glow, and debug metadata", () => {
  const tokens = createVisualTokenSet();
  assert.equal(tokens.version, BOARDSTATE_VISUAL_LANGUAGE_VERSION);
  assert.equal(tokens.materialIds.gold, VISUAL_MATERIALS.gold);
  assert.equal(tokens.layers.commandHand, VISUAL_LAYERS.commandHand);
  assert.match(tokens.materials.cardStock, /linear-gradient/);
  assert.match(tokens.shadow.overlay, /rgba\(0, 0, 0, 0\.36\)/);
  assert.match(tokens.glow.crystal, /143, 211, 255/);

  const cssVariables = createVisualCssVariables();
  assert.equal(cssVariables["--visual-color-gold"], tokens.colors.gold);
  assert.equal(cssVariables["--visual-material-card-stock"], tokens.materials.cardStock);
  assert.equal(cssVariables["--visual-shadow-overlay"], tokens.shadow.overlay);

  const debug = createVisualDebugSnapshot({
    material: VISUAL_MATERIALS.crystal,
    elevation: "overlay",
    shadow: "overlay",
    glow: "crystal",
    border: "crystal",
    layer: VISUAL_LAYERS.overlay,
    opacity: "active",
  });
  assert.equal(debug.version, BOARDSTATE_VISUAL_LANGUAGE_VERSION);
  assert.equal(debug.productionVisible, false);
  assert.ok(debug.fields.includes("material"));
});

test("battlefield runtime keeps tabletop composition around the new dock", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const compositionDoc = readRepositoryFile("docs/ecosystem/HUD_COMPOSITION_VISUAL_HIERARCHY.md");

  assert.match(render, /TABLETOP_RECONSTRUCTION_VERSION = "boardstate-tabletop-reconstruction-0\.1\.0"/);
  assert.match(render, /HUD_COMPOSITION_VERSION = "boardstate-hud-composition-0\.1\.0"/);
  assert.match(render, /tabletop-battlefield-page/);
  assert.match(render, /tabletop-empty-board/);
  assert.equal(render.includes("landscape-selected-card is-empty"), false);
  assert.equal(render.includes("Bottom Battlefield"), false);
  assert.match(styles, /\.tabletop-battlefield-page\b/);
  assert.match(styles, /battlefield reconstruction removes dashboard chrome/i);
  assert.match(styles, /HUD composition pass/i);
  assert.match(styles, /dual-hand-dock__queue/);
  assert.match(render, /dual-hand-dock__queue" role="status" aria-live="polite"/);
  assert.match(styles, /\.dual-hand-dock\s*\{[\s\S]*?pointer-events: none;/);
  assert.match(styles, /\.dual-hand-dock__surface\s*\{[\s\S]*?pointer-events: auto;/);
  assert.match(compositionDoc, /battlefield must be the first read/i);
});

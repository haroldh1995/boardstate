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

function readRepositoryFile(path) {
  return readFileSync(repositoryPath(path), "utf8");
}

function repositoryPath(path) {
  return new URL(`../${path}`, import.meta.url);
}

test("native game visual architecture documents the permanent landscape battlefield laws", () => {
  const doc = readRepositoryFile("docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md");
  assert.match(doc, /The battlefield is the application/i);
  assert.match(doc, /Landscape Is Canonical/i);
  assert.match(doc, /Digital Game First/i);
  assert.match(doc, /Responsive Without Redesign/i);
  assert.match(doc, /Portrait gameplay.*BoardState Lite/i);
  assert.match(doc, /must not copy Arena artwork/i);
});

test("default profile and reducer keep BoardState gameplay composition landscape-only", () => {
  const profile = createDefaultProfile();
  assert.equal(profile.settings.appearance.compositionMode, "landscape");
  assert.equal("edgeSwipeShortcuts" in profile.settings.navigation, false);
  assert.equal("compactMobileHud" in profile.settings.navigation, false);
  assert.equal("mobileFocusView" in profile.settings.navigation, false);
  assert.equal("hudBadgesLocked" in profile.settings.navigation, false);
  assert.equal("hudBadgePositions" in profile.settings.navigation, false);

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

test("ecosystem preferences report landscape honestly and reject portrait/mobile patches", () => {
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
  assert.equal("compactMobileHud" in patched.settings.navigation, false);
  assert.equal("mobileFocusView" in patched.settings.navigation, false);
  assert.equal("hudBadgesLocked" in patched.settings.navigation, false);
  assert.equal("hudBadgePositions" in patched.settings.navigation, false);
});

test("battlefield model treats noncanonical viewport hints as landscape-safe desktop", () => {
  const model = createLandscapeBattlefieldModel(createDefaultProfile(), { viewport: "invalid-orientation" });
  assert.equal(model.orientation, "landscape-first");
  assert.equal(model.viewport, "desktop");
});

test("runtime no longer contains portrait wallpaper selection or mobile navigation scaffolding", () => {
  const main = readRepositoryFile("src/main.js");
  const loadingScreen = readRepositoryFile("src/ui/loadingScreen.js");
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const landscapeModel = readRepositoryFile("src/ui/landscapeBattlefield.js");
  const index = readRepositoryFile("index.html");
  const manifest = readRepositoryFile("public/manifest.webmanifest");
  const androidManifest = readRepositoryFile("android-app/app/src/main/AndroidManifest.xml");
  const mainActivity = readRepositoryFile("android-app/app/src/main/java/com/boardstate/app/MainActivity.java");
  const flutter = readRepositoryFile("flutter-app/lib/main.dart");

  assert.equal(existsSync(repositoryPath("assets/boardstate-bg-landscape.png")), true);
  assert.equal(existsSync(repositoryPath("assets/boardstate-bg-portrait.png")), false);
  assert.match(main, /boardstate-bg-landscape\.png/);
  assert.equal(main.includes("boardstate-bg-portrait"), false);
  assert.match(main, /requestBoardStateLandscapeLock/);
  assert.match(main, /globalThis\.screen\?\.orientation/);
  assert.match(main, /orientation\.lock\(mode\)/);
  assert.match(loadingScreen, /location\.hash = "#battlefield"/);
  assert.equal(loadingScreen.includes("#life"), false);
  assert.match(styles, /boardstate-bg-landscape\.png/);
  assert.equal(styles.includes("boardstate-bg-portrait"), false);
  assert.equal(render.includes("orientationchange"), false);
  assert.equal(render.includes("portrait-allowed"), false);
  assert.equal(render.includes("MOBILE_LAYOUT_ARCHITECTURE_VERSION"), false);
  assert.equal(render.includes("LANDSCAPE_VIEWPORT_PAGES"), false);
  assert.equal(render.includes("isMobilePortrait"), false);
  assert.equal(render.includes("mobile-bottom-sheet"), false);
  assert.equal(render.includes("data-draggable-hud"), false);
  assert.equal(render.includes("HUD_BADGE_DEFAULTS"), false);
  assert.equal(styles.includes("mobile-bottom-sheet"), false);
  assert.equal(styles.includes("data-draggable-hud"), false);
  assert.equal(styles.includes("mobile-hud-column"), false);
  assert.equal(styles.includes("mobile-focus-view"), false);
  assert.equal(render.includes("data-mobile-nav"), false);
  assert.equal(render.includes("data-edge-zone"), false);
  assert.equal(landscapeModel.includes("portrait-support"), false);
  assert.match(render, /return allPages\.includes\(rawPage\) \? rawPage : "battlefield";/);
  assert.match(index, /manifest\.webmanifest/);
  assert.match(index, /<meta name="screen-orientation" content="landscape"/);
  assert.match(manifest, /"orientation": "landscape"/);
  assert.match(manifest, /"start_url": "\.\/#battlefield"/);
  assert.match(androidManifest, /android:screenOrientation="landscape"/);
  assert.equal(androidManifest.includes('android:screenOrientation="portrait"'), false);
  assert.match(mainActivity, /SCREEN_ORIENTATION_LANDSCAPE/);
  assert.match(flutter, /DeviceOrientation\.landscapeLeft/);
  assert.match(flutter, /DeviceOrientation\.landscapeRight/);
  assert.match(flutter, /#battlefield/);
  assert.equal(flutter.includes("#life"), false);
  assert.match(render, /boardstate-native-game-visual-foundation-0\.1\.0/);
  assert.equal(render.includes("dataset.gameplayComposition = CANONICAL_GAMEPLAY_COMPOSITION"), true);
});

test("battlefield runtime uses the Commander Action Hand instead of the former bottom toolbar", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const visualDoc = readRepositoryFile("docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md");
  const battlefieldDoc = readRepositoryFile("docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md");
  const actionHandDoc = readRepositoryFile("docs/ecosystem/COMMANDER_ACTION_HAND_DESIGN.md");
  const rotatingDeckDoc = readRepositoryFile("docs/ecosystem/ROTATING_COMMAND_DECK_ARCHITECTURE.md");
  const motionDoc = readRepositoryFile("docs/ecosystem/MOTION_LANGUAGE_ARCHITECTURE.md");
  const visualLanguageDoc = readRepositoryFile("docs/ecosystem/VISUAL_LANGUAGE_MATERIAL_SYSTEM.md");
  const motionTokens = readRepositoryFile("src/ui/motionTokens.js");
  const visualTokens = readRepositoryFile("src/ui/visualTokens.js");
  const schema = readRepositoryFile("src/state/schema.js");
  const localDatabase = readRepositoryFile("src/storage/localDatabase.js");

  assert.match(render, /COMMANDER_ACTION_HAND_VERSION = "boardstate-commander-action-hand-0\.1\.0"/);
  assert.match(render, /COMMAND_DECK_VERSION = "boardstate-rotating-command-deck-0\.1\.0"/);
  assert.match(render, /BOARDSTATE_VISUAL_LANGUAGE_VERSION/);
  assert.match(render, /document\.body\.dataset\.visualLanguageVersion = VISUAL_LANGUAGE_VERSION/);
  assert.match(render, /data-visual-language-version/);
  assert.match(render, /data-visual-material/);
  assert.match(render, /data-visual-layer/);
  assert.match(render, /data-visual-elevation/);
  assert.match(render, /data-visual-shadow/);
  assert.match(render, /data-visual-glow/);
  assert.match(render, /function renderVisualDebugOverlay/);
  assert.match(render, /boardstate-visual-debug/);
  assert.match(render, /BOARDSTATE_MOTION_LANGUAGE_VERSION/);
  assert.match(render, /document\.body\.dataset\.motionLanguageVersion = BOARDSTATE_MOTION_LANGUAGE_VERSION/);
  assert.match(render, /data-motion-language-version/);
  assert.match(render, /data-motion-owner="rotating-command-deck"/);
  assert.match(render, /data-motion-state/);
  assert.match(render, /data-motion-token/);
  assert.match(render, /function renderMotionDebugOverlay/);
  assert.match(render, /import\.meta\.env\?\.DEV/);
  assert.match(render, /boardstate-motion-debug/);
  assert.match(render, /function renderCommanderActionHand/);
  assert.match(render, /function renderPersistentSettingsGear/);
  assert.match(render, /persistent-settings-gear/);
  assert.match(render, /data-game-options/);
  assert.match(render, /function createCommanderActionCards/);
  assert.match(render, /function resolveCommandDeckPriorityCard/);
  assert.match(render, /function resolveCommandDeckCenterIndex/);
  assert.match(render, /function getVisibleCommandDeckCards/);
  assert.match(render, /function normalizeCommandDeckIndex/);
  assert.match(render, /function bindCommandDeck/);
  assert.match(render, /function renderCommanderActionCard/);
  assert.match(render, /data-commander-action-hand-version/);
  assert.match(render, /data-command-deck-version/);
  assert.match(render, /data-command-deck-rotation/);
  assert.match(render, /data-command-deck-center/);
  assert.match(render, /document\.body\.dataset\.commandDeckVersion = COMMAND_DECK_VERSION/);
  assert.match(render, /document\.body\.dataset\.commanderActionHandVersion = COMMANDER_ACTION_HAND_VERSION/);
  assert.match(render, /data-next-phase/);
  assert.match(render, /data-open-utility="rules-assistant"/);
  assert.match(render, /data-open-utility="remind-me"/);
  assert.match(render, /data-open-tool-panel="commander"/);
  assert.match(render, /data-open-utility="history"/);
  assert.match(render, /data-open-utility="notes"/);
  assert.match(render, /data-open-utility="calculator"/);
  assert.match(render, /data-open-utility="dice"/);
  assert.match(render, /data-flip-coin/);
  assert.match(render, /data-command-deck-favorite/);
  assert.match(render, /data-command-deck-card-favorite/);
  assert.match(render, /data-action-card-id/);
  assert.match(render, /data-action-priority/);
  assert.match(render, /visible: canResolveContext \|\| combatResolving/);
  assert.match(render, /visible: Boolean\(selectedPermanents\.length\)/);
  assert.match(render, /COMMAND_DECK_CORE_ORDER/);
  assert.match(render, /COMMAND_DECK_AUTO_CENTER_COOLDOWN_MS/);
  assert.match(render, /COMMAND_DECK_MAX_FAVORITES/);
  assert.match(schema, /commandDeck:\s*{\s*favoriteIds:\s*\[\]/);
  assert.match(localDatabase, /commandDeck:\s*{\s*\.{3}defaults\.settings\.commandDeck/);
  assert.equal(render.includes("renderMobileBattlefieldDock"), false);
  assert.equal(render.includes("battlefield-mobile-dock"), false);
  assert.equal(render.includes("battlefield-wheel"), false);
  assert.equal(render.includes("battlefield-command-console"), false);
  assert.equal(render.includes("data-dashboard-action"), false);
  assert.equal(render.includes("renderCommandHud"), false);
  assert.equal(render.includes("command-hud-card"), false);
  assert.equal(render.includes("data-command-hud-version"), false);
  assert.equal(render.includes("rules-assistant-launcher"), false);
  assert.equal(render.includes("proactive-assistant-launcher"), false);
  assert.equal(render.includes("ai-gameplay-launcher"), false);
  assert.equal(styles.includes("battlefield-mobile-dock"), false);
  assert.equal(styles.includes("battlefield-wheel"), false);
  assert.equal(styles.includes("battlefield-command-console"), false);
  assert.equal(styles.includes("utility-dock-menu"), false);
  assert.equal(styles.includes(".command-hud"), false);
  assert.equal(styles.includes(".command-hud-card"), false);

  assert.match(styles, /\.commander-action-hand\b/);
  assert.match(styles, /\.persistent-settings-gear\b/);
  assert.match(styles, /--visual-color-bg-deep/);
  assert.match(styles, /--visual-material-polished-glass/);
  assert.match(styles, /--visual-material-card-stock/);
  assert.match(styles, /--visual-material-legendary-gold/);
  assert.match(styles, /--visual-shadow-overlay/);
  assert.match(styles, /--visual-glow-gold-strong/);
  assert.match(styles, /\.visual-debug-overlay/);
  assert.match(styles, /\.visual-debug-overlay\[hidden\]/);
  assert.match(styles, /data-visual-material="magical-crystal"/);
  assert.match(styles, /--motion-duration-standard/);
  assert.match(styles, /--motion-ease-inertia/);
  assert.match(styles, /--motion-physics-card-hover-scale/);
  assert.match(styles, /\.motion-debug-overlay/);
  assert.match(styles, /\.motion-debug-overlay\[hidden\]/);
  assert.match(styles, /action-card-draw var\(--motion-duration-standard\)/);
  assert.match(styles, /commander-action-hand-breathe var\(--motion-duration-ambient\)/);
  assert.match(styles, /\.command-deck\b/);
  assert.match(styles, /\.command-deck__rotator\b/);
  assert.match(styles, /\.command-deck__favorite-toggle\b/);
  assert.match(styles, /data-command-deck-center="true"/);
  assert.match(styles, /data-command-deck-slot="-3"/);
  assert.match(styles, /\.action-card\b/);
  assert.match(styles, /\.action-card--commander\b/);
  assert.match(styles, /\.commander-action-hand__fan:has\(\.action-card:hover\)/);
  assert.match(styles, /\.action-card:has\(\+ \.action-card:hover\)/);
  assert.match(styles, /\.action-card-state-resting\b/);
  assert.match(styles, /\.action-card-state-idle\b/);
  assert.match(styles, /\.action-card-state-focused\b/);
  assert.match(styles, /\.action-card-state-expanded\b/);
  assert.match(styles, /\.action-card-state-selected\b/);
  assert.match(styles, /\.action-card-state-waiting\b/);
  assert.match(styles, /\.action-card-state-disabled\b/);
  assert.match(styles, /\.action-card-state-appearing\b/);
  assert.match(styles, /\.action-card-state-leaving\b/);
  assert.match(styles, /\.action-card-state-promoted\b/);
  assert.match(styles, /\.action-card-state-demoted\b/);
  assert.match(styles, /\.action-card-state-resolving\b/);
  assert.match(styles, /clip-path: polygon/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(visualDoc, /Commander Action Hand Standard/);
  assert.match(visualDoc, /Rotating Command Deck Standard/);
  assert.match(battlefieldDoc, /Prompt 12\.3C Commander Action Hand/);
  assert.match(battlefieldDoc, /Prompt 12\.3F Rotating Command Deck/);
  assert.match(actionHandDoc, /Research/);
  assert.match(actionHandDoc, /Ideation/);
  assert.match(actionHandDoc, /Whiteboarding/);
  assert.match(actionHandDoc, /Visual Mockups/);
  assert.match(actionHandDoc, /Interactive Prototype Gate/);
  assert.match(actionHandDoc, /Internal Design Critique/);
  assert.match(rotatingDeckDoc, /circular Rotating Command Deck/i);
  assert.match(rotatingDeckDoc, /Wheel, drag, keyboard, and controller-ready/i);
  assert.match(rotatingDeckDoc, /Future work must not turn the deck into a scrolling list/i);
  assert.match(motionDoc, /Motion Token System/);
  assert.match(motionDoc, /Developer Debug Overlay/);
  assert.match(motionDoc, /production builds/);
  assert.match(motionTokens, /BOARDSTATE_MOTION_LANGUAGE_VERSION = "boardstate-motion-language-0\.1\.0"/);
  assert.match(motionTokens, /createMotionTokenSet/);
  assert.match(motionTokens, /MOTION_STATE_CATALOG/);
  assert.match(motionTokens, /MOTION_OWNERS/);
  assert.match(motionTokens, /createMotionDebugSnapshot/);
  assert.match(visualLanguageDoc, /Visual Token System/);
  assert.match(visualLanguageDoc, /Material System/);
  assert.match(visualLanguageDoc, /Developer Debug Overlay/);
  assert.match(visualTokens, /BOARDSTATE_VISUAL_LANGUAGE_VERSION = "boardstate-visual-language-0\.1\.0"/);
  assert.match(visualTokens, /VISUAL_MATERIALS/);
  assert.match(visualTokens, /VISUAL_LAYERS/);
  assert.match(visualTokens, /createVisualTokenSet/);
  assert.match(visualTokens, /createVisualDebugSnapshot/);
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
  assert.equal(cssVariables["--visual-outline-focus"], tokens.outline.focus);

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
  assert.ok(debug.fields.includes("theme"));
});

test("battlefield runtime uses the tabletop reconstruction instead of idle dashboard panels", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const visualDoc = readRepositoryFile("docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md");
  const battlefieldDoc = readRepositoryFile("docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md");
  const compositionDoc = readRepositoryFile("docs/ecosystem/HUD_COMPOSITION_VISUAL_HIERARCHY.md");

  assert.match(render, /TABLETOP_RECONSTRUCTION_VERSION = "boardstate-tabletop-reconstruction-0\.1\.0"/);
  assert.match(render, /HUD_COMPOSITION_VERSION = "boardstate-hud-composition-0\.1\.0"/);
  assert.match(render, /document\.body\.dataset\.tabletopReconstructionVersion = TABLETOP_RECONSTRUCTION_VERSION/);
  assert.match(render, /document\.body\.dataset\.hudCompositionVersion = HUD_COMPOSITION_VERSION/);
  assert.match(render, /data-tabletop-reconstruction-version/);
  assert.match(render, /data-hud-composition-version/);
  assert.match(render, /tabletop-battlefield-page/);
  assert.match(render, /tabletop-empty-board/);
  assert.equal(render.includes("landscape-selected-card is-empty"), false);
  assert.equal(render.includes("Public board not shown"), false);
  assert.equal(render.includes("Bottom Battlefield"), false);
  assert.match(styles, /\.tabletop-battlefield-page\b/);
  assert.match(styles, /battlefield reconstruction removes dashboard chrome/i);
  assert.match(styles, /HUD composition pass/i);
  assert.match(styles, /landscape-selected-card\.is-empty/);
  assert.match(styles, /landscape-stack-core\.is-idle/);
  assert.match(styles, /app-shell--battlefield \.app-header/);
  assert.match(styles, /commander-action-hand__status:has\(\.action-hand-queue\)/);
  assert.match(styles, /pointer-events: none/);
  assert.match(styles, /pointer-events: auto/);
  assert.match(styles, /action-card-state-idle/);
  assert.match(styles, /saturate\(0\.76\)/);
  assert.match(styles, /action-card-state-idle\.action-card-entering/);
  assert.match(styles, /animation-fill-mode: none/);
  assert.match(visualDoc, /Battlefield Reconstruction Standard/);
  assert.match(visualDoc, /HUD Composition And Visual Hierarchy Standard/);
  assert.match(battlefieldDoc, /Prompt 12\.2A Battlefield Reconstruction/);
  assert.match(battlefieldDoc, /Prompt 12\.3E HUD Composition/);
  assert.match(compositionDoc, /battlefield must be the first read/i);
  assert.match(compositionDoc, /Future HUD work must preserve/i);
});

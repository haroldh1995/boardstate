import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createDefaultProfile } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";
import {
  applySharedPreferencePatch,
  createSharedPreferenceSnapshot,
} from "../src/ecosystem/ecosystemIntegration.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
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
  assert.equal(profile.settings.navigation.edgeSwipeShortcuts, false);
  assert.equal(profile.settings.navigation.compactMobileHud, false);
  assert.equal(profile.settings.navigation.mobileFocusView, false);

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
  assert.equal(attemptedEdgeSwipe.settings.navigation.edgeSwipeShortcuts, false);
});

test("ecosystem preferences report landscape honestly and reject portrait/mobile patches", () => {
  const profile = createDefaultProfile();
  const snapshot = createSharedPreferenceSnapshot(profile);
  assert.equal(snapshot.animation.compositionMode, "landscape");
  assert.equal(snapshot.interaction.edgeSwipeShortcuts, false);
  assert.equal(snapshot.synchronizedThroughHub, false);

  const patched = applySharedPreferencePatch(profile, {
    interaction: { edgeSwipeShortcuts: true },
    animation: { compositionMode: "mobile" },
  });
  assert.equal(patched.settings.appearance.compositionMode, "landscape");
  assert.equal(patched.settings.navigation.edgeSwipeShortcuts, false);
  assert.equal(patched.settings.navigation.compactMobileHud, false);
  assert.equal(patched.settings.navigation.mobileFocusView, false);
});

test("battlefield model treats noncanonical viewport hints as landscape-safe desktop", () => {
  const model = createLandscapeBattlefieldModel(createDefaultProfile(), { viewport: "portrait-support" });
  assert.equal(model.orientation, "landscape-first");
  assert.equal(model.viewport, "desktop");
});

test("runtime no longer contains portrait wallpaper selection or mobile navigation scaffolding", () => {
  const main = readRepositoryFile("src/main.js");
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const landscapeModel = readRepositoryFile("src/ui/landscapeBattlefield.js");

  assert.equal(main.includes("boardstate-bg-portrait"), false);
  assert.equal(styles.includes("boardstate-bg-portrait"), false);
  assert.equal(render.includes("orientationchange"), false);
  assert.equal(render.includes("data-mobile-nav"), false);
  assert.equal(render.includes("data-edge-zone"), false);
  assert.equal(landscapeModel.includes("portrait-support"), false);
  assert.match(render, /boardstate-native-game-visual-foundation-0\.1\.0/);
  assert.equal(render.includes("dataset.gameplayComposition = CANONICAL_GAMEPLAY_COMPOSITION"), true);
});

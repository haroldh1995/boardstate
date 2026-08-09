import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BATTLEFIELD_DENSITY_STATES,
  BATTLEFIELD_GESTURE_OWNERS,
  BATTLEFIELD_OVERFLOW_ORDER,
  CANONICAL_BATTLEFIELD_GEOMETRY_VERSION,
  createCanonicalBattlefieldGeometry,
  resolveBattlefieldDensityState,
  resolveBattlefieldGestureOwner,
} from "../src/gameplay/battlefieldGeometry.js";
import {
  resolveCommandDeckCardProjection,
  resolveCommandDeckFocusedCard,
} from "../src/gameplay/commandDeckModel.js";
import {
  createSingleResolvePlan,
  shouldAutoProgressLiveTrackingStack,
} from "../src/gameplay/canonicalGameplay.js";
import { castSpellToStack, resolveTopOfStack } from "../src/effects/effectEngine.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function makePermanent(id, typeLine, extras = {}) {
  return createPermanent({
    id,
    name: extras.name || id,
    typeLine,
    owner: extras.owner || "player",
    controller: extras.controller || "player",
    ...extras,
  });
}

test("Part 2 battlefield geometry creates fixed tabletop creature and land/support zones", () => {
  const permanents = [
    makePermanent("creature-a", "Creature - Elf", { currentPower: 1, currentToughness: 1 }),
    makePermanent("walker-1", "Planeswalker - Chandra", { loyalty: 3, counters: { Loyalty: 3 } }),
    makePermanent("walker-2", "Planeswalker - Teferi", { loyalty: 4, counters: { Loyalty: 4 } }),
    makePermanent("land-a", "Basic Land - Forest"),
    makePermanent("artifact-a", "Artifact"),
    makePermanent("enchantment-a", "Enchantment"),
  ];
  const geometry = createCanonicalBattlefieldGeometry(permanents, { role: "local", viewport: "desktop", playerCount: 4 });
  assert.equal(geometry.version, CANONICAL_BATTLEFIELD_GEOMETRY_VERSION);
  assert.deepEqual(BATTLEFIELD_DENSITY_STATES, ["empty", "sparse", "normal", "busy", "extreme"]);
  assert.deepEqual(geometry.zones.map((zone) => zone.key), ["creature-zone", "land-support-zone"]);
  assert.deepEqual(geometry.creatureZone.permanents.map((permanent) => permanent.id), ["creature-a", "walker-2", "walker-1"]);
  assert.deepEqual(geometry.planeswalkerPlacement.renderOrder, ["walker-2", "walker-1"]);
  assert.deepEqual(geometry.lowerZone.permanents.map((permanent) => permanent.id), ["land-a", "artifact-a", "enchantment-a"]);
  assert.equal(geometry.lowerZone.permanents[1].placementRole, "support-far-right");
  assert.equal(geometry.creatureZone.verticalScrollAllowed, false);
  assert.equal(geometry.lowerZone.verticalScrollAllowed, false);
  assert.equal(geometry.presentationOnly, true);
});

test("Part 2 density escalates before zone-local horizontal scrolling", () => {
  assert.equal(resolveBattlefieldDensityState({ permanentCount: 0 }), "empty");
  assert.equal(resolveBattlefieldDensityState({ permanentCount: 3, tokenCount: 1, viewport: "desktop", playerCount: 2 }), "sparse");
  assert.equal(resolveBattlefieldDensityState({ permanentCount: 12, tokenCount: 4, viewport: "desktop", playerCount: 4 }), "normal");
  assert.equal(resolveBattlefieldDensityState({ permanentCount: 34, tokenCount: 14, viewport: "desktop", playerCount: 4 }), "busy");
  assert.equal(resolveBattlefieldDensityState({ permanentCount: 100, tokenCount: 40, viewport: "tablet-landscape", playerCount: 4 }), "extreme");

  const extremeBoard = [
    ...Array.from({ length: 62 }, (_, index) => makePermanent(`creature-${index}`, "Creature - Goblin", { isToken: true, currentPower: 1, currentToughness: 1 })),
    ...Array.from({ length: 38 }, (_, index) => makePermanent(`land-${index}`, "Basic Land - Mountain")),
  ];
  const geometry = createCanonicalBattlefieldGeometry(extremeBoard, { viewport: "desktop", playerCount: 4 });
  assert.equal(geometry.densityState, "extreme");
  assert.deepEqual(geometry.overflowOrder, BATTLEFIELD_OVERFLOW_ORDER);
  assert.equal(geometry.creatureZone.overflowMode, "zone-local-horizontal-scroll");
  assert.equal(geometry.lowerZone.overflowMode, "zone-local-horizontal-scroll");
  assert.equal(geometry.creatureZone.horizontalScrollAllowed, true);
  assert.equal(geometry.lowerZone.horizontalScrollAllowed, true);
  assert.equal(geometry.creatureZone.authoritativeObjectIds.length, 62);
  assert.equal(geometry.lowerZone.authoritativeObjectIds.length, 38);
});

test("Part 2 gesture ownership separates command hand, zone overflow, and opponent navigation", () => {
  assert.equal(resolveBattlefieldGestureOwner({ origin: "command-hand", opponentBackground: true }), BATTLEFIELD_GESTURE_OWNERS.commandHand);
  assert.equal(resolveBattlefieldGestureOwner({ zoneOverflowing: true, opponentBackground: true }), BATTLEFIELD_GESTURE_OWNERS.overflowingZone);
  assert.equal(resolveBattlefieldGestureOwner({ opponentBackground: true }), BATTLEFIELD_GESTURE_OWNERS.opponentNavigation);
  assert.equal(resolveBattlefieldGestureOwner({ cardDragActive: true, zoneOverflowing: true }), BATTLEFIELD_GESTURE_OWNERS.cardDrag);
  assert.equal(resolveBattlefieldGestureOwner({ inspectionActive: true, opponentBackground: true }), BATTLEFIELD_GESTURE_OWNERS.cardInspection);
});

test("landscape model exposes Part 2 tabletop geometry without replacing authoritative state", () => {
  const profile = createDefaultProfile();
  profile.activeSession.battlefield.player = [
    makePermanent("creature-a", "Creature - Elf"),
    makePermanent("walker-1", "Planeswalker - Chandra", { loyalty: 3 }),
    makePermanent("land-a", "Basic Land - Forest"),
    makePermanent("artifact-a", "Artifact"),
  ];
  const model = createLandscapeBattlefieldModel(profile, { viewport: "desktop" });
  assert.equal(model.battlefieldGeometryVersion, CANONICAL_BATTLEFIELD_GEOMETRY_VERSION);
  assert.equal(model.localBattlefield.tabletop.creatureZone.permanents.at(-1).placementRole, "planeswalker-far-right");
  assert.equal(model.localBattlefield.tabletop.lowerZone.permanents.at(-1).placementRole, "support-far-right");
  assert.equal(model.localBattlefield.presentationState.authoritativeStateSeparated, true);
  assert.equal(model.localBattlefield.allPermanents.length, 4);
});

test("Command Hand focus law keeps one centered card as logical, visual, and z-order focus", () => {
  const commandIds = ["phase", "commander", "library", "rules", "remind", "undo", "battlefield", "history", "notes", "calculator", "dice", "coin", "settings"];
  for (let centerIndex = 0; centerIndex < commandIds.length; centerIndex += 1) {
    const candidates = commandIds.map((id, index) => {
      let offset = index - centerIndex;
      if (offset > commandIds.length / 2) offset -= commandIds.length;
      if (offset < -commandIds.length / 2) offset += commandIds.length;
      return { id, slotOffset: offset, priority: id === "phase" ? 96 : 10 };
    });
    const focused = resolveCommandDeckFocusedCard(candidates);
    assert.equal(focused.id, commandIds[centerIndex]);
    const projections = candidates.map((candidate) => ({
      id: candidate.id,
      projection: resolveCommandDeckCardProjection(candidate.slotOffset, candidate.priority, candidate.id === focused.id),
    }));
    const top = projections.reduce((best, entry) => entry.projection.zIndex > best.projection.zIndex ? entry : best);
    assert.equal(top.id, focused.id);
    assert.equal(projections.filter((entry) => entry.projection.offset === 0).length, 1);
  }
});

test("Single Resolve completes uncontested permanent spell once and stops for real choices", () => {
  const profile = createDefaultProfile();
  const solRing = { name: "Sol Ring", typeLine: "Artifact", oracleText: "{T}: Add {C}{C}.", manaCost: "{1}", controller: "player", owner: "player" };
  const castSession = castSpellToStack(profile.activeSession, solRing, { controller: "player" });
  const resolvePlan = createSingleResolvePlan(castSession, { stackId: castSession.stack[0].id });
  assert.equal(resolvePlan.mode, "single-resolve");
  assert.equal(shouldAutoProgressLiveTrackingStack(castSession, {}).allowed, true);

  const resolved = resolveTopOfStack(castSession, { stackId: castSession.stack[0].id });
  assert.equal(resolved.stack.length, 0);
  assert.equal(resolved.battlefield.player.some((permanent) => permanent.name === "Sol Ring"), true);

  const withChoice = {
    ...castSession,
    pendingEffects: [{ id: "choice-1", stackObjectId: castSession.stack[0].id, status: "pending" }],
  };
  const choicePlan = createSingleResolvePlan(withChoice, { stackId: withChoice.stack[0].id });
  assert.equal(choicePlan.mode, "interrupt-for-decision");
  assert.equal(shouldAutoProgressLiveTrackingStack(withChoice, {}).allowed, false);
});

test("Part 2 runtime and CSS prohibit global battlefield scrolling and document web-shell boundaries", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const canonicalDoc = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");
  const portabilityDoc = readRepositoryFile("docs/ecosystem/NATIVE_PORTABILITY_AUDIT.md");

  assert.match(render, /data-global-vertical-scroll="false"/);
  assert.match(render, /data-zone-overflow/);
  assert.match(render, /data-horizontal-scroll/);
  assert.match(styles, /tabletop-zone-layout/);
  assert.match(styles, /overflow-y:\s*hidden/);
  assert.match(styles, /zone-local-horizontal-scroll/);
  assert.match(styles, /data-command-deck-focused="false"/);
  assert.match(canonicalDoc, /No global battlefield scrolling/i);
  assert.match(portabilityDoc, /platform adapters/i);
});

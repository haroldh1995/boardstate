import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CANONICAL_BATTLEFIELD_GEOGRAPHY,
  CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
  CANONICAL_GAMEPLAY_LAWS,
  LIVE_TRACKING_ASSUMPTIONS,
  PROTECTED_GAMEPLAY_CORRIDOR,
  SINGLE_RESOLVE_LAW,
  createCanonicalGameplayRuntimeContract,
  createSingleResolvePlan,
  shouldAutoProgressLiveTrackingStack,
} from "../src/gameplay/canonicalGameplay.js";
import { castSpellToStack, resolveTopOfStack } from "../src/effects/effectEngine.js";
import { createDefaultProfile, createGameSession } from "../src/state/schema.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical gameplay architecture Part 1 is documented as the precedence layer", () => {
  const doc = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");
  const constitution = readRepositoryFile("docs/ecosystem/BOARDSTATE_CONSTITUTION.md");
  const nativeVisual = readRepositoryFile("docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md");
  const landscape = readRepositoryFile("docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md");
  const readme = readRepositoryFile("docs/ecosystem/README.md");

  assert.match(doc, /world's best digital Commander table/i);
  assert.match(doc, /Physical Commander defines battlefield geography/i);
  assert.match(doc, /Arena is a presentation reference only/i);
  assert.match(doc, /Live Tracking Assumption Engine/i);
  assert.match(doc, /One Resolve completes the entire uncontested action/i);
  assert.match(doc, /No global battlefield scrolling/i);
  assert.match(doc, /The protected gameplay corridor/i);
  assert.match(doc, /The official two-player beginner playmat is the reference for spatial organization only/i);
  assert.match(doc, /Future parts must continue from this architecture without redefining these concepts/i);
  assert.match(constitution, /Prompt 13\.2\.6 Part 1 is the canonical gameplay architecture/);
  assert.match(nativeVisual, /CANONICAL_GAMEPLAY_ARCHITECTURE\.md` takes precedence/);
  assert.match(landscape, /Prompt 13\.2\.6 Part 1 supersedes this document/);
  assert.match(readme, /CANONICAL_GAMEPLAY_ARCHITECTURE\.md/);
});

test("canonical gameplay module exposes permanent laws, geography, and runtime contract", () => {
  assert.equal(CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION, "boardstate-canonical-gameplay-dual-hand-1.0.0");
  assert.equal(CANONICAL_GAMEPLAY_LAWS.length, 17);
  assert.ok(CANONICAL_GAMEPLAY_LAWS.includes("no-global-battlefield-scrolling"));
  assert.ok(CANONICAL_GAMEPLAY_LAWS.includes("dual-hand-dock-remains-permanently-integrated"));
  assert.ok(CANONICAL_GAMEPLAY_LAWS.includes("player-hand-is-authoritative-private-zone-state"));
  assert.equal(CANONICAL_BATTLEFIELD_GEOGRAPHY.playerTerritory, "bottom-anchored");
  assert.equal(CANONICAL_BATTLEFIELD_GEOGRAPHY.opponentTerritory, "top-anchored");
  assert.equal(CANONICAL_BATTLEFIELD_GEOGRAPHY.lanes.creatures, "combat-facing-creature-lane");
  assert.equal(CANONICAL_BATTLEFIELD_GEOGRAPHY.lanes.lands, "resource-lane-nearest-player-edge");
  assert.equal(PROTECTED_GAMEPLAY_CORRIDOR.policy, "must-remain-clear");
  assert.ok(PROTECTED_GAMEPLAY_CORRIDOR.prohibitedPermanentObstructions.includes("notifications"));
  assert.ok(LIVE_TRACKING_ASSUMPTIONS.automaticProgression.includes("creatures-enter-immediately-after-resolve"));
  assert.equal(SINGLE_RESOLVE_LAW.oneResolveCompletesUncontestedAction, true);

  const contract = createCanonicalGameplayRuntimeContract("battlefield");
  assert.equal(contract.version, CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION);
  assert.equal(contract.viewport, "fixed");
  assert.equal(contract.orientation, "landscape");
  assert.equal(contract.globalBattlefieldScroll, false);
  assert.equal(contract.notificationsCoverGameplay, false);
  assert.equal(contract.tacticalCommandHand, "ordered-overlapping-non-circular-command-hand");
  assert.equal(contract.playerHand, "authoritative-owner-private-hand-zone");
});

test("battlefield model carries canonical gameplay law metadata without becoming rules authority", () => {
  const model = createLandscapeBattlefieldModel(createDefaultProfile(), { viewport: "desktop" });
  assert.equal(model.canonicalGameplay.version, CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION);
  assert.deepEqual(model.canonicalGameplay.laws, CANONICAL_GAMEPLAY_LAWS);
  assert.equal(model.canonicalGameplay.runtimeContract.battlefieldModel, "spatial-tabletop");
  assert.equal(model.canonicalGameplay.battlefieldGeography.sharedCorridor, "center-protected-gameplay-corridor");
  assert.equal(model.canonicalGameplay.protectedGameplayCorridor.id, "protected-gameplay-corridor");
  assert.equal(model.canonicalGameplay.liveTrackingAssumptions.engine, "live-tracking-assumption-engine");
  assert.equal(model.canonicalGameplay.singleResolveLaw.actionMeaning, "player-is-finished-resolving-this-spell");
  assert.equal(model.canonicalGameplay.mtgArenaRole, "digital-presentation-reference-only");
  assert.equal(model.canonicalGameplay.physicalCommanderRole, "battlefield-geography-and-gameplay-flow-authority");
});

test("single resolve law resolves an uncontested permanent spell onto the battlefield in one action", () => {
  let session = castSpellToStack(createGameSession(), {
    name: "Sol Ring",
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
  });
  const plan = createSingleResolvePlan(session);
  assert.equal(plan.canResolve, true);
  assert.equal(plan.mode, "single-resolve");
  assert.equal(plan.oneResolveCompletesUncontestedAction, true);
  assert.ok(plan.resolveSteps.includes("move-permanent-onto-battlefield-when-applicable"));

  session = resolveTopOfStack(session, { stackId: plan.stackObjectId });
  assert.equal(session.stack.length, 0);
  assert.ok(session.battlefield.player.some((permanent) => permanent.name === "Sol Ring"));
  assert.equal(shouldAutoProgressLiveTrackingStack(session).allowed, false);
});

test("live tracking assumption engine interrupts only when a real player decision exists", () => {
  const pendingSession = castSpellToStack(createGameSession(), {
    name: "Lightning Bolt",
    typeLine: "Instant",
    oracleText: "Lightning Bolt deals 3 damage to any target.",
  });
  const pendingPlan = createSingleResolvePlan(pendingSession);
  assert.equal(pendingPlan.canResolve, false);
  assert.equal(pendingPlan.reason, "pending-player-decision");
  assert.equal(shouldAutoProgressLiveTrackingStack(pendingSession).allowed, false);

  const opponentSession = castSpellToStack(createGameSession(), {
    name: "Sol Ring",
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
  }, { controller: "opponent" });
  const prioritySession = {
    ...opponentSession,
    priority: { waiting: true, activePlayerId: "local-player" },
    pendingEffects: [],
  };
  assert.equal(shouldAutoProgressLiveTrackingStack(prioritySession).allowed, false);
  assert.equal(shouldAutoProgressLiveTrackingStack(prioritySession).reason, "priority-decision-required");

  const manualSession = castSpellToStack(createGameSession(), {
    name: "Arcane Signet",
    typeLine: "Artifact",
  });
  assert.equal(shouldAutoProgressLiveTrackingStack(manualSession, { manualStackConfirmation: true }).allowed, false);
});

test("runtime and CSS enforce fixed viewport, edge-safe notifications, and canonical datasets", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");

  assert.match(render, /CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION/);
  assert.match(render, /document\.body\.dataset\.canonicalGameplayArchitectureVersion/);
  assert.match(render, /document\.body\.dataset\.protectedGameplayCorridor/);
  assert.match(render, /document\.body\.dataset\.liveTrackingAssumptionEngine/);
  assert.match(render, /data-canonical-gameplay-architecture-version/);
  assert.match(render, /getActiveFullWindowNotification\(profile, activePage\)/);
  assert.match(render, /if \(page === "battlefield"\) {\s*return null;\s*}/);
  assert.match(render, /shouldAutoProgressLiveTrackingStack\(session, profile\.settings \|\| {}\)/);
  assert.match(render, /createSingleResolvePlan\(session, { stackId: spellStack\[0\]\.id }\)/);
  assert.match(render, /Resolved the top stack object and advanced all uncontested effects/);

  assert.match(styles, /body,\s*\n#app\s*{[^}]*overflow: hidden;/);
  assert.match(styles, /#app\s*{[^}]*position: fixed;[^}]*inset: 0;/);
  assert.match(styles, /body\[data-game-viewport="fixed"\] \.app-shell\s*{[^}]*position: fixed;[^}]*overflow: hidden;/);
  assert.match(styles, /body\[data-page="battlefield"\] \.landscape-battlefield-page\s*{[^}]*overflow: hidden;/);
  assert.match(styles, /@media \(max-width: 1279px\)[\s\S]*\.landscape-battlefield-page\s*{[\s\S]*height: calc\(100svh - 5rem\);[\s\S]*overflow: hidden;/);
  assert.equal(/\.landscape-battlefield-page\s*{\s*height: auto;\s*min-height: calc\(100svh - 5rem\);\s*overflow: visible;/.test(styles), false);
  assert.match(styles, /body\[data-page="battlefield"\] \.recovery-toast-stack\s*{[\s\S]*bottom: calc\(var\(--game-command-hand-space/);
});

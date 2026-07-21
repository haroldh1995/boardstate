import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import {
  GAMEPLAY_FLOW_VERSION,
  LANDSCAPE_BATTLEFIELD_REGIONS,
  LANDSCAPE_BATTLEFIELD_VERSION,
  createBattlefieldCameraModel,
  createLandscapeBattlefieldModel,
  createOpponentCarouselModel,
  createPermanentInteractionModel,
  createPriorityFlowModel,
  createSelectedCardDetails,
  createTriggerWorkflowGroups,
  createTokenStacks,
  getPermanentLaneKey,
  organizePermanentsByLane,
} from "../src/ui/landscapeBattlefield.js";
import { createCommanderPlayers, createCommanderTestSession } from "./fixtures/commanderSessionFixtures.js";

function createLandscapeProfile() {
  const profile = createDefaultProfile();
  const localCommander = createPermanent({
    id: "local-commander",
    name: "Astra, Dawn Marshal",
    typeLine: "Legendary Creature - Human Soldier",
    oracleText: "Vigilance. Whenever you attack, create a 1/1 Soldier creature token.",
    isCommander: true,
    currentPower: 3,
    currentToughness: 4,
    counters: { "+1/+1": 2 },
    commanderTax: 2,
    owner: "player",
    controller: "player",
  });
  profile.activeSession = {
    ...profile.activeSession,
    life: 36,
    turn: 7,
    phaseIndex: 2,
    selectedIds: ["local-commander"],
    commander: {
      name: "Astra, Dawn Marshal",
      cardId: "local-commander-card",
      zone: "battlefield",
      castCount: 2,
      commanderTax: 2,
      damageByOpponent: { opponent: 8 },
    },
    battlefield: {
      ...profile.activeSession.battlefield,
      player: [
        localCommander,
        createPermanent({ id: "local-creature", name: "Skyguard", typeLine: "Creature - Bird", oracleText: "Flying", currentPower: 2, currentToughness: 2, keywords: ["Flying"] }),
        createPermanent({ id: "local-land", name: "Command Tower", typeLine: "Land" }),
        createPermanent({ id: "local-artifact", name: "Arcane Signet", typeLine: "Artifact" }),
        createPermanent({ id: "local-enchantment", name: "Rhythm of the Wild", typeLine: "Enchantment" }),
        createPermanent({ id: "local-walker", name: "Chandra", typeLine: "Legendary Planeswalker - Chandra", loyalty: 4 }),
        createPermanent({ id: "local-battle", name: "Invasion of Test", typeLine: "Battle - Siege", defense: 5 }),
        createPermanent({ id: "soldier-tokens", name: "Soldier", typeLine: "Token Creature - Soldier", isToken: true, quantity: 12, currentPower: 1, currentToughness: 1 }),
      ],
      opponent: [
        createPermanent({ id: "op-lands", name: "Mountain", typeLine: "Basic Land - Mountain", controller: "opponent", owner: "opponent", quantity: 6, tapped: true }),
        createPermanent({ id: "op-creature", name: "Dragon Whelp", typeLine: "Creature - Dragon", oracleText: "Flying", controller: "opponent", owner: "opponent", currentPower: 2, currentToughness: 3 }),
      ],
    },
    stack: [
      {
        id: "stack-1",
        name: "Lightning Bolt",
        controller: "opponent",
        card: { name: "Lightning Bolt", typeLine: "Instant", oracleText: "Lightning Bolt deals 3 damage to any target." },
        targetIds: ["local-commander"],
      },
    ],
    triggerQueue: [
      { id: "trigger-1", sourceName: "Astra, Dawn Marshal", eventType: "attack", status: "pending" },
    ],
    pendingEffects: [
      { id: "choice-1", sourceName: "Lightning Bolt", status: "pending", effect: { choiceKind: "targets" }, stackObjectId: "stack-1" },
    ],
  };
  profile.settings = {
    ...profile.settings,
    battlefield: {
      ...(profile.settings?.battlefield || {}),
      statsOverlay: true,
    },
  };
  return profile;
}

test("landscape model exposes permanent Commander battlefield regions without changing authority", () => {
  const model = createLandscapeBattlefieldModel(createLandscapeProfile(), { viewport: "desktop" });
  assert.equal(model.version, LANDSCAPE_BATTLEFIELD_VERSION);
  assert.deepEqual(model.regions, LANDSCAPE_BATTLEFIELD_REGIONS);
  assert.equal(model.orientation, "landscape-first");
  assert.equal(model.localBattlefield.role, "local");
  assert.equal(model.opponentBattlefield.role, "opponent");
  assert.equal(model.commandCenter.phaseLabel, "Combat");
  assert.equal(model.commandCenter.stackObjects.length, 1);
  assert.equal(model.commandCenter.triggerQueue.length, 1);
  assert.equal(model.gameplayFlow.version, GAMEPLAY_FLOW_VERSION);
  assert.equal(model.gameplayFlow.mode, "contextual-commander-gameplay");
  assert.equal(model.contextActions.some((entry) => entry.status !== "available"), false);
  assert.deepEqual(model.contextActions.map((entry) => entry.id), ["search", "stack", "triggers", "history", "display", "settings"]);
  assert.equal(model.accessibility.touchTargetMinimumPx, 44);
});

test("gameplay flow exposes only contextual actions for the selected permanent", () => {
  const profile = createLandscapeProfile();
  const model = createLandscapeBattlefieldModel(profile, { viewport: "desktop" });
  const selected = model.gameplayFlow.selected;
  assert.equal(selected.active, true);
  assert.equal(selected.title, "Astra, Dawn Marshal");
  assert.equal(selected.commander.tax, 2);
  assert.ok(selected.primaryActions.some((action) => action.id === "commander-tools"));
  assert.ok(selected.primaryActions.some((action) => action.id === "declare-attacker"));
  assert.ok(selected.utilityActions.some((action) => action.id === "commander-damage"));
  assert.ok(selected.dangerActions.some((action) => action.id === "destroy"));
});

test("land selections stay low-friction and do not expose creature-only actions", () => {
  const profile = createLandscapeProfile();
  profile.activeSession.selectedIds = ["local-land"];
  const model = createLandscapeBattlefieldModel(profile, { viewport: "desktop" });
  const actionIds = model.gameplayFlow.selected.actions.map((action) => action.id);
  assert.ok(actionIds.includes("tap-for-mana"));
  assert.ok(actionIds.includes("add-matching-land"));
  assert.equal(actionIds.includes("declare-attacker"), false);
  assert.equal(actionIds.includes("destroy"), false);
});

test("opponent permanent selection is public inspection only", () => {
  const permanent = createPermanent({ id: "op-creature", name: "Dragon Whelp", typeLine: "Creature - Dragon", controller: "opponent", publicOnly: true });
  const interaction = createPermanentInteractionModel(permanent, createLandscapeProfile().activeSession, {
    localBoard: { playerId: "local-player" },
    perspective: { localPlayerId: "local-player" },
  });
  assert.equal(interaction.publicOnly, true);
  assert.deepEqual(interaction.actions.map((action) => action.id), ["inspect"]);
});

test("trigger and priority workflows group Commander complexity without creating dead actions", () => {
  const groups = createTriggerWorkflowGroups([
    { id: "a", sourceName: "Soul Warden", eventType: "enter", status: "pending", optional: true },
    { id: "b", sourceName: "Soul Warden", eventType: "enter", status: "pending", optional: true },
    { id: "c", sourceName: "Cathars' Crusade", eventType: "enter", status: "resolved" },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].optional, true);
  const priority = createPriorityFlowModel({ localCanAct: true, stackObjects: [{ id: "spell-1" }], pendingChoices: [] });
  assert.equal(priority.shouldInterrupt, true);
  assert.deepEqual(priority.actions.map((action) => action.id), ["pass-priority", "respond-stack", "open-stack"]);
});

test("battlefield lanes organize Commander permanents by gameplay role", () => {
  const profile = createLandscapeProfile();
  const lanes = organizePermanentsByLane(profile.activeSession.battlefield.player);
  const counts = Object.fromEntries(lanes.map((lane) => [lane.key, lane.count]));
  assert.equal(counts.commanders, 1);
  assert.equal(counts.creatures, 1);
  assert.equal(counts.lands, 1);
  assert.equal(counts.artifacts, 1);
  assert.equal(counts.enchantments, 1);
  assert.equal(counts.planeswalkers, 1);
  assert.equal(counts.battles, 1);
  assert.equal(counts.tokens, 12);
  assert.equal(getPermanentLaneKey({ typeLine: "Battle - Siege" }), "battles");
});

test("token stacks preserve internal identity while supporting high-count presentation", () => {
  const tokens = [
    createPermanent({ id: "t1", name: "Goblin", typeLine: "Token Creature - Goblin", isToken: true, quantity: 5, currentPower: 1, currentToughness: 1 }),
    createPermanent({ id: "t2", name: "Goblin", typeLine: "Token Creature - Goblin", isToken: true, quantity: 3, currentPower: 1, currentToughness: 1 }),
    createPermanent({ id: "t3", name: "Spirit", typeLine: "Token Creature - Spirit", isToken: true, tapped: true, currentPower: 1, currentToughness: 1 }),
  ];
  const stacks = createTokenStacks(tokens);
  const goblins = stacks.find((entry) => entry.name === "Goblin");
  assert.equal(goblins.quantity, 8);
  assert.deepEqual(goblins.memberIds, ["t1", "t2"]);
  assert.equal(stacks.find((entry) => entry.name === "Spirit").tapped, true);
});

test("selected card panel retains Oracle text, counters, relationships, owner, controller, and status", () => {
  const profile = createLandscapeProfile();
  const details = createSelectedCardDetails(profile.activeSession);
  assert.equal(details.mode, "selected-card");
  assert.equal(details.title, "Astra, Dawn Marshal");
  assert.match(details.oracleText, /create a 1\/1 Soldier/i);
  assert.deepEqual(details.counters, [{ counterType: "+1/+1", value: 2 }]);
  assert.equal(details.owner, "player");
  assert.equal(details.controller, "player");
  assert.equal(details.powerToughness, "3/4");
  assert.ok(details.statuses.includes("Vigilance"));
});

test("opponent projection stays public and does not expose hidden zones or all ten battlefields", () => {
  const players = createCommanderPlayers(10);
  const canonical = createCommanderTestSession(10, { players });
  const model = createLandscapeBattlefieldModel(canonical, { viewport: "tablet-landscape", localPlayerId: "player-a" });
  assert.equal(model.globalInfo.tableStatus.playerCount, 10);
  assert.equal(model.opponentBattlefield.role, "opponent");
  assert.equal(model.opponentBattlefield.visibility.publicOnly, true);
  assert.equal(model.opponentBattlefield.visibility.hiddenZonesExcluded, true);
  assert.equal(model.opponentBattlefield.lanes.flatMap((lane) => lane.permanents).some((permanent) => permanent.zone === "hand" || permanent.zone === "library"), false);
});

test("opponent carousel focuses one public opponent while preserving ten-player table context", () => {
  const players = createCommanderPlayers(10);
  const canonical = createCommanderTestSession(10, {
    players,
    activePlayerId: "player-f",
  });
  const model = createLandscapeBattlefieldModel(canonical, {
    viewport: "tablet-landscape",
    localPlayerId: "player-a",
    focusedOpponentId: "player-e",
  });
  assert.equal(model.opponentCarousel.enabled, true);
  assert.equal(model.opponentCarousel.totalOpponents, 9);
  assert.equal(model.opponentCarousel.totalPlayerCount, 10);
  assert.equal(model.opponentCarousel.renderedOpponentBattlefields, 1);
  assert.equal(model.opponentCarousel.focusedOpponentId, "player-e");
  assert.equal(model.opponentCarousel.nextOpponentId, "player-f");
  assert.equal(model.opponentCarousel.previousOpponentId, "player-d");
  assert.equal(model.opponentCarousel.followActivePlayer.available, true);
  assert.equal(model.opponentCarousel.followActivePlayer.targetOpponentId, "player-f");
  assert.equal(model.opponentCarousel.publicOnly, true);
});

test("opponent carousel defaults to active opponent when no manual focus is provided", () => {
  const players = createCommanderPlayers(4);
  const canonical = createCommanderTestSession(4, {
    players,
    activePlayerId: "player-c",
  });
  const perspective = {
    localPlayerId: "player-a",
    playerCount: 4,
    opponentBoards: players.slice(1).map((player) => ({
      id: player.playerId,
      playerId: player.playerId,
      name: player.displayName,
      life: player.life,
      permanents: [],
    })),
    promptOwnership: { activePlayerId: "player-c" },
  };
  const carousel = createOpponentCarouselModel(canonical, perspective);
  assert.equal(carousel.focusedOpponentId, "player-c");
  assert.equal(carousel.followActivePlayer.enabled, true);
});

test("battlefield intelligence collapses idle HUD and expands relevant stack or combat controls", () => {
  const idleProfile = createLandscapeProfile();
  idleProfile.activeSession.stack = [];
  idleProfile.activeSession.triggerQueue = [];
  idleProfile.activeSession.pendingEffects = [];
  idleProfile.activeSession.selectedIds = [];
  idleProfile.activeSession.phaseIndex = 0;
  idleProfile.activeSession.combat = {};
  const idleModel = createLandscapeBattlefieldModel(idleProfile, { viewport: "desktop" });
  assert.equal(idleModel.intelligence.contextualHud.stack, "collapsed");
  assert.equal(idleModel.intelligence.contextualHud.combatControls, "hidden");

  const activeModel = createLandscapeBattlefieldModel(createLandscapeProfile(), { viewport: "desktop" });
  assert.equal(activeModel.intelligence.contextualHud.stack, "expanded");
  assert.equal(activeModel.intelligence.contextualHud.triggers, "expanded");
  assert.equal(activeModel.intelligence.contextualHud.combatControls, "expanded");
});

test("camera focus priority is deterministic and selected permanents outrank stack and combat", () => {
  const profile = createLandscapeProfile();
  const model = createLandscapeBattlefieldModel(profile, { viewport: "desktop" });
  assert.equal(model.camera.activeFocus.kind, "selected-permanent");
  assert.equal(model.camera.focusQueue[0].priority > model.camera.focusQueue.find((entry) => entry.kind === "stack-object").priority, true);

  const stackOnlyDetails = createSelectedCardDetails({
    ...profile.activeSession,
    selectedIds: [],
  });
  const camera = createBattlefieldCameraModel({
    session: profile.activeSession,
    selectedCard: stackOnlyDetails,
    commandCenter: {
      stackObjects: profile.activeSession.stack,
      triggerQueue: profile.activeSession.triggerQueue,
      pendingChoices: [],
      combat: profile.activeSession.combat,
      phaseLabel: "Combat",
      activePlayerId: "opponent",
      activePlayerName: "Opponent",
    },
    opponentCarousel: { focusedOpponentId: "opponent", followActivePlayer: { enabled: true } },
  });
  assert.equal(camera.activeFocus.kind, "stack-object");
  assert.equal(camera.deterministicPriority, true);
});

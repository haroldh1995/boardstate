import test from "node:test";
import assert from "node:assert/strict";
import { buildAdvancedMultiplayerPerspective, buildAdvancedTargetingVisualModel, applyAdvancedSyncEvent } from "../src/shared-session/perspective.js";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { loadLocalSave, saveCurrentGame } from "../src/storage/saveState.js";

function createProfileWithPlayers(players = []) {
  const profile = createDefaultProfile();
  const remotePlayers = players.filter((player) => player.id !== "local-player");
  return {
    ...profile,
    settings: {
      ...profile.settings,
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
        connectedPlayers: remotePlayers.map((player) => ({
          id: player.id,
          name: player.name,
          activeInterface: player.activeInterface || "boardstate-advanced",
          connectionStatus: player.connectionStatus || "online",
          life: player.life ?? 40,
          publicBoardSnapshot: player.permanents || [],
        })),
      },
    },
    activeSession: {
      ...profile.activeSession,
      activeInterfaceByPlayer: Object.fromEntries(players.map((player) => [player.id, player.activeInterface || "boardstate-advanced"])),
      battlefield: {
        ...profile.activeSession.battlefield,
        player: players.find((player) => player.id === "local-player")?.permanents || [],
        opponent: remotePlayers.flatMap((player) => player.permanents || []),
      },
    },
  };
}

test("two Advanced users render mirrored local perspectives from one canonical session", () => {
  const localBear = createPermanent({
    id: "local-bear",
    name: "Local Bear",
    typeLine: "Creature - Bear",
    controller: "player",
    owner: "player",
  });
  const remoteBear = createPermanent({
    id: "remote-bear",
    name: "Remote Bear",
    typeLine: "Creature - Bear",
    controller: "remote-player",
    owner: "remote-player",
  });
  const profile = createProfileWithPlayers([
    { id: "local-player", name: "Player A", permanents: [localBear], activeInterface: "boardstate-advanced" },
    { id: "remote-player", name: "Player B", permanents: [remoteBear], activeInterface: "boardstate-advanced" },
  ]);

  const playerA = buildAdvancedMultiplayerPerspective(profile, { localPlayerId: "local-player", viewport: { width: 1280 } });
  assert.equal(playerA.viewMode, "two-player-mirrored");
  assert.equal(playerA.localBoard.playerId, "local-player");
  assert.equal(playerA.primaryOpponentBoard.playerId, "remote-player");
  assert.equal(playerA.boardOrder[0], "local-player");
  assert.equal(playerA.fullOpponentBoard, true);

  const playerB = buildAdvancedMultiplayerPerspective(profile, { localPlayerId: "remote-player", viewport: { width: 1280 } });
  assert.equal(playerB.viewMode, "two-player-mirrored");
  assert.equal(playerB.localBoard.playerId, "remote-player");
  assert.equal(playerB.primaryOpponentBoard.playerId, "local-player");
  assert.equal(playerB.boardOrder[0], "remote-player");
});

test("Commander pods use compact opponent focus and mixed interfaces stay honest", () => {
  const profile = createProfileWithPlayers([
    { id: "local-player", name: "Player", permanents: [], activeInterface: "boardstate-advanced" },
    { id: "alpha", name: "Alpha", permanents: [createPermanent({ id: "alpha-land", name: "Island", typeLine: "Land", controller: "alpha", owner: "alpha" })] },
    { id: "beta", name: "Beta", permanents: [], activeInterface: "boardstate-lite" },
    { id: "gamma", name: "Gamma", permanents: [createPermanent({ id: "gamma-creature", name: "Guide", typeLine: "Creature", controller: "gamma", owner: "gamma" })] },
  ]);
  const perspective = buildAdvancedMultiplayerPerspective(profile, {
    localPlayerId: "local-player",
    viewport: { width: 390 },
    focusedOpponentId: "gamma",
  });

  assert.equal(perspective.viewMode, "mixed-interface-session");
  assert.equal(perspective.localBoard.playerId, "local-player");
  assert.equal(perspective.secondaryOpponents.length, 3);
  assert.equal(perspective.focusedOpponent.playerId, "gamma");
  assert.equal(perspective.compactOpponentLanes, true);
  assert.equal(perspective.participants.find((player) => player.playerId === "beta").interfaceMode, "boardstate-lite");
});

test("priority and required choices are actionable only for the owning player", () => {
  const profile = createProfileWithPlayers([
    { id: "local-player", name: "Local", permanents: [], activeInterface: "boardstate-advanced" },
    { id: "remote-player", name: "Remote", permanents: [], activeInterface: "boardstate-advanced" },
  ]);
  profile.activeSession = {
    ...profile.activeSession,
    priority: {
      activePlayerId: "remote-player",
      waiting: true,
      passedPlayerIds: ["local-player"],
      responderIds: ["local-player", "remote-player"],
    },
    pendingEffects: [
      {
        id: "choice-1",
        controller: "remote-player",
        status: "pending",
        effect: { choiceKind: "targets", description: "Choose a target." },
        stackObjectId: "stack-1",
      },
    ],
    stack: [{ id: "stack-1", name: "Remote Bolt", controller: "remote-player" }],
  };

  const localPerspective = buildAdvancedMultiplayerPerspective(profile, { localPlayerId: "local-player" });
  assert.equal(localPerspective.priority.localCanAct, false);
  assert.equal(localPerspective.promptOwnership.pendingChoices[0].localCanAct, false);
  assert.match(localPerspective.promptOwnership.pendingChoices[0].waitingMessage, /Remote/i);

  const remotePerspective = buildAdvancedMultiplayerPerspective(profile, { localPlayerId: "remote-player" });
  assert.equal(remotePerspective.priority.localCanAct, true);
  assert.equal(remotePerspective.promptOwnership.pendingChoices[0].localCanAct, true);
});

test("Advanced sync events dedupe repeats and reject stale revisions without corrupting state", () => {
  const session = createGameSession();
  const event = {
    namespace: "gameplay",
    eventId: "sync-evt-1",
    eventType: "PRIORITY_CHANGED",
    revision: 2,
    payload: { priorityHolderId: "remote-player", passedPlayerIds: ["local-player"] },
  };
  const applied = applyAdvancedSyncEvent(session, event);
  assert.equal(applied.status, "applied");
  assert.equal(applied.session.priority.activePlayerId, "remote-player");
  assert.equal(applied.session.advancedMultiplayer.seenSyncEventIds.includes("sync-evt-1"), true);

  const duplicate = applyAdvancedSyncEvent(applied.session, event);
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.session.priority.activePlayerId, "remote-player");

  const stale = applyAdvancedSyncEvent(applied.session, { ...event, eventId: "sync-evt-2", revision: 1 });
  assert.equal(stale.status, "stale");
  assert.equal(stale.session.advancedMultiplayer.recoveryRequired, true);
});

test("targeting visual model separates valid, invalid, source, and public target metadata", () => {
  const profile = createProfileWithPlayers([
    { id: "local-player", name: "Local", permanents: [createPermanent({ id: "local-wizard", name: "Wizard", typeLine: "Creature", controller: "player" })] },
    { id: "remote-player", name: "Remote", permanents: [createPermanent({ id: "remote-bear", name: "Bear", typeLine: "Creature", controller: "remote-player" })] },
  ]);
  const perspective = buildAdvancedMultiplayerPerspective(profile, { localPlayerId: "local-player" });
  const visuals = buildAdvancedTargetingVisualModel(profile, perspective, {
    perspective,
    sourceId: "local-wizard",
    legalTargets: { validTargets: [{ id: "remote-bear", reason: "Legal creature target." }] },
  });

  assert.equal(visuals.byPermanentId["remote-bear"].valid, true);
  assert.equal(visuals.byPermanentId["remote-bear"].boardRole, "opponent");
  assert.equal(visuals.byPermanentId["local-wizard"].source, true);
  assert.equal(visuals.usesEngineLegalTargets, true);
});

test("saves preserve Advanced multiplayer perspective metadata and legacy saves default safely", () => {
  let profile = createDefaultProfile();
  profile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      advancedMultiplayer: {
        ...profile.activeSession.advancedMultiplayer,
        viewMode: "two-player-mirrored",
        localPerspectivePlayerId: "local-player",
        focusedOpponentId: "remote-player",
        compactOpponentPanelOpen: true,
      },
    },
  };
  profile = saveCurrentGame(profile, { saveId: "advanced-perspective-save", saveName: "Perspective Save" });
  const loaded = loadLocalSave(profile, "advanced-perspective-save");
  assert.equal(loaded.activeSession.advancedMultiplayer.viewMode, "two-player-mirrored");
  assert.equal(loaded.activeSession.advancedMultiplayer.focusedOpponentId, "remote-player");
  assert.equal(loaded.activeSession.advancedMultiplayer.localPerspectivePlayerId, "local-player");

  const legacy = loadLocalSave({
    ...profile,
    localSaves: {
      ...profile.localSaves,
      items: profile.localSaves.items.map((save) => ({
        ...save,
        advancedMultiplayer: undefined,
        gameState: {
          ...save.gameState,
          advancedMultiplayer: undefined,
          activeSession: {
            ...save.gameState.activeSession,
            advancedMultiplayer: undefined,
          },
        },
        metadata: {},
      })),
    },
  }, "advanced-perspective-save");
  assert.equal(legacy.activeSession.advancedMultiplayer.viewMode, "solo-advanced");
  assert.equal(legacy.activeSession.advancedMultiplayer.localPerspectivePlayerId, "local-player");
});

test("opponent board perspectives expose public permanents without private zone leakage", () => {
  const profile = createProfileWithPlayers([
    { id: "local-player", name: "Local", permanents: [], activeInterface: "boardstate-advanced" },
    {
      id: "remote-player",
      name: "Remote",
      activeInterface: "boardstate-advanced",
      permanents: [createPermanent({ id: "remote-angel", name: "Angel", typeLine: "Creature", controller: "remote-player", owner: "remote-player" })],
    },
  ]);
  profile.activeSession.zones.hand = [{ id: "secret", name: "Hidden Spell" }];
  const perspective = buildAdvancedMultiplayerPerspective(profile, { localPlayerId: "local-player" });
  const exportedOpponent = JSON.stringify(perspective.primaryOpponentBoard);

  assert.equal(perspective.primaryOpponentBoard.permanents[0].publicOnly, true);
  assert.equal(exportedOpponent.includes("Hidden Spell"), false);
  assert.equal(Object.hasOwn(perspective.primaryOpponentBoard, "hand"), false);
});

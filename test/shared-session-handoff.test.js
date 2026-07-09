import test from "node:test";
import assert from "node:assert/strict";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile, createGameSession } from "../src/state/schema.js";
import { loadLocalSave, saveCurrentGame } from "../src/storage/saveState.js";
import {
  boardStateProfileToSharedSession,
  canonicalSyncMessageToLegacyPayload,
  createSharedGameSession,
  legacySyncMessageToCanonicalSyncMessage,
  validateSharedGameSession,
} from "../src/shared-contracts/index.js";
import {
  INTERFACE_MODE_CHANGED_EVENT,
  createSharedSessionExport,
  ensureInterfaceModeState,
  parseLinkedSessionSnapshot,
  recordInterfaceModeChange,
} from "../src/shared-session/handoff.js";
import { getLinkedAppStatusCards } from "../src/ui/render.js";

test("interface mode defaults to BoardState Advanced Mode and persists on canonical sessions", () => {
  const session = ensureInterfaceModeState(createGameSession());
  assert.equal(session.localInterfaceMode, "boardstate-advanced");
  assert.equal(session.activeInterfaceByPlayer["local-player"], "boardstate-advanced");
  assert.equal(session.sessionCapabilities.supportsAdvancedMode, true);
  assert.equal(session.sessionCapabilities.supportsSimpleMode, false);

  const canonical = createSharedGameSession({
    gameId: "game-hand-off",
    sessionId: "session-hand-off",
    players: [{ playerId: "local-player", displayName: "Player", activeInterface: "boardstate-advanced" }],
    activeInterfaceByPlayer: session.activeInterfaceByPlayer,
  });
  assert.equal(validateSharedGameSession(canonical).valid, true);
});

test("INTERFACE_MODE_CHANGED event metadata is recorded without changing rules mode", () => {
  const session = ensureInterfaceModeState({ ...createGameSession(), enforcementMode: "waived" });
  const switched = recordInterfaceModeChange(session, {
    playerId: "local-player",
    nextInterface: "boardstate-advanced",
    reason: "test",
    sourceApp: "boardstate",
  });
  assert.equal(switched.enforcementMode, "waived");
  assert.equal(switched.interfaceModeHistory.length, 1);
  assert.equal(switched.interfaceModeHistory[0].nextInterface, "boardstate-advanced");
  assert.equal(Boolean(switched.historyMetadata.lastInterfaceEventId), true);
  assert.equal(INTERFACE_MODE_CHANGED_EVENT, "INTERFACE_MODE_CHANGED");
});

test("advanced session export/import round trips core state and enforcement metadata", () => {
  let profile = reduceProfile(createDefaultProfile(), { type: "START_ADVANCED_GAMEPLAY" });
  profile = reduceProfile(profile, { type: "SET_ENFORCEMENT_MODE", mode: "waived" });
  const exported = createSharedSessionExport(profile);
  assert.equal(exported.valid, true);
  const parsed = parseLinkedSessionSnapshot(exported.text);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.session.enforcementMode, "waived");
  assert.equal(parsed.session.activeRuleWaivers.length, 1);
  assert.equal(parsed.session.localInterfaceMode, "boardstate-advanced");

  profile = reduceProfile(profile, { type: "IMPORT_LINKED_SESSION", text: exported.text });
  assert.equal(profile.linkedSessions.items.length, 1);
  const sessionId = profile.linkedSessions.items[0].sessionId;
  profile = reduceProfile(profile, { type: "CONTINUE_LINKED_SESSION", sessionId });
  assert.equal(profile.activeSession.sessionId, sessionId);
  assert.equal(profile.activeSession.localInterfaceMode, "boardstate-advanced");
  assert.equal(profile.activeSession.enforcementMode, "waived");
  assert.equal(profile.activeSession.activeRuleWaivers.length, 1);
});

test("invalid linked-session import fails safely without overwriting active state", () => {
  const profile = createDefaultProfile();
  const activeSessionId = profile.activeSession.sessionId;
  const next = reduceProfile(profile, {
    type: "IMPORT_LINKED_SESSION",
    text: JSON.stringify({ session: { sessionId: "missing-game", players: [] } }),
  });
  assert.equal(next.activeSession.sessionId, activeSessionId);
  assert.equal(next.linkedSessions.items.length, 0);
  assert.match(next.linkedSessions.lastError, /missing gameId|at least one player/i);
});

test("legacy saves default to Advanced Mode interface metadata on load", () => {
  let profile = createDefaultProfile();
  const legacySession = {
    ...createGameSession(),
    activeInterfaceByPlayer: undefined,
    localInterfaceMode: undefined,
    interfaceMode: undefined,
  };
  profile = saveCurrentGame({ ...profile, activeSession: legacySession }, { saveId: "legacy-save", saveName: "Legacy" });
  const stripped = {
    ...profile,
    localSaves: {
      ...profile.localSaves,
      items: profile.localSaves.items.map((save) => ({
        ...save,
        metadata: {},
        gameState: {
          ...save.gameState,
          activeSession: {
            ...save.gameState.activeSession,
            activeInterfaceByPlayer: undefined,
            localInterfaceMode: undefined,
            interfaceMode: undefined,
          },
        },
      })),
    },
  };
  const loaded = loadLocalSave(stripped, "legacy-save");
  assert.equal(loaded.activeSession.localInterfaceMode, "boardstate-advanced");
  assert.equal(loaded.activeSession.activeInterfaceByPlayer["local-player"], "boardstate-advanced");
});

test("sync adapters preserve interface and rules metadata without namespace crossover", () => {
  const canonical = legacySyncMessageToCanonicalSyncMessage({
    namespace: "gameplay",
    messageType: "session-metadata",
    sessionId: "session-sync",
    gameId: "game-sync",
    senderAppInstanceId: "app-1",
    activeInterfaceByPlayer: { "local-player": "boardstate-advanced" },
    sourceApp: "boardstate",
    capabilities: { supportsAdvancedMode: true, supportsMirroredAdvancedView: false },
    sessionRevision: 4,
    enforcementMode: "waived",
    rulesEngineVersion: "rules-test",
    schemaVersion: "1.0.0",
  });
  assert.equal(canonical.namespace, "gameplay");
  assert.equal(canonical.payload.activeInterfaceByPlayer["local-player"], "boardstate-advanced");
  const legacy = canonicalSyncMessageToLegacyPayload(canonical);
  assert.equal(legacy.namespace, "gameplay");
  assert.equal(legacy.enforcementMode, "waived");
  assert.equal(legacy.capabilities.supportsMirroredAdvancedView, false);
});

test("linked app cards never claim live Lite linking before an imported/active session exists", () => {
  const cards = getLinkedAppStatusCards(createDefaultProfile());
  const lite = cards.find((entry) => entry.appId === "boardstate-lite");
  assert.equal(lite.status, "Handoff Import/Export Supported");
  assert.match(lite.detail, /live Lite linking is not installed/i);
  assert.equal(lite.capabilities.includes("waiting-for-lite-update"), true);
});

test("simple-shaped canonical snapshots preserve known state and warn about unknowns", () => {
  const simple = createSharedGameSession({
    gameId: "game-simple",
    sessionId: "session-simple",
    sourceApp: "boardstate-lite",
    players: [
      { playerId: "local-player", displayName: "Player", life: 31, activeInterface: "boardstate-lite" },
      { playerId: "opponent", displayName: "Opponent", life: 24, activeInterface: "unknown" },
    ],
    activeInterfaceByPlayer: { "local-player": "boardstate-lite", opponent: "unknown" },
    turnState: { turnNumber: 3, activePlayerId: "local-player", currentPhase: "combat" },
    battlefieldState: { permanentsById: {}, battlefieldOrderByPlayer: {} },
    zoneState: { zonesByPlayer: {} },
  });
  const parsed = parseLinkedSessionSnapshot({ sourceApp: "boardstate-lite", session: simple });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.session.turnState.turnNumber, 3);
  assert.equal(parsed.session.activeInterfaceByPlayer["local-player"], "boardstate-lite");
  assert.equal(parsed.warnings.some((warning) => /private hand\/library/i.test(warning)), true);
});

test("current BoardState profile can produce canonical active interface metadata", () => {
  const profile = reduceProfile(createDefaultProfile(), { type: "START_ADVANCED_GAMEPLAY" });
  const canonical = boardStateProfileToSharedSession(profile);
  assert.equal(canonical.activeInterfaceByPlayer["local-player"], "boardstate-advanced");
  assert.equal(canonical.sessionCapabilities.supportsHandoffExport, true);
});

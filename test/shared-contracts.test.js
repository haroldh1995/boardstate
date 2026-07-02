import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getRulesEngineVersion, resolveBoardStateAction } from "../src/rules-engine/index.js";
import {
  ACTION_TYPES,
  DEFAULT_RULES_ENGINE_VERSION,
  EVENT_TYPES,
  ID_TYPES,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SYNC_NAMESPACES,
  boardStateProfileToSharedSession,
  canonicalSaveEnvelopeToLegacySave,
  canonicalSyncMessageToLegacyPayload,
  compareContractVersions,
  createCanonicalAction,
  createCanonicalEvent,
  createCanonicalSaveEnvelope,
  createCanonicalSyncMessage,
  createCardInstance,
  createDeckSnapshot,
  createEcosystemBundle,
  getContractSchemaInventory,
  getSharedVersionInfo,
  legacySaveToCanonicalSaveEnvelope,
  legacySyncMessageToCanonicalSyncMessage,
  sharedSessionToBoardStateRuntime,
  validateAction,
  validateCardInstance,
  validateDeckSnapshot,
  validateEcosystemBundle,
  validateEvent,
  validateNoPrivateExportTokens,
  validateSaveEnvelope,
  validateSharedGameSession,
  validateSyncMessage,
} from "../src/shared-contracts/index.js";
import { buildLocalSave, exportLocalSave, importLocalSave, validateLocalSave } from "../src/storage/saveState.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";

test("shared contracts expose independent version constants and schema inventory", () => {
  const versions = getSharedVersionInfo();
  assert.equal(versions.schemaVersion, SHARED_CONTRACT_SCHEMA_VERSION);
  assert.equal(versions.saveFormatVersion, SHARED_SAVE_FORMAT_VERSION);
  assert.equal(versions.rulesEngineVersion, DEFAULT_RULES_ENGINE_VERSION);
  assert.equal(DEFAULT_RULES_ENGINE_VERSION, getRulesEngineVersion());
  assert.equal(compareContractVersions("boardstate-shared-contracts-0.1.0", "boardstate-shared-contracts-0.1.0"), 0);

  const inventory = getContractSchemaInventory();
  for (const idType of ["profileId", "playerId", "cardInstanceId", "permanentId", "eventId", "saveId"]) {
    assert.equal(ID_TYPES.includes(idType), true);
    assert.equal(inventory.idTypes.includes(idType), true);
  }
  for (const actionType of ["CAST_SPELL", "PLAY_LAND", "APPLY_RULE_WAIVER", "LOAD_GAME"]) {
    assert.equal(ACTION_TYPES.includes(actionType), true);
    assert.equal(inventory.actionTypes.includes(actionType), true);
  }
  for (const eventType of ["SPELL_CAST", "RULE_WAIVED", "SAVE_LOADED"]) {
    assert.equal(EVENT_TYPES.includes(eventType), true);
    assert.equal(inventory.eventTypes.includes(eventType), true);
  }
  for (const namespace of ["gameplay", "tournament", "friend", "deck", "app-link"]) {
    assert.equal(SYNC_NAMESPACES.includes(namespace), true);
    assert.equal(inventory.syncNamespaces.includes(namespace), true);
  }
});

test("shared contracts have no UI, DOM, storage, or network dependency", () => {
  const files = collectFiles("src/shared-contracts").filter((file) => file.endsWith(".js"));
  const forbidden = [
    "../ui",
    "render.js",
    ".css",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "WebSocket",
    "BroadcastChannel",
    "document.",
    "window.",
    "navigator.",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(source.includes(pattern), false, `${file} must not include ${pattern}`);
    }
  }
});

test("legacy BoardState session converts to canonical shared session without exposing hidden zones", () => {
  const profile = createDefaultProfile();
  profile.activeSession.zones.hand = [{ id: "secret-hand-card", name: "Hidden Card" }];
  profile.activeSession.zones.library = [{ id: "secret-library-card", name: "Hidden Library Card" }];
  profile.activeSession.battlefield.player = [
    createPermanent({
      id: "forest",
      name: "Forest",
      typeLine: "Basic Land - Forest",
      controller: "player",
    }),
    createPermanent({
      id: "bear",
      name: "Runeclaw Bear",
      typeLine: "Creature - Bear",
      controller: "player",
      power: 2,
      toughness: 2,
    }),
  ];

  const shared = boardStateProfileToSharedSession(profile);
  assert.equal(validateSharedGameSession(shared).valid, true);
  assert.equal(shared.schemaVersion, SHARED_CONTRACT_SCHEMA_VERSION);
  assert.equal(shared.rulesEngineVersion, DEFAULT_RULES_ENGINE_VERSION);
  assert.equal(shared.players[0].commanderDamage && typeof shared.players[0].commanderDamage, "object");
  assert.equal(shared.zoneState.zonesByPlayer["local-player"].hand.visibility, "private");
  assert.equal(shared.zoneState.zonesByPlayer["local-player"].hand.count, 1);
  assert.deepEqual(shared.zoneState.zonesByPlayer["local-player"].hand.cardInstanceIds, []);
  assert.equal(shared.battlefieldState.landPermanentIds.includes("forest"), true);
  assert.equal(shared.battlefieldState.creaturePermanentIds.includes("bear"), true);

  const runtime = sharedSessionToBoardStateRuntime(shared, profile.activeSession);
  assert.equal(runtime.turn, profile.activeSession.turn);
  assert.equal(runtime.life, profile.activeSession.life);
  assert.equal(runtime.battlefield.player.length, 2);
});

test("canonical card, deck, action, event, sync, save, and ecosystem bundle validation works", () => {
  const card = createCardInstance({
    id: "card-1",
    ownerPlayerId: "local-player",
    controllerPlayerId: "local-player",
    oracleId: "oracle-1",
    printingId: "printing-1",
    currentZone: "hand",
    visibility: "private",
  });
  assert.equal(validateCardInstance(card).valid, true);

  const deck = createDeckSnapshot({
    deckSnapshotId: "deck-snapshot-1",
    sourceDeckId: "deck-1",
    name: "Test Deck",
    cards: [{ oracleId: "oracle-1", count: 1 }],
  });
  assert.equal(validateDeckSnapshot(deck).valid, true);

  const action = createCanonicalAction({
    actionType: "CAST_SPELL",
    gameId: "game-1",
    sessionId: "session-1",
    playerId: "local-player",
    payload: { cardInstanceId: "card-1" },
  });
  assert.equal(validateAction(action).valid, true);
  assert.equal(validateAction({ ...action, actionType: "NOT_REAL" }).valid, false);

  const event = createCanonicalEvent({
    eventType: "SPELL_CAST",
    gameId: "game-1",
    sessionId: "session-1",
    payload: { stackObjectId: "stack-1" },
  });
  assert.equal(validateEvent(event).valid, true);

  const sync = createCanonicalSyncMessage({
    namespace: "gameplay",
    messageType: "gameplay:action",
    sessionId: "session-1",
    senderAppInstanceId: "app-1",
    payload: { action },
  });
  assert.equal(validateSyncMessage(sync).valid, true);
  assert.equal(validateSyncMessage({ ...sync, namespace: "tournament", messageType: "gameplay:action" }).valid, false);
  assert.equal(validateSyncMessage({ ...sync, namespace: "bad-namespace" }).valid, false);

  const bundle = createEcosystemBundle({ sections: { gameSaves: [event] } });
  assert.equal(validateEcosystemBundle(bundle).valid, true);
});

test("canonical save envelopes preserve legacy save compatibility and reject malformed data safely", () => {
  const profile = createDefaultProfile();
  profile.activeSession.battlefield.player = [createPermanent({ id: "plains", name: "Plains", typeLine: "Basic Land - Plains" })];
  const legacySave = buildLocalSave(profile, { saveName: "Compatibility Save" });
  assert.equal(legacySave.schemaVersion, SHARED_CONTRACT_SCHEMA_VERSION);
  assert.equal(validateLocalSave(legacySave).valid, true);

  const envelope = legacySaveToCanonicalSaveEnvelope(legacySave);
  assert.equal(validateSaveEnvelope(envelope).valid, true);
  const restoredLegacy = canonicalSaveEnvelopeToLegacySave(envelope);
  assert.equal(validateLocalSave(restoredLegacy).valid, true);
  assert.equal(restoredLegacy.gameState.activeSession.battlefield.player.length, 1);

  const exported = JSON.parse(exportLocalSave(legacySave));
  assert.equal(exported.schemaVersion, SHARED_CONTRACT_SCHEMA_VERSION);
  assert.equal(validateSaveEnvelope(exported.canonicalEnvelope).valid, true);
  const importedProfile = importLocalSave(createDefaultProfile(), { canonicalEnvelope: exported.canonicalEnvelope });
  assert.equal(importedProfile.localSaves.items.length, 1);
  assert.equal(importedProfile.localSaves.lastError, "");

  assert.equal(validateSaveEnvelope({ ...envelope, saveFormatVersion: "future-save-format-9.0.0" }).unsupportedVersion, true);
  assert.equal(validateLocalSave({ saveId: "bad", saveVersion: 1, gameState: {} }).valid, false);
  assert.equal(validateNoPrivateExportTokens({ password: "nope" }).valid, false);
});

test("sync compatibility adapters preserve namespace separation and legacy payload shape", () => {
  const legacy = {
    type: "tournament-action",
    namespace: "tournament",
    messageType: "tournament:round-update",
    roomId: "tournament:ABC123",
    sessionId: "ABC123",
    peerId: "peer-1",
    action: { actionId: "action-1", actionType: "TOURNAMENT_START_ROUND" },
  };
  const canonical = legacySyncMessageToCanonicalSyncMessage(legacy);
  assert.equal(canonical.namespace, "tournament");
  assert.equal(validateSyncMessage(canonical).valid, true);
  const roundTrip = canonicalSyncMessageToLegacyPayload(canonical);
  assert.equal(roundTrip.namespace, "tournament");
  assert.equal(roundTrip.type, "tournament-action");
  assert.equal(roundTrip.action.actionId, "action-1");
});

test("rules engine adapter exposes canonical actions and canonical engine events", () => {
  const profile = createDefaultProfile();
  const requestResult = resolveBoardStateAction(profile, { type: "PASS_PRIORITY", playerId: "local-player" });
  assert.equal(Array.isArray(requestResult.canonicalEvents), true);
  assert.equal(requestResult.canonicalEvents[0].schemaVersion, SHARED_CONTRACT_SCHEMA_VERSION);
});

function collectFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

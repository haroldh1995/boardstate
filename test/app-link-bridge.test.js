import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeckSourceOptions,
  createBoardStateLiteHandoffBundle,
  getAppLinkAdapters,
  getImportedDataManagementModel,
  parseAppLinkHandoffFromLocation,
  validateBoardStateLiteSnapshot,
  validateDeckNexusSnapshotPayload,
} from "../src/bridge/appLinkAdapters.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile } from "../src/state/schema.js";
import { loadLocalSave, saveCurrentGame } from "../src/storage/saveState.js";
import { createSharedGameSession } from "../src/shared-contracts/index.js";
import { getLinkedAppStatusCards } from "../src/ui/render.js";

function sampleLiteSession() {
  return createSharedGameSession({
    gameId: "game-lite-bridge",
    sessionId: "session-lite-bridge",
    sourceApp: "boardstate-lite",
    status: "active",
    players: [
      { playerId: "local-player", displayName: "Lite Player", life: 33, activeInterface: "boardstate-lite" },
      { playerId: "opponent", displayName: "Opponent", life: 27, activeInterface: "unknown" },
    ],
    activeInterfaceByPlayer: { "local-player": "boardstate-lite", opponent: "unknown" },
    turnState: { turnNumber: 4, activePlayerId: "local-player", currentPhase: "combat", currentStep: "declare-attackers" },
    enforcementMode: "enforced",
    revision: 7,
  });
}

function sampleDeckSnapshotPayload(overrides = {}) {
  return {
    bundleType: "deck-nexus-deck-snapshot",
    sourceApp: "deck-nexus",
    deckSnapshot: {
      deckSnapshotId: "snapshot-nexus-v1",
      sourceApp: "deck-nexus",
      sourceDeckId: "nexus-deck-1",
      sourceDeckVersion: "v1",
      deckName: "Nexus Test Deck",
      format: "commander",
      commanderIds: ["oracle-commander"],
      cardDataVersion: "scryfall-test",
      exportedAt: Date.now(),
      cards: [
        {
          oracleId: "oracle-commander",
          printingId: "print-commander",
          name: "Nexus Commander",
          quantity: 1,
          commander: true,
          typeLine: "Legendary Creature",
          oracleText: "Flying",
        },
        {
          oracleId: "oracle-island",
          printingId: "print-island",
          name: "Island",
          quantity: 99,
          typeLine: "Basic Land - Island",
          oracleText: "Tap: Add U.",
        },
      ],
      ...overrides,
    },
  };
}

test("app-link adapters report honest BoardState-side capabilities", () => {
  const profile = createDefaultProfile();
  const adapters = getAppLinkAdapters(profile);
  const lite = adapters["boardstate-lite"].getCapabilities();
  const nexus = adapters["deck-nexus"].getCapabilities();
  const hub = adapters["boardstate-hub"].getCapabilities();

  assert.equal(lite.supportsSharedSessions, true);
  assert.equal(lite.supportsLiveSync, false);
  assert.equal(lite.supportsSimpleMode, false);
  assert.equal(lite.status, "Handoff Import/Export Supported");
  assert.equal(nexus.supportsDeckSnapshots, true);
  assert.equal(nexus.supportsLiveSync, false);
  assert.equal(nexus.status, "Snapshot Import Supported");
  assert.equal(hub.supportsHubCoordination, true);
  assert.equal(hub.supportsLiveSync, false);
  assert.equal(hub.supportsRulesEngine, false);
  assert.equal(hub.status, "Hub Not Connected");

  const cards = getLinkedAppStatusCards(profile);
  assert.equal(cards.find((entry) => entry.appId === "boardstate-lite").status.includes("Linked"), false);
  assert.equal(cards.find((entry) => entry.appId === "deck-nexus").status.includes("Linked"), false);
  assert.equal(cards.find((entry) => entry.appId === "boardstate-hub").status, "Hub Not Connected");
});

test("Hub adapter exports only privacy-safe ecosystem bundles and contexts", () => {
  const profile = {
    ...createDefaultProfile(),
    localAuth: { privateToken: "unsafe-should-not-export" },
    activeSession: {
      ...createDefaultProfile().activeSession,
      zones: {
        hand: [{ name: "Hidden Card" }],
        library: [{ name: "Hidden Library Card" }],
      },
    },
  };
  const hub = getAppLinkAdapters(profile)["boardstate-hub"];
  const exported = hub.exportPayload(profile);
  assert.equal(exported.valid, true);
  assert.equal(exported.bundle.sections.hub.data.appStatus.status, "Hub Not Connected");
  assert.equal(exported.bundle.sections.metadata.data.hiddenGameplayDataIncluded, false);
  assert.equal(JSON.stringify(exported.bundle).includes("unsafe-should-not-export"), false);
  assert.equal(JSON.stringify(exported.bundle).includes("Hidden Card"), false);

  const launch = hub.createLaunchContext(profile);
  assert.equal(launch.validation.valid, true);
  assert.equal(launch.context.sourceApplication, "boardstate-hub");

  const returned = hub.createReturnContext(profile);
  assert.equal(returned.destinationApplication, "boardstate-hub");
  assert.equal(returned.safeSummary.hiddenGameplayDataIncluded, false);
});

test("BoardState Lite snapshots validate, import, and export as future handoff bundles", () => {
  let profile = createDefaultProfile();
  const liteBundle = {
    bundleType: "boardstate-lite-session-handoff",
    sourceApp: "boardstate-lite",
    sourceVersion: "lite-test",
    session: sampleLiteSession(),
  };
  const validation = validateBoardStateLiteSnapshot(liteBundle);
  assert.equal(validation.valid, true);
  assert.equal(validation.sourceApp, "boardstate-lite");
  assert.ok(validation.missingFields.includes("deck snapshot reference"));

  profile = reduceProfile(profile, { type: "IMPORT_LITE_SESSION_SNAPSHOT", payload: liteBundle });
  const imported = getImportedDataManagementModel(profile).liteSessions;
  assert.equal(imported.length, 1);
  assert.equal(imported[0].sourceApp, "boardstate-lite");

  const exported = createBoardStateLiteHandoffBundle(profile);
  assert.equal(exported.valid, true);
  assert.equal(exported.bundle.targetApp, "boardstate-lite");
  assert.equal(exported.bundle.sourceApp, "boardstate");
  assert.match(exported.bundle.compatibilityNotes.join(" "), /future BoardState Lite handoff/i);
});

test("Deck Nexus snapshots validate, import, and become immutable gameplay deck sources", () => {
  let profile = createDefaultProfile();
  const payload = sampleDeckSnapshotPayload();
  const validation = validateDeckNexusSnapshotPayload(payload);
  assert.equal(validation.valid, true);
  assert.equal(validation.deckSnapshot.name, "Nexus Test Deck");

  profile = reduceProfile(profile, { type: "IMPORT_DECK_NEXUS_SNAPSHOT", payload });
  const imported = getImportedDataManagementModel(profile).deckSnapshots;
  assert.equal(imported.length, 1);
  assert.equal(imported[0].deckSnapshotId, "snapshot-nexus-v1");

  const sources = buildDeckSourceOptions(profile);
  assert.equal(sources.some((entry) => entry.type === "imported-deck-snapshot" && entry.deckSnapshotId === "snapshot-nexus-v1"), true);

  const dryRun = reduceProfile(profile, {
    type: "START_SIMULATION",
    selectedOpponents: ["alpha"],
    deckSnapshotId: "snapshot-nexus-v1",
  });
  assert.equal(dryRun.activeSession.simulation.playerDeckSnapshot.deckSnapshotId, "snapshot-nexus-v1");
  assert.equal(dryRun.activeSession.deckSnapshotReferences[0].usage, "dry-run-player-deck");

  const advanced = reduceProfile(profile, {
    type: "USE_DECK_SNAPSHOT_ADVANCED",
    deckSnapshotId: "snapshot-nexus-v1",
  });
  assert.equal(advanced.activeSession.deckSnapshotReferences[0].deckSnapshotId, "snapshot-nexus-v1");
  assert.equal(advanced.activeSession.saveMetadata.deckSource, "imported-deck-snapshot");
});

test("bridge parsing rejects unsafe payloads and oversized deep-link references safely", () => {
  const unsafe = validateDeckNexusSnapshotPayload({
    ...sampleDeckSnapshotPayload(),
    privateToken: "unsafe-secret",
  });
  assert.equal(unsafe.valid, false);
  assert.equal(unsafe.status, "unsafe-private-data");

  const parsed = parseAppLinkHandoffFromLocation({ hash: "#/import/deck/snapshot-nexus-v1", search: "" });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.type, "deck");
  assert.equal(parsed.requiresConfirmation, true);

  const huge = parseAppLinkHandoffFromLocation({ hash: `#/import/session/${"x".repeat(9000)}`, search: "" });
  assert.equal(huge.valid, false);
  assert.equal(huge.status, "unsafe");

  const malformed = parseAppLinkHandoffFromLocation({ hash: "#/import/session/%E0%A4%A", search: "" });
  assert.equal(malformed.valid, false);
  assert.equal(malformed.status, "corrupted");
});

test("saves embed imported Deck Nexus data so gameplay reloads without live Nexus availability", () => {
  let profile = reduceProfile(createDefaultProfile(), {
    type: "IMPORT_DECK_NEXUS_SNAPSHOT",
    payload: sampleDeckSnapshotPayload(),
  });
  profile = reduceProfile(profile, {
    type: "USE_DECK_SNAPSHOT_ADVANCED",
    deckSnapshotId: "snapshot-nexus-v1",
  });
  profile = saveCurrentGame(profile, { saveId: "save-with-nexus-snapshot", saveName: "Imported Snapshot Game" });
  const stripped = { ...profile, importedData: { ...profile.importedData, deckSnapshots: [] } };
  const loaded = loadLocalSave(stripped, "save-with-nexus-snapshot");

  assert.equal(loaded.localSaves.lastError, "");
  assert.equal(loaded.importedData.deckSnapshots.some((entry) => entry.deckSnapshotId === "snapshot-nexus-v1"), true);
  assert.equal(loaded.activeSession.deckSnapshotReferences[0].deckSnapshotId, "snapshot-nexus-v1");
});

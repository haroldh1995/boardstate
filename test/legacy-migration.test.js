import test from "node:test";
import assert from "node:assert/strict";
import {
  FUTURE_OWNER_APPS,
  MIGRATION_READINESS,
  buildLegacyDataBrowserModel,
  buildLegacyDataInventory,
  buildRecoveryReport,
  createDestinationExportBundle,
  createFullLegacyBackupBundle,
  extractProfileFromLegacyBackup,
  validateLegacyBackupBundle,
  validateMigrationExportBundle,
} from "../src/migration/legacyMigration.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile } from "../src/state/schema.js";
import { saveCurrentGame } from "../src/storage/saveState.js";
import { getLegacyInventory } from "../src/ui/render.js";

function createLegacyProfileFixture() {
  let profile = createDefaultProfile();
  profile = {
    ...profile,
    localAuth: { mode: "protected", locked: false, hasPassword: true },
    password: "plain-text-should-not-export",
    authToken: "unsafe-auth-token",
    commanders: {
      deck_a: {
        name: "Legacy Commander Deck",
        commander: { name: "Alesha", typeLine: "Legendary Creature" },
        cards: [{ name: "Mountain", quantity: 35 }, { name: "Sol Ring", quantity: 1 }],
        tags: ["aggro"],
        notes: "Legacy deck notes",
      },
    },
    archives: [{ id: "archive-1", name: "Archived Card", updatedAt: 123 }],
    cardTags: { "Sol Ring": ["favorite"] },
    scannerData: { imports: [{ name: "Scanned Card" }] },
    friends: {
      ...profile.friends,
      myFriendCode: "ABC123",
      friends: [{ friendId: "friend-1", friendCode: "XYZ789", displayName: "Friend" }],
    },
    tournament: {
      ...profile.tournament,
      status: "active",
      active: true,
      name: "Legacy Tournament",
      players: [{ playerId: "participant-1", displayName: "Pod Player" }],
    },
    notifications: {
      ...(profile.notifications || {}),
      items: [{ id: "notification-1", title: "Legacy notification" }],
    },
    extraLegacyBlock: { value: "unknown" },
  };
  profile.activeSession = {
    ...profile.activeSession,
    life: 27,
    commander: { ...(profile.activeSession.commander || {}), damageByOpponent: { opponent: 5 } },
    playerCounters: { poison: 2, energy: 3 },
    recoveryLog: [{ id: "recovery-1", message: "Needs review", timestamp: 456 }],
  };
  return saveCurrentGame(profile, { saveId: "legacy-save-advanced", saveName: "Legacy Advanced Save" });
}

test("legacy inventory detects categories and maps future owners without mutation", () => {
  const profile = createLegacyProfileFixture();
  const originalDecks = profile.commanders;
  const inventory = buildLegacyDataInventory(profile, { scannedAt: 1000 });
  const byId = Object.fromEntries(inventory.categories.map((entry) => [entry.categoryId, entry]));

  assert.equal(byId["legacy-decks"].itemCount, 1);
  assert.equal(byId["legacy-decks"].futureOwnerApp, FUTURE_OWNER_APPS.DECK_NEXUS);
  assert.equal(byId["legacy-decks"].migrationReadiness, MIGRATION_READINESS.READY);
  assert.equal(byId["legacy-dry-run-saves"].futureOwnerApp, FUTURE_OWNER_APPS.BOARDSTATE);
  assert.equal(byId["legacy-local-protected-profiles"].migrationReadiness, MIGRATION_READINESS.PROTECTED);
  assert.equal(byId["unknown-legacy-keys-data-blocks"].detected, true);
  assert.equal(profile.commanders, originalDecks);
});

test("empty inventory handling remains safe and non-destructive", () => {
  const profile = createDefaultProfile();
  const inventory = buildLegacyDataInventory(profile);

  assert.ok(inventory.categories.length >= 24);
  assert.equal(inventory.categories.every((entry) => entry.destructiveActionsAllowed === false), true);
  assert.ok(inventory.overview.totalItems >= 0);
});

test("full backup creation validates and excludes unsafe private fields without removing MTG token state", () => {
  const profile = createLegacyProfileFixture();
  profile.activeSession.battlefield.player.push({
    id: "token-permanent",
    name: "Soldier Token",
    typeLine: "Token Creature - Soldier",
    isToken: true,
    token: true,
  });
  const result = createFullLegacyBackupBundle(profile, { createdAt: 2000 });

  assert.equal(result.valid, true);
  assert.equal(validateLegacyBackupBundle(result.bundle).valid, true);
  assert.match(result.text, /Soldier Token/);
  assert.match(result.text, /"token": true/);
  assert.doesNotMatch(result.text, /plain-text-should-not-export/);
  assert.doesNotMatch(result.text, /unsafe-auth-token/);

  const restored = extractProfileFromLegacyBackup(result.text);
  assert.equal(restored.valid, true);
  assert.equal(restored.profile.localAuth.hasPassword, true);
});

test("destination export bundles validate and make no false migration claims", () => {
  const profile = createLegacyProfileFixture();
  const deck = createDestinationExportBundle(profile, "deck-nexus", { createdAt: 3000 });
  const lite = createDestinationExportBundle(profile, "boardstate-lite", { createdAt: 3000 });
  const boardstate = createDestinationExportBundle(profile, "boardstate", { createdAt: 3000 });
  const hub = createDestinationExportBundle(profile, "hub", { createdAt: 3000 });

  assert.equal(deck.valid, true);
  assert.equal(deck.bundle.targetApp, "deck-nexus");
  assert.equal(deck.bundle.itemCounts.legacyDecks, 1);
  assert.equal(lite.valid, true);
  assert.equal(lite.bundle.targetApp, "boardstate-lite");
  assert.equal(boardstate.valid, true);
  assert.equal(boardstate.bundle.destinationStatus, "Already BoardState-Owned");
  assert.equal(hub.valid, true);
  assert.equal(hub.bundle.destinationStatus, "Waiting for Hub App");
  assert.doesNotMatch(hub.text, /Hub linked|Hub imported|Hub synced|migration complete/i);
});

test("export validation rejects malformed or unsafe bundles safely", () => {
  const profile = createLegacyProfileFixture();
  const result = createDestinationExportBundle(profile, "deck-nexus");
  const malformed = { ...result.bundle, targetApp: "", itemCounts: null };
  const unsafe = { ...result.bundle, payload: { password: "nope" } };

  assert.equal(validateMigrationExportBundle(malformed).valid, false);
  assert.equal(validateMigrationExportBundle(unsafe).valid, false);
});

test("migration archive records and history persist through reducer actions", () => {
  let profile = createLegacyProfileFixture();
  profile = reduceProfile(profile, { type: "MIGRATION_REBUILD_INVENTORY" });
  assert.ok(profile.legacyMigration.archiveRecords.length > 0);
  assert.equal(profile.legacyMigration.archiveRecords.every((entry) => entry.destructiveCleanupEligible === false), true);
  assert.equal(profile.legacyMigration.history[0].eventType, "inventory scan");

  const exportResult = createDestinationExportBundle(profile, "deck-nexus");
  profile = reduceProfile(profile, { type: "MIGRATION_RECORD_EXPORT", exportResult });
  assert.equal(profile.legacyMigration.exports.length, 1);
  assert.equal(profile.commanders.deck_a.name, "Legacy Commander Deck");
});

test("legacy data browser displays safe metadata and keeps access paths", () => {
  const browser = buildLegacyDataBrowserModel(createLegacyProfileFixture());
  const protectedProfile = browser.categories.find((entry) => entry.categoryId === "legacy-local-protected-profiles");
  const decks = browser.categories.find((entry) => entry.categoryId === "legacy-decks");
  const renderInventory = getLegacyInventory(createLegacyProfileFixture());

  assert.equal(protectedProfile.protected, true);
  assert.equal(protectedProfile.sampleItems[0].name, "Protected data present");
  assert.equal(decks.openPage, "decks");
  assert.equal(renderInventory.some((entry) => entry.page === "decks"), true);
  assert.equal(renderInventory.some((entry) => entry.optionsCategory === "saves"), true);
});

test("recovery report validates saves, imports, archives, and keeps old saves loadable", () => {
  const profile = createLegacyProfileFixture();
  const report = buildRecoveryReport(profile, { createdAt: 4000 });

  assert.equal(report.valid, true);
  assert.equal(report.report.invalidSavesCount, 0);
  assert.equal(report.report.privacy.excludesPlaintextPasswords, true);
  assert.equal(profile.localSaves.items.some((entry) => entry.saveId === "legacy-save-advanced"), true);
});

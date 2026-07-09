import test from "node:test";
import assert from "node:assert/strict";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile, createGameSession } from "../src/state/schema.js";
import { saveCurrentGame } from "../src/storage/saveState.js";
import {
  getBoardStateHomeModel,
  getLegacyInventory,
  getLinkedAppStatusCards,
  getRulesControlSummary,
  getSaveGroups,
} from "../src/ui/render.js";

test("streamlined home model prioritizes BoardState gameplay engine actions", () => {
  const profile = createDefaultProfile();
  const model = getBoardStateHomeModel(profile);
  assert.equal(model.rules.label, "Rules Enforced");
  assert.equal(model.currentSession.modeLabel, "Training Ground");
  assert.ok(model.versions.schemaVersion);
  assert.equal(model.linkedApps.some((entry) => entry.appId === "boardstate-lite"), true);
  assert.equal(model.legacy.some((entry) => entry.id === "legacy-tournaments"), true);
});

test("rules control toggles waiver state without deleting waiver history", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, { type: "SET_ENFORCEMENT_MODE", mode: "waived" });
  assert.equal(getRulesControlSummary(profile).mode, "waived");
  assert.equal(profile.activeSession.activeRuleWaivers.length, 1);
  profile = reduceProfile(profile, { type: "REVOKE_RULE_WAIVERS" });
  assert.equal(getRulesControlSummary(profile).mode, "enforced");
  assert.equal(profile.activeSession.activeRuleWaivers.length, 0);
  assert.ok(profile.activeSession.waiverHistory.length >= 2);
});

test("advanced gameplay starts a canonical BoardState advanced session", () => {
  const profile = reduceProfile(createDefaultProfile(), { type: "START_ADVANCED_GAMEPLAY" });
  assert.equal(profile.activeSession.gameTracking.active, true);
  assert.equal(profile.activeSession.gameTracking.mode, "advanced-gameplay");
  assert.equal(profile.activeSession.interfaceMode, "boardstate-advanced");
  assert.equal(profile.activeSession.saveMetadata.mode, "advanced-gameplay");
  assert.ok(profile.activeSession.gameId);
  assert.ok(profile.activeSession.sessionId);
  assert.ok(profile.activeSession.rulesEngineVersion);
});

test("save grouping separates dry runs, tutorials, imported sessions, legacy, and advanced games", () => {
  let profile = createDefaultProfile();
  profile = saveCurrentGame({
    ...profile,
    activeSession: {
      ...createGameSession(),
      gameTracking: { ...createGameSession().gameTracking, active: true, mode: "advanced-gameplay" },
    },
  }, { saveName: "Advanced", saveId: "advanced-save" });
  profile = saveCurrentGame({
    ...profile,
    activeSession: {
      ...createGameSession(),
      simulation: { ...createGameSession().simulation, enabled: true, status: "paused" },
    },
  }, { saveName: "Dry Run", saveId: "dry-run-save" });
  profile = saveCurrentGame({
    ...profile,
    activeSession: {
      ...createGameSession(),
      tutorial: { ...createGameSession().tutorial, active: true, status: "active" },
    },
  }, { saveName: "Tutorial", saveId: "tutorial-save" });
  profile = {
    ...profile,
    localSaves: {
      ...profile.localSaves,
      items: [
        ...profile.localSaves.items,
        {
          ...profile.localSaves.items[0],
          saveId: "imported-save",
          saveName: "Lite Import",
          sourceApp: "boardstate-lite",
          gameMode: "imported-session",
        },
        {
          ...profile.localSaves.items[0],
          saveId: "legacy-save",
          saveName: "Legacy",
          gameMode: "legacy",
          metadata: { ...(profile.localSaves.items[0]?.metadata || {}), migrationStatus: "legacy" },
        },
      ],
    },
  };
  const groups = getSaveGroups(profile);
  assert.equal(groups.advanced.length >= 1, true);
  assert.equal(groups.dryRun.length >= 1, true);
  assert.equal(groups.tutorial.length >= 1, true);
  assert.equal(groups.imported.length, 1);
  assert.equal(groups.legacy.length, 1);
});

test("linked app and legacy status remain honest placeholders until integrations exist", () => {
  const profile = createDefaultProfile();
  const linked = getLinkedAppStatusCards(profile);
  assert.equal(linked.find((entry) => entry.appId === "boardstate-lite").status, "Handoff Import/Export Supported");
  assert.match(linked.find((entry) => entry.appId === "deck-nexus").detail, /Waiting for Nexus update/i);
  const legacy = getLegacyInventory(profile);
  assert.equal(legacy.some((entry) => entry.destination === "Deck Nexus"), true);
  assert.equal(legacy.some((entry) => entry.destination === "Future Hub"), true);
});

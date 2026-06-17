import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { buildBugReport, buildDebugState, buildGameLog, collectRulesConfidence, RULES_CONFIDENCE, safeJson } from "../src/support/debugExport.js";
import { buildTournamentInviteLink, parseTournamentInviteFromLocation } from "../src/ui/render.js";

test("error recovery entries can be added and dismissed without crashing session state", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, {
    type: "ADD_RECOVERY_ENTRY",
    entry: {
      source: "Scryfall Search",
      message: "Scryfall unavailable.",
      technicalMessage: "network timeout",
      severity: "warning",
      suggestedAction: "Retry search.",
    },
  });

  assert.equal(profile.activeSession.recoveryLog.length, 1);
  assert.equal(profile.activeSession.recoveryLog[0].source, "Scryfall Search");

  profile = reduceProfile(profile, {
    type: "DISMISS_RECOVERY_ENTRY",
    id: profile.activeSession.recoveryLog[0].id,
  });

  assert.equal(profile.activeSession.recoveryLog[0].dismissed, true);
});

test("manual effect updates record rules confidence status", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, { type: "LOAD_TUTORIAL_SAMPLE_BOARD" });

  const pending = profile.activeSession.pendingEffects[0];
  assert.equal(pending.rulesConfidence, RULES_CONFIDENCE.MANUAL_CHOICE);

  profile = reduceProfile(profile, { type: "MARK_PENDING_EFFECT", id: pending.id, status: "ignored" });

  const ignored = profile.activeSession.pendingEffects.find((entry) => entry.id === pending.id);
  assert.equal(ignored.status, "ignored");
  assert.equal(ignored.rulesConfidence, RULES_CONFIDENCE.IGNORED);
  assert.ok(collectRulesConfidence(profile).some((entry) => entry.rulesConfidence === RULES_CONFIDENCE.IGNORED));
});

test("debug exports include useful state and redact sensitive fields", () => {
  const profile = reduceProfile(createDefaultProfile(), { type: "LOAD_TUTORIAL_SAMPLE_BOARD" });
  const gameLog = buildGameLog(profile);
  const debugState = buildDebugState(profile, "battlefield");
  const bugReport = buildBugReport(profile, "battlefield");
  const serialized = safeJson({
    password: "should-not-leak",
    token: "also-secret",
    hasPassword: true,
    bugReport,
  });

  assert.equal(gameLog.battlefieldSummary.player.length, 4);
  assert.equal(debugState.currentPage, "battlefield");
  assert.equal(bugReport.reportType, "BoardState bug report");
  assert.match(serialized, /\[redacted\]/);
  assert.doesNotMatch(serialized, /should-not-leak|also-secret/);
  assert.match(serialized, /"hasPassword": true/);
});

test("data management actions are scoped safely", () => {
  let profile = reduceProfile(createDefaultProfile(), { type: "LOAD_TUTORIAL_SAMPLE_BOARD" });
  profile = reduceProfile(profile, { type: "ADD_RECOVERY_ENTRY", source: "Test", message: "Recover me" });
  assert.ok(profile.activeSession.effectLog.length);

  profile = reduceProfile(profile, { type: "CLEAR_GAME_HISTORY" });
  assert.equal(profile.activeSession.actionHistory.length, 0);
  assert.equal(profile.activeSession.recoveryLog.length, 0);

  profile = reduceProfile(profile, { type: "CLEAR_SIMULATION_LEARNING" });
  assert.equal(profile.simulationMemory.updatedAt, 0);
});

test("tournament invite links are hash-route safe and parse query fallbacks", () => {
  const link = buildTournamentInviteLink("abc123", { origin: "https://example.test", pathname: "/boardstate/" });
  assert.equal(link, "https://example.test/boardstate/#tournament/join/ABC123");
  assert.deepEqual(parseTournamentInviteFromLocation({ hash: "#tournament/join/ABC123", search: "" }), {
    joinCode: "ABC123",
    source: "invite-link",
  });
  assert.deepEqual(parseTournamentInviteFromLocation({ hash: "#life", search: "?joinTournament=xyz789" }), {
    joinCode: "XYZ789",
    source: "invite-link",
  });
  assert.equal(parseTournamentInviteFromLocation({ hash: "#battlefield", search: "" }), null);
});

test("tournament notifications persist locally and respect non-critical preferences", () => {
  let profile = reduceProfile(createDefaultProfile(), {
    type: "SET_SETTING",
    path: "notifications.tournamentEvents.tournamentStarted",
    value: false,
  });
  profile = reduceProfile(profile, {
    type: "TOURNAMENT_CREATE",
    name: "Friday Commander",
    hostName: "Host",
    syncMode: "wifi",
    wsUrl: "ws://192.168.1.10:8787",
  });
  assert.equal(profile.tournament.sync.namespace, "tournament");
  assert.equal(profile.tournament.sync.mode, "wifi");
  assert.equal(profile.notifications.items.some((entry) => entry.title === "Tournament Created"), false);

  profile = reduceProfile(profile, {
    type: "NOTIFICATION_ADD",
    category: "tournament",
    eventKey: "finalWinners",
    title: "Final Winners",
    body: "Top 3 ready.",
    critical: true,
  });
  assert.equal(profile.notifications.items.length, 1);
  profile = reduceProfile(profile, { type: "NOTIFICATION_ACK", id: profile.notifications.items[0].id });
  assert.equal(profile.notifications.items[0].acknowledged, true);
  assert.ok(profile.notifications.dismissedIds.includes(profile.notifications.items[0].id));
});

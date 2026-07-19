import test from "node:test";
import assert from "node:assert/strict";

import {
  BATTLEFIELD_CAMERA_MODES,
  COMMANDER_MODERNIZATION_FORMATS,
  COMMANDER_MODERNIZATION_INPUT_MODES,
  EXECUTION_CONFIDENCE_LEVELS,
  INFORMATION_CONFIDENCE_LEVELS,
  QUESTION_SYSTEM_TYPES,
  createModernizationCapabilityReport,
  isSafeRuleReferenceImportPayload,
  normalizeCommanderFormat,
  validateCommanderPlayerCount,
  validateRuleAmendmentApproval,
} from "../src/shared-contracts/commanderModernization.js";

test("commander modernization limits support Commander and Brawl player counts", () => {
  assert.equal(validateCommanderPlayerCount(2).valid, true);
  assert.equal(validateCommanderPlayerCount(10).valid, true);
  assert.equal(validateCommanderPlayerCount(1).valid, false);
  assert.equal(
    validateCommanderPlayerCount(1, { allowSinglePlayerTraining: true }).status,
    "valid-with-warnings"
  );
  assert.equal(validateCommanderPlayerCount(11).valid, false);
});

test("format foundation is Commander and Brawl exclusive", () => {
  assert.deepEqual(COMMANDER_MODERNIZATION_FORMATS, ["commander", "brawl"]);
  assert.equal(normalizeCommanderFormat("Brawl"), "brawl");
  assert.equal(normalizeCommanderFormat("modern"), "commander");
});

test("capability report does not claim future app live integration", () => {
  const report = createModernizationCapabilityReport();

  assert.equal(report.appId, "boardstate");
  assert.equal(report.rulesAuthorityOwner, "boardstate");
  assert.equal(report.hubConnectivity.liveConnection, false);
  assert.equal(report.hubConnectivity.status, "waiting-for-hub");
  assert.equal(report.liveExternalLinks.boardstateLite, false);
  assert.equal(report.liveExternalLinks.deckNexus, false);
  assert.equal(report.liveExternalLinks.boardstateHub, false);
  assert.deepEqual(report.supportedInputModes, COMMANDER_MODERNIZATION_INPUT_MODES);
});

test("rule amendment approval is unanimous only", () => {
  const players = [{ id: "player-a" }, { id: "player-b" }, { id: "player-c" }];

  const majority = validateRuleAmendmentApproval(players, [
    { playerId: "player-a" },
    { playerId: "player-b" },
  ]);
  assert.equal(majority.valid, false);
  assert.equal(majority.majorityApprovalAllowed, false);
  assert.deepEqual(majority.missingApprovals, ["player-c"]);

  const unanimous = validateRuleAmendmentApproval(players, [
    { playerId: "player-a" },
    { playerId: "player-b" },
    { playerId: "player-c" },
  ]);
  assert.equal(unanimous.valid, true);
});

test("question, confidence, and camera foundations expose approved values", () => {
  assert.ok(QUESTION_SYSTEM_TYPES.includes("what-if"));
  assert.ok(INFORMATION_CONFIDENCE_LEVELS.includes("engine-verified"));
  assert.ok(INFORMATION_CONFIDENCE_LEVELS.includes("unknown"));
  assert.ok(EXECUTION_CONFIDENCE_LEVELS.includes("manual-resolution-required"));
  assert.ok(EXECUTION_CONFIDENCE_LEVELS.includes("enforcement-waived"));
  assert.ok(BATTLEFIELD_CAMERA_MODES.includes("follow-active-player"));
  assert.ok(BATTLEFIELD_CAMERA_MODES.includes("focus-lock"));
});

test("rule reference import safety rejects executable content", () => {
  assert.equal(
    isSafeRuleReferenceImportPayload("Official ruling text: this ability triggers once each turn.").valid,
    true
  );
  assert.equal(isSafeRuleReferenceImportPayload("<script>alert(1)</script>").valid, false);
  assert.equal(isSafeRuleReferenceImportPayload("eval('malicious')").valid, false);
  assert.equal(isSafeRuleReferenceImportPayload("new Function('return 1')").valid, false);
});

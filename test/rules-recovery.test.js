import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  RULES_RECOVERY_VERSION,
  createRecoveryContinuation,
  createRulesRecoveryState,
  importRuleReference,
  openRulesRecoveryCase,
  reviseRulesRecoveryCase,
  searchRuleReferences,
  validateRuleReferenceImport,
} from "../src/authoritative-core/rulesRecoveryEngine.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile } from "../src/state/schema.js";

test("Rules Recovery preserves approved reference sources as inert plain text", () => {
  const imported = importRuleReference({}, {
    kind: "official-rules",
    title: "Comprehensive Rules 603.1",
    text: "603.1 Triggered abilities have a trigger condition and an effect.",
    citation: "https://magic.wizards.com/en/rules",
    createdAt: 100,
  });

  assert.equal(imported.accepted, true);
  assert.equal(imported.reference.executable, false);
  assert.equal(imported.reference.plainTextOnly, true);
  assert.deepEqual(imported.reference.approvedOperations, []);
  assert.equal(imported.state.version, RULES_RECOVERY_VERSION);
  assert.equal(imported.state.history[0].immutableRecord, true);
  assert.equal(imported.state.officialRulesRemainAuthoritative, true);
});

test("Rules Recovery rejects executable, oversized, and unsafe citation imports", () => {
  assert.equal(validateRuleReferenceImport({ text: "<script>alert(1)</script>" }).valid, false);
  assert.equal(validateRuleReferenceImport({ text: "eval(gameState)", title: "Bad" }).valid, false);
  assert.equal(validateRuleReferenceImport({ text: "a".repeat(60_001), title: "Large" }).valid, false);
  assert.equal(validateRuleReferenceImport({ text: "Safe text", citation: "javascript:alert(1)" }).valid, false);

  const state = createRulesRecoveryState();
  const rejected = importRuleReference(state, { text: "require('child_process')" });
  assert.equal(rejected.accepted, false);
  assert.deepEqual(rejected.state, state);
});

test("manual effects open auditable recovery cases without silently executing gameplay", () => {
  const session = {
    pendingEffects: [{
      id: "choice-hidden",
      sourceId: "card-1",
      sourceName: "Hidden Truth",
      status: "manual-choice-required",
      reason: "Name a card in the hidden hand.",
      effect: { action: "manual-choice", choiceKind: "named-card" },
    }],
  };
  const opened = openRulesRecoveryCase({}, { pendingEffectId: "choice-hidden", createdAt: 200 }, session);
  assert.equal(opened.created, true);
  assert.equal(opened.recoveryCase.pendingEffectId, "choice-hidden");
  assert.equal(opened.recoveryCase.appliesAutomatically, false);
  assert.equal(opened.recoveryCase.status, "waiting-for-information");

  const revised = reviseRulesRecoveryCase(opened.state, opened.recoveryCase.recoveryCaseId, {
    operation: "resume-existing-effect",
    proposedInput: "Lightning Bolt",
    playerId: "local-player",
    updatedAt: 210,
  });
  assert.equal(revised.updated, true);
  assert.equal(revised.recoveryCase.status, "ready-to-resume");
  assert.equal(revised.state.history.length, 2);
  assert.notEqual(revised.state.history[0].historyId, revised.state.history[1].historyId);

  const continuation = createRecoveryContinuation(revised.state, revised.recoveryCase.recoveryCaseId);
  assert.equal(continuation.valid, true);
  assert.equal(continuation.executesRules, false);
  assert.equal(continuation.mutatesAuthoritativeState, false);
  assert.equal(continuation.intent.actionType, "MARK_PENDING_EFFECT");
  assert.equal(continuation.intent.requiresExplicitPlayerConfirmation, true);
});

test("reference lookup ranks relevant sources and recovery state remains bounded", () => {
  let state = createRulesRecoveryState();
  for (let index = 0; index < 140; index += 1) {
    state = importRuleReference(state, {
      kind: index === 139 ? "oracle" : "release-notes",
      title: index === 139 ? "Lightning Bolt Oracle" : `Release note ${index}`,
      text: index === 139 ? "Lightning Bolt deals 3 damage to any target." : `Rules note ${index}.`,
      createdAt: index + 1,
    }).state;
  }
  assert.equal(state.references.length, 120);
  const results = searchRuleReferences(state, "Lightning Bolt", { limit: 3 });
  assert.equal(results[0].title, "Lightning Bolt Oracle");
});

test("Rules Recovery core has no browser or rendering dependency", () => {
  const source = fs.readFileSync(new URL("../src/authoritative-core/rulesRecoveryEngine.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:window|document|HTMLElement|PointerEvent|localStorage|sessionStorage)\b/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:ui|platform|storage|services)[^"']*["']/);
});

test("reducer records recovery actions in authoritative Event Knowledge and persistence state", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, {
    type: "RULES_RECOVERY_IMPORT_REFERENCE",
    reference: {
      kind: "scryfall-ruling",
      title: "Example ruling",
      text: "This is preserved reference text, not executable rules code.",
      createdAt: 500,
    },
  });
  assert.equal(profile.activeSession.rulesRecovery.references.length, 1);
  assert.ok(profile.activeSession.actionHistory.some((entry) => entry.actionType === "RULES_RECOVERY_IMPORT_REFERENCE"));
  assert.ok(profile.activeSession.eventKnowledge.events.some((entry) => entry.what?.actionType === "RULES_RECOVERY_IMPORT_REFERENCE"));

  profile.activeSession.pendingEffects = [{ id: "manual-1", status: "manual-choice-required", sourceName: "Novel Card" }];
  profile = reduceProfile(profile, { type: "RULES_RECOVERY_OPEN_CASE", pendingEffectId: "manual-1", createdAt: 510 });
  assert.equal(profile.activeSession.rulesRecovery.openCaseCount, 1);
  assert.equal(profile.activeSession.pendingEffects[0].status, "manual-choice-required");

  const recoveryCaseId = profile.activeSession.rulesRecovery.cases[0].recoveryCaseId;
  profile = reduceProfile(profile, {
    type: "RULES_RECOVERY_REVISE_CASE",
    recoveryCaseId,
    operation: "resume-existing-effect",
    proposedInput: "Confirmed table value",
    status: "ready-to-resume",
    updatedAt: 520,
  });
  const continuation = createRecoveryContinuation(profile.activeSession.rulesRecovery, recoveryCaseId);
  profile = reduceProfile(profile, { type: continuation.intent.actionType, ...continuation.intent });
  assert.equal(profile.activeSession.pendingEffects[0].status, "resolved");
  assert.equal(profile.activeSession.rulesRecovery.cases[0].status, "resolved");
  assert.ok(profile.activeSession.rulesRecovery.history.some((entry) => entry.type === "recovery-action-completed"));
});

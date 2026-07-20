import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultProfile } from "../src/state/schema.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createPermanent } from "../src/state/schema.js";
import {
  buildLocalSave,
  exportLocalSave,
  loadLocalSave,
  saveCurrentGame,
  validateLocalSave,
} from "../src/storage/saveState.js";
import {
  AUTO_SAVE_POLICIES,
  CANONICAL_SAVE_VERSION,
  CHECKPOINT_REASONS,
  REPLAY_MODES,
  REPLAY_SPEEDS,
  buildReplayTimeline,
  createCanonicalSave,
  createCheckpoint,
  createPersistenceExportBundle,
  parseImportedCanonicalSave,
  recordPersistenceAfterAction,
  reconstructReplayState,
  validateCanonicalSave,
  validatePersistenceExportBundle,
} from "../src/persistence/canonicalPersistence.js";

test("canonical save model records gameplay architecture without transient presentation state", () => {
  const profile = createDefaultProfile();
  profile.activeSession.presentation = { animation: "sparkle", cameraPosition: "do-not-save" };
  profile.activeSession.selectedIds = ["temporary-selection"];
  profile.activeSession.battlefield.player = [
    createPermanent({ id: "permanent-sol-ring", name: "Sol Ring", typeLine: "Artifact" }),
  ];

  const save = createCanonicalSave(profile, { saveId: "save-canonical-test" });
  const validation = validateCanonicalSave(save);

  assert.equal(validation.valid, true);
  assert.equal(save.canonicalSaveVersion, CANONICAL_SAVE_VERSION);
  assert.equal(save.sessionMetadata.sessionId, profile.activeSession.sessionId || profile.activeSession.id);
  assert.equal(save.rulesEngineVersion, profile.activeSession.rulesEngineVersion);
  assert.equal(save.stateSnapshot.presentation, undefined);
  assert.equal(save.stateSnapshot.selectedIds, undefined);
  assert.equal(save.objectIdentity.objects.some((entry) => entry.objectId === "permanent-sol-ring"), true);
  assert.equal(save.replayMetadata.modes.includes("full-replay"), true);
  assert.equal(save.checkpoints[0].reason, "beginning-of-game");
});

test("checkpoint architecture supports phase, stack, replay timeline, and reconstruction paths", () => {
  const profile = createDefaultProfile();
  const previous = {
    ...profile.activeSession,
    phaseIndex: 0,
    stack: [{ id: "stack-lightning-bolt", name: "Lightning Bolt" }],
  };
  const next = {
    ...previous,
    phaseIndex: 1,
    stack: [],
    eventKnowledge: {
      ...previous.eventKnowledge,
      events: [
        {
          eventId: "event_resolve_spell",
          eventGroupId: "event_group_spell",
          syncRevision: 1,
          tags: ["spell", "stack"],
          importance: "normal",
          when: { timestamp: 2, turn: 1, phaseIndex: 1 },
          what: { summary: "Resolve spell", eventType: "RESOLVE_TOP_SPELL" },
        },
      ],
      groups: [{ eventGroupId: "event_group_spell", eventIds: ["event_resolve_spell"] }],
      eventCount: 1,
      lastEventId: "event_resolve_spell",
      lastEventRevision: 1,
    },
  };
  const checkpoint = createCheckpoint(next, { reason: "beginning-of-phase", eventId: "event_resolve_spell" });
  assert.equal(CHECKPOINT_REASONS.includes(checkpoint.reason), true);
  assert.equal(checkpoint.snapshot.presentation, undefined);

  const persisted = recordPersistenceAfterAction(next, { actionId: "action-resolve", actionType: "RESOLVE_TOP_SPELL" }, { beforeSession: previous });
  const reasons = persisted.persistence.checkpoints.map((entry) => entry.reason);
  assert.equal(reasons.includes("before-spell-resolves"), true);
  assert.equal(reasons.includes("after-completed-stack"), true);

  const canonical = createCanonicalSave({ activeSession: persisted });
  const timeline = buildReplayTimeline(canonical);
  assert.deepEqual(timeline.modes, [...REPLAY_MODES]);
  assert.deepEqual(timeline.speeds, [...REPLAY_SPEEDS]);
  assert.equal(timeline.jumps.eventIds.includes("event_resolve_spell"), true);

  const reconstructed = reconstructReplayState(canonical, "event_resolve_spell");
  assert.equal(reconstructed.found, true);
  assert.equal(Boolean(reconstructed.snapshot), true);
});

test("auto save policies are configurable and lightweight", () => {
  const session = createDefaultProfile().activeSession;
  assert.equal(AUTO_SAVE_POLICIES.includes("every-phase"), true);

  const previous = { ...session, phaseIndex: 0, persistence: { autoSave: { policy: "every-phase" } } };
  const next = { ...session, phaseIndex: 1, persistence: previous.persistence };
  const autosaved = recordPersistenceAfterAction(next, { actionId: "action-phase", actionType: "ADVANCE_PHASE" }, { beforeSession: previous });
  assert.equal(autosaved.persistence.autoSave.pendingAutoSave, true);
  assert.equal(autosaved.persistence.autoSave.lastAutoSaveReason, "every-phase");

  const manual = recordPersistenceAfterAction(
    { ...next, persistence: { autoSave: { policy: "manual-only" } } },
    { actionId: "action-manual", actionType: "ADVANCE_PHASE" },
    { beforeSession: previous }
  );
  assert.equal(manual.persistence.autoSave.pendingAutoSave, false);
});

test("save integration embeds canonical save, replay export, migration, and import validation", () => {
  const profile = createDefaultProfile();
  const savedProfile = saveCurrentGame(profile, { saveName: "Canonical Persistence Save" });
  const localSave = savedProfile.localSaves.items[0];
  assert.equal(validateLocalSave(localSave).valid, true);
  assert.equal(validateCanonicalSave(localSave.canonicalSave).valid, true);

  const exported = JSON.parse(exportLocalSave(localSave));
  assert.equal(validatePersistenceExportBundle(exported.persistenceExport).valid, true);
  assert.equal(parseImportedCanonicalSave(exported.canonicalSave).valid, true);

  const loaded = loadLocalSave(createDefaultProfile(), localSave.saveId);
  assert.equal(loaded.localSaves.lastError, "Save data is missing.");
  const loadedFromCollection = loadLocalSave(savedProfile, localSave.saveId);
  assert.equal(loadedFromCollection.localSaves.lastError, "");
  assert.equal(loadedFromCollection.activeSession.persistence.canonicalSaveVersion, CANONICAL_SAVE_VERSION);

  const legacySave = buildLocalSave(profile, { saveName: "Legacy Compatible" });
  const imported = parseImportedCanonicalSave({ ...legacySave, canonicalSave: null });
  assert.equal(imported.valid, true);
  assert.equal(imported.warnings.includes("original legacy save preserved"), true);
});

test("corruption detection rejects malformed imports, invalid checkpoints, duplicate object IDs, and private fields", () => {
  const canonical = createCanonicalSave(createDefaultProfile());
  assert.equal(parseImportedCanonicalSave("{not-json").valid, false);

  const withPresentation = {
    ...canonical,
    stateSnapshot: {
      ...canonical.stateSnapshot,
      presentation: { transient: true },
    },
    integrity: { ...canonical.integrity, checksum: "" },
  };
  assert.equal(validateCanonicalSave(withPresentation).valid, false);

  const duplicateObjects = {
    ...canonical,
    objectIdentity: {
      objects: [
        { objectId: "permanent-1" },
        { objectId: "permanent-1" },
      ],
    },
    integrity: { ...canonical.integrity, checksum: "" },
  };
  assert.equal(validateCanonicalSave(duplicateObjects).valid, false);

  const privateField = {
    ...canonical,
    futureExpansionFields: { authToken: "unsafe" },
    integrity: { ...canonical.integrity, checksum: "" },
  };
  assert.equal(validateCanonicalSave(privateField).valid, false);

  const badExport = createPersistenceExportBundle(canonical);
  assert.equal(validatePersistenceExportBundle({ ...badExport, checksum: "bad" }).valid, false);
});

test("reducer actions append Event Knowledge and persistence checkpoints without changing gameplay routes", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, createAction({ type: "ADVANCE_PHASE" }, profile));

  assert.equal(profile.activeSession.eventKnowledge.eventCount > 0, true);
  assert.equal(profile.activeSession.persistence.checkpoints.some((entry) => entry.reason === "beginning-of-phase"), true);
  assert.equal(profile.activeSession.persistence.replay.modes.includes("event-replay"), true);
});

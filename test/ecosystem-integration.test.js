import test from "node:test";
import assert from "node:assert/strict";
import {
  createCloudSyncState,
  createEcosystemIntegrationState,
  createEcosystemSyncEnvelope,
  createHubLaunchContext,
  createHubReturnContext,
  createPrivacySafeEcosystemBundle,
  validateEcosystemSyncEnvelope,
} from "../src/ecosystem/ecosystemIntegration.js";
import { createCanonicalSave } from "../src/persistence/canonicalPersistence.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile } from "../src/state/schema.js";
import { buildLocalSave } from "../src/storage/saveState.js";

function profileWithHiddenData() {
  const profile = createDefaultProfile();
  return {
    ...profile,
    player: { ...profile.player, name: "Ecosystem Player" },
    localAuth: { privateToken: "unsafe-token-should-not-export" },
    activeSession: {
      ...profile.activeSession,
      sessionId: "session-ecosystem",
      gameId: "game-ecosystem",
      revision: 4,
      zones: {
        ...(profile.activeSession.zones || {}),
        hand: [{ name: "Hidden Hand Card" }],
        library: [{ name: "Hidden Library Card" }],
      },
    },
  };
}

test("ecosystem integration reports honest Hub, Lite, and Deck Nexus status", () => {
  const state = createEcosystemIntegrationState(createDefaultProfile());

  assert.equal(state.version, "boardstate-ecosystem-integration-0.1.0");
  assert.equal(state.appStatuses.boardstate.gameplayAuthority, true);
  assert.equal(state.appStatuses["boardstate-hub"].status, "Hub Not Connected");
  assert.equal(state.appStatuses["boardstate-hub"].liveConnection, false);
  assert.equal(state.appStatuses["boardstate-lite"].liveConnection, false);
  assert.equal(state.appStatuses["deck-nexus"].liveConnection, false);
  assert.equal(state.security.boardStateRemainsGameplayAuthority, true);
  assert.equal(state.security.hiddenGameplayDataSharedWithHub, false);
  assert.equal(state.capabilityManifest.supportedFeatures.hubCoordination, true);
  assert.equal(state.capabilityManifest.supportedFeatures.liveHubConnection, false);
  assert.equal(state.capabilityManifest.validation.valid, true);
});

test("privacy-safe ecosystem bundles omit credentials and hidden zones", () => {
  const exported = createPrivacySafeEcosystemBundle(profileWithHiddenData());
  assert.equal(exported.valid, true);
  assert.equal(exported.bundle.sections.hub.data.appStatus.status, "Hub Not Connected");
  assert.equal(exported.bundle.sections.metadata.data.hiddenGameplayDataIncluded, false);
  assert.equal(exported.bundle.sections.metadata.data.credentialsIncluded, false);
  assert.equal(exported.text.includes("unsafe-token-should-not-export"), false);
  assert.equal(exported.text.includes("Hidden Hand Card"), false);
  assert.equal(exported.text.includes("Hidden Library Card"), false);
});

test("ecosystem sync queue is offline, namespaced, privacy-safe, and rejectable", () => {
  const profile = profileWithHiddenData();
  const created = createEcosystemSyncEnvelope(profile, { domain: "profile" });
  assert.equal(created.valid, true);
  assert.equal(created.envelope.status, "queued-offline");
  assert.equal(created.envelope.targetApp, "boardstate-hub");
  assert.equal(created.envelope.liveSubmitted, false);
  assert.equal(created.envelope.privacy.hubMayMutateGameplay, false);
  assert.equal(validateEcosystemSyncEnvelope(created.envelope).valid, true);

  const queued = reduceProfile(profile, { type: "ECOSYSTEM_QUEUE_SYNC", domain: "profile" });
  assert.equal(queued.ecosystemIntegration.cloudSync.status, "queued-offline");
  assert.equal(queued.ecosystemIntegration.cloudSync.queuedCount, 1);
  assert.deepEqual(queued.ecosystemIntegration.cloudSync.pendingDomains, ["profile"]);

  const rejected = createEcosystemSyncEnvelope(profile, {
    domain: "profile",
    payload: { password: "blocked", hand: [{ name: "Secret" }] },
  });
  assert.equal(rejected.valid, false);
  assert.match(rejected.errors.join(" "), /private ecosystem field password/);
});

test("Hub launch and return contexts validate without making Hub authoritative", () => {
  const profile = profileWithHiddenData();
  const launch = createHubLaunchContext(profile);
  assert.equal(launch.validation.valid, true);
  assert.equal(launch.context.sourceApplication, "boardstate-hub");
  assert.equal(launch.context.sessionReference.sessionId, "session-ecosystem");

  const returned = createHubReturnContext(profile);
  assert.equal(returned.destinationApplication, "boardstate-hub");
  assert.equal(returned.safeSummary.hiddenGameplayDataIncluded, false);
  assert.equal(returned.sessionReference.appIdentity, "boardstate");
});

test("shared preference patches update UX settings without touching gameplay authority", () => {
  const profile = profileWithHiddenData();
  const patched = reduceProfile(profile, {
    type: "ECOSYSTEM_APPLY_SHARED_PREFERENCES",
    preferences: {
      accessibility: { screenReaderPrompts: true, reducedNoise: true },
      animation: { reducedMotionPreference: true },
      notifications: { toast: false },
    },
  });

  assert.equal(patched.settings.helperSprite.screenReaderPrompts, true);
  assert.equal(patched.settings.adhdMode.reducedNoise, true);
  assert.equal(patched.settings.appearance.reducedMotion, true);
  assert.equal(patched.settings.notifications.toast, false);
  assert.equal(patched.activeSession.revision, 4);
  assert.equal(patched.ecosystemIntegration.security.boardStateRemainsGameplayAuthority, true);
});

test("saves and canonical persistence include ecosystem metadata without exporting UI or secrets", () => {
  const profile = profileWithHiddenData();
  const localSave = buildLocalSave(profile, { saveId: "save-ecosystem", saveName: "Ecosystem Save" });
  assert.equal(localSave.metadata.ecosystemIntegration.hubStatus, "Hub Not Connected");
  assert.equal(localSave.metadata.ecosystemIntegration.boardStateGameplayAuthority, true);
  assert.equal(localSave.metadata.ecosystemIntegration.hiddenGameplayDataSharedWithHub, false);

  const canonical = createCanonicalSave(profile, { saveId: "canonical-ecosystem" });
  assert.equal(canonical.ecosystemSyncMetadata.hubLiveConnection, false);
  assert.equal(canonical.ecosystemSyncMetadata.boardStateGameplayAuthority, true);
  assert.equal(canonical.ecosystemIntegration.security.privateCredentialsExported, false);
  assert.equal(JSON.stringify(canonical.ecosystemIntegration).includes("unsafe-token-should-not-export"), false);
});

test("cloud sync state preserves queued envelopes but never reports a live endpoint", () => {
  const profile = profileWithHiddenData();
  const envelope = createEcosystemSyncEnvelope(profile, { domain: "notifications" }).envelope;
  const cloud = createCloudSyncState(profile, { status: "queued-offline", outbox: [envelope] });

  assert.equal(cloud.liveHubConnection, false);
  assert.equal(cloud.endpointConfigured, false);
  assert.equal(cloud.offlineCapable, true);
  assert.equal(cloud.queuedCount, 1);
  assert.deepEqual(cloud.pendingDomains, ["notifications"]);
});

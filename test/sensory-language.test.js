import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSharedPreferenceSnapshot } from "../src/ecosystem/ecosystemIntegration.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile } from "../src/state/schema.js";
import {
  AUDIO_TOKEN_IDS,
  BOARDSTATE_SENSORY_LANGUAGE_VERSION,
  HAPTIC_TOKEN_IDS,
  SENSORY_CHANNELS,
  SENSORY_PRIORITY,
  createAudioTokenSet,
  createHapticTokenSet,
  createSensoryDebugSnapshot,
  createSensoryPreferenceDefaults,
  resolveAudioTokenForNotification,
  resolveHapticTokenForNotification,
  resolveSensoryPreferences,
  resolveSensoryTokenForAction,
} from "../src/ui/sensoryTokens.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("sensory tokens centralize generated audio and reusable haptic feedback", () => {
  const audio = createAudioTokenSet();
  const haptics = createHapticTokenSet();

  assert.equal(audio.version, BOARDSTATE_SENSORY_LANGUAGE_VERSION);
  assert.equal(haptics.version, BOARDSTATE_SENSORY_LANGUAGE_VERSION);
  assert.equal(audio.assetPolicy, "generated-web-audio-only");
  assert.equal(audio.tokens[AUDIO_TOKEN_IDS.commandDeckRotate].channel, SENSORY_CHANNELS.ui);
  assert.equal(audio.tokens[AUDIO_TOKEN_IDS.commanderEvent].priority, SENSORY_PRIORITY.commanderEvent);
  assert.equal(haptics.tokens[HAPTIC_TOKEN_IDS.commanderEvent].priority, SENSORY_PRIORITY.commanderEvent);
  assert.ok(haptics.tokens[HAPTIC_TOKEN_IDS.error].pattern.length > 1);
  assert.equal(JSON.stringify(audio).includes(".mp3"), false);
  assert.equal(JSON.stringify(audio).includes(".wav"), false);
  assert.equal(JSON.stringify(audio).includes("http"), false);
});

test("sensory preferences preserve existing opt-in sound and haptic controls", () => {
  const defaults = createSensoryPreferenceDefaults();
  const profile = createDefaultProfile();
  const quiet = resolveSensoryPreferences(profile);

  assert.equal(profile.settings.sensory.masterVolume, defaults.masterVolume);
  assert.equal(quiet.audioEnabled, false);
  assert.equal(quiet.hapticsEnabled, false);

  const enabled = resolveSensoryPreferences({
    ...profile,
    settings: {
      ...profile.settings,
      haptics: true,
      sensory: { ...profile.settings.sensory, masterVolume: 0.82, reducedHaptics: true },
      notifications: { ...profile.settings.notifications, sound: true, haptics: true },
    },
  });
  assert.equal(enabled.audioEnabled, true);
  assert.equal(enabled.hapticsEnabled, true);
  assert.equal(enabled.masterVolume, 0.82);
  assert.equal(enabled.reducedHaptics, true);
});

test("sensory token mapping reflects notification and Action Card priority", () => {
  assert.equal(resolveAudioTokenForNotification("success"), AUDIO_TOKEN_IDS.success);
  assert.equal(resolveAudioTokenForNotification("manual-choice-warning"), AUDIO_TOKEN_IDS.warning);
  assert.equal(resolveHapticTokenForNotification("failed-recovery-needed"), HAPTIC_TOKEN_IDS.error);

  const commander = resolveSensoryTokenForAction({ id: "commander", family: "commander" });
  assert.equal(commander.audioTokenId, AUDIO_TOKEN_IDS.commanderEvent);
  assert.equal(commander.hapticTokenId, HAPTIC_TOKEN_IDS.commanderEvent);
  assert.equal(commander.volumeCategory, "gameplayVolume");

  const search = resolveSensoryTokenForAction({ id: "library", family: "knowledge" });
  assert.equal(search.audioTokenId, AUDIO_TOKEN_IDS.search);
  assert.equal(search.volumeCategory, "uiVolume");
});

test("reducer and ecosystem preferences preserve sensory settings without claiming live Hub sync", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, { type: "SET_SETTING", path: "sensory.gameplayVolume", value: 0.82 });
  profile = reduceProfile(profile, { type: "SET_SETTING", path: "notifications.sound", value: true });
  profile = reduceProfile(profile, { type: "SET_SETTING", path: "haptics", value: true });

  assert.equal(profile.settings.sensory.gameplayVolume, 0.82);
  const snapshot = createSharedPreferenceSnapshot(profile);
  assert.equal(snapshot.sensory.audioEnabled, true);
  assert.equal(snapshot.sensory.hapticsEnabled, true);
  assert.equal(snapshot.sensory.gameplayVolume, 0.82);
  assert.equal(snapshot.synchronizedThroughHub, false);
});

test("sensory debug snapshots are development-only contracts", () => {
  const debug = createSensoryDebugSnapshot({
    audioToken: AUDIO_TOKEN_IDS.notification,
    hapticToken: HAPTIC_TOKEN_IDS.mediumConfirmation,
    priority: SENSORY_PRIORITY.notification,
    suppressed: "none",
    channels: [SENSORY_CHANNELS.ui, SENSORY_CHANNELS.haptics],
    volumeCategory: "uiVolume",
  });

  assert.equal(debug.version, BOARDSTATE_SENSORY_LANGUAGE_VERSION);
  assert.equal(debug.productionVisible, false);
  assert.ok(debug.fields.includes("audioToken"));
  assert.ok(debug.fields.includes("hapticToken"));
});

test("runtime exposes sensory metadata and routes existing feedback through tokens", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const schema = readRepositoryFile("src/state/schema.js");
  const localDatabase = readRepositoryFile("src/storage/localDatabase.js");
  const ecosystem = readRepositoryFile("src/ecosystem/ecosystemIntegration.js");

  assert.match(render, /BOARDSTATE_SENSORY_LANGUAGE_VERSION/);
  assert.match(render, /document\.body\.dataset\.sensoryLanguageVersion = SENSORY_LANGUAGE_VERSION/);
  assert.match(render, /data-sensory-language-version/);
  assert.match(render, /data-audio-token/);
  assert.match(render, /data-haptic-token/);
  assert.match(render, /data-sensory-priority/);
  assert.match(render, /function playSensoryFeedback/);
  assert.match(render, /function playAudioToken/);
  assert.match(render, /function triggerHapticToken/);
  assert.match(render, /sharedSensoryAudioContext/);
  assert.match(render, /function renderSensoryDebugOverlay/);
  assert.match(render, /boardstate-sensory-debug/);
  assert.match(render, /import\.meta\.env\?\.DEV/);
  assert.match(render, /resolveSensoryTokenForAction\(card\)/);
  assert.match(render, /AUDIO_TOKEN_IDS\.commandDeckRotate/);
  assert.match(render, /HAPTIC_TOKEN_IDS\.commandDeckRotate/);
  assert.equal(render.includes("const context = new AudioContext()"), false);
  assert.match(styles, /\.sensory-debug-overlay/);
  assert.match(styles, /\.sensory-debug-overlay\[hidden\]/);
  assert.match(styles, /\.sensory-volume-row/);
  assert.match(schema, /sensory:\s*{\s*masterVolume:\s*0\.45/);
  assert.match(localDatabase, /sensory:\s*{\s*\.{3}defaults\.settings\.sensory/);
  assert.match(ecosystem, /sensory: createSensoryPreferenceSummary/);
});

test("sensory documentation records the audio and haptic standards", () => {
  const sensoryDoc = readRepositoryFile("docs/ecosystem/SENSORY_LANGUAGE_ARCHITECTURE.md");
  const ecosystemReadme = readRepositoryFile("docs/ecosystem/README.md");
  const nativeVisualDoc = readRepositoryFile("docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md");
  const roadmap = readRepositoryFile("docs/ecosystem/COMMANDER_MODERNIZATION_ROADMAP.md");
  const battlefieldDoc = readRepositoryFile("docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md");

  assert.match(sensoryDoc, /Audio Token/i);
  assert.match(sensoryDoc, /Haptic Token/i);
  assert.match(sensoryDoc, /Developer Audio Debug Overlay/i);
  assert.match(sensoryDoc, /generated Web Audio/i);
  assert.match(sensoryDoc, /Mute test/i);
  assert.match(sensoryDoc, /must not copy Arena sound effects/i);
  assert.match(ecosystemReadme, /SENSORY_LANGUAGE_ARCHITECTURE\.md/);
  assert.match(nativeVisualDoc, /Audio Language And Haptics Standard/);
  assert.match(roadmap, /Prompt 12\.6: Audio Language, Haptics, And Sensory Feedback/);
  assert.match(battlefieldDoc, /Prompt 12\.6 Audio Language And Haptics/);
});

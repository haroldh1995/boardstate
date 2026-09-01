# Audio Language, Haptics, And Sensory Feedback System

Date: 2026-07-26

Prompt 12.6 establishes BoardState's permanent sensory language. This is not a music prompt, feature prompt, sound-effects library, or Arena clone. It defines how BoardState confirms interaction through restrained audio and haptic feedback while keeping gameplay understandable when muted.

## Reference Review

The supplied BoardState screenshot and Arena references were reviewed only for sensory principles: hand-like focus at the bottom of the battlefield, tactile feedback expectations, immediate input confirmation, restrained hierarchy, and premium product confidence.

Useful principles:

- Sensory feedback should confirm intent without becoming noise.
- The most important gameplay events deserve stronger feedback than routine UI actions.
- Card and command interactions should feel tactile, restrained, and consistent.
- Silence is a valid design tool when feedback would not improve clarity.
- Audio and haptics must never be required to understand gameplay.

BoardState must not copy Arena sound effects, music, haptics, branding, assets, protected timing values, or visual identity.

## AAA Design Process

The Prompt 12.6 sensory pass evaluated multiple directions before implementation:

- Fantasy Chimes: rejected as too decorative and likely to become fatiguing during long Commander games.
- Mechanical Clicks: rejected because it made Action Cards feel like generic UI controls.
- Heavy Cinematic Impacts: rejected because frequent Commander interactions would compete with gameplay.
- Silent Accessibility-Only Mode: retained as the default baseline but not sufficient as a premium opt-in language.
- Restrained Tactile Tokens: selected. BoardState uses short generated Web Audio tones and compact vibration patterns that communicate confirmation, selection, warning, success, Commander importance, card placement, stack resolution, combat, and Command Deck rotation.

## Sensory Token System

`src/ui/sensoryTokens.js` owns the reusable sensory contract:

- `BOARDSTATE_SENSORY_LANGUAGE_VERSION`
- `AUDIO_TOKEN_IDS`
- `HAPTIC_TOKEN_IDS`
- `SENSORY_CHANNELS`
- `SENSORY_PRIORITY`
- `SENSORY_DEBUG_FIELDS`
- `createAudioTokenSet()`
- `createHapticTokenSet()`
- `createSensoryPreferenceDefaults()`
- `resolveSensoryPreferences()`
- `resolveSensoryTokenForAction()`
- `resolveAudioTokenForNotification()`
- `resolveHapticTokenForNotification()`
- `createSensoryDebugSnapshot()`

Future audio or haptic tuning should modify this token module instead of scattering hard-coded tones, vibration patterns, volume assumptions, or event-specific feedback through gameplay components.

## Runtime Integration

`src/ui/render.js` exposes:

- `document.body.dataset.sensoryLanguageVersion`
- `data-sensory-language-version`
- `data-audio-token`
- `data-haptic-token`
- `data-sensory-priority`
- `data-sensory-channel`

The battlefield root, Dual Hand Dock, and Hand Cards publish presentation metadata only. These attributes do not mutate gameplay state, persist transient presentation state, expose hidden information, alter rules authority, or claim Hub/Lite/Nexus connectivity.

The existing notification sound and haptic controls remain the opt-in gates for browser feedback. Existing gameplay haptic hooks now route through the same token dispatcher instead of directly calling `navigator.vibrate()`.

## Audio Architecture

BoardState uses generated Web Audio tones rather than bundled or remote sound assets. This avoids licensing risk, network dependency, and copied game audio.

Runtime standards:

- `playSensoryFeedback()` is the central dispatcher.
- `playAudioToken()` reads token metadata from `src/ui/sensoryTokens.js`.
- One shared browser `AudioContext` is reused instead of opening a new context per sound.
- Audio respects `notifications.sound`, `settings.sensory.masterVolume`, `settings.sensory.uiVolume`, `settings.sensory.gameplayVolume`, `settings.sensory.ambientVolume`, and `settings.sensory.musicVolume`.
- Browser autoplay policy is respected; sound is only requested from explicit UI/test paths or notification delivery paths already controlled by user preferences.
- The app remains fully usable when Web Audio is unavailable.

## Haptic Architecture

Haptics use the browser vibration API where supported.

Runtime standards:

- `triggerHapticToken()` reads token metadata from `src/ui/sensoryTokens.js`.
- `settings.haptics` and `settings.notifications.haptics` remain the opt-in controls.
- `settings.sensory.reducedHaptics` and system reduced-motion preference suppress noncritical vibration.
- Unsupported haptic hardware fails silently except for the explicit Test Haptic button.
- Haptics reinforce confidence but never provide required-only information.

## Sensory Hierarchy

Priority order:

1. Critical Gameplay.
2. Commander Events.
3. Card Interactions.
4. Contextual Actions.
5. Notifications.
6. Background Feedback.
7. Decorative Sounds.

When multiple events compete, future systems must prioritize gameplay-critical and Commander events, combine repetitive minor feedback, and suppress decorative sounds before they create sensory clutter.

## Dual Hand Dock Sensory Contract

The Dual Hand Dock publishes and consumes sensory metadata:

- Reordering, selection, surface toggling, and Add to Hand use the shared sensory token dispatcher and remain subtle.
- Action Cards resolve their token plan from their existing `id`, `family`, `state`, and priority.
- Commander cards map to stronger Commander sensory tokens.
- Combat and stack resolution map to gameplay-priority tokens.
- Search, rules, reminders, history, notes, calculator, dice, settings, and tablecraft remain quieter UI/contextual feedback.

This preserves the dock as a handled card system, not a toolbar, without coupling private Player Hand identity to utility Commands.

## Settings And Persistence

`src/state/schema.js` adds `settings.sensory`:

- `masterVolume`
- `uiVolume`
- `gameplayVolume`
- `ambientVolume`
- `musicVolume`
- `reducedHaptics`
- `audioDebug`

`src/storage/localDatabase.js` migrates legacy profiles by merging saved settings with defaults. Existing `settings.notifications.sound`, `settings.notifications.haptics`, and `settings.haptics` remain compatible.

`src/ecosystem/ecosystemIntegration.js` includes a privacy-safe sensory preference summary in shared preferences. It does not claim live Hub synchronization.

## Developer Audio Debug Overlay

`renderSensoryDebugOverlay()` in `src/ui/render.js` is gated by `import.meta.env.DEV` and the explicit local setting `boardstate-sensory-debug=true`. It renders nothing in production builds.

When enabled locally, it can expose:

- Current Audio Token.
- Current Haptic Token.
- Priority Level.
- Suppressed feedback reason.
- Active sensory channels.
- Volume category.

The overlay is development-only and must never appear in production builds.

## Accessibility

Sensory polish must not reduce accessibility. BoardState must pass:

- Mute test: gameplay remains understandable with all audio disabled.
- Reduced haptics test: noncritical vibration is suppressed without removing gameplay capability.
- Unsupported device test: no feedback API should be required for gameplay.
- Long session test: repeated low-priority sounds and vibration must remain restrained.

## Integration Boundary

The sensory language is presentation-only. It does not:

- Mutate gameplay state.
- Replace or bypass Rules Engine, State Engine, or Event Knowledge Engine.
- Add sound or haptic information that is unavailable visually.
- Persist transient sensory state in saves.
- Expose hidden information.
- Claim Hub, Lite, or Deck Nexus availability.
- Introduce external audio assets or copied Arena sound effects.

Future prompts must consume this audio token, haptic token, preference, and debug architecture before adding new sensory treatments.

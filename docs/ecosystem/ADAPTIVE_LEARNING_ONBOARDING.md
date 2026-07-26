# Adaptive Learning And Onboarding Architecture

Date: 2026-07-26

Prompt 13.1 establishes BoardState's permanent first-time user experience, progressive onboarding, and adaptive learning standard. It extends the existing Helper Sprite and five-turn tutorial instead of replacing them.

## Product Principle

BoardState should teach only what the player needs, when the player needs it, and only once unless the player requests it again. Experienced users should not see first-run education unless they reset learning state.

## Reference Principles

The implementation uses public product guidance and accessibility standards only for principles:

- Apple Human Interface Guidelines: onboarding should make first use fast, explain value through action, and avoid blocking the user with excessive setup.
- Apple Human Interface Guidelines: game interfaces should be immersive, readable, and immediate.
- WCAG 2.2 and Consistent Help guidance: help must remain findable, input methods must remain accessible, and instruction must not depend on a single sensory channel.

These references do not introduce external runtime dependencies, internet search, copied tutorial flows, protected assets, or third-party UI layouts.

## Permanent Learning Laws

1. Teach through interaction before static instruction.
2. Keep the battlefield visible whenever possible.
3. Keep guidance brief, dismissible, optional, and contextual.
4. Remember completed guidance in the profile.
5. Reduce guidance as proficiency increases.
6. Preserve screen-reader prompts, reduced-motion compatibility, keyboard access, touch, mouse, and controller-ready navigation.
7. Do not use onboarding to bypass rules, state, event knowledge, saves, replay, or synchronization authority.

## Reused Systems

- `src/onboarding/tutorialSystem.js` remains the existing tutorial and onboarding owner.
- `src/state/gameReducer.js` remains the only reducer path for profile learning state.
- `src/ui/render.js` continues using Helper Sprite and Game Options instead of adding a parallel tutorial shell.
- Existing profile persistence and local save paths preserve onboarding state through profile normalization and save metadata.

## Adaptive Learning Engine

`src/onboarding/tutorialSystem.js` now owns:

- `ONBOARDING_EXPERIENCE_VERSION`
- `ONBOARDING_TOKEN_IDS`
- `LEARNING_HINT_PRIORITIES`
- `createOnboardingTokenSet()`
- `createAdaptiveLearningState()`
- `recordLearningInteraction()`
- `dismissLearningHint()`
- `resetAdaptiveLearning()`
- `selectAdaptiveGuidance()`
- `createHelpLearningCatalog()`
- `createLearningDebugSnapshot()`

The engine records feature discovery, completed steps, dismissed hints, interaction counts, hesitation signals, mistake counts, feature avoidance, confidence, proficiency score, and help-center usage.

## Onboarding Tokens

Onboarding Tokens centralize reusable guidance materials and behavior:

- Tooltip style.
- Coach mark style.
- Highlight treatment.
- Learning card treatment.
- Feature introduction policy.
- Persistence and future Hub sync intent.

Future onboarding work should modify tokens and engine helpers instead of creating isolated one-off tutorial UI.

## First-Time Flow

Fresh profiles still see a first-launch choice. Returning or imported profiles skip it.

The first launch offers:

- Guided practice.
- Direct battlefield entry.
- Profile setup.
- Local save loading when available.
- Help and Learning.
- Accessibility options.
- Screen-reader prompt toggle.
- Do Not Show Again.

Choosing direct battlefield entry enables gentle adaptive guidance. Choosing Do Not Show Again disables adaptive guidance and keeps experienced-user friction low.

## Contextual Guidance

Adaptive guidance may appear for:

- First Action Hand usage.
- First quiet battlefield state.
- First permanent interaction.
- First selection.
- First safe undo.
- First search.
- First stack or trigger review.
- First Commander tools.
- Help Center discovery.

Guidance routes through Helper Sprite, remains brief, and records dismissal so it is not repeatedly shown.

## Help And Learning Center

Game Options now includes Help and Learning. It exposes:

- Adaptive learning status.
- Proficiency signal.
- Completed signal count.
- Guided practice restart.
- Adaptive learning reset.
- First-time flow reset.
- Learning topics for starting, Command Deck, undo/recovery, Rules Assistant, and accessibility.

Players can revisit help without restarting onboarding.

## Developer Learning Debug Mode

The Learning Debug Overlay is development-only. It is gated by `import.meta.env.DEV` and `localStorage["boardstate-learning-debug"] === "true"`.

It reports:

- Adaptive state.
- Proficiency.
- Pending first launch.
- Last hint.
- Completed count.
- Suppression reasons.

It must never appear in production builds.

## Persistence And Ecosystem Readiness

Profile defaults and local profile normalization preserve `settings.learning` and `onboarding.adaptiveLearning`.

Shared preference snapshots expose only safe learning summaries: adaptive guidance preference, help-center hints preference, onboarding experience version, confidence label, and completed count. They do not expose hidden gameplay, private choices, or tutorial content as gameplay authority.

## Regression Rules

Future work must preserve:

- Existing tutorial practice gameplay.
- Existing local saves and tutorial autosaves.
- Existing Helper Sprite controls.
- Existing rules, state, event knowledge, replay, AI, reminder, sensory, visual, and motion systems.
- Experienced-user launch speed.
- Accessibility settings.

Do not create a second tutorial engine, second profile memory store, or onboarding-only gameplay state.

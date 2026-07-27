# Contextual Assistance System Architecture

Date: 2026-07-26

Prompt 13.2 establishes BoardState's permanent Contextual Assistance System. It extends the existing onboarding, Helper Sprite, profile memory, and Help and Learning surfaces rather than creating a second assistant, tutorial shell, rules advisor, or AI gameplay engine.

## Product Principle

BoardState should help only when help is useful. Assistance must feel like an experienced Commander player quietly noticing friction, never like software supervising the table.

## Reference Principles

The implementation uses public product guidance and accessibility standards only for principles:

- Apple Human Interface Guidelines: feedback and help should be immediate, clear, non-disruptive, and appropriate to the user's current task.
- Nielsen Norman Group contextual-help guidance: just-in-time help should be specific to the user's current context, brief, and easy to dismiss or revisit.
- WCAG 2.2 accessibility guidance: help must remain discoverable, input methods must be accessible, and guidance must not depend on hover, sound, motion, or color alone.

These references do not add runtime dependencies, copied layouts, third-party assistant UI, internet search behavior, or external AI services.

## Permanent Assistance Laws

1. Help only when helpful.
2. Never perform gameplay actions automatically.
3. Never bypass the Rules Engine, State Engine, Event Knowledge Engine, replay, saves, synchronization, or player decisions.
4. Show only the highest-value suggestion when several opportunities exist.
5. Wait for natural pauses.
6. Suppress assistance during combat resolution, animation, active search typing, continuous scrolling, rapid input, tutorial guidance, and required manual choices.
7. Remember shown, dismissed, accepted, ignored, and repeated workflow signals in profile memory.
8. Respect veteran proficiency by becoming quieter over time.
9. Keep all assistance brief, dismissible, screen-reader-safe, reduced-motion-safe, and battlefield-safe.

## Reused Systems

- `src/onboarding/tutorialSystem.js` remains the single owner for onboarding, adaptive learning, contextual assistance tokens, assistance state, candidate selection, assistance center models, and debug snapshots.
- `src/ui/render.js` remains the presentation owner through the existing Helper Sprite and Help and Learning options area.
- `src/state/gameReducer.js` remains the only reducer path for assistance profile memory.
- `src/storage/localDatabase.js` and local save normalization preserve assistance state without creating a new save format.
- `src/ecosystem/ecosystemIntegration.js` exposes only privacy-safe assistance preference summaries for future Hub synchronization.

## Assistance Priority Levels

Every candidate uses one reusable priority:

- Critical.
- Important.
- Helpful.
- Educational.
- Optional.
- Decorative.

Only the highest-priority useful candidate may appear. Lower-priority candidates stay hidden until context changes or the player requests help.

## Assistance Tokens

`ASSISTANCE_TOKEN_IDS` centralizes reusable presentation and behavior tokens:

- Suggestion Card.
- Reminder.
- Quick Tip.
- Coach Mark.
- Workflow Recommendation.
- Priority Level.
- Dismiss Style.
- Persistence.
- Pause Timing.
- Feature Discovery.

Future assistance work should modify these tokens and engine helpers instead of adding one-off suggestion UI.

## Context Evaluation

The assistance engine evaluates:

- Current page.
- Active utility panel.
- Search state.
- Combat resolution.
- Animation state.
- Repeated workflow use.
- Accepted and dismissed suggestions.
- Adaptive learning proficiency.
- Commander, stack, trigger, selection, undo, and battlefield complexity signals.

The engine returns either one Helper Sprite-compatible message or `null`.

## Suggestion Categories

Prompt 13.2 supports infrastructure for:

- Stack and trigger chain review.
- Undo availability.
- Crowded board density help.
- Repeated search workflow help.
- Selected-card context discovery.
- Commander workflow discovery.
- Future reminder discovery.
- Help and Learning reference.

These suggestions are contextual UX assistance only. They do not create rules rulings, strategy advice, game-state edits, or AI decisions.

## Presentation Contract

Suggestions must be:

- Small.
- Elegant.
- Dismissible.
- Non-blocking.
- Contextual.
- Respectful.
- Never obscuring gameplay.
- Never stealing focus.

Clicking an assistance suggestion may open an existing panel such as Search, History, Remind Me, Display, Commander Tools, Selection Inspector, or Help and Learning. It must not execute gameplay.

## Assistance Memory

Profile memory records:

- Shown suggestions.
- Accepted suggestions.
- Dismissed suggestions.
- Suppressed suggestions.
- Repeated workflow signals.
- Familiar features.
- Ignored features.
- Quiet cooldown windows.
- Rapid-input cooldown windows.

Players can reset assistance memory independently from onboarding, saves, and gameplay state.

## Developer Assistance Debug Mode

The Assistance Debug Overlay is development-only. It is gated by `import.meta.env.DEV` and `localStorage["boardstate-assistance-debug"] === "true"`.

It reports:

- Current assistance state.
- Selected opportunity.
- Visible opportunities.
- Priority calculations.
- Suppression reasons.
- Accepted and dismissed counts.
- Workflow counts.

It must never appear in production builds.

## Persistence And Ecosystem Readiness

Profile defaults preserve `settings.learning.contextualAssistance`, workflow and feature-discovery toggles, `settings.assistance`, `onboarding.assistanceTokens`, and `onboarding.contextualAssistance`.

Shared preference snapshots expose only safe assistance metadata: enabled state, workflow and feature-discovery toggles, version, and counts. They do not expose hidden zones, private game choices, strategy information, or authoritative gameplay data.

## Regression Rules

Future work must preserve:

- Existing Helper Sprite behavior.
- Existing adaptive onboarding.
- Existing tutorial practice games.
- Existing battlefield, Command Deck, motion, visual, sensory, rules, reminder, AI, save, sync, and ecosystem boundaries.
- Assistance as UX metadata only.
- Player autonomy.
- Veteran-user quiet behavior.
- Accessibility across touch, mouse, keyboard, controller-ready navigation, screen readers, reduced motion, reduced haptics, high contrast, and large text.

Do not create a second contextual assistant, second profile memory store, second help overlay, or assistance-owned gameplay state.

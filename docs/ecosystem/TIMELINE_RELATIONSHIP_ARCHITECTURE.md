# Timeline And Relationship Architecture

BoardState's Prompt 14 timeline is an Event Knowledge presentation over the live authoritative session. Its baseline identifier is `boardstate-timeline-relationship-1.0.0` and its platform-neutral owner is `src/authoritative-core/timelineRelationshipEngine.js`.

## Ownership

The Event Knowledge Engine and action envelopes remain the sources for semantic game history. The timeline derives readable summaries, turn and phase groups, filters, pagination, and object relationships from those records. It never creates a second event log or gameplay authority.

`createTimelineExperience()` projects the current event history into a bounded page. Filtering and paging are presentation state and do not mutate the session. Long histories therefore do not require every event row to remain mounted.

`buildRelationshipGraph()` explains public battlefield relationships including control, attachment, target, combat, stack, and causation links. Hidden hand, library, sideboard, face-down, and other private-zone objects are excluded. A relationship edge is explanatory metadata, not a rules instruction.

## Observational Replay

`createReplayObservation()` creates a frozen, sanitized read-only view of a recorded event and, where available, its historical snapshot summary. Replay observation cannot:

- Replace the live session.
- Execute a reducer action or rules operation.
- Recreate a cast, resolution, trigger, token, counter, or zone change.
- Replay completed animation.
- Expose runtime, undo, redo, private persistence, or transient presentation data.

The legacy `REPLAY_TO_ACTION` reducer command is a compatibility no-op. The web renderer keeps the observation in mount-local presentation state. Returning to live dismisses that state and displays the current authoritative session, including any changes made after the observation opened.

Undo remains an explicitly separate authoritative recovery command with its existing safety policies. Inspecting replay history never implies Undo.

## Presentation Contract

The in-game History command opens a bounded overlay with readable event summaries, category filters, relationship explanations, read-only recorded-state inspection, and explicit return-to-live control. It does not render raw action JSON and does not turn gameplay into a vertically scrolling document. Only the timeline list scrolls locally.

Native SwiftUI and other clients should render the same semantic entries and relationship graph with platform-native list, focus, accessibility, and navigation controls. DOM events, CSS state, browser history, and browser storage are not part of the timeline model.

## Guardrails

Focused protection lives in `test/timeline-relationship.test.js`. It verifies readable event derivation, large-history pagination, frozen observational replay, legacy reducer no-op behavior, relationship explanations, private-zone exclusion, and platform-neutral dependencies.

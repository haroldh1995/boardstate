# Rules Recovery Architecture

Rules Recovery is BoardState's auditable fallback when a relevant Magic effect cannot be safely automated from known authoritative state. Its baseline identifier is `boardstate-rules-recovery-1.0.0` and its platform-neutral owner is `src/authoritative-core/rulesRecoveryEngine.js`.

## No Silent Effects

Unsupported, conditional, hidden-information-dependent, and low-confidence effects remain visible as existing pending effects. Rules Recovery may open a case linked to that pending effect, source object, stack object, and semantic event. Opening a case does not resolve, skip, ignore, or restart the effect.

Each case explains the source, question, required information, mandatory/optional status, confidence, references, and proposed constrained operation. Players explicitly record missing information and explicitly confirm continuation through the existing pending-effect action. The original cast or resolution presentation is not recreated.

## Trusted Reference Boundary

Rules Recovery accepts reviewed plain text classified as official rules, Oracle text, Gatherer ruling, Scryfall ruling, release notes, trusted judge reference, or table interpretation. Imports are size-bounded, stripped of control markup, and rejected when they contain executable or script-like content or unsafe citations.

Imported text is reference material only. It has no approved executable operations, cannot call the rules engine, cannot mutate a session, and cannot become CSS, browser, or SwiftUI view state. Official Magic rules remain authoritative. Judge references and table interpretations remain clearly labeled secondary or table-supplied material.

## Constrained Continuation

The approved semantic operation catalog is deliberately small: clarify timing, clarify a zone change, identify a required choice, request manual information, record a table interpretation, or resume the existing effect. A recovery continuation is a non-executing semantic intent. The reducer performs the existing explicit `MARK_PENDING_EFFECT` command only after player confirmation and links completion back to the recovery case.

Rule amendments remain a separate unanimous process owned by `proactiveAssistant.js`. Rules Recovery references may support a proposal, but imported text never bypasses the established all-player approval contract and an accepted table amendment remains non-canonical.

## Audit And Persistence

Reference imports, case creation, revisions, and completion append bounded immutable records to `activeSession.rulesRecovery.history`. Reducer actions also enter the canonical action history and Event Knowledge timeline, so recovery decisions remain reconstructable without creating a second gameplay authority.

Rules Recovery state is part of the versioned session and follows normal save/restore. Transient form drafts remain presentation state and are not authoritative. Invalid or obsolete references cannot execute on restore.

## Interface And Portability

The Remind Me and Rules surface provides reference import/search, visible unresolved effects, recovery cases, explicit input review, and confirm-to-continue controls. Keyboard labels and status semantics are web presentation concerns; future SwiftUI clients map the same source, case, history, and continuation intent to native controls.

Focused regression coverage lives in `test/rules-recovery.test.js`. It verifies import safety, source classification, bounded search, manual-effect pause behavior, explicit continuation, Event Knowledge records, persistence state, and absence of browser dependencies in the core.

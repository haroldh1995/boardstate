# BoardState Ecosystem Role

## Purpose

This repository remains the authoritative advanced BoardState application during the ecosystem split. It should become the source of truth for Magic: The Gathering rules resolution, advanced battlefield state, Dry Run simulation, tutorial gameplay, and continuation from BoardState Lite.

This document is preparation only. It does not remove features, migrate data, or replace runtime systems.

The permanent project charter is `BOARDSTATE_CONSTITUTION.md`. If this role document and the Constitution appear to conflict, follow the Constitution and update this document.

## Final BoardState Responsibilities

- Own the authoritative MTG rules engine used by BoardState, BoardState Lite, Deck Nexus, and the future Hub.
- Own the advanced Arena-style battlefield, stack, priority, triggers, layers, combat, and state-based actions.
- Own Dry Run, AI simulation, deterministic tutorials, gameplay education, advanced saves, and rules visualization.
- Own advanced game-state continuation from BoardState Lite without creating a second game session.
- Expose rule enforcement state, including future Waive Rules mode, to ecosystem clients.

## What BoardState Should Stop Owning Long Term

- Full native deck building should move to Deck Nexus.
- Collection management, scanner flows, owned-card tracking, deck analytics, and deck versioning should move to Deck Nexus.
- Global profile administration, friends, tournaments, notifications, app linking, and ecosystem backups should move to the Hub.
- Primary physical-table compact life tracking should move to BoardState Lite while still using BoardState rules results when needed.
- Legacy copies of these systems should remain temporarily for migration and backwards compatibility.

## Rules-Engine Authority

Default enforcement should block illegal actions, illegal targets, illegal timing, insufficient mana, invalid attacks or blocks, missed state-based actions, and unsupported priority/stack shortcuts.

Future Waive Rules mode should not disable the engine. It should convert blocked actions into warning-and-confirmation flows, write explicit waiver events, and preserve an audit trail. BoardState Lite may display the current enforcement state, and the Hub may coordinate or report it, but neither should independently make rules decisions.

## Simple and Advanced Mode Relationship

Simple Mode should be BoardState Lite. It should keep fast physical-table workflows, compact own-board assistance, life totals, commander damage, poison, counters, and quick tabletop actions.

Advanced Mode should be original BoardState. It should present full battlefield lanes, stack/priority, targeting, combat, synchronized boards, Dry Run, rules visualization, and tutorial systems.

Both modes must ultimately operate on the same shared game session. Switching must preserve life totals, commander damage, turn, phase, permanents, counters, tapped state, tokens, stack objects, triggers, combat, tournament references, sync participants, and revision history.

## Product Relationships

- BoardState Lite sends compact user actions and receives authoritative rules results.
- Deck Nexus supplies deck definitions, commander legality input, deck versions, owned-card snapshots, and card metadata references.
- The Hub owns ecosystem profile, friends, tournaments, shared backups, app linking, notifications, active-session coordination, and migration assistance.
- BoardState owns advanced rules execution and should publish versioned rules explanations and state deltas back to the shared session.

## Temporary Legacy Policy

Do not delete legacy features until their destination app exists, their data model is mapped, migration is tested, and a rollback path is available. Legacy BoardState data should remain archived locally until users confirm successful migration.


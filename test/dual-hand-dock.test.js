import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DUAL_HAND_MODEL_VERSION,
  HAND_DOCK_SURFACES,
  createPlayerHandPrivacyProjection,
  moveOrderedId,
  normalizePersistentCommandOrder,
  orderCommandCards,
  resolveArenaHandLayout,
  resolveHandGestureIntent,
  validateArenaHandContinuity,
} from "../src/gameplay/dualHandModel.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile } from "../src/state/schema.js";
import { boardStateProfileToSharedSession } from "../src/shared-contracts/adapters.js";

const COMMAND_IDS = ["phase", "commander", "library", "rules", "remind", "undo", "battlefield", "history", "notes", "calculator", "dice", "coin", "settings", "tablecraft"];

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

function card(name, typeLine = "Instant", extras = {}) {
  return {
    cardId: extras.cardId || name.toLowerCase().replaceAll(" ", "-"),
    name,
    typeLine,
    oracleText: extras.oracleText || "Test rules text.",
    manaCost: extras.manaCost || "{1}",
    ...extras,
  };
}

test("Dual Hand model produces one non-circular continuous fan at every supported density", () => {
  for (const count of [0, 1, 7, 14, 32]) {
    const cards = Array.from({ length: count }, (_, index) => ({ id: `card-${index}` }));
    const layout = resolveArenaHandLayout(cards, { availableWidth: count > 14 ? 540 : 920, cardWidth: 124 });
    const validation = validateArenaHandContinuity(layout);
    assert.equal(layout.version, DUAL_HAND_MODEL_VERSION);
    assert.equal(layout.circular, false);
    assert.equal(layout.clones, false);
    assert.equal(validation.valid, true, validation.issues.join(", "));
    assert.deepEqual(layout.entries.map((entry) => entry.id), cards.map((entry) => entry.id));
    if (count > 1) assert.equal(layout.entries.at(-1).zIndex, Math.max(...layout.entries.map((entry) => entry.zIndex)));
  }
});

test("Command order is user-owned while contextual commands append at the right/front", () => {
  const stored = moveOrderedId(COMMAND_IDS, "phase", "front");
  const cards = [
    ...COMMAND_IDS.map((id) => ({ id, label: id, permanent: true })),
    { id: "resolve", label: "Resolve", contextual: true, priority: 120 },
    { id: "target", label: "Choose Target", contextual: true, priority: 125 },
  ];
  const ordered = orderCommandCards(cards, stored);
  assert.deepEqual(ordered.persistentOrder, stored);
  assert.deepEqual(ordered.cards.slice(0, COMMAND_IDS.length).map((entry) => entry.id), stored);
  assert.deepEqual(ordered.cards.slice(-2).map((entry) => entry.id), ["resolve", "target"]);
  assert.deepEqual(normalizePersistentCommandOrder(COMMAND_IDS, [], ["library", "phase"]).slice(-2), ["library", "phase"]);
});

test("Hand gestures retain one semantic owner and never transfer axes mid-gesture", () => {
  const reorder = resolveHandGestureIntent({ surface: HAND_DOCK_SURFACES.playerHand, dx: 48, dy: 3, durationMs: 120 });
  const cast = resolveHandGestureIntent({ surface: HAND_DOCK_SURFACES.playerHand, dx: 4, dy: -64, durationMs: 160 });
  const inspect = resolveHandGestureIntent({ surface: HAND_DOCK_SURFACES.commands, dx: 1, dy: 1, durationMs: 500 });
  assert.equal(reorder.intent, "REORDER_HAND_CARD");
  assert.equal(cast.intent, "CAST_OR_PLAY_HAND_CARD");
  assert.equal(inspect.intent, "INSPECT_HAND_CARD");
  for (const result of [reorder, cast, inspect]) {
    assert.equal(result.singleOwner, true);
    assert.equal(result.transferDuringActiveGesture, false);
  }
});

test("Scryfall Add to Hand creates independent authoritative private objects", () => {
  let profile = createDefaultProfile();
  const bolt = card("Lightning Bolt", "Instant", { oracleText: "Lightning Bolt deals 3 damage to any target." });
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: bolt, sourceZone: "scryfall-search", owner: "player" });
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: bolt, sourceZone: "scryfall-search", owner: "player" });

  const hand = profile.activeSession.zones.hand;
  assert.equal(hand.length, 2);
  assert.equal(new Set(hand.map((entry) => entry.cardInstanceId)).size, 2);
  assert.ok(hand.every((entry) => entry.zone === "hand" && entry.visibility === "owner-only"));
  assert.equal(profile.activeSession.stack.length, 0);

  const privateOwnerView = createPlayerHandPrivacyProjection(profile.activeSession, { authorizedOwner: true });
  const redactedView = createPlayerHandPrivacyProjection(profile.activeSession, { authorizedOwner: false });
  assert.equal(privateOwnerView.cards.length, 2);
  assert.equal(redactedView.count, 2);
  assert.deepEqual(redactedView.cards, []);
  assert.deepEqual(redactedView.cardInstanceIds, []);
});

test("Tracked cards preserve object identity through reorder, cast, land play, discard, and undo", () => {
  let profile = createDefaultProfile();
  profile.activeSession.gameTracking = { active: true, mode: "active-game" };
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: card("Opt"), owner: "player" });
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: card("Forest", "Basic Land - Forest", { manaCost: "" }), owner: "player" });
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: card("Duress", "Sorcery"), owner: "player" });
  const [opt, forest, duress] = profile.activeSession.zones.hand;

  profile = dispatch(profile, { type: "REORDER_PLAYER_HAND", cardInstanceId: duress.cardInstanceId, targetIndex: 0 });
  assert.equal(profile.activeSession.zones.hand[0].cardInstanceId, duress.cardInstanceId);

  profile = dispatch(profile, { type: "CAST_SPELL", card: opt, controller: "player", owner: "player", sourceZone: "hand" });
  assert.equal(profile.activeSession.zones.hand.some((entry) => entry.cardInstanceId === opt.cardInstanceId), false);
  assert.equal(profile.activeSession.stack.some((entry) => (entry.card?.cardInstanceId || entry.card?.id) === opt.cardInstanceId), true);

  profile = dispatch(profile, { type: "PLAY_LAND", card: forest, controller: "player", sourceZone: "hand" });
  assert.equal(profile.activeSession.zones.hand.some((entry) => entry.cardInstanceId === forest.cardInstanceId), false);
  assert.equal(profile.activeSession.battlefield.player.some((entry) => (entry.cardInstanceId || entry.id) === forest.cardInstanceId), true);

  profile = dispatch(profile, { type: "MOVE_HAND_CARD", cardInstanceId: duress.cardInstanceId, toZone: "graveyard" });
  assert.equal(profile.activeSession.zones.hand.length, 0);
  assert.equal(profile.activeSession.zones.graveyard.some((entry) => (entry.cardInstanceId || entry.id) === duress.cardInstanceId), true);
  profile = dispatch(profile, { type: "UNDO" });
  assert.equal(profile.activeSession.zones.hand.some((entry) => entry.cardInstanceId === duress.cardInstanceId), true);
});

test("Shared multiplayer and tournament projections never expose local hand identities", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: card("Counterspell"), owner: "player" });
  profile = dispatch(profile, { type: "ADD_CARD_TO_HAND", card: card("Island", "Basic Land - Island", { manaCost: "" }), owner: "player" });
  const shared = boardStateProfileToSharedSession(profile);
  const serialized = JSON.stringify(shared);
  assert.equal(serialized.includes("Counterspell"), false);
  assert.equal(serialized.includes("Basic Land - Island"), false);
  const localZones = shared.zoneState.zonesByPlayer[shared.localPerspective.playerId];
  assert.equal(localZones.hand.count, 2);
  assert.deepEqual(localZones.hand.cardInstanceIds, []);
});

test("Renderer exposes Add to Hand, separate surfaces, and no retired wheel activation path", () => {
  const render = readFileSync(new URL("../src/ui/render.js", import.meta.url), "utf8");
  assert.match(render, /data-add-to-player-hand/);
  assert.match(render, /type: "ADD_CARD_TO_HAND"/);
  assert.match(render, /data-hand-dock-surface/);
  assert.match(render, /data-player-hand-count/);
  assert.match(render, /data-rightmost-frontmost="true"/);
  assert.doesNotMatch(render, /commandDeckModel|data-command-deck|rotateCommandHand|resolveCommandDeck/);
});

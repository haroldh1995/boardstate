import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { hydratePermanentEffects, processEventTriggers, recalculateContinuousEffects, resolveSpell } from "../src/effects/effectEngine.js";
import { addCardToCommanderDeck, assignCommander } from "../src/game/commanderSystem.js";
import { reduceProfile } from "../src/state/gameReducer.js";

test("Cathars-style effects count creature tokens as creatures", () => {
  const crusade = hydratePermanentEffects(
    createPermanent({
      name: "Cathars' Crusade",
      typeLine: "Enchantment",
      oracleText: "Whenever a creature enters the battlefield under your control, put a +1/+1 counter on each creature you control.",
      isCreature: false,
    })
  );
  const bear = hydratePermanentEffects(createPermanent({ name: "Bear", typeLine: "Creature", basePower: 2, baseToughness: 2 }));
  const token = hydratePermanentEffects(
    createPermanent({ name: "Soldier Token", typeLine: "Token Creature - Soldier", basePower: 1, baseToughness: 1, isToken: true })
  );
  const session = {
    ...createGameSession(),
    battlefield: {
      ...createGameSession().battlefield,
      player: [crusade, bear, token],
    },
  };

  const result = processEventTriggers(session, { type: "permanent-entered", permanent: token, instances: 1 });
  const nextBear = result.battlefield.player.find((permanent) => permanent.name === "Bear");
  const nextToken = result.battlefield.player.find((permanent) => permanent.name === "Soldier Token");

  assert.equal(nextBear.counters["+1/+1"], 1);
  assert.equal(nextToken.counters["+1/+1"], 1);
  assert.equal(nextToken.currentPower, 2);
});

test("equipment and aura effects modify attached creature stats and keywords", () => {
  const creature = hydratePermanentEffects(createPermanent({ id: "creature", name: "Attacker", typeLine: "Creature", basePower: 2, baseToughness: 2 }));
  const equipment = hydratePermanentEffects(
    createPermanent({
      name: "Trample Blade",
      typeLine: "Artifact - Equipment",
      oracleText: "Equipped creature gets +2/+0 and has trample.",
      isCreature: false,
      attachedToId: "creature",
    })
  );
  const session = {
    ...createGameSession(),
    battlefield: {
      ...createGameSession().battlefield,
      player: [creature, equipment],
    },
  };

  const result = recalculateContinuousEffects(session);
  const nextCreature = result.battlefield.player.find((permanent) => permanent.id === "creature");

  assert.equal(nextCreature.currentPower, 4);
  assert.equal(nextCreature.currentToughness, 2);
  assert.ok(nextCreature.keywords.includes("trample"));
});

test("instant and sorcery spells resolve deterministic tokens and life effects", () => {
  const session = createGameSession();
  const spell = {
    name: "Raise and Recover",
    typeLine: "Sorcery",
    oracleText: "Create two 1/1 white Soldier creature tokens. You gain 3 life.",
    isSorcery: true,
  };

  const result = resolveSpell(session, spell);
  const token = result.battlefield.player.find((permanent) => permanent.name === "Soldier Token");

  assert.equal(token.quantity, 2);
  assert.equal(result.life, 43);
});

test("commander deck prevents duplicates and excludes tokens", () => {
  const profile = assignCommander(createDefaultProfile(), {
    name: "Test Commander",
    typeLine: "Legendary Creature",
    colorIdentity: [],
  });
  const card = { name: "Sol Ring", typeLine: "Artifact", colorIdentity: [] };
  const token = { name: "Treasure", typeLine: "Token Artifact", isToken: true, colorIdentity: [] };

  const once = addCardToCommanderDeck(profile, card);
  const twice = addCardToCommanderDeck(once, card);
  const withTokenAttempt = addCardToCommanderDeck(twice, token);
  const deck = withTokenAttempt.commanders[withTokenAttempt.activeSession.commander.deckKey];

  assert.equal(deck.cards.length, 1);
  assert.equal(deck.cards[0].name, "Sol Ring");
});

test("tapping one stacked permanent splits tapped and untapped copies", () => {
  const token = hydratePermanentEffects(
    createPermanent({
      id: "soldiers",
      name: "Soldier Token",
      typeLine: "Token Creature - Soldier",
      basePower: 1,
      baseToughness: 1,
      isToken: true,
      quantity: 2,
    })
  );
  const profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      battlefield: {
        ...createGameSession().battlefield,
        player: [token],
      },
    },
  };

  const result = reduceProfile(profile, { type: "TOGGLE_TAPPED", id: "soldiers" });
  const soldiers = result.activeSession.battlefield.player.filter((permanent) => permanent.name === "Soldier Token");
  const untapped = soldiers.find((permanent) => !permanent.tapped);
  const tapped = soldiers.find((permanent) => permanent.tapped);

  assert.equal(soldiers.length, 2);
  assert.equal(untapped.quantity, 1);
  assert.equal(tapped.quantity, 1);
});

test("adding a counter to one stacked permanent splits modified duplicates", () => {
  const token = hydratePermanentEffects(
    createPermanent({
      id: "soldiers",
      name: "Soldier Token",
      typeLine: "Token Creature - Soldier",
      basePower: 1,
      baseToughness: 1,
      isToken: true,
      quantity: 2,
    })
  );
  const profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      battlefield: {
        ...createGameSession().battlefield,
        player: [token],
      },
    },
  };

  const result = reduceProfile(profile, { type: "ADD_COUNTER", id: "soldiers", counterType: "+1/+1", amount: 1 });
  const soldiers = result.activeSession.battlefield.player.filter((permanent) => permanent.name === "Soldier Token");
  const base = soldiers.find((permanent) => !permanent.counters["+1/+1"]);
  const modified = soldiers.find((permanent) => permanent.counters["+1/+1"] === 1);

  assert.equal(soldiers.length, 2);
  assert.equal(base.quantity, 1);
  assert.equal(modified.quantity, 1);
  assert.equal(modified.currentPower, 2);
  assert.equal(modified.currentToughness, 2);
});

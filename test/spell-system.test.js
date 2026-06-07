import test from "node:test";
import assert from "node:assert/strict";
import { castSpellToStack, resolveSpell, resolveTopOfStack } from "../src/effects/effectEngine.js";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";

function dispatch(profile, event) {
  return reduceProfile(profile, createAction(event, profile));
}

test("instant cast uses the stack, resolves damage, and moves to graveyard", () => {
  const creature = createPermanent({ id: "bear", name: "Bear", typeLine: "Creature", basePower: 2, baseToughness: 2 });
  let session = {
    ...createGameSession(),
    battlefield: { ...createGameSession().battlefield, opponent: [creature] },
    selectedIds: ["bear"],
  };
  session = castSpellToStack(session, {
    name: "Lightning Bolt",
    typeLine: "Instant",
    oracleText: "Lightning Bolt deals 3 damage to any target.",
    isInstant: true,
  });
  assert.equal(session.stack.length, 1);
  assert.equal(session.battlefield.opponent.length, 1);

  session = resolveTopOfStack(session);
  assert.equal(session.stack.length, 0);
  assert.equal(session.battlefield.opponent.length, 0);
  assert.ok(session.zones.graveyard.some((card) => card.name === "Lightning Bolt"));
});

test("targeted instant without a selected target waits for manual choice", () => {
  const session = castSpellToStack(createGameSession(), {
    name: "Lightning Bolt",
    typeLine: "Instant",
    oracleText: "Lightning Bolt deals 3 damage to any target.",
  });

  assert.equal(session.stack[0].status, "awaiting-choice");
  assert.equal(session.stack[0].rulesConfidence, "manual-choice-required");
  assert.ok(session.pendingEffects.some((entry) => entry.stackObjectId === session.stack[0].id && entry.effect.choiceKind === "targets"));
});

test("manual target selection writes to the stack and resolves any-target damage", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, {
    type: "CAST_SPELL",
    card: {
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
    },
  });
  const pending = profile.activeSession.pendingEffects.find((entry) => entry.effect.choiceKind === "targets");
  profile = dispatch(profile, { type: "SET_SPELL_TARGET", pendingId: pending.id, targetId: "local-player" });
  profile = dispatch(profile, { type: "RESOLVE_TOP_SPELL" });

  assert.equal(profile.activeSession.life, 37);
  assert.equal(profile.activeSession.stack.length, 0);
  assert.ok(profile.activeSession.zones.graveyard.some((card) => card.name === "Lightning Bolt"));
});

test("ambiguous spell remains on stack with manual choice context", () => {
  let session = castSpellToStack(createGameSession(), {
    name: "Mystery Command",
    typeLine: "Instant",
    oracleText: "Choose one — Do something unusual.",
    isInstant: true,
  });
  assert.equal(session.stack[0].status, "awaiting-choice");
  assert.ok(session.pendingEffects.some((entry) => entry.stackObjectId === session.stack[0].id));

  session = resolveTopOfStack(session);
  assert.equal(session.stack.length, 1);
  assert.ok(session.recoveryLog.length > 0);
});

test("counterspell targets a stack object and counters it", () => {
  let session = castSpellToStack(createGameSession(), {
    name: "Opt",
    typeLine: "Instant",
    oracleText: "Draw a card.",
    isInstant: true,
  });
  const targetId = session.stack[0].id;
  session = castSpellToStack(session, {
    name: "Counterspell",
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    isInstant: true,
  }, { targetStackId: targetId });
  assert.equal(session.stack.length, 2);

  session = resolveTopOfStack(session);
  assert.equal(session.stack.length, 0);
  assert.deepEqual(session.zones.graveyard.map((card) => card.name).sort(), ["Counterspell", "Opt"]);
});

test("draw, mill, and discard update hidden zones", () => {
  let session = {
    ...createGameSession(),
    zones: {
      ...createGameSession().zones,
      library: [{ name: "A" }, { name: "B" }, { name: "C" }],
      hand: [{ name: "Held" }],
    },
  };
  session = castSpellToStack(session, { name: "Draw Two", typeLine: "Sorcery", oracleText: "Draw two cards.", isSorcery: true });
  session = resolveTopOfStack(session);
  assert.equal(session.zones.hand.length, 3);
  assert.equal(session.zones.library.length, 1);

  session = castSpellToStack(session, { name: "Self Mill", typeLine: "Sorcery", oracleText: "You mill one card.", isSorcery: true });
  session = resolveTopOfStack(session);
  assert.equal(session.zones.library.length, 0);
  assert.ok(session.zones.graveyard.some((card) => card.name === "C"));
});

test("compound draw and life-loss spell resolves every supported clause", () => {
  let session = castSpellToStack(createGameSession(), {
    name: "Night's Whisper",
    typeLine: "Sorcery",
    oracleText: "You draw two cards and lose 2 life.",
  });

  session = resolveTopOfStack(session);
  assert.equal(session.life, 38);
  assert.equal(session.zones.unknownCounts.hand, 2);
  assert.ok(session.zones.graveyard.some((card) => card.name === "Night's Whisper"));
});

test("spell copy resolves separately and ceases to exist", () => {
  let session = castSpellToStack(createGameSession(), {
    name: "Opt",
    typeLine: "Instant",
    oracleText: "Draw a card.",
    isInstant: true,
  });
  const targetId = session.stack[0].id;
  session = castSpellToStack(session, {
    name: "Reverberate",
    typeLine: "Instant",
    oracleText: "Copy target instant or sorcery spell. You may choose new targets for the copy.",
    isInstant: true,
  }, { targetStackId: targetId, targetIds: ["local-player"] });
  session = resolveTopOfStack(session, { autoChoose: true });
  assert.equal(session.stack.length, 2);
  assert.equal(session.stack[0].isCopy, true);
  session = resolveTopOfStack(session, { autoChoose: true });
  assert.equal(session.stack.length, 1);
  assert.ok(!session.zones.graveyard.some((card) => card.isCopy));
});

test("NPC non-permanent spell resolves to its graveyard instead of battlefield", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["beta"], speed: "step" });
  const beta = profile.activeSession.simulation.opponents.beta;
  profile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      battlefield: {
        ...profile.activeSession.battlefield,
        opponent: [createPermanent({ name: "Island", typeLine: "Land", controller: "beta", owner: "beta" })],
      },
      simulation: {
        ...profile.activeSession.simulation,
        currentPlayerId: "beta",
        currentPhaseIndex: 1,
        waitingForUser: false,
        opponents: {
          ...profile.activeSession.simulation.opponents,
          beta: {
            ...beta,
            currentPhaseIndex: 1,
            zones: {
              ...beta.zones,
              hand: [{ name: "Opt", typeLine: "Instant", manaValue: 1, oracleText: "Draw a card.", owner: "beta", controller: "beta" }],
            },
          },
        },
      },
    },
  };
  profile = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  const nextBeta = profile.activeSession.simulation.opponents.beta;
  assert.ok(nextBeta.zones.graveyard.some((card) => card.name === "Opt"));
  assert.ok(!profile.activeSession.battlefield.opponent.some((card) => card.name === "Opt"));
});

test("X board wipe respects mana value and leaves lands", () => {
  const session = {
    ...createGameSession(),
    battlefield: {
      ...createGameSession().battlefield,
      opponent: [
        createPermanent({ id: "cheap", name: "Cheap Rock", typeLine: "Artifact", manaValue: 2, controller: "opponent" }),
        createPermanent({ id: "large", name: "Large Creature", typeLine: "Creature", manaValue: 4, basePower: 4, baseToughness: 4, controller: "opponent" }),
        createPermanent({ id: "land", name: "Forest", typeLine: "Basic Land", controller: "opponent" }),
      ],
    },
  };
  let next = castSpellToStack(session, {
    name: "Gaze of Granite",
    typeLine: "Sorcery",
    manaCost: "{X}{B}{B}{G}",
    oracleText: "Destroy each nonland permanent with mana value X or less.",
    isSorcery: true,
  }, { xValue: 2 });
  next = resolveTopOfStack(next);
  assert.deepEqual(next.battlefield.opponent.map((card) => card.name).sort(), ["Forest", "Large Creature"]);
});

test("NPC Cultivate searches real library and puts lands in different zones", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha"], speed: "step" });
  const alpha = profile.activeSession.simulation.opponents.alpha;
  const beforeHand = alpha.zones.hand.length;
  const spell = {
    name: "Cultivate",
    typeLine: "Sorcery",
    manaCost: "{2}{G}",
    oracleText: "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    owner: "alpha",
    controller: "alpha",
    isSorcery: true,
  };
  const next = resolveSpell(profile.activeSession, spell, { controller: "alpha", sourceZone: "hand", autoChoose: true });
  const nextAlpha = next.simulation.opponents.alpha;
  assert.ok(nextAlpha.zones.hand.length >= beforeHand);
  assert.ok(nextAlpha.zones.graveyard.some((card) => card.name === "Cultivate"));
  assert.ok(next.battlefield.opponent.some((card) => card.controller === "alpha" && card.isLand));
});

test("graveyard cast permissions and flashback destination are tracked safely", () => {
  let session = {
    ...createGameSession(),
    zones: {
      ...createGameSession().zones,
      graveyard: [{ name: "Think Twice", typeLine: "Instant", oracleText: "Draw a card. Flashback {2}{U}." }],
      library: [{ name: "Drawn Card" }],
    },
  };
  session = castSpellToStack(session, {
    name: "Think Twice",
    typeLine: "Instant",
    oracleText: "Draw a card. Flashback {2}{U}.",
    isInstant: true,
  }, { sourceZone: "graveyard" });
  assert.ok(!session.pendingEffects.some((entry) => entry.effect?.choiceKind === "zone-permission"));
  session = resolveTopOfStack(session);
  assert.equal(session.stack.length, 1);
  session = {
    ...session,
    pendingEffects: session.pendingEffects.map((entry) => entry.stackObjectId === session.stack[0].id ? { ...entry, status: "resolved" } : entry),
  };
  session = resolveTopOfStack(session);
  assert.equal(session.stack.length, 0);
  assert.ok(session.zones.exile.some((card) => card.name === "Think Twice"));
});

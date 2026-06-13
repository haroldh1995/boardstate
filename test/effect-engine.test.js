import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { hydratePermanentEffects, processEventTriggers, recalculateContinuousEffects, resolveSpell } from "../src/effects/effectEngine.js";
import { addCardToCommanderDeck, assignCommander } from "../src/game/commanderSystem.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";
import { createFsmState, transitionFsm } from "../src/game/fsm.js";
import { queueGameEvent } from "../src/game/eventBus.js";
import { getTargets, selectByQuery } from "../src/effects/targeting.js";

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

test("planeswalker loyalty controls apply state-based zero-loyalty removal", () => {
  const walker = createPermanent({
    id: "walker",
    name: "Test Walker",
    typeLine: "Legendary Planeswalker - Tester",
    loyalty: 2,
  });
  let profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      battlefield: { ...createGameSession().battlefield, player: [walker] },
    },
  };

  profile = reduceProfile(profile, { type: "ADJUST_LOYALTY", id: "walker", amount: -1 });
  assert.equal(profile.activeSession.battlefield.player[0].counters.Loyalty, 1);
  profile = reduceProfile(profile, { type: "ADJUST_LOYALTY", id: "walker", amount: -1 });
  assert.equal(profile.activeSession.battlefield.player.length, 0);
  assert.ok(profile.activeSession.zones.graveyard.some((card) => card.name === "Test Walker"));
});

test("tap cost helper validates eligibility and preserves manual confirmation", () => {
  const creature = createPermanent({ id: "creature", name: "Crewmate", typeLine: "Creature", basePower: 3, baseToughness: 3 });
  const artifact = createPermanent({ id: "artifact", name: "Tool", typeLine: "Artifact" });
  let profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      selectedIds: ["creature", "artifact"],
      battlefield: { ...createGameSession().battlefield, player: [creature, artifact] },
    },
  };

  profile = reduceProfile(profile, { type: "TAP_SELECTED_FOR_COST", mechanic: "crew", requiredValue: 3 });
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "creature").tapped, true);
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "artifact").tapped, false);
  assert.ok(profile.activeSession.pendingEffects.some((entry) => entry.effect?.choiceKind === "crew"));
});

test("manual trigger entry is queued without auto-resolving choices", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, {
    type: "ADD_MANUAL_TRIGGER",
    sourceName: "Table Trigger",
    summary: "Choose a target creature, then draw a card.",
  });

  const trigger = profile.activeSession.triggerQueue[0];
  assert.equal(trigger.sourceName, "Table Trigger");
  assert.equal(trigger.status, "pending");
  assert.equal(trigger.rulesConfidence, "manual-choice-required");
  assert.equal(trigger.effectDefinitions[0].manual, true);
});

test("layer system exposes layer breakdown for static modifiers", () => {
  const anthem = hydratePermanentEffects(
    createPermanent({
      name: "Glorious Anthem",
      typeLine: "Enchantment",
      oracleText: "Creatures you control get +1/+1.",
    })
  );
  const creature = hydratePermanentEffects(createPermanent({ name: "Knight", typeLine: "Creature - Human Knight", basePower: 2, baseToughness: 2 }));
  const session = {
    ...createGameSession(),
    battlefield: {
      ...createGameSession().battlefield,
      player: [anthem, creature],
    },
  };
  const result = recalculateContinuousEffects(session);
  const updated = result.battlefield.player.find((permanent) => permanent.name === "Knight");
  assert.equal(updated.currentPower, 3);
  assert.equal(updated.currentToughness, 3);
  assert.ok((updated.layerBreakdown || []).some((entry) => entry.layer === 8));
});

test("partial stack removal supports single/custom/all and undo restoration", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(
    profile,
    createAction(
      {
        type: "ADD_PERMANENT",
        card: {
          id: "soldier-stack",
          name: "Soldier Token",
          typeLine: "Token Creature - Soldier",
          basePower: 1,
          baseToughness: 1,
          isToken: true,
          quantity: 5,
        },
      },
      profile
    )
  );
  const stack = profile.activeSession.battlefield.player.find((permanent) => permanent.id === "soldier-stack");
  profile = reduceProfile(profile, createAction({ type: "SELECT_PERMANENT", id: stack.id }, profile));

  profile = reduceProfile(profile, createAction({ type: "REMOVE_SELECTED", mode: "destroy", countMode: "single", count: 1 }, profile));
  let remaining = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.equal(remaining.quantity, 4);

  profile = reduceProfile(profile, createAction({ type: "REMOVE_SELECTED", mode: "destroy", countMode: "custom", count: 2 }, profile));
  remaining = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.equal(remaining.quantity, 2);

  profile = reduceProfile(profile, createAction({ type: "REMOVE_SELECTED", mode: "destroy", countMode: "all", count: 99 }, profile));
  remaining = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.equal(Boolean(remaining), false);

  profile = reduceProfile(profile, createAction({ type: "UNDO" }, profile));
  remaining = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.equal(remaining.quantity, 2);
  profile = reduceProfile(profile, createAction({ type: "UNDO" }, profile));
  remaining = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.equal(remaining.quantity, 4);
  profile = reduceProfile(profile, createAction({ type: "UNDO" }, profile));
  remaining = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.equal(remaining.quantity, 5);
});

test("partial destroy uses removed count while exile does not trigger dies", () => {
  let profile = createDefaultProfile();
  const add = (card) => {
    profile = reduceProfile(profile, createAction({ type: "ADD_PERMANENT", card }, profile));
  };
  add({
    name: "Death Warden",
    typeLine: "Creature - Cleric",
    basePower: 1,
    baseToughness: 1,
    oracleText: "Whenever a creature dies, you gain 1 life.",
  });
  add({
    id: "test-stack",
    name: "Test Soldier",
    typeLine: "Token Creature - Soldier",
    basePower: 1,
    baseToughness: 1,
    isToken: true,
    quantity: 4,
  });
  const stack = profile.activeSession.battlefield.player.find((permanent) => permanent.id === "test-stack");
  profile = reduceProfile(profile, createAction({ type: "SELECT_PERMANENT", id: stack.id }, profile));

  profile = reduceProfile(profile, createAction({ type: "REMOVE_SELECTED", mode: "destroy", countMode: "custom", count: 2 }, profile));
  assert.equal(profile.activeSession.life, 42);
  profile = reduceProfile(profile, createAction({ type: "REMOVE_SELECTED", mode: "exile", countMode: "single", count: 1 }, profile));
  assert.equal(profile.activeSession.life, 42);
});

test("immutable action envelope contains deterministic metadata", () => {
  const profile = createDefaultProfile();
  const action = createAction({ type: "LIFE_DELTA", amount: 1, sourceId: "life" }, profile);
  assert.equal(action.actionType, "LIFE_DELTA");
  assert.equal(action.type, "LIFE_DELTA");
  assert.equal(action.sourceId, "life");
  assert.equal(typeof action.actionId, "string");
  assert.equal(action.replayable, true);
  assert.equal(action.undoable, true);
});

test("fsm transition follows deterministic cycle", () => {
  const session = { ...createGameSession(), fsm: createFsmState() };
  const first = transitionFsm(session);
  const second = transitionFsm(first);
  assert.equal(first.fsm.current, "mulligan");
  assert.equal(second.fsm.current, "untap");
  assert.equal(second.phaseIndex, 0);
});

test("event bus queues and preserves event history entries", () => {
  const session = createGameSession();
  const next = queueGameEvent(session, "LIFE_CHANGED", { amount: 3 });
  assert.equal(next.eventQueue.length, 1);
  assert.equal(next.eventHistory.length, 1);
  assert.equal(next.eventQueue[0].eventType, "LIFE_CHANGED");
});

test("trigger queue enqueues and resolves triggers with chain metadata", () => {
  const crusade = hydratePermanentEffects(
    createPermanent({
      name: "Cathars' Crusade",
      typeLine: "Enchantment",
      oracleText: "Whenever a creature enters the battlefield under your control, put a +1/+1 counter on each creature you control.",
      isCreature: false,
    })
  );
  const token = hydratePermanentEffects(
    createPermanent({ name: "Soldier Token", typeLine: "Token Creature - Soldier", basePower: 1, baseToughness: 1, isToken: true })
  );
  const session = {
    ...createGameSession(),
    battlefield: {
      ...createGameSession().battlefield,
      player: [crusade, token],
    },
  };
  const result = processEventTriggers(session, { type: "permanent-entered", permanent: token, eventType: "ENTER_BATTLEFIELD", chainId: "chain-1" });
  const trigger = result.triggerQueue[0];
  assert.ok(trigger);
  assert.equal(trigger.chainId, "chain-1");
  assert.equal(trigger.status, "resolved");
});

test("replay to action restores deterministic snapshot", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, createAction({ type: "LIFE_DELTA", amount: 5 }, profile));
  const latest = profile.activeSession.actionHistory[0];
  profile = reduceProfile(profile, createAction({ type: "LIFE_DELTA", amount: -10 }, profile));
  const replayed = reduceProfile(profile, createAction({ type: "REPLAY_TO_ACTION", replayActionId: latest.actionId }, profile));
  assert.equal(replayed.activeSession.life, latest.snapshot.life);
  assert.equal(replayed.activeSession.replay.active, true);
});

test("dynamic query selectors and legal target helpers resolve board targets", () => {
  const creature = createPermanent({ id: "c1", name: "Knight", typeLine: "Creature - Human Knight", controller: "player" });
  const artifact = createPermanent({ id: "a1", name: "Relic", typeLine: "Artifact", controller: "player" });
  const token = createPermanent({ id: "t1", name: "Soldier Token", typeLine: "Token Creature", controller: "player", isToken: true });
  const session = {
    ...createGameSession(),
    selectedIds: ["c1"],
    battlefield: {
      ...createGameSession().battlefield,
      player: [creature, artifact, token],
      opponent: [],
    },
  };
  const queryTargets = selectByQuery(session, "type:creature controller:you");
  const selectedTargets = getTargets(session, "selected");
  assert.equal(queryTargets.length, 2);
  assert.equal(selectedTargets.length, 1);
  assert.equal(selectedTargets[0].id, "c1");
});

test("adhd mode toggle keeps legacy deterministic automation setting in sync", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, createAction({ type: "SET_SETTING", path: "adhdMode.enabled", value: true }, profile));
  assert.equal(profile.settings.adhdMode.enabled, true);
  assert.equal(profile.settings.adhdAutomation, true);

  profile = reduceProfile(profile, createAction({ type: "SET_SETTING", path: "adhdAutomation", value: false }, profile));
  assert.equal(profile.settings.adhdAutomation, false);
  assert.equal(profile.settings.adhdMode.enabled, false);
});

test("helper remind me queues messages and replays on next upkeep turn", () => {
  let profile = createDefaultProfile();
  const queuedMessage = [{ key: "queue:test", text: "Resolve queued trigger.", source: "trigger-queue" }];
  profile = reduceProfile(profile, createAction({ type: "HELPER_REMIND_ME", messages: queuedMessage }, profile));
  assert.equal(profile.activeSession.helper.reminderRequested, true);
  assert.equal(profile.activeSession.helper.reminderQueue.length, 1);

  for (let step = 0; step < 40 && !(profile.activeSession.helper.replayQueue || []).length; step += 1) {
    profile = reduceProfile(profile, createAction({ type: "ADVANCE_PHASE" }, profile));
  }
  assert.ok(profile.activeSession.turn >= 1);
  assert.equal(profile.activeSession.helper.reminderRequested, false);
  assert.equal(profile.activeSession.helper.replayQueue.length, 1);

  profile = reduceProfile(profile, createAction({ type: "HELPER_DISMISS_MESSAGE", messageKey: "queue:test" }, profile));
  assert.equal(profile.activeSession.helper.replayQueue.length, 0);
  assert.ok(profile.activeSession.helper.dismissedKeys.includes("queue:test"));
});

test("deterministic token/counter triggers still auto-resolve when adhd auto-assist is disabled", () => {
  const crusade = hydratePermanentEffects(
    createPermanent({
      name: "Cathars' Crusade",
      typeLine: "Enchantment",
      oracleText: "Whenever a creature enters the battlefield under your control, put a +1/+1 counter on each creature you control.",
      isCreature: false,
    })
  );

  const profile = {
    ...createDefaultProfile(),
    settings: {
      ...createDefaultProfile().settings,
      adhdAutomation: false,
      adhdMode: {
        ...createDefaultProfile().settings.adhdMode,
        enabled: true,
      },
    },
    activeSession: {
      ...createGameSession(),
      battlefield: {
        ...createGameSession().battlefield,
        player: [crusade],
      },
    },
  };

  const tokenCard = {
    name: "Soldier Token",
    typeLine: "Token Creature - Soldier",
    basePower: 1,
    baseToughness: 1,
    isToken: true,
    ownedByCommanderDeck: false,
  };
  const result = reduceProfile(profile, createAction({ type: "ADD_PERMANENT", card: tokenCard }, profile));
  const queued = result.activeSession.triggerQueue.filter((entry) => entry.status === "resolved");
  const token = result.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.ok(queued.length >= 1);
  assert.ok((token.counters?.["+1/+1"] || 0) >= 1);
});

test("phase-based token triggers resolve once without recursive requeue", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(
    profile,
    createAction(
      {
        type: "ADD_PERMANENT",
        card: {
          name: "Upkeep Token Engine",
          typeLine: "Enchantment",
          oracleText: "At the beginning of your upkeep, create a 1/1 white Soldier creature token.",
        },
      },
      profile
    )
  );
  profile = reduceProfile(profile, createAction({ type: "ADVANCE_PHASE" }, profile));
  const tokens = profile.activeSession.battlefield.player.filter((permanent) => permanent.isToken);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].quantity, 1);
  const phaseTriggers = profile.activeSession.triggerQueue.filter((entry) => entry.sourceName === "Upkeep Token Engine");
  assert.equal(phaseTriggers.filter((entry) => entry.status === "resolved").length, 1);
});

test("self-enter token trigger resolves once for the source permanent", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(
    profile,
    createAction(
      {
        type: "ADD_PERMANENT",
        card: {
          name: "ETB Maker",
          typeLine: "Creature",
          basePower: 2,
          baseToughness: 2,
          oracleText: "When this enters the battlefield, create two 1/1 white Soldier creature tokens.",
        },
      },
      profile
    )
  );
  const tokens = profile.activeSession.battlefield.player.filter((permanent) => permanent.name === "Soldier Token");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].quantity, 2);
});

test("mandatory scenario 1: etb counters and anim pakal combat token chain resolves automatically", () => {
  let profile = createDefaultProfile();
  const add = (card) => {
    profile = reduceProfile(profile, createAction({ type: "ADD_PERMANENT", card }, profile));
  };

  add({
    name: "Anim Pakal, Thousandth Moon",
    typeLine: "Legendary Creature - Human Soldier",
    oracleText:
      "Whenever one or more non-Gnome creatures you control attack, put a +1/+1 counter on Anim Pakal, Thousandth Moon. Then create X 1/1 red Gnome artifact creature tokens that are tapped and attacking, where X is Anim Pakal's power.",
    basePower: 1,
    baseToughness: 2,
  });
  add({
    name: "Cathars' Crusade",
    typeLine: "Enchantment",
    oracleText: "Whenever a creature enters the battlefield under your control, put a +1/+1 counter on each creature you control.",
  });
  add({
    name: "Mossborn Hydra",
    typeLine: "Creature - Hydra",
    oracleText:
      "Mossborn Hydra enters with a +1/+1 counter on it. Landfall - Whenever a land you control enters the battlefield, double the number of +1/+1 counters on Mossborn Hydra.",
    basePower: 1,
    baseToughness: 1,
  });
  const hydraEarly = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Mossborn Hydra");
  assert.ok((hydraEarly.counters?.["+1/+1"] || 0) >= 1);

  add({
    name: "Soul Warden",
    typeLine: "Creature - Human Cleric",
    oracleText: "Whenever another creature enters the battlefield, you gain 1 life.",
    basePower: 1,
    baseToughness: 1,
  });
  add({
    name: "Warleader's Call",
    typeLine: "Enchantment",
    oracleText: "Creatures you control get +1/+1. Whenever a creature enters the battlefield under your control, Warleader's Call deals 1 damage to each opponent.",
  });
  add({
    name: "Doubling Season",
    typeLine: "Enchantment",
    oracleText:
      "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead. If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
  });

  const anim = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Anim Pakal, Thousandth Moon");
  assert.ok(anim);
  profile = reduceProfile(profile, createAction({ type: "DECLARE_ATTACKERS", ids: [anim.id] }, profile));

  const gnomes = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Gnome Token");
  const hydra = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Mossborn Hydra");
  const animAfter = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Anim Pakal, Thousandth Moon");
  assert.ok(gnomes);
  assert.ok(gnomes.quantity >= 2);
  assert.equal(gnomes.tapped, true);
  assert.equal(gnomes.attacking, true);
  assert.equal(gnomes.enteredDuringCombat, true);
  assert.equal(gnomes.sourcePermanentId, animAfter.id);
  assert.equal(gnomes.createdByTriggerId.length > 0, true);
  assert.ok(profile.activeSession.combat.attackerIds.includes(gnomes.id));
  assert.ok((gnomes.stackMembers || []).every((member) => member.tapped && member.attacking));
  assert.ok((animAfter.counters?.["+1/+1"] || 0) >= (anim.counters?.["+1/+1"] || 0) + 2);
  assert.ok((hydra.currentPower || 0) >= hydra.basePower + (hydra.counters?.["+1/+1"] || 0) + 1);
  assert.ok(profile.activeSession.life > 40);
  assert.ok((profile.activeSession.commander.damageByOpponent?.opponent || 0) > 0);
});

test("anim pakal token count uses +1/+1 counter count, not power", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(
    profile,
    createAction(
      {
        type: "ADD_PERMANENT",
        card: {
          name: "Anim Pakal, Thousandth Moon",
          typeLine: "Legendary Creature - Human Soldier",
          oracleText:
            "Whenever one or more non-Gnome creatures you control attack, put a +1/+1 counter on Anim Pakal, Thousandth Moon. Then create X 1/1 red Gnome artifact creature tokens that are tapped and attacking, where X is Anim Pakal's power.",
          basePower: 4,
          baseToughness: 2,
        },
      },
      profile
    )
  );
  const anim = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Anim Pakal, Thousandth Moon");
  profile = reduceProfile(
    profile,
    createAction({ type: "ADD_COUNTER", id: anim.id, counterType: "+1/+1", amount: 2 }, profile)
  );

  profile = reduceProfile(profile, createAction({ type: "DECLARE_ATTACKERS", ids: [anim.id] }, profile));
  const gnomes = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Gnome Token");
  const animAfter = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Anim Pakal, Thousandth Moon");

  assert.ok(gnomes);
  assert.equal(animAfter.counters?.["+1/+1"], 3);
  assert.equal(gnomes.quantity, 3);
  assert.notEqual(gnomes.quantity, animAfter.currentPower);
});

test("manual-choice effects are queued and logged instead of silently ignored", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(
    profile,
    createAction(
      {
        type: "ADD_PERMANENT",
        card: {
          name: "Choice Keeper",
          typeLine: "Creature - Human Wizard",
          basePower: 2,
          baseToughness: 2,
          oracleText: "When Choice Keeper enters the battlefield, choose target creature.",
        },
      },
      profile
    )
  );

  const queued = (profile.activeSession.triggerQueue || []).find(
    (entry) => entry.sourceName === "Choice Keeper" && entry.status === "pending"
  );
  assert.ok(queued);
  assert.ok((queued.effectDefinitions || []).some((effect) => effect.manual));

  profile = reduceProfile(profile, createAction({ type: "TRIGGER_QUEUE_RESOLVE", id: queued.id }, profile));
  const pending = profile.activeSession.pendingEffects || [];
  assert.ok(pending.length > 0);
  assert.equal(pending[0].status, "pending");
  assert.ok(/manual choice required/i.test(pending[0].summary || ""));
  assert.ok(
    (profile.activeSession.effectLog || []).some((entry) =>
      /manual choice required/i.test(entry.summary || entry.text || "")
    )
  );
});

test("mandatory scenario 2: landfall token/copy generation and trigger doubling resolve automatically", () => {
  let profile = createDefaultProfile();
  const add = (card) => {
    profile = reduceProfile(profile, createAction({ type: "ADD_PERMANENT", card }, profile));
  };
  const addLand = (name, id) =>
    add({
      id,
      name,
      typeLine: "Land",
      oracleText: "",
    });

  add({
    name: "Mossborn Hydra",
    typeLine: "Creature - Hydra",
    oracleText:
      "Mossborn Hydra enters with a +1/+1 counter on it. Landfall - Whenever a land you control enters the battlefield, double the number of +1/+1 counters on Mossborn Hydra.",
    basePower: 1,
    baseToughness: 1,
  });
  add({
    name: "Scute Swarm",
    typeLine: "Creature - Insect",
    oracleText:
      "Landfall - Whenever a land enters the battlefield under your control, create a 1/1 green Insect creature token. If you control six or more lands, create a token that's a copy of Scute Swarm instead.",
    basePower: 1,
    baseToughness: 1,
  });
  add({
    name: "Traveling Chocobo",
    typeLine: "Creature - Bird",
    oracleText: "If a landfall ability of a permanent you control triggers, that ability triggers an additional time.",
    basePower: 3,
    baseToughness: 2,
  });
  add({
    name: "Doubling Season",
    typeLine: "Enchantment",
    oracleText:
      "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead. If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
  });

  for (let index = 1; index <= 8; index += 1) {
    addLand(`Test Land ${index}`, `land-${index}`);
  }

  const insectsTotal = profile.activeSession.battlefield.player
    .filter((permanent) => permanent.name === "Insect Token")
    .reduce((sum, permanent) => sum + (permanent.quantity || 1), 0);
  const scuteCopiesTotal = profile.activeSession.battlefield.player
    .filter((permanent) => permanent.name === "Scute Swarm" && permanent.isToken && permanent.isCopy)
    .reduce((sum, permanent) => sum + (permanent.quantity || 1), 0);
  const hydra = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Mossborn Hydra");
  assert.ok(insectsTotal > 0 || scuteCopiesTotal > 0);
  assert.ok(scuteCopiesTotal >= 1);
  assert.ok((hydra.counters?.["+1/+1"] || 0) > 1);
  assert.ok(profile.activeSession.triggerQueue.some((entry) => entry.status === "resolved"));
});

test("generic tapped-and-attacking combat token text creates tapped attacking tokens", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(
    profile,
    createAction(
      {
        type: "ADD_PERMANENT",
        card: {
          name: "Hero of Bladehold",
          typeLine: "Creature - Human Knight",
          basePower: 3,
          baseToughness: 4,
          oracleText: "Whenever Hero of Bladehold attacks, create two 1/1 white Soldier creature tokens that are tapped and attacking.",
        },
      },
      profile
    )
  );
  const hero = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Hero of Bladehold");
  profile = reduceProfile(profile, createAction({ type: "DECLARE_ATTACKERS", ids: [hero.id] }, profile));
  const soldiers = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Soldier Token");
  assert.ok(soldiers);
  assert.equal(soldiers.tapped, true);
  assert.equal(soldiers.attacking, true);
  assert.ok(profile.activeSession.combat.attackerIds.includes(soldiers.id));
});

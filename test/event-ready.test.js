import test from "node:test";
import assert from "node:assert/strict";
import { castSpellToStack, passStackPriority } from "../src/effects/effectEngine.js";
import {
  assignBlocker,
  canBlock,
  confirmBlockers,
  declareAttackers,
  declareNoBlockers,
  resolveCombat,
} from "../src/game/combatSystem.js";
import { createDeckWithCard } from "../src/game/commanderSystem.js";
import { chooseEntryResult, preparePermanentEntry } from "../src/game/entrySystem.js";
import {
  addTournamentPlayer,
  announceTournamentWinners,
  createTournament,
  reportTournamentResult,
} from "../src/game/tournamentSystem.js";
import { searchScryfall } from "../src/services/scryfallService.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";

test("event-ready defaults hide battlefield stats and opponent boards without strict timing", () => {
  const profile = createDefaultProfile();
  assert.equal(profile.settings.battlefield.statsOverlay, false);
  assert.deepEqual(profile.settings.battlefield.opponentVisibility, {
    opponent: false,
    alpha: false,
    beta: false,
    omega: false,
  });
  assert.equal(profile.settings.strictPhaseEnforcement, false);
  assert.equal(profile.settings.manualStackConfirmation, false);
});

test("permanent entry detects tapped and conditional entry choices", () => {
  const alwaysTapped = preparePermanentEntry({
    name: "Guildgate",
    typeLine: "Land",
    oracleText: "Guildgate enters the battlefield tapped.",
  });
  assert.equal(alwaysTapped.permanent.tapped, true);
  assert.equal(alwaysTapped.choice, null);

  const conditional = preparePermanentEntry({
    name: "Shock Land",
    typeLine: "Land",
    oracleText: "Shock Land enters tapped unless you pay 2 life.",
  });
  assert.equal(conditional.permanent.tapped, true);
  assert.equal(conditional.choice.effect.choiceKind, "conditional-tapped-entry");

  let session = {
    ...createGameSession(),
    battlefield: { ...createGameSession().battlefield, player: [conditional.permanent] },
    pendingEffects: [conditional.choice],
  };
  session = chooseEntryResult(session, conditional.choice.id, true);
  assert.equal(session.battlefield.player[0].tapped, false);
  assert.equal(session.pendingEffects[0].status, "resolved");
});

test("priority responders exclude the caster and resolve after responders pass", () => {
  const session = {
    ...createGameSession(),
    simulation: {
      ...createGameSession().simulation,
      enabled: true,
      turnOrder: ["local-player", "alpha", "beta"],
      opponents: { alpha: {}, beta: {} },
    },
  };
  let next = castSpellToStack(session, {
    name: "Test Bear",
    typeLine: "Creature - Bear",
    power: 2,
    toughness: 2,
  }, { controller: "local-player" });
  assert.deepEqual(next.priority.responderIds, ["alpha", "beta"]);
  assert.equal(next.priority.responderIds.includes("local-player"), false);
  next = passStackPriority(next, "alpha");
  assert.equal(next.stack.length, 1);
  next = passStackPriority(next, "beta");
  assert.equal(next.stack.length, 0);
  assert.ok(next.battlefield.player.some((card) => card.name === "Test Bear"));
});

test("blocker legality, reassignment, no-blockers, and lethal combat resolve safely", () => {
  const flyer = createPermanent({
    id: "flyer",
    name: "Flyer",
    typeLine: "Creature",
    keywords: ["flying"],
    power: 3,
    toughness: 3,
  });
  const ground = createPermanent({ id: "ground", name: "Ground", typeLine: "Creature", power: 2, toughness: 2 });
  const reach = createPermanent({ id: "reach", name: "Reach", typeLine: "Creature", keywords: ["reach"], power: 3, toughness: 3 });
  assert.equal(canBlock(flyer, ground), false);
  assert.equal(canBlock(flyer, reach), true);

  let session = {
    ...createGameSession(),
    battlefield: { ...createGameSession().battlefield, player: [flyer], opponent: [ground, reach] },
  };
  session = declareAttackers(session, ["flyer"]);
  session = assignBlocker(session, "flyer", "reach");
  assert.deepEqual(session.combat.blockersByAttacker.flyer, ["reach"]);
  session = confirmBlockers(session);
  session = resolveCombat(session);
  assert.equal(session.battlefield.player.length, 0);
  assert.equal(session.battlefield.opponent.some((card) => card.id === "reach"), false);
  assert.ok(session.zones.graveyard.some((card) => card.id === "flyer"));

  let openAttack = {
    ...createGameSession(),
    battlefield: { ...createGameSession().battlefield, player: [flyer] },
  };
  openAttack = declareNoBlockers(declareAttackers(openAttack, ["flyer"]));
  assert.equal(resolveCombat(openAttack).combat.resolvedDamage, 3);
});

test("menace rejects a single blocker before combat damage", () => {
  const menace = createPermanent({ id: "menace", name: "Menace", typeLine: "Creature", keywords: ["menace"], power: 3, toughness: 3 });
  const blocker = createPermanent({ id: "blocker", name: "Blocker", typeLine: "Creature", power: 2, toughness: 2 });
  let session = {
    ...createGameSession(),
    battlefield: { ...createGameSession().battlefield, player: [menace], opponent: [blocker] },
  };
  session = assignBlocker(declareAttackers(session, ["menace"]), "menace", "blocker");
  session = confirmBlockers(session);
  assert.equal(session.combat.step, "declare-blockers");
  assert.ok(session.recoveryLog.some((entry) => /menace/i.test(entry.message)));
});

test("manual triggers default to the full exact-copy stack quantity", () => {
  const stacked = createPermanent({
    id: "wardens",
    name: "Soul Warden",
    typeLine: "Creature",
    oracleText: "Whenever another creature enters, you gain 1 life.",
    quantity: 5,
  });
  let profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      selectedIds: ["wardens"],
      battlefield: { ...createGameSession().battlefield, player: [stacked] },
    },
  };
  profile = reduceProfile(profile, { type: "ADD_MANUAL_TRIGGER", sourceId: "wardens", summary: "Gain life." });
  assert.equal(profile.activeSession.triggerQueue[0].triggerCount, 5);
  assert.equal(profile.activeSession.triggerQueue[0].effectDefinitions[0].multiplier, 5);
});

test("Crew, Saddle, and Station exclude their source from tap payment", () => {
  const worker = createPermanent({ id: "worker", name: "Worker", typeLine: "Creature", power: 3, toughness: 3, summoningSick: false });
  const vehicle = createPermanent({ id: "vehicle", name: "Vehicle", typeLine: "Artifact - Vehicle", oracleText: "Crew 3" });
  let profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      selectedIds: ["worker", "vehicle"],
      battlefield: { ...createGameSession().battlefield, player: [worker, vehicle] },
    },
  };
  profile = reduceProfile(profile, { type: "TAP_SELECTED_FOR_COST", mechanic: "crew", requiredValue: 3 });
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "worker").tapped, true);
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "vehicle").tapped, false);
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "vehicle").isCreature, true);

  const rider = createPermanent({ id: "rider", name: "Rider", typeLine: "Creature", power: 2, toughness: 2, summoningSick: false });
  const mount = createPermanent({ id: "mount", name: "Mount", typeLine: "Creature - Mount", oracleText: "Saddle 2", power: 3, toughness: 3 });
  profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      selectedIds: ["rider", "mount"],
      battlefield: { ...createGameSession().battlefield, player: [rider, mount] },
    },
  };
  profile = reduceProfile(profile, { type: "TAP_SELECTED_FOR_COST", mechanic: "saddle", requiredValue: 2 });
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "rider").tapped, true);
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "mount").tapped, false);
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "mount").metadata.saddledUntilTurnEnd, 1);

  const station = createPermanent({ id: "station", name: "Station", typeLine: "Artifact", oracleText: "Station" });
  profile = {
    ...createDefaultProfile(),
    activeSession: {
      ...createGameSession(),
      selectedIds: ["worker", "station"],
      battlefield: { ...createGameSession().battlefield, player: [worker, station] },
    },
  };
  profile = reduceProfile(profile, { type: "TAP_SELECTED_FOR_COST", mechanic: "station", requiredValue: 3 });
  assert.equal(profile.activeSession.battlefield.player.find((card) => card.id === "station").counters.Station, 3);
});

test("deck creation adds the queued card and selects the new deck", () => {
  const card = { name: "Sol Ring", typeLine: "Artifact", colorIdentity: [] };
  const profile = createDeckWithCard(createDefaultProfile(), card, { name: "Event Deck" });
  const deck = profile.commanders[profile.activeSession.commander.deckKey];
  assert.equal(deck.commanderName, "Event Deck");
  assert.ok(deck.cards.some((entry) => entry.name === "Sol Ring"));
});

test("embedded Scryfall fallback keeps common deck and battlefield searches usable", async () => {
  const solRing = await searchScryfall("Sol Ring");
  const forest = await searchScryfall("Forest");
  assert.ok(solRing.some((card) => card.name === "Sol Ring" && card.typeLine === "Artifact"));
  assert.ok(forest.some((card) => card.name === "Forest" && /\bLand\b/.test(card.typeLine)));
});

test("local tournament standings rank wins and produce a safe top-three announcement", () => {
  let profile = createTournament(createDefaultProfile(), { name: "Event Ready", hostName: "Host" });
  profile = addTournamentPlayer(profile, { playerName: "Alpha" });
  profile = addTournamentPlayer(profile, { playerName: "Beta" });
  const alpha = profile.tournament.players.find((player) => player.name === "Alpha");
  const beta = profile.tournament.players.find((player) => player.name === "Beta");
  profile = reportTournamentResult(profile, { winnerId: alpha.id, playerIds: [alpha.id, beta.id] });
  profile = reportTournamentResult(profile, { winnerId: alpha.id, playerIds: [alpha.id, beta.id] });
  profile = reportTournamentResult(profile, { winnerId: beta.id, playerIds: [alpha.id, beta.id] });
  assert.equal(profile.tournament.standings[0].name, "Alpha");
  assert.equal(profile.tournament.standings[0].wins, 2);
  profile = announceTournamentWinners(profile);
  assert.equal(profile.tournament.announcement.winners.length, 3);
  assert.equal(profile.tournament.announcement.winners[0].name, "Alpha");
});

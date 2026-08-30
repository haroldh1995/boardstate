import { createDeckRecord, createPermanent, makeCommanderDeckKey } from "../state/schema.js";
import { createId, normalizeCount } from "../state/ids.js";
import { castSpellToStack } from "../effects/effectEngine.js";
import { planManaPayment } from "./manaSystem.js";

const BASIC_LANDS = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes"]);

export function canBeCommander(card) {
  const typeLine = card.typeLine || "";
  const oracle = card.oracleText || "";
  return (
    /\bLegendary\b/i.test(typeLine) &&
    (/\bCreature\b/i.test(typeLine) || /\bArtifact\b/i.test(typeLine)) ||
    (/\bPlaneswalker\b/i.test(typeLine) && /can be your commander/i.test(oracle))
  );
}

export function assignCommander(profile, card) {
  const deckKey = makeCommanderDeckKey(card.name);
  const commander = {
    name: card.name,
    cardId: card.cardId,
    colorIdentity: card.colorIdentity || [],
    zone: "command",
    castCount: 0,
    commanderTax: 0,
    damageByOpponent: {},
    deckKey,
    card: {
      ...card,
      owner: "player",
      controller: "player",
      zone: "command",
      isCommander: true,
    },
  };
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      commander,
    },
    commanders: {
      ...profile.commanders,
      [deckKey]: profile.commanders[deckKey] || createDeckRecord(commander),
    },
  };
}

export function createDeckWithCard(profile, card, options = {}) {
  const makeCommander = Boolean(options.makeCommander && canBeCommander(card));
  const safeName = String(options.name || (makeCommander ? `${card.name} Commander Deck` : "New Deck")).trim() || "New Deck";
  if (makeCommander) {
    return assignCommander(profile, card);
  }
  const deckKey = makeCommanderDeckKey(`${safeName}-${Date.now()}`);
  const deck = {
    ...createDeckRecord({
      name: safeName,
      deckKey,
      colorIdentity: card.colorIdentity || [],
    }),
    commanderName: safeName,
    cards: [],
  };
  const nextProfile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      commander: {
        ...profile.activeSession.commander,
        name: safeName,
        deckKey,
        colorIdentity: card.colorIdentity || [],
      },
    },
    commanders: {
      ...profile.commanders,
      [deckKey]: deck,
    },
  };
  return addCardToCommanderDeck(nextProfile, card, "new-deck");
}

export function castCommander(profile) {
  const session = profile.activeSession;
  if (!session.commander?.name || session.commander.zone !== "command") {
    return profile;
  }
  const commanderCard = {
    ...(session.commander.card || {}),
    name: session.commander.name,
    cardId: session.commander.cardId || session.commander.card?.cardId || "",
    manaCost: session.commander.manaCost || session.commander.card?.manaCost || "",
    manaValue: Number(session.commander.manaValue ?? session.commander.card?.manaValue ?? 0),
    typeLine: session.commander.typeLine || session.commander.card?.typeLine || "Legendary Creature",
    oracleText: session.commander.oracleText || session.commander.card?.oracleText || "",
    isCommander: true,
    controller: "player",
    owner: "player",
    ownedByCommanderDeck: true,
    zone: "command",
  };
  const nextCastCount = normalizeCount(session.commander.castCount) + 1;
  const commanderTaxPaid = Math.max(0, Number(session.commander.commanderTax || 0));
  const fullControl = ["simulation-game", "dry-run", "full-control", "digital-game"].includes(
    String(session.gameTracking?.mode || "").toLowerCase()
  );
  const requiresPayment = Boolean(profile.settings?.strictPhaseEnforcement || fullControl);
  const activeGame = Boolean(session.gameTracking?.active || session.simulation?.enabled);
  const instantSpeedPermission = /\bflash\b|you may cast .* as though .* flash/i.test(commanderCard.oracleText || "");
  const legalTiming = instantSpeedPermission || ([1, 3].includes(Number(session.phaseIndex)) && !(session.stack || []).length);
  if (requiresPayment && activeGame && !legalTiming) {
    return rejectCommanderCast(profile, "Commander timing is not legal while strict Full Control is active.");
  }
  const payment = requiresPayment
    ? planManaPayment(session, "player", commanderCard.manaCost, 0, { additionalGeneric: commanderTaxPaid })
    : { verified: true, sourceIds: [], poolAfter: { ...(session.manaPool || {}) } };
  if (requiresPayment && !payment.verified) {
    return rejectCommanderCast(profile, `Commander mana payment failed: ${payment.reason || "insufficient tracked mana"}.`);
  }
  const paidSession = payment.verified ? applyCommanderManaPayment(session, payment) : session;
  const castedSession = castSpellToStack(paidSession, commanderCard, {
    controller: "player",
    owner: "player",
    sourceZone: "command",
    castPermission: "commander-rule",
    additionalCosts: { commanderTax: commanderTaxPaid },
    manaPaymentVerified: Boolean(payment.verified),
    manaPaymentSources: payment.sourceIds || [],
  });
  return {
    ...profile,
    activeSession: {
      ...castedSession,
      commander: {
        ...session.commander,
        card: commanderCard,
        zone: "stack",
        castCount: nextCastCount,
        commanderTax: nextCastCount * 2,
      },
    },
  };
}

function rejectCommanderCast(profile, message) {
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      recoveryLog: [
        {
          id: createId("recovery"),
          source: "Commander Cast",
          message,
          severity: "warning",
          suggestedAction: "Advance to a legal main phase and make enough tracked mana available.",
          timestamp: Date.now(),
          dismissed: false,
        },
        ...(profile.activeSession?.recoveryLog || []),
      ].slice(0, 80),
    },
  };
}

function applyCommanderManaPayment(session, payment = {}) {
  const sourceIds = new Set(payment.sourceIds || []);
  return {
    ...session,
    manaPool: { ...(payment.poolAfter || session.manaPool || {}) },
    battlefield: {
      ...session.battlefield,
      player: (session.battlefield?.player || []).map((permanent) =>
        sourceIds.has(permanent.id)
          ? createPermanent({ ...permanent, tapped: true })
          : permanent
      ),
    },
  };
}

export function isDeckEligible(card) {
  if (card.isToken || card.isCopy) {
    return false;
  }
  const name = String(card.name || "").toLowerCase();
  if (BASIC_LANDS.has(name)) {
    return false;
  }
  const typeLine = card.typeLine || "";
  return /\b(Creature|Artifact|Enchantment|Planeswalker|Instant|Sorcery|Land)\b/i.test(typeLine);
}

export function isInColorIdentity(card, commander) {
  const allowed = new Set(commander?.colorIdentity || []);
  return (card.colorIdentity || []).every((symbol) => allowed.has(symbol));
}

export function addCardToCommanderDeck(profile, card, source = "manual") {
  const commander = profile.activeSession.commander;
  if (!commander?.deckKey || !isDeckEligible(card) || !isInColorIdentity(card, commander)) {
    return profile;
  }
  const deck = profile.commanders[commander.deckKey] || createDeckRecord(commander);
  const cardKey = card.cardId || card.name.toLowerCase();
  if (deck.cards.some((entry) => entry.key === cardKey)) {
    return profile;
  }
  const entry = {
    key: cardKey,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    colorIdentity: card.colorIdentity || [],
    source,
    addedAt: Date.now(),
  };
  return {
    ...profile,
    commanders: {
      ...profile.commanders,
      [commander.deckKey]: {
        ...deck,
        cards: [...deck.cards, entry],
        evolution: [...deck.evolution, { type: "added", cardName: card.name, at: Date.now(), source }],
      },
    },
  };
}

export function recordCommanderCardUsage(profile, card) {
  const commander = profile.activeSession.commander;
  if (!commander?.deckKey || card.owner !== "player" || card.controller !== "player" || card.isToken || card.isCopy || card.ownedByCommanderDeck === false) {
    return profile;
  }
  const deck = profile.commanders[commander.deckKey] || createDeckRecord(commander);
  const cardKey = card.cardId || card.name.toLowerCase();
  const current = deck.usage[cardKey] || { name: card.name, count: 0, lastUsedAt: Date.now() };
  const withUsage = {
    ...profile,
    commanders: {
      ...profile.commanders,
      [commander.deckKey]: {
        ...deck,
        usage: {
          ...deck.usage,
          [cardKey]: { ...current, count: current.count + 1, lastUsedAt: Date.now() },
        },
      },
    },
  };
  return addCardToCommanderDeck(withUsage, card, "gameplay");
}

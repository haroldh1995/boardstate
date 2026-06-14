import { createDeckRecord, createPermanent, makeCommanderDeckKey } from "../state/schema.js";
import { normalizeCount } from "../state/ids.js";

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
  if (!session.commander?.name) {
    return profile;
  }
  const commanderPermanent = createPermanent({
    ...session.commander,
    name: session.commander.name,
    typeLine: "Legendary Creature",
    isCommander: true,
    controller: "player",
    owner: "player",
    ownedByCommanderDeck: true,
  });
  const nextCastCount = normalizeCount(session.commander.castCount) + 1;
  return {
    ...profile,
    activeSession: {
      ...session,
      commander: {
        ...session.commander,
        zone: "battlefield",
        castCount: nextCastCount,
        commanderTax: Math.max(0, (nextCastCount - 1) * 2),
      },
      battlefield: {
        ...session.battlefield,
        player: [...session.battlefield.player, commanderPermanent],
      },
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

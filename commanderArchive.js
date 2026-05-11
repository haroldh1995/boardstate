const ARCHIVE_KEY = "boardstate_commander_archive_v1";

export function createDefaultArchiveState() {
  return { schemaVersion: 1, decks: [], activeDeckId: "", activeCommanderIds: [], quickAddEnabled: true };
}

export function loadCommanderArchiveState() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? { ...createDefaultArchiveState(), ...JSON.parse(raw) } : createDefaultArchiveState();
  } catch {
    return createDefaultArchiveState();
  }
}

export function saveCommanderArchiveState(archiveState) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archiveState || createDefaultArchiveState()));
}

export function createCommanderDeckArchive(commander, customDeckName = "") {
  return {
    id: `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    commanderName: commander.name,
    commanderScryfallId: commander.scryfallId || commander.id || "",
    commanderImageUrl: commander.imageUrl || "",
    customDeckName: customDeckName || `${commander.name} Deck`,
    cards: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function addCardToActiveCommanderArchive(archiveState, card, options = {}) {
  const state = archiveState || createDefaultArchiveState();
  if (!state.activeDeckId) return state;
  const isLand = String(card.typeLine || "").toLowerCase().includes("land");
  if ((options.skipLands ?? true) && isLand) return state;

  return {
    ...state,
    decks: state.decks.map((deck) => {
      if (deck.id !== state.activeDeckId) return deck;
      const existing = deck.cards.find((saved) => saved.name.toLowerCase() === card.name.toLowerCase());
      if (existing && !options.allowDuplicateManualAdd) {
        return {
          ...deck,
          cards: deck.cards.map((saved) =>
            saved === existing ? { ...saved, timesUsed: (saved.timesUsed || 0) + 1, lastUsedAt: Date.now() } : saved
          ),
          updatedAt: Date.now(),
        };
      }
      return {
        ...deck,
        cards: [...deck.cards, {
          id: `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          scryfallId: card.scryfallId || card.id || "",
          name: card.name,
          manaCost: card.manaCost || "",
          typeLine: card.typeLine || "",
          oracleText: card.oracleText || "",
          imageUrl: card.imageUrl || "",
          manuallyAdded: Boolean(options.manuallyAdded),
          timesUsed: 1,
          firstAddedAt: Date.now(),
          lastUsedAt: Date.now(),
        }],
        updatedAt: Date.now(),
      };
    }),
  };
}

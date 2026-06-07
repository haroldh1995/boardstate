const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const SCRYFALL_CARDS_URL = "https://api.scryfall.com/cards";
const SEARCH_CACHE_KEY = "boardstate-scryfall-search-cache";
const CARD_CACHE_KEY = "boardstate-scryfall-card-cache";
const CACHE_TTL_MS = 1000 * 60 * 30;
const searchCache = new Map();
const cardCache = new Map();
const pendingSearches = new Map();

export async function searchScryfall(query, commanderDeckCards = [], options = {}) {
  const trimmed = String(query || "").trim();
  const deckMatches = commanderDeckCards
    .filter((card) => card.name.toLowerCase().includes(trimmed.toLowerCase()))
    .map((card) => ({ ...card, source: "commander-deck" }));

  if (!trimmed) {
    return deckMatches;
  }
  const cached = getCachedSearch(trimmed);
  if (cached) {
    return dedupe([...deckMatches, ...cached]);
  }
  if (!navigator.onLine) {
    return dedupe([...deckMatches, ...loadPersistedSearch(trimmed)]);
  }
  const cacheKey = trimmed.toLowerCase();
  if (pendingSearches.has(cacheKey)) {
    const pending = await pendingSearches.get(cacheKey);
    return dedupe([...deckMatches, ...pending]);
  }

  const params = new URLSearchParams({
    q: trimmed,
    unique: "cards",
    order: "name",
    include_extras: "true",
  });
  const pending = fetch(`${SCRYFALL_SEARCH_URL}?${params.toString()}`, { signal: options.signal })
    .then(async (response) => {
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      const mapped = (payload.data || []).map(mapScryfallCard);
      setCachedSearch(trimmed, mapped);
      return mapped;
    })
    .catch(() => [])
    .finally(() => {
      pendingSearches.delete(cacheKey);
    });
  pendingSearches.set(cacheKey, pending);
  const mapped = await pending;
  return dedupe([...deckMatches, ...mapped]);
}

export async function fetchScryfallCardDetails(cardId, includeRulings = true) {
  if (!cardId) {
    return null;
  }
  const cached = getCachedCard(cardId);
  if (cached) {
    return cached;
  }
  if (!navigator.onLine) {
    return loadPersistedCard(cardId);
  }
  const response = await fetch(`${SCRYFALL_CARDS_URL}/${encodeURIComponent(cardId)}`);
  if (!response.ok) {
    return null;
  }
  const raw = await response.json();
  const card = mapScryfallCard(raw);
  const details = {
    ...card,
    rulingsUri: raw.rulings_uri || "",
    allParts: (raw.all_parts || []).map((part) => ({
      id: part.id,
      name: part.name,
      component: part.component,
      typeLine: part.type_line || "",
      uri: part.uri || "",
    })),
    tokenReferences: (raw.all_parts || []).filter((part) => part.component === "token").map((part) => ({ id: part.id, name: part.name })),
    prices: raw.prices || {},
    legalityCommander: raw.legalities?.commander || "not_legal",
  };
  if (includeRulings && details.rulingsUri) {
    details.rulings = await fetchRulings(details.rulingsUri);
  }
  setCachedCard(cardId, details);
  return details;
}

export async function fetchRulings(rulingsUri) {
  if (!rulingsUri || !navigator.onLine) {
    return [];
  }
  try {
    const response = await fetch(rulingsUri);
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return (payload.data || []).slice(0, 10).map((entry) => ({
      source: entry.source,
      publishedAt: entry.published_at,
      comment: entry.comment,
    }));
  } catch {
    return [];
  }
}

export function mapScryfallCard(card) {
  const face = Array.isArray(card.card_faces) ? card.card_faces[0] : null;
  const typeLine = face?.type_line || card.type_line || "";
  return {
    cardId: card.id,
    name: face?.name || card.name,
    manaCost: face?.mana_cost || card.mana_cost || "",
    typeLine,
    oracleText: face?.oracle_text || card.oracle_text || "",
    imageArt: card.image_uris?.art_crop || face?.image_uris?.art_crop || "",
    imageUrl: card.image_uris?.normal || face?.image_uris?.normal || "",
    imageSmall: card.image_uris?.small || face?.image_uris?.small || "",
    legalities: card.legalities || {},
    colorIdentity: card.color_identity || [],
    colors: face?.colors || card.colors || [],
    power: Number(face?.power ?? card.power) || 0,
    toughness: Number(face?.toughness ?? card.toughness) || 0,
    loyalty: Number(face?.loyalty ?? card.loyalty) || 0,
    isToken: typeLine.includes("Token") || card.layout === "token",
    rulingsUri: card.rulings_uri || "",
    setCode: card.set,
    collectorNumber: card.collector_number,
    scryfallUri: card.scryfall_uri,
  };
}

function dedupe(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    const key = card.cardId || card.name;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getCachedSearch(query) {
  const entry = searchCache.get(query.toLowerCase());
  if (!entry || Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    return null;
  }
  return entry.data;
}

function setCachedSearch(query, data) {
  const key = query.toLowerCase();
  const payload = { cachedAt: Date.now(), data };
  searchCache.set(key, payload);
  persistCache(SEARCH_CACHE_KEY, key, payload);
}

function loadPersistedSearch(query) {
  const key = query.toLowerCase();
  const persisted = readPersistedCache(SEARCH_CACHE_KEY, key);
  if (!persisted || Date.now() - persisted.cachedAt > CACHE_TTL_MS * 2) {
    return [];
  }
  searchCache.set(key, persisted);
  return persisted.data || [];
}

function getCachedCard(cardId) {
  const entry = cardCache.get(cardId);
  if (!entry || Date.now() - entry.cachedAt > CACHE_TTL_MS * 8) {
    return null;
  }
  return entry.data;
}

function setCachedCard(cardId, data) {
  const payload = { cachedAt: Date.now(), data };
  cardCache.set(cardId, payload);
  persistCache(CARD_CACHE_KEY, cardId, payload);
}

function loadPersistedCard(cardId) {
  const persisted = readPersistedCache(CARD_CACHE_KEY, cardId);
  if (!persisted) {
    return null;
  }
  cardCache.set(cardId, persisted);
  return persisted.data || null;
}

function persistCache(rootKey, key, payload) {
  try {
    const cache = JSON.parse(localStorage.getItem(rootKey) || "{}");
    cache[key] = payload;
    localStorage.setItem(rootKey, JSON.stringify(cache));
  } catch {
    // Cache is best-effort only.
  }
}

function readPersistedCache(rootKey, key) {
  try {
    const cache = JSON.parse(localStorage.getItem(rootKey) || "{}");
    return cache[key] || null;
  } catch {
    return null;
  }
}

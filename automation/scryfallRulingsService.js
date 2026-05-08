const RULINGS_CACHE_KEY = "boardstate-scryfall-rulings-cache-v1";
let inMemoryCache = null;

export async function fetchCardRulings(card = {}) {
  const cardId = normalizeKey(card.id || card.scryfallId);
  const rulingsUri = typeof card.rulings_uri === "string" ? card.rulings_uri.trim() : "";

  if (!cardId || !rulingsUri) {
    return [];
  }

  const cache = getCache();
  if (cache.has(cardId)) {
    return cache.get(cardId);
  }

  try {
    const response = await fetch(rulingsUri, {
      headers: {
        Accept: "application/json;q=0.9,*/*;q=0.8",
      },
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      cacheAndPersist(cardId, []);
      return [];
    }

    const rulings = Array.isArray(payload.data)
      ? payload.data.map((entry) => ({
          source: "Scryfall Ruling",
          publishedAt: normalizeText(entry?.published_at),
          comment: normalizeText(entry?.comment),
        }))
      : [];

    cacheAndPersist(cardId, rulings);
    return rulings;
  } catch {
    cacheAndPersist(cardId, []);
    return [];
  }
}

export function getCachedCardRulings(card = {}) {
  const cache = getCache();
  const cardId = normalizeKey(card.id || card.scryfallId);
  return cardId && cache.has(cardId) ? cache.get(cardId) : [];
}

export function findRelevantRuling(rulings = [], keywords = []) {
  const loweredKeywords = keywords.map((keyword) => String(keyword || "").toLowerCase()).filter(Boolean);
  if (loweredKeywords.length === 0) {
    return null;
  }

  return (
    rulings.find((ruling) => {
      const comment = String(ruling?.comment || "").toLowerCase();
      return loweredKeywords.every((keyword) => comment.includes(keyword));
    }) || null
  );
}

function getCache() {
  if (inMemoryCache) {
    return inMemoryCache;
  }

  inMemoryCache = new Map();

  try {
    const raw = window.localStorage.getItem(RULINGS_CACHE_KEY);
    if (!raw) {
      return inMemoryCache;
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([key, value]) => {
        inMemoryCache.set(key, Array.isArray(value) ? value : []);
      });
    }
  } catch {
    inMemoryCache = new Map();
  }

  return inMemoryCache;
}

function cacheAndPersist(cardId, rulings) {
  const cache = getCache();
  cache.set(cardId, Array.isArray(rulings) ? rulings : []);

  try {
    const serialized = Object.fromEntries(cache.entries());
    window.localStorage.setItem(RULINGS_CACHE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage errors and keep the memory cache alive.
  }
}

function normalizeKey(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

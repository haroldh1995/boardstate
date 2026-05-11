const SCRYFALL_API_BASE = "https://api.scryfall.com";

export async function lookupCards(query, { signal } = {}) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    include_extras: "true",
    unique: "cards",
    order: "name",
  });

  const response = await fetch(`${SCRYFALL_API_BASE}/cards/search?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json;q=0.9,*/*;q=0.8",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Card lookup failed (${response.status})`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data.map(mapScryfallCardSummary) : [];
}

export function mapScryfallCardSummary(card) {
  const typeLine = normalizeText(card?.type_line);
  const oracleText = normalizeText(card?.oracle_text || card?.card_faces?.[0]?.oracle_text);

  return {
    id: normalizeText(card?.id),
    name: normalizeText(card?.name, "Unknown Card"),
    manaCost: normalizeText(card?.mana_cost || card?.card_faces?.[0]?.mana_cost),
    typeLine,
    oracleText,
    keywords: extractOracleKeywords(oracleText),
    power: normalizeNumericText(card?.power || card?.card_faces?.[0]?.power),
    toughness: normalizeNumericText(card?.toughness || card?.card_faces?.[0]?.toughness),
    imageUrl: normalizeText(card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal),
    rulingsUri: normalizeText(card?.rulings_uri),
    isToken: typeLine.toLowerCase().includes("token"),
  };
}

export function extractOracleKeywords(oracleText) {
  const text = normalizeText(oracleText).toLowerCase();
  if (!text) {
    return [];
  }

  const keywordMatches = [
    "flying",
    "trample",
    "vigilance",
    "deathtouch",
    "lifelink",
    "first strike",
    "double strike",
    "menace",
    "ward",
    "haste",
    "hexproof",
    "indestructible",
    "reach",
  ].filter((keyword) => text.includes(keyword));

  return keywordMatches;
}

function normalizeQuery(value) {
  return normalizeText(value).trim();
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeNumericText(value) {
  if (value === null || value === undefined) {
    return "0";
  }
  return String(value).trim() || "0";
}

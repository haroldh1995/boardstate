const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";

export async function searchScryfall(query, commanderDeckCards = []) {
  const trimmed = String(query || "").trim();
  const deckMatches = commanderDeckCards
    .filter((card) => card.name.toLowerCase().includes(trimmed.toLowerCase()))
    .map((card) => ({ ...card, source: "commander-deck" }));

  if (!trimmed || !navigator.onLine) {
    return deckMatches;
  }

  const params = new URLSearchParams({
    q: trimmed.includes(":") ? trimmed : `"${trimmed}"`,
    unique: "cards",
    order: "name",
    include_extras: "true",
  });
  const response = await fetch(`${SCRYFALL_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    return deckMatches;
  }
  const payload = await response.json();
  return dedupe([...deckMatches, ...(payload.data || []).map(mapScryfallCard)]);
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
    imageUrl: card.image_uris?.normal || face?.image_uris?.normal || "",
    legalities: card.legalities || {},
    colorIdentity: card.color_identity || [],
    power: Number(face?.power ?? card.power) || 0,
    toughness: Number(face?.toughness ?? card.toughness) || 0,
    isToken: typeLine.includes("Token") || card.layout === "token",
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

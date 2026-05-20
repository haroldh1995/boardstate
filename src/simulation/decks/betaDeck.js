// Static simulation deck container for Beta.
// Replace this list with the assigned final deck list when available.
export const betaDeck = {
  id: "beta",
  name: "Beta",
  deckName: "Beta Commander Deck (Static Simulation)",
  status: "example-safe",
  isPlaceholder: true,
  commander: {
    name: "Beta Commander Placeholder",
    typeLine: "Legendary Creature — Warlock",
    manaCost: "{2}{B}{R}",
    manaValue: 4,
    power: 4,
    toughness: 4,
    oracleText: "Whenever another creature you control dies, each opponent loses 1 life.",
    role: "commander",
    quantity: 1,
  },
  cards: [
    { name: "Beta Swamp Placeholder", typeLine: "Basic Land — Swamp", manaCost: "", manaValue: 0, role: "land", quantity: 18 },
    { name: "Beta Mountain Placeholder", typeLine: "Basic Land — Mountain", manaCost: "", manaValue: 0, role: "land", quantity: 18 },
    {
      name: "Beta Aggro Creature Placeholder",
      typeLine: "Creature — Warrior",
      manaCost: "{1}{R}",
      manaValue: 2,
      power: 2,
      toughness: 1,
      oracleText: "Haste",
      keywords: ["haste"],
      role: "creature",
      quantity: 12,
    },
    {
      name: "Beta Spot Removal Placeholder",
      typeLine: "Sorcery",
      manaCost: "{1}{B}",
      manaValue: 2,
      oracleText: "Destroy target creature.",
      role: "interaction",
      quantity: 8,
    },
    { name: "Beta Value Engine Placeholder", typeLine: "Enchantment", manaCost: "{2}{B}", manaValue: 3, role: "engine", quantity: 6 },
  ],
};


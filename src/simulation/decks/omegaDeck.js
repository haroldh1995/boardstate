// Static simulation deck container for Omega.
// Replace this list with the assigned final deck list when available.
export const omegaDeck = {
  id: "omega",
  name: "Omega",
  deckName: "Edge of Eternities — World Shaper (Simulation)",
  status: "example-safe",
  isPlaceholder: true,
  commander: {
    name: "World Shaper Commander Placeholder",
    typeLine: "Legendary Creature — Elemental",
    manaCost: "{3}{G}{U}",
    manaValue: 5,
    power: 4,
    toughness: 6,
    oracleText: "Landfall — Whenever a land enters the battlefield under your control, draw a card.",
    role: "commander",
    quantity: 1,
  },
  cards: [
    { name: "Omega Forest Placeholder", typeLine: "Basic Land — Forest", manaCost: "", manaValue: 0, role: "land", quantity: 20 },
    { name: "Omega Island Placeholder", typeLine: "Basic Land — Island", manaCost: "", manaValue: 0, role: "land", quantity: 18 },
    { name: "Omega Ramp Placeholder", typeLine: "Artifact", manaCost: "{2}", manaValue: 2, role: "ramp", quantity: 8 },
    {
      name: "Omega Landfall Creature Placeholder",
      typeLine: "Creature — Beast",
      manaCost: "{2}{G}",
      manaValue: 3,
      power: 3,
      toughness: 3,
      oracleText: "Landfall — Put a +1/+1 counter on this creature.",
      role: "creature",
      quantity: 10,
    },
    {
      name: "Omega Token Engine Placeholder",
      typeLine: "Enchantment",
      manaCost: "{3}{G}",
      manaValue: 4,
      oracleText: "Whenever a land enters the battlefield under your control, create a 1/1 green Insect creature token.",
      role: "engine",
      quantity: 6,
    },
  ],
};


// Static simulation deck container for Alpha.
// Replace this list with the assigned final deck list when available.
export const alphaDeck = {
  id: "alpha",
  name: "Alpha",
  deckName: "Alpha Commander Deck (Static Simulation)",
  status: "example-safe",
  isPlaceholder: true,
  commander: {
    name: "Alpha Commander Placeholder",
    typeLine: "Legendary Creature — Advisor",
    manaCost: "{3}{W}{U}",
    manaValue: 5,
    power: 3,
    toughness: 5,
    oracleText: "Whenever another creature enters the battlefield under your control, you gain 1 life.",
    role: "commander",
    quantity: 1,
  },
  cards: [
    { name: "Alpha Plains Placeholder", typeLine: "Basic Land — Plains", manaCost: "", manaValue: 0, role: "land", quantity: 18 },
    { name: "Alpha Island Placeholder", typeLine: "Basic Land — Island", manaCost: "", manaValue: 0, role: "land", quantity: 18 },
    { name: "Alpha Ramp Relic Placeholder", typeLine: "Artifact", manaCost: "{2}", manaValue: 2, role: "ramp", quantity: 6 },
    {
      name: "Alpha Support Creature Placeholder",
      typeLine: "Creature — Soldier",
      manaCost: "{2}{W}",
      manaValue: 3,
      power: 2,
      toughness: 3,
      oracleText: "When this creature enters, put a +1/+1 counter on target creature you control.",
      role: "creature",
      quantity: 10,
    },
    {
      name: "Alpha Removal Placeholder",
      typeLine: "Instant",
      manaCost: "{1}{W}",
      manaValue: 2,
      oracleText: "Destroy target attacking creature.",
      role: "interaction",
      quantity: 6,
    },
  ],
};


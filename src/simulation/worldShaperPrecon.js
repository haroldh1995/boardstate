export const WORLD_SHAPER_PRECON_NAME = "Edge of Eternities World Shaper";

export const WORLD_SHAPER_PRECON = [
  {
    name: "World Shaper Commander Placeholder",
    typeLine: "Legendary Creature",
    manaCost: "",
    role: "commander",
    quantity: 1,
  },
  {
    name: "World Shaper Ramp Permanent Placeholder",
    typeLine: "Artifact",
    manaCost: "",
    role: "ramp",
    quantity: 10,
  },
  {
    name: "World Shaper Land Placeholder",
    typeLine: "Land",
    manaCost: "",
    role: "land",
    quantity: 38,
  },
  {
    name: "World Shaper Creature Placeholder",
    typeLine: "Creature",
    manaCost: "",
    role: "creature",
    quantity: 24,
  },
  {
    name: "World Shaper Interaction Placeholder",
    typeLine: "Instant",
    manaCost: "",
    role: "interaction",
    quantity: 9,
  },
  {
    name: "World Shaper Sorcery Placeholder",
    typeLine: "Sorcery",
    manaCost: "",
    role: "sorcery",
    quantity: 8,
  },
  {
    name: "World Shaper Engine Placeholder",
    typeLine: "Enchantment",
    manaCost: "",
    role: "engine",
    quantity: 10,
  },
];

export function expandWorldShaperDeck() {
  return WORLD_SHAPER_PRECON.flatMap((entry) =>
    Array.from({ length: entry.quantity }, (_, index) => ({
      ...entry,
      deckInstance: `${entry.name}-${index + 1}`,
      quantity: 1,
    }))
  );
}

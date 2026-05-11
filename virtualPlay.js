export function classifyVirtualCard(permanent) {
  const type = String(permanent.typeLine || "").toLowerCase();
  if (permanent.isToken || type.includes("token")) return "Token";
  if (type.includes("land")) return "Land";
  if (type.includes("instant")) return "Instant";
  if (type.includes("sorcery")) return "Sorcery";
  if (type.includes("creature")) return "Creature";
  if (type.includes("artifact")) return "Artifact";
  if (type.includes("enchantment")) return "Enchantment";
  if (type.includes("planeswalker")) return "Planeswalker";
  if (type.includes("battle")) return "Battle";
  return "Other";
}

export function getVirtualPlayChoices(permanent) {
  const kind = classifyVirtualCard(permanent);
  if (kind === "Land") {
    return [
      { mode: "PlayLand", label: "Play Land" },
      { mode: "PutOntoBattlefieldTapped", label: "Put Onto Battlefield Tapped" },
      { mode: "PutOntoBattlefieldUntapped", label: "Put Onto Battlefield Untapped" },
    ];
  }
  if (kind === "Instant" || kind === "Sorcery") {
    return [{ mode: "SimulateInstantOrSorcery", label: `Simulate ${kind}` }];
  }
  if (["Creature", "Artifact", "Enchantment", "Planeswalker", "Battle", "Token"].includes(kind)) {
    return [
      { mode: "CastPermanentSpell", label: "Cast as Permanent Spell" },
      { mode: "PutOntoBattlefieldTapped", label: "Put Onto Battlefield Tapped" },
      { mode: "PutOntoBattlefieldUntapped", label: "Put Onto Battlefield Untapped" },
    ];
  }
  return [{ mode: "ManualBattlefieldAction", label: "Manual Battlefield Action" }];
}

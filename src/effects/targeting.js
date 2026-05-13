export function getTargets(session, target, source = null, context = {}) {
  const permanents = getAllVisiblePermanents(session);
  const selected = new Set(session.selectedIds || []);
  const attackers = new Set(session.combat?.attackerIds || []);
  const normalized = normalizeTarget(target);

  return permanents.filter((permanent) => {
    switch (normalized) {
      case "self":
        return permanent.id === source?.id;
      case "attached":
        return permanent.id === source?.attachedToId;
      case "selected":
        return selected.has(permanent.id);
      case "all-creatures":
        return permanent.isCreature;
      case "all-creature-tokens":
        return permanent.isCreature && permanent.isToken;
      case "all-tokens":
        return permanent.isToken;
      case "all-attackers":
        return permanent.isCreature && attackers.has(permanent.id);
      case "all-artifacts":
        return permanent.isArtifact;
      case "all-enchantments":
        return permanent.isEnchantment;
      case "all-auras":
        return permanent.isAura;
      case "all-equipment":
        return permanent.isEquipment;
      case "all-planeswalkers":
        return permanent.isPlaneswalker;
      case "all-lands":
        return permanent.isLand;
      case "all-nonbasic-lands":
        return permanent.isLand && !/\bBasic\b/i.test(permanent.typeLine);
      case "all-permanents":
        return true;
      case "all-vehicles":
        return /\bVehicle\b/i.test(permanent.typeLine);
      case "all-mounts":
        return /\bMount\b/i.test(permanent.typeLine);
      case "all-spacecraft":
        return /\bSpacecraft\b/i.test(permanent.typeLine);
      case "all-planets":
        return /\bPlanet\b/i.test(permanent.typeLine);
      default:
        return permanent.isCreature;
    }
  });
}

export function getAllVisiblePermanents(session) {
  return [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])];
}

export function normalizeTarget(target) {
  return String(target || "all-creatures").trim().toLowerCase();
}

export function inferTargetFromText(text, sourceName = "") {
  const oracle = normalizeText(text);
  const name = normalizeText(sourceName);

  if (name && (oracle.includes(`on ${name}`) || oracle.includes(`onto ${name}`))) {
    return { target: "self", manual: false, entity: "permanent" };
  }
  if (oracle.includes("on it") || oracle.includes("on itself")) {
    return { target: "self", manual: false, entity: "permanent" };
  }
  if (oracle.includes("equipped creature") || oracle.includes("enchanted creature")) {
    return { target: "attached", manual: false, entity: "creature" };
  }
  if (oracle.includes("each creature token") || oracle.includes("creature tokens you control")) {
    return { target: "all-creature-tokens", manual: false, entity: "creature" };
  }
  if (oracle.includes("each creature") || oracle.includes("all creatures") || oracle.includes("creatures you control")) {
    return { target: "all-creatures", manual: false, entity: "creature" };
  }
  if (oracle.includes("each token") || oracle.includes("tokens you control")) {
    return { target: "all-tokens", manual: false, entity: "permanent" };
  }
  if (oracle.includes("each permanent") || oracle.includes("permanents you control")) {
    return { target: "all-permanents", manual: false, entity: "permanent" };
  }
  if (oracle.includes("each artifact") || oracle.includes("artifacts you control")) {
    return { target: "all-artifacts", manual: false, entity: "permanent" };
  }
  if (oracle.includes("each enchantment") || oracle.includes("enchantments you control")) {
    return { target: "all-enchantments", manual: false, entity: "permanent" };
  }
  if (oracle.includes("each planeswalker") || oracle.includes("planeswalkers you control")) {
    return { target: "all-planeswalkers", manual: false, entity: "permanent" };
  }
  if (oracle.includes("each nonbasic land")) {
    return { target: "all-nonbasic-lands", manual: false, entity: "permanent" };
  }
  if (oracle.includes("each land") || oracle.includes("lands you control")) {
    return { target: "all-lands", manual: false, entity: "permanent" };
  }
  if (oracle.includes("target permanent")) {
    return { target: "selected", manual: true, entity: "permanent" };
  }
  if (oracle.includes("target creature")) {
    return { target: "selected", manual: true, entity: "creature" };
  }

  return { target: "all-creatures", manual: false, entity: "creature" };
}

export function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+/\- ]+/g, " ").replace(/\s+/g, " ").trim();
}

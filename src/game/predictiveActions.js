import { getTargets } from "../effects/targeting.js";

export function buildPredictiveActions(profile) {
  const session = profile.activeSession;
  const suggestions = [];
  const playerPermanents = session.battlefield.player || [];
  const selected = playerPermanents.filter((permanent) => (session.selectedIds || []).includes(permanent.id));

  const tokenStacks = playerPermanents.filter((permanent) => permanent.isToken && (permanent.quantity || 1) > 1);
  if (tokenStacks.length) {
    suggestions.push({
      id: "stack-tokens",
      label: "Maintain token stacks",
      detail: `${tokenStacks.length} stack(s) can stay compressed for clarity.`,
      type: "stack",
      confidence: 0.82,
    });
  }

  const tokenSource = selected.find((permanent) =>
    (permanent.tokenDefinitions || []).length ||
    (permanent.parsedEffects || []).some((effect) => effect.action === "create-token")
  );
  if (tokenSource) {
    const tokenDefinition =
      tokenSource.tokenDefinitions?.[0] ||
      { name: "Generic Token", typeLine: "Token Creature", power: 1, toughness: 1 };
    suggestions.push({
      id: `predict-token-${tokenSource.id}`,
      label: "Predictive token action",
      detail: `Add ${tokenDefinition.name} from ${tokenSource.name}.`,
      type: "token",
      confidence: 0.67,
      apply: {
        actionType: "ADD_CUSTOM_TOKEN",
        payload: {
          name: tokenDefinition.name || "Generic Token",
          tokenType: tokenDefinition.typeLine || "Creature",
          power: Number(tokenDefinition.power || tokenDefinition.basePower || 1),
          toughness: Number(tokenDefinition.toughness || tokenDefinition.baseToughness || 1),
          quantity: 1,
          tapped: false,
        },
      },
    });
  }

  if (selected.some((permanent) => permanent.isAura || permanent.isEquipment)) {
    const source = selected.find((permanent) => permanent.isAura || permanent.isEquipment);
    const candidates = getTargets(session, "all-creatures", source).filter((target) => target.controller === source.controller);
    suggestions.push({
      id: "legal-attachments",
      label: "Suggest legal attachment targets",
      detail: `${candidates.length} compatible creature target(s) for ${source.name}.`,
      type: "target",
      confidence: 0.76,
    });
  }

  if ((session.triggerQueue || []).some((entry) => entry.status === "pending")) {
    const pending = (session.triggerQueue || []).filter((entry) => entry.status === "pending").length;
    suggestions.push({
      id: "resolve-pending-triggers",
      label: "Resolve trigger queue",
      detail: `${pending} pending trigger(s) available to resolve now.`,
      type: "trigger",
      confidence: 0.9,
    });
  }

  const bestCounterTarget = playerPermanents
    .filter((permanent) => permanent.isCreature)
    .sort((left, right) => (right.currentPower || 0) + (right.currentToughness || 0) - ((left.currentPower || 0) + (left.currentToughness || 0)))[0];
  if (bestCounterTarget) {
    suggestions.push({
      id: "counter-placement",
      label: "Counter placement",
      detail: `${bestCounterTarget.name} is currently the strongest counter target.`,
      type: "counter",
      confidence: 0.71,
    });
  }

  const commanderDamageTargets = (profile.settings?.multiplayer?.connectedPlayers || []).filter((player) => player.id !== "local-player");
  if (commanderDamageTargets.length) {
    suggestions.push({
      id: "commander-damage-target",
      label: "Commander damage targets",
      detail: `${commanderDamageTargets.length} opponent profile(s) available for commander damage tracking.`,
      type: "combat",
      confidence: 0.73,
    });
  }

  return suggestions.slice(0, 8);
}

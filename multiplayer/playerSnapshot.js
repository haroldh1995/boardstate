import { DEFAULT_FACE_DOWN_LABEL, PUBLIC_COUNTER_KEYS } from "./connectionTypes.js";

export function createPublicPlayerSnapshot({
  appState,
  currentPhase,
  calculateBoardTotals,
  permissions = { canViewFaceDownCards: false },
}) {
  const permanents = Array.isArray(appState?.boardState?.permanents) ? appState.boardState.permanents : [];
  const visibleBoard = createViewerBoardState(
    {
      permanents: permanents.filter((permanent) => !permanent.isNonCreature),
      effects: permanents.filter((permanent) => permanent.isNonCreature),
      currentPhase,
      totalPower: 0,
      totalToughness: 0,
    },
    permissions
  );
  const totals = typeof calculateBoardTotals === "function" ? calculateBoardTotals(permanents) : { power: 0, toughness: 0 };

  return {
    life: normalizeNumber(appState?.life, 40),
    counters: PUBLIC_COUNTER_KEYS.reduce((accumulator, counterKey) => {
      accumulator[counterKey] = normalizeNumber(appState?.playerCounters?.[counterKey]?.value, 0);
      return accumulator;
    }, {}),
    commanderDamage: Array.isArray(appState?.commanderDamageTrackers)
      ? appState.commanderDamageTrackers.map((tracker) => ({
          label: normalizeLabel(tracker?.label, "Opponent"),
          value: normalizeNumber(tracker?.value, 0),
        }))
      : [],
    boardState: {
      ...visibleBoard,
      currentPhase: normalizeLabel(currentPhase, "Upkeep"),
      totalPower: normalizeNumber(totals.power, 0),
      totalToughness: normalizeNumber(totals.toughness, 0),
    },
  };
}

export function createViewerBoardState(publicBoardState, permissions = { canViewFaceDownCards: false }) {
  return {
    permanents: Array.isArray(publicBoardState?.permanents)
      ? publicBoardState.permanents.map((permanent) => sanitizePermanentForViewer(permanent, permissions))
      : [],
    effects: Array.isArray(publicBoardState?.effects)
      ? publicBoardState.effects.map((permanent) => sanitizePermanentForViewer(permanent, permissions))
      : [],
    currentPhase: normalizeLabel(publicBoardState?.currentPhase, "Upkeep"),
    totalPower: normalizeNumber(publicBoardState?.totalPower, 0),
    totalToughness: normalizeNumber(publicBoardState?.totalToughness, 0),
  };
}

export function sanitizePermanentForViewer(permanent, permissions = { canViewFaceDownCards: false }) {
  const normalizedPermanent = {
    ...permanent,
    name: normalizeLabel(permanent?.name, "Permanent"),
    manaCost: normalizeText(permanent?.manaCost),
    typeLine: normalizeText(permanent?.typeLine),
    oracleText: normalizeText(permanent?.oracleText),
    imageUrl: normalizeText(permanent?.imageUrl),
    cardImageUrl: normalizeText(permanent?.cardImageUrl),
    rulingsUri: normalizeText(permanent?.rulingsUri),
    rulings: Array.isArray(permanent?.rulings)
      ? permanent.rulings
          .map((entry) => ({
            source: normalizeLabel(entry?.source, "Scryfall Ruling"),
            publishedAt: normalizeText(entry?.publishedAt),
            comment: normalizeText(entry?.comment),
          }))
          .filter((entry) => entry.comment)
      : [],
    legalities:
      permanent?.legalities && typeof permanent.legalities === "object"
        ? Object.entries(permanent.legalities).reduce((accumulator, [key, value]) => {
            if (typeof value === "string" && value.trim()) {
              accumulator[key] = value.trim();
            }
            return accumulator;
          }, {})
        : {},
    power: normalizeNumber(permanent?.power, 0),
    toughness: normalizeNumber(permanent?.toughness, 0),
    quantity: Math.max(1, normalizeNumber(permanent?.quantity, 1)),
    plusOneCounters: normalizeNumber(permanent?.plusOneCounters, 0),
    isToken: Boolean(permanent?.isToken),
    isNonCreature: Boolean(permanent?.isNonCreature),
    isLegendary: Boolean(permanent?.isLegendary),
    isArtifact: Boolean(permanent?.isArtifact),
    isCreature: Boolean(permanent?.isCreature),
    doublesTokens: Boolean(permanent?.doublesTokens),
    doublesCounters: Boolean(permanent?.doublesCounters),
    counterModifierBonus: normalizeNumber(permanent?.counterModifierBonus, 0),
    createsTokens: Boolean(permanent?.createsTokens),
    addsCounters: Boolean(permanent?.addsCounters),
    staticBuffPower: normalizeNumber(permanent?.staticBuffPower, 0),
    staticBuffToughness: normalizeNumber(permanent?.staticBuffToughness, 0),
    staticBuffAppliesTo: normalizeText(permanent?.staticBuffAppliesTo),
    staticBuffExcludesSelf: Boolean(permanent?.staticBuffExcludesSelf),
    isExpanded: Boolean(permanent?.isExpanded),
    isSelected: false,
    isFaceDown: Boolean(permanent?.isFaceDown),
    faceDownLabel: normalizeLabel(permanent?.faceDownLabel, DEFAULT_FACE_DOWN_LABEL),
    revealAllowed: Boolean(permanent?.revealAllowed),
    isHiddenToOpponents: Boolean(permanent?.isHiddenToOpponents),
    automationRules: Array.isArray(permanent?.automationRules)
      ? permanent.automationRules.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    autoRulesEnabled: permanent?.autoRulesEnabled !== false,
    hasResolvedEtbTriggers: Boolean(permanent?.hasResolvedEtbTriggers),
    notes: normalizeText(permanent?.notes),
    attachedToId: normalizeText(permanent?.attachedToId),
    attachmentKind: normalizeText(permanent?.attachmentKind),
  };

  if (!shouldHideFaceDownPermanent(normalizedPermanent, permissions)) {
    return {
      ...normalizedPermanent,
      isPublicHidden: false,
    };
  }

  return {
    ...normalizedPermanent,
    name: normalizedPermanent.faceDownLabel,
    manaCost: "",
    typeLine: "",
    oracleText: "",
    imageUrl: "",
    cardImageUrl: "",
    rulingsUri: "",
    rulings: [],
    legalities: {},
    power: 0,
    toughness: 0,
    plusOneCounters: 0,
    isCreature: false,
    isArtifact: false,
    isLegendary: false,
    isNonCreature: false,
    doublesCounters: false,
    counterModifierBonus: 0,
    staticBuffPower: 0,
    staticBuffToughness: 0,
    staticBuffAppliesTo: "",
    staticBuffExcludesSelf: false,
    isPublicHidden: true,
  };
}

export function shouldHideFaceDownPermanent(permanent, permissions = { canViewFaceDownCards: false }) {
  return Boolean(
    permanent?.isFaceDown &&
      !permanent?.revealAllowed &&
      !permissions?.canViewFaceDownCards
  );
}

function normalizeNumber(value, fallback) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeLabel(value, fallback) {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

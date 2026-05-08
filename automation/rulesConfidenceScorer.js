export const RULE_CONFIDENCE = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function scoreAutomationRule({
  hasDirectOraclePattern = false,
  usesRulingSupport = false,
  usesRulesReference = false,
  requiresTargetSelection = false,
  isAmbiguous = false,
  mappedPhaseConservatively = false,
  isStaticModifier = false,
} = {}) {
  let score = 0;

  if (hasDirectOraclePattern) {
    score += 3;
  }

  if (usesRulingSupport) {
    score += 2;
  }

  if (usesRulesReference) {
    score += 1;
  }

  if (isStaticModifier) {
    score += 1;
  }

  if (mappedPhaseConservatively) {
    score -= 1;
  }

  if (requiresTargetSelection) {
    score -= 1;
  }

  if (isAmbiguous) {
    score -= 2;
  }

  let confidence = RULE_CONFIDENCE.LOW;
  if (score >= 4 && !isAmbiguous) {
    confidence = RULE_CONFIDENCE.HIGH;
  } else if (score >= 2) {
    confidence = RULE_CONFIDENCE.MEDIUM;
  }

  const requiresConfirmation =
    isAmbiguous || requiresTargetSelection || confidence !== RULE_CONFIDENCE.HIGH;

  return {
    confidence,
    requiresConfirmation,
    defaultEnabled: true,
  };
}

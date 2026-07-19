import { APP_IDS } from "./contracts.js";

const BOARDSTATE_APP_ID = APP_IDS.includes("boardstate")
  ? "boardstate"
  : APP_IDS[0] || "boardstate";

export const MODERNIZATION_FOUNDATION_VERSION =
  "boardstate-commander-modernization-0.1.0";

export const SUPPORTED_COMMANDER_PLAYER_RANGE = Object.freeze({
  min: 2,
  max: 10,
  singlePlayerTrainingAllowed: true,
});

export const COMMANDER_MODERNIZATION_FORMATS = Object.freeze([
  "commander",
  "brawl",
]);

export const COMMANDER_MODERNIZATION_INPUT_MODES = Object.freeze([
  "live-tracking",
  "full-control",
]);

export const BATTLEFIELD_CAMERA_MODES = Object.freeze([
  "follow-active-player",
  "manual",
  "temporary-inspection",
  "focus-lock",
]);

export const BATTLEFIELD_CAMERA_EVENT_PRIORITIES = Object.freeze([
  "local-required-choice",
  "local-priority",
  "combat-involving-local-player",
  "local-object-targeted",
  "focused-player-cast-spell",
  "active-player-changed",
  "manual-focus-lock",
  "manual-inspection",
]);

export const QUESTION_SYSTEM_TYPES = Object.freeze([
  "what",
  "who",
  "when",
  "where",
  "why",
  "how",
  "what-if",
]);

export const INFORMATION_CONFIDENCE_LEVELS = Object.freeze([
  "engine-verified",
  "official-source-imported",
  "trusted-reference-imported",
  "table-ruling",
  "inferred",
  "estimated",
  "unknown",
]);

export const EXECUTION_CONFIDENCE_LEVELS = Object.freeze([
  "engine-validated",
  "parsed-with-warnings",
  "manual-resolution-required",
  "tracking-only",
  "enforcement-waived",
]);

export const RULE_AMENDMENT_APPROVAL_POLICY = Object.freeze({
  approval: "unanimous",
  majorityApprovalAllowed: false,
  minimumPlayers: SUPPORTED_COMMANDER_PLAYER_RANGE.min,
  maximumPlayers: SUPPORTED_COMMANDER_PLAYER_RANGE.max,
});

export const HUB_CONNECTIVITY_STATUS = Object.freeze({
  status: "waiting-for-hub",
  liveConnection: false,
  rulesAuthorityOwner: BOARDSTATE_APP_ID,
});

const UNSAFE_RULE_REFERENCE_PATTERNS = [
  /<\s*script\b/i,
  /\bjavascript\s*:/i,
  /\beval\s*\(/i,
  /\bnew\s+Function\s*\(/i,
  /\bFunction\s*\(/i,
  /\bimport\s*\(/i,
  /\brequire\s*\(/i,
  /\bchild_process\b/i,
  /\bexec\s*\(/i,
  /\bpowershell\b/i,
  /\bcmd\.exe\b/i,
  /```/,
];

export function normalizeCommanderFormat(format = "commander") {
  const normalized = String(format || "commander").trim().toLowerCase();
  return COMMANDER_MODERNIZATION_FORMATS.includes(normalized)
    ? normalized
    : "commander";
}

export function validateCommanderPlayerCount(playerCount, options = {}) {
  const count = Number(playerCount);
  const allowSinglePlayerTraining = Boolean(options.allowSinglePlayerTraining);
  const errors = [];
  const warnings = [];

  if (!Number.isInteger(count)) {
    errors.push("Player count must be an integer.");
  } else if (count === 1 && allowSinglePlayerTraining) {
    warnings.push("Single-player training is allowed, but supported Commander sessions require two to ten players.");
  } else if (count < SUPPORTED_COMMANDER_PLAYER_RANGE.min) {
    errors.push("Commander and Brawl sessions require at least two players.");
  } else if (count > SUPPORTED_COMMANDER_PLAYER_RANGE.max) {
    errors.push("Commander and Brawl sessions support at most ten players.");
  }

  return {
    valid: errors.length === 0,
    status: errors.length ? "invalid" : warnings.length ? "valid-with-warnings" : "valid",
    playerCount: Number.isFinite(count) ? count : playerCount,
    minimumPlayers: SUPPORTED_COMMANDER_PLAYER_RANGE.min,
    maximumPlayers: SUPPORTED_COMMANDER_PLAYER_RANGE.max,
    errors,
    warnings,
  };
}

export function validateRuleAmendmentApproval(players = [], approvals = []) {
  const playerIds = players
    .map((player) => (typeof player === "string" ? player : player?.id || player?.playerId))
    .filter(Boolean);
  const approvalIds = new Set(
    approvals
      .map((approval) =>
        typeof approval === "string"
          ? approval
          : approval?.playerId || approval?.id || approval?.approvedBy
      )
      .filter(Boolean)
  );
  const missingApprovals = playerIds.filter((playerId) => !approvalIds.has(playerId));
  const playerCountReport = validateCommanderPlayerCount(playerIds.length);

  return {
    valid: playerCountReport.valid && missingApprovals.length === 0,
    approvalPolicy: RULE_AMENDMENT_APPROVAL_POLICY.approval,
    majorityApprovalAllowed: false,
    playerCount: playerIds.length,
    approvalCount: approvalIds.size,
    missingApprovals,
    errors: playerCountReport.valid
      ? []
      : playerCountReport.errors,
  };
}

export function isSafeRuleReferenceImportPayload(value = "") {
  if (typeof value !== "string") {
    return {
      valid: false,
      reason: "Rule reference imports must be plain text.",
    };
  }

  if (value.length > 250_000) {
    return {
      valid: false,
      reason: "Rule reference import text is too large for local review.",
    };
  }

  const matchedPattern = UNSAFE_RULE_REFERENCE_PATTERNS.find((pattern) =>
    pattern.test(value)
  );
  if (matchedPattern) {
    return {
      valid: false,
      reason: "Rule reference import text contains executable or script-like content.",
    };
  }

  return {
    valid: true,
    reason: "Plain text rule reference is safe to preserve for review.",
  };
}

export function createModernizationCapabilityReport(input = {}) {
  return {
    appId: BOARDSTATE_APP_ID,
    appName: "BoardState",
    foundationVersion: MODERNIZATION_FOUNDATION_VERSION,
    supportedFormats: [...COMMANDER_MODERNIZATION_FORMATS],
    supportedPlayerRange: { ...SUPPORTED_COMMANDER_PLAYER_RANGE },
    supportedInputModes: [...COMMANDER_MODERNIZATION_INPUT_MODES],
    battlefieldCameraModes: [...BATTLEFIELD_CAMERA_MODES],
    cameraEventPriorityOrder: [...BATTLEFIELD_CAMERA_EVENT_PRIORITIES],
    questionTypes: [...QUESTION_SYSTEM_TYPES],
    informationConfidenceLevels: [...INFORMATION_CONFIDENCE_LEVELS],
    executionConfidenceLevels: [...EXECUTION_CONFIDENCE_LEVELS],
    ruleAmendmentPolicy: { ...RULE_AMENDMENT_APPROVAL_POLICY },
    rulesAuthorityOwner: BOARDSTATE_APP_ID,
    hubConnectivity: { ...HUB_CONNECTIVITY_STATUS },
    liveExternalLinks: {
      boardstateLite: false,
      deckNexus: false,
      boardstateHub: false,
    },
    currentRuntime: {
      isRulesAuthority: true,
      preservesExistingBattlefieldIdentity: true,
      commanderBrawlExclusivePreparation: true,
      liveTrackingPrepared: true,
      fullControlPrepared: true,
      ...input.currentRuntime,
    },
  };
}

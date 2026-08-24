import { isSafeRuleReferenceImportPayload } from "../shared-contracts/commanderModernization.js";

export const RULES_RECOVERY_VERSION = "boardstate-rules-recovery-1.0.0";

export const RULE_REFERENCE_KINDS = Object.freeze([
  "official-rules",
  "oracle",
  "gatherer-ruling",
  "scryfall-ruling",
  "release-notes",
  "judge-reference",
  "table-interpretation",
]);

export const RECOVERY_OPERATION_KINDS = Object.freeze([
  "clarify-timing",
  "clarify-zone-change",
  "identify-required-choice",
  "request-manual-information",
  "record-table-interpretation",
  "resume-existing-effect",
]);

export const RECOVERY_CASE_STATUSES = Object.freeze([
  "open",
  "waiting-for-information",
  "waiting-for-table-approval",
  "ready-to-resume",
  "resolved",
  "rejected",
]);

const MAX_REFERENCE_TEXT = 60_000;
const MAX_REFERENCES = 120;
const MAX_CASES = 120;
const MAX_HISTORY = 480;
const RESOLVED_EFFECT_STATUSES = new Set(["resolved", "skipped", "ignored", "cancelled", "completed"]);

export function createRulesRecoveryState(input = {}) {
  const references = normalizeUniqueRecords(input.references, normalizeRuleReference, "referenceId", MAX_REFERENCES);
  const cases = normalizeUniqueRecords(input.cases, normalizeRecoveryCase, "recoveryCaseId", MAX_CASES);
  const history = (Array.isArray(input.history) ? input.history : [])
    .map(normalizeRecoveryHistoryEntry)
    .filter(Boolean)
    .slice(0, MAX_HISTORY);
  return {
    version: RULES_RECOVERY_VERSION,
    officialRulesRemainAuthoritative: true,
    importedTextIsExecutable: false,
    constrainedOperationsOnly: true,
    requiresExplicitPlayerDecision: true,
    references,
    cases,
    history,
    openCaseCount: cases.filter((entry) => !["resolved", "rejected"].includes(entry.status)).length,
  };
}

export function importRuleReference(stateInput = {}, input = {}) {
  const state = createRulesRecoveryState(stateInput);
  const validation = validateRuleReferenceImport(input);
  if (!validation.valid) {
    return {
      state,
      accepted: false,
      reference: null,
      errors: validation.errors,
    };
  }
  const createdAt = normalizeTimestamp(input.createdAt);
  const reference = normalizeRuleReference({
    referenceId: input.referenceId || createStableId("rule-reference", `${validation.kind}|${validation.title}|${validation.text}|${createdAt}`),
    kind: validation.kind,
    title: validation.title,
    text: validation.text,
    citation: validation.citation,
    sourceAuthority: sourceAuthority(validation.kind),
    importedAt: createdAt,
    importedByPlayerId: sanitizeIdentifier(input.importedByPlayerId || input.playerId || "local-player"),
    plainTextOnly: true,
    executable: false,
    approvedOperations: [],
  });
  const historyEntry = createRecoveryHistoryEntry({
    type: "reference-imported",
    referenceId: reference.referenceId,
    playerId: reference.importedByPlayerId,
    summary: `${reference.kind}: ${reference.title}`,
    createdAt,
  });
  return {
    accepted: true,
    reference,
    errors: [],
    state: createRulesRecoveryState({
      ...state,
      references: [reference, ...state.references.filter((entry) => entry.referenceId !== reference.referenceId)],
      history: [historyEntry, ...state.history],
    }),
  };
}

export function validateRuleReferenceImport(input = {}) {
  const rawText = typeof input.text === "string" ? input.text : input.sourceText;
  const safety = isSafeRuleReferenceImportPayload(rawText);
  const text = sanitizePlainText(rawText, MAX_REFERENCE_TEXT);
  const title = sanitizePlainText(input.title || input.sourceTitle || "Imported rules reference", 180);
  const kind = normalizeAllowed(input.kind || input.sourceKind, RULE_REFERENCE_KINDS, "table-interpretation");
  const citation = sanitizeCitation(input.citation || input.sourceUrl || "");
  const errors = [
    safety.valid ? "" : safety.reason,
    text ? "" : "Rule reference text is required.",
    rawText?.length > MAX_REFERENCE_TEXT ? `Rule reference text must be ${MAX_REFERENCE_TEXT.toLocaleString()} characters or fewer.` : "",
    citation.valid ? "" : citation.reason,
  ].filter(Boolean);
  return {
    valid: errors.length === 0,
    errors,
    kind,
    title,
    text,
    citation: citation.value,
    plainTextOnly: true,
    executable: false,
  };
}

export function openRulesRecoveryCase(stateInput = {}, input = {}, session = {}) {
  const state = createRulesRecoveryState(stateInput);
  const pendingEffect = resolvePendingEffect(session, input.pendingEffectId || input.effectId);
  const createdAt = normalizeTimestamp(input.createdAt);
  const sourceId = sanitizeIdentifier(input.sourceId || pendingEffect?.sourceId || pendingEffect?.cardId || "");
  const sourceName = sanitizePlainText(input.sourceName || pendingEffect?.sourceName || pendingEffect?.name || "Unknown effect", 180);
  const question = sanitizePlainText(
    input.question || pendingEffect?.reason || pendingEffect?.summary || pendingEffect?.effect?.text || "What player or table information is required to continue this effect?",
    1200
  );
  const recoveryCaseId = sanitizeIdentifier(input.recoveryCaseId) || createStableId("rules-recovery", `${sourceId}|${pendingEffect?.id || ""}|${question}|${createdAt}`);
  const existing = state.cases.find((entry) => entry.recoveryCaseId === recoveryCaseId);
  if (existing) return { state, recoveryCase: existing, created: false, errors: [] };
  const recoveryCase = normalizeRecoveryCase({
    recoveryCaseId,
    status: input.status || "waiting-for-information",
    sourceId,
    sourceName,
    pendingEffectId: sanitizeIdentifier(input.pendingEffectId || pendingEffect?.id || ""),
    stackObjectId: sanitizeIdentifier(input.stackObjectId || pendingEffect?.stackObjectId || ""),
    eventId: sanitizeIdentifier(input.eventId || pendingEffect?.eventId || ""),
    question,
    requiredInformation: sanitizePlainText(input.requiredInformation || inferRequiredInformation(pendingEffect), 600),
    mandatory: input.mandatory !== undefined ? Boolean(input.mandatory) : pendingEffect?.optional !== true,
    confidence: normalizeConfidence(input.confidence || pendingEffect?.rulesConfidence || "manual-resolution-required"),
    referenceIds: normalizeIdentifiers(input.referenceIds),
    proposedOperation: normalizeAllowed(input.proposedOperation, RECOVERY_OPERATION_KINDS, "request-manual-information"),
    proposedInput: "",
    createdAt,
    createdByPlayerId: sanitizeIdentifier(input.createdByPlayerId || input.playerId || "local-player"),
    updatedAt: createdAt,
    revision: 1,
  });
  const historyEntry = createRecoveryHistoryEntry({
    type: "recovery-case-opened",
    recoveryCaseId,
    pendingEffectId: recoveryCase.pendingEffectId,
    playerId: recoveryCase.createdByPlayerId,
    summary: `${recoveryCase.sourceName}: ${recoveryCase.question}`,
    createdAt,
  });
  return {
    created: true,
    recoveryCase,
    errors: [],
    state: createRulesRecoveryState({
      ...state,
      cases: [recoveryCase, ...state.cases],
      history: [historyEntry, ...state.history],
    }),
  };
}

export function reviseRulesRecoveryCase(stateInput = {}, recoveryCaseId = "", input = {}) {
  const state = createRulesRecoveryState(stateInput);
  const existing = state.cases.find((entry) => entry.recoveryCaseId === recoveryCaseId);
  if (!existing) return { state, recoveryCase: null, updated: false, errors: ["Rules Recovery case was not found."] };
  const proposedInput = sanitizePlainText(input.proposedInput || input.answer || "", 1600);
  const operation = normalizeAllowed(input.operation || existing.proposedOperation, RECOVERY_OPERATION_KINDS, existing.proposedOperation);
  const status = normalizeAllowed(
    input.status || (proposedInput ? "ready-to-resume" : existing.status),
    RECOVERY_CASE_STATUSES,
    existing.status
  );
  const updatedAt = normalizeTimestamp(input.updatedAt);
  const recoveryCase = normalizeRecoveryCase({
    ...existing,
    status,
    proposedOperation: operation,
    proposedInput,
    referenceIds: input.referenceIds ? normalizeIdentifiers(input.referenceIds) : existing.referenceIds,
    updatedAt,
    revision: existing.revision + 1,
  });
  const historyEntry = createRecoveryHistoryEntry({
    type: input.historyType || "recovery-case-revised",
    recoveryCaseId,
    pendingEffectId: recoveryCase.pendingEffectId,
    playerId: input.playerId || existing.createdByPlayerId,
    summary: `${operation}: ${proposedInput || "Recovery case status updated."}`,
    createdAt: updatedAt,
  });
  return {
    updated: true,
    recoveryCase,
    errors: [],
    state: createRulesRecoveryState({
      ...state,
      cases: [recoveryCase, ...state.cases.filter((entry) => entry.recoveryCaseId !== recoveryCaseId)],
      history: [historyEntry, ...state.history],
    }),
  };
}

export function createRecoveryContinuation(stateInput = {}, recoveryCaseId = "") {
  const state = createRulesRecoveryState(stateInput);
  const recoveryCase = state.cases.find((entry) => entry.recoveryCaseId === recoveryCaseId) || null;
  const valid = Boolean(
    recoveryCase &&
    recoveryCase.pendingEffectId &&
    recoveryCase.status === "ready-to-resume" &&
    recoveryCase.proposedInput
  );
  return deepFreeze({
    version: RULES_RECOVERY_VERSION,
    valid,
    errors: valid ? [] : ["A ready Rules Recovery case with explicit player input is required."],
    intent: valid ? {
      actionType: "MARK_PENDING_EFFECT",
      id: recoveryCase.pendingEffectId,
      status: "resolved",
      choiceValue: recoveryCase.proposedInput,
      rulesRecoveryCaseId: recoveryCase.recoveryCaseId,
      semanticOperation: recoveryCase.proposedOperation,
      requiresExplicitPlayerConfirmation: true,
    } : null,
    executesRules: false,
    mutatesAuthoritativeState: false,
    importedTextIsExecutable: false,
  });
}

export function searchRuleReferences(stateInput = {}, query = "", options = {}) {
  const state = createRulesRecoveryState(stateInput);
  const terms = sanitizePlainText(query, 240).toLowerCase().split(/\s+/).filter(Boolean);
  const limit = clampInteger(options.limit, 1, 30, 12);
  if (!terms.length) return state.references.slice(0, limit);
  return state.references
    .map((entry) => ({
      entry,
      score: terms.reduce((score, term) => {
        const title = entry.title.toLowerCase();
        const text = entry.text.toLowerCase();
        const kind = entry.kind.toLowerCase();
        return score + (title.includes(term) ? 8 : 0) + (kind.includes(term) ? 4 : 0) + (text.includes(term) ? 1 : 0);
      }, 0),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || right.entry.importedAt - left.entry.importedAt)
    .slice(0, limit)
    .map((result) => result.entry);
}

function normalizeRuleReference(input = {}) {
  if (!input?.referenceId && !input?.text) return null;
  return {
    referenceId: sanitizeIdentifier(input.referenceId) || createStableId("rule-reference", input.text),
    version: RULES_RECOVERY_VERSION,
    kind: normalizeAllowed(input.kind, RULE_REFERENCE_KINDS, "table-interpretation"),
    title: sanitizePlainText(input.title || "Imported rules reference", 180),
    text: sanitizePlainText(input.text, MAX_REFERENCE_TEXT),
    citation: sanitizeCitation(input.citation).value,
    sourceAuthority: sourceAuthority(input.kind),
    importedAt: Number(input.importedAt || 0),
    importedByPlayerId: sanitizeIdentifier(input.importedByPlayerId || ""),
    plainTextOnly: true,
    executable: false,
    approvedOperations: [],
  };
}

function normalizeRecoveryCase(input = {}) {
  if (!input?.recoveryCaseId) return null;
  return {
    recoveryCaseId: sanitizeIdentifier(input.recoveryCaseId),
    version: RULES_RECOVERY_VERSION,
    status: normalizeAllowed(input.status, RECOVERY_CASE_STATUSES, "open"),
    sourceId: sanitizeIdentifier(input.sourceId),
    sourceName: sanitizePlainText(input.sourceName || "Unknown effect", 180),
    pendingEffectId: sanitizeIdentifier(input.pendingEffectId),
    stackObjectId: sanitizeIdentifier(input.stackObjectId),
    eventId: sanitizeIdentifier(input.eventId),
    question: sanitizePlainText(input.question, 1200),
    requiredInformation: sanitizePlainText(input.requiredInformation, 600),
    mandatory: input.mandatory !== false,
    confidence: normalizeConfidence(input.confidence),
    referenceIds: normalizeIdentifiers(input.referenceIds),
    proposedOperation: normalizeAllowed(input.proposedOperation, RECOVERY_OPERATION_KINDS, "request-manual-information"),
    proposedInput: sanitizePlainText(input.proposedInput, 1600),
    createdAt: Number(input.createdAt || 0),
    createdByPlayerId: sanitizeIdentifier(input.createdByPlayerId),
    updatedAt: Number(input.updatedAt || input.createdAt || 0),
    revision: Math.max(1, Number(input.revision || 1)),
    importedTextIsExecutable: false,
    appliesAutomatically: false,
  };
}

function normalizeRecoveryHistoryEntry(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    historyId: sanitizeIdentifier(input.historyId) || createStableId("recovery-event", `${input.type}|${input.recoveryCaseId}|${input.referenceId}|${input.createdAt}`),
    version: RULES_RECOVERY_VERSION,
    type: sanitizePlainText(input.type || "recovery-event", 80),
    recoveryCaseId: sanitizeIdentifier(input.recoveryCaseId),
    referenceId: sanitizeIdentifier(input.referenceId),
    pendingEffectId: sanitizeIdentifier(input.pendingEffectId),
    playerId: sanitizeIdentifier(input.playerId),
    summary: sanitizePlainText(input.summary, 600),
    createdAt: Number(input.createdAt || 0),
    immutableRecord: true,
  };
}

function createRecoveryHistoryEntry(input) {
  return normalizeRecoveryHistoryEntry({ ...input, historyId: input.historyId || createStableId("recovery-event", `${input.type}|${input.recoveryCaseId}|${input.referenceId}|${input.createdAt}`) });
}

function resolvePendingEffect(session = {}, pendingEffectId = "") {
  const id = String(pendingEffectId || "");
  if (!id) return null;
  return (session.pendingEffects || []).find((entry) =>
    entry?.id === id && !RESOLVED_EFFECT_STATUSES.has(String(entry.status || "").toLowerCase())
  ) || null;
}

function inferRequiredInformation(pendingEffect) {
  if (!pendingEffect) return "Player or table confirmation is required before BoardState can continue safely.";
  if (pendingEffect.effect?.choiceKind === "targets") return "Select the legal target or targets required by this effect.";
  if (pendingEffect.effect?.optional || pendingEffect.optional) return "Confirm whether the optional effect will be used.";
  return pendingEffect.reason || "Supply the missing manual information requested by this effect.";
}

function sourceAuthority(kind = "") {
  switch (kind) {
    case "official-rules": return "official";
    case "oracle":
    case "gatherer-ruling":
    case "scryfall-ruling":
    case "release-notes": return "published-reference";
    case "judge-reference": return "trusted-secondary";
    default: return "table-supplied";
  }
}

function sanitizeCitation(value = "") {
  const raw = sanitizePlainText(value, 1000);
  if (!raw) return { valid: true, value: "", reason: "" };
  if (/^(?:javascript|data|vbscript|file|http):/i.test(raw)) {
    return { valid: false, value: "", reason: "Rule reference citation must not use an unsafe or insecure URL scheme." };
  }
  if (/^(https:\/\/|urn:|cr:|oracle:|gatherer:|scryfall:)/i.test(raw) && !/[<>"'`\s]/.test(raw)) {
    return { valid: true, value: raw, reason: "" };
  }
  if (/^[\w .,:;()#\/-]+$/.test(raw)) return { valid: true, value: raw, reason: "" };
  return { valid: false, value: "", reason: "Rule reference citation must be a safe HTTPS URL or plain reference label." };
}

function sanitizePlainText(value = "", maximum = 1400) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/<\/?(?:script|style|iframe|object|embed)[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function sanitizeIdentifier(value = "") {
  return String(value || "").trim().replace(/[^\w:.-]/g, "_").slice(0, 180);
}

function normalizeIdentifiers(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.map(sanitizeIdentifier).filter(Boolean))].slice(0, 80);
}

function normalizeUniqueRecords(value, normalizer, key, limit) {
  const records = Array.isArray(value) ? value : [];
  const seen = new Set();
  return records.map(normalizer).filter((entry) => {
    if (!entry?.[key] || seen.has(entry[key])) return false;
    seen.add(entry[key]);
    return true;
  }).slice(0, limit);
}

function normalizeAllowed(value, allowed, fallback) {
  const normalized = String(value || "").toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeConfidence(value = "manual-resolution-required") {
  const normalized = String(value || "").toLowerCase();
  if (["engine-verified", "published-reference", "trusted-secondary", "table-ruling", "low-confidence", "unsupported", "manual-resolution-required"].includes(normalized)) return normalized;
  return "manual-resolution-required";
}

function normalizeTimestamp(value) {
  const timestamp = Number(value || Date.now());
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function createStableId(prefix, value) {
  let hash = 2166136261;
  const source = String(value || "");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

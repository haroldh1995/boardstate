export const CANONICAL_SCRYFALL_SEARCH_VERSION = "boardstate-scryfall-popup-13.3.0";

export const SCRYFALL_SEARCH_STATUS = Object.freeze({
  closed: "closed",
  deferred: "deferred",
  open: "open",
  suspended: "suspended",
});

export const SCRYFALL_SEARCH_CONTEXTS = Object.freeze({
  battlefield: "battlefield",
  deck: "deck",
  commander: "commander",
  library: "library",
  token: "token",
  replacement: "replacement",
});

export const SCRYFALL_CRITICAL_PRESENTATIONS = Object.freeze([
  "cast",
  "spell-cast",
  "resolve",
  "resolved-permanent",
  "entered-battlefield",
  "destroy",
  "exile",
  "bounce",
  "transform",
  "major-token-creation",
  "major-counter-change",
  "combat",
  "combat-declaration",
  "combat-damage",
  "board-wipe",
  "commander-arrival",
  "stack-resolution",
]);

const MANDATORY_ATTENTION_OWNERS = new Set([
  "mandatory-current-player-decision",
  "critical-rules-state",
]);

const CRITICAL_ATTENTION_OWNERS = new Set([
  ...MANDATORY_ATTENTION_OWNERS,
  "active-casting-resolution",
  "active-combat",
  "active-stack-priority",
]);

export function createScryfallSearchState(input = {}) {
  return {
    version: CANONICAL_SCRYFALL_SEARCH_VERSION,
    status: SCRYFALL_SEARCH_STATUS.closed,
    context: normalizeContext(input.context),
    requestedOpen: false,
    openRevision: Math.max(0, Number(input.openRevision || 0)),
    query: String(input.query || ""),
    queryRevision: 0,
    requestId: "",
    loading: false,
    results: [],
    selectedCardId: "",
    message: "Start typing to search Scryfall.",
    error: "",
    suspendedReason: "",
    resumeAfterCriticalPresentation: false,
    mandatoryDecisionSuperseded: false,
    pendingAction: null,
    completedActionIds: [],
  };
}

export function requestScryfallSearchOpen(state = createScryfallSearchState(), context = {}) {
  const next = normalizeState(state);
  const attention = resolveSearchAttention(context);
  const searchContext = normalizeContext(context.searchContext || next.context);
  const openRevision = next.requestedOpen ? next.openRevision : next.openRevision + 1;
  if (attention.critical) {
    return {
      ...next,
      status: SCRYFALL_SEARCH_STATUS.deferred,
      context: searchContext,
      requestedOpen: true,
      openRevision,
      suspendedReason: attention.reason,
      resumeAfterCriticalPresentation: true,
      mandatoryDecisionSuperseded: attention.mandatory,
    };
  }
  return {
    ...next,
    status: SCRYFALL_SEARCH_STATUS.open,
    context: searchContext,
    requestedOpen: true,
    openRevision,
    suspendedReason: "",
    resumeAfterCriticalPresentation: false,
    mandatoryDecisionSuperseded: false,
  };
}

export function closeScryfallSearch(state = createScryfallSearchState(), options = {}) {
  const next = normalizeState(state);
  return {
    ...next,
    status: SCRYFALL_SEARCH_STATUS.closed,
    requestedOpen: false,
    selectedCardId: options.preserveSelection ? next.selectedCardId : "",
    suspendedReason: "",
    resumeAfterCriticalPresentation: false,
    mandatoryDecisionSuperseded: false,
    pendingAction: null,
  };
}

export function reconcileScryfallSearchPresentation(state = createScryfallSearchState(), context = {}) {
  const next = normalizeState(state);
  const attention = resolveSearchAttention(context);
  if (next.status === SCRYFALL_SEARCH_STATUS.open && attention.critical) {
    return {
      ...next,
      status: SCRYFALL_SEARCH_STATUS.suspended,
      suspendedReason: attention.reason,
      resumeAfterCriticalPresentation: true,
      mandatoryDecisionSuperseded: attention.mandatory,
    };
  }
  if (![SCRYFALL_SEARCH_STATUS.deferred, SCRYFALL_SEARCH_STATUS.suspended].includes(next.status)) {
    return next;
  }
  if (attention.critical) {
    return {
      ...next,
      mandatoryDecisionSuperseded: next.mandatoryDecisionSuperseded || attention.mandatory,
      suspendedReason: attention.reason,
    };
  }
  if (next.mandatoryDecisionSuperseded || context.searchStillRelevant === false || !next.requestedOpen) {
    return closeScryfallSearch(next, { preserveSelection: true });
  }
  return {
    ...next,
    status: SCRYFALL_SEARCH_STATUS.open,
    suspendedReason: "",
    resumeAfterCriticalPresentation: false,
  };
}

export function updateScryfallSearchQuery(state = createScryfallSearchState(), query = "") {
  const next = normalizeState(state);
  const normalizedQuery = String(query || "");
  const queryRevision = next.queryRevision + 1;
  return {
    ...next,
    query: normalizedQuery,
    queryRevision,
    requestId: "",
    loading: false,
    results: normalizedQuery.trim().length < 2 ? [] : next.results,
    selectedCardId: "",
    message: normalizedQuery.trim().length < 2 ? "Type at least two characters." : "Ready to search.",
    error: "",
    pendingAction: null,
  };
}

export function beginScryfallSearchRequest(state = createScryfallSearchState()) {
  const next = normalizeState(state);
  const normalizedQuery = next.query.trim();
  if (normalizedQuery.length < 2) {
    return next;
  }
  const requestId = `scryfall:${next.queryRevision}:${normalizeIdentity(normalizedQuery)}`;
  return {
    ...next,
    requestId,
    loading: true,
    results: [],
    selectedCardId: "",
    message: "Searching Scryfall...",
    error: "",
  };
}

export function acceptScryfallSearchResults(state = createScryfallSearchState(), payload = {}) {
  const next = normalizeState(state);
  if (!payload.requestId || payload.requestId !== next.requestId) {
    return next;
  }
  const results = dedupeCards(payload.results || []);
  return {
    ...next,
    loading: false,
    results,
    selectedCardId: results.some((card) => canonicalCardId(card) === next.selectedCardId) ? next.selectedCardId : "",
    message: results.length ? `${Math.min(3, results.length)} predictive result${Math.min(3, results.length) === 1 ? "" : "s"}` : "No cards found.",
    error: "",
  };
}

export function failScryfallSearchRequest(state = createScryfallSearchState(), payload = {}) {
  const next = normalizeState(state);
  if (!payload.requestId || payload.requestId !== next.requestId) {
    return next;
  }
  return {
    ...next,
    loading: false,
    results: Array.isArray(payload.fallbackResults) ? dedupeCards(payload.fallbackResults) : next.results,
    message: "Search is unavailable. Your game and query are preserved.",
    error: String(payload.error || "Scryfall unavailable"),
  };
}

export function selectScryfallSearchResult(state = createScryfallSearchState(), cardId = "") {
  const next = normalizeState(state);
  const selectedCardId = String(cardId || "");
  if (!selectedCardId) {
    return {
      ...next,
      selectedCardId: "",
      pendingAction: null,
    };
  }
  if (!next.results.some((card) => canonicalCardId(card) === selectedCardId)) {
    return next;
  }
  return {
    ...next,
    selectedCardId,
    pendingAction: null,
  };
}

export function getPredictiveScryfallResults(state = createScryfallSearchState(), limit = 3) {
  return normalizeState(state).results.slice(0, Math.max(1, Number(limit) || 3));
}

export function beginScryfallSearchAction(state = createScryfallSearchState(), action = {}) {
  const next = normalizeState(state);
  const cardId = String(action.cardId || next.selectedCardId || "");
  const actionType = String(action.actionType || "select");
  const actionId = String(action.actionId || createScryfallSearchActionIdentity(next, { ...action, cardId, actionType }));
  if (!cardId || next.completedActionIds.includes(actionId) || next.pendingAction?.actionId === actionId) {
    return { state: next, accepted: false, actionId };
  }
  return {
    accepted: true,
    actionId,
    state: {
      ...next,
      pendingAction: {
        actionId,
        actionType,
        cardId,
        semanticIntent: action.semanticIntent || actionType,
      },
    },
  };
}

export function createScryfallSearchActionIdentity(state = createScryfallSearchState(), action = {}) {
  const next = normalizeState(state);
  const actionType = normalizeIdentity(action.actionType || "select");
  const cardId = normalizeIdentity(action.cardId || next.selectedCardId || "card");
  const semanticIntent = normalizeIdentity(action.semanticIntent || actionType);
  return `scryfall-action:${next.openRevision}:${next.queryRevision}:${actionType}:${cardId}:${semanticIntent}`;
}

export function completeScryfallSearchAction(state = createScryfallSearchState(), actionId = "") {
  const next = normalizeState(state);
  const normalizedId = String(actionId || next.pendingAction?.actionId || "");
  if (!normalizedId) return next;
  return {
    ...next,
    pendingAction: null,
    completedActionIds: [...new Set([...next.completedActionIds, normalizedId])].slice(-80),
  };
}

export function resolveSearchAttention(context = {}) {
  const attentionOwner = String(context.attentionOwner || "");
  const presentationKind = String(context.presentationKind || context.presentation?.kind || "").toLowerCase();
  const explicitCritical = Boolean(context.criticalAnimationActive);
  const mandatory = Boolean(context.mandatoryDecision || MANDATORY_ATTENTION_OWNERS.has(attentionOwner));
  const critical = Boolean(
    explicitCritical ||
    mandatory ||
    CRITICAL_ATTENTION_OWNERS.has(attentionOwner) ||
    SCRYFALL_CRITICAL_PRESENTATIONS.includes(presentationKind)
  );
  return {
    critical,
    mandatory,
    reason: mandatory
      ? "mandatory-gameplay-decision"
      : presentationKind
        ? `critical-presentation:${presentationKind}`
        : critical
          ? `critical-attention:${attentionOwner || "gameplay"}`
          : "safe",
  };
}

function normalizeState(state = {}) {
  const base = createScryfallSearchState(state);
  return {
    ...base,
    ...state,
    version: CANONICAL_SCRYFALL_SEARCH_VERSION,
    context: normalizeContext(state.context),
    openRevision: Math.max(0, Number(state.openRevision || 0)),
    results: Array.isArray(state.results) ? state.results : [],
    completedActionIds: Array.isArray(state.completedActionIds) ? state.completedActionIds : [],
  };
}

function normalizeContext(context = "") {
  const normalized = String(context || "").trim().toLowerCase();
  return Object.values(SCRYFALL_SEARCH_CONTEXTS).includes(normalized)
    ? normalized
    : SCRYFALL_SEARCH_CONTEXTS.battlefield;
}

function canonicalCardId(card = {}) {
  return String(card.cardId || card.oracleId || card.id || card.name || "");
}

function dedupeCards(cards = []) {
  const seen = new Set();
  return cards.filter((card) => {
    const id = canonicalCardId(card);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeIdentity(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

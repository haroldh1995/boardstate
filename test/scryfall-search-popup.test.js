import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_SCRYFALL_SEARCH_VERSION,
  SCRYFALL_SEARCH_STATUS,
  acceptScryfallSearchResults,
  beginScryfallSearchAction,
  beginScryfallSearchRequest,
  closeScryfallSearch,
  completeScryfallSearchAction,
  createScryfallSearchState,
  getPredictiveScryfallResults,
  reconcileScryfallSearchPresentation,
  requestScryfallSearchOpen,
  selectScryfallSearchResult,
  updateScryfallSearchQuery,
} from "../src/gameplay/scryfallSearchModel.js";
import { resolveGameplayAttentionOwner } from "../src/gameplay/cardLifecycle.js";

test("canonical search opens immediately when gameplay corridor is clear", () => {
  const state = requestScryfallSearchOpen(createScryfallSearchState(), {
    searchContext: "battlefield",
    attentionOwner: "relevant-contextual-command",
  });
  assert.equal(state.version, CANONICAL_SCRYFALL_SEARCH_VERSION);
  assert.equal(state.status, SCRYFALL_SEARCH_STATUS.open);
  assert.equal(state.requestedOpen, true);
});

test("casting and board-wipe presentations defer search without losing the request", () => {
  for (const presentationKind of ["spell-cast", "board-wipe"]) {
    const deferred = requestScryfallSearchOpen(createScryfallSearchState({ query: "Sol" }), {
      presentationKind,
    });
    assert.equal(deferred.status, SCRYFALL_SEARCH_STATUS.deferred);
    assert.equal(deferred.requestedOpen, true);
    assert.equal(deferred.query, "Sol");

    const restored = reconcileScryfallSearchPresentation(deferred, {
      attentionOwner: "relevant-contextual-command",
      searchStillRelevant: true,
    });
    assert.equal(restored.status, SCRYFALL_SEARCH_STATUS.open);
    assert.equal(restored.query, "Sol");
  }
});

test("an open search suspends for critical gameplay and does not reopen over a mandatory decision", () => {
  let state = requestScryfallSearchOpen(createScryfallSearchState({ query: "Wrath" }));
  state = reconcileScryfallSearchPresentation(state, { presentationKind: "board-wipe" });
  assert.equal(state.status, SCRYFALL_SEARCH_STATUS.suspended);
  assert.equal(state.query, "Wrath");

  state = reconcileScryfallSearchPresentation(state, {
    attentionOwner: "mandatory-current-player-decision",
    mandatoryDecision: true,
  });
  assert.equal(state.mandatoryDecisionSuperseded, true);

  state = reconcileScryfallSearchPresentation(state, { attentionOwner: "relevant-contextual-command" });
  assert.equal(state.status, SCRYFALL_SEARCH_STATUS.closed);
  assert.equal(state.query, "Wrath");
});

test("predictive requests reject stale responses and expose three immediate results", () => {
  let state = requestScryfallSearchOpen(createScryfallSearchState());
  state = updateScryfallSearchQuery(state, "Sol");
  state = beginScryfallSearchRequest(state);
  const staleRequestId = state.requestId;
  state = updateScryfallSearchQuery(state, "Solemn");
  state = beginScryfallSearchRequest(state);
  const currentRequestId = state.requestId;

  const stale = acceptScryfallSearchResults(state, {
    requestId: staleRequestId,
    results: [{ cardId: "stale", name: "Stale Card" }],
  });
  assert.equal(stale.results.length, 0);

  state = acceptScryfallSearchResults(state, {
    requestId: currentRequestId,
    results: [
      { cardId: "a", name: "A" },
      { cardId: "b", name: "B" },
      { cardId: "c", name: "C" },
      { cardId: "d", name: "D" },
    ],
  });
  assert.equal(state.results.length, 4);
  assert.deepEqual(getPredictiveScryfallResults(state).map((card) => card.name), ["A", "B", "C"]);
});

test("selection and confirmation are deliberate and duplicate action identity is rejected", () => {
  let state = createScryfallSearchState({ query: "Sol Ring" });
  state = requestScryfallSearchOpen(state);
  state = updateScryfallSearchQuery(state, "Sol Ring");
  state = beginScryfallSearchRequest(state);
  state = acceptScryfallSearchResults(state, {
    requestId: state.requestId,
    results: [{ cardId: "sol-ring", name: "Sol Ring" }],
  });
  state = selectScryfallSearchResult(state, "sol-ring");
  assert.equal(state.selectedCardId, "sol-ring");

  const first = beginScryfallSearchAction(state, {
    actionId: "cast:sol-ring:event-1",
    actionType: "cast",
  });
  assert.equal(first.accepted, true);
  state = completeScryfallSearchAction(first.state, first.actionId);

  const duplicate = beginScryfallSearchAction(state, {
    actionId: "cast:sol-ring:event-1",
    actionType: "cast",
  });
  assert.equal(duplicate.accepted, false);
  assert.equal(closeScryfallSearch(duplicate.state).status, SCRYFALL_SEARCH_STATUS.closed);
});

test("duplicate protection resets for a deliberate later popup invocation", () => {
  let state = requestScryfallSearchOpen(createScryfallSearchState({ query: "Sol Ring" }));
  state = selectScryfallSearchResult({
    ...state,
    results: [{ cardId: "sol-ring", name: "Sol Ring" }],
  }, "sol-ring");
  const first = beginScryfallSearchAction(state, {
    actionType: "cast",
    semanticIntent: "hand",
  });
  assert.equal(first.accepted, true);
  state = completeScryfallSearchAction(first.state, first.actionId);

  const rapidDuplicate = beginScryfallSearchAction(state, {
    actionType: "cast",
    semanticIntent: "hand",
  });
  assert.equal(rapidDuplicate.accepted, false);

  state = requestScryfallSearchOpen(closeScryfallSearch(state, { preserveSelection: true }));
  const laterAction = beginScryfallSearchAction(state, {
    actionType: "cast",
    semanticIntent: "hand",
  });
  assert.equal(laterAction.accepted, true);
  assert.notEqual(laterAction.actionId, first.actionId);
  assert.equal(state.openRevision, 2);
});

test("completed presentation windows cannot deadlock later search requests", () => {
  const now = 10_000;
  const attention = resolveGameplayAttentionOwner({
    now,
    session: {
      presentation: {
        kind: "entered-battlefield",
        expiresAt: now - 1,
      },
    },
    commandHandActive: true,
  });
  assert.equal(attention.owner, "relevant-contextual-command");
  const state = requestScryfallSearchOpen(createScryfallSearchState(), {
    attentionOwner: attention.owner,
    presentationKind: "",
  });
  assert.equal(state.status, SCRYFALL_SEARCH_STATUS.open);
});

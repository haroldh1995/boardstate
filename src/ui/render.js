import { buildStats } from "../analytics/statsService.js";
import { exportProfile, parseImportedProfile } from "../storage/localDatabase.js";
import { searchScryfall } from "../services/scryfallService.js";
import { canBeCommander } from "../game/commanderSystem.js";
import { PHASES } from "../state/schema.js";

export function mountApp(root, store) {
  let activePage = "battlefield";
  let searchResults = [];
  let searchMessage = "";

  store.subscribe(render);
  render(store.getState());

  function render(profile) {
    root.innerHTML = layout(profile, activePage, searchResults, searchMessage);
    bind(root, profile);
  }

  function bind(container, profile) {
    container.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        activePage = button.dataset.page;
        render(store.getState());
      });
    });

    container.querySelector("[data-life-plus]")?.addEventListener("click", () => store.dispatch({ type: "LIFE_DELTA", amount: 1 }));
    container.querySelector("[data-life-minus]")?.addEventListener("click", () => store.dispatch({ type: "LIFE_DELTA", amount: -1 }));
    container.querySelector("[data-undo]")?.addEventListener("click", () => store.dispatch({ type: "UNDO" }));
    container.querySelector("[data-next-phase]")?.addEventListener("click", () => store.dispatch({ type: "ADVANCE_PHASE" }));
    container.querySelector("[data-archive-game]")?.addEventListener("click", () => store.dispatch({ type: "ARCHIVE_GAME", result: "completed" }));
    container.querySelector("[data-cast-commander]")?.addEventListener("click", () => store.dispatch({ type: "CAST_COMMANDER" }));

    container.querySelectorAll("[data-mana]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_MANA", color: button.dataset.mana, amount: 1 }));
    });
    container.querySelector("[data-clear-mana]")?.addEventListener("click", () => store.dispatch({ type: "CLEAR_MANA" }));

    container.querySelectorAll("[data-permanent]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "SELECT_PERMANENT", id: button.dataset.permanent }));
    });
    container.querySelectorAll("[data-tap]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "TOGGLE_TAPPED", id: button.dataset.tap }));
    });
    container.querySelectorAll("[data-counter]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_COUNTER", id: button.dataset.counter, counterType: "+1/+1", amount: 1 }));
    });
    container.querySelector("[data-declare-attackers]")?.addEventListener("click", () =>
      store.dispatch({ type: "DECLARE_ATTACKERS", ids: profile.activeSession.selectedIds })
    );
    container.querySelector("[data-resolve-combat]")?.addEventListener("click", () => store.dispatch({ type: "RESOLVE_COMBAT" }));

    container.querySelector("[data-token]")?.addEventListener("click", () =>
      store.dispatch({
        type: "ADD_PERMANENT",
        card: {
          name: "Soldier Token",
          typeLine: "Token Creature - Soldier",
          basePower: 1,
          baseToughness: 1,
          isToken: true,
          ownedByCommanderDeck: false,
        },
      })
    );

    container.querySelector("[data-export]")?.addEventListener("click", () => downloadProfile(profile));
    container.querySelector("[data-import]")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      await store.dispatch({ type: "IMPORT_PROFILE", profile: parseImportedProfile(text) });
    });

    container.querySelector("[data-search-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = new FormData(event.currentTarget).get("query");
      const commanderDeck = profile.commanders?.[profile.activeSession.commander?.deckKey]?.cards || [];
      searchMessage = navigator.onLine ? "Searching..." : "Offline: showing commander deck matches only.";
      render(store.getState());
      searchResults = await searchScryfall(query, commanderDeck);
      searchMessage = searchResults.length ? `${searchResults.length} result(s)` : "No results found.";
      render(store.getState());
    });

    container.querySelectorAll("[data-add-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_PERMANENT", card: searchResults[Number(button.dataset.addResult)] }));
    });
    container.querySelectorAll("[data-cast-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "CAST_SPELL", card: searchResults[Number(button.dataset.castResult)] }));
    });
    container.querySelectorAll("[data-commander-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "SET_COMMANDER", card: searchResults[Number(button.dataset.commanderResult)] }));
    });
    container.querySelectorAll("[data-deck-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_DECK_CARD", card: searchResults[Number(button.dataset.deckResult)] }));
    });
    container.querySelectorAll("[data-pending-effect]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "MARK_PENDING_EFFECT", id: button.dataset.pendingEffect, status: button.dataset.status }));
    });
  }
}

function layout(profile, page, searchResults, searchMessage) {
  const session = profile.activeSession;
  return `
    <main class="app-shell">
      <header class="app-header glass">
        <div>
          <p class="eyebrow">Local-first MTG companion</p>
          <h1>BoardState</h1>
        </div>
        <button class="pill" data-undo>Undo</button>
      </header>
      <nav class="tab-bar glass">
        ${["battlefield", "profile", "archive", "decks", "leaderboards"].map((tab) => `<button class="${page === tab ? "active" : ""}" data-page="${tab}">${tab}</button>`).join("")}
      </nav>
      ${page === "battlefield" ? renderBattlefield(profile, searchResults, searchMessage) : ""}
      ${page === "profile" ? renderProfile(profile) : ""}
      ${page === "archive" ? renderArchive(profile) : ""}
      ${page === "decks" ? renderDecks(profile, searchResults, searchMessage) : ""}
      ${page === "leaderboards" ? renderLeaderboards(profile) : ""}
    </main>
  `;
}

function renderBattlefield(profile, searchResults, searchMessage) {
  const session = profile.activeSession;
  const stats = buildStats(profile);
  return `
    <section class="battlefield-page">
      <aside class="life-panel glass">
        <span class="eyebrow">Life</span>
        <strong>${session.life}</strong>
        <div class="row"><button data-life-minus>-</button><button data-life-plus>+</button></div>
        <p>Turn ${session.turn} / ${PHASES[session.phaseIndex]}</p>
        <button class="wide" data-next-phase>Next Phase</button>
      </aside>
      <section class="arena glass">
        <div class="opponent-zone">
          <h2>Opponent Battlefield</h2>
          ${renderBattlefieldGroups(session.battlefield.opponent, { readonly: true, emptyText: "No visible opponent permanents" })}
        </div>
        <div class="combat-zone">
          <h2>Combat</h2>
          <p>${session.combat.damagePreview ? `${session.combat.damagePreview.total} damage estimated` : "Select attackers, then confirm combat."}</p>
          <div class="row"><button data-declare-attackers>Declare Attackers</button><button data-resolve-combat>Resolve</button></div>
        </div>
        <div class="player-zone">
          <h2>Your Battlefield</h2>
          ${renderBattlefieldGroups(session.battlefield.player, { emptyText: "No permanents yet" })}
        </div>
      </section>
      <aside class="tools-panel glass">
        <h2>Tools</h2>
        <button class="wide" data-token>Create Soldier</button>
        <button class="wide" data-cast-commander>Cast Commander</button>
        <div class="mana-grid">${Object.entries(session.manaPool).map(([color, value]) => `<button data-mana="${color}">${color}<span>${value}</span></button>`).join("")}</div>
        <button class="wide" data-clear-mana>Clear Mana</button>
        <p>Board ${stats.currentBoardSize} / Triggers ${stats.triggersResolved}</p>
        ${renderSearch(searchResults, searchMessage)}
      </aside>
    </section>
    ${renderPending(session)}
  `;
}

function renderBattlefieldGroups(permanents, options = {}) {
  if (!permanents.length) {
    return empty(options.emptyText || "No permanents yet");
  }

  const untapped = permanents.filter((permanent) => !permanent.tapped);
  const tapped = permanents.filter((permanent) => permanent.tapped);
  return `
    <div class="battlefield-groups">
      ${renderPermanentGroup("Untapped", untapped, options)}
      ${renderPermanentGroup("Tapped", tapped, { ...options, tappedGroup: true })}
    </div>
  `;
}

function renderPermanentGroup(label, permanents, options = {}) {
  if (!permanents.length) {
    return "";
  }
  const count = permanents.reduce((total, permanent) => total + (Number(permanent.quantity) || 1), 0);
  return `
    <section class="battlefield-group ${options.tappedGroup ? "tapped-zone" : "untapped-zone"}">
      <div class="battlefield-group-header">
        <span>${label}</span>
        <strong>${count}</strong>
      </div>
      <div class="tile-grid ${options.readonly ? "readonly" : ""}">
        ${permanents.map((permanent) => renderPermanent(permanent, options)).join("")}
      </div>
    </section>
  `;
}

function renderPermanent(permanent, options = {}) {
  return `
    <article class="permanent ${permanent.tapped ? "tapped" : ""} ${permanent.attacking ? "attacking" : ""} ${permanent.manualStatus === "pending" ? "pending" : ""}">
      <button ${options.readonly ? "" : `data-permanent="${permanent.id}"`}>
        <strong>${escapeHtml(permanent.name)}</strong>
        <span>${escapeHtml(permanent.typeLine)}</span>
        ${permanent.isCreature ? `<b>${permanent.currentPower}/${permanent.currentToughness}</b>` : ""}
        ${permanent.isPlaneswalker ? `<b>Loyalty ${permanent.counters?.Loyalty || 0}</b>` : ""}
        ${permanent.quantity > 1 ? `<i class="quantity">x${permanent.quantity}</i>` : ""}
        ${permanent.isToken ? "<em>TOKEN</em>" : ""}
      </button>
      ${options.readonly ? "" : `<div class="row mini">
        <button data-tap="${permanent.id}">${permanent.tapped ? "Untap" : "Tap"}</button>
        <button data-counter="${permanent.id}">+1/+1</button>
      </div>`}
    </article>
  `;
}

function renderSearch(results, message) {
  return `
    <form class="search-box" data-search-form>
      <label>Scryfall Search</label>
      <div class="row"><input name="query" placeholder="Card, token, land, spell" /><button>Search</button></div>
      <p>${escapeHtml(message || "Works offline with saved commander deck matches.")}</p>
    </form>
    <div class="search-results">
      ${results.map((card, index) => `
        <article>
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml(card.typeLine || "")}</span>
          <div class="row mini">
            ${card.isInstant || card.isSorcery || /\b(Instant|Sorcery)\b/i.test(card.typeLine || "") ? `<button data-cast-result="${index}">Cast</button>` : `<button data-add-result="${index}">Add</button>`}
            <button data-deck-result="${index}">Deck</button>
            ${canBeCommander(card) ? `<button data-commander-result="${index}">Commander</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPending(session) {
  if (!session.pendingEffects.length) {
    return "";
  }
  return `
    <section class="pending-strip glass">
      <h2>Pending Effects</h2>
      ${session.pendingEffects.map((effect) => `
        <article>
          <strong>${escapeHtml(effect.sourceName)}</strong>
          <span>${escapeHtml(effect.status)}</span>
          <button data-pending-effect="${effect.id}" data-status="resolved">Resolved</button>
          <button data-pending-effect="${effect.id}" data-status="skipped">Skipped</button>
        </article>
      `).join("")}
    </section>
  `;
}

function renderProfile(profile) {
  return `
    <section class="utility-page glass">
      <h2>Player Profile</h2>
      <p>Name: ${escapeHtml(profile.player.name)}</p>
      <p>Offline storage is primary. Export this profile to move devices.</p>
      <div class="row">
        <button data-export>Export Profile</button>
        <label class="file-pill">Import Profile<input type="file" accept="application/json" data-import /></label>
      </div>
    </section>
  `;
}

function renderArchive(profile) {
  return `
    <section class="utility-page glass">
      <h2>Archive</h2>
      <button data-archive-game>Archive Current Game</button>
      ${(profile.archives || []).map((game) => `
        <article class="log-card">
          <strong>${escapeHtml(game.commanderName)}</strong>
          <span>${new Date(game.endedAt).toLocaleString()}</span>
          <p>${game.history?.length || 0} actions / ${game.effectLog?.length || 0} effect logs</p>
        </article>
      `).join("") || empty("No archived games yet")}
    </section>
  `;
}

function renderDecks(profile, results, message) {
  const decks = Object.values(profile.commanders || {});
  return `
    <section class="utility-page glass">
      <h2>Commander Decks</h2>
      ${renderSearch(results, message)}
      ${decks.map((deck) => `
        <article class="log-card">
          <strong>${escapeHtml(deck.commanderName)}</strong>
          <span>${deck.cards.length} cards / ${Object.keys(deck.usage).length} used</span>
          <div class="deck-list">${deck.cards.map((card) => `<span>${escapeHtml(card.name)}</span>`).join("")}</div>
        </article>
      `).join("") || empty("Choose a commander, then add cards to build a local deck archive.")}
    </section>
  `;
}

function renderLeaderboards(profile) {
  return `
    <section class="utility-page glass">
      <h2>Local Leaderboards</h2>
      ${Object.entries(profile.leaderboards || {}).map(([name, records]) => `
        <article class="log-card">
          <strong>${escapeHtml(name)}</strong>
          ${(records || []).map((record) => `<p>${escapeHtml(record.label)}: ${record.value}</p>`).join("") || "<p>No records yet</p>"}
        </article>
      `).join("")}
    </section>
  `;
}

function downloadProfile(profile) {
  const blob = new Blob([exportProfile(profile)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `boardstate-profile-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function empty(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

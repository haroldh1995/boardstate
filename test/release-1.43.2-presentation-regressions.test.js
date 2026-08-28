import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TRANSIENT_PRESENTATION_TIMING,
  createCardPresentationPayload,
  resolveTransientNotificationTiming,
  resolveTransientPresentationPhase,
} from "../src/gameplay/cardLifecycle.js";
import { getPendingTargetDecision } from "../src/gameplay/canonicalGameplay.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("transient notifications close at 1.5 seconds with a compositor-sized exit window", () => {
  const render = readRepositoryFile("src/ui/render.js");
  assert.deepEqual(TRANSIENT_PRESENTATION_TIMING, {
    notificationTotalMs: 1500,
    notificationExitMs: 180,
    cardCastMs: 560,
  });
  assert.deepEqual(resolveTransientNotificationTiming({ id: "notice-1" }), {
    autoDismiss: true,
    totalMs: 1500,
    exitMs: 180,
    exitAtMs: 1320,
  });
  assert.equal(resolveTransientNotificationTiming({ persistent: true }).autoDismiss, false);
  assert.equal(resolveTransientNotificationTiming({ requiresAcknowledgement: true }).autoDismiss, false);
  assert.deepEqual(
    resolveTransientPresentationPhase({ createdAt: 1000, totalMs: 1500, exitMs: 180 }, 2320),
    { ageMs: 1320, remainingMs: 180, exitRemainingMs: 0, phase: "leaving", animationDelayMs: -1320 }
  );
  assert.equal(
    resolveTransientPresentationPhase({ createdAt: 1000, totalMs: 1500, exitMs: 180 }, 2500).phase,
    "complete"
  );
  assert.match(render, /const startedAt = Date\.now\(\)/);
  assert.match(render, /syncNotificationPresentationPhase\(id, existingTimers, timing\)/);
  assert.match(render, /entry\.id !== activeFullWindowId/);
});

test("casting presentation uses the shortened canonical duration", () => {
  const presentation = createCardPresentationPayload(
    { id: "spell-1", name: "Lightning Bolt" },
    "cast",
    "player",
    { createdAt: 2000, eventId: "cast:spell-1" }
  );
  assert.equal(presentation.expiresAt - presentation.createdAt, 560);
  assert.equal(
    resolveTransientPresentationPhase({ createdAt: presentation.createdAt, totalMs: 560 }, 2280).animationDelayMs,
    -280
  );
});

test("card selection alone never activates battlefield target overlays", () => {
  const selectedOnly = {
    selectedIds: ["creature-1"],
    pendingEffects: [],
  };
  assert.equal(getPendingTargetDecision(selectedOnly), null);

  const targetDecision = {
    ...selectedOnly,
    pendingEffects: [
      { id: "choice-1", status: "resolved", effect: { choiceKind: "targets" } },
      { id: "choice-2", status: "pending", sourceId: "spell-1", effect: { choiceKind: "targets" } },
    ],
  };
  assert.equal(getPendingTargetDecision(targetDecision)?.id, "choice-2");
});

test("post-loader portrait handling gates gameplay instead of rotating the application shell", () => {
  const index = readRepositoryFile("index.html");
  const main = readRepositoryFile("src/main.js");
  const styles = readRepositoryFile("src/styles.css");

  assert.match(index, /id="boardstate-landscape-gate"/);
  assert.match(main, /activatePostLoadingLandscapeEnforcement/);
  assert.match(main, /data-landscape-ready|dataset\.landscapeReady/);
  assert.match(styles, /body\.boardstate-app-ready\[data-landscape-ready="false"\] #app/);
  assert.match(styles, /@media \(orientation: portrait\)[\s\S]*?body\.boardstate-app-ready #app[\s\S]*?visibility:\s*hidden !important/);
  assert.match(styles, /body\.boardstate-app-ready \.boardstate-landscape-gate[\s\S]*?display:\s*grid !important/);
  assert.doesNotMatch(styles, /body\[data-gameplay-orientation="landscape"\] \.app-shell\s*\{[\s\S]{0,240}rotate\(90deg\)/);
  assert.doesNotMatch(main, /css-landscape/);
});

test("battlefield card art remains unobscured and phone landscape cards use available space", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");

  assert.match(render, /imageUrl \? "has-card-art" : "uses-fallback"/);
  assert.match(render, /const pendingTargetDecision = getPendingTargetDecision\(session\)/);
  assert.doesNotMatch(render, /const sourceForTargets = getSelectedPermanents\(session\)\[0\]/);
  assert.match(render, /\$\{imageUrl \? "" : `<div class="permanent-readability-layer"/);
  assert.match(styles, /--tabletop-card-width:\s*clamp\(4\.45rem,\s*20svh,\s*6\.1rem\)/);
  assert.match(styles, /tabletop-zone-layout:has\(> \.battlefield-group:nth-child\(2\)\) \.permanent[\s\S]*?--tabletop-card-width:\s*clamp\(3rem,\s*12\.5svh,\s*4\.2rem\)/);
  assert.match(styles, /landscape-arena\.arena--opponent-hidden[\s\S]*?grid-template-rows:\s*minmax\(2\.75rem,\s*0\.4fr\)/);
  assert.match(styles, /tabletop-zone-layout:has\(> \.battlefield-group:only-child\)/);
  assert.match(styles, /\.permanent\.has-card-art \.permanent-art-layer\s*\{[\s\S]*?background-size:\s*contain/);
  assert.match(styles, /height:\s*min\(100%,\s*calc\(var\(--tabletop-card-width\) \* 1\.4\)\)/);
  assert.match(styles, /--game-command-hand-space:\s*calc\(clamp\(8\.28rem,\s*20\.8svh,\s*10\.86rem\)/);
  assert.match(styles, /will-change:\s*auto/);
  assert.match(styles, /command-deck\.is-dragging \.action-card[\s\S]*?transition:\s*none/);
  assert.match(styles, /boardstate-notification-exit 180ms/);
  assert.match(styles, /animation:\s*cast-presentation var\(--card-presentation-duration, 560ms\)/);
  assert.match(styles, /\.app-shell\.app-shell--battlefield\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /\.battlefield-tool-system\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/);
  assert.match(styles, /\.tabletop-battlefield-page \.gameplay-context-dock\s*\{[\s\S]*?left:\s*auto;[\s\S]*?width:\s*min\(18rem,\s*30vw\)/);
  assert.match(styles, /\.tabletop-battlefield-page \.landscape-selected-card\s*\{\s*display:\s*none;/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TRANSIENT_PRESENTATION_TIMING,
  createCardPresentationPayload,
  resolveTransientNotificationTiming,
} from "../src/gameplay/cardLifecycle.js";
import { getPendingTargetDecision } from "../src/gameplay/canonicalGameplay.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("transient notifications close at 1.5 seconds with a compositor-sized exit window", () => {
  assert.deepEqual(TRANSIENT_PRESENTATION_TIMING, {
    notificationTotalMs: 1500,
    notificationExitMs: 180,
    cardCastMs: 1050,
  });
  assert.deepEqual(resolveTransientNotificationTiming({ id: "notice-1" }), {
    autoDismiss: true,
    totalMs: 1500,
    exitMs: 180,
    exitAtMs: 1320,
  });
  assert.equal(resolveTransientNotificationTiming({ persistent: true }).autoDismiss, false);
  assert.equal(resolveTransientNotificationTiming({ requiresAcknowledgement: true }).autoDismiss, false);
});

test("casting presentation uses the shortened canonical duration", () => {
  const presentation = createCardPresentationPayload(
    { id: "spell-1", name: "Lightning Bolt" },
    "cast",
    "player",
    { createdAt: 2000, eventId: "cast:spell-1" }
  );
  assert.equal(presentation.expiresAt - presentation.createdAt, 1050);
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
  assert.doesNotMatch(styles, /body\[data-gameplay-orientation="landscape"\] \.app-shell\s*\{[\s\S]{0,240}rotate\(90deg\)/);
  assert.doesNotMatch(main, /css-landscape/);
});

test("battlefield card art remains unobscured and phone landscape cards use available space", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");

  assert.match(render, /imageUrl \? "has-card-art" : "uses-fallback"/);
  assert.match(render, /const pendingTargetDecision = getPendingTargetDecision\(session\)/);
  assert.doesNotMatch(render, /const sourceForTargets = getSelectedPermanents\(session\)\[0\]/);
  assert.match(styles, /\.permanent\.has-card-art \.permanent-readability-layer\s*\{[\s\S]*?background:\s*none;[\s\S]*?opacity:\s*0;/);
  assert.match(styles, /--tabletop-card-width:\s*clamp\(4\.2rem,\s*17\.5svh,\s*5\.6rem\)/);
  assert.match(styles, /tabletop-zone-layout:has\(> \.battlefield-group:only-child\)/);
  assert.match(styles, /\.permanent\.has-card-art \.permanent-art-layer\s*\{[\s\S]*?background-size:\s*contain/);
  assert.match(styles, /will-change:\s*auto/);
  assert.match(styles, /boardstate-notification-exit 180ms/);
  assert.match(styles, /animation:\s*cast-presentation 1\.05s/);
  assert.match(styles, /\.tabletop-battlefield-page \.gameplay-context-dock\s*\{[\s\S]*?left:\s*auto;[\s\S]*?width:\s*min\(18rem,\s*30vw\)/);
  assert.match(styles, /\.tabletop-battlefield-page \.landscape-selected-card\s*\{\s*display:\s*none;/);
});

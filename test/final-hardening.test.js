import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSessionDetailsModel } from "../src/shared-session/handoff.js";
import { createDefaultProfile } from "../src/state/schema.js";

test("final handoff readiness documentation states future-app boundaries honestly", () => {
  const doc = readFileSync("docs/ecosystem/HANDOFF_READINESS.md", "utf8");
  assert.match(doc, /rules authority/i);
  assert.match(doc, /BoardState Lite must integrate with canonical shared sessions/i);
  assert.match(doc, /Deck Nexus must export immutable deck snapshots/i);
  assert.match(doc, /future Hub must own ecosystem profiles/i);
  assert.match(doc, /Live cross-app integration is not claimed/i);
  assert.match(doc, /Legacy data remains preserved/i);
});

test("UI and bridge copy do not claim unavailable Lite, Nexus, or Hub integrations", () => {
  const source = [
    readFileSync("src/ui/render.js", "utf8"),
    readFileSync("src/bridge/appLinkAdapters.js", "utf8"),
    readFileSync("src/shared-session/handoff.js", "utf8"),
    readFileSync("src/migration/legacyMigration.js", "utf8"),
  ].join("\n");

  for (const falseClaim of [
    /BoardState Lite live handoff is complete/i,
    /Deck Nexus live link is complete/i,
    /Hub link is complete/i,
    /Hub linked/i,
    /Hub imported/i,
    /Hub synced/i,
    /migration complete/i,
    /data has been migrated/i,
  ]) {
    assert.doesNotMatch(source, falseClaim);
  }

  assert.match(source, /Waiting for Lite Update/i);
  assert.match(source, /Waiting for Nexus Update/i);
  assert.match(source, /Waiting for Hub/i);
  assert.match(source, /Live Link Not Installed/i);
});

test("session details prefer honest adapter statuses over legacy linked flags", () => {
  const profile = createDefaultProfile();
  profile.settings.linkedApps.deckNexus = { linked: true, availableCapabilities: [] };
  profile.settings.linkedApps.boardstateLite = { linked: true, availableCapabilities: [] };

  const details = buildSessionDetailsModel(profile);
  assert.equal(details.linkedApps.deckNexus, "Snapshot Import Supported");
  assert.equal(details.linkedApps.boardStateLite, "Waiting for Lite Update");
  assert.equal(details.linkedApps.hub, "Waiting for Hub");
});

test("Rules Waived mode requires explicit confirmation before enabling", () => {
  const source = readFileSync("src/ui/render.js", "utf8");
  assert.match(source, /id:\s*"rules-waived-mode"/);
  assert.match(source, /Enable Rules Waived mode\?/);
  assert.match(source, /Non-waivable errors and Manual Choice Required states are still not bypassed/);
  assert.match(source, /Rules Waived mode enabled with waiver history logging/);
});

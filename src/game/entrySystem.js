import { createId } from "../state/ids.js";
import { createPermanent } from "../state/schema.js";
import { RULES_CONFIDENCE } from "../support/debugExport.js";

const CONDITIONAL_TAPPED = /\benters(?: the battlefield)? tapped unless\b/i;
const OPTIONAL_ENTRY_COST = /\b(?:unless you|you may) (?:pay|reveal|return|sacrifice)\b|\bas (?:this|.+?) enters(?: the battlefield)?,? (?:choose|you may)\b/i;
const ENTRY_CHOICE = /\bas (?:this|.+?) enters(?: the battlefield)?\b|\benters with\b|\bchoose a (?:color|creature type)\b/i;

export function preparePermanentEntry(card = {}, controller = "player") {
  const oracleText = String(card.oracleText || card.rulesText || "");
  const conditionalTapped = CONDITIONAL_TAPPED.test(oracleText);
  const requiresChoice = conditionalTapped || OPTIONAL_ENTRY_COST.test(oracleText) || ENTRY_CHOICE.test(oracleText);
  const permanent = createPermanent({
    ...card,
    controller,
    owner: card.owner || controller,
    tapped: conditionalTapped ? true : card.tapped,
  });
  return {
    permanent,
    choice: requiresChoice ? createEntryChoice(permanent, conditionalTapped) : null,
  };
}

export function createEntryChoice(permanent, conditionalTapped = false) {
  return {
    id: createId("pending-entry"),
    sourceId: permanent.id,
    sourceName: permanent.name,
    effect: {
      action: "entry-choice",
      manual: true,
      choiceKind: conditionalTapped ? "conditional-tapped-entry" : "entry-choice",
      summary: conditionalTapped
        ? "Confirm whether the entry condition or cost is met. It enters tapped unless confirmed."
        : "Confirm the entry choice or cost required by this permanent.",
    },
    summary: conditionalTapped
      ? `${permanent.name} entered tapped pending its entry condition or cost.`
      : `${permanent.name} requires an entry choice or cost.`,
    oracleText: permanent.oracleText,
    controller: permanent.controller,
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
    createdAt: Date.now(),
  };
}

export function chooseEntryResult(session, pendingId, enterUntapped = false) {
  const pending = (session.pendingEffects || []).find((entry) => entry.id === pendingId);
  if (!pending || pending.effect?.action !== "entry-choice") {
    return session;
  }
  const updateSide = (side = []) =>
    side.map((permanent) =>
      permanent.id === pending.sourceId
        ? createPermanent({ ...permanent, tapped: !enterUntapped })
        : permanent
    );
  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: updateSide(session.battlefield?.player || []),
      opponent: updateSide(session.battlefield?.opponent || []),
    },
    pendingEffects: (session.pendingEffects || []).map((entry) =>
      entry.id === pendingId
        ? { ...entry, status: "resolved", resolution: enterUntapped ? "entered-untapped" : "entered-tapped", updatedAt: Date.now() }
        : entry
    ),
    effectLog: [
      {
        id: createId("entry"),
        at: Date.now(),
        sourceName: pending.sourceName,
        summary: `${pending.sourceName} entered ${enterUntapped ? "untapped" : "tapped"}.`,
        rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
      },
      ...(session.effectLog || []),
    ].slice(0, 120),
  };
}

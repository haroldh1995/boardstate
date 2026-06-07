// Offline rules-text fallbacks for common spells in the bundled Dry Run decks.
// Cards not listed here remain explicitly unresolved and route to manual review.
const SPELLS = {
  "arcane denial": {
    typeLine: "Instant",
    manaCost: "{1}{U}",
    oracleText: "Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep. You draw a card at the beginning of the next turn's upkeep.",
  },
  "beast within": {
    typeLine: "Instant",
    manaCost: "{2}{G}",
    oracleText: "Destroy target permanent. Its controller creates a 3/3 green Beast creature token.",
  },
  "big score": {
    typeLine: "Instant",
    manaCost: "{3}{R}",
    oracleText: "As an additional cost to cast this spell, discard a card. Draw two cards and create two Treasure tokens.",
  },
  "blasphemous act": {
    typeLine: "Sorcery",
    manaCost: "{8}{R}",
    oracleText: "This spell costs {1} less to cast for each creature on the battlefield. Blasphemous Act deals 13 damage to each creature.",
  },
  "chaos warp": {
    typeLine: "Instant",
    manaCost: "{2}{R}",
    oracleText: "The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.",
  },
  cultivate: {
    typeLine: "Sorcery",
    manaCost: "{2}{G}",
    oracleText: "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
  },
  "deep analysis": {
    typeLine: "Sorcery",
    manaCost: "{3}{U}",
    oracleText: "Target player draws two cards. Flashback {1}{U}, Pay 3 life.",
  },
  "dig through time": {
    typeLine: "Instant",
    manaCost: "{6}{U}{U}",
    oracleText: "Delve. Look at the top seven cards of your library. Put two of them into your hand and the rest on the bottom of your library in any order.",
  },
  "faithless looting": {
    typeLine: "Sorcery",
    manaCost: "{R}",
    oracleText: "Draw two cards, then discard two cards. Flashback {2}{R}.",
  },
  farseek: {
    typeLine: "Sorcery",
    manaCost: "{1}{G}",
    oracleText: "Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.",
  },
  "galvanic iteration": {
    typeLine: "Instant",
    manaCost: "{U}{R}",
    oracleText: "When you cast your next instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy. Flashback {1}{U}{R}.",
  },
  harrow: {
    typeLine: "Instant",
    manaCost: "{2}{G}",
    oracleText: "As an additional cost to cast this spell, sacrifice a land. Search your library for up to two basic land cards, put them onto the battlefield, then shuffle.",
  },
  "infernal grasp": {
    typeLine: "Instant",
    manaCost: "{1}{B}",
    oracleText: "Destroy target creature. You lose 2 life.",
  },
  "mizzix's mastery": {
    typeLine: "Sorcery",
    manaCost: "{3}{R}",
    oracleText: "Exile target card that's an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile Mizzix's Mastery.",
  },
  "nature's lore": {
    typeLine: "Sorcery",
    manaCost: "{1}{G}",
    oracleText: "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
  },
  opt: {
    typeLine: "Instant",
    manaCost: "{U}",
    oracleText: "Scry 1. Draw a card.",
  },
  ponder: {
    typeLine: "Sorcery",
    manaCost: "{U}",
    oracleText: "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.",
  },
  pongify: {
    typeLine: "Instant",
    manaCost: "{U}",
    oracleText: "Destroy target creature. It can't be regenerated. That creature's controller creates a 3/3 green Ape creature token.",
  },
  preordain: {
    typeLine: "Sorcery",
    manaCost: "{U}",
    oracleText: "Scry 2, then draw a card.",
  },
  putrefy: {
    typeLine: "Instant",
    manaCost: "{1}{B}{G}",
    oracleText: "Destroy target artifact or creature. It can't be regenerated.",
  },
  "radical idea": {
    typeLine: "Instant",
    manaCost: "{1}{U}",
    oracleText: "Draw a card. Jump-start.",
  },
  "roiling regrowth": {
    typeLine: "Instant",
    manaCost: "{2}{G}",
    oracleText: "Sacrifice a land. Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.",
  },
  "skyshroud claim": {
    typeLine: "Sorcery",
    manaCost: "{3}{G}",
    oracleText: "Search your library for up to two Forest cards, put them onto the battlefield, then shuffle.",
  },
  "spatial contortion": {
    typeLine: "Instant",
    manaCost: "{1}{C}",
    oracleText: "Target creature gets +3/-3 until end of turn.",
  },
  "splendid reclamation": {
    typeLine: "Sorcery",
    manaCost: "{3}{G}",
    oracleText: "Return all land cards from your graveyard to the battlefield tapped.",
  },
  "tear asunder": {
    typeLine: "Instant",
    manaCost: "{1}{G}",
    oracleText: "Kicker {1}{B}. Exile target artifact or enchantment. If this spell was kicked, instead exile target nonland permanent.",
  },
  "think twice": {
    typeLine: "Instant",
    manaCost: "{1}{U}",
    oracleText: "Draw a card. Flashback {2}{U}.",
  },
  "treasure cruise": {
    typeLine: "Sorcery",
    manaCost: "{7}{U}",
    oracleText: "Delve. Draw three cards.",
  },
  vandalblast: {
    typeLine: "Sorcery",
    manaCost: "{R}",
    oracleText: "Destroy target artifact you don't control. Overload {4}{R}.",
  },
  windfall: {
    typeLine: "Sorcery",
    manaCost: "{2}{U}",
    oracleText: "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.",
  },
  "all is dust": {
    typeLine: "Sorcery",
    manaCost: "{7}",
    oracleText: "Each player sacrifices all colored permanents they control.",
  },
  "titan's presence": {
    typeLine: "Instant",
    manaCost: "{3}",
    oracleText: "As an additional cost to cast this spell, reveal a colorless creature card from your hand. Exile target creature if its power is less than or equal to the revealed card's power.",
  },
  "warping wail": {
    typeLine: "Instant",
    manaCost: "{1}{C}",
    oracleText: "Choose one — Exile target creature with power or toughness 1 or less; counter target sorcery spell; or create a 1/1 colorless Eldrazi Scion creature token.",
  },
};

export function getSimulationSpellDefinition(name = "") {
  return SPELLS[String(name || "").trim().toLowerCase()] || null;
}


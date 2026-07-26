export const BOARDSTATE_VISUAL_LANGUAGE_VERSION = "boardstate-visual-language-0.1.0";

export const VISUAL_MATERIALS = Object.freeze({
  battlefieldAtmosphere: "battlefield-atmosphere",
  glass: "glass",
  polishedGlass: "polished-glass",
  metal: "metal",
  stone: "stone",
  energy: "energy",
  parchment: "parchment",
  cardStock: "premium-card-stock",
  gold: "gold-accent",
  crystal: "magical-crystal",
});

export const VISUAL_LAYERS = Object.freeze({
  atmosphere: "atmosphere",
  battlefield: "battlefield",
  permanent: "permanent",
  commandHand: "command-hand",
  contextual: "contextual",
  overlay: "overlay",
  debug: "debug",
});

export const VISUAL_DEBUG_FIELDS = Object.freeze([
  "material",
  "elevation",
  "shadow",
  "glow",
  "border",
  "layer",
  "opacity",
  "theme",
]);

const VISUAL_TOKEN_SET = Object.freeze({
  colors: Object.freeze({
    void: "#07040d",
    table: "#12091d",
    text: "#f7efff",
    muted: "rgba(238, 203, 132, 0.78)",
    gold: "#f1c06b",
    goldBright: "#ffe58a",
    info: "#9ed8ff",
    success: "#9df6ad",
    warning: "#ffd079",
    danger: "#ff9d83",
    purple: "#d9adff",
  }),
  materials: Object.freeze({
    battlefieldAtmosphere:
      "radial-gradient(circle at 50% 16%, rgba(255, 229, 138, 0.045), transparent 28%), radial-gradient(circle at 50% 82%, rgba(126, 63, 255, 0.16), transparent 52%), linear-gradient(180deg, rgba(7, 4, 13, 0.02), rgba(7, 4, 13, 0.16))",
    glass:
      "linear-gradient(180deg, rgba(12, 12, 28, 0.5), rgba(5, 7, 18, 0.34)), radial-gradient(circle at 14% 0%, rgba(143, 211, 255, 0.055), transparent 34%)",
    polishedGlass:
      "linear-gradient(180deg, rgba(14, 13, 31, 0.82), rgba(6, 8, 18, 0.7)), radial-gradient(circle at 12% 0%, rgba(143, 211, 255, 0.07), transparent 35%)",
    metal:
      "linear-gradient(160deg, rgba(37, 34, 51, 0.92), rgba(8, 9, 20, 0.96) 58%, rgba(42, 30, 50, 0.86)), linear-gradient(90deg, rgba(255, 229, 138, 0.12), transparent 22%, transparent 78%, rgba(143, 211, 255, 0.08))",
    stone:
      "radial-gradient(circle at 48% 8%, rgba(255, 229, 138, 0.035), transparent 32%), linear-gradient(180deg, rgba(12, 14, 24, 0.58), rgba(5, 7, 16, 0.32))",
    energy:
      "radial-gradient(circle at 50% 0%, rgba(143, 211, 255, 0.22), transparent 42%), radial-gradient(circle at 50% 100%, rgba(126, 63, 255, 0.18), transparent 56%), linear-gradient(180deg, rgba(8, 12, 28, 0.72), rgba(5, 7, 18, 0.84))",
    parchment:
      "linear-gradient(160deg, rgba(85, 57, 33, 0.8), rgba(22, 15, 16, 0.92)), radial-gradient(circle at 12% 10%, rgba(255, 230, 166, 0.16), transparent 38%)",
    cardStock:
      "radial-gradient(circle at 14% 7%, rgba(255, 239, 183, 0.13), transparent 36%), radial-gradient(circle at 88% 88%, rgba(143, 211, 255, 0.09), transparent 44%), linear-gradient(160deg, rgba(42, 25, 76, 0.88), rgba(8, 10, 26, 0.94) 62%, rgba(4, 6, 18, 0.98))",
    legendaryGold:
      "radial-gradient(circle at 50% 0%, rgba(255, 228, 153, 0.25), transparent 42%), linear-gradient(160deg, rgba(73, 45, 82, 0.94), rgba(12, 10, 28, 0.96))",
    crystal:
      "radial-gradient(circle at 20% 0%, rgba(143, 211, 255, 0.23), transparent 38%), radial-gradient(circle at 86% 92%, rgba(217, 173, 255, 0.16), transparent 45%), linear-gradient(160deg, rgba(16, 28, 56, 0.9), rgba(8, 8, 24, 0.96))",
  }),
  border: Object.freeze({
    glass: "1px solid rgba(117, 178, 255, 0.25)",
    goldSubtle: "1px solid rgba(236, 200, 122, 0.32)",
    goldStrong: "1px solid rgba(255, 229, 138, 0.72)",
    crystal: "1px solid rgba(143, 211, 255, 0.54)",
  }),
  radius: Object.freeze({
    chip: "999px",
    card: "0.92rem",
    panel: "24px",
    large: "28px",
  }),
  elevation: Object.freeze({
    table: 0,
    permanent: 24,
    commandHand: 126,
    overlay: 180,
    debug: 300,
  }),
  shadow: Object.freeze({
    ambient: "0 10px 38px rgba(0, 0, 0, 0.16)",
    panel: "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 10px 38px rgba(0, 0, 0, 0.16)",
    overlay: "inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 18px 44px rgba(0, 0, 0, 0.36)",
    raisedCard: "0 26px 48px rgba(0, 0, 0, 0.36)",
  }),
  glow: Object.freeze({
    none: "none",
    goldSubtle: "0 0 18px rgba(236, 200, 122, 0.16)",
    goldStrong: "0 0 32px rgba(236, 200, 122, 0.32)",
    crystal: "0 0 28px rgba(143, 211, 255, 0.28)",
    warning: "0 0 26px rgba(255, 157, 131, 0.28)",
  }),
  blur: Object.freeze({
    atmosphere: "blur(0.5px)",
    glass: "blur(10px) saturate(1.08)",
    overlay: "blur(14px) saturate(1.12)",
  }),
  opacity: Object.freeze({
    quiet: 0.74,
    standard: 0.92,
    active: 1,
  }),
  outline: Object.freeze({
    focus: "2px solid rgba(143, 211, 255, 0.72)",
    selected: "2px solid rgba(255, 229, 138, 0.74)",
  }),
});

export function createVisualTokenSet() {
  return {
    version: BOARDSTATE_VISUAL_LANGUAGE_VERSION,
    materialIds: VISUAL_MATERIALS,
    layers: VISUAL_LAYERS,
    ...VISUAL_TOKEN_SET,
  };
}

export function createVisualCssVariables() {
  const tokens = createVisualTokenSet();
  return {
    "--visual-color-bg-deep": tokens.colors.void,
    "--visual-color-table": tokens.colors.table,
    "--visual-color-text": tokens.colors.text,
    "--visual-color-muted": tokens.colors.muted,
    "--visual-color-gold": tokens.colors.gold,
    "--visual-color-gold-bright": tokens.colors.goldBright,
    "--visual-color-info": tokens.colors.info,
    "--visual-material-battlefield-atmosphere": tokens.materials.battlefieldAtmosphere,
    "--visual-material-glass": tokens.materials.glass,
    "--visual-material-polished-glass": tokens.materials.polishedGlass,
    "--visual-material-metal": tokens.materials.metal,
    "--visual-material-stone": tokens.materials.stone,
    "--visual-material-energy": tokens.materials.energy,
    "--visual-material-parchment": tokens.materials.parchment,
    "--visual-material-card-stock": tokens.materials.cardStock,
    "--visual-material-legendary-gold": tokens.materials.legendaryGold,
    "--visual-material-crystal": tokens.materials.crystal,
    "--visual-border-glass": tokens.border.glass,
    "--visual-border-gold-subtle": tokens.border.goldSubtle,
    "--visual-border-gold-strong": tokens.border.goldStrong,
    "--visual-border-crystal": tokens.border.crystal,
    "--visual-radius-chip": tokens.radius.chip,
    "--visual-radius-card": tokens.radius.card,
    "--visual-radius-panel": tokens.radius.panel,
    "--visual-radius-large": tokens.radius.large,
    "--visual-shadow-ambient": tokens.shadow.ambient,
    "--visual-shadow-panel": tokens.shadow.panel,
    "--visual-shadow-overlay": tokens.shadow.overlay,
    "--visual-shadow-raised-card": tokens.shadow.raisedCard,
    "--visual-glow-gold-subtle": tokens.glow.goldSubtle,
    "--visual-glow-gold-strong": tokens.glow.goldStrong,
    "--visual-glow-crystal": tokens.glow.crystal,
    "--visual-blur-glass": tokens.blur.glass,
    "--visual-blur-overlay": tokens.blur.overlay,
    "--visual-opacity-quiet": String(tokens.opacity.quiet),
    "--visual-opacity-standard": String(tokens.opacity.standard),
    "--visual-opacity-active": String(tokens.opacity.active),
    "--visual-outline-focus": tokens.outline.focus,
    "--visual-outline-selected": tokens.outline.selected,
  };
}

export function createVisualDebugSnapshot({
  material = VISUAL_MATERIALS.battlefieldAtmosphere,
  elevation = "table",
  shadow = "ambient",
  glow = "none",
  border = "none",
  layer = VISUAL_LAYERS.battlefield,
  opacity = "standard",
  theme = "cosmic-tribal-gold",
} = {}) {
  return {
    version: BOARDSTATE_VISUAL_LANGUAGE_VERSION,
    material,
    elevation,
    shadow,
    glow,
    border,
    layer,
    opacity,
    theme,
    fields: VISUAL_DEBUG_FIELDS,
    productionVisible: false,
  };
}

import { DEFAULT_FACE_DOWN_LABEL, MULTIPLAYER_VIEW_MODES } from "./multiplayer/connectionTypes.js";
import { createMultiplayerService } from "./multiplayer/multiplayerService.js";
import { createPublicPlayerSnapshot, createViewerBoardState } from "./multiplayer/playerSnapshot.js";
import {
  applyCounterModifiersDetailed,
  applyTokenModifiersDetailed,
  calculatePermanentPowerToughness,
  summarizeModifierList,
} from "./automation/automationEngine.js";
import { buildAutomationSuggestions, extractEffectMetadata } from "./automation/automationParser.js";
import { AUTOMATION_RULES_NOTE, getRulesReferenceEntries, summarizeRulesSources } from "./automation/rulesReferenceService.js";
import { fetchCardRulings } from "./automation/scryfallRulingsService.js";
import {
  createDefaultCompanionState,
  normalizeCompanionState,
  createHistoryEntry,
  recordHistoryAction,
  pushUndoSnapshot,
  popUndoSnapshot,
  createLifeRollbackBuffer,
  hasActiveLifeRollback,
} from "./Core/GameStateEngine.js";
import { applyFloatingManaDelta, clearFloatingManaForPhase, getFloatingManaTotal } from "./Services/FloatingManaService.js";
import { searchCounterTypes, updateRecentCounterSearches } from "./Services/CounterCatalogService.js";
import { queueTriggerReminders } from "./Services/TriggerReminderService.js";
import { calculateCombatPreview } from "./Services/CombatCalculatorService.js";
import { SETTINGS_TOGGLE_FIELDS } from "./Pages/SettingsManualPage.js";
import { MANUAL_SECTIONS } from "./Views/ManualContentView.js";

const STORAGE_KEY = "commander-life-counter-state";
const MAX_COMMANDER_DAMAGE_TRACKERS = 7;
const MIN_COMMANDER_DAMAGE_TRACKERS = 1;
const PHASES = ["Upkeep", "Main", "Combat", "Main 2", "End"];
const TRIGGER_EVENTS = ["Phase", "OnDeath", "OnExile", "OnSacrifice"];
const TRIGGER_ACTIONS = ["Create Tokens", "Multiply Tokens", "Add +1/+1 Counters", "Add Counters"];
const AUTOMATION_ACTIONS = [
  "Create Tokens",
  "Multiply Tokens",
  "Add +1/+1 Counters",
  "Add Counters",
  "Apply Temporary Buff",
  "Modify Token Amount",
  "Modify Counter Amount",
  "Board Buff",
];
const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const SEARCH_RESULT_LIMIT = 10;
const DEFAULT_RECENT_COUNTER_TYPES = ["+1/+1", "-1/-1", "Loyalty", "Charge", "Shield", "Oil", "Stun", "Time", "Quest"];
const MAX_RECENT_COUNTER_TYPES = 12;
const MAX_RECENT_TOKEN_SEARCHES = 5;
const TOKEN_TEMPLATE_LIBRARY = [
  "Treasure",
  "Food",
  "Clue",
  "Blood",
  "Map",
  "Powerstone",
  "Soldier",
  "Zombie",
  "Goblin",
  "Elf",
  "Human",
  "Spirit",
  "Angel",
  "Dragon",
  "Beast",
  "Bird",
  "Saproling",
  "Vampire",
  "Knight",
  "Merfolk",
  "Faerie",
  "Construct",
  "Phyrexian",
  "Elemental",
];
const BASIC_LAND_NAMES = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes"]);
const TRIGGER_TARGETS = [
  "All",
  "All Creatures",
  "All Creature Tokens",
  "All Permanents",
  "All Artifacts",
  "All Enchantments",
  "All Planeswalkers",
  "All Lands",
  "All Nonbasic Lands",
  "All Auras",
  "All Vehicles",
  "All Spacecraft",
  "All Mounts",
  "All Planets",
  "All Tokens",
  "Tokens Only",
  "Non-Tokens Only",
  "Legendary Only",
  "Non-Legendary Only",
  "Artifact Only",
  "Artifact Creature Only",
  "Selected",
];
const PAGE_ORDER = ["tracker", "board-state", "stats", "archive", "leaderboards"];
const PAGE_HASH_MAP = {
  tracker: "#tracker",
  "board-state": "#board-state",
  stats: "#stats",
  archive: "#archive",
  leaderboards: "#leaderboards",
};
const MAX_AUTOMATION_LOG_ENTRIES = 14;
const MAX_AUTOMATION_CHAIN_DEPTH = 40;
const BOARD_LONG_PRESS_MS = 430;
const BOARD_SWIPE_REMOVE_THRESHOLD = 72;
let automationChainDepth = 0;

const PLAYER_COUNTER_DEFS = [
  { id: "poison", label: "Poison" },
  { id: "energy", label: "Energy" },
  { id: "experience", label: "Experience" },
  { id: "tickets", label: "Tickets" },
];

/**
 * @typedef {Object} Permanent
 * @property {string} id
 * @property {string} scryfallId
 * @property {string} name
 * @property {string} manaCost
 * @property {string} typeLine
 * @property {string} oracleText
 * @property {string} imageUrl
 * @property {string} cardImageUrl
 * @property {string} rulingsUri
 * @property {Array<{source: string, publishedAt: string, comment: string}>} rulings
 * @property {Record<string, string>} legalities
 * @property {number} power
 * @property {number} toughness
 * @property {number} quantity
 * @property {boolean} isToken
 * @property {boolean} isNonCreature
 * @property {boolean} isLegendary
 * @property {boolean} isArtifact
 * @property {boolean} isCreature
 * @property {number} plusOneCounters
 * @property {number} minusOneCounters
 * @property {Record<string, number>} counters
 * @property {boolean} doublesTokens
 * @property {boolean} doublesCounters
 * @property {number} counterModifierBonus
 * @property {boolean} createsTokens
 * @property {boolean} addsCounters
 * @property {number} staticBuffPower
 * @property {number} staticBuffToughness
 * @property {string} staticBuffAppliesTo
 * @property {boolean} staticBuffExcludesSelf
 * @property {Array<{power: number, toughness: number, appliesTo: string, excludesSelf: boolean, creatureType: string}>} staticBuffRules
 * @property {number} temporaryPowerUntilTurnEnd
 * @property {number} temporaryToughnessUntilTurnEnd
 * @property {number} temporaryPowerUntilCombatEnd
 * @property {number} temporaryToughnessUntilCombatEnd
 * @property {boolean} isExpanded
 * @property {boolean} isSelected
 * @property {boolean} isFaceDown
 * @property {string} faceDownLabel
 * @property {boolean} revealAllowed
 * @property {boolean} isHiddenToOpponents
 * @property {Array<string>} automationRules
 * @property {boolean} autoRulesEnabled
 * @property {boolean} hasResolvedEtbTriggers
 * @property {boolean} isTapped
 * @property {boolean} summoningSickness
 * @property {boolean} isAttacking
 * @property {boolean} isBlocking
 * @property {string} notes
 * @property {string} attachedToId
 * @property {string} attachmentKind
 */

/**
 * @typedef {Object} Trigger
 * @property {string} id
 * @property {"Phase" | "OnDeath" | "OnExile" | "OnSacrifice"} triggerEvent
 * @property {string} phase
 * @property {string} actionType
 * @property {string} target
 * @property {number} value
 * @property {string} tokenName
 * @property {string} tokenManaCost
 * @property {number} tokenPower
 * @property {number} tokenToughness
 * @property {boolean} tokenTapped
 * @property {boolean} tokenAttacking
 * @property {string} valueMode
 * @property {string} counterType
 * @property {"creature" | "permanent"} counterTargetEntity
 */

/**
 * @typedef {Object} AutomationRule
 * @property {string} id
 * @property {string} sourcePermanentId
 * @property {string} sourceCardName
 * @property {string} triggerType
 * @property {string} phase
 * @property {string} eventType
 * @property {string} eventSourceScope
 * @property {string} actionType
 * @property {string} targetType
 * @property {number} value
 * @property {string} tokenName
 * @property {string} tokenManaCost
 * @property {number} tokenPower
 * @property {number} tokenToughness
 * @property {boolean} tokenTapped
 * @property {boolean} tokenAttacking
 * @property {string} valueMode
 * @property {string} counterType
 * @property {"creature" | "permanent"} counterTargetEntity
 * @property {number} buffPower
 * @property {number} buffToughness
 * @property {"until-end-of-turn" | "until-end-of-combat"} buffDuration
 * @property {boolean} requiresTargetSelection
 * @property {boolean} optionalTarget
 * @property {string} repeatBehavior
 * @property {boolean} enabled
 * @property {boolean} askBeforeRun
 * @property {"High" | "Medium" | "Low"} confidence
 * @property {Array<{source: string, summary: string, url: string}>} sourceEvidence
 * @property {string} reasonSummary
 */

/**
 * @typedef {Object} ConnectedPlayer
 * @property {string} id
 * @property {string} displayName
 * @property {"wifi" | "bluetooth" | "simulated"} connectionType
 * @property {boolean} isConnected
 * @property {number} lastUpdated
 * @property {{ life: number, counters: Record<string, number>, commanderDamage: Array<{label: string, value: number}> }} publicTrackerState
 * @property {{ permanents: Permanent[], effects: Permanent[], currentPhase: string, totalPower: number, totalToughness: number }} publicBoardState
 * @property {{ canViewFaceDownCards: boolean }} permissions
 */

let boardUi = {
  activeMenuPermanentId: "",
  pendingCounterSelection: null,
  searchQuery: "",
  searchStatus: "idle",
  searchResults: [],
  selectedSearchResultIndex: -1,
  searchMessage: "",
  searchMessageTone: "neutral",
  searchRequestId: 0,
  totalsVisible: false,
  detailPermanentId: "",
  detailDialogPermanentId: "",
  boardMultiplayerMessage: "",
  boardMultiplayerTone: "neutral",
};
let multiplayerUi = {
  feedbackMessage: "",
  feedbackTone: "neutral",
  activePlayerId: "",
  activeViewMode: "tracker",
  compareBoardsVisible: false,
  compareMode: "all",
};
const multiplayerService = createMultiplayerService();
const defaultState = createDefaultState();
let state = loadState();
let currentPage = "tracker";
let pageScrollFrame = 0;
let nameSettingsFocusIndex = -1;
let commanderBadgePressTimer = 0;
let commanderBadgeLongPressTriggered = false;

const pageFrame = document.querySelector("#pageFrame");
const pageViewport = document.querySelector("#pageViewport");
const trackerPageButton = document.querySelector("#trackerPageButton");
const boardStatePageButton = document.querySelector("#boardStatePageButton");
const commanderNavBadge = document.querySelector("#commanderNavBadge");
const commanderNavName = document.querySelector("#commanderNavName");
const commanderNavMeta = document.querySelector("#commanderNavMeta");
const trackerBoard = document.querySelector("#trackerBoard");
const boardStateBoard = document.querySelector("#boardStateBoard");
const statsBoard = document.querySelector("#statsBoard");
const archiveBoard = document.querySelector("#archiveBoard");
const leaderboardBoard = document.querySelector("#leaderboardBoard");
const statsSummaryGrid = document.querySelector("#statsSummaryGrid");
const commanderInsightsList = document.querySelector("#commanderInsightsList");
const archiveSearchInput = document.querySelector("#archiveSearchInput");
const archiveList = document.querySelector("#archiveList");
const leaderboardGrid = document.querySelector("#leaderboardGrid");

const outputs = {
  playerName: document.querySelector("#playerName"),
  life: document.querySelector("#lifeValue"),
  tax: document.querySelector("#taxValue"),
  mana: document.querySelector("#manaValue"),
  damageTrackerCountValue: document.querySelector("#damageTrackerCountValue"),
  damageTrackerCountLabel: document.querySelector("#damageTrackerCountLabel"),
  activeCounterCountValue: document.querySelector("#activeCounterCountValue"),
  activeCounterCountLabel: document.querySelector("#activeCounterCountLabel"),
  damageTrackerCountOptionValue: document.querySelector("#damageTrackerCountOptionValue"),
  boardPhaseValue: document.querySelector("#boardPhaseValue"),
  turnNumberValue: document.querySelector("#turnNumberValue"),
  turnTimerValue: document.querySelector("#turnTimerValue"),
  phaseTimerValue: document.querySelector("#phaseTimerValue"),
  boardTotalScope: document.querySelector("#boardTotalScope"),
  boardTotalValue: document.querySelector("#boardTotalValue"),
};

const renameButton = document.querySelector("#renameButton");
const quickResetButton = document.querySelector("#quickResetButton");
const optionsButton = document.querySelector("#optionsButton");

const optionsDialog = document.querySelector("#optionsDialog");
const nameSettingsDialog = document.querySelector("#nameSettingsDialog");
const counterSheetDialog = document.querySelector("#counterSheetDialog");
const damageSheetDialog = document.querySelector("#damageSheetDialog");
const connectedPlayersDialog = document.querySelector("#connectedPlayersDialog");
const connectedPlayerViewDialog = document.querySelector("#connectedPlayerViewDialog");
const boardOptionsDialog = document.querySelector("#boardOptionsDialog");
const bulkRemoveDialog = document.querySelector("#bulkRemoveDialog");
const multiplayerHubDialog = document.querySelector("#multiplayerHubDialog");
const automationRulesDialog = document.querySelector("#automationRulesDialog");
const cardDetailDialog = document.querySelector("#cardDetailDialog");
const genericTokenDialog = document.querySelector("#genericTokenDialog");
const settingsManualDialog = document.querySelector("#settingsManualDialog");
const commanderActionDialog = document.querySelector("#commanderActionDialog");
const commanderActionTitle = document.querySelector("#commanderActionTitle");
const commanderActionNote = document.querySelector("#commanderActionNote");
const castCommanderButton = document.querySelector("#castCommanderButton");

const renameAction = document.querySelector("#renameAction");
const nameSettingsForm = document.querySelector("#nameSettingsForm");
const playerNameInput = document.querySelector("#playerNameInput");
const playerNameList = document.querySelector("#playerNameList");
const closeNameSettingsButton = document.querySelector("#closeNameSettingsButton");
const resetLifeAction = document.querySelector("#resetLifeAction");
const resetAllAction = document.querySelector("#resetAllAction");
const openBoardStateAction = document.querySelector("#openBoardStateAction");
const openCounterTrayAction = document.querySelector("#openCounterTrayAction");
const openDamageTrayAction = document.querySelector("#openDamageTrayAction");
const openSettingsManualAction = document.querySelector("#openSettingsManualAction");
const connectWifiAction = document.querySelector("#connectWifiAction");
const connectBluetoothAction = document.querySelector("#connectBluetoothAction");
const connectSimulatedAction = document.querySelector("#connectSimulatedAction");
const viewConnectedPlayersAction = document.querySelector("#viewConnectedPlayersAction");
const damageTrackerCountDec = document.querySelector("#damageTrackerCountDec");
const damageTrackerCountInc = document.querySelector("#damageTrackerCountInc");
const playerCounterOptionsButton = document.querySelector("#playerCounterOptionsButton");
const damageOptionsButton = document.querySelector("#damageOptionsButton");
const connectedPlayersOptionsButton = document.querySelector("#connectedPlayersOptionsButton");
const connectedPlayerBackButton = document.querySelector("#connectedPlayerBackButton");
const boardOptionsButton = document.querySelector("#boardOptionsButton");
const boardOptionsMultiplayerButton = document.querySelector("#boardOptionsMultiplayerButton");
const boardOptionsTotalsButton = document.querySelector("#boardOptionsTotalsButton");
const boardOptionsAutomationToggleButton = document.querySelector("#boardOptionsAutomationToggleButton");
const boardOptionsSettingsManualButton = document.querySelector("#boardOptionsSettingsManualButton");
const boardOptionsExpandButton = document.querySelector("#boardOptionsExpandButton");
const boardOptionsCollapseButton = document.querySelector("#boardOptionsCollapseButton");
const boardOptionsClearSelectionButton = document.querySelector("#boardOptionsClearSelectionButton");
const boardOptionsAutomationButton = document.querySelector("#boardOptionsAutomationButton");
const boardOptionsResetButton = document.querySelector("#boardOptionsResetButton");
const boardConnectWifiAction = document.querySelector("#boardConnectWifiAction");
const boardConnectBluetoothAction = document.querySelector("#boardConnectBluetoothAction");
const boardConnectSimulatedAction = document.querySelector("#boardConnectSimulatedAction");
const boardViewConnectedPlayersAction = document.querySelector("#boardViewConnectedPlayersAction");
const automationAddTriggerButton = document.querySelector("#automationAddTriggerButton");

const playerCounterList = document.querySelector("#playerCounterList");
const playerCounterEmpty = document.querySelector("#playerCounterEmpty");
const commanderDamageList = document.querySelector("#commanderDamageList");
const counterToggleInputs = Array.from(document.querySelectorAll("[data-counter-toggle]"));
const counterInlineList = document.querySelector("#counterInlineList");
const damageInlineList = document.querySelector("#damageInlineList");

const nextPhaseButton = document.querySelector("#nextPhaseButton");
const boardSearchSection = document.querySelector(".board-state-search");
const boardSearchForm = document.querySelector("#boardSearchForm");
const boardSearchInput = document.querySelector("#boardSearchInput");
const boardSearchButton = document.querySelector("#boardSearchButton");
const boardSearchCancelButtons = Array.from(document.querySelectorAll("[data-board-search-cancel]"));
const boardSearchFeedback = document.querySelector("#boardSearchFeedback");
const boardSearchPanel = document.querySelector("#boardSearchPanel");
const boardSearchMeta = document.querySelector("#boardSearchMeta");
const boardSearchResults = document.querySelector("#boardSearchResults");
const addSelectedCardButton = document.querySelector("#addSelectedCardButton");
const manualAddButton = document.querySelector("#manualAddButton");
const addCreatureButton = document.querySelector("#addCreatureButton");
const addTokenButton = document.querySelector("#legacyAddTokenButton") || document.querySelector("#addTokenButton");
const addEffectButton = document.querySelector("#addEffectButton");
const addTriggerButton = document.querySelector("#addTriggerButton");
const toggleBoardControlsButton = document.querySelector("#toggleBoardControlsButton");
const boardControlsToggleLabel = document.querySelector(".board-controls-toggle-label");
const expandAllButton = document.querySelector("#expandAllButton");
const collapseAllButton = document.querySelector("#collapseAllButton");
const boardStateControls = document.querySelector("#boardStateControls");
const boardControlsExtra = document.querySelector("#boardControlsExtra");
const boardStateEffectsSection = document.querySelector("#boardStateEffectsSection");
const floatingManaPanel = document.querySelector("#floatingManaPanel");
const floatingManaTotalValue = document.querySelector("#floatingManaTotalValue");
const floatingManaGrid = document.querySelector("#floatingManaGrid");
const floatingManaOutputs = {
  W: document.querySelector("#floatingManaWValue"),
  U: document.querySelector("#floatingManaUValue"),
  B: document.querySelector("#floatingManaBValue"),
  R: document.querySelector("#floatingManaRValue"),
  G: document.querySelector("#floatingManaGValue"),
  C: document.querySelector("#floatingManaCValue"),
};
const battlefieldSection = document.querySelector(".board-state-battlefield");
const effectStrip = document.querySelector("#effectStrip");
const battlefieldGrid = document.querySelector("#battlefieldGrid");
const battlefieldEmpty = document.querySelector("#battlefieldEmpty");
const removeAllBattlefieldButton = document.querySelector("#removeAllBattlefieldButton");
const battlefieldAddCounterButton = document.querySelector("#battlefieldAddCounterButton");
const confirmCounterSelectionButton = document.querySelector("#confirmCounterSelectionButton");
const toggleBoardTotalsButton = document.querySelector("#toggleBoardTotalsButton");
const boardTotalBar = document.querySelector("#boardTotalBar");
const battlefieldHeadingRow = document.querySelector(".board-state-battlefield .board-section-heading-row");
const combatSimulationSection = document.querySelector("#combatSimulationSection");
const attackSelectedButton = document.querySelector("#attackSelectedButton");
const attackAllButton = document.querySelector("#attackAllButton");
const confirmCombatButton = document.querySelector("#confirmCombatButton");
const clearAttackersButton = document.querySelector("#clearAttackersButton");
const clearSelectionButton = document.querySelector("#clearSelectionButton");
const combatSummary = document.querySelector("#combatSummary");
const multiplayerFeedback = document.querySelector("#multiplayerFeedback");
const boardMultiplayerFeedback = document.querySelector("#boardMultiplayerFeedback");
const connectedPlayersEmpty = document.querySelector("#connectedPlayersEmpty");
const connectedPlayersList = document.querySelector("#connectedPlayersList");
const connectedPlayerViewKicker = document.querySelector("#connectedPlayerViewKicker");
const connectedPlayerViewTitle = document.querySelector("#connectedPlayerViewTitle");
const connectedPlayerViewTabs = document.querySelector("#connectedPlayerViewTabs");
const connectedPlayerViewContent = document.querySelector("#connectedPlayerViewContent");
const automationRulesEmpty = document.querySelector("#automationRulesEmpty");
const automationRulesList = document.querySelector("#automationRulesList");
const automationRulesNote = document.querySelector("#automationRulesNote");
const automationSuggestionsSection = document.querySelector("#automationSuggestionsSection");
const automationSuggestionsEmpty = document.querySelector("#automationSuggestionsEmpty");
const automationSuggestionsList = document.querySelector("#automationSuggestionsList");
const automationManualEmpty = document.querySelector("#automationManualEmpty");
const automationManualList = document.querySelector("#automationManualList");
const automationLogEmpty = document.querySelector("#automationLogEmpty");
const automationLogList = document.querySelector("#automationLogList");
const automationToggleAllButton = document.querySelector("#automationToggleAllButton");
const automationUndoButton = document.querySelector("#automationUndoButton");
const cardDetailTitle = document.querySelector("#cardDetailTitle");
const cardDetailContent = document.querySelector("#cardDetailContent");
const genericTokenForm = document.querySelector("#genericTokenForm");
const battlefieldCounterDialog = document.querySelector("#battlefieldCounterDialog");
const counterTypeDialog = document.querySelector("#counterTypeDialog");
const counterTypeForm = document.querySelector("#counterTypeForm");
const counterTypeRecentList = document.querySelector("#counterTypeRecentList");
const counterTypeInput = document.querySelector("#counterTypeInput");
const cancelCounterTypeButton = document.querySelector("#cancelCounterTypeButton");
const settingsToggleList = document.querySelector("#settingsToggleList");
const manualSectionsList = document.querySelector("#manualSectionsList");
const actionHistoryList = document.querySelector("#actionHistoryList");
const globalUndoAction = document.querySelector("#globalUndoAction");
const lifeRollbackAction = document.querySelector("#lifeRollbackAction");
const triggerReminderStrip = document.querySelector("#triggerReminderStrip");
const triggerReminderList = document.querySelector("#triggerReminderList");
const tokenNameInput = document.querySelector("#tokenNameInput");
const tokenManaCostInput = document.querySelector("#tokenManaCostInput");
const tokenPowerInput = document.querySelector("#tokenPowerInput");
const tokenToughnessInput = document.querySelector("#tokenToughnessInput");
const tokenQuantityInput = document.querySelector("#tokenQuantityInput");
const tokenTypeInput = document.querySelector("#tokenTypeInput");
const tokenNotesInput = document.querySelector("#tokenNotesInput");
const tokenTemplateSearchInput = document.querySelector("#tokenTemplateSearchInput");
const tokenTemplateList = document.querySelector("#tokenTemplateList");
const copySelectedPermanentTokenButton = document.querySelector("#copySelectedPermanentTokenButton");
const closeGenericTokenDialogButton = document.querySelector("#closeGenericTokenDialogButton");
const removeAllTokensButton = document.querySelector("#removeAllTokensButton");
const removeCustomTokensButton = document.querySelector("#removeCustomTokensButton");
const quickToast = document.querySelector("#quickToast");

let quickToastHideTimer = 0;
let quickToastResetTimer = 0;
let automationDialogTimer = 0;
let archiveSearchQuery = "";
let boardGestureState = null;
let suppressedTileClick = {
  permanentId: "",
  expiresAt: 0,
};
let timerRenderInterval = 0;

document.querySelectorAll("[data-field][data-delta]").forEach((button) => {
  button.addEventListener("click", () => {
    updateScalarField(button.dataset.field, Number(button.dataset.delta));
  });
});

renameButton.addEventListener("click", renamePlayer);
quickResetButton.addEventListener("click", resetLife);
optionsButton.addEventListener("click", () => showDialog(optionsDialog));
boardOptionsButton.addEventListener("click", () => showDialog(boardOptionsDialog));

renameAction.addEventListener("click", renamePlayer);
nameSettingsForm?.addEventListener("submit", handleNameSettingsSubmit);
closeNameSettingsButton?.addEventListener("click", () => nameSettingsDialog.close());
resetLifeAction.addEventListener("click", resetLife);
resetAllAction.addEventListener("click", resetAll);
openBoardStateAction.addEventListener("click", () => {
  closeAllDialogs();
  showBoardStatePage();
});
openCounterTrayAction.addEventListener("click", () => swapDialog(optionsDialog, counterSheetDialog));
openDamageTrayAction.addEventListener("click", () => swapDialog(optionsDialog, damageSheetDialog));
openSettingsManualAction?.addEventListener("click", () => swapDialog(optionsDialog, settingsManualDialog));
connectWifiAction.addEventListener("click", handleWifiConnectionPreview);
connectBluetoothAction.addEventListener("click", handleBluetoothConnectionPreview);
connectSimulatedAction.addEventListener("click", startSimulatedLocalConnection);
viewConnectedPlayersAction.addEventListener("click", () => swapDialog(optionsDialog, connectedPlayersDialog));
boardOptionsMultiplayerButton.addEventListener("click", () => swapDialog(boardOptionsDialog, multiplayerHubDialog));
boardOptionsTotalsButton.addEventListener("click", toggleBoardTotalsVisibility);
boardOptionsAutomationToggleButton.addEventListener("click", toggleAutomationGlobally);
boardOptionsSettingsManualButton?.addEventListener("click", () => swapDialog(boardOptionsDialog, settingsManualDialog));
boardOptionsExpandButton.addEventListener("click", () => setAllPermanentsExpanded(true));
boardOptionsCollapseButton.addEventListener("click", () => setAllPermanentsExpanded(false));
boardOptionsClearSelectionButton.addEventListener("click", clearPermanentSelection);
boardOptionsAutomationButton.addEventListener("click", () => swapDialog(boardOptionsDialog, automationRulesDialog));
boardOptionsResetButton.addEventListener("click", resetBoardState);
boardConnectWifiAction.addEventListener("click", handleBoardWifiConnectionPreview);
boardConnectBluetoothAction.addEventListener("click", handleBoardBluetoothConnectionPreview);
boardConnectSimulatedAction.addEventListener("click", startBoardSimulatedLocalConnection);
boardViewConnectedPlayersAction.addEventListener("click", () => swapDialog(multiplayerHubDialog, connectedPlayersDialog));
damageTrackerCountDec.addEventListener("click", () => adjustDamageTrackerCount(-1));
damageTrackerCountInc.addEventListener("click", () => adjustDamageTrackerCount(1));
playerCounterOptionsButton.addEventListener("click", () => swapDialog(counterSheetDialog, optionsDialog));
damageOptionsButton.addEventListener("click", () => swapDialog(damageSheetDialog, optionsDialog));
connectedPlayersOptionsButton.addEventListener("click", () => swapDialog(connectedPlayersDialog, optionsDialog));
connectedPlayerBackButton.addEventListener("click", () => swapDialog(connectedPlayerViewDialog, connectedPlayersDialog));
automationAddTriggerButton.addEventListener("click", promptAndAddTrigger);
automationToggleAllButton?.addEventListener("click", toggleAutomationGlobally);
automationUndoButton?.addEventListener("click", undoLastAutomationResult);
trackerPageButton.addEventListener("click", showPreviousPage);
boardStatePageButton.addEventListener("click", showNextPage);
archiveSearchInput?.addEventListener("input", handleArchiveSearchInput);

nextPhaseButton.addEventListener("click", advanceBoardPhase);
boardSearchForm.addEventListener("submit", handleBoardSearchSubmit);
boardSearchInput.addEventListener("input", handleBoardSearchInput);
boardSearchResults.addEventListener("click", handleBoardSearchResultClick);
addSelectedCardButton?.addEventListener("click", addSelectedCardToBattlefield);
boardSearchCancelButtons.forEach((button) => {
  button.addEventListener("click", handleCancelBoardSearch);
});
manualAddButton?.addEventListener("click", handleBoardManualAdd);
addCreatureButton?.addEventListener("click", () => promptAndAddPermanent({ isToken: false, isNonCreature: false }));
addTokenButton?.addEventListener("click", promptCreateGenericToken);
addEffectButton?.addEventListener("click", promptAndAddEffect);
addTriggerButton?.addEventListener("click", promptAndAddTrigger);
toggleBoardControlsButton?.addEventListener("click", toggleBoardControlsExpanded);
expandAllButton?.addEventListener("click", () => setAllPermanentsExpanded(true));
collapseAllButton?.addEventListener("click", () => setAllPermanentsExpanded(false));
removeAllBattlefieldButton?.addEventListener("click", () => showDialog(bulkRemoveDialog));
battlefieldAddCounterButton?.addEventListener("click", () => showDialog(battlefieldCounterDialog));
confirmCounterSelectionButton?.addEventListener("click", confirmBattlefieldCounterSelection);
toggleBoardTotalsButton.addEventListener("click", toggleBoardTotalsVisibility);
attackSelectedButton.addEventListener("click", () => beginCombatSimulation("selected"));
attackAllButton.addEventListener("click", () => beginCombatSimulation("all"));
confirmCombatButton?.addEventListener("click", confirmCombatSimulation);
clearAttackersButton.addEventListener("click", clearCombatAttackers);
clearSelectionButton.addEventListener("click", clearPermanentSelection);
globalUndoAction?.addEventListener("click", undoLastCompanionAction);
lifeRollbackAction?.addEventListener("click", rollbackLifeWithinBuffer);
floatingManaGrid?.addEventListener("click", handleFloatingManaClick);
counterTypeForm?.addEventListener("submit", handleCounterTypeSubmit);
counterTypeInput?.addEventListener("input", renderCounterTypeDialog);
cancelCounterTypeButton?.addEventListener("click", handleCounterTypeCancel);
counterTypeDialog?.addEventListener("close", handleCounterTypeDialogClose);
document.addEventListener("click", handleDocumentSearchClick);

counterToggleInputs.forEach((input) => {
  input.addEventListener("change", () => {
    setPlayerCounterEnabled(input.dataset.counterToggle, input.checked);
  });
});

playerCounterList.addEventListener("click", handleCounterClick);
counterInlineList.addEventListener("click", handleCounterClick);
commanderDamageList.addEventListener("click", handleDamageClick);
damageInlineList.addEventListener("click", handleDamageClick);
connectedPlayersList.addEventListener("click", handleConnectedPlayersListClick);
connectedPlayerViewTabs.addEventListener("click", handleConnectedPlayerViewTabClick);
connectedPlayerViewContent.addEventListener("click", handleConnectedPlayerViewContentClick);
automationRulesList?.addEventListener("click", handleAutomationRulesListClick);
automationSuggestionsList?.addEventListener("click", handleAutomationSuggestionsClick);
automationManualList?.addEventListener("click", handleAutomationManualTriggersClick);
genericTokenForm?.addEventListener("submit", handleGenericTokenSubmit);
closeGenericTokenDialogButton?.addEventListener("click", () => genericTokenDialog.close());
tokenTemplateSearchInput?.addEventListener("input", renderTokenTemplateList);
tokenTemplateList?.addEventListener("click", handleTokenTemplateClick);
copySelectedPermanentTokenButton?.addEventListener("click", handleCopySelectedPermanentToken);
removeAllTokensButton?.addEventListener("click", removeAllTokensFromBoard);
removeCustomTokensButton?.addEventListener("click", promptRemoveCustomTokenAmount);
cardDetailDialog?.addEventListener("close", clearExpandedCardState);
castCommanderButton?.addEventListener("click", castCommanderFromCommandZone);
commanderNavBadge?.addEventListener("pointerdown", handleCommanderBadgePointerDown);
commanderNavBadge?.addEventListener("pointerup", handleCommanderBadgePointerEnd);
commanderNavBadge?.addEventListener("pointercancel", handleCommanderBadgePointerEnd);
commanderNavBadge?.addEventListener("pointerleave", handleCommanderBadgePointerEnd);
commanderNavBadge?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

[effectStrip, battlefieldGrid].forEach((container) => {
  container.addEventListener("pointerdown", handleBoardGestureStart, { passive: true });
  container.addEventListener("pointermove", handleBoardGestureMove, { passive: true });
  container.addEventListener("pointerup", handleBoardGestureEnd);
  container.addEventListener("pointercancel", handleBoardGestureCancel);
  container.addEventListener("pointerleave", handleBoardGestureCancel);
  container.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-board-action][data-permanent-id]");
    if (!actionButton) {
      return;
    }

    if (
      actionButton.dataset.boardAction === "toggle-select" &&
      actionButton.dataset.permanentId === suppressedTileClick.permanentId &&
      Date.now() <= suppressedTileClick.expiresAt
    ) {
      return;
    }

    handleBoardAction(actionButton.dataset.boardAction, actionButton.dataset.permanentId);
  });
});

[optionsDialog, nameSettingsDialog, counterSheetDialog, damageSheetDialog, connectedPlayersDialog, connectedPlayerViewDialog, boardOptionsDialog, bulkRemoveDialog, multiplayerHubDialog, automationRulesDialog, cardDetailDialog, genericTokenDialog, battlefieldCounterDialog, counterTypeDialog, commanderActionDialog, settingsManualDialog].forEach((dialog) => {
  if (!dialog) {
    return;
  }
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
});

bulkRemoveDialog?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bulk-destroy-option]");
  if (!button) {
    return;
  }

  destroyAllMatchingPermanents(button.dataset.bulkDestroyOption || "");
});

battlefieldCounterDialog?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-battlefield-counter-target]");
  if (!button) {
    return;
  }

  handleBattlefieldCounterTargetMode(button.dataset.battlefieldCounterTarget || "");
});

pageViewport.addEventListener("scroll", handlePageViewportScroll, { passive: true });
window.addEventListener("resize", handleViewportResize);
window.addEventListener("load", () => {
  syncPageViewport({ behavior: "auto" });
});
window.addEventListener("hashchange", syncPageWithHash);

setupBoardStateLayout();
render();
startTimerRendering();
syncPageWithHash();
window.requestAnimationFrame(() => {
  syncPageViewport({ behavior: "auto" });
});

function createDefaultState() {
  return {
    playerName: "Player 1",
    life: 40,
    tax: 0,
    mana: 0,
    playerCounters: createDefaultPlayerCounters(),
    commanderDamageTrackers: [createCommanderDamageTracker()],
    commander: createDefaultCommanderState(),
    companion: createDefaultCompanionState(),
    boardState: createDefaultBoardState(),
    multiplayer: createDefaultMultiplayerState(),
    archive: createDefaultArchiveState(),
    runtime: createDefaultRuntimeState(),
  };
}

function createDefaultBoardState() {
  return {
    currentPhaseIndex: 0,
    controlsExpanded: false,
    triggersExpanded: false,
    permanents: [],
    triggers: [],
    automationRules: [],
    automationSuggestions: [],
    automationLog: [],
    recentCounterTypes: [...DEFAULT_RECENT_COUNTER_TYPES],
    automationEnabled: true,
    lastAutomationUndo: null,
    combatState: createDefaultCombatState(),
  };
}

function createDefaultCombatState() {
  return {
    attackerIds: [],
    mode: "none",
    summary: "",
    confirmed: false,
  };
}

function createDefaultMultiplayerState() {
  return {
    sessionCode: "",
    isSessionActive: false,
    connectionMode: "standalone",
    connectedPlayers: [],
  };
}

function createDefaultArchiveState() {
  return {
    games: [],
    commanderDecks: {},
  };
}

function createDefaultCommanderState() {
  return {
    name: "",
    scryfallId: "",
    manaCost: "",
    typeLine: "",
    oracleText: "",
    imageUrl: "",
    cardImageUrl: "",
    colorIdentity: [],
    power: 0,
    toughness: 0,
    loyalty: 0,
    legalities: {},
    zone: "none",
    castCount: 0,
    commanderTax: 0,
    damageByOpponent: {},
    isLegal: false,
    legalityReason: "No commander selected.",
  };
}

function createDefaultRuntimeState() {
  const now = Date.now();
  return {
    gameStartedAt: now,
    turnStartedAt: now,
    phaseStartedAt: now,
    turnNumber: 1,
    phaseDurations: {},
    turnDurations: [],
    combatDurationMs: 0,
  };
}

function createDefaultPlayerCounters() {
  return PLAYER_COUNTER_DEFS.reduce((accumulator, counter) => {
    accumulator[counter.id] = {
      enabled: false,
      value: 0,
    };
    return accumulator;
  }, {});
}

function createCommanderDamageTracker(source = {}) {
  return {
    label: normalizeLabel(source.label, "Opponent"),
    value: normalizeCount(source.value),
  };
}

/**
 * @param {Partial<Permanent>} source
 * @returns {Permanent}
 */
function createPermanent(source = {}) {
  const isNonCreature = Boolean(source.isNonCreature);
  const isCreature = source.isCreature === undefined ? !isNonCreature : Boolean(source.isCreature);
  const fallbackEffectMetadata = getEffectMetadataFromText(source.oracleText || source.notes || "");
  const normalizedCounters = normalizePermanentCounters(source.counters);
  const sourceTypeLine = typeof source.typeLine === "string" ? source.typeLine.trim() : "";
  const isPlaneswalker = source.isPlaneswalker === undefined ? hasTypeLine(sourceTypeLine, "Planeswalker") : Boolean(source.isPlaneswalker);
  const colorIdentity = Array.isArray(source.colorIdentity)
    ? Array.from(new Set(source.colorIdentity.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean)))
    : [];
  const plusOneCounters = normalizeCount(source.plusOneCounters, normalizeCount(normalizedCounters["+1/+1"]));
  const minusOneCounters = normalizeCount(source.minusOneCounters, normalizeCount(normalizedCounters["-1/-1"]));
  const staticBuffRules = normalizeStaticBuffRules(source.staticBuffRules, {
    power: source.staticBuffPower || fallbackEffectMetadata.staticBuffPower,
    toughness: source.staticBuffToughness || fallbackEffectMetadata.staticBuffToughness,
    appliesTo: source.staticBuffAppliesTo || fallbackEffectMetadata.staticBuffAppliesTo,
    excludesSelf: source.staticBuffExcludesSelf || fallbackEffectMetadata.staticBuffExcludesSelf,
  });
  if (plusOneCounters > 0) {
    normalizedCounters["+1/+1"] = plusOneCounters;
  } else {
    delete normalizedCounters["+1/+1"];
  }
  if (minusOneCounters > 0) {
    normalizedCounters["-1/-1"] = minusOneCounters;
  } else {
    delete normalizedCounters["-1/-1"];
  }

  return {
    id: source.id || createId(),
    scryfallId: typeof source.scryfallId === "string" ? source.scryfallId.trim() : "",
    name: normalizeLabel(source.name, "Permanent"),
    manaCost: typeof source.manaCost === "string" ? source.manaCost.trim() : "",
    typeLine: typeof source.typeLine === "string" ? source.typeLine.trim() : "",
    oracleText: typeof source.oracleText === "string" ? source.oracleText.trim() : "",
    imageUrl: typeof source.imageUrl === "string" ? source.imageUrl.trim() : "",
    cardImageUrl: typeof source.cardImageUrl === "string" ? source.cardImageUrl.trim() : "",
    rulingsUri: typeof source.rulingsUri === "string" ? source.rulingsUri.trim() : "",
    rulings: Array.isArray(source.rulings)
      ? source.rulings
          .map((entry) => ({
            source: normalizeLabel(entry?.source, "Scryfall Ruling"),
            publishedAt: typeof entry?.publishedAt === "string" ? entry.publishedAt.trim() : "",
            comment: typeof entry?.comment === "string" ? entry.comment.trim() : "",
          }))
          .filter((entry) => entry.comment)
      : [],
    legalities: normalizeLegalities(source.legalities),
    colorIdentity,
    power: normalizeSignedCount(source.power),
    toughness: normalizeSignedCount(source.toughness),
    printedLoyalty: normalizeSignedCount(source.printedLoyalty ?? source.loyalty, 0),
    quantity: Math.max(1, normalizeCount(source.quantity, 1)),
    isToken: Boolean(source.isToken),
    isNonCreature,
    isLegendary: Boolean(source.isLegendary),
    isArtifact: Boolean(source.isArtifact),
    isCreature,
    isPlaneswalker,
    isCommander: Boolean(source.isCommander),
    commanderOwnerName: normalizeLabel(source.commanderOwnerName, ""),
    commanderCastNumber: normalizeCount(source.commanderCastNumber, 0),
    loyaltyActivatedTurn: normalizeCount(source.loyaltyActivatedTurn, 0),
    plusOneCounters,
    minusOneCounters,
    counters: normalizedCounters,
    doublesTokens: Boolean(source.doublesTokens) || Boolean(fallbackEffectMetadata.doublesTokens),
    doublesCounters: Boolean(source.doublesCounters) || Boolean(fallbackEffectMetadata.doublesCounters),
    counterModifierBonus: Math.max(
      normalizeCount(source.counterModifierBonus),
      normalizeCount(fallbackEffectMetadata.counterModifierBonus)
    ),
    createsTokens: Boolean(source.createsTokens) || Boolean(fallbackEffectMetadata.createsTokens),
    addsCounters: Boolean(source.addsCounters) || Boolean(fallbackEffectMetadata.addsCounters),
    staticBuffPower: normalizeSignedCount(source.staticBuffPower, normalizeSignedCount(fallbackEffectMetadata.staticBuffPower)),
    staticBuffToughness: normalizeSignedCount(source.staticBuffToughness, normalizeSignedCount(fallbackEffectMetadata.staticBuffToughness)),
    staticBuffAppliesTo:
      typeof source.staticBuffAppliesTo === "string" && source.staticBuffAppliesTo.trim()
        ? source.staticBuffAppliesTo.trim()
        : fallbackEffectMetadata.staticBuffAppliesTo || "",
    staticBuffExcludesSelf: Boolean(source.staticBuffExcludesSelf) || Boolean(fallbackEffectMetadata.staticBuffExcludesSelf),
    staticBuffRules,
    temporaryPowerUntilTurnEnd: normalizeSignedCount(source.temporaryPowerUntilTurnEnd),
    temporaryToughnessUntilTurnEnd: normalizeSignedCount(source.temporaryToughnessUntilTurnEnd),
    temporaryPowerUntilCombatEnd: normalizeSignedCount(source.temporaryPowerUntilCombatEnd),
    temporaryToughnessUntilCombatEnd: normalizeSignedCount(source.temporaryToughnessUntilCombatEnd),
    isExpanded: Boolean(source.isExpanded),
    isSelected: Boolean(source.isSelected),
    isFaceDown: Boolean(source.isFaceDown),
    faceDownLabel: normalizeLabel(source.faceDownLabel, DEFAULT_FACE_DOWN_LABEL),
    revealAllowed: Boolean(source.revealAllowed),
    isHiddenToOpponents: Boolean(source.isHiddenToOpponents),
    automationRules: Array.isArray(source.automationRules)
      ? source.automationRules.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    autoRulesEnabled: Boolean(source.autoRulesEnabled),
    hasResolvedEtbTriggers: Boolean(source.hasResolvedEtbTriggers),
    isTapped: Boolean(source.isTapped),
    summoningSickness: Boolean(source.summoningSickness),
    isAttacking: Boolean(source.isAttacking),
    isBlocking: Boolean(source.isBlocking),
    notes: typeof source.notes === "string" ? source.notes.trim() : "",
    attachedToId: typeof source.attachedToId === "string" ? source.attachedToId.trim() : "",
    attachmentKind: typeof source.attachmentKind === "string" ? source.attachmentKind.trim() : "",
  };
}

/**
 * @param {Partial<Trigger>} source
 * @returns {Trigger}
 */
function createTrigger(source = {}) {
  const triggerEvent = TRIGGER_EVENTS.includes(source.triggerEvent) ? source.triggerEvent : "Phase";
  const actionType = normalizeTriggerAction(source.actionType);

  return {
    id: source.id || createId(),
    triggerEvent,
    phase: triggerEvent === "Phase" ? normalizePhase(source.phase) : "",
    actionType,
    target: normalizeTriggerTarget(source.target),
    value: normalizeCount(source.value),
    tokenName: typeof source.tokenName === "string" ? source.tokenName.trim() : "",
    tokenManaCost: typeof source.tokenManaCost === "string" ? source.tokenManaCost.trim() : "",
    tokenPower: normalizeSignedCount(source.tokenPower),
    tokenToughness: normalizeSignedCount(source.tokenToughness),
    tokenTapped: Boolean(source.tokenTapped),
    tokenAttacking: Boolean(source.tokenAttacking),
    valueMode: normalizeValueMode(source.valueMode),
    counterType: normalizeCounterType(source.counterType || (actionType === "Add +1/+1 Counters" ? "+1/+1" : "")),
    counterTargetEntity: normalizeCounterTargetEntity(source.counterTargetEntity),
  };
}

/**
 * @param {Partial<AutomationRule>} source
 * @returns {AutomationRule}
 */
function createAutomationRule(source = {}) {
  return {
    id: source.id || createId(),
    sourcePermanentId: typeof source.sourcePermanentId === "string" ? source.sourcePermanentId.trim() : "",
    sourceCardName: normalizeLabel(source.sourceCardName, "Permanent"),
    triggerType: normalizeLabel(source.triggerType, "Phase"),
    phase: typeof source.phase === "string" ? source.phase.trim() : "",
    eventType: normalizeLabel(source.eventType, ""),
    eventSourceScope: normalizeAutomationEventSourceScope(source.eventSourceScope),
    actionType: normalizeAutomationAction(source.actionType),
    targetType: normalizeAutomationTarget(source.targetType),
    value: normalizeSignedCount(source.value),
    tokenName: typeof source.tokenName === "string" ? source.tokenName.trim() : "",
    tokenManaCost: typeof source.tokenManaCost === "string" ? source.tokenManaCost.trim() : "",
    tokenPower: normalizeSignedCount(source.tokenPower),
    tokenToughness: normalizeSignedCount(source.tokenToughness),
    tokenTapped: Boolean(source.tokenTapped),
    tokenAttacking: Boolean(source.tokenAttacking),
    valueMode: normalizeValueMode(source.valueMode),
    counterType: normalizeCounterType(source.counterType),
    counterTargetEntity: normalizeCounterTargetEntity(source.counterTargetEntity),
    buffPower: normalizeSignedCount(source.buffPower),
    buffToughness: normalizeSignedCount(source.buffToughness),
    buffDuration: normalizeAutomationBuffDuration(source.buffDuration),
    requiresTargetSelection: Boolean(source.requiresTargetSelection),
    optionalTarget: Boolean(source.optionalTarget),
    repeatBehavior: normalizeLabel(source.repeatBehavior, "per-event"),
    enabled: source.enabled !== false,
    askBeforeRun: Boolean(source.askBeforeRun),
    confidence: normalizeAutomationConfidence(source.confidence),
    sourceEvidence: Array.isArray(source.sourceEvidence)
      ? source.sourceEvidence
          .map((entry) => ({
            source: normalizeLabel(entry?.source, "Oracle Text"),
            summary: typeof entry?.summary === "string" ? entry.summary.trim() : "",
            url: typeof entry?.url === "string" ? entry.url.trim() : "",
          }))
          .filter((entry) => entry.summary)
      : [],
    reasonSummary: typeof source.reasonSummary === "string" ? source.reasonSummary.trim() : "",
  };
}

function loadState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createDefaultState();
    }

    return normalizeState(JSON.parse(saved));
  } catch {
    return createDefaultState();
  }
}

function normalizeState(source = {}) {
  return {
    playerName: normalizeLabel(source.playerName, defaultState.playerName),
    life: normalizeCount(source.life, defaultState.life),
    tax: normalizeCount(source.tax),
    mana: normalizeCount(source.mana),
    playerCounters: PLAYER_COUNTER_DEFS.reduce((accumulator, counter) => {
      const savedCounter = source.playerCounters?.[counter.id] ?? {};
      accumulator[counter.id] = {
        enabled: Boolean(savedCounter.enabled),
        value: normalizeCount(savedCounter.value),
      };
      return accumulator;
    }, {}),
    commanderDamageTrackers: normalizeCommanderDamageTrackers(source.commanderDamageTrackers),
    commander: normalizeCommanderState(source.commander),
    companion: normalizeCompanionState(source.companion),
    boardState: normalizeBoardState(source.boardState),
    multiplayer: normalizeMultiplayerState(source.multiplayer),
    archive: normalizeArchiveState(source.archive),
    runtime: normalizeRuntimeState(source.runtime),
  };
}

function normalizeCommanderState(source = {}) {
  const base = createDefaultCommanderState();
  const colorIdentity = Array.isArray(source.colorIdentity)
    ? Array.from(new Set(source.colorIdentity.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean)))
    : [];
  const zone = ["none", "command", "battlefield", "library", "hand", "graveyard", "exile"].includes(source.zone)
    ? source.zone
    : base.zone;

  return {
    ...base,
    name: normalizeLabel(source.name, base.name),
    scryfallId: normalizeLabel(source.scryfallId || source.id, base.scryfallId),
    manaCost: normalizeLabel(source.manaCost || source.mana_cost, base.manaCost),
    typeLine: normalizeLabel(source.typeLine || source.type_line, base.typeLine),
    oracleText: normalizeLabel(source.oracleText || source.oracle_text, base.oracleText),
    imageUrl: normalizeLabel(source.imageUrl || source.cardImageUrl || "", base.imageUrl),
    cardImageUrl: normalizeLabel(source.cardImageUrl || source.imageUrl || "", base.cardImageUrl),
    colorIdentity,
    power: normalizeSignedCount(source.power, 0),
    toughness: normalizeSignedCount(source.toughness, 0),
    loyalty: normalizeSignedCount(source.loyalty ?? source.printedLoyalty, 0),
    legalities: normalizeLegalities(source.legalities),
    zone,
    castCount: normalizeCount(source.castCount, 0),
    commanderTax: normalizeCount(source.commanderTax, 0),
    damageByOpponent:
      source.damageByOpponent && typeof source.damageByOpponent === "object"
        ? Object.entries(source.damageByOpponent).reduce((accumulator, [opponentId, value]) => {
            accumulator[opponentId] = normalizeCount(value, 0);
            return accumulator;
          }, {})
        : {},
    isLegal: Boolean(source.isLegal),
    legalityReason: normalizeLabel(source.legalityReason, base.legalityReason),
  };
}

function normalizeCommanderDamageTrackers(trackers) {
  if (!Array.isArray(trackers) || trackers.length === 0) {
    return [createCommanderDamageTracker()];
  }

  return trackers.slice(0, MAX_COMMANDER_DAMAGE_TRACKERS).map((tracker) => createCommanderDamageTracker(tracker));
}

function normalizeBoardState(boardState = {}) {
  const automationRules = Array.isArray(boardState.automationRules)
    ? boardState.automationRules.map((rule) => createAutomationRule(rule))
    : [];
  const automationSuggestions = filterAutomationSuggestionsAgainstRules(
    automationRules,
    Array.isArray(boardState.automationSuggestions)
      ? boardState.automationSuggestions.map((rule) => createAutomationRule(rule))
      : []
  );

  const normalizedBoardState = {
    currentPhaseIndex: normalizePhaseIndex(boardState.currentPhaseIndex),
    controlsExpanded: Boolean(boardState.controlsExpanded),
    triggersExpanded: Boolean(boardState.triggersExpanded),
    permanents: Array.isArray(boardState.permanents) ? boardState.permanents.map((permanent) => createPermanent(permanent)) : [],
    triggers: Array.isArray(boardState.triggers) ? boardState.triggers.map((trigger) => createTrigger(trigger)) : [],
    automationRules,
    automationSuggestions,
    automationLog: Array.isArray(boardState.automationLog)
      ? boardState.automationLog
          .map((entry) => createAutomationLogEntry(entry))
          .filter((entry) => entry.id)
      : [],
    recentCounterTypes: normalizeRecentCounterTypes(boardState.recentCounterTypes),
    automationEnabled: boardState.automationEnabled !== false,
    lastAutomationUndo: boardState.lastAutomationUndo ? normalizeBoardStateSnapshot(boardState.lastAutomationUndo) : null,
    combatState: normalizeCombatState(boardState.combatState),
  };

  return ensureBoardStateAutomationCoverage(normalizedBoardState);
}

function normalizeCombatState(combatState = {}) {
  return {
    attackerIds: Array.isArray(combatState.attackerIds) ? combatState.attackerIds.filter((id) => typeof id === "string") : [],
    mode: normalizeCombatMode(combatState.mode),
    summary: typeof combatState.summary === "string" ? combatState.summary.trim() : "",
    confirmed: Boolean(combatState.confirmed),
  };
}

function normalizeMultiplayerState(multiplayer = {}) {
  return {
    sessionCode: normalizeSessionCode(multiplayer.sessionCode),
    isSessionActive: Boolean(multiplayer.isSessionActive),
    connectionMode: normalizeLabel(multiplayer.connectionMode, "standalone"),
    connectedPlayers: Array.isArray(multiplayer.connectedPlayers)
      ? multiplayer.connectedPlayers.map((player) => createConnectedPlayer(player))
      : [],
  };
}

function normalizeArchiveState(archiveState = {}) {
  const games = Array.isArray(archiveState.games)
    ? archiveState.games
        .map((game) => ({
          id: normalizeLabel(game?.id, createId()),
          endedAt: normalizeTimestamp(game?.endedAt),
          durationMs: Math.max(0, Number(game?.durationMs) || 0),
          commanderName: normalizeLabel(game?.commanderName, "Commander"),
          lifeEnd: normalizeCount(game?.lifeEnd, 0),
          winner: normalizeLabel(game?.winner, "Unknown"),
          totals: {
            power: normalizeCount(game?.totals?.power, 0),
            toughness: normalizeCount(game?.totals?.toughness, 0),
            damage: normalizeCount(game?.totals?.damage, 0),
            prevented: normalizeCount(game?.totals?.prevented, 0),
            triggers: normalizeCount(game?.totals?.triggers, 0),
            tokens: normalizeCount(game?.totals?.tokens, 0),
            counters: normalizeCount(game?.totals?.counters, 0),
            manaPeak: normalizeCount(game?.totals?.manaPeak, 0),
            boardPeak: normalizeCount(game?.totals?.boardPeak, 0),
          },
          notes: normalizeLabel(game?.notes, ""),
          recentActions: Array.isArray(game?.recentActions)
            ? game.recentActions
                .map((entry) => normalizeLabel(entry, ""))
                .filter(Boolean)
                .slice(0, 8)
            : [],
          eventLog: Array.isArray(game?.eventLog)
            ? game.eventLog
                .map((entry) => ({
                  type: normalizeLabel(entry?.type, "event"),
                  summary: normalizeLabel(entry?.summary, "Action"),
                  timestamp: normalizeTimestamp(entry?.timestamp),
                  payload: entry?.payload && typeof entry.payload === "object" ? entry.payload : {},
                }))
                .slice(-300)
            : [],
          turnDurations: Array.isArray(game?.turnDurations)
            ? game.turnDurations.map((value) => Math.max(0, Number(value) || 0)).slice(-100)
            : [],
          phaseDurations:
            game?.phaseDurations && typeof game.phaseDurations === "object"
              ? Object.entries(game.phaseDurations).reduce((accumulator, [phase, value]) => {
                  accumulator[normalizePhase(phase)] = Math.max(0, Number(value) || 0);
                  return accumulator;
                }, {})
              : {},
        }))
        .slice(0, 200)
    : [];
  return {
    games,
    commanderDecks: normalizeCommanderDeckArchives(archiveState.commanderDecks),
  };
}

function normalizeCommanderDeckArchives(commanderDecks = {}) {
  if (!commanderDecks || typeof commanderDecks !== "object") {
    return {};
  }

  return Object.entries(commanderDecks).reduce((accumulator, [rawKey, deck]) => {
    const commanderName = normalizeLabel(deck?.commanderName, normalizeLabel(rawKey, "Commander"));
    const commanderKey = getCommanderDeckKey(commanderName);
    const seenCards = new Set();
    const cards = Array.isArray(deck?.cards)
      ? deck.cards
          .map((card) => normalizeCommanderDeckCard(card))
          .filter((card) => {
            if (!card.name || seenCards.has(card.key)) {
              return false;
            }
            seenCards.add(card.key);
            return true;
          })
          .slice(0, 150)
      : [];
    const usedCards = normalizeCommanderUsedCards(deck?.usedCards);

    accumulator[commanderKey] = {
      commanderName,
      cards,
      usedCards,
      games: Array.isArray(deck?.games) ? deck.games.slice(-100) : [],
    };
    return accumulator;
  }, {});
}

function normalizeCommanderDeckCard(card = {}) {
  const name = normalizeLabel(card.name, "Card");
  const manaCost = normalizeLabel(card.manaCost || card.mana_cost, "");
  const typeLine = normalizeLabel(card.typeLine || card.type_line, "");
  const oracleText = normalizeLabel(card.oracleText || card.oracle_text, "");
  const scryfallId = normalizeLabel(card.scryfallId || card.id, "");
  const imageUrl =
    normalizeLabel(card.imageUrl || card.cardImageUrl || card.image_uris?.normal || card.image_uris?.large, "");
  const key = getCommanderCardKey({
    scryfallId,
    name,
    manaCost,
    typeLine,
  });

  return {
    key,
    scryfallId,
    name,
    manaCost,
    typeLine,
    oracleText,
    imageUrl,
    cardImageUrl: normalizeLabel(card.cardImageUrl || imageUrl, ""),
    legalities: normalizeLegalities(card.legalities),
    colorIdentity: Array.isArray(card.colorIdentity)
      ? card.colorIdentity.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean)
      : [],
    addedAt: normalizeTimestamp(card.addedAt),
    lastUsedAt: normalizeTimestamp(card.lastUsedAt || card.addedAt),
    usageCount: normalizeCount(card.usageCount, 0),
  };
}

function normalizeCommanderUsedCards(usedCards = {}) {
  if (!usedCards || typeof usedCards !== "object") {
    return {};
  }

  return Object.entries(usedCards).reduce((accumulator, [rawKey, entry]) => {
    const key = normalizeLabel(rawKey, "");
    if (!key) {
      return accumulator;
    }

    accumulator[key] = {
      name: normalizeLabel(entry?.name, "Card"),
      count: normalizeCount(entry?.count, 0),
      lastUsedAt: normalizeTimestamp(entry?.lastUsedAt),
    };
    return accumulator;
  }, {});
}

function normalizeRuntimeState(runtimeState = {}) {
  const now = Date.now();
  const gameStartedAt = normalizeTimestamp(runtimeState.gameStartedAt);
  const phaseDurations =
    runtimeState.phaseDurations && typeof runtimeState.phaseDurations === "object"
      ? Object.entries(runtimeState.phaseDurations).reduce((accumulator, [phase, value]) => {
          accumulator[normalizePhase(phase)] = Math.max(0, Number(value) || 0);
          return accumulator;
        }, {})
      : {};

  return {
    gameStartedAt,
    turnStartedAt: normalizeTimestamp(runtimeState.turnStartedAt || gameStartedAt || now),
    phaseStartedAt: normalizeTimestamp(runtimeState.phaseStartedAt || gameStartedAt || now),
    turnNumber: Math.max(1, normalizeCount(runtimeState.turnNumber, 1)),
    phaseDurations,
    turnDurations: Array.isArray(runtimeState.turnDurations)
      ? runtimeState.turnDurations.map((value) => Math.max(0, Number(value) || 0)).slice(-100)
      : [],
    combatDurationMs: Math.max(0, Number(runtimeState.combatDurationMs) || 0),
  };
}

function createConnectedPlayer(source = {}) {
  return {
    id: normalizeLabel(source.id, createId()),
    displayName: normalizeLabel(source.displayName, "Connected Player"),
    connectionType: normalizeConnectionType(source.connectionType),
    isConnected: source.isConnected !== false,
    lastUpdated: normalizeTimestamp(source.lastUpdated),
    publicTrackerState: createPublicTrackerState(source.publicTrackerState),
    publicBoardState: createPublicBoardState(source.publicBoardState),
    permissions: createMultiplayerPermissions(source.permissions),
  };
}

function createPublicTrackerState(source = {}) {
  return {
    life: normalizeCount(source.life, 40),
    counters: PLAYER_COUNTER_DEFS.reduce((accumulator, counter) => {
      accumulator[counter.id] = normalizeCount(source.counters?.[counter.id]);
      return accumulator;
    }, {}),
    commanderDamage: Array.isArray(source.commanderDamage)
      ? source.commanderDamage.map((tracker) => ({
          label: normalizeLabel(tracker?.label, "Opponent"),
          value: normalizeCount(tracker?.value),
        }))
      : [],
  };
}

function createPublicBoardState(source = {}) {
  return {
    permanents: Array.isArray(source.permanents) ? source.permanents.map((permanent) => createPermanent(permanent)) : [],
    effects: Array.isArray(source.effects) ? source.effects.map((permanent) => createPermanent(permanent)) : [],
    currentPhase: normalizePhase(source.currentPhase),
    totalPower: normalizeCount(source.totalPower),
    totalToughness: normalizeCount(source.totalToughness),
  };
}

function createAutomationLogEntry(source = {}) {
  return {
    id: normalizeLabel(source.id, ""),
    timestamp: normalizeTimestamp(source.timestamp),
    sourceCardName: normalizeLabel(source.sourceCardName, "Automation"),
    actionSummary: normalizeLabel(source.actionSummary, "Automation updated the board."),
    modifierSummary: typeof source.modifierSummary === "string" ? source.modifierSummary.trim() : "",
    confirmationStatus: normalizeLabel(source.confirmationStatus, "Auto"),
    detailSummary: typeof source.detailSummary === "string" ? source.detailSummary.trim() : "",
  };
}

function normalizeBoardStateSnapshot(source = {}) {
  const automationRules = Array.isArray(source.automationRules)
    ? source.automationRules.map((rule) => createAutomationRule(rule))
    : [];
  const automationSuggestions = filterAutomationSuggestionsAgainstRules(
    automationRules,
    Array.isArray(source.automationSuggestions)
      ? source.automationSuggestions.map((rule) => createAutomationRule(rule))
      : []
  );

  const normalizedSnapshot = {
    currentPhaseIndex: normalizePhaseIndex(source.currentPhaseIndex),
    controlsExpanded: Boolean(source.controlsExpanded),
    triggersExpanded: Boolean(source.triggersExpanded),
    permanents: Array.isArray(source.permanents) ? source.permanents.map((permanent) => createPermanent(permanent)) : [],
    triggers: Array.isArray(source.triggers) ? source.triggers.map((trigger) => createTrigger(trigger)) : [],
    automationRules,
    automationSuggestions,
    automationLog: Array.isArray(source.automationLog)
      ? source.automationLog.map((entry) => createAutomationLogEntry(entry))
      : [],
    recentCounterTypes: normalizeRecentCounterTypes(source.recentCounterTypes),
    automationEnabled: source.automationEnabled !== false,
    lastAutomationUndo: null,
    combatState: normalizeCombatState(source.combatState),
  };

  return ensureBoardStateAutomationCoverage(normalizedSnapshot);
}

function normalizeRecentCounterTypes(counterTypes) {
  const normalized = Array.isArray(counterTypes)
    ? counterTypes
        .map((type) => normalizeCounterType(type))
        .filter((type) => Boolean(type))
    : [];
  const uniqueTypes = Array.from(new Set(normalized));
  const fallbackTypes = DEFAULT_RECENT_COUNTER_TYPES.filter((type) => !uniqueTypes.includes(type));
  return [...uniqueTypes, ...fallbackTypes].slice(0, MAX_RECENT_COUNTER_TYPES);
}

function ensureBoardStateAutomationCoverage(boardState) {
  if (!boardState || !Array.isArray(boardState.permanents) || boardState.permanents.length === 0) {
    return boardState;
  }

  let nextBoardState = boardState;
  nextBoardState.permanents.forEach((permanent) => {
    const referenceText = getPermanentReferenceText(permanent);
    if (!referenceText) {
      return;
    }

    const hasRuleLinked =
      nextBoardState.automationRules.some((rule) => rule.sourcePermanentId === permanent.id) ||
      nextBoardState.automationSuggestions.some((rule) => rule.sourcePermanentId === permanent.id) ||
      (Array.isArray(permanent.automationRules) && permanent.automationRules.length > 0);

    if (hasRuleLinked) {
      return;
    }

    const suggestions = buildAutomationSuggestions(permanent);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return;
    }

    nextBoardState = attachAutomationSuggestions(nextBoardState, permanent.id, permanent.name, suggestions);
  });

  return nextBoardState;
}

function createMultiplayerPermissions(source = {}) {
  return {
    canViewFaceDownCards: Boolean(source.canViewFaceDownCards),
  };
}

function normalizeCount(value, fallback = 0) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }

  return Math.max(0, Math.round(nextValue));
}

function normalizeSignedCount(value, fallback = 0) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }

  return Math.round(nextValue);
}

function normalizeLabel(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeLegalities(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, legality]) => {
    if (typeof legality === "string" && legality.trim()) {
      accumulator[key] = legality.trim();
    }
    return accumulator;
  }, {});
}

function normalizePhaseIndex(value) {
  const nextValue = Number(value);
  if (!Number.isInteger(nextValue)) {
    return 0;
  }

  return ((nextValue % PHASES.length) + PHASES.length) % PHASES.length;
}

function normalizePhase(value) {
  const normalized = normalizeLabel(value, PHASES[0]);
  const match = PHASES.find((phase) => phase.toLowerCase() === normalized.toLowerCase());
  return match || PHASES[0];
}

function normalizeConnectionType(value) {
  if (typeof value !== "string") {
    return "simulated";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "wifi" || normalized === "bluetooth" || normalized === "simulated") {
    return normalized;
  }

  return "simulated";
}

function normalizeMultiplayerViewMode(value) {
  if (typeof value !== "string") {
    return "tracker";
  }

  const normalized = value.trim().toLowerCase();
  const match = MULTIPLAYER_VIEW_MODES.find((mode) => mode.toLowerCase() === normalized);
  return match || "tracker";
}

function normalizeCombatMode(value) {
  if (typeof value !== "string") {
    return "none";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "selected" || normalized === "all" || normalized === "none") {
    return normalized;
  }

  return "none";
}

function normalizeSessionCode(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  return digits.length === 4 ? digits : "";
}

function createSessionCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizeTimestamp(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : Date.now();
}

function normalizeTriggerAction(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  const match = TRIGGER_ACTIONS.find((action) => action.toLowerCase() === normalized);
  return match || "";
}

function normalizeTriggerTarget(value) {
  if (typeof value !== "string") {
    return "All";
  }

  const normalized = value.trim().toLowerCase();
  const match = TRIGGER_TARGETS.find((target) => target.toLowerCase() === normalized);
  return match || "All";
}

function normalizeAutomationAction(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  const match = AUTOMATION_ACTIONS.find((action) => action.toLowerCase() === normalized);
  return match || normalizeLabel(value, "");
}

function normalizeAutomationTarget(value) {
  if (typeof value !== "string") {
    return "All";
  }

  return normalizeLabel(value, "All");
}

function normalizeCounterTargetEntity(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "creature" || normalized === "permanent") {
    return normalized;
  }

  return "";
}

function normalizeAutomationEventSourceScope(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  const supportedScopes = [
    "",
    "self",
    "any-creature",
    "another-creature",
    "any-token",
    "another-token",
    "any-enchantment",
    "another-enchantment",
    "any-permanent",
    "another-permanent",
  ];
  return supportedScopes.includes(normalized) ? normalized : "";
}

function normalizeAutomationBuffDuration(value) {
  if (typeof value !== "string") {
    return "until-end-of-turn";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "until-end-of-combat" ? "until-end-of-combat" : "until-end-of-turn";
}

function normalizeValueMode(value) {
  const normalized = normalizeLabel(value, "");
  return ["fixed", "source-plus-one-counters", "source-counters"].includes(normalized) ? normalized : "fixed";
}

function normalizePermanentCounters(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [rawType, rawCount]) => {
    const type = normalizeCounterType(rawType);
    const count = normalizeCount(rawCount);
    if (!type || count <= 0) {
      return accumulator;
    }

    accumulator[type] = count;
    return accumulator;
  }, {});
}

function normalizeStaticBuffRules(value, legacyBuff = {}) {
  const parsedRules = Array.isArray(value)
    ? value
        .map((entry) => ({
          power: normalizeSignedCount(entry?.power),
          toughness: normalizeSignedCount(entry?.toughness),
          appliesTo: normalizeLabel(entry?.appliesTo, ""),
          excludesSelf: Boolean(entry?.excludesSelf),
          creatureType: normalizeLabel(entry?.creatureType, ""),
        }))
        .filter((entry) => (entry.power !== 0 || entry.toughness !== 0) && entry.appliesTo)
    : [];

  if (parsedRules.length > 0) {
    return parsedRules;
  }

  const legacyPower = normalizeSignedCount(legacyBuff?.power);
  const legacyToughness = normalizeSignedCount(legacyBuff?.toughness);
  const legacyAppliesTo = normalizeLabel(legacyBuff?.appliesTo, "");
  if ((legacyPower !== 0 || legacyToughness !== 0) && legacyAppliesTo) {
    return [
      {
        power: legacyPower,
        toughness: legacyToughness,
        appliesTo: legacyAppliesTo,
        excludesSelf: Boolean(legacyBuff?.excludesSelf),
        creatureType: "",
      },
    ];
  }

  return [];
}

function normalizeAutomationConfidence(value) {
  const normalized = normalizeLabel(value, "Low");
  if (normalized === "High" || normalized === "Medium" || normalized === "Low") {
    return normalized;
  }

  return "Low";
}

function persistState() {
  if (state?.boardState) {
    const currentPhase = PHASES[normalizePhaseIndex(state.boardState.currentPhaseIndex)];
    const enchantmentResult = runEnchantmentEngine(state.boardState, {
      phase: currentPhase,
    });
    const sbaResult = runStateBasedActions(enchantmentResult.boardState || state.boardState);
    if (enchantmentResult.changed || sbaResult.changed) {
      const removedCommander = (state.boardState.permanents || []).find(
        (permanent) =>
          permanent.isCommander && !(sbaResult.boardState?.permanents || []).some((entry) => entry.id === permanent.id)
      );
      state = {
        ...state,
        commander: removedCommander
          ? normalizeCommanderState({ ...state.commander, zone: "command" })
          : state.commander,
        boardState: sbaResult.boardState,
      };
    }
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  cleanupExpiredLifeRollback();
  syncLocalPublicSnapshot();
  renderTrackerPage();
  renderBoardStatePage();
  renderStatsPage();
  renderArchivePage();
  renderLeaderboardsPage();
  renderMultiplayerUi();
  renderSettingsManualDialog();
}

function renderTrackerPage() {
  outputs.playerName.textContent = state.playerName;
  outputs.life.textContent = state.life;
  outputs.tax.textContent = state.tax;
  outputs.mana.textContent = state.mana;

  renderDamageSummary();
  renderCounterSummary();
  renderOptions();
  renderInlineCounterList();
  renderInlineDamageList();
  renderPlayerCounterList();
  renderCommanderDamageList();
}

function renderDamageSummary() {
  outputs.damageTrackerCountValue.textContent = state.commanderDamageTrackers.length;
  outputs.damageTrackerCountLabel.textContent = state.commanderDamageTrackers.length === 1 ? "Opp." : "Opps.";
  outputs.damageTrackerCountOptionValue.textContent = state.commanderDamageTrackers.length;
}

function renderCounterSummary() {
  const activeCounterCount = getEnabledPlayerCounters().length;
  outputs.activeCounterCountValue.textContent = activeCounterCount;
  outputs.activeCounterCountLabel.textContent = "Live";
}

function renderOptions() {
  counterToggleInputs.forEach((input) => {
    input.checked = state.playerCounters[input.dataset.counterToggle]?.enabled ?? false;
  });
}

function renderInlineCounterList() {
  const enabledCounters = getEnabledPlayerCounters();
  counterInlineList.hidden = enabledCounters.length === 0;
  counterInlineList.style.setProperty("--inline-scale", getInlineCounterScale(enabledCounters.length));
  counterInlineList.innerHTML = enabledCounters.map(renderInlineCounterChip).join("");
}

function renderInlineCounterChip(counterDef) {
  const counterState = state.playerCounters[counterDef.id];

  return `
    <article class="inline-tracker-chip">
      <span class="inline-tracker-label">${escapeHtml(counterDef.label)}</span>
      <div class="inline-tracker-stepper">
        <button class="step-button" type="button" data-counter-id="${counterDef.id}" data-delta="-1" aria-label="Decrease ${escapeHtml(counterDef.label)}">
          -
        </button>
        <output aria-live="polite">${counterState.value}</output>
        <button class="step-button" type="button" data-counter-id="${counterDef.id}" data-delta="1" aria-label="Increase ${escapeHtml(counterDef.label)}">
          +
        </button>
      </div>
    </article>
  `;
}

function renderInlineDamageList() {
  damageInlineList.style.setProperty("--inline-scale", getInlineDamageScale(state.commanderDamageTrackers.length));
  damageInlineList.innerHTML = state.commanderDamageTrackers
    .map((tracker, index) => {
      return `
        <article class="inline-tracker-chip">
          <button class="inline-tracker-label-button" type="button" data-damage-label-index="${index}">
            ${escapeHtml(tracker.label)}
          </button>
          <div class="inline-tracker-stepper">
            <button class="step-button" type="button" data-damage-index="${index}" data-delta="-1" aria-label="Decrease commander damage for ${escapeHtml(tracker.label)}">
              -
            </button>
            <output aria-live="polite">${tracker.value}</output>
            <button class="step-button" type="button" data-damage-index="${index}" data-delta="1" aria-label="Increase commander damage for ${escapeHtml(tracker.label)}">
              +
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPlayerCounterList() {
  const enabledCounters = getEnabledPlayerCounters();
  playerCounterEmpty.hidden = enabledCounters.length > 0;
  playerCounterList.style.setProperty("--counter-badge-scale", getCounterBadgeScale(enabledCounters.length));
  playerCounterList.innerHTML = enabledCounters
    .map((counter) => {
      const counterState = state.playerCounters[counter.id];
      return `
        <article class="counter-badge">
          <div>
            <span class="counter-badge-label">${escapeHtml(counter.label)}</span>
            <span class="counter-badge-meta">Player Counter</span>
          </div>
          <div class="counter-badge-stepper">
            <button class="step-button" type="button" data-counter-id="${counter.id}" data-delta="-1" aria-label="Decrease ${escapeHtml(counter.label)}">
              -
            </button>
            <output aria-live="polite">${counterState.value}</output>
            <button class="step-button" type="button" data-counter-id="${counter.id}" data-delta="1" aria-label="Increase ${escapeHtml(counter.label)}">
              +
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCommanderDamageList() {
  commanderDamageList.style.setProperty(
    "--damage-module-scale",
    getCommanderDamageModuleScale(state.commanderDamageTrackers.length)
  );
  commanderDamageList.innerHTML = state.commanderDamageTrackers
    .map((tracker, index) => {
      return `
        <div class="damage-module">
          <div class="damage-module-header">
            <button class="damage-module-label" type="button" data-damage-label-index="${index}">
              ${escapeHtml(tracker.label)}
            </button>
            <span class="damage-module-caption">Commander Damage</span>
          </div>
          <output class="damage-module-value" aria-live="polite">${tracker.value}</output>
          <div class="damage-module-stepper">
            <button class="step-button" type="button" data-damage-index="${index}" data-delta="-1" aria-label="Decrease commander damage for ${escapeHtml(tracker.label)}">
              -
            </button>
            <output aria-hidden="true">${tracker.value}</output>
            <button class="step-button" type="button" data-damage-index="${index}" data-delta="1" aria-label="Increase commander damage for ${escapeHtml(tracker.label)}">
              +
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBoardStatePage() {
  const boardState = state.boardState;
  const effects = boardState.permanents.filter((permanent) => permanent.isNonCreature);
  const battlefield = boardState.permanents.filter((permanent) => !permanent.isNonCreature);
  const totals = calculateBoardTotals(boardState.permanents);
  const selectedCount = getSelectedPermanentIds(boardState.permanents).length;
  const currentPhase = PHASES[boardState.currentPhaseIndex];
  const isCombatPhase = currentPhase === "Combat";

  outputs.boardPhaseValue.textContent = currentPhase;
  boardStateBoard.dataset.phase = currentPhase.toLowerCase().replace(/\s+/g, "-");
  boardStateBoard.dataset.combatActive = String(isCombatPhase);
  if (battlefieldSection) {
    battlefieldSection.dataset.hasEffects = String(effects.length > 0);
    battlefieldSection.dataset.hasCreatures = String(battlefield.length > 0);
  }
  renderTriggerReminders();
  renderBattlefieldActionButtons();
  renderBoardSearch();
  renderBoardControls(boardState.controlsExpanded);
  renderEffectStrip(effects);
  renderBattlefieldGrid(battlefield);
  renderBoardTotals(totals, selectedCount);
  renderBoardOptionsMenu();
  renderAutomationRules();
  renderCombatSimulation();
  renderCardDetailOverlay();
  renderFloatingManaPanel();
  renderTimerPanel();
  renderCommanderBadge();
}

function startTimerRendering() {
  if (timerRenderInterval) {
    window.clearInterval(timerRenderInterval);
  }
  renderTimerPanel();
  timerRenderInterval = window.setInterval(renderTimerPanel, 1000);
}

function renderTimerPanel() {
  if (!outputs.turnNumberValue || !outputs.turnTimerValue || !outputs.phaseTimerValue) {
    return;
  }

  const now = Date.now();
  outputs.turnNumberValue.textContent = String(Math.max(1, normalizeCount(state.runtime?.turnNumber, 1)));
  outputs.turnTimerValue.textContent = formatDurationCompact(now - normalizeTimestamp(state.runtime?.turnStartedAt));
  outputs.phaseTimerValue.textContent = formatDurationCompact(now - normalizeTimestamp(state.runtime?.phaseStartedAt));
}

function renderStatsPage() {
  if (!statsSummaryGrid || !commanderInsightsList) {
    return;
  }

  const analytics = buildAnalyticsSnapshot();
  const summaryCards = [
    {
      label: "Games Played",
      value: analytics.gamesPlayed,
      meta: `Avg ${formatDurationCompact(analytics.averageGameDurationMs)} per game`,
    },
    {
      label: "Actions / Game",
      value: analytics.actionsPerGame,
      meta: `${analytics.totalActions} actions logged`,
    },
    {
      label: "Favorite Colors",
      value: analytics.favoriteColors || "N/A",
      meta: "From active board mana symbols",
    },
    {
      label: "Most Used Mechanic",
      value: analytics.favoriteMechanic || "N/A",
      meta: "Based on action history",
    },
    {
      label: "Largest Attack",
      value: analytics.largestSingleAttack,
      meta: `Combat damage tracked: ${analytics.totalCombatDamage}`,
    },
    {
      label: "Damage Prevented",
      value: analytics.damagePrevented,
      meta: `${analytics.attackersPerGame} attackers / ${analytics.blockersPerGame} blockers per game`,
    },
    {
      label: "Largest Token Swarm",
      value: analytics.largestTokenSwarm,
      meta: `${analytics.mostGeneratedToken || "No token leader yet"}`,
    },
    {
      label: "Counter Leader",
      value: analytics.mostUsedCounterType || "N/A",
      meta: `Largest stack ${analytics.largestCounterStack}`,
    },
    {
      label: "Mana Peak",
      value: analytics.manaPeak,
      meta: `${analytics.manaGenerated} generated / ${analytics.manaSpent} spent`,
    },
    {
      label: "Mana Wasted",
      value: analytics.manaWasted,
      meta: `${analytics.colorUsageDistribution || "No color usage yet"}`,
    },
    {
      label: "Trigger Load",
      value: analytics.triggerFrequency,
      meta: `${analytics.autoTriggerCount} auto, ${analytics.missedTriggerCount} missed`,
    },
    {
      label: "Turn Timing",
      value: formatDurationCompact(analytics.averageTurnTimeMs),
      meta: `Longest ${formatDurationCompact(analytics.longestTurnMs)} | Shortest ${formatDurationCompact(analytics.shortestTurnMs)}`,
    },
    {
      label: "Life Range",
      value: `${analytics.lowestSurvivalLife} - ${analytics.highestLifeTotal}`,
      meta: `Gained ${analytics.lifeGained}, lost ${analytics.lifeLost}, swing ${analytics.biggestLifeSwing}`,
    },
    {
      label: "Commander Damage",
      value: analytics.highestCommanderDamage,
      meta: "Highest tracked commander damage",
    },
  ];

  statsSummaryGrid.innerHTML = summaryCards
    .map(
      (card) => `
        <article class="utility-stat-card">
          <span class="utility-stat-label">${escapeHtml(String(card.label))}</span>
          <strong class="utility-stat-value">${escapeHtml(String(card.value))}</strong>
          <span class="utility-stat-meta">${escapeHtml(String(card.meta))}</span>
        </article>
      `
    )
    .join("");

  const commanderInsights = [
    ["Games Played", analytics.commanderGamesPlayed],
    ["Wins / Losses", `${analytics.commanderWins}/${analytics.commanderLosses}`],
    ["Average Game Length", formatDurationCompact(analytics.commanderAverageGameLengthMs)],
    ["Biggest Combat Step", analytics.biggestCombatStep],
    ["Favorite Mechanics", analytics.favoriteMechanicsList || "N/A"],
    ["Most Common Finisher", analytics.commonFinisher || "N/A"],
    ["Average Turn Time", formatDurationCompact(analytics.averageTurnTimeMs)],
    ["Longest Turn", formatDurationCompact(analytics.longestTurnMs)],
    ["Counter Usage / Game", analytics.countersPerGame],
    ["Token Leader", analytics.mostGeneratedToken || "N/A"],
  ];

  commanderInsightsList.innerHTML = commanderInsights
    .map(
      ([label, value]) => `
        <article class="utility-insight-row">
          <span>${escapeHtml(String(label))}</span>
          <strong>${escapeHtml(String(value))}</strong>
        </article>
      `
    )
    .join("");
}

function renderArchivePage() {
  if (!archiveList) {
    return;
  }
  if (archiveSearchInput && archiveSearchInput.value !== archiveSearchQuery) {
    archiveSearchInput.value = archiveSearchQuery;
  }

  const games = getFilteredArchiveGames();
  const commanderDeckMarkup = renderCommanderDeckArchiveSummary();
  if (games.length === 0) {
    const emptyMessage = archiveSearchQuery
      ? "No archived games match that search."
      : "No archived games yet. End a game with Reset to save it here.";
    archiveList.innerHTML = `${commanderDeckMarkup}<p class="sheet-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  archiveList.innerHTML = commanderDeckMarkup + games
    .map((game) => {
      const totals = game.totals || {};
      const endedAt = new Date(normalizeTimestamp(game.endedAt));
      const summaryLine = [
        `P/T ${normalizeCount(totals.power, 0)}/${normalizeCount(totals.toughness, 0)}`,
        `Damage ${normalizeCount(totals.damage, 0)}`,
        `Triggers ${normalizeCount(totals.triggers, 0)}`,
        `Turns ${Array.isArray(game.turnDurations) ? game.turnDurations.length : 0}`,
        `Log ${Array.isArray(game.eventLog) ? game.eventLog.length : 0}`,
      ].join(" | ");
      const recentActions = Array.isArray(game.recentActions) ? game.recentActions : [];

      return `
        <article class="utility-log-item">
          <div class="utility-log-item-header">
            <strong>${escapeHtml(game.commanderName || "Commander")}</strong>
            <span>${escapeHtml(endedAt.toLocaleString())}</span>
          </div>
          <div class="utility-log-item-meta">
            <span>${escapeHtml(formatDurationCompact(game.durationMs))}</span>
            <span>${escapeHtml(game.winner || "Unknown")}</span>
            <span>Life ${normalizeCount(game.lifeEnd, 0)}</span>
          </div>
          <p class="utility-log-item-summary">${escapeHtml(summaryLine)}</p>
          ${
            recentActions.length > 0
              ? `<div class="utility-log-item-actions">${recentActions
                  .map((entry) => `<span>${escapeHtml(entry)}</span>`)
                  .join("")}</div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderCommanderDeckArchiveSummary() {
  const deck = getActiveCommanderDeckArchive();
  if (!deck || deck.cards.length === 0) {
    return "";
  }
  const validation = validateCommanderDeckArchive(deck);

  return `
    <article class="utility-log-item">
      <div class="utility-log-item-header">
        <strong>${escapeHtml(deck.commanderName)} Deck Archive</strong>
        <span>${deck.cards.length} unique • ${validation.invalidCards.length} flagged</span>
      </div>
      <p class="utility-log-item-summary">Curated cards explicitly added from Scryfall. Tokens, basic lands, temporary copies, and stolen permanents are excluded.</p>
      <div class="utility-log-item-meta">
        <span>Types: ${escapeHtml(validation.typeBreakdownText)}</span>
        <span>Mana curve: ${escapeHtml(validation.manaCurveText)}</span>
        <span>Keywords: ${escapeHtml(validation.keywordText)}</span>
      </div>
      <div class="utility-log-item-actions">
        ${deck.cards
          .slice(0, 12)
          .map((card) => `<span>${escapeHtml(card.name)}</span>`)
          .join("")}
      </div>
    </article>
  `;
}

function validateCommanderDeckArchive(deck = getActiveCommanderDeckArchive()) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  const invalidCards = cards.filter((card) => !isCommanderDeckEligibleCard(card) || !isCardWithinCommanderIdentity(card));
  const typeBreakdown = cards.reduce((accumulator, card) => {
    const typeLine = card.typeLine || "";
    const primaryType = ["Creature", "Artifact", "Enchantment", "Planeswalker", "Instant", "Sorcery", "Land"].find((type) =>
      hasTypeLine(typeLine, type)
    ) || "Other";
    accumulator[primaryType] = normalizeCount(accumulator[primaryType], 0) + 1;
    return accumulator;
  }, {});
  const manaCurve = cards.reduce((accumulator, card) => {
    const manaValue = estimateManaValue(card.manaCost);
    accumulator[manaValue] = normalizeCount(accumulator[manaValue], 0) + 1;
    return accumulator;
  }, {});
  const keywordCounts = cards.reduce((accumulator, card) => {
    ["flying", "trample", "haste", "vigilance", "lifelink", "deathtouch", "ward", "menace"].forEach((keyword) => {
      if (getCardReferenceText(card).includes(keyword)) {
        accumulator[keyword] = normalizeCount(accumulator[keyword], 0) + 1;
      }
    });
    return accumulator;
  }, {});

  return {
    invalidCards,
    typeBreakdownText: formatCountMap(typeBreakdown, "No types"),
    manaCurveText: formatCountMap(manaCurve, "No curve"),
    keywordText: formatCountMap(keywordCounts, "No keywords"),
  };
}

function estimateManaValue(manaCost = "") {
  const symbols = String(manaCost || "").match(/\{[^}]+\}/g) || [];
  return symbols.reduce((total, symbol) => {
    const value = symbol.replace(/[{}]/g, "");
    const numeric = Number(value);
    return total + (Number.isFinite(numeric) ? numeric : 1);
  }, 0);
}

function formatCountMap(countMap = {}, emptyLabel = "None") {
  const entries = Object.entries(countMap);
  if (entries.length === 0) {
    return emptyLabel;
  }
  return entries
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .slice(0, 6)
    .map(([key, value]) => `${key}:${value}`)
    .join(" ");
}

function renderLeaderboardsPage() {
  if (!leaderboardGrid) {
    return;
  }

  const analytics = buildAnalyticsSnapshot();
  const leaderboards = [
    ["Biggest Combat Damage", analytics.biggestCombatDamage],
    ["Highest Life Total", analytics.highestLifeTotal],
    ["Largest Token Army", analytics.largestTokenSwarm],
    ["Largest Mana Pool", analytics.manaPeak],
    ["Longest Game", formatDurationCompact(analytics.longestGameMs)],
    ["Most Triggers", analytics.mostTriggersInGame],
    ["Biggest Board State", analytics.biggestBoardState],
    ["Highest Commander Damage", analytics.highestCommanderDamage],
  ];

  leaderboardGrid.innerHTML = leaderboards
    .map(
      ([label, value], index) => `
        <article class="utility-leaderboard-card">
          <span class="utility-leaderboard-rank">#${index + 1}</span>
          <span class="utility-leaderboard-label">${escapeHtml(String(label))}</span>
          <strong class="utility-leaderboard-value">${escapeHtml(String(value))}</strong>
        </article>
      `
    )
    .join("");
}

function handleArchiveSearchInput(event) {
  archiveSearchQuery = normalizeLabel(event?.target?.value, "");
  renderArchivePage();
}

function getFilteredArchiveGames() {
  const games = Array.isArray(state.archive?.games) ? [...state.archive.games] : [];
  const normalizedQuery = archiveSearchQuery.toLowerCase();
  if (!normalizedQuery) {
    return games.sort((left, right) => normalizeTimestamp(right.endedAt) - normalizeTimestamp(left.endedAt));
  }

  return games
    .filter((game) => {
      const haystack = [
        game.commanderName,
        game.winner,
        game.notes,
        ...(Array.isArray(game.recentActions) ? game.recentActions : []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => normalizeTimestamp(right.endedAt) - normalizeTimestamp(left.endedAt));
}

function buildAnalyticsSnapshot() {
  const archiveGames = Array.isArray(state.archive?.games) ? state.archive.games : [];
  const history = Array.isArray(state.companion?.history) ? state.companion.history : [];
  const boardPermanents = Array.isArray(state.boardState?.permanents) ? state.boardState.permanents : [];
  const tokenPermanents = boardPermanents.filter((permanent) => permanent.isToken);
  const currentTotals = calculateAbsoluteBoardTotals(boardPermanents, boardPermanents);

  let lifeGained = 0;
  let lifeLost = 0;
  let biggestLifeSwing = 0;
  let highestLifeTotal = normalizeCount(state.life, defaultState.life);
  let lowestSurvivalLife = normalizeCount(state.life, defaultState.life);
  let manaGenerated = 0;
  let manaSpent = 0;
  let manaPeakFromHistory = getFloatingManaTotal(state.companion?.floatingMana || {});
  let largestSingleAttack = 0;
  let totalCombatDamage = 0;
  let damagePrevented = 0;
  let attackersSelected = 0;
  let blockersAssigned = 0;
  let triggerCount = 0;
  let autoTriggerCount = 0;
  let missedTriggerCount = 0;
  let tokenGeneratedCount = 0;
  let counterAppliedCount = 0;
  const tokenNames = new Map();
  const actionTypeCounts = new Map();
  const counterTypeCounts = new Map();
  const colorUsageCounts = new Map();
  const phaseTimes = [];
  let previousPhaseTimestamp = 0;

  history.forEach((entry) => {
    const type = normalizeLabel(entry?.type, "event").toLowerCase();
    const payload = entry?.payload || {};
    const timestamp = normalizeTimestamp(entry?.timestamp);
    actionTypeCounts.set(type, (actionTypeCounts.get(type) || 0) + 1);

    if (type === "life" || type === "life-rollback") {
      const from = normalizeCount(payload.from, state.life);
      const to = normalizeCount(payload.to, state.life);
      const delta = to - from;
      if (delta > 0) {
        lifeGained += delta;
      } else if (delta < 0) {
        lifeLost += Math.abs(delta);
      }
      biggestLifeSwing = Math.max(biggestLifeSwing, Math.abs(delta));
      highestLifeTotal = Math.max(highestLifeTotal, from, to);
      lowestSurvivalLife = Math.min(lowestSurvivalLife, from, to);
    }

    if (type === "mana") {
      const from = normalizeCount(payload.from, 0);
      const to = normalizeCount(payload.to, 0);
      if (to > from) {
        manaGenerated += to - from;
      } else if (from > to) {
        manaSpent += from - to;
      }
      manaPeakFromHistory = Math.max(manaPeakFromHistory, from, to);
      const color = normalizeLabel(payload.color, "");
      if (color) {
        colorUsageCounts.set(color, (colorUsageCounts.get(color) || 0) + Math.abs(to - from));
      }
    }

    if (type === "combat") {
      const previewPower = normalizeCount(payload?.preview?.attackerTotal?.power, 0);
      const previewToughness = normalizeCount(payload?.preview?.blockerTotal?.toughness, 0);
      const attackerCount = Array.isArray(payload.attackers) ? payload.attackers.length : 0;
      const blockerCount = Array.isArray(payload.blockers) ? payload.blockers.length : 0;
      largestSingleAttack = Math.max(largestSingleAttack, previewPower);
      totalCombatDamage += previewPower;
      damagePrevented += previewToughness;
      attackersSelected += attackerCount;
      blockersAssigned += blockerCount;
    }

    if (type === "token") {
      const quantity = Math.max(1, normalizeCount(payload.quantity, 1));
      const tokenName = normalizeLabel(payload.name, "Token");
      tokenGeneratedCount += quantity;
      tokenNames.set(tokenName, (tokenNames.get(tokenName) || 0) + quantity);
    }

    if (type === "counter") {
      const count = Math.max(1, normalizeCount(payload.appliedAmount, normalizeCount(payload.value, 1)));
      const counterType = normalizeCounterType(payload.counterType || payload.counterId || "");
      counterAppliedCount += count;
      counterTypeCounts.set(counterType, (counterTypeCounts.get(counterType) || 0) + count);
    }

    if (type === "phase") {
      triggerCount += 1;
      if (previousPhaseTimestamp > 0) {
        phaseTimes.push(Math.max(0, timestamp - previousPhaseTimestamp));
      }
      previousPhaseTimestamp = timestamp;
    }

    if (type === "trigger") {
      triggerCount += 1;
    }

    if (normalizeLabel(entry?.summary, "").toLowerCase().includes("auto")) {
      autoTriggerCount += 1;
    }
  });

  autoTriggerCount += Array.isArray(state.boardState?.automationLog) ? state.boardState.automationLog.length : 0;
  missedTriggerCount = Math.max(0, triggerCount - autoTriggerCount);

  const archiveDurationValues = archiveGames.map((game) => Math.max(0, Number(game.durationMs) || 0));
  const totalArchivedDuration = archiveDurationValues.reduce((sum, value) => sum + value, 0);
  const averageGameDurationMs = archiveGames.length > 0 ? Math.round(totalArchivedDuration / archiveGames.length) : 0;
  const longestGameMs = archiveDurationValues.reduce((max, value) => Math.max(max, value), 0);
  const actionsPerGame = archiveGames.length > 0 ? Math.round(history.length / Math.max(1, archiveGames.length)) : history.length;

  const archiveTotals = archiveGames.reduce(
    (accumulator, game) => {
      const totals = game.totals || {};
      accumulator.biggestCombatDamage = Math.max(accumulator.biggestCombatDamage, normalizeCount(totals.damage, 0));
      accumulator.damagePrevented += normalizeCount(totals.prevented, 0);
      accumulator.mostTriggersInGame = Math.max(accumulator.mostTriggersInGame, normalizeCount(totals.triggers, 0));
      accumulator.biggestBoardState = Math.max(accumulator.biggestBoardState, normalizeCount(totals.boardPeak, 0));
      accumulator.manaPeak = Math.max(accumulator.manaPeak, normalizeCount(totals.manaPeak, 0));
      accumulator.largestTokenSwarm = Math.max(accumulator.largestTokenSwarm, normalizeCount(totals.tokens, 0));
      accumulator.counterTotal += normalizeCount(totals.counters, 0);
      if (Array.isArray(game.turnDurations)) {
        accumulator.turnDurations.push(...game.turnDurations);
      }
      if (normalizeLabel(game.winner, "").toLowerCase() === state.playerName.toLowerCase()) {
        accumulator.commanderWins += 1;
      } else if (game.winner) {
        accumulator.commanderLosses += 1;
      }
      return accumulator;
    },
    {
      biggestCombatDamage: 0,
      damagePrevented: 0,
      mostTriggersInGame: 0,
      biggestBoardState: 0,
      manaPeak: 0,
      largestTokenSwarm: 0,
      counterTotal: 0,
      commanderWins: 0,
      commanderLosses: 0,
      turnDurations: [],
    }
  );

  const currentManaPeak = Math.max(manaPeakFromHistory, getFloatingManaTotal(state.companion?.floatingMana || {}));
  const runtime = normalizeRuntimeState(state.runtime);
  const activeTurnElapsed = Math.max(0, Date.now() - normalizeTimestamp(runtime.turnStartedAt));
  const allTurnDurations = [...archiveTotals.turnDurations, ...(runtime.turnDurations || []), activeTurnElapsed].filter(
    (value) => value > 0
  );
  const phaseAverage = allTurnDurations.length
    ? Math.round(allTurnDurations.reduce((sum, value) => sum + value, 0) / allTurnDurations.length)
    : phaseTimes.length
      ? Math.round(phaseTimes.reduce((sum, value) => sum + value, 0) / phaseTimes.length)
      : 0;
  const longestTurnMs = allTurnDurations.length
    ? allTurnDurations.reduce((max, value) => Math.max(max, value), 0)
    : phaseTimes.reduce((max, value) => Math.max(max, value), 0);
  const shortestTurnMs = allTurnDurations.length
    ? allTurnDurations.reduce((min, value) => Math.min(min, value), allTurnDurations[0])
    : 0;
  const largestTokenSwarm = Math.max(
    archiveTotals.largestTokenSwarm,
    tokenPermanents.reduce((max, permanent) => Math.max(max, normalizeCount(permanent.quantity, 1)), 0)
  );
  const mostGeneratedToken = getMapMaxKey(tokenNames);
  const favoriteMechanic = getMapMaxKey(actionTypeCounts);
  const favoriteMechanicsList = getTopMapKeys(actionTypeCounts, 3).join(", ");
  const favoriteCounterType = getMapMaxKey(counterTypeCounts);
  const currentCounterStacks = boardPermanents.flatMap((permanent) =>
    Object.entries(normalizePermanentCounters(permanent.counters)).map(([type, count]) => ({
      type,
      count: normalizeCount(count, 0),
    }))
  );
  const largestCounterStack = currentCounterStacks.reduce((max, entry) => Math.max(max, entry.count), 0);

  const colorsInPlay = extractFavoriteColors(boardPermanents);
  const colorUsageDistribution = getTopMapKeys(colorUsageCounts, 5).join("/") || colorsInPlay;
  const sessionDurationMs = Math.max(0, Date.now() - normalizeTimestamp(state.runtime?.gameStartedAt));
  const totalGames = archiveGames.length + (hasMeaningfulGameState() ? 1 : 0);
  const countersPerGame = totalGames > 0 ? (counterAppliedCount + archiveTotals.counterTotal) / totalGames : 0;
  const attackersPerGame = totalGames > 0 ? (attackersSelected / totalGames).toFixed(1) : "0.0";
  const blockersPerGame = totalGames > 0 ? (blockersAssigned / totalGames).toFixed(1) : "0.0";
  const highestCommanderDamage = (state.commanderDamageTrackers || []).reduce(
    (max, tracker) => Math.max(max, normalizeCount(tracker.value, 0)),
    0
  );

  return {
    gamesPlayed: totalGames,
    averageGameDurationMs,
    actionsPerGame,
    totalActions: history.length,
    favoriteColors: colorsInPlay,
    favoriteMechanic: favoriteMechanic ? toTitleCase(favoriteMechanic.replaceAll("-", " ")) : "",
    favoriteMechanicsList: favoriteMechanicsList
      ? favoriteMechanicsList.split(", ").map((entry) => toTitleCase(entry.replaceAll("-", " "))).join(", ")
      : "",
    lifeGained,
    lifeLost,
    biggestLifeSwing,
    highestLifeTotal,
    lowestSurvivalLife,
    totalCombatDamage: Math.max(totalCombatDamage, archiveTotals.biggestCombatDamage),
    biggestCombatDamage: Math.max(totalCombatDamage, archiveTotals.biggestCombatDamage),
    damagePrevented: damagePrevented + archiveTotals.damagePrevented,
    attackersPerGame,
    blockersPerGame,
    largestSingleAttack,
    largestTokenSwarm,
    mostGeneratedToken,
    mostUsedCounterType: favoriteCounterType,
    largestCounterStack,
    manaPeak: Math.max(currentManaPeak, archiveTotals.manaPeak),
    manaGenerated,
    manaSpent,
    manaWasted: Math.max(0, currentManaPeak - manaSpent),
    colorUsageDistribution,
    triggerFrequency: triggerCount,
    autoTriggerCount,
    missedTriggerCount,
    commanderGamesPlayed: archiveGames.length,
    commanderWins: archiveTotals.commanderWins,
    commanderLosses: archiveTotals.commanderLosses,
    commanderAverageGameLengthMs: averageGameDurationMs || sessionDurationMs,
    commonFinisher: mostGeneratedToken || favoriteCounterType || "N/A",
    biggestCombatStep: largestSingleAttack || currentTotals.power || 0,
    countersPerGame: countersPerGame.toFixed(1),
    averageTurnTimeMs: phaseAverage,
    longestTurnMs,
    shortestTurnMs,
    longestGameMs,
    mostTriggersInGame: Math.max(triggerCount, archiveTotals.mostTriggersInGame),
    biggestBoardState: Math.max(boardPermanents.length, archiveTotals.biggestBoardState),
    highestCommanderDamage,
  };
}

function extractFavoriteColors(permanents) {
  const colorCounts = new Map([
    ["W", 0],
    ["U", 0],
    ["B", 0],
    ["R", 0],
    ["G", 0],
    ["C", 0],
  ]);

  permanents.forEach((permanent) => {
    const manaCost = String(permanent?.manaCost || "");
    const localSeen = new Set();
    const symbols = manaCost.match(/[WUBRGC]/gi) || [];
    symbols.forEach((symbol) => {
      const color = symbol.toUpperCase();
      if (!colorCounts.has(color) || localSeen.has(color)) {
        return;
      }
      localSeen.add(color);
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    });
  });

  const topColors = [...colorCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([color]) => color);
  return topColors.join("/") || "";
}

function getMapMaxKey(map) {
  let maxKey = "";
  let maxValue = -Infinity;
  map.forEach((value, key) => {
    if (value > maxValue) {
      maxValue = value;
      maxKey = key;
    }
  });
  return maxKey;
}

function getTopMapKeys(map, count = 3) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([key]) => key);
}

function toTitleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatDurationCompact(durationMs) {
  const safeDuration = Math.max(0, Number(durationMs) || 0);
  const totalSeconds = Math.round(safeDuration / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function renderFloatingManaPanel() {
  if (!floatingManaPanel || !floatingManaTotalValue) {
    return;
  }

  const floatingMana = state.companion?.floatingMana || {};
  const totalMana = getFloatingManaTotal(floatingMana);
  floatingManaPanel.hidden = false;
  floatingManaPanel.dataset.empty = totalMana === 0 ? "true" : "false";
  floatingManaTotalValue.textContent = String(totalMana);
  Object.entries(floatingManaOutputs).forEach(([color, output]) => {
    if (!output) {
      return;
    }

    output.textContent = String(Number(floatingMana[color]) || 0);
  });
}

function renderTriggerReminders() {
  if (!triggerReminderStrip || !triggerReminderList) {
    return;
  }

  const currentPhase = PHASES[state.boardState.currentPhaseIndex];
  const reminders = queueTriggerReminders({
    phase: currentPhase,
    permanents: state.boardState.permanents,
    automationRules: state.boardState.automationRules,
  }).slice(0, 6);
  triggerReminderStrip.hidden = reminders.length === 0;
  if (reminders.length === 0) {
    triggerReminderList.innerHTML = "";
    return;
  }

  triggerReminderList.innerHTML = reminders
    .map((entry) => {
      return `<span class="trigger-reminder-chip" data-deterministic="${entry.deterministic ? "true" : "false"}">${escapeHtml(truncateText(entry.summary || "Trigger reminder", 48))}</span>`;
    })
    .join("");
}

function renderSettingsManualDialog() {
  renderSettingsToggleList();
  renderManualSections();
  renderCompanionHistory();
  renderLifeRollbackControl();
}

function renderSettingsToggleList() {
  if (!settingsToggleList) {
    return;
  }

  settingsToggleList.innerHTML = SETTINGS_TOGGLE_FIELDS.map(renderSettingsToggleRow).join("");
  settingsToggleList.querySelectorAll("[data-setting-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      updateCompanionSetting(input.dataset.settingToggle, input.checked);
    });
  });
}

function renderSettingsToggleRow(toggleField) {
  const checked = Boolean(state.companion?.settings?.[toggleField.id]);
  return `
    <label class="toggle-row" for="setting_${toggleField.id}">
      <span>${escapeHtml(toggleField.label)}</span>
      <input
        class="toggle-input"
        id="setting_${toggleField.id}"
        data-setting-toggle="${escapeHtml(toggleField.id)}"
        type="checkbox"
        ${checked ? "checked" : ""}
      />
    </label>
    <p class="sheet-helper-text">${escapeHtml(toggleField.description)}</p>
  `;
}

function renderManualSections() {
  if (!manualSectionsList) {
    return;
  }

  manualSectionsList.innerHTML = MANUAL_SECTIONS.map((section) => {
    return `
      <article class="settings-manual-card">
        <h3>${escapeHtml(section.title)}</h3>
        <ul>
          ${(Array.isArray(section.points) ? section.points : [])
            .map((point) => `<li>${escapeHtml(point)}</li>`)
            .join("")}
        </ul>
      </article>
    `;
  }).join("");
}

function renderCompanionHistory() {
  if (!actionHistoryList) {
    return;
  }

  const reminderEntries = Array.isArray(state.companion?.triggerQueue)
    ? state.companion.triggerQueue.map((entry) => ({
        summary: entry.summary,
        timestamp: entry.timestamp,
      }))
    : [];
  const historyEntries = Array.isArray(state.companion?.history)
    ? [...state.companion.history.slice(-16), ...reminderEntries].slice(-20).reverse()
    : reminderEntries.slice(-20).reverse();
  if (historyEntries.length === 0) {
    actionHistoryList.innerHTML = '<p class="sheet-empty">No actions logged yet.</p>';
    return;
  }

  actionHistoryList.innerHTML = historyEntries
    .map((entry) => {
      return `
        <article class="settings-history-item">
          <strong>${escapeHtml(entry.summary || "Action")}</strong>
          <span>${escapeHtml(new Date(Number(entry.timestamp) || Date.now()).toLocaleTimeString())}</span>
        </article>
      `;
    })
    .join("");
}

function renderLifeRollbackControl() {
  if (!lifeRollbackAction) {
    return;
  }

  const rollback = state.companion?.lifeRollback;
  const active = hasActiveLifeRollback(rollback);
  lifeRollbackAction.hidden = !active;
  if (active) {
    lifeRollbackAction.textContent = `Rollback Life (${rollback.previousLife})`;
  }
}

function setupBoardStateLayout() {
  if (addCreatureButton?.parentElement) {
    addCreatureButton.remove();
  }

  if (addTriggerButton?.parentElement) {
    addTriggerButton.remove();
  }

  if (toggleBoardControlsButton?.parentElement) {
    toggleBoardControlsButton.remove();
  }

  if (boardControlsExtra?.parentElement) {
    boardControlsExtra.remove();
  }

  if (!battlefieldHeadingRow || !removeAllBattlefieldButton || !toggleBoardTotalsButton) {
    return;
  }

  [removeAllBattlefieldButton, addTokenButton, battlefieldAddCounterButton, confirmCounterSelectionButton, toggleBoardTotalsButton]
    .filter(Boolean)
    .forEach((button) => {
    button.classList.remove("board-control-button", "board-control-button-wide");
    button.classList.add("board-section-action");
  });

  expandAllButton?.remove();
  collapseAllButton?.remove();

  let actionGroup = battlefieldHeadingRow.querySelector(".board-section-action-group");
  if (!actionGroup) {
    actionGroup = document.createElement("div");
    actionGroup.className = "board-section-action-group";
    battlefieldHeadingRow.append(actionGroup);
  }

  actionGroup.append(removeAllBattlefieldButton);
  if (addTokenButton) {
    addTokenButton.textContent = "Token";
    actionGroup.append(addTokenButton);
  }
  if (battlefieldAddCounterButton) {
    actionGroup.append(battlefieldAddCounterButton);
  }
  if (confirmCounterSelectionButton) {
    actionGroup.append(confirmCounterSelectionButton);
  }
  actionGroup.append(toggleBoardTotalsButton);
  boardStateControls?.remove();
}

function syncLocalPublicSnapshot() {
  const localSnapshot = createPublicPlayerSnapshot({
    appState: state,
    currentPhase: PHASES[state.boardState.currentPhaseIndex],
    calculateBoardTotals: calculateAbsoluteBoardTotals,
  });

  multiplayerService.updateLocalSnapshot({
    id: "local-player",
    displayName: state.playerName,
    connectionType: "simulated",
    isConnected: true,
    lastUpdated: Date.now(),
    publicTrackerState: {
      life: localSnapshot.life,
      counters: localSnapshot.counters,
      commanderDamage: localSnapshot.commanderDamage,
    },
    publicBoardState: localSnapshot.boardState,
    permissions: {
      canViewFaceDownCards: true,
    },
  });
}

function renderMultiplayerUi() {
  const connectedPlayers = state.multiplayer.connectedPlayers;

  multiplayerFeedback.hidden = !multiplayerUi.feedbackMessage;
  multiplayerFeedback.textContent = multiplayerUi.feedbackMessage;
  multiplayerFeedback.dataset.tone = multiplayerUi.feedbackTone;

  viewConnectedPlayersAction.hidden = connectedPlayers.length === 0;
  viewConnectedPlayersAction.textContent =
    connectedPlayers.length > 0
      ? `View Connected Players ${state.multiplayer.sessionCode || "----"} (${connectedPlayers.length})`
      : "View Connected Players";

  renderConnectedPlayersList(connectedPlayers);
  renderConnectedPlayerView(connectedPlayers);
}

function renderConnectedPlayersList(connectedPlayers) {
  connectedPlayersEmpty.hidden = connectedPlayers.length > 0;
  connectedPlayersList.innerHTML = connectedPlayers.map(renderConnectedPlayerCard).join("");
}

function renderConnectedPlayerCard(player) {
  return `
    <article class="connected-player-card">
      <div class="connected-player-card-copy">
        <span class="connected-player-name">${escapeHtml(player.displayName)}</span>
        <span class="connected-player-meta">${escapeHtml(formatConnectionMeta(player))}</span>
        <span class="connected-player-meta">Life ${player.publicTrackerState.life}</span>
      </div>
      <div class="connected-player-actions">
        <button
          class="sheet-secondary connected-player-action"
          type="button"
          data-connected-player-id="${player.id}"
          data-connected-view="tracker"
        >
          View Tracker
        </button>
        <button
          class="sheet-secondary connected-player-action"
          type="button"
          data-connected-player-id="${player.id}"
          data-connected-view="board-state"
        >
          View Board State
        </button>
      </div>
    </article>
  `;
}

function renderConnectedPlayerView(connectedPlayers) {
  const activePlayer =
    connectedPlayers.find((player) => player.id === multiplayerUi.activePlayerId) ||
    connectedPlayers[0] ||
    null;

  connectedPlayerViewTabs.hidden = !activePlayer;

  Array.from(connectedPlayerViewTabs.querySelectorAll("[data-player-view-mode]")).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.playerViewMode === multiplayerUi.activeViewMode);
    button.setAttribute(
      "aria-pressed",
      button.dataset.playerViewMode === multiplayerUi.activeViewMode ? "true" : "false"
    );
  });

  if (!activePlayer) {
    connectedPlayerViewKicker.textContent = "Viewing Player";
    connectedPlayerViewTitle.textContent = "No Connected Player";
    connectedPlayerViewContent.innerHTML =
      '<p class="sheet-empty connected-player-view-empty">No connected players are available yet.</p>';
    return;
  }

  connectedPlayerViewKicker.textContent = `Viewing ${multiplayerUi.activeViewMode === "tracker" ? "Tracker" : "Board State"}`;
  connectedPlayerViewTitle.textContent = activePlayer.displayName;
  connectedPlayerViewContent.innerHTML =
    multiplayerUi.activeViewMode === "tracker"
      ? renderReadOnlyTrackerView(activePlayer)
      : renderReadOnlyBoardView(activePlayer);
}

function renderReadOnlyTrackerView(player) {
  const counters = PLAYER_COUNTER_DEFS.map((counter) => ({
    label: counter.label,
    value: normalizeCount(player.publicTrackerState.counters?.[counter.id]),
  }));
  const commanderDamage = Array.isArray(player.publicTrackerState.commanderDamage)
    ? player.publicTrackerState.commanderDamage
    : [];

  return `
    <div class="connected-player-view-shell">
      <section class="connected-player-status board-state-card">
        <span class="connected-player-status-label">${escapeHtml(formatConnectionMeta(player))}</span>
        <span class="connected-player-status-label">Viewing ${escapeHtml(player.displayName)}</span>
      </section>
      <section class="connected-tracker-life board-state-card">
        <span class="connected-tracker-caption">Life Total</span>
        <output class="connected-tracker-life-value">${player.publicTrackerState.life}</output>
      </section>
      <section class="connected-tracker-counters">
        ${counters
          .map(
            (counter) => `
              <article class="connected-tracker-counter board-state-card">
                <span class="connected-tracker-counter-label">${escapeHtml(counter.label)}</span>
                <output class="connected-tracker-counter-value">${counter.value}</output>
              </article>
            `
          )
          .join("")}
      </section>
      <section class="connected-tracker-damage board-state-card">
        <div class="board-section-heading">
          <h2>Commander Damage</h2>
        </div>
        ${
          commanderDamage.length > 0
            ? `
              <div class="connected-tracker-damage-list">
                ${commanderDamage
                  .map(
                    (tracker) => `
                      <article class="connected-tracker-damage-chip">
                        <span class="connected-tracker-damage-label">${escapeHtml(tracker.label)}</span>
                        <output class="connected-tracker-damage-value">${tracker.value}</output>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            `
            : '<p class="board-empty-state connected-player-inline-empty">No commander damage tracked.</p>'
        }
      </section>
    </div>
  `;
}

function renderReadOnlyBoardView(player) {
  const boardState = createViewerBoardState(player.publicBoardState, player.permissions);
  const isCombatPhase = PHASES[state.boardState.currentPhaseIndex] === "Combat";
  const comparisonMode = isCombatPhase ? multiplayerUi.compareMode : "all";
  const comparison = compareBoardTotals({
    localTotals:
      comparisonMode === "selected"
        ? calculateSelectedPowerToughness(state.boardState.permanents)
        : calculatePowerToughness(state.boardState.permanents),
    opponentPermanents: boardState.permanents,
  });

  return `
    <div class="connected-player-view-shell connected-player-board-view">
      <section class="board-state-card connected-player-status">
        <span class="connected-player-status-label">${escapeHtml(formatConnectionMeta(player))}</span>
        <span class="connected-player-status-label">Read-only board state</span>
      </section>
      <section class="board-state-card compare-board-card">
        <div class="board-section-heading">
          <div class="board-section-heading-row">
            <div class="board-section-heading-copy">
              <h2>Compare Boards</h2>
            </div>
            <button class="sheet-secondary board-section-action" type="button" data-compare-toggle="true">
              ${multiplayerUi.compareBoardsVisible ? "Hide" : "Compare Boards"}
            </button>
          </div>
        </div>
        ${
          multiplayerUi.compareBoardsVisible
            ? `
              <div class="compare-board-body">
                ${
                  isCombatPhase
                    ? `
                      <div class="compare-board-modes">
                        <button class="sheet-secondary compare-board-mode ${comparisonMode === "selected" ? "is-active" : ""}" type="button" data-compare-mode="selected">Selected Attackers</button>
                        <button class="sheet-secondary compare-board-mode ${comparisonMode === "all" ? "is-active" : ""}" type="button" data-compare-mode="all">All Creatures</button>
                      </div>
                    `
                    : ""
                }
                <div class="compare-board-grid">
                  <article class="compare-board-cell">
                    <span class="compare-board-label">Your Board</span>
                    <output class="compare-board-value">${comparison.local.power} / ${comparison.local.toughness}</output>
                  </article>
                  <article class="compare-board-cell">
                    <span class="compare-board-label">${escapeHtml(player.displayName)}</span>
                    <output class="compare-board-value">${comparison.opponent.power} / ${comparison.opponent.toughness}</output>
                  </article>
                  <article class="compare-board-cell compare-board-cell-wide">
                    <span class="compare-board-label">Difference</span>
                    <output class="compare-board-value">${comparison.difference.power >= 0 ? "+" : ""}${comparison.difference.power} / ${comparison.difference.toughness >= 0 ? "+" : ""}${comparison.difference.toughness}</output>
                  </article>
                </div>
              </div>
            `
            : ""
        }
      </section>
      <section class="board-state-card connected-player-phase-card">
        <span class="board-phase-caption">Current Phase</span>
        <output class="connected-player-phase-value">${escapeHtml(boardState.currentPhase)}</output>
      </section>
      ${
        boardState.effects.length > 0
          ? `
            <section class="board-state-effects board-state-card connected-player-board-section">
              <div class="board-section-heading">
                <h2>Non-Creature Permanents</h2>
              </div>
              <div class="effect-strip connected-effect-strip">
                ${boardState.effects.map((permanent) => renderPublicBoardTile(permanent, "effect", boardState.permanents)).join("")}
              </div>
            </section>
          `
          : ""
      }
      <section class="board-state-battlefield board-state-card connected-player-board-section">
        <div class="board-section-heading">
          <h2>Battlefield</h2>
        </div>
        ${
          boardState.permanents.length > 0
            ? `<div class="battlefield-grid connected-battlefield-grid">${boardState.permanents
                .map((permanent) => renderPublicBoardTile(permanent, "battlefield", boardState.permanents))
                .join("")}</div>`
            : '<p class="board-empty-state">No permanents on board</p>'
        }
      </section>
      <footer class="board-total-bar board-state-card connected-player-total-bar">
        <div class="board-total-copy">
          <span class="board-total-caption">Power / Toughness</span>
          <span class="board-total-scope">All permanents</span>
        </div>
        <output class="board-total-value">${boardState.totalPower} / ${boardState.totalToughness}</output>
      </footer>
    </div>
  `;
}

function renderBoardControls(controlsExpanded) {
  if (!boardStateControls) {
    return;
  }

  boardStateControls.dataset.expanded = String(controlsExpanded);
}

function renderBoardOptionsMenu() {
  const connectedPlayers = state.multiplayer.connectedPlayers;
  boardOptionsTotalsButton.textContent = boardUi.totalsVisible ? "Hide Total Bar Overlay" : "Show Total Bar Overlay";
  boardOptionsAutomationToggleButton.textContent = state.boardState.automationEnabled ? "Automation Enabled" : "Automation Disabled";
  boardOptionsMultiplayerButton.textContent =
    connectedPlayers.length > 0
      ? `Connected ${state.multiplayer.sessionCode || "----"} (${connectedPlayers.length})`
      : "Local Multiplayer";
  boardViewConnectedPlayersAction.hidden = connectedPlayers.length === 0;
  boardMultiplayerFeedback.hidden = !boardUi.boardMultiplayerMessage;
  boardMultiplayerFeedback.textContent = boardUi.boardMultiplayerMessage;
  boardMultiplayerFeedback.dataset.tone = boardUi.boardMultiplayerTone;
}

function renderAutomationRules() {
  const {
    automationRules,
    automationSuggestions,
    automationLog,
    automationEnabled,
    triggers,
    lastAutomationUndo,
  } = state.boardState;

  if (automationRulesNote) {
    automationRulesNote.textContent = AUTOMATION_RULES_NOTE;
  }

  if (automationSuggestionsSection) {
    automationSuggestionsSection.hidden = automationSuggestions.length === 0;
  }

  if (automationSuggestionsEmpty) {
    automationSuggestionsEmpty.hidden = automationSuggestions.length > 0;
  }

  if (automationSuggestionsList) {
    automationSuggestionsList.innerHTML = automationSuggestions.map(renderAutomationSuggestionCard).join("");
  }

  automationRulesEmpty.hidden = automationRules.length > 0;
  automationRulesList.innerHTML = automationRules.map(renderActiveAutomationRuleCard).join("");

  if (automationManualEmpty) {
    automationManualEmpty.hidden = triggers.length > 0;
  }

  if (automationManualList) {
    automationManualList.innerHTML = triggers.map(renderManualTriggerCard).join("");
  }

  if (automationLogEmpty) {
    automationLogEmpty.hidden = automationLog.length > 0;
  }

  if (automationLogList) {
    automationLogList.innerHTML = automationLog.map(renderAutomationLogCard).join("");
  }

  if (automationToggleAllButton) {
    automationToggleAllButton.textContent = automationEnabled ? "Automation Enabled" : "Automation Disabled";
  }

  if (automationUndoButton) {
    automationUndoButton.disabled = !lastAutomationUndo;
  }
}

function renderAutomationSuggestionCard(rule) {
  return `
    <article class="automation-rule-card automation-rule-card-suggestion">
      <div class="automation-rule-copy">
        <span class="automation-rule-summary">${escapeHtml(getAutomationRuleSummary(rule))}</span>
        <span class="automation-rule-meta">${escapeHtml(getAutomationRuleMeta(rule))}</span>
        <span class="automation-rule-reason">${escapeHtml(rule.reasonSummary || "Suggestion derived from official card text.")}</span>
        <div class="automation-evidence-list">
          ${renderAutomationEvidence(rule.sourceEvidence)}
        </div>
      </div>
      <div class="automation-rule-actions">
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="accept-suggestion" data-automation-id="${rule.id}">
          ${rule.enabled ? "Enable" : "Review"}
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="toggle-suggestion-ask" data-automation-id="${rule.id}">
          ${rule.askBeforeRun ? "Ask On" : "Ask Off"}
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="edit-suggestion" data-automation-id="${rule.id}">
          Edit
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="reject-suggestion" data-automation-id="${rule.id}">
          Reject
        </button>
      </div>
    </article>
  `;
}

function renderActiveAutomationRuleCard(rule) {
  return `
    <article class="automation-rule-card">
      <div class="automation-rule-copy">
        <span class="automation-rule-summary">${escapeHtml(getAutomationRuleSummary(rule))}</span>
        <span class="automation-rule-meta">${escapeHtml(getAutomationRuleMeta(rule))}</span>
        <span class="automation-rule-reason">${escapeHtml(rule.reasonSummary || "Active automation rule.")}</span>
        <div class="automation-evidence-list">
          ${renderAutomationEvidence(rule.sourceEvidence)}
        </div>
      </div>
      <div class="automation-rule-actions">
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="toggle-rule-enabled" data-automation-id="${rule.id}">
          ${rule.enabled ? "Disable" : "Enable"}
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="toggle-rule-ask" data-automation-id="${rule.id}">
          ${rule.askBeforeRun ? "Ask On" : "Ask Off"}
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="run-rule" data-automation-id="${rule.id}">
          Run
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-automation-action="remove-rule" data-automation-id="${rule.id}">
          Remove
        </button>
      </div>
    </article>
  `;
}

function renderManualTriggerCard(trigger) {
  return `
    <article class="automation-rule-card">
      <div class="automation-rule-copy">
        <span class="automation-rule-summary">${escapeHtml(getTriggerSummary(trigger))}</span>
        <span class="automation-rule-meta">Manual rule</span>
      </div>
      <div class="automation-rule-actions">
        <button class="sheet-secondary automation-rule-action" type="button" data-trigger-edit-id="${trigger.id}">
          Edit
        </button>
        <button class="sheet-secondary automation-rule-action" type="button" data-trigger-remove-id="${trigger.id}">
          Remove
        </button>
      </div>
    </article>
  `;
}

function renderAutomationLogCard(entry) {
  return `
    <article class="automation-log-card">
      <div class="automation-rule-copy">
        <span class="automation-rule-summary">${escapeHtml(entry.sourceCardName)}</span>
        <span class="automation-rule-meta">${escapeHtml(entry.actionSummary)}</span>
        ${
          entry.modifierSummary
            ? `<span class="automation-rule-reason">${escapeHtml(entry.modifierSummary)}</span>`
            : ""
        }
        ${
          entry.detailSummary
            ? `<span class="automation-rule-reason">${escapeHtml(entry.detailSummary)}</span>`
            : ""
        }
        <span class="automation-rule-meta">${escapeHtml(entry.confirmationStatus)} • ${escapeHtml(formatAutomationTimestamp(entry.timestamp))}</span>
      </div>
    </article>
  `;
}

function renderAutomationEvidence(evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return "";
  }

  return evidence
    .map(
      (entry) => `
        <span class="automation-evidence-chip">
          ${escapeHtml(entry.source)}: ${escapeHtml(truncateText(entry.summary, 88))}
        </span>
      `
    )
    .join("");
}

function getAutomationRuleSummary(rule) {
  const triggerLabel = getAutomationTriggerLabel(rule);
  if (rule.actionType === "Create Tokens") {
    const entryLabel = rule.tokenAttacking ? " tapped and attacking" : rule.tokenTapped ? " tapped" : "";
    return `${triggerLabel}: Create ${rule.value} ${rule.tokenPower}/${rule.tokenToughness} ${rule.tokenName || "Token"} Token${rule.value === 1 ? "" : "s"}${entryLabel}`;
  }

  if (rule.actionType === "Multiply Tokens" || rule.actionType === "Modify Token Amount") {
    return `${triggerLabel}: ${rule.actionType === "Modify Token Amount" ? "Modify Token Output" : "Multiply Tokens"} for ${rule.targetType}`;
  }

  if (rule.actionType === "Add +1/+1 Counters" || rule.actionType === "Add Counters" || rule.actionType === "Modify Counter Amount") {
    if (rule.actionType === "Modify Counter Amount") {
      return `${triggerLabel}: Modify Counter Placement`;
    }

    const counterType = normalizeCounterType(rule.counterType || (rule.actionType === "Add +1/+1 Counters" ? "+1/+1" : "Generic"));
    return `${triggerLabel}: Add ${rule.value} ${counterType} Counter${rule.value === 1 ? "" : "s"} to ${rule.targetType}`;
  }

  if (rule.actionType === "Apply Temporary Buff") {
    const buffPower = normalizeSignedCount(rule.buffPower);
    const buffToughness = normalizeSignedCount(rule.buffToughness);
    const durationLabel = normalizeAutomationBuffDuration(rule.buffDuration) === "until-end-of-combat"
      ? "until end of combat"
      : "until end of turn";
    return `${triggerLabel}: ${buffPower >= 0 ? "+" : ""}${buffPower}/${buffToughness >= 0 ? "+" : ""}${buffToughness} ${durationLabel} for ${rule.targetType}`;
  }

  if (rule.actionType === "Board Buff") {
    return `${triggerLabel}: Board Buff`;
  }

  return `${triggerLabel}: ${rule.actionType}`;
}

function getAutomationRuleMeta(rule) {
  const sourceSummary = Array.isArray(rule.sourceEvidence)
    ? rule.sourceEvidence.map((entry) => entry.source).filter(Boolean).join(" • ")
    : "";
  return `${rule.confidence} Confidence • ${rule.askBeforeRun ? "Ask Before Run" : "Ready"}${sourceSummary ? ` • ${sourceSummary}` : ""}`;
}

function getAutomationTriggerLabel(rule) {
  switch (rule.triggerType) {
    case "ETB":
      return "ETB";
    case "Phase":
      return rule.phase || "Phase";
    case "OnDeath":
      return "On Death";
    case "OnSacrifice":
      return "On Sacrifice";
    case "OnExile":
      return "On Exile";
    case "attack-group":
      return "Whenever One or More Creatures Attack";
    case "attack-any":
      return "Whenever a Creature Attacks";
    case "attack-equipped":
      return "Whenever Equipped Creature Attacks";
    case "attack-enchanted":
      return "Whenever Enchanted Creature Attacks";
    case "attack-self":
      return "Whenever This Attacks";
    case "Static":
      return "Static Effect";
    default:
      return rule.triggerType || rule.eventType || "Automation";
  }
}

function renderCombatSimulation() {
  const isCombatPhase = PHASES[state.boardState.currentPhaseIndex] === "Combat";
  const combatState = state.boardState.combatState;
  combatSimulationSection.hidden = !isCombatPhase;
  combatSimulationSection.dataset.combatActive = String(isCombatPhase);

  if (!isCombatPhase) {
    combatSummary.innerHTML = "";
    if (confirmCombatButton) {
      confirmCombatButton.disabled = true;
    }
    clearAttackersButton.disabled = true;
    return;
  }

  const combatTotals = calculateCombatTotals(state.boardState.permanents, combatState.attackerIds);
  const viewedOpponent = getActiveViewedOpponent();
  const comparison =
    viewedOpponent && viewedOpponent.publicBoardState
      ? compareBoardTotals({
          localTotals: combatTotals,
          opponentPermanents: createViewerBoardState(viewedOpponent.publicBoardState, viewedOpponent.permissions).permanents,
        })
      : null;
  const hasAttackers = combatState.attackerIds.length > 0;
  const summaryText = combatState.summary;
  let summaryLabel = "Combat Triggers Idle";

  if (combatState.mode === "selected") {
    summaryLabel = combatState.confirmed ? "Selected Attackers Confirmed" : "Selected Attackers Ready";
  } else if (combatState.mode === "all") {
    summaryLabel = combatState.confirmed ? "All Attackers Confirmed" : "All Attackers Ready";
  }

  if (confirmCombatButton) {
    confirmCombatButton.disabled = !hasAttackers || combatState.confirmed;
  }
  clearAttackersButton.disabled = !hasAttackers;

  combatSummary.innerHTML = `
    <article class="combat-summary-card">
      <span class="combat-summary-label">${summaryLabel}</span>
      <span class="combat-summary-value">${combatTotals.power} / ${combatTotals.toughness}</span>
      ${
        summaryText
          ? `<span class="combat-summary-note">${escapeHtml(summaryText)}</span>`
          : '<span class="combat-summary-note">Choose attackers first, then use Confirm Combat to tap legal attackers and resolve supported combat triggers with official card text and rulings guidance.</span>'
      }
      ${
        comparison
          ? `<span class="combat-summary-note">Vs ${escapeHtml(viewedOpponent.displayName)}: ${comparison.difference.power >= 0 ? "+" : ""}${comparison.difference.power} / ${comparison.difference.toughness >= 0 ? "+" : ""}${comparison.difference.toughness}</span>`
          : ""
      }
    </article>
  `;
}

function renderCardDetailOverlay() {
  const permanent =
    state.boardState.permanents.find((entry) => entry.id === boardUi.detailDialogPermanentId) || null;

  if (!permanent) {
    if (cardDetailDialog.open) {
      closeCardOverlay();
    } else if (boardUi.detailDialogPermanentId || boardUi.detailPermanentId) {
      clearExpandedCardState();
    }
    return;
  }

  const currentPower = getPermanentCurrentPower(permanent, state.boardState.permanents);
  const currentToughness = getPermanentCurrentToughness(permanent, state.boardState.permanents);
  const typeFlags = [
    permanent.isLegendary ? "Legendary" : "Non-Legendary",
    permanent.isArtifact ? "Artifact" : "Non-Artifact",
    permanent.isCreature ? "Creature" : "Non-Creature",
  ].join(", ");
  const imageUrl = permanent.cardImageUrl || permanent.imageUrl;
  const linkedRules = getRulesForPermanent(permanent.id);
  const linkedSuggestions = getSuggestionsForPermanent(permanent.id);
  const commanderLegality = permanent.legalities?.commander || "unknown";

  cardDetailTitle.textContent = permanent.name;
  cardDetailContent.innerHTML = `
    ${
      imageUrl
        ? `<div class="card-detail-image-wrap"><img class="card-detail-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(permanent.name)}" /></div>`
        : ""
    }
    <div class="card-detail-body">
      <span class="card-detail-line"><strong>Name:</strong> ${escapeHtml(permanent.name)}</span>
      <span class="card-detail-line"><strong>Mana Cost:</strong> ${escapeHtml(permanent.manaCost || "No mana cost")}</span>
      <span class="card-detail-line"><strong>Type Line:</strong> ${escapeHtml(permanent.typeLine || getFallbackTypeLine(permanent))}</span>
      <span class="card-detail-line"><strong>Oracle Text:</strong> ${escapeHtml(permanent.oracleText || permanent.notes || "No oracle text available.")}</span>
      <span class="card-detail-line"><strong>Power / Toughness:</strong> ${permanent.isCreature ? `${permanent.power}/${permanent.toughness}` : "N/A"}</span>
      <span class="card-detail-line"><strong>Current P/T:</strong> ${permanent.isCreature ? `${currentPower}/${currentToughness}` : "N/A"}</span>
      <span class="card-detail-line"><strong>Quantity:</strong> ${permanent.quantity}</span>
      <span class="card-detail-line"><strong>Tapped:</strong> ${permanent.isTapped ? "Yes" : "No"}</span>
      <span class="card-detail-line"><strong>Commander:</strong> ${permanent.isCommander ? "Yes" : "No"}</span>
      ${permanent.isPlaneswalker ? `<span class="card-detail-line"><strong>Loyalty:</strong> ${getPermanentCounterValue(permanent, "Loyalty")}</span>` : ""}
      <span class="card-detail-line"><strong>+1/+1 Counters:</strong> ${permanent.plusOneCounters}</span>
      <span class="card-detail-line"><strong>-1/-1 Counters:</strong> ${normalizeCount(permanent.minusOneCounters)}</span>
      <span class="card-detail-line"><strong>All Counters:</strong> ${escapeHtml(getPermanentCounterSummary(permanent))}</span>
      <span class="card-detail-line"><strong>Temp Buff (EOT):</strong> ${normalizeSignedCount(permanent.temporaryPowerUntilTurnEnd) >= 0 ? "+" : ""}${normalizeSignedCount(permanent.temporaryPowerUntilTurnEnd)}/${normalizeSignedCount(permanent.temporaryToughnessUntilTurnEnd) >= 0 ? "+" : ""}${normalizeSignedCount(permanent.temporaryToughnessUntilTurnEnd)}</span>
      <span class="card-detail-line"><strong>Temp Buff (EOC):</strong> ${normalizeSignedCount(permanent.temporaryPowerUntilCombatEnd) >= 0 ? "+" : ""}${normalizeSignedCount(permanent.temporaryPowerUntilCombatEnd)}/${normalizeSignedCount(permanent.temporaryToughnessUntilCombatEnd) >= 0 ? "+" : ""}${normalizeSignedCount(permanent.temporaryToughnessUntilCombatEnd)}</span>
      <span class="card-detail-line"><strong>Token:</strong> ${permanent.isToken ? "Yes" : "No"}</span>
      <span class="card-detail-line"><strong>Flags:</strong> ${escapeHtml(typeFlags)}</span>
      <span class="card-detail-line"><strong>Commander Legality:</strong> ${escapeHtml(commanderLegality)}</span>
      ${
        permanent.rulingsUri
          ? `<span class="card-detail-line"><strong>Rulings Source:</strong> ${escapeHtml(permanent.rulingsUri)}</span>`
          : ""
      }
      ${
        permanent.notes
          ? `<span class="card-detail-line"><strong>Notes:</strong> ${escapeHtml(permanent.notes)}</span>`
          : ""
      }
      ${
        linkedRules.length > 0
          ? `
            <div class="card-detail-subsection">
              <span class="card-detail-subtitle">Active Automation Rules</span>
              ${linkedRules
                .map(
                  (rule) => `
                    <span class="card-detail-line">${escapeHtml(getAutomationRuleSummary(rule))}</span>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        linkedSuggestions.length > 0
          ? `
            <div class="card-detail-subsection">
              <span class="card-detail-subtitle">Pending Suggestions</span>
              ${linkedSuggestions
                .map(
                  (rule) => `
                    <span class="card-detail-line">${escapeHtml(getAutomationRuleSummary(rule))}</span>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        permanent.rulings.length > 0
          ? `
            <div class="card-detail-subsection">
              <span class="card-detail-subtitle">Scryfall Rulings</span>
              ${permanent.rulings
                .map(
                  (ruling) => `
                    <span class="card-detail-line">${escapeHtml(
                      `${ruling.publishedAt ? `${ruling.publishedAt}: ` : ""}${ruling.comment}`
                    )}</span>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        linkedRules.length > 0
          ? `
            <div class="card-detail-subsection">
              <span class="card-detail-subtitle">Rules References</span>
              ${getRulesReferenceEntries(linkedRules[0])
                .map(
                  (entry) => `
                    <span class="card-detail-line">${escapeHtml(entry.label)}: ${escapeHtml(entry.summary)}</span>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
    </div>
  `;

  showDialog(cardDetailDialog);
}

function renderEffectStrip(effects) {
  boardStateEffectsSection.hidden = effects.length === 0;
  effectStrip.innerHTML = effects.map((permanent) => renderEffectDockChip(permanent)).join("");
  bindBoardInteractionTargets(effectStrip);
}

function renderBattlefieldGrid(battlefield) {
  battlefieldGrid.innerHTML = battlefield.map((permanent) => renderBoardTile(permanent, "battlefield")).join("");
  battlefieldEmpty.hidden = battlefield.length > 0;
  bindBoardInteractionTargets(battlefieldGrid);
}

function renderBoardTotals(totals, selectedCount) {
  outputs.boardTotalScope.textContent = selectedCount > 0 ? "Selected permanents" : "All permanents";
  outputs.boardTotalValue.textContent = `${totals.power} / ${totals.toughness}`;
  boardTotalBar.hidden = !boardUi.totalsVisible;
  toggleBoardTotalsButton.textContent = boardUi.totalsVisible ? "Hide P/T" : "Show P/T";
  toggleBoardTotalsButton.setAttribute("aria-expanded", boardUi.totalsVisible ? "true" : "false");
}

function renderCommanderBadge() {
  if (!commanderNavBadge || !commanderNavName || !commanderNavMeta) {
    return;
  }

  const commander = normalizeCommanderState(state.commander);
  commanderNavName.textContent = commander.name || "No Commander";
  commanderNavMeta.textContent = commander.name ? `Tax ${commander.commanderTax}` : "Hold";
  commanderNavBadge.disabled = false;
  commanderNavBadge.title = commander.name
    ? `${commander.name} • ${commander.zone === "battlefield" ? "Battlefield" : "Command Zone"}`
    : "Set a commander from Scryfall search first.";
}

function renderBattlefieldActionButtons() {
  if (!confirmCounterSelectionButton) {
    return;
  }

  const pendingSelection = boardUi.pendingCounterSelection;
  const requiresSelectionConfirm = pendingSelection?.targetMode === "selected-permanents";
  if (!requiresSelectionConfirm) {
    confirmCounterSelectionButton.hidden = true;
    confirmCounterSelectionButton.disabled = true;
    confirmCounterSelectionButton.textContent = "Confirm Targets";
    return;
  }

  const selectedCount = getSelectedPermanentIds(state.boardState.permanents).length;
  confirmCounterSelectionButton.hidden = false;
  confirmCounterSelectionButton.disabled = selectedCount === 0;
  confirmCounterSelectionButton.textContent =
    selectedCount > 0 ? `Confirm (${selectedCount})` : "Confirm Targets";
}

function renderBoardSearch() {
  boardSearchInput.value = boardUi.searchQuery;
  boardSearchButton.disabled = boardUi.searchStatus === "loading";
  boardSearchButton.textContent = boardUi.searchStatus === "loading" ? "Searching..." : "Search";
  boardSearchCancelButtons.forEach((button) => {
    button.disabled = !isBoardSearchActive();
  });
  boardSearchFeedback.hidden = !boardUi.searchMessage;
  boardSearchFeedback.textContent = boardUi.searchMessage;
  boardSearchFeedback.dataset.tone = boardUi.searchMessageTone;
  boardSearchPanel.hidden = boardUi.searchResults.length === 0;
  boardSearchMeta.textContent = `${boardUi.searchResults.length} card${boardUi.searchResults.length === 1 ? "" : "s"}`;
  boardSearchResults.innerHTML = boardUi.searchResults.map(renderBoardSearchResult).join("");
}

function renderBoardSearchResult(card, index) {
  const preview = getCardPreview(card);
  const isSupported = isSupportedPermanent(card);
  const isDeckEligible = isCommanderDeckEligibleCard(card);
  const commanderLegality = getCommanderLegality(card);
  const supportLabel = isSupported ? getSupportDestinationLabel(preview) : "Not supported yet";
  const isSelected = boardUi.selectedSearchResultIndex === index;
  const deck = getActiveCommanderDeckArchive();
  const isInCommanderDeck = hasCommanderDeckCard(card, deck);

  return `
    <article class="board-search-result ${isSelected ? "is-selected" : ""}">
      <div class="board-search-result-topline">
        <span class="board-search-result-name">${escapeHtml(preview.name)}</span>
        <span class="board-search-result-mana">${escapeHtml(preview.manaCost || "No mana cost")}</span>
      </div>
      <div class="board-search-result-meta">
        <span class="board-search-result-type">${escapeHtml(preview.typeLine || "Unknown type")}</span>
        ${preview.isCreature ? `<span class="board-search-result-pt">${preview.power}/${preview.toughness}</span>` : ""}
      </div>
      <div class="board-search-result-text">${escapeHtml(truncateText(preview.oracleText || "No oracle text available.", 140))}</div>
      <div class="board-search-result-footer">
        <span class="board-search-result-badge">${escapeHtml(supportLabel)}</span>
        <button
          class="board-search-result-button"
          type="button"
          data-search-result-index="${index}"
          ${!isSupported ? "disabled" : ""}
        >
          ${isSupported ? "Add" : "Not Yet"}
        </button>
        <button
          class="board-search-result-button"
          type="button"
          data-search-deck-index="${index}"
          ${!isDeckEligible || isInCommanderDeck ? "disabled" : ""}
        >
          ${isInCommanderDeck ? "In Deck" : "Add Deck"}
        </button>
        <button
          class="board-search-result-button"
          type="button"
          title="${escapeHtml(commanderLegality.reason)}"
          data-search-commander-index="${index}"
          ${!commanderLegality.ok ? "disabled" : ""}
        >
          Commander
        </button>
      </div>
    </article>
  `;
}

function renderBoardTile(permanent, variant) {
  const currentPower = getPermanentCurrentPower(permanent, state.boardState.permanents);
  const currentToughness = getPermanentCurrentToughness(permanent, state.boardState.permanents);
  const manaCost = permanent.manaCost || "No mana cost";
  const typeLine = permanent.typeLine || getFallbackTypeLine(permanent);
  const oracleText = permanent.oracleText || "No oracle text available.";
  const tokenLabel = permanent.isToken ? `<span class="board-tile-tag">TOKEN</span>` : "";
  const commanderLabel = permanent.isCommander ? `<span class="board-tile-tag">CMD</span>` : "";
  const loyaltyLabel = permanent.isPlaneswalker
    ? `<span class="board-tile-tag">Loyalty ${getPermanentCounterValue(permanent, "Loyalty")}</span>`
    : "";
  const tappedLabel = permanent.isTapped ? `<span class="board-tile-tag is-tapped">TAPPED</span>` : "";
  const summoningLabel =
    permanent.isCreature && permanent.summoningSickness
      ? `<span class="board-tile-tag is-summoning">SUMMONING</span>`
      : "";
  const quantityLabel =
    permanent.quantity > 1 ? `<span class="board-tile-quantity">x${permanent.quantity}</span>` : "";
  const compactPt = permanent.isNonCreature ? "" : `${currentPower}/${currentToughness}`;
  const boardTileBasePt = permanent.isNonCreature ? "N/A" : `${permanent.power}/${permanent.toughness}`;
  const boardTileCurrentPt = permanent.isNonCreature ? "N/A" : `${currentPower}/${currentToughness}`;
  const isMenuOpen = boardUi.activeMenuPermanentId === permanent.id;
  const typeFlags = [
    permanent.isLegendary ? "Legendary" : "Non-Legendary",
    permanent.isArtifact ? "Artifact" : "Non-Artifact",
    permanent.isCreature ? "Creature" : "Non-Creature",
  ].join(", ");
  const compactStatsMarkup =
    variant === "battlefield" && !permanent.isNonCreature
      ? `
        <div class="board-tile-stat-grid">
          <div class="board-tile-statline">
            <span class="board-tile-statlabel">Mana</span>
            <span class="board-tile-mana">${escapeHtml(manaCost)}</span>
          </div>
          <div class="board-tile-statline">
            <span class="board-tile-statlabel">P/T</span>
            <span class="board-tile-pt-value">${compactPt}</span>
          </div>
        </div>
      `
      : `
        <div class="board-tile-stats">
          <span class="board-tile-mana">${escapeHtml(manaCost)}</span>
          ${compactPt ? `<span class="board-tile-current-pt">${compactPt}</span>` : ""}
        </div>
      `;
  const tileClasses = [
    "board-tile",
    variant === "effect" ? "is-effect" : "",
    permanent.isSelected ? "is-selected" : "",
    state.boardState.combatState.attackerIds.includes(permanent.id) ? "is-attacking" : "",
    permanent.isTapped ? "is-tapped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${tileClasses}">
      <button class="board-tile-main" type="button" data-board-action="toggle-select" data-permanent-id="${permanent.id}">
        <div class="board-tile-summary">
          <div class="board-tile-topline">
            <span class="board-tile-name">${escapeHtml(permanent.name)}</span>
          </div>
          ${compactStatsMarkup}
          <div class="board-tile-tags">
            ${quantityLabel}
            ${commanderLabel}
            ${tokenLabel}
            ${loyaltyLabel}
            ${tappedLabel}
            ${summoningLabel}
          </div>
        </div>
      </button>
      ${
        permanent.isExpanded
          ? `
        <div class="board-tile-expanded">
          <span class="board-tile-detail">Full Name: ${escapeHtml(permanent.name)}</span>
          <span class="board-tile-detail">Mana Cost: ${escapeHtml(manaCost)}</span>
          <span class="board-tile-detail">Type Line: ${escapeHtml(typeLine)}</span>
          <span class="board-tile-detail">Oracle Text: ${escapeHtml(oracleText)}</span>
          <span class="board-tile-detail">Base P/T: ${boardTileBasePt}</span>
          <span class="board-tile-detail">Current P/T: ${boardTileCurrentPt}</span>
          <span class="board-tile-detail">Quantity: ${permanent.quantity}</span>
          <span class="board-tile-detail">Token: ${permanent.isToken ? "Yes" : "No"}</span>
          <span class="board-tile-detail">Tapped: ${permanent.isTapped ? "Yes" : "No"}</span>
          <span class="board-tile-detail">Summoning Sickness: ${permanent.summoningSickness ? "Yes" : "No"}</span>
          <span class="board-tile-detail">+1/+1 Counters: ${permanent.plusOneCounters}</span>
          <span class="board-tile-detail">-1/-1 Counters: ${normalizeCount(permanent.minusOneCounters)}</span>
          <span class="board-tile-detail">All Counters: ${escapeHtml(getPermanentCounterSummary(permanent))}</span>
          ${permanent.isPlaneswalker ? `<span class="board-tile-detail">Loyalty Activated This Turn: ${permanent.loyaltyActivatedTurn === state.runtime.turnNumber ? "Yes" : "No"}</span>` : ""}
          <span class="board-tile-detail">Doubles Tokens: ${permanent.doublesTokens ? "Yes" : "No"}</span>
          <span class="board-tile-detail">Creates Tokens: ${permanent.createsTokens ? "Yes" : "No"}</span>
          <span class="board-tile-detail">Adds Counters: ${permanent.addsCounters ? "Yes" : "No"}</span>
          <span class="board-tile-detail">Type Flags: ${typeFlags}</span>
          ${
            permanent.notes
              ? `<span class="board-tile-detail">Notes: ${escapeHtml(permanent.notes)}</span>`
              : ""
          }
        </div>
      `
          : ""
      }
      <div class="board-tile-actions">
        <button class="board-tile-action" type="button" data-board-action="open-detail" data-permanent-id="${permanent.id}">
          Details
        </button>
        <div class="board-tile-menu-wrap">
          <button
            class="board-tile-menu-toggle"
            type="button"
            data-board-action="toggle-menu"
            data-permanent-id="${permanent.id}"
            aria-expanded="${isMenuOpen ? "true" : "false"}"
            aria-label="Open permanent actions"
          >
            ...
          </button>
          ${
            isMenuOpen
              ? `
            <div class="board-tile-menu">
              <button class="board-tile-menu-action" type="button" data-board-action="${permanent.isTapped ? "untap" : "tap"}" data-permanent-id="${permanent.id}">${permanent.isTapped ? "Untap" : "Tap"}</button>
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="loyalty-plus" data-permanent-id="${permanent.id}">+ Loyalty</button>` : ""}
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="loyalty-minus" data-permanent-id="${permanent.id}">- Loyalty</button>` : ""}
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="loyalty-activate" data-permanent-id="${permanent.id}">Use Loyalty</button>` : ""}
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="planeswalker-damage" data-permanent-id="${permanent.id}">Damage</button>` : ""}
              <button class="board-tile-menu-action" type="button" data-board-action="destroy" data-permanent-id="${permanent.id}">Destroy</button>
              <button class="board-tile-menu-action" type="button" data-board-action="exile" data-permanent-id="${permanent.id}">Exile</button>
              <button class="board-tile-menu-action" type="button" data-board-action="sacrifice" data-permanent-id="${permanent.id}">Sacrifice</button>
            </div>
          `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderEffectDockChip(permanent) {
  const manaCost = permanent.manaCost || "No mana cost";
  const isMenuOpen = boardUi.activeMenuPermanentId === permanent.id;

  return `
    <article class="effect-dock-chip ${permanent.isSelected ? "is-selected" : ""} ${permanent.isTapped ? "is-tapped" : ""}">
      <button class="effect-dock-main" type="button" data-board-action="toggle-select" data-permanent-id="${permanent.id}">
        <span class="effect-dock-name">${escapeHtml(permanent.name)}</span>
        <span class="effect-dock-mana">${escapeHtml(manaCost)}</span>
        ${permanent.isCommander ? '<span class="effect-dock-state">CMD</span>' : ""}
        ${permanent.isPlaneswalker ? `<span class="effect-dock-state">Loyalty ${getPermanentCounterValue(permanent, "Loyalty")}</span>` : ""}
        ${permanent.isTapped ? '<span class="effect-dock-state">Tapped</span>' : ""}
      </button>
      <div class="effect-dock-actions">
        <button class="effect-dock-action" type="button" data-board-action="open-detail" data-permanent-id="${permanent.id}">
          i
        </button>
        <div class="effect-dock-menu-wrap">
          <button
            class="effect-dock-menu-toggle"
            type="button"
            data-board-action="toggle-menu"
            data-permanent-id="${permanent.id}"
            aria-expanded="${isMenuOpen ? "true" : "false"}"
            aria-label="Open non-creature permanent actions"
          >
            ...
          </button>
          ${
            isMenuOpen
              ? `
            <div class="board-tile-menu">
              <button class="board-tile-menu-action" type="button" data-board-action="${permanent.isTapped ? "untap" : "tap"}" data-permanent-id="${permanent.id}">${permanent.isTapped ? "Untap" : "Tap"}</button>
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="loyalty-plus" data-permanent-id="${permanent.id}">+ Loyalty</button>` : ""}
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="loyalty-minus" data-permanent-id="${permanent.id}">- Loyalty</button>` : ""}
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="loyalty-activate" data-permanent-id="${permanent.id}">Use Loyalty</button>` : ""}
              ${permanent.isPlaneswalker ? `<button class="board-tile-menu-action" type="button" data-board-action="planeswalker-damage" data-permanent-id="${permanent.id}">Damage</button>` : ""}
              <button class="board-tile-menu-action" type="button" data-board-action="remove" data-permanent-id="${permanent.id}">Remove</button>
              <button class="board-tile-menu-action" type="button" data-board-action="destroy" data-permanent-id="${permanent.id}">Destroy</button>
              <button class="board-tile-menu-action" type="button" data-board-action="exile" data-permanent-id="${permanent.id}">Exile</button>
              <button class="board-tile-menu-action" type="button" data-board-action="sacrifice" data-permanent-id="${permanent.id}">Sacrifice</button>
            </div>
          `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderPublicBoardTile(permanent, variant, allPermanents = [permanent]) {
  const quantityLabel =
    permanent.quantity > 1 ? `<span class="board-tile-quantity">x${permanent.quantity}</span>` : "";
  const tokenLabel = permanent.isToken ? '<span class="board-tile-tag">TOKEN</span>' : "";
  const isHidden = Boolean(permanent.isPublicHidden);

  if (isHidden) {
    return `
      <article class="board-tile is-readonly is-face-down">
        <div class="board-tile-cardback" aria-hidden="true">Hidden</div>
        <div class="board-tile-summary">
          <div class="board-tile-topline">
            <span class="board-tile-name">${escapeHtml(permanent.name)}</span>
          </div>
          <div class="board-tile-tags">
            ${quantityLabel}
            <span class="board-tile-tag">FACE-DOWN</span>
          </div>
        </div>
      </article>
    `;
  }

  const currentPower = getPermanentCurrentPower(permanent, allPermanents);
  const currentToughness = getPermanentCurrentToughness(permanent, allPermanents);
  const manaCost = permanent.manaCost || "No mana cost";
  const compactStatsMarkup =
    variant === "battlefield" && permanent.isCreature
      ? `
        <div class="board-tile-stat-grid">
          <div class="board-tile-statline">
            <span class="board-tile-statlabel">Mana</span>
            <span class="board-tile-mana">${escapeHtml(manaCost)}</span>
          </div>
          <div class="board-tile-statline">
            <span class="board-tile-statlabel">P/T</span>
            <span class="board-tile-pt-value">${currentPower}/${currentToughness}</span>
          </div>
        </div>
      `
      : `
        <div class="board-tile-stats">
          <span class="board-tile-mana">${escapeHtml(manaCost)}</span>
          ${
            permanent.isCreature
              ? `<span class="board-tile-current-pt">${currentPower}/${currentToughness}</span>`
              : ""
          }
        </div>
      `;

  return `
    <article class="board-tile is-readonly">
      <div class="board-tile-summary">
        <div class="board-tile-topline">
          <span class="board-tile-name">${escapeHtml(permanent.name)}</span>
        </div>
        ${compactStatsMarkup}
        <div class="board-tile-tags">
          ${quantityLabel}
          ${tokenLabel}
        </div>
      </div>
    </article>
  `;
}

function createCompanionUndoSnapshot() {
  return {
    life: state.life,
    tax: state.tax,
    mana: state.mana,
    playerCounters: structuredClone(state.playerCounters),
    commanderDamageTrackers: structuredClone(state.commanderDamageTrackers),
    commander: structuredClone(state.commander),
    boardState: normalizeBoardStateSnapshot(state.boardState),
    floatingMana: structuredClone(state.companion?.floatingMana || {}),
  };
}

function registerCompanionAction({ type, summary, payload = {}, includeUndo = true }) {
  const historyEntry = createHistoryEntry({
    type,
    summary,
    payload,
  });

  let nextCompanion = recordHistoryAction(state.companion, historyEntry);
  if (includeUndo) {
    nextCompanion = pushUndoSnapshot(nextCompanion, {
      reason: summary,
      snapshot: createCompanionUndoSnapshot(),
    });
  }

  state = {
    ...state,
    companion: nextCompanion,
  };
}

function undoLastCompanionAction() {
  const { companionState, undoEntry } = popUndoSnapshot(state.companion);
  if (!undoEntry?.snapshot) {
    showQuickToast("No undo snapshot available.");
    return;
  }

  const snapshot = undoEntry.snapshot;
  const restoredCompanion = recordHistoryAction(
    {
      ...companionState,
      lifeRollback: null,
    },
    createHistoryEntry({
      type: "undo",
      summary: `Undo: ${undoEntry.reason || "Action"}`,
      payload: { reason: undoEntry.reason || "" },
    })
  );

  state = {
    ...state,
    life: normalizeCount(snapshot.life, state.life),
    tax: normalizeCount(snapshot.tax, state.tax),
    mana: normalizeCount(snapshot.mana, state.mana),
    playerCounters: structuredClone(snapshot.playerCounters || state.playerCounters),
    commanderDamageTrackers: structuredClone(snapshot.commanderDamageTrackers || state.commanderDamageTrackers),
    commander: normalizeCommanderState(snapshot.commander || state.commander),
    boardState: normalizeBoardStateSnapshot(snapshot.boardState || state.boardState),
    companion: {
      ...restoredCompanion,
      floatingMana: structuredClone(snapshot.floatingMana || state.companion?.floatingMana || {}),
    },
  };

  persistState();
  render();
  showQuickToast("Undid last action.");
}

function rollbackLifeWithinBuffer() {
  const rollback = state.companion?.lifeRollback;
  if (!hasActiveLifeRollback(rollback)) {
    showQuickToast("Life rollback window expired.");
    return;
  }

  const previousLife = normalizeCount(rollback.previousLife, state.life);
  registerCompanionAction({
    type: "life-rollback",
    summary: `Rolled life back to ${previousLife}`,
    payload: {
      from: state.life,
      to: previousLife,
    },
  });

  state = {
    ...state,
    life: previousLife,
    companion: {
      ...state.companion,
      lifeRollback: null,
    },
  };

  persistState();
  render();
  showQuickToast("Life rolled back.");
}

function cleanupExpiredLifeRollback() {
  const rollback = state.companion?.lifeRollback;
  if (!rollback) {
    return;
  }

  if (hasActiveLifeRollback(rollback)) {
    return;
  }

  state = {
    ...state,
    companion: {
      ...state.companion,
      lifeRollback: null,
    },
  };
}

function updateCompanionSetting(settingKey, enabled) {
  if (!settingKey) {
    return;
  }

  state = {
    ...state,
    companion: {
      ...state.companion,
      settings: {
        ...state.companion.settings,
        [settingKey]: Boolean(enabled),
      },
    },
  };
  registerCompanionAction({
    type: "setting",
    summary: `${settingKey} ${enabled ? "enabled" : "disabled"}`,
    payload: { settingKey, enabled: Boolean(enabled) },
    includeUndo: false,
  });
  persistState();
  render();
}

function handleFloatingManaClick(event) {
  const button = event.target.closest("[data-floating-mana-color][data-delta]");
  if (!button) {
    return;
  }

  const color = String(button.dataset.floatingManaColor || "").toUpperCase();
  const delta = Number(button.dataset.delta);
  if (!Number.isFinite(delta)) {
    return;
  }

  const previousValue = Number(state.companion?.floatingMana?.[color]) || 0;
  const nextFloatingMana = applyFloatingManaDelta(state.companion?.floatingMana, color, delta);
  const nextValue = Number(nextFloatingMana[color]) || 0;
  if (previousValue === nextValue) {
    return;
  }

  registerCompanionAction({
    type: "mana",
    summary: `Floating mana ${color} ${delta > 0 ? "+" : ""}${delta}`,
    payload: { color, from: previousValue, to: nextValue },
  });

  state = {
    ...state,
    companion: {
      ...state.companion,
      floatingMana: nextFloatingMana,
    },
  };

  persistState();
  render();
}

function updateScalarField(field, delta) {
  const nextValue = normalizeCount(state[field] + delta);
  const previousValue = state[field];
  registerCompanionAction({
    type: field === "life" ? "life" : "scalar",
    summary: `${field} ${delta > 0 ? "+" : ""}${delta}`,
    payload: { field, from: previousValue, to: nextValue },
  });
  state = {
    ...state,
    [field]: nextValue,
    companion:
      field === "life"
        ? {
            ...state.companion,
            lifeRollback: createLifeRollbackBuffer({
              previousLife: previousValue,
              nextLife: nextValue,
            }),
          }
        : state.companion,
  };
  persistState();
  render();
}

function handleCounterClick(event) {
  const button = event.target.closest("[data-counter-id][data-delta]");
  if (!button) {
    return;
  }

  updatePlayerCounter(button.dataset.counterId, Number(button.dataset.delta));
}

function handleDamageClick(event) {
  const stepButton = event.target.closest("[data-damage-index][data-delta]");
  if (stepButton) {
    updateCommanderDamageValue(Number(stepButton.dataset.damageIndex), Number(stepButton.dataset.delta));
    return;
  }

  const labelButton = event.target.closest("[data-damage-label-index]");
  if (labelButton) {
    renameCommanderDamageLabel(Number(labelButton.dataset.damageLabelIndex));
  }
}

function handleConnectedPlayersListClick(event) {
  const viewButton = event.target.closest("[data-connected-player-id][data-connected-view]");
  if (!viewButton) {
    return;
  }

  openConnectedPlayerView(viewButton.dataset.connectedPlayerId, viewButton.dataset.connectedView);
}

function handleConnectedPlayerViewTabClick(event) {
  const tabButton = event.target.closest("[data-player-view-mode]");
  if (!tabButton) {
    return;
  }

  multiplayerUi = {
    ...multiplayerUi,
    activeViewMode: normalizeMultiplayerViewMode(tabButton.dataset.playerViewMode),
  };
  renderMultiplayerUi();
}

function handleConnectedPlayerViewContentClick(event) {
  const compareToggle = event.target.closest("[data-compare-toggle]");
  if (compareToggle) {
    multiplayerUi = {
      ...multiplayerUi,
      compareBoardsVisible: !multiplayerUi.compareBoardsVisible,
    };
    renderMultiplayerUi();
    return;
  }

  const compareModeButton = event.target.closest("[data-compare-mode]");
  if (compareModeButton) {
    multiplayerUi = {
      ...multiplayerUi,
      compareMode: compareModeButton.dataset.compareMode === "selected" ? "selected" : "all",
      compareBoardsVisible: true,
    };
    renderMultiplayerUi();
  }
}

function handleAutomationRulesListClick(event) {
  const actionButton = event.target.closest("[data-automation-action][data-automation-id]");
  if (!actionButton) {
    return;
  }

  const { automationAction, automationId } = actionButton.dataset;
  if (automationAction === "toggle-rule-enabled") {
    updateAutomationRule(automationId, (rule) => ({
      ...rule,
      enabled: !rule.enabled,
    }));
    return;
  }

  if (automationAction === "toggle-rule-ask") {
    updateAutomationRule(automationId, (rule) => ({
      ...rule,
      askBeforeRun: !rule.askBeforeRun,
    }));
    return;
  }

  if (automationAction === "run-rule") {
    forceRunAutomationRule(automationId);
    return;
  }

  if (automationAction === "remove-rule") {
    removeAutomationRule(automationId);
  }
}

function handleAutomationSuggestionsClick(event) {
  const actionButton = event.target.closest("[data-automation-action][data-automation-id]");
  if (!actionButton) {
    return;
  }

  const { automationAction, automationId } = actionButton.dataset;
  if (automationAction === "accept-suggestion") {
    acceptAutomationSuggestion(automationId);
    return;
  }

  if (automationAction === "toggle-suggestion-ask") {
    updateAutomationSuggestion(automationId, (rule) => ({
      ...rule,
      askBeforeRun: !rule.askBeforeRun,
    }));
    return;
  }

  if (automationAction === "edit-suggestion") {
    editAutomationSuggestion(automationId);
    return;
  }

  if (automationAction === "reject-suggestion") {
    rejectAutomationSuggestion(automationId);
  }
}

function handleAutomationManualTriggersClick(event) {
  const editButton = event.target.closest("[data-trigger-edit-id]");
  if (editButton) {
    editManualTrigger(editButton.dataset.triggerEditId);
    return;
  }

  const removeButton = event.target.closest("[data-trigger-remove-id]");
  if (removeButton) {
    removeTrigger(removeButton.dataset.triggerRemoveId);
  }
}

function handleBoardSearchInput(event) {
  const searchQuery = event.target.value;
  const commanderSuggestions = getCommanderDeckSearchCards(searchQuery);
  boardUi = {
    ...boardUi,
    searchQuery,
    searchStatus: "idle",
    searchResults: commanderSuggestions,
    selectedSearchResultIndex: -1,
    searchMessage: commanderSuggestions.length > 0 ? "Commander deck suggestions ready. Tap Search for more Scryfall results." : "",
    searchMessageTone: "neutral",
    searchRequestId: boardUi.searchRequestId + 1,
  };

  renderBoardSearch();
}

async function handleBoardSearchSubmit(event) {
  event.preventDefault();

  const query = boardSearchInput.value.trim();
  boardUi = {
    ...boardUi,
    searchQuery: query,
    searchStatus: query ? "loading" : "idle",
    searchResults: [],
    selectedSearchResultIndex: -1,
    searchMessage: query ? "Searching Scryfall..." : "",
    searchMessageTone: "neutral",
    searchRequestId: boardUi.searchRequestId + 1,
  };
  renderBoardSearch();

  if (!query) {
    return;
  }

  const requestId = boardUi.searchRequestId;

  try {
    const cards = await searchCards(query);
    if (requestId !== boardUi.searchRequestId) {
      return;
    }

    boardUi = {
      ...boardUi,
      searchStatus: cards.length > 0 ? "success" : "empty",
      searchResults: cards,
      searchMessage: cards.length > 0 ? "" : "No matching cards found.",
      searchMessageTone: "neutral",
    };
  } catch (error) {
    if (requestId !== boardUi.searchRequestId) {
      return;
    }

    boardUi = {
      ...boardUi,
      searchStatus: "error",
      searchResults: [],
      searchMessage: error instanceof Error ? error.message : "Card search failed.",
      searchMessageTone: "error",
    };
  }

  renderBoardSearch();
}

function handleBoardSearchResultClick(event) {
  const commanderButton = event.target.closest("[data-search-commander-index]");
  if (commanderButton) {
    setSearchResultAsCommander(Number(commanderButton.dataset.searchCommanderIndex));
    return;
  }

  const deckButton = event.target.closest("[data-search-deck-index]");
  if (deckButton) {
    addSearchResultToCommanderDeck(Number(deckButton.dataset.searchDeckIndex));
    return;
  }

  const selectButton = event.target.closest("[data-search-result-index]");
  if (!selectButton) {
    return;
  }

  handleCardResultSelect(Number(selectButton.dataset.searchResultIndex));
}

function handleCardResultSelect(resultIndex) {
  const card = boardUi.searchResults[resultIndex];
  if (!card) {
    return;
  }

  boardUi = {
    ...boardUi,
    selectedSearchResultIndex: resultIndex,
  };

  closeSearch({
    clearQuery: true,
    clearMessage: true,
  });
  renderBoardSearch();
  void addSelectedCardToBattlefield(card);
}

function addSearchResultToCommanderDeck(resultIndex) {
  const card = boardUi.searchResults[resultIndex];
  if (!card) {
    return;
  }

  const result = addCardToCommanderDeckArchive(card, getActiveCommanderName());
  boardUi = {
    ...boardUi,
    searchMessage: result.message,
    searchMessageTone: result.ok ? "success" : "neutral",
  };
  persistState();
  render();
  showQuickToast(result.message);
}

function setSearchResultAsCommander(resultIndex) {
  const card = boardUi.searchResults[resultIndex];
  if (!card) {
    return;
  }

  const legality = getCommanderLegality(card);
  if (!legality.ok) {
    showQuickToast(legality.reason);
    return;
  }

  const commander = createCommanderStateFromCard(card, legality);
  registerCompanionAction({
    type: "commander",
    summary: `Selected commander: ${commander.name}`,
    payload: {
      commanderName: commander.name,
      colorIdentity: commander.colorIdentity,
    },
  });

  state = {
    ...state,
    commander,
    tax: commander.commanderTax,
  };

  resetSearchState();
  persistState();
  render();
  showQuickToast(`Commander set: ${commander.name}`);
}

function createCommanderStateFromCard(card, legality = getCommanderLegality(card)) {
  const preview = getCardPreview(card);
  return normalizeCommanderState({
    name: preview.name,
    scryfallId: typeof card?.id === "string" ? card.id : "",
    manaCost: preview.manaCost,
    typeLine: preview.typeLine,
    oracleText: preview.oracleText,
    imageUrl: preview.imageUrl,
    cardImageUrl: preview.cardImageUrl,
    colorIdentity: getCardColorIdentity(card),
    power: preview.power,
    toughness: preview.toughness,
    loyalty: preview.loyalty,
    legalities: card?.legalities || {},
    zone: "command",
    castCount: 0,
    commanderTax: 0,
    damageByOpponent: {},
    isLegal: legality.ok,
    legalityReason: legality.reason,
  });
}

function handleCancelBoardSearch() {
  resetSearchState();
  renderBoardSearch();
}

function handleCommanderBadgePointerDown(event) {
  event.preventDefault();
  event.stopPropagation();
  window.clearTimeout(commanderBadgePressTimer);
  commanderBadgeLongPressTriggered = false;
  commanderBadgePressTimer = window.setTimeout(() => {
    commanderBadgeLongPressTriggered = true;
    openCommanderActionDialog();
  }, BOARD_LONG_PRESS_MS);
}

function handleCommanderBadgePointerEnd(event) {
  event.preventDefault();
  event.stopPropagation();
  window.clearTimeout(commanderBadgePressTimer);
}

function openCommanderActionDialog() {
  const commander = normalizeCommanderState(state.commander);
  if (commanderActionTitle) {
    commanderActionTitle.textContent = commander.name || "No Commander Selected";
  }
  if (commanderActionNote) {
    commanderActionNote.textContent = commander.name
      ? `${commander.zone === "battlefield" ? "On battlefield" : "In command zone"} • current commander tax ${commander.commanderTax}.`
      : "Search Scryfall and press Commander on a legal commander first.";
  }
  if (castCommanderButton) {
    castCommanderButton.disabled = !commander.name || commander.zone === "battlefield";
  }
  showDialog(commanderActionDialog);
}

function castCommanderFromCommandZone() {
  const commander = normalizeCommanderState(state.commander);
  if (!commander.name) {
    showQuickToast("Set a commander first.");
    return;
  }

  const alreadyOnBattlefield = state.boardState.permanents.some((permanent) => permanent.isCommander && permanent.scryfallId === commander.scryfallId);
  if (alreadyOnBattlefield) {
    showQuickToast(`${commander.name} is already on the battlefield.`);
    commanderActionDialog?.close();
    return;
  }

  const currentTax = normalizeCount(commander.commanderTax, normalizeCount(commander.castCount, 0) * 2);
  const nextCastCount = normalizeCount(commander.castCount, 0) + 1;
  const commanderPermanent = createPermanent({
    scryfallId: commander.scryfallId,
    name: commander.name,
    manaCost: commander.manaCost,
    typeLine: commander.typeLine,
    oracleText: commander.oracleText,
    imageUrl: commander.imageUrl,
    cardImageUrl: commander.cardImageUrl,
    legalities: commander.legalities,
    colorIdentity: commander.colorIdentity,
    power: 0,
    toughness: 0,
    quantity: 1,
    isToken: false,
    isNonCreature: !hasTypeLine(commander.typeLine, "Creature"),
    isLegendary: hasTypeLine(commander.typeLine, "Legendary"),
    isArtifact: hasTypeLine(commander.typeLine, "Artifact"),
    isCreature: hasTypeLine(commander.typeLine, "Creature"),
    isPlaneswalker: hasTypeLine(commander.typeLine, "Planeswalker"),
    printedLoyalty: commander.loyalty,
    counters: hasTypeLine(commander.typeLine, "Planeswalker") && commander.loyalty > 0 ? { Loyalty: commander.loyalty } : {},
    isCommander: true,
    commanderOwnerName: commander.name,
    commanderCastNumber: nextCastCount,
    summoningSickness: hasTypeLine(commander.typeLine, "Creature"),
  });

  registerCompanionAction({
    type: "commander",
    summary: `Cast commander ${commander.name} (tax ${currentTax})`,
    payload: {
      commanderName: commander.name,
      commanderTax: currentTax,
      castCount: nextCastCount,
    },
  });

  state = {
    ...state,
    tax: nextCastCount * 2,
    commander: normalizeCommanderState({
      ...commander,
      zone: "battlefield",
      castCount: nextCastCount,
      commanderTax: nextCastCount * 2,
    }),
    boardState: addImportedPermanentToBoardState(state.boardState, commanderPermanent),
  };

  commanderActionDialog?.close();
  persistState();
  render();
  showQuickToast(`Cast ${commander.name}. Next tax ${nextCastCount * 2}.`);
}

function handleDocumentSearchClick(event) {
  if (!boardSearchSection || !isBoardSearchActive()) {
    return;
  }

  if (boardSearchSection.contains(event.target)) {
    return;
  }

  closeSearch({
    clearQuery: false,
    clearMessage: true,
  });
  renderBoardSearch();
}

function handleBoardGestureStart(event) {
  const tileButton = event.target.closest("[data-board-action='toggle-select'][data-permanent-id]");
  if (!tileButton || !(tileButton instanceof HTMLElement)) {
    return;
  }

  const permanentId = tileButton.dataset.permanentId || "";
  if (!permanentId) {
    return;
  }

  const pointerType = event.pointerType || "mouse";
  if (pointerType === "mouse" && event.button !== 0) {
    return;
  }

  clearBoardGestureTimer();
  const startX = Number(event.clientX) || 0;
  const startY = Number(event.clientY) || 0;
  boardGestureState = {
    permanentId,
    pointerId: event.pointerId,
    startX,
    startY,
    lastX: startX,
    lastY: startY,
    longPressTriggered: false,
    hasMoved: false,
    timer: window.setTimeout(() => {
      if (!boardGestureState || boardGestureState.permanentId !== permanentId) {
        return;
      }

      boardGestureState.longPressTriggered = true;
      suppressTileClickFor(permanentId, 500);
      openCardDetailOverlay(permanentId);
    }, BOARD_LONG_PRESS_MS),
  };
}

function handleBoardGestureMove(event) {
  if (!boardGestureState || event.pointerId !== boardGestureState.pointerId) {
    return;
  }

  const nextX = Number(event.clientX) || 0;
  const nextY = Number(event.clientY) || 0;
  boardGestureState.lastX = nextX;
  boardGestureState.lastY = nextY;
  const deltaX = Math.abs(nextX - boardGestureState.startX);
  const deltaY = Math.abs(nextY - boardGestureState.startY);
  if (deltaX > 8 || deltaY > 8) {
    boardGestureState.hasMoved = true;
    clearBoardGestureTimer();
  }
}

function handleBoardGestureEnd(event) {
  if (!boardGestureState || event.pointerId !== boardGestureState.pointerId) {
    return;
  }

  const { permanentId, startX, startY, longPressTriggered } = boardGestureState;
  const endX = Number(event.clientX) || boardGestureState.lastX;
  const endY = Number(event.clientY) || boardGestureState.lastY;
  clearBoardGestureTimer();

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const isHorizontalSwipe =
    Math.abs(deltaX) >= BOARD_SWIPE_REMOVE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

  if (longPressTriggered) {
    suppressTileClickFor(permanentId, 450);
  } else if (isHorizontalSwipe) {
    suppressTileClickFor(permanentId, 550);
    applyPermanentRemoval(permanentId, "destroy");
  }

  boardGestureState = null;
}

function handleBoardGestureCancel(event) {
  if (!boardGestureState) {
    return;
  }

  if (event && Number.isFinite(event.pointerId) && event.pointerId !== boardGestureState.pointerId) {
    return;
  }

  clearBoardGestureTimer();
  boardGestureState = null;
}

function clearBoardGestureTimer() {
  if (!boardGestureState || !boardGestureState.timer) {
    return;
  }

  window.clearTimeout(boardGestureState.timer);
  boardGestureState.timer = 0;
}

function suppressTileClickFor(permanentId, durationMs) {
  suppressedTileClick = {
    permanentId: String(permanentId || ""),
    expiresAt: Date.now() + Math.max(0, Number(durationMs) || 0),
  };
}

function isBoardSearchActive() {
  return Boolean(
    boardUi.searchQuery ||
      boardUi.searchResults.length > 0 ||
      boardUi.searchStatus !== "idle" ||
      boardUi.searchMessage
  );
}

function closeSearch(options = {}) {
  resetSearchState({
    clearQuery: Boolean(options.clearQuery),
    clearMessage: options.clearMessage !== false,
  });
}

function resetSearchState(options = {}) {
  const { clearQuery = true, clearMessage = true } = options;
  boardUi = {
    ...boardUi,
    searchQuery: clearQuery ? "" : boardUi.searchQuery,
    searchStatus: "idle",
    searchResults: [],
    selectedSearchResultIndex: -1,
    searchMessage: clearMessage ? "" : boardUi.searchMessage,
    searchMessageTone: "neutral",
    searchRequestId: boardUi.searchRequestId + 1,
  };
}

function showQuickToast(message) {
  if (!quickToast) {
    return;
  }

  window.clearTimeout(quickToastHideTimer);
  window.clearTimeout(quickToastResetTimer);
  quickToast.hidden = false;
  quickToast.textContent = message;
  quickToast.classList.remove("is-visible");
  window.requestAnimationFrame(() => {
    quickToast.classList.add("is-visible");
  });

  quickToastHideTimer = window.setTimeout(() => {
    quickToast.classList.remove("is-visible");
  }, 760);

  quickToastResetTimer = window.setTimeout(() => {
    quickToast.hidden = true;
    quickToast.textContent = "";
  }, 1000);
}

function handleBoardManualAdd() {
  if (boardUi.selectedSearchResultIndex >= 0) {
    addSelectedCardToBattlefield();
    return;
  }

  promptAndAddPermanent({ isToken: false, isNonCreature: false });
}

function toggleBoardTotalsVisibility() {
  boardUi = {
    ...boardUi,
    totalsVisible: !boardUi.totalsVisible,
  };

  renderBoardTotals(
    calculateBoardTotals(state.boardState.permanents),
    getSelectedPermanentIds(state.boardState.permanents).length
  );
}

function handleBattlefieldCounterTargetMode(targetMode) {
  if (!targetMode) {
    return;
  }

  if (state.boardState.permanents.length === 0) {
    battlefieldCounterDialog?.close();
    showQuickToast("No permanents available for counters.");
    return;
  }

  if (targetMode === "selected-permanents") {
    battlefieldCounterDialog?.close();
    startBattlefieldCounterTargetSelection(targetMode);
    return;
  }

  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
    pendingCounterSelection: {
      targetMode,
      targetIds: [],
      value: 1,
      counterType: "",
    },
  };
  battlefieldCounterDialog?.close();
  openCounterTypeDialog();
}

function startBattlefieldCounterTargetSelection(targetMode) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      permanents: state.boardState.permanents.map((permanent) =>
        createPermanent({
          ...permanent,
          isSelected: false,
        })
      ),
    },
  };

  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
    pendingCounterSelection: {
      targetMode,
      targetIds: [],
      value: 1,
      counterType: "",
    },
  };

  persistState();
  render();
  showQuickToast("Select permanent(s), then tap Confirm.");
}

function clearPendingCounterSelection(options = {}) {
  const { clearSelections = false } = options;
  if (clearSelections) {
    state = {
      ...state,
      boardState: {
        ...state.boardState,
        permanents: state.boardState.permanents.map((permanent) =>
          createPermanent({
            ...permanent,
            isSelected: false,
          })
        ),
      },
    };
  }

  boardUi = {
    ...boardUi,
    pendingCounterSelection: null,
  };
}

function confirmBattlefieldCounterSelection() {
  const pendingSelection = boardUi.pendingCounterSelection;
  if (!pendingSelection || pendingSelection.targetMode !== "selected-permanents") {
    return;
  }

  const selectedIds = getSelectedPermanentIds(state.boardState.permanents);
  if (selectedIds.length === 0) {
    showQuickToast("Select at least one permanent first.");
    return;
  }

  boardUi = {
    ...boardUi,
    pendingCounterSelection: {
      ...pendingSelection,
      targetIds: selectedIds,
    },
  };
  openCounterTypeDialog();
}

function openCounterTypeDialog() {
  const pendingSelection = boardUi.pendingCounterSelection;
  if (!pendingSelection) {
    return;
  }

  renderCounterTypeDialog();
  showDialog(counterTypeDialog);
}

function renderCounterTypeDialog() {
  if (!counterTypeRecentList || !counterTypeInput) {
    return;
  }

  const recentTypes = normalizeRecentCounterTypes(state.boardState.recentCounterTypes);
  const recentSearches = Array.isArray(state.companion?.recentCounterSearches)
    ? state.companion.recentCounterSearches
    : [];
  const pendingCounterType = boardUi.pendingCounterSelection?.counterType || recentTypes[0] || "+1/+1";
  const shouldHydrateInput = !counterTypeDialog?.open || document.activeElement !== counterTypeInput;
  if (shouldHydrateInput || !counterTypeInput.value.trim()) {
    counterTypeInput.value = pendingCounterType;
  }

  const suggestions = searchCounterTypes(counterTypeInput.value || pendingCounterType, [
    ...recentTypes,
    ...recentSearches,
  ]).slice(0, 8);
  counterTypeRecentList.innerHTML = suggestions
    .map((counterType) => {
      return `
        <button class="sheet-action" type="button" data-counter-type-option="${escapeHtml(counterType)}">
          ${escapeHtml(counterType)}
        </button>
      `;
    })
    .join("");

  counterTypeRecentList
    .querySelectorAll("[data-counter-type-option]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        counterTypeInput.value = button.dataset.counterTypeOption || "";
        counterTypeInput.focus();
        counterTypeInput.select();
      });
    });
}

function handleCounterTypeSubmit(event) {
  event.preventDefault();
  const pendingSelection = boardUi.pendingCounterSelection;
  if (!pendingSelection) {
    counterTypeDialog?.close();
    return;
  }

  const counterType = normalizeCounterType(counterTypeInput?.value || "");
  if (!counterType) {
    showQuickToast("Enter a counter type first.");
    return;
  }

  const targetIds = resolveCounterTargetIdsForPendingSelection(state.boardState.permanents, pendingSelection);
  if (targetIds.length === 0) {
    if (pendingSelection.targetMode === "selected-permanents") {
      showQuickToast("No selected permanents to apply counters.");
      return;
    }

    showQuickToast("No valid permanents for that target.");
    clearPendingCounterSelection();
    render();
    counterTypeDialog?.close();
    return;
  }

  const outcome = applyCounterToPermanentTargets(state.boardState, targetIds, counterType, pendingSelection.value || 1);
  if (outcome.appliedCount === 0) {
    showQuickToast("No valid permanents were updated.");
    return;
  }

  const nextRecentCounterTypes = getNextRecentCounterTypes(state.boardState.recentCounterTypes, counterType);
  registerCompanionAction({
    type: "counter",
    summary: `Applied ${counterType} counter${outcome.appliedAmount === 1 ? "" : "s"} to ${outcome.appliedCount} permanent${outcome.appliedCount === 1 ? "" : "s"}`,
    payload: {
      counterType,
      targets: outcome.appliedCount,
      amount: outcome.appliedAmount,
      targetMode: pendingSelection.targetMode,
    },
  });
  state = {
    ...state,
    boardState: {
      ...outcome.boardState,
      recentCounterTypes: nextRecentCounterTypes,
      permanents: outcome.boardState.permanents.map((permanent) =>
        createPermanent({
          ...permanent,
          isSelected: false,
        })
      ),
    },
    companion: {
      ...state.companion,
      recentCounterSearches: updateRecentCounterSearches(state.companion?.recentCounterSearches, counterType),
    },
  };

  clearPendingCounterSelection();
  persistState();
  render();
  counterTypeDialog?.close();
  showQuickToast(formatCounterPlacementMessage(outcome, counterType, getCounterTargetLabel(pendingSelection.targetMode)));
}

function handleCounterTypeCancel() {
  const pendingSelection = boardUi.pendingCounterSelection;
  if (!pendingSelection || pendingSelection.targetMode !== "selected-permanents") {
    clearPendingCounterSelection();
    render();
  }
  counterTypeDialog?.close();
}

function handleCounterTypeDialogClose() {
  const pendingSelection = boardUi.pendingCounterSelection;
  if (!pendingSelection) {
    return;
  }

  if (pendingSelection.targetMode !== "selected-permanents") {
    clearPendingCounterSelection();
    render();
  }
}

function resolveCounterTargetIdsForPendingSelection(permanents, pendingSelection) {
  if (!pendingSelection) {
    return [];
  }

  switch (pendingSelection.targetMode) {
    case "all-creatures":
      return permanents.filter((permanent) => permanent.isCreature).map((permanent) => permanent.id);
    case "all-permanents":
      return permanents.map((permanent) => permanent.id);
    case "all-tokens":
      return permanents.filter((permanent) => permanent.isToken).map((permanent) => permanent.id);
    case "selected-permanents": {
      const storedTargetIds = Array.isArray(pendingSelection.targetIds) ? pendingSelection.targetIds : [];
      if (storedTargetIds.length > 0) {
        return storedTargetIds;
      }
      return getSelectedPermanentIds(permanents);
    }
    default:
      return [];
  }
}

function getCounterTargetLabel(targetMode) {
  switch (targetMode) {
    case "all-creatures":
      return "all creatures";
    case "all-permanents":
      return "all permanents";
    case "all-tokens":
      return "all tokens";
    case "selected-permanents":
      return "selected permanent(s)";
    default:
      return "selected targets";
  }
}

function getNextRecentCounterTypes(existingTypes, newType) {
  const normalizedNewType = normalizeCounterType(newType);
  if (!normalizedNewType) {
    return normalizeRecentCounterTypes(existingTypes);
  }

  const existingNormalized = normalizeRecentCounterTypes(existingTypes).filter(
    (counterType) => counterType !== normalizedNewType
  );
  return [normalizedNewType, ...existingNormalized].slice(0, MAX_RECENT_COUNTER_TYPES);
}

function updateRecentTokenSearches(existingSearches, tokenName) {
  const normalizedToken = normalizeLabel(tokenName, "");
  if (!normalizedToken) {
    return Array.isArray(existingSearches) ? existingSearches.slice(0, MAX_RECENT_TOKEN_SEARCHES) : [];
  }

  const nextSearches = [normalizedToken, ...(Array.isArray(existingSearches) ? existingSearches : [])]
    .map((entry) => normalizeLabel(entry, ""))
    .filter(Boolean);
  return Array.from(new Set(nextSearches)).slice(0, MAX_RECENT_TOKEN_SEARCHES);
}

function applyCounterToPermanentTargets(boardState, targetIds, counterType, value) {
  const uniqueTargetIds = Array.from(new Set(targetIds));
  if (uniqueTargetIds.length === 0) {
    return {
      boardState,
      appliedCount: 0,
      appliedAmount: 0,
      modifierSummary: "",
    };
  }

  const targetIdSet = new Set(uniqueTargetIds);
  const counterResult = applyCounterModifiersDetailed(value, boardState.permanents);
  let appliedCount = 0;
  const nextPermanents = boardState.permanents.map((permanent) => {
    if (!targetIdSet.has(permanent.id)) {
      return permanent;
    }

    appliedCount += 1;
    return applyCounterToPermanent(permanent, counterType, counterResult.value);
  });

  return {
    boardState: {
      ...boardState,
      permanents: nextPermanents,
    },
    appliedCount,
    appliedAmount: counterResult.value,
    modifierSummary: summarizeModifierList(counterResult.modifiers),
  };
}

function formatCounterPlacementMessage(outcome, counterType, scopeLabel) {
  const normalizedCounterType = normalizeCounterType(counterType) || "Generic";
  const baseMessage = `Added ${outcome.appliedAmount} ${normalizedCounterType} counter${outcome.appliedAmount === 1 ? "" : "s"} to ${outcome.appliedCount} ${scopeLabel}.`;
  const modifierSummary = outcome.modifierSummary || "";
  if (!modifierSummary || modifierSummary === "No active modifiers.") {
    return baseMessage;
  }

  return `${baseMessage} ${modifierSummary}`;
}

function updatePlayerCounter(counterId, delta) {
  const counterState = state.playerCounters[counterId];
  if (!counterState) {
    return;
  }
  const previousValue = counterState.value;
  const nextValue = normalizeCount(counterState.value + delta);

  registerCompanionAction({
    type: "counter",
    summary: `${counterId} ${delta > 0 ? "+" : ""}${delta}`,
    payload: { counterId, from: previousValue, to: nextValue },
  });
  state = {
    ...state,
    playerCounters: {
      ...state.playerCounters,
      [counterId]: {
        ...counterState,
        value: nextValue,
      },
    },
    companion: {
      ...state.companion,
      recentCounterSearches: updateRecentCounterSearches(state.companion?.recentCounterSearches, counterId),
    },
  };

  persistState();
  render();
}

function setPlayerCounterEnabled(counterId, enabled) {
  const counterState = state.playerCounters[counterId];
  if (!counterState) {
    return;
  }

  state = {
    ...state,
    playerCounters: {
      ...state.playerCounters,
      [counterId]: {
        ...counterState,
        enabled,
      },
    },
  };

  persistState();
  render();
}

function adjustDamageTrackerCount(delta) {
  const nextCount = Math.min(
    MAX_COMMANDER_DAMAGE_TRACKERS,
    Math.max(MIN_COMMANDER_DAMAGE_TRACKERS, state.commanderDamageTrackers.length + delta)
  );

  if (nextCount === state.commanderDamageTrackers.length) {
    return;
  }

  const nextTrackers = state.commanderDamageTrackers.slice(0, nextCount);
  while (nextTrackers.length < nextCount) {
    nextTrackers.push(createCommanderDamageTracker());
  }

  state = {
    ...state,
    commanderDamageTrackers: nextTrackers,
  };

  persistState();
  render();
}

function updateCommanderDamageValue(index, delta) {
  const tracker = state.commanderDamageTrackers[index];
  if (!tracker) {
    return;
  }
  const previousValue = tracker.value;
  const nextValue = normalizeCount(tracker.value + delta);
  registerCompanionAction({
    type: "damage",
    summary: `${tracker.label} damage ${delta > 0 ? "+" : ""}${delta}`,
    payload: { label: tracker.label, from: previousValue, to: nextValue },
  });

  state = {
    ...state,
    commanderDamageTrackers: state.commanderDamageTrackers.map((entry, entryIndex) => {
      if (entryIndex !== index) {
        return entry;
      }

      return {
        ...entry,
        value: nextValue,
      };
    }),
  };

  persistState();
  render();
}

function renameCommanderDamageLabel(index) {
  const tracker = state.commanderDamageTrackers[index];
  if (!tracker) {
    return;
  }

  openNameSettingsDialog(index);
}

function renamePlayer() {
  openNameSettingsDialog();
}

function openNameSettingsDialog(focusIndex = -1) {
  nameSettingsFocusIndex = Number.isInteger(focusIndex) ? focusIndex : -1;
  renderNameSettingsDialog();
  closeAllDialogs();
  showDialog(nameSettingsDialog);

  window.requestAnimationFrame(() => {
    const focusTarget =
      nameSettingsFocusIndex >= 0
        ? playerNameList.querySelector(`[data-player-name-index="${nameSettingsFocusIndex}"]`)
        : playerNameInput;
    focusTarget?.focus();
    focusTarget?.select?.();
  });
}

function renderNameSettingsDialog() {
  if (!nameSettingsForm || !playerNameInput || !playerNameList) {
    return;
  }

  playerNameInput.value = state.playerName;
  playerNameList.innerHTML = state.commanderDamageTrackers
    .map(
      (tracker, index) => `
        <label class="sheet-field name-settings-card" for="damageTrackerNameInput${index}">
          <span class="sheet-field-label">Opponent ${index + 1}</span>
          <input
            class="sheet-text-input"
            id="damageTrackerNameInput${index}"
            name="damageLabel-${index}"
            type="text"
            maxlength="32"
            value="${escapeHtml(tracker.label)}"
            data-player-name-index="${index}"
          />
        </label>
      `
    )
    .join("");
}

function handleNameSettingsSubmit(event) {
  event.preventDefault();
  if (!nameSettingsForm) {
    return;
  }

  const formData = new FormData(nameSettingsForm);
  state = {
    ...state,
    playerName: normalizeLabel(formData.get("playerName"), defaultState.playerName),
    commanderDamageTrackers: state.commanderDamageTrackers.map((tracker, index) => ({
      ...tracker,
      label: normalizeLabel(formData.get(`damageLabel-${index}`), "Opponent"),
    })),
  };

  persistState();
  render();
  nameSettingsDialog.close();
}

function resetLife() {
  registerCompanionAction({
    type: "life",
    summary: "Life reset to 40",
    payload: { from: state.life, to: defaultState.life },
  });
  state = {
    ...state,
    life: defaultState.life,
    companion: {
      ...state.companion,
      lifeRollback: null,
    },
  };

  persistState();
  render();
  closeAllDialogs();
}

function resetAll() {
  state = archiveCurrentGameIfNeeded("Reset tracker values");
  registerCompanionAction({
    type: "reset",
    summary: "Tracker values reset",
    payload: {},
  });
  state = {
    ...state,
    life: defaultState.life,
    tax: defaultState.tax,
    mana: defaultState.mana,
    playerCounters: PLAYER_COUNTER_DEFS.reduce((accumulator, counter) => {
      accumulator[counter.id] = {
        ...state.playerCounters[counter.id],
        value: 0,
      };
      return accumulator;
    }, {}),
    commanderDamageTrackers: state.commanderDamageTrackers.map((tracker) => ({
      ...tracker,
      value: 0,
    })),
    companion: {
      ...state.companion,
      floatingMana: {
        W: 0,
        U: 0,
        B: 0,
        R: 0,
        G: 0,
        C: 0,
      },
      lifeRollback: null,
    },
  };

  persistState();
  render();
  closeAllDialogs();
}

function resetBoardState() {
  state = archiveCurrentGameIfNeeded("Reset board state");
  registerCompanionAction({
    type: "reset",
    summary: "Board state reset",
    payload: {},
  });
  state = {
    ...state,
    boardState: createDefaultBoardState(),
  };
  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
    pendingCounterSelection: null,
    detailPermanentId: "",
    detailDialogPermanentId: "",
    searchResults: [],
    selectedSearchResultIndex: -1,
    searchMessage: "Board State reset.",
    searchMessageTone: "success",
  };

  persistState();
  render();
  closeAllDialogs();
}

function archiveCurrentGameIfNeeded(reason = "") {
  if (!hasMeaningfulGameState()) {
    return state;
  }

  const nextGame = createArchiveGameEntry(reason);
  const nextArchive = recordCommanderGameInArchive(
    {
      ...state.archive,
      games: [nextGame, ...(state.archive?.games || [])].slice(0, 200),
    },
    nextGame
  );
  return {
    ...state,
    archive: nextArchive,
    runtime: {
      gameStartedAt: Date.now(),
    },
  };
}

function hasMeaningfulGameState() {
  const hasBoard = Array.isArray(state.boardState?.permanents) && state.boardState.permanents.length > 0;
  const hasHistory = Array.isArray(state.companion?.history) && state.companion.history.length > 2;
  const hasLifeChanges = normalizeCount(state.life, defaultState.life) !== normalizeCount(defaultState.life);
  const hasCounters = Object.values(state.playerCounters || {}).some((entry) => normalizeCount(entry?.value, 0) > 0);
  const hasCommanderDamage = (state.commanderDamageTrackers || []).some((entry) => normalizeCount(entry?.value, 0) > 0);
  const hasFloatingMana = getFloatingManaTotal(state.companion?.floatingMana || {}) > 0;
  return hasBoard || hasHistory || hasLifeChanges || hasCounters || hasCommanderDamage || hasFloatingMana;
}

function createArchiveGameEntry(reason = "") {
  const now = Date.now();
  const permanents = Array.isArray(state.boardState?.permanents) ? state.boardState.permanents : [];
  const boardTotals = calculateAbsoluteBoardTotals(permanents, permanents);
  const history = Array.isArray(state.companion?.history) ? state.companion.history : [];
  const runtime = normalizeRuntimeState(state.runtime);
  const currentPhase = PHASES[normalizePhaseIndex(state.boardState?.currentPhaseIndex)];
  const currentPhaseElapsed = Math.max(0, now - normalizeTimestamp(runtime.phaseStartedAt));
  const phaseDurations = {
    ...(runtime.phaseDurations || {}),
    [currentPhase]: Math.max(0, Number(runtime.phaseDurations?.[currentPhase]) || 0) + currentPhaseElapsed,
  };
  const currentTurnElapsed = Math.max(0, now - normalizeTimestamp(runtime.turnStartedAt));
  const combatDamage = history
    .filter((entry) => normalizeLabel(entry?.type, "").toLowerCase() === "combat")
    .reduce((total, entry) => total + normalizeCount(entry?.payload?.preview?.attackerTotal?.power, 0), 0);
  const tokenTotal = history
    .filter((entry) => normalizeLabel(entry?.type, "").toLowerCase() === "token")
    .reduce((total, entry) => total + Math.max(1, normalizeCount(entry?.payload?.quantity, 1)), 0);
  const counterTotal = history
    .filter((entry) => normalizeLabel(entry?.type, "").toLowerCase() === "counter")
    .reduce((total, entry) => total + Math.max(1, normalizeCount(entry?.payload?.appliedAmount, 1)), 0);
  const triggerTotal = normalizeCount(state.boardState?.automationLog?.length, 0);
  const manaPeak = Math.max(
    getFloatingManaTotal(state.companion?.floatingMana || {}),
    history
      .filter((entry) => normalizeLabel(entry?.type, "").toLowerCase() === "mana")
      .reduce(
        (peak, entry) =>
          Math.max(peak, normalizeCount(entry?.payload?.from, 0), normalizeCount(entry?.payload?.to, 0)),
        0
      )
  );

  return {
    id: createId(),
    endedAt: now,
    durationMs: Math.max(0, now - normalizeTimestamp(state.runtime?.gameStartedAt)),
    commanderName: state.playerName,
    lifeEnd: normalizeCount(state.life, 0),
    winner: normalizeCount(state.life, 0) > 0 ? state.playerName : "Unknown",
    totals: {
      power: normalizeCount(boardTotals.power, 0),
      toughness: normalizeCount(boardTotals.toughness, 0),
      damage: normalizeCount(combatDamage, 0),
      prevented: 0,
      triggers: normalizeCount(triggerTotal, 0),
      tokens: normalizeCount(tokenTotal, 0),
      counters: normalizeCount(counterTotal, 0),
      manaPeak: normalizeCount(manaPeak, 0),
      boardPeak: normalizeCount(permanents.length, 0),
    },
    notes: normalizeLabel(reason, ""),
    recentActions: history
      .slice(-8)
      .reverse()
      .map((entry) => normalizeLabel(entry?.summary, ""))
      .filter(Boolean),
    eventLog: history.slice(-300).map((entry) => ({
      type: normalizeLabel(entry?.type, "event"),
      summary: normalizeLabel(entry?.summary, "Action"),
      timestamp: normalizeTimestamp(entry?.timestamp),
      payload: entry?.payload && typeof entry.payload === "object" ? entry.payload : {},
    })),
    turnDurations: [...(runtime.turnDurations || []), currentTurnElapsed].slice(-100),
    phaseDurations,
  };
}

function clearPermanentSelection() {
  const hasSelection = state.boardState.permanents.some((permanent) => permanent.isSelected);
  if (!hasSelection) {
    return;
  }

  state = {
    ...state,
    boardState: {
      ...state.boardState,
      permanents: state.boardState.permanents.map((permanent) =>
        createPermanent({
          ...permanent,
          isSelected: false,
        })
      ),
    },
  };

  persistState();
  render();
}

function handleWifiConnectionPreview() {
  const response = multiplayerService.connectSameWifi();
  setMultiplayerFeedback(response.message, response.ok ? "success" : "neutral");
}

function handleBluetoothConnectionPreview() {
  const response = multiplayerService.connectBluetooth();
  setMultiplayerFeedback(response.message, response.ok ? "success" : "neutral");
}

function handleBoardWifiConnectionPreview() {
  const response = multiplayerService.connectSameWifi();
  setBoardMultiplayerFeedback(response.message, response.ok ? "success" : "neutral");
}

function handleBoardBluetoothConnectionPreview() {
  const response = multiplayerService.connectBluetooth();
  setBoardMultiplayerFeedback(response.message, response.ok ? "success" : "neutral");
}

function startSimulatedLocalConnection() {
  const connectedPlayers = multiplayerService.startSimulatedLocalConnection().map((player) => createConnectedPlayer(player));

  state = {
    ...state,
    multiplayer: {
      ...state.multiplayer,
      sessionCode: state.multiplayer.sessionCode || createSessionCode(),
      isSessionActive: true,
      connectionMode: "simulated",
      connectedPlayers,
    },
  };
  multiplayerUi = {
    ...multiplayerUi,
    feedbackMessage: `Simulated local table ${state.multiplayer.sessionCode} ready with ${connectedPlayers.length} connected player${connectedPlayers.length === 1 ? "" : "s"}.`,
    feedbackTone: "success",
    activePlayerId: connectedPlayers[0]?.id || "",
    activeViewMode: "tracker",
  };

  persistState();
  render();
}

function startBoardSimulatedLocalConnection() {
  startSimulatedLocalConnection();
  setBoardMultiplayerFeedback(
    `Simulated local table ${state.multiplayer.sessionCode || "0000"} ready with ${state.multiplayer.connectedPlayers.length} connected player${state.multiplayer.connectedPlayers.length === 1 ? "" : "s"}.`,
    "success"
  );
}

function setMultiplayerFeedback(message, tone = "neutral") {
  multiplayerUi = {
    ...multiplayerUi,
    feedbackMessage: message,
    feedbackTone: tone,
  };
  renderMultiplayerUi();
}

function setBoardMultiplayerFeedback(message, tone = "neutral") {
  boardUi = {
    ...boardUi,
    boardMultiplayerMessage: message,
    boardMultiplayerTone: tone,
  };
  renderBoardOptionsMenu();
}

function openConnectedPlayerView(playerId, viewMode) {
  multiplayerUi = {
    ...multiplayerUi,
    activePlayerId: playerId,
    activeViewMode: normalizeMultiplayerViewMode(viewMode),
  };
  renderMultiplayerUi();
  swapDialog(connectedPlayersDialog, connectedPlayerViewDialog);
}

function showDialog(dialog) {
  if (dialog.open) {
    return;
  }

  dialog.showModal();
}

function clearExpandedCardState() {
  boardUi = {
    ...boardUi,
    detailPermanentId: "",
    detailDialogPermanentId: "",
  };
  cardDetailTitle.textContent = "Card Detail";
  cardDetailContent.innerHTML = "";
}

function closeCardOverlay() {
  const wasOpen = cardDetailDialog.open;
  clearExpandedCardState();
  if (wasOpen) {
    cardDetailDialog.close();
  }
}

function resetTransientUiState() {
  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };
}

function swapDialog(fromDialog, toDialog) {
  if (fromDialog.open) {
    fromDialog.close();
  }

  showDialog(toDialog);
}

function closeAllDialogs() {
  [
    optionsDialog,
    nameSettingsDialog,
    counterSheetDialog,
    damageSheetDialog,
    connectedPlayersDialog,
    connectedPlayerViewDialog,
    boardOptionsDialog,
    bulkRemoveDialog,
    multiplayerHubDialog,
    automationRulesDialog,
    cardDetailDialog,
    genericTokenDialog,
    battlefieldCounterDialog,
    counterTypeDialog,
    settingsManualDialog,
  ].forEach((dialog) => {
    if (dialog.open) {
      dialog.close();
    }
  });
}

function showTrackerPage(options = {}) {
  showPage("tracker", options);
}

function showBoardStatePage(options = {}) {
  showPage("board-state", options);
}

function showStatsPage(options = {}) {
  showPage("stats", options);
}

function showArchivePage(options = {}) {
  showPage("archive", options);
}

function showLeaderboardsPage(options = {}) {
  showPage("leaderboards", options);
}

function showPreviousPage() {
  const nextIndex = Math.max(0, getPageIndex(currentPage) - 1);
  showPage(PAGE_ORDER[nextIndex]);
}

function showNextPage() {
  const nextIndex = Math.min(PAGE_ORDER.length - 1, getPageIndex(currentPage) + 1);
  showPage(PAGE_ORDER[nextIndex]);
}

function showPage(pageName, options = {}) {
  const { syncHash = true, behavior = "smooth" } = options;
  const normalizedPage = PAGE_ORDER.includes(pageName) ? pageName : "tracker";

  currentPage = normalizedPage;
  updatePagePresentation();
  syncPageViewport({ behavior });

  if (syncHash) {
    syncHashToPage(normalizedPage);
  }
}

function updatePagePresentation() {
  pageFrame.dataset.page = currentPage;
  const pageElements = [
    ["tracker", trackerBoard],
    ["board-state", boardStateBoard],
    ["stats", statsBoard],
    ["archive", archiveBoard],
    ["leaderboards", leaderboardBoard],
  ];
  pageElements.forEach(([pageKey, element]) => {
    if (!element) {
      return;
    }

    const isActive = currentPage === pageKey;
    element.toggleAttribute("inert", !isActive);
    element.setAttribute("aria-hidden", String(!isActive));
  });

  const currentIndex = getPageIndex(currentPage);
  trackerPageButton.disabled = currentIndex === 0;
  boardStatePageButton.disabled = currentIndex === PAGE_ORDER.length - 1;
}

function syncPageViewport(options = {}) {
  const { behavior = "smooth" } = options;
  const pageIndex = getPageIndex(currentPage);
  const targetLeft = pageViewport.clientWidth * pageIndex;

  if (behavior === "auto") {
    pageViewport.scrollLeft = targetLeft;
    return;
  }

  pageViewport.scrollTo({
    left: targetLeft,
    behavior,
  });
}

function handlePageViewportScroll() {
  if (pageScrollFrame) {
    return;
  }

  pageScrollFrame = window.requestAnimationFrame(() => {
    pageScrollFrame = 0;
    syncCurrentPageFromViewport();
  });
}

function syncCurrentPageFromViewport() {
  if (!pageViewport.clientWidth) {
    return;
  }

  const nextIndex = Math.max(
    0,
    Math.min(PAGE_ORDER.length - 1, Math.round(pageViewport.scrollLeft / pageViewport.clientWidth))
  );
  const nextPage = PAGE_ORDER[nextIndex];

  if (nextPage === currentPage) {
    return;
  }

  currentPage = nextPage;
  updatePagePresentation();
  syncHashToPage(nextPage);
}

function handleViewportResize() {
  syncPageViewport({ behavior: "auto" });
}

function getPageIndex(pageName) {
  const pageIndex = PAGE_ORDER.indexOf(pageName);
  return pageIndex >= 0 ? pageIndex : 0;
}

function syncHashToPage(pageName) {
  const nextHash = PAGE_HASH_MAP[pageName] || PAGE_HASH_MAP.tracker;

  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function toggleBoardControlsExpanded() {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      controlsExpanded: !state.boardState.controlsExpanded,
    },
  };

  persistState();
  render();
}

function togglePermanentMenu(permanentId) {
  boardUi = {
    ...boardUi,
    activeMenuPermanentId: boardUi.activeMenuPermanentId === permanentId ? "" : permanentId,
  };

  render();
}

function advanceBoardPhase() {
  const currentPhase = PHASES[state.boardState.currentPhaseIndex];
  const nextPhaseIndex = (state.boardState.currentPhaseIndex + 1) % PHASES.length;
  const nextPhase = PHASES[nextPhaseIndex];
  const now = Date.now();
  const phaseElapsed = Math.max(0, now - normalizeTimestamp(state.runtime?.phaseStartedAt));
  const turnElapsed = Math.max(0, now - normalizeTimestamp(state.runtime?.turnStartedAt));
  const nextRuntime = buildNextRuntimeForPhaseChange(currentPhase, nextPhase, phaseElapsed, turnElapsed, now);
  const selectedIds = getSelectedPermanentIds(state.boardState.permanents);
  let phaseBaseBoardState =
    nextPhase === "Upkeep" ? untapAllPermanents(state.boardState) : normalizeBoardStateSnapshot(state.boardState);

  if (currentPhase === "Combat" && nextPhase !== "Combat") {
    phaseBaseBoardState = clearTemporaryBuffsByDuration(phaseBaseBoardState, "until-end-of-combat");
    phaseBaseBoardState = clearCombatEngagementFlags(phaseBaseBoardState);
  }
  if (nextPhase === "Upkeep") {
    phaseBaseBoardState = clearTemporaryBuffsByDuration(phaseBaseBoardState, "until-end-of-turn");
  }

  resetTransientUiState();

  let nextBoardState = {
    ...phaseBaseBoardState,
    currentPhaseIndex: nextPhaseIndex,
    combatState: createDefaultCombatState(),
  };
  nextBoardState = executeEventTriggers("Phase", nextBoardState, {
    phase: nextPhase,
    selectedIds,
  });
  nextBoardState = runEnchantmentEngine(nextBoardState, {
    phase: nextPhase,
    advanceSagas: nextPhase === "Main",
  }).boardState;

  const nextFloatingMana = clearFloatingManaForPhase(state.companion?.floatingMana, nextPhase, {
    manaAutoClearEnabled: state.companion?.settings?.manaAutoClearEnabled !== false,
    previousPhaseLabel: currentPhase,
    persistThroughPhaseChange: hasPersistentFloatingManaEffects(nextBoardState.permanents),
  });
  const triggerQueue = queueTriggerReminders({
    phase: nextPhase,
    permanents: nextBoardState.permanents,
    automationRules: nextBoardState.automationRules,
  }).slice(0, 20);

  registerCompanionAction({
    type: "phase",
    summary: `Advanced phase to ${nextPhase}`,
    payload: { from: currentPhase, to: nextPhase },
  });

  state = {
    ...state,
    runtime: nextRuntime,
    boardState: nextBoardState,
    multiplayer: advanceSimulatedMultiplayerPhase(state.multiplayer, nextPhase),
    companion: {
      ...state.companion,
      floatingMana: nextFloatingMana,
      triggerQueue,
    },
  };

  persistState();
  render();
}

function advanceSimulatedMultiplayerPhase(multiplayerState, nextPhase) {
  const connectedPlayers = Array.isArray(multiplayerState?.connectedPlayers) ? multiplayerState.connectedPlayers : [];
  if (connectedPlayers.length === 0) {
    return multiplayerState;
  }

  return {
    ...multiplayerState,
    connectedPlayers: connectedPlayers.map((player) =>
      createConnectedPlayer({
        ...player,
        lastUpdated: Date.now(),
        publicBoardState: {
          ...player.publicBoardState,
          currentPhase: nextPhase,
        },
      })
    ),
  };
}

function buildNextRuntimeForPhaseChange(currentPhase, nextPhase, phaseElapsed, turnElapsed, timestamp) {
  const previousRuntime = normalizeRuntimeState(state.runtime);
  const currentPhaseLabel = normalizePhase(currentPhase);
  const previousDurations = previousRuntime.phaseDurations || {};
  const phaseDurations = {
    ...previousDurations,
    [currentPhaseLabel]: Math.max(0, Number(previousDurations[currentPhaseLabel]) || 0) + phaseElapsed,
  };
  const completedTurn = nextPhase === PHASES[0] && currentPhase !== nextPhase;

  return {
    ...previousRuntime,
    phaseDurations,
    combatDurationMs:
      currentPhase === "Combat"
        ? Math.max(0, Number(previousRuntime.combatDurationMs) || 0) + phaseElapsed
        : previousRuntime.combatDurationMs,
    phaseStartedAt: timestamp,
    turnStartedAt: completedTurn ? timestamp : previousRuntime.turnStartedAt,
    turnNumber: completedTurn ? previousRuntime.turnNumber + 1 : previousRuntime.turnNumber,
    turnDurations: completedTurn
      ? [...(previousRuntime.turnDurations || []), turnElapsed].slice(-100)
      : previousRuntime.turnDurations || [],
  };
}

function promptAndAddPermanent({ isToken, isNonCreature }) {
  const name = window.prompt(isToken ? "Token name" : "Creature name", "");
  if (name === null) {
    return;
  }

  const normalizedName = normalizeLabel(name, "");
  if (!normalizedName) {
    return;
  }

  const manaCost = window.prompt("Mana cost", "");
  if (manaCost === null) {
    return;
  }

  const power = window.prompt("Power", "0");
  if (power === null) {
    return;
  }

  const toughness = window.prompt("Toughness", "0");
  if (toughness === null) {
    return;
  }

  const permanentFlags = promptPermanentFlags({
    isCreature: !isNonCreature,
  });

  const permanent = createPermanent({
    name: normalizedName,
    manaCost,
    typeLine: buildManualTypeLine({
      isLegendary: permanentFlags.isLegendary,
      isArtifact: permanentFlags.isArtifact,
      isCreature: !isNonCreature,
      isNonCreature,
      isToken,
    }),
    oracleText: "",
    imageUrl: "",
    power,
    toughness,
    quantity: 1,
    isToken,
    isNonCreature,
    isLegendary: permanentFlags.isLegendary,
    isArtifact: permanentFlags.isArtifact,
    isCreature: !isNonCreature,
    plusOneCounters: 0,
    doublesTokens: false,
    createsTokens: false,
    addsCounters: false,
    isExpanded: false,
    isSelected: false,
    summoningSickness: !isNonCreature,
  });

  state = {
    ...state,
    boardState: addOrStackPermanent(state.boardState, permanent),
  };
  registerCompanionAction({
    type: isToken ? "token" : "permanent",
    summary: `Added ${permanent.name} to battlefield`,
    payload: {
      name: permanent.name,
      isToken: Boolean(isToken),
      isNonCreature: Boolean(isNonCreature),
    },
  });

  persistState();
  render();
}

function promptAndAddEffect() {
  const name = window.prompt("Effect name", "");
  if (name === null) {
    return;
  }

  const normalizedName = normalizeLabel(name, "");
  if (!normalizedName) {
    return;
  }

  const effectMetadata = getEffectMetadataFromText(normalizedName);
  const permanentFlags = promptPermanentFlags({
    isCreature: false,
  });

  const effect = createPermanent({
    name: normalizedName,
    manaCost: "",
    typeLine: buildManualTypeLine({
      isLegendary: permanentFlags.isLegendary,
      isArtifact: permanentFlags.isArtifact,
      isCreature: false,
      isNonCreature: true,
      isToken: false,
    }),
    oracleText: "",
    imageUrl: "",
    power: 0,
    toughness: 0,
    quantity: 1,
    isToken: false,
    isNonCreature: true,
    isLegendary: permanentFlags.isLegendary,
    isArtifact: permanentFlags.isArtifact,
    isCreature: false,
    plusOneCounters: 0,
    doublesTokens: effectMetadata.doublesTokens,
    doublesCounters: effectMetadata.doublesCounters,
    counterModifierBonus: effectMetadata.counterModifierBonus,
    createsTokens: effectMetadata.createsTokens,
    addsCounters: effectMetadata.addsCounters,
    staticBuffRules: effectMetadata.staticBuffRules,
    staticBuffPower: effectMetadata.staticBuffPower,
    staticBuffToughness: effectMetadata.staticBuffToughness,
    staticBuffAppliesTo: effectMetadata.staticBuffAppliesTo,
    staticBuffExcludesSelf: effectMetadata.staticBuffExcludesSelf,
    isExpanded: false,
    isSelected: false,
  });

  state = {
    ...state,
    boardState: addOrStackPermanent(state.boardState, effect),
  };
  registerCompanionAction({
    type: "permanent",
    summary: `Added non-creature permanent ${effect.name}`,
    payload: {
      name: effect.name,
      typeLine: effect.typeLine,
    },
  });

  persistState();
  render();
}

function promptAndAddTrigger() {
  const triggerEvent = normalizeTriggerEvent(window.prompt(`Trigger event (${TRIGGER_EVENTS.join(", ")})`, "Phase"));
  if (!triggerEvent) {
    return;
  }

  const phasePrompt =
    triggerEvent === "Phase"
      ? window.prompt(`Phase (${PHASES.join(", ")})`, PHASES[state.boardState.currentPhaseIndex])
      : "";
  if (phasePrompt === null) {
    return;
  }
  const phase = triggerEvent === "Phase" ? normalizePhase(phasePrompt) : "";

  const actionTypePrompt = window.prompt(`Action (${TRIGGER_ACTIONS.join(", ")})`, TRIGGER_ACTIONS[0]);
  if (actionTypePrompt === null) {
    return;
  }
  const actionType = normalizeTriggerAction(actionTypePrompt);
  if (!actionType) {
    window.alert("Choose a valid trigger action.");
    return;
  }

  const targetPrompt = window.prompt(`Target (${TRIGGER_TARGETS.join(", ")})`, "All");
  if (targetPrompt === null) {
    return;
  }
  const target = normalizeTriggerTarget(targetPrompt);

  const valuePrompt = window.prompt("Value", "0");
  if (valuePrompt === null) {
    return;
  }
  const value = normalizeCount(valuePrompt);

  let tokenNamePrompt = "";
  let tokenManaCostPrompt = "";
  let tokenPowerPrompt = "0";
  let tokenToughnessPrompt = "0";
  let counterTypePrompt = actionType === "Add +1/+1 Counters" ? "+1/+1" : "";
  let counterTargetEntityPrompt = "";
  if (actionType === "Create Tokens") {
    tokenNamePrompt = window.prompt("Token name", "");
    if (tokenNamePrompt === null) {
      return;
    }
    if (!normalizeLabel(tokenNamePrompt, "")) {
      window.alert("Token name is required for Create Tokens.");
      return;
    }

    tokenManaCostPrompt = window.prompt("Token mana cost (optional)", "") ?? "";

    tokenPowerPrompt = window.prompt("Token power", "0");
    if (tokenPowerPrompt === null) {
      return;
    }

    tokenToughnessPrompt = window.prompt("Token toughness", "0");
    if (tokenToughnessPrompt === null) {
      return;
    }
  }

  if (actionType === "Add Counters") {
    const counterTypeInput = window.prompt("Counter type (example: Charge, Loyalty, Oil, Shield)", "Charge");
    if (counterTypeInput === null) {
      return;
    }
    counterTypePrompt = normalizeCounterType(counterTypeInput);
    counterTargetEntityPrompt = counterTypePrompt === "+1/+1" || counterTypePrompt === "-1/-1" ? "creature" : "permanent";
  }

  const trigger = createTrigger({
    triggerEvent,
    phase,
    actionType,
    target,
    value,
    tokenName: tokenNamePrompt,
    tokenManaCost: tokenManaCostPrompt,
    tokenPower: tokenPowerPrompt,
    tokenToughness: tokenToughnessPrompt,
    counterType: counterTypePrompt,
    counterTargetEntity: counterTargetEntityPrompt,
  });

  state = {
    ...state,
    boardState: {
      ...state.boardState,
      triggers: [...state.boardState.triggers, trigger],
    },
  };

  persistState();
  render();
}

function normalizeTriggerEvent(value) {
  if (value === null) {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  const match = TRIGGER_EVENTS.find((event) => event.toLowerCase() === normalized);
  return match || "";
}

function promptPermanentFlags({ isCreature }) {
  return {
    isLegendary: window.confirm("Legendary permanent?\nPress OK for Yes or Cancel for No."),
    isArtifact: window.confirm(
      `${isCreature ? "Artifact creature?" : "Artifact permanent?"}\nPress OK for Yes or Cancel for No.`
    ),
  };
}

async function searchCards(query) {
  const normalizedQuery = query.trim();
  const commanderDeckMatches = getCommanderDeckSearchCards(normalizedQuery);
  const [cards, tokenCards, basicLandCards] = await Promise.all([
    searchCardsByQuery(buildScryfallSearchQuery(normalizedQuery), {
      unique: "cards",
      order: "name",
      includeExtras: true,
      includeVariations: true,
      includeMultilingual: true,
    }),
    searchCardsByQuery(buildScryfallTokenQuery(normalizedQuery), {
      unique: "cards",
      order: "name",
      includeExtras: true,
      includeVariations: true,
      includeMultilingual: true,
    }),
    searchCardsByQuery(buildScryfallBasicLandQuery(normalizedQuery), {
      unique: "prints",
      order: "released",
      includeExtras: true,
      includeVariations: true,
      includeMultilingual: true,
      direction: "desc",
    }),
  ]);

  const mergedResults = mergeScryfallResults(commanderDeckMatches, cards, tokenCards, basicLandCards);
  return prioritizeSearchMatches(mergedResults, normalizedQuery).slice(0, SEARCH_RESULT_LIMIT);
}

function buildScryfallSearchQuery(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return "";
  }

  const looksLikeSearchSyntax = /[:!"()]/.test(trimmedQuery);
  return looksLikeSearchSyntax ? trimmedQuery : `"${trimmedQuery}"`;
}

function buildScryfallTokenQuery(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return "";
  }

  const looksLikeSearchSyntax = /[:!"()]/.test(trimmedQuery);
  return looksLikeSearchSyntax ? `t:token (${trimmedQuery})` : `t:token "${trimmedQuery}"`;
}

function buildScryfallBasicLandQuery(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return "";
  }

  const looksLikeSearchSyntax = /[:!"()]/.test(trimmedQuery);
  return looksLikeSearchSyntax ? `t:basic (${trimmedQuery})` : `t:basic "${trimmedQuery}"`;
}

async function searchCardsByQuery(searchQuery, options = {}) {
  if (!searchQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: searchQuery,
    unique: options.unique || "cards",
    order: options.order || "name",
    include_extras: options.includeExtras === false ? "false" : "true",
    include_multilingual: options.includeMultilingual ? "true" : "false",
    include_variations: options.includeVariations ? "true" : "false",
  });
  if (options.direction) {
    params.set("dir", options.direction);
  }
  const response = await fetch(`${SCRYFALL_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json;q=0.9,*/*;q=0.8",
    },
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    if (response.status === 404 && payload?.code === "not_found") {
      return [];
    }

    throw new Error(
      typeof payload?.details === "string" && payload.details
        ? payload.details
        : "Unable to reach Scryfall right now."
    );
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

function mergeScryfallResults(...resultSets) {
  const seenIds = new Set();
  return resultSets.flat().filter((card) => {
    const cardId = getCommanderCardKey(card);
    if (!cardId || seenIds.has(cardId)) {
      return false;
    }

    seenIds.add(cardId);
    return true;
  });
}

function getCardPreview(card) {
  return extractScryfallCardData(card);
}

function extractScryfallCardData(card) {
  const cardFace = getPrimaryCardFace(card);
  const typeLine = normalizeLabel(
    cardFace?.type_line || card.type_line || card.typeLine,
    typeof card.type_line === "string" ? card.type_line : typeof card.typeLine === "string" ? card.typeLine : ""
  );
  const oracleText = normalizeLabel(
    cardFace?.oracle_text || card.oracle_text || card.oracleText,
    typeof card.oracle_text === "string" ? card.oracle_text : typeof card.oracleText === "string" ? card.oracleText : ""
  );
  const manaCost = typeof cardFace?.mana_cost === "string" && cardFace.mana_cost.trim()
    ? cardFace.mana_cost.trim()
    : typeof card.mana_cost === "string"
      ? card.mana_cost.trim()
      : typeof card.manaCost === "string"
        ? card.manaCost.trim()
      : "";
  const name = normalizeLabel(cardFace?.name || card.name, "Card");
  const power = normalizeSignedCount(cardFace?.power ?? card.power, 0);
  const toughness = normalizeSignedCount(cardFace?.toughness ?? card.toughness, 0);
  const loyalty = normalizeSignedCount(cardFace?.loyalty ?? card.loyalty, 0);
  const isCreature = hasTypeLine(typeLine, "Creature");
  const isArtifact = hasTypeLine(typeLine, "Artifact");
  const isPlaneswalker = hasTypeLine(typeLine, "Planeswalker");
  const isLegendary = hasTypeLine(typeLine, "Legendary");
  const isToken = hasTypeLine(typeLine, "Token") || String(card?.layout || "").toLowerCase() === "token";
  const colorIdentity = Array.isArray(card?.color_identity)
    ? card.color_identity.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean)
    : [];

  return {
    name,
    manaCost,
    typeLine,
    oracleText,
    imageUrl: getCardImageUrl(card, cardFace),
    cardImageUrl: getCardImageUrl(card, cardFace),
    power,
    toughness,
    loyalty,
    isCreature,
    isArtifact,
    isPlaneswalker,
    isLegendary,
    isToken,
    colorIdentity,
    isNonCreature: !isCreature,
  };
}

function getPrimaryCardFace(card) {
  if (!Array.isArray(card.card_faces) || card.card_faces.length === 0) {
    return null;
  }

  return (
    card.card_faces.find((face) => isPermanentTypeLine(face.type_line || "")) ||
    card.card_faces[0] ||
    null
  );
}

function getCardImageUrl(card, cardFace = getPrimaryCardFace(card)) {
  return (
    card.image_uris?.normal ||
    card.image_uris?.large ||
    card.image_uris?.small ||
    cardFace?.image_uris?.normal ||
    cardFace?.image_uris?.large ||
    cardFace?.image_uris?.small ||
    card.cardImageUrl ||
    card.imageUrl ||
    ""
  );
}

function isSupportedPermanent(card) {
  const preview = extractScryfallCardData(card);
  return isPermanentTypeLine(preview.typeLine);
}

function isPermanentTypeLine(typeLine) {
  return ["Artifact", "Creature", "Enchantment", "Land", "Planeswalker", "Battle"].some((type) =>
    hasTypeLine(typeLine, type)
  );
}

function getActiveCommanderName() {
  return normalizeLabel(state.commander?.name, normalizeLabel(state.playerName, "Commander"));
}

function getCommanderDeckKey(commanderName = "") {
  return normalizeLabel(commanderName, "Commander").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "commander";
}

function getActiveCommanderDeckArchive() {
  const commanderName = getActiveCommanderName();
  const commanderKey = getCommanderDeckKey(commanderName);
  const deck = state.archive?.commanderDecks?.[commanderKey];
  return deck || {
    commanderName,
    cards: [],
    usedCards: {},
    games: [],
  };
}

function getCommanderCardKey(card = {}) {
  const scryfallId = normalizeLabel(card.scryfallId || card.id, "");
  if (scryfallId && !scryfallId.startsWith("commander-card-")) {
    return scryfallId;
  }

  const name = normalizeLabel(card.name, "card").toLowerCase();
  const manaCost = normalizeLabel(card.manaCost || card.mana_cost, "").toLowerCase();
  const typeLine = normalizeLabel(card.typeLine || card.type_line, "").toLowerCase();
  return [name, manaCost, typeLine].join("|");
}

function isBasicLandCard(card = {}) {
  const preview = getCardPreview(card);
  const normalizedName = preview.name.toLowerCase();
  return (hasTypeLine(preview.typeLine, "Basic") && hasTypeLine(preview.typeLine, "Land")) || BASIC_LAND_NAMES.has(normalizedName);
}

function isCommanderDeckEligibleCard(card = {}) {
  const preview = getCardPreview(card);
  if (preview.isToken || isBasicLandCard(card)) {
    return false;
  }

  const typeLine = preview.typeLine || "";
  if (hasTypeLine(typeLine, "Land")) {
    return !hasTypeLine(typeLine, "Basic");
  }

  return ["Creature", "Artifact", "Enchantment", "Planeswalker", "Instant", "Sorcery"].some((type) =>
    hasTypeLine(typeLine, type)
  );
}

function getCommanderLegality(card = {}) {
  const preview = getCardPreview(card);
  const typeLine = preview.typeLine || "";
  const oracleText = preview.oracleText || "";
  const commanderLegality = normalizeLabel(card?.legalities?.commander, "unknown").toLowerCase();
  const isBanned = commanderLegality === "banned";
  const isLegendaryCreature = preview.isLegendary && preview.isCreature;
  const isLegendaryArtifact = preview.isLegendary && preview.isArtifact;
  const isPlaneswalkerCommander =
    preview.isPlaneswalker && /\bcan be your commander\b/i.test(`${oracleText} ${typeLine}`);

  if (isBanned) {
    return { ok: false, reason: "Banned in Commander." };
  }

  if (isLegendaryCreature || isLegendaryArtifact || isPlaneswalkerCommander) {
    return {
      ok: true,
      reason: isPlaneswalkerCommander
        ? "Planeswalker card text allows it to be your commander."
        : "Legendary permanent meets commander selection rules for this app.",
    };
  }

  return { ok: false, reason: "Choose a legendary creature, legendary artifact, or planeswalker that says it can be your commander." };
}

function getCardColorIdentity(card = {}) {
  const preview = getCardPreview(card);
  if (Array.isArray(preview.colorIdentity) && preview.colorIdentity.length > 0) {
    return Array.from(new Set(preview.colorIdentity));
  }

  const text = `${preview.manaCost || ""} ${preview.oracleText || ""}`;
  const symbols = [];
  if (/[{(]?W[})]?/i.test(text)) symbols.push("W");
  if (/[{(]?U[})]?/i.test(text)) symbols.push("U");
  if (/[{(]?B[})]?/i.test(text)) symbols.push("B");
  if (/[{(]?R[})]?/i.test(text)) symbols.push("R");
  if (/[{(]?G[})]?/i.test(text)) symbols.push("G");
  return Array.from(new Set(symbols));
}

function isCardWithinCommanderIdentity(card = {}, commander = state.commander) {
  const commanderIdentity = Array.isArray(commander?.colorIdentity) ? commander.colorIdentity : [];
  if (!commander?.name || commanderIdentity.length === 0) {
    return true;
  }

  return getCardColorIdentity(card).every((symbol) => commanderIdentity.includes(symbol));
}

function hasCommanderDeckCard(card, deck = getActiveCommanderDeckArchive()) {
  const cardKey = getCommanderCardKey(card);
  return Array.isArray(deck?.cards) && deck.cards.some((entry) => entry.key === cardKey || getCommanderCardKey(entry) === cardKey);
}

function addCardToCommanderDeckArchive(card, commanderName = getActiveCommanderName()) {
  if (!isCommanderDeckEligibleCard(card)) {
    return { ok: false, message: "That card cannot be added to the commander deck archive." };
  }

  if (!isCardWithinCommanderIdentity(card)) {
    return { ok: false, message: `${getCardPreview(card).name} is outside ${commanderName}'s color identity.` };
  }

  const commanderKey = getCommanderDeckKey(commanderName);
  const archive = normalizeArchiveState(state.archive);
  const existingDeck = archive.commanderDecks[commanderKey] || {
    commanderName,
    cards: [],
    usedCards: {},
    games: [],
  };
  if (hasCommanderDeckCard(card, existingDeck)) {
    state = {
      ...state,
      archive,
    };
    return { ok: false, message: `${getCardPreview(card).name} is already in ${commanderName}'s deck archive.` };
  }

  const nextCard = createCommanderDeckCardFromSearchResult(card);
  state = {
    ...state,
    archive: {
      ...archive,
      commanderDecks: {
        ...archive.commanderDecks,
        [commanderKey]: {
          ...existingDeck,
          commanderName,
          cards: [...existingDeck.cards, nextCard],
        },
      },
    },
  };

  return { ok: true, message: `Added ${nextCard.name} to ${commanderName}'s deck archive.` };
}

function createCommanderDeckCardFromSearchResult(card) {
  const preview = getCardPreview(card);
  return normalizeCommanderDeckCard({
    scryfallId: typeof card?.id === "string" ? card.id : "",
    name: preview.name,
    manaCost: preview.manaCost,
    typeLine: preview.typeLine,
    oracleText: preview.oracleText,
    imageUrl: preview.imageUrl,
    cardImageUrl: preview.cardImageUrl,
    legalities: card?.legalities || {},
    colorIdentity: preview.colorIdentity,
    addedAt: Date.now(),
    lastUsedAt: Date.now(),
    usageCount: 0,
  });
}

function recordCommanderCardUsageInArchive(archiveState, card, commanderName = getActiveCommanderName()) {
  if (!card || getCardPreview(card).isToken || isBasicLandCard(card)) {
    return normalizeArchiveState(archiveState);
  }

  const archive = normalizeArchiveState(archiveState);
  const commanderKey = getCommanderDeckKey(commanderName);
  const existingDeck = archive.commanderDecks[commanderKey] || {
    commanderName,
    cards: [],
    usedCards: {},
    games: [],
  };
  const cardKey = getCommanderCardKey(card);
  const preview = getCardPreview(card);
  const usedEntry = existingDeck.usedCards[cardKey] || {
    name: preview.name,
    count: 0,
    lastUsedAt: Date.now(),
  };

  return {
    ...archive,
    commanderDecks: {
      ...archive.commanderDecks,
      [commanderKey]: {
        ...existingDeck,
        commanderName,
        usedCards: {
          ...existingDeck.usedCards,
          [cardKey]: {
            ...usedEntry,
            name: preview.name,
            count: normalizeCount(usedEntry.count, 0) + 1,
            lastUsedAt: Date.now(),
          },
        },
      },
    },
  };
}

function recordCommanderGameInArchive(archiveState, game) {
  const archive = normalizeArchiveState(archiveState);
  const commanderName = normalizeLabel(game?.commanderName, getActiveCommanderName());
  const commanderKey = getCommanderDeckKey(commanderName);
  const existingDeck = archive.commanderDecks[commanderKey] || {
    commanderName,
    cards: [],
    usedCards: {},
    games: [],
  };

  return {
    ...archive,
    commanderDecks: {
      ...archive.commanderDecks,
      [commanderKey]: {
        ...existingDeck,
        commanderName,
        games: [
          {
            id: normalizeLabel(game?.id, createId()),
            endedAt: normalizeTimestamp(game?.endedAt),
            durationMs: Math.max(0, Number(game?.durationMs) || 0),
            lifeEnd: normalizeCount(game?.lifeEnd, 0),
          },
          ...(existingDeck.games || []),
        ].slice(0, 100),
      },
    },
  };
}

function hasTypeLine(typeLine, typeName) {
  return new RegExp(`\\b${escapeRegExp(typeName)}\\b`, "i").test(typeLine || "");
}

function mapScryfallCardToPermanent(card, rulings = []) {
  const preview = extractScryfallCardData(card);
  const effectMetadata = getEffectMetadataFromText(preview.oracleText);

  return createPermanent({
    scryfallId: typeof card?.id === "string" ? card.id : "",
    name: preview.name,
    manaCost: preview.manaCost,
    typeLine: preview.typeLine,
    oracleText: preview.oracleText,
    imageUrl: preview.imageUrl,
    cardImageUrl: preview.cardImageUrl,
    rulingsUri: typeof card?.rulings_uri === "string" ? card.rulings_uri : "",
    rulings,
    legalities: card?.legalities || {},
    colorIdentity: preview.colorIdentity,
    power: preview.power,
    toughness: preview.toughness,
    printedLoyalty: preview.loyalty,
    quantity: 1,
    isToken: preview.isToken,
    isNonCreature: preview.isNonCreature,
    isLegendary: preview.isLegendary,
    isArtifact: preview.isArtifact,
    isCreature: preview.isCreature,
    isPlaneswalker: preview.isPlaneswalker,
    plusOneCounters: 0,
    counters: preview.isPlaneswalker && preview.loyalty > 0 ? { Loyalty: preview.loyalty } : {},
    doublesTokens: effectMetadata.doublesTokens,
    doublesCounters: effectMetadata.doublesCounters,
    counterModifierBonus: effectMetadata.counterModifierBonus,
    createsTokens: effectMetadata.createsTokens,
    addsCounters: effectMetadata.addsCounters,
    staticBuffRules: effectMetadata.staticBuffRules,
    staticBuffPower: effectMetadata.staticBuffPower,
    staticBuffToughness: effectMetadata.staticBuffToughness,
    staticBuffAppliesTo: effectMetadata.staticBuffAppliesTo,
    staticBuffExcludesSelf: effectMetadata.staticBuffExcludesSelf,
    isExpanded: false,
    isSelected: false,
    summoningSickness: preview.isCreature,
  });
}

function importScryfallResult(resultIndex) {
  handleCardResultSelect(resultIndex);
}

async function addSelectedCardToBattlefield(selectedCard = null) {
  const card = selectedCard || boardUi.searchResults[boardUi.selectedSearchResultIndex];
  if (!card) {
    return;
  }

  if (!isSupportedPermanent(card)) {
    boardUi = {
      ...boardUi,
      searchMessage: "Instants and sorceries are not supported yet.",
      searchMessageTone: "neutral",
    };
    renderBoardSearch();
    return;
  }

  resetSearchState();
  renderBoardSearch();

  try {
    const rulings = await fetchCardRulings(card);
    const permanent = getCardPreview(card).isToken
      ? importScryfallToken(card, rulings)
      : mapScryfallCardToPermanent(card, rulings);
    const nextBoardState = addImportedPermanentToBoardState(state.boardState, permanent);
    const nextArchive = recordCommanderCardUsageInArchive(state.archive, card, getActiveCommanderName());

    state = {
      ...state,
      boardState: nextBoardState,
      archive: nextArchive,
    };
    boardUi = {
      ...boardUi,
      activeMenuPermanentId: "",
    };

    persistState();
    render();
    showQuickToast(`Added ${permanent.name}`);

    window.clearTimeout(automationDialogTimer);
    if (nextBoardState.automationSuggestions.length > 0) {
      automationDialogTimer = window.setTimeout(() => {
        showDialog(automationRulesDialog);
      }, 1000);
    }
  } catch (error) {
    boardUi = {
      ...boardUi,
      searchMessage: error instanceof Error ? error.message : "Unable to add card right now.",
      searchMessageTone: "error",
    };
    renderBoardSearch();
  }
}

function importScryfallToken(card, rulings = []) {
  const preview = getCardPreview(card);
  const effectMetadata = getEffectMetadataFromText(preview.oracleText);

  return createPermanent({
    scryfallId: typeof card?.id === "string" ? card.id : "",
    name: preview.name,
    manaCost: preview.manaCost,
    typeLine: preview.typeLine,
    oracleText: preview.oracleText,
    imageUrl: preview.imageUrl,
    cardImageUrl: preview.cardImageUrl,
    rulingsUri: typeof card?.rulings_uri === "string" ? card.rulings_uri : "",
    rulings,
    legalities: card?.legalities || {},
    power: preview.power,
    toughness: preview.toughness,
    quantity: 1,
    isToken: true,
    isNonCreature: preview.isNonCreature,
    isLegendary: preview.isLegendary,
    isArtifact: preview.isArtifact,
    isCreature: preview.isCreature,
    plusOneCounters: 0,
    doublesTokens: effectMetadata.doublesTokens,
    doublesCounters: effectMetadata.doublesCounters,
    counterModifierBonus: effectMetadata.counterModifierBonus,
    createsTokens: effectMetadata.createsTokens,
    addsCounters: effectMetadata.addsCounters,
    staticBuffRules: effectMetadata.staticBuffRules,
    staticBuffPower: effectMetadata.staticBuffPower,
    staticBuffToughness: effectMetadata.staticBuffToughness,
    staticBuffAppliesTo: effectMetadata.staticBuffAppliesTo,
    staticBuffExcludesSelf: effectMetadata.staticBuffExcludesSelf,
    isExpanded: false,
    isSelected: false,
    summoningSickness: preview.isCreature,
  });
}

function addImportedPermanentToBoardState(boardState, permanent) {
  const addResult = addOrStackPermanentDetailed(boardState, permanent);
  const attachedBoardState = maybeAttachImportedPermanent(addResult.boardState, addResult.permanentId);
  const sourcePermanent = attachedBoardState.permanents.find((entry) => entry.id === addResult.permanentId) || permanent;
  const suggestions = buildAutomationSuggestions(sourcePermanent);
  const nextBoardState = attachAutomationSuggestions(attachedBoardState, sourcePermanent.id, sourcePermanent.name, suggestions);
  const etbBoardState = executeEnterBattlefieldAutomation(nextBoardState, sourcePermanent.id, addResult.instancesAdded);
  return runEnchantmentEngine(etbBoardState, {
    phase: PHASES[normalizePhaseIndex(etbBoardState.currentPhaseIndex)],
    sagaEnterIds: [sourcePermanent.id],
  }).boardState;
}

function maybeAttachImportedPermanent(boardState, permanentId) {
  const sourcePermanent = boardState.permanents.find((permanent) => permanent.id === permanentId);
  if (!sourcePermanent) {
    return boardState;
  }

  const typeLine = String(sourcePermanent.typeLine || "").toLowerCase();
  const isAura = typeLine.includes("aura");
  const isEquipment = typeLine.includes("equipment");
  if (!isAura && !isEquipment) {
    return boardState;
  }

  const creatures = boardState.permanents.filter((permanent) => permanent.isCreature);
  if (creatures.length === 0) {
    return boardState;
  }

  const promptText = creatures.map((permanent, index) => `${index + 1}. ${permanent.name}`).join("\n");
  const attachmentTypeLabel = isAura ? "aura" : "equipment";
  const response = window.prompt(
    `Attach ${sourcePermanent.name} to which creature?\nLeave blank to keep it unattached.\n\n${promptText}`,
    ""
  );
  if (response === null || !response.trim()) {
    return boardState;
  }

  const choiceIndex = Number(response) - 1;
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= creatures.length) {
    return boardState;
  }

  const target = creatures[choiceIndex];
  return {
    ...boardState,
    permanents: boardState.permanents.map((permanent) => {
      if (permanent.id !== sourcePermanent.id) {
        return permanent;
      }

      return createPermanent({
        ...permanent,
        attachedToId: target.id,
        attachmentKind: attachmentTypeLabel,
      });
    }),
  };
}

function runEnchantmentEngine(boardState, options = {}) {
  if (!boardState || !Array.isArray(boardState.permanents)) {
    return { boardState, changed: false };
  }

  const phase = normalizePhase(options.phase || PHASES[normalizePhaseIndex(boardState.currentPhaseIndex)]);
  const sagaEnterIds = Array.isArray(options.sagaEnterIds)
    ? options.sagaEnterIds.filter((id) => typeof id === "string" && id.trim())
    : [];
  const shouldAdvanceSagas = Boolean(options.advanceSagas);

  let nextBoardState = normalizeBoardState(boardState);
  let changed = false;
  let attachmentResult = enforceEnchantmentAttachmentLegality(nextBoardState);
  if (attachmentResult.changed) {
    nextBoardState = attachmentResult.boardState;
    changed = true;
  }

  const chapterEvents = [];
  sagaEnterIds.forEach((sagaId) => {
    const sagaResult = advanceSagaLoreCounter(nextBoardState, sagaId);
    if (!sagaResult.changed) {
      return;
    }

    nextBoardState = sagaResult.boardState;
    changed = true;
    chapterEvents.push(...sagaResult.chapterEvents);
  });

  if (shouldAdvanceSagas) {
    const sagaIds = nextBoardState.permanents.filter((permanent) => isSagaPermanent(permanent)).map((permanent) => permanent.id);
    sagaIds.forEach((sagaId) => {
      const sagaResult = advanceSagaLoreCounter(nextBoardState, sagaId);
      if (!sagaResult.changed) {
        return;
      }

      nextBoardState = sagaResult.boardState;
      changed = true;
      chapterEvents.push(...sagaResult.chapterEvents);
    });
  }

  if (chapterEvents.length > 0) {
    const chaptersBySaga = chapterEvents.reduce((accumulator, chapterEvent) => {
      const list = accumulator.get(chapterEvent.sagaId) || [];
      list.push(chapterEvent);
      accumulator.set(chapterEvent.sagaId, list);
      return accumulator;
    }, new Map());

    chaptersBySaga.forEach((eventsForSaga, sagaId) => {
      const orderedEvents = [...eventsForSaga].sort((a, b) => a.chapter - b.chapter);
      orderedEvents.forEach((chapterEvent) => {
        const sourcePermanent = nextBoardState.permanents.find((permanent) => permanent.id === chapterEvent.sagaId);
        if (!sourcePermanent) {
          return;
        }

        const chapterTrigger = buildSagaChapterTrigger(sourcePermanent, chapterEvent.actionText);
        if (!chapterTrigger) {
          return;
        }

        const triggerResult = executeTrigger(chapterTrigger, nextBoardState, {
          phase,
          selectedIds: getSelectedPermanentIds(nextBoardState.permanents),
          sourcePermanentId: sourcePermanent.id,
          sourcePermanent,
        });

        if (triggerResult.changed) {
          nextBoardState = triggerResult.boardState;
          changed = true;
        }
      });

      const lastChapterEvent = orderedEvents[orderedEvents.length - 1];
      if (!lastChapterEvent) {
        return;
      }

      if (shouldSacrificeSagaAfterChapter(nextBoardState, sagaId, lastChapterEvent.finalChapter)) {
        const removalResult = applyPermanentRemovalToBoardState(nextBoardState, sagaId, "sacrifice");
        if (removalResult.changed) {
          nextBoardState = removalResult.boardState;
          changed = true;
        }
      }
    });
  }

  attachmentResult = enforceEnchantmentAttachmentLegality(nextBoardState);
  if (attachmentResult.changed) {
    nextBoardState = attachmentResult.boardState;
    changed = true;
  }

  return {
    boardState: nextBoardState,
    changed,
  };
}

function enforceEnchantmentAttachmentLegality(boardState) {
  if (!boardState || !Array.isArray(boardState.permanents)) {
    return { boardState, changed: false };
  }

  const permanents = boardState.permanents;
  const byId = new Map(permanents.map((permanent) => [permanent.id, permanent]));
  const auraIdsToRemove = new Set();
  let detachChanged = false;

  permanents.forEach((permanent) => {
    if (!isAuraPermanent(permanent)) {
      return;
    }

    const target = permanent.attachedToId ? byId.get(permanent.attachedToId) : null;
    if (!isAuraAttachmentLegal(permanent, target)) {
      auraIdsToRemove.add(permanent.id);
    }
  });

  const nextPermanents = permanents
    .filter((permanent) => !auraIdsToRemove.has(permanent.id))
    .map((permanent) => {
      if (isAuraPermanent(permanent)) {
        return createPermanent(permanent);
      }

      if (permanent.attachedToId && !byId.has(permanent.attachedToId)) {
        detachChanged = true;
        return createPermanent({
          ...permanent,
          attachedToId: "",
          attachmentKind: "",
        });
      }

      return createPermanent(permanent);
    });

  if (auraIdsToRemove.size === 0 && !detachChanged) {
    return { boardState, changed: false };
  }

  return {
    boardState: {
      ...boardState,
      permanents: nextPermanents,
      automationRules: boardState.automationRules.filter((rule) => !auraIdsToRemove.has(rule.sourcePermanentId)),
      automationSuggestions: boardState.automationSuggestions.filter((rule) => !auraIdsToRemove.has(rule.sourcePermanentId)),
    },
    changed: true,
  };
}

function isEnchantmentType(permanent) {
  return hasTypeLine(permanent?.typeLine || "", "Enchantment");
}

function isAuraPermanent(permanent) {
  return isEnchantmentType(permanent) && hasTypeLine(permanent?.typeLine || "", "Aura");
}

function isSagaPermanent(permanent) {
  return isEnchantmentType(permanent) && hasTypeLine(permanent?.typeLine || "", "Saga");
}

function isAuraAttachmentLegal(auraPermanent, targetPermanent) {
  if (!auraPermanent || !targetPermanent) {
    return false;
  }

  if (auraPermanent.id === targetPermanent.id) {
    return false;
  }

  const enchantClauses = parseAuraEnchantClauses(auraPermanent);
  if (enchantClauses.length === 0) {
    return targetPermanent.isCreature;
  }

  return enchantClauses.some((clause) => doesAuraClauseMatchTarget(clause, targetPermanent));
}

function parseAuraEnchantClauses(auraPermanent) {
  const oracleText = normalizeLabel(auraPermanent?.oracleText, "");
  if (!oracleText) {
    return [];
  }

  const matches = [...oracleText.matchAll(/\benchant\s+([^.\n]+)/gi)];
  return matches
    .map((match) => normalizeLabel(match?.[1], "").toLowerCase())
    .filter((clause) => clause && !clause.includes("player"))
    .map((clause) => clause.replace(/[^\w\s\-]/g, " ").replace(/\s+/g, " ").trim());
}

function doesAuraClauseMatchTarget(clause, targetPermanent) {
  if (!clause || !targetPermanent) {
    return false;
  }

  const normalizedClause = clause.toLowerCase();
  const typeLine = String(targetPermanent.typeLine || "").toLowerCase();
  const isPermanent = true;
  const isCreature = Boolean(targetPermanent.isCreature);
  const isArtifact = Boolean(targetPermanent.isArtifact);
  const isLegendary = Boolean(targetPermanent.isLegendary);
  const isEnchantment = hasTypeLine(typeLine, "Enchantment");
  const isLand = hasTypeLine(typeLine, "Land");
  const isPlaneswalker = hasTypeLine(typeLine, "Planeswalker");
  const isNonCreature = !isCreature;
  const isNonLegendary = !isLegendary;

  if (normalizedClause.includes("permanent")) {
    if (normalizedClause.includes("noncreature") && !isNonCreature) {
      return false;
    }
    if (normalizedClause.includes("creature") && !isCreature) {
      return false;
    }
    if (normalizedClause.includes("artifact") && !isArtifact) {
      return false;
    }
    if (normalizedClause.includes("enchantment") && !isEnchantment) {
      return false;
    }
    if (normalizedClause.includes("land") && !isLand) {
      return false;
    }
    if (normalizedClause.includes("planeswalker") && !isPlaneswalker) {
      return false;
    }
    if (normalizedClause.includes("legendary") && !isLegendary) {
      return false;
    }
    if (normalizedClause.includes("nonlegendary") && !isNonLegendary) {
      return false;
    }
    return isPermanent;
  }

  if (normalizedClause.includes("creature")) {
    if (!isCreature) {
      return false;
    }
    if (normalizedClause.includes("legendary") && !isLegendary) {
      return false;
    }
    if (normalizedClause.includes("nonlegendary") && !isNonLegendary) {
      return false;
    }
    if (normalizedClause.includes("artifact") && !isArtifact) {
      return false;
    }
    return true;
  }

  if (normalizedClause.includes("artifact")) {
    if (!isArtifact) {
      return false;
    }
    if (normalizedClause.includes("creature") && !isCreature) {
      return false;
    }
    if (normalizedClause.includes("noncreature") && !isNonCreature) {
      return false;
    }
    return true;
  }

  if (normalizedClause.includes("land")) {
    return isLand;
  }

  if (normalizedClause.includes("planeswalker")) {
    return isPlaneswalker;
  }

  if (normalizedClause.includes("enchantment")) {
    return isEnchantment;
  }

  return isCreature;
}

function advanceSagaLoreCounter(boardState, sagaId) {
  const sagaPermanent = boardState.permanents.find((permanent) => permanent.id === sagaId);
  if (!sagaPermanent || !isSagaPermanent(sagaPermanent)) {
    return { boardState, changed: false, chapterEvents: [] };
  }

  const chapterMap = parseSagaChapterMap(sagaPermanent.oracleText || "");
  const chapterValues = Object.keys(chapterMap)
    .map((key) => Number(key))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
  if (chapterValues.length === 0) {
    return { boardState, changed: false, chapterEvents: [] };
  }

  const finalChapter = chapterValues[chapterValues.length - 1];
  const previousLoreCount = normalizeCount(getPermanentCounterValue(sagaPermanent, "Lore"));
  const loreModifierResult = applyCounterModifiersDetailed(1, boardState.permanents);
  const loreToAdd = Math.max(0, normalizeCount(loreModifierResult.value));
  if (loreToAdd <= 0) {
    return { boardState, changed: false, chapterEvents: [] };
  }

  let nextBoardState = {
    ...boardState,
    permanents: boardState.permanents.map((permanent) => {
      if (permanent.id !== sagaId) {
        return permanent;
      }

      return applyCounterToPermanent(permanent, "Lore", loreToAdd);
    }),
  };

  const nextSagaPermanent = nextBoardState.permanents.find((permanent) => permanent.id === sagaId);
  const nextLoreCount = normalizeCount(getPermanentCounterValue(nextSagaPermanent, "Lore"));
  const chapterEvents = chapterValues
    .filter((chapterValue) => chapterValue > previousLoreCount && chapterValue <= nextLoreCount)
    .map((chapterValue) => ({
      sagaId,
      sagaName: sagaPermanent.name,
      chapter: chapterValue,
      actionText: chapterMap[chapterValue] || "",
      finalChapter,
    }));

  return {
    boardState: nextBoardState,
    changed: true,
    chapterEvents,
  };
}

function parseSagaChapterMap(oracleText) {
  const chapterMap = {};
  const text = String(oracleText || "").replace(/\r/g, "");
  const chapterPattern = /(?:^|\n)\s*([ivxlcdm,\s]+)\s*[—-]\s*([^\n]+)/gim;
  let match = chapterPattern.exec(text);

  while (match) {
    const chapterLabel = normalizeLabel(match[1], "");
    const actionText = normalizeLabel(match[2], "");
    chapterLabel
      .split(",")
      .map((part) => romanNumeralToNumber(part.trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
      .forEach((value) => {
        chapterMap[value] = actionText;
      });
    match = chapterPattern.exec(text);
  }

  return chapterMap;
}

function romanNumeralToNumber(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^IVXLCDM]/g, "");
  if (!normalized) {
    return 0;
  }

  const numerals = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let total = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = numerals[normalized[index]] || 0;
    const next = numerals[normalized[index + 1]] || 0;
    total += current < next ? -current : current;
  }

  return total > 0 ? total : 0;
}

function getPermanentCounterValue(permanent, counterType) {
  if (!permanent) {
    return 0;
  }

  const normalizedCounterType = normalizeCounterType(counterType);
  if (!normalizedCounterType) {
    return 0;
  }

  if (normalizedCounterType === "+1/+1") {
    return normalizeCount(permanent.plusOneCounters);
  }

  if (normalizedCounterType === "-1/-1") {
    return normalizeCount(permanent.minusOneCounters);
  }

  const counters = normalizePermanentCounters(permanent.counters);
  return normalizeCount(counters[normalizedCounterType]);
}

function buildSagaChapterTrigger(sourcePermanent, actionText) {
  const normalizedText = normalizeLabel(actionText, "").toLowerCase();
  if (!normalizedText) {
    return null;
  }

  if (normalizedText.includes("create") && normalizedText.includes("token")) {
    const tokenSpec = extractTokenSpec(actionText);
    const tokenEntryProfile = extractTokenEntryProfile(actionText);
    return {
      actionType: "Create Tokens",
      target: "All",
      value: extractCountFromText(actionText),
      valueMode: extractValueModeFromText(actionText),
      tokenName: tokenSpec.name,
      tokenPower: tokenSpec.power,
      tokenToughness: tokenSpec.toughness,
      tokenManaCost: "",
      tokenTapped: tokenEntryProfile.tapped,
      tokenAttacking: tokenEntryProfile.attacking,
      counterType: "",
      requiresTargetSelection: false,
      counterTargetEntity: "creature",
      sourcePermanentId: sourcePermanent.id,
    };
  }

  if (normalizedText.includes("counter")) {
    const counterType = extractCounterTypeFromText(actionText);
    const actionType = counterType === "+1/+1" ? "Add +1/+1 Counters" : "Add Counters";
    const targetProfile = inferSagaCounterTargetProfile(normalizedText, sourcePermanent);
    return {
      actionType,
      target: targetProfile.target,
      value: extractCounterCountFromText(actionText),
      counterType,
      requiresTargetSelection: targetProfile.requiresTargetSelection,
      counterTargetEntity: targetProfile.counterTargetEntity,
      sourcePermanentId: sourcePermanent.id,
    };
  }

  if ((normalizedText.includes("double") || normalizedText.includes("twice")) && normalizedText.includes("token")) {
    return {
      actionType: "Multiply Tokens",
      target: "Tokens Only",
      value: 2,
      requiresTargetSelection: false,
      counterTargetEntity: "creature",
      sourcePermanentId: sourcePermanent.id,
    };
  }

  const temporaryBuff = extractTemporaryBuffFromText(actionText);
  if (temporaryBuff) {
    const targetProfile = inferSagaGenericTargetProfile(normalizedText, sourcePermanent);
    return {
      actionType: "Apply Temporary Buff",
      target: targetProfile.target,
      value: 0,
      buffPower: temporaryBuff.power,
      buffToughness: temporaryBuff.toughness,
      buffDuration: temporaryBuff.duration,
      requiresTargetSelection: targetProfile.requiresTargetSelection,
      counterTargetEntity: targetProfile.counterTargetEntity,
      sourcePermanentId: sourcePermanent.id,
    };
  }

  return null;
}

function inferSagaCounterTargetProfile(normalizedText, sourcePermanent) {
  if (
    normalizedText.includes("on it") ||
    normalizedText.includes("on itself") ||
    normalizedText.includes("this saga") ||
    normalizedText.includes("this permanent")
  ) {
    return {
      target: "Self",
      requiresTargetSelection: false,
      counterTargetEntity: sourcePermanent.isCreature ? "creature" : "permanent",
    };
  }

  if (
    normalizedText.includes("target creature") ||
    normalizedText.includes("another target creature") ||
    normalizedText.includes("up to one target creature")
  ) {
    return {
      target: "Selected",
      requiresTargetSelection: true,
      counterTargetEntity: "creature",
    };
  }

  if (
    normalizedText.includes("target permanent") ||
    normalizedText.includes("another target permanent") ||
    normalizedText.includes("up to one target permanent")
  ) {
    return {
      target: "Selected",
      requiresTargetSelection: true,
      counterTargetEntity: "permanent",
    };
  }

  if (
    normalizedText.includes("each permanent") ||
    normalizedText.includes("permanents you control") ||
    normalizedText.includes("each noncreature permanent")
  ) {
    return {
      target: "All",
      requiresTargetSelection: false,
      counterTargetEntity: "permanent",
    };
  }

  return {
    target: "All Creatures",
    requiresTargetSelection: false,
    counterTargetEntity: "creature",
  };
}

function inferSagaGenericTargetProfile(normalizedText, sourcePermanent) {
  if (
    normalizedText.includes("on it") ||
    normalizedText.includes("on itself") ||
    normalizedText.includes("this saga") ||
    normalizedText.includes("this permanent")
  ) {
    return {
      target: "Self",
      requiresTargetSelection: false,
      counterTargetEntity: sourcePermanent.isCreature ? "creature" : "permanent",
    };
  }

  if (
    normalizedText.includes("target creature") ||
    normalizedText.includes("another target creature") ||
    normalizedText.includes("up to one target creature")
  ) {
    return {
      target: "Selected",
      requiresTargetSelection: true,
      counterTargetEntity: "creature",
    };
  }

  if (
    normalizedText.includes("target permanent") ||
    normalizedText.includes("another target permanent") ||
    normalizedText.includes("up to one target permanent")
  ) {
    return {
      target: "Selected",
      requiresTargetSelection: true,
      counterTargetEntity: "permanent",
    };
  }

  if (
    normalizedText.includes("each permanent") ||
    normalizedText.includes("permanents you control") ||
    normalizedText.includes("all permanents")
  ) {
    return {
      target: "All",
      requiresTargetSelection: false,
      counterTargetEntity: "permanent",
    };
  }

  return {
    target: "All Creatures",
    requiresTargetSelection: false,
    counterTargetEntity: "creature",
  };
}

function shouldSacrificeSagaAfterChapter(boardState, sagaId, finalChapter) {
  if (!Number.isInteger(finalChapter) || finalChapter <= 0) {
    return false;
  }

  const sagaPermanent = boardState.permanents.find((permanent) => permanent.id === sagaId);
  if (!sagaPermanent || !isSagaPermanent(sagaPermanent)) {
    return false;
  }

  const loreCount = normalizeCount(getPermanentCounterValue(sagaPermanent, "Lore"));
  return loreCount >= finalChapter;
}

function executeEnterBattlefieldAutomation(boardState, sourcePermanentId, instancesAdded = 1) {
  const sourcePermanent = boardState.permanents.find((permanent) => permanent.id === sourcePermanentId);
  if (!sourcePermanent || !boardState.automationEnabled) {
    return boardState;
  }

  if (sourcePermanent.hasResolvedEtbTriggers && instancesAdded <= 0) {
    return boardState;
  }

  if (automationChainDepth >= MAX_AUTOMATION_CHAIN_DEPTH) {
    return boardState;
  }

  automationChainDepth += 1;
  try {
    const nextBoardState = executeActiveAutomationRules(boardState, {
      eventType: "ETB",
      phase: PHASES[boardState.currentPhaseIndex],
      sourcePermanentId,
      sourcePermanent,
      eventPermanent: sourcePermanent,
      instancesAdded,
    });

    return updateBoardPermanent(nextBoardState, sourcePermanentId, (permanent) => ({
      ...permanent,
      hasResolvedEtbTriggers: true,
    }));
  } finally {
    automationChainDepth = Math.max(0, automationChainDepth - 1);
  }
}

function promptCreateGenericToken() {
  openGenericTokenDialog();
}

function openGenericTokenDialog() {
  genericTokenForm?.reset();
  if (tokenTemplateSearchInput) {
    tokenTemplateSearchInput.value = "";
  }
  if (tokenPowerInput) {
    tokenPowerInput.value = "1";
  }
  if (tokenToughnessInput) {
    tokenToughnessInput.value = "1";
  }
  if (tokenQuantityInput) {
    tokenQuantityInput.value = "1";
  }
  if (tokenTypeInput) {
    tokenTypeInput.value = "Token Creature";
  }
  if (tokenNotesInput) {
    tokenNotesInput.value = "";
  }
  renderTokenTemplateList();
  showDialog(genericTokenDialog);
  window.requestAnimationFrame(() => {
    tokenNameInput?.focus();
  });
}

function getCommanderDeckSearchCards(query = "") {
  const normalizedQuery = normalizeLabel(query, "").toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const deck = getActiveCommanderDeckArchive();
  const deckCards = Array.isArray(deck?.cards) ? deck.cards : [];
  const usedCards = deck?.usedCards && typeof deck.usedCards === "object" ? Object.values(deck.usedCards) : [];
  const deckMatches = deckCards
    .filter((card) => {
      const haystack = [card.name, card.typeLine, card.oracleText].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .map((card) => commanderArchiveCardToSearchCard(card, true));
  const usageMatches = usedCards
    .filter((card) => normalizeLabel(card?.name, "").toLowerCase().includes(normalizedQuery))
    .map((card) => commanderArchiveCardToSearchCard(card, false));

  return [...deckMatches, ...usageMatches].slice(0, SEARCH_RESULT_LIMIT);
}

function commanderArchiveCardToSearchCard(card, isDeckCard) {
  return {
    id: card.scryfallId || getCommanderCardKey(card),
    name: normalizeLabel(card.name, "Card"),
    mana_cost: normalizeLabel(card.manaCost || card.mana_cost, ""),
    type_line: normalizeLabel(card.typeLine || card.type_line, ""),
    oracle_text: normalizeLabel(card.oracleText || card.oracle_text, ""),
    image_uris: {
      normal: normalizeLabel(card.imageUrl || card.cardImageUrl || "", ""),
    },
    legalities: normalizeLegalities(card.legalities),
    isCommanderDeckCard: Boolean(isDeckCard),
    commanderUsageCount: normalizeCount(card.usageCount || card.count, 0),
  };
}

function prioritizeSearchMatches(cards, query) {
  const normalizedQuery = normalizeLabel(query, "").toLowerCase();
  if (!normalizedQuery) {
    return cards;
  }

  const ranked = cards.map((card) => {
    const preview = getCardPreview(card);
    const name = normalizeLabel(preview.name, "").toLowerCase();
    const typeLine = normalizeLabel(preview.typeLine, "").toLowerCase();
    const isToken = typeLine.includes("token");
    const isBasicLand = typeLine.includes("basic") && typeLine.includes("land");
    const exactName = name === normalizedQuery;
    const startsWith = !exactName && name.startsWith(normalizedQuery);
    let score = 0;
    if (card?.isCommanderDeckCard) score += 2000;
    if (normalizeCount(card?.commanderUsageCount, 0) > 0) score += 250 + normalizeCount(card.commanderUsageCount, 0);
    if (exactName) score += 1000;
    if (startsWith) score += 500;
    if (isBasicLand) score += 120;
    if (isToken) score += 110;
    return { card, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.map((entry) => entry.card);
}

function renderTokenTemplateList() {
  if (!tokenTemplateList) {
    return;
  }

  const searchValue = tokenTemplateSearchInput?.value || "";
  const templates = getTokenTemplateSuggestions(searchValue);
  tokenTemplateList.innerHTML = templates
    .map((template) => `<button class="token-template-chip" type="button" data-token-template="${escapeHtml(template)}">${escapeHtml(template)}</button>`)
    .join("");

  if (copySelectedPermanentTokenButton) {
    const hasSelected = state.boardState.permanents.some((permanent) => permanent.isSelected);
    copySelectedPermanentTokenButton.disabled = !hasSelected;
    copySelectedPermanentTokenButton.textContent = hasSelected
      ? "Copy Selected Permanent"
      : "Copy Selected Permanent (Select one first)";
  }
}

function getTokenTemplateSuggestions(query = "") {
  const recent = Array.isArray(state.companion?.recentTokenSearches) ? state.companion.recentTokenSearches : [];
  const pool = Array.from(new Set([...recent, ...TOKEN_TEMPLATE_LIBRARY]));
  const normalizedQuery = normalizeLabel(query, "").toLowerCase();
  if (!normalizedQuery) {
    return pool.slice(0, 10);
  }

  return pool.filter((entry) => entry.toLowerCase().includes(normalizedQuery)).slice(0, 10);
}

function handleTokenTemplateClick(event) {
  const button = event.target.closest("[data-token-template]");
  if (!button) {
    return;
  }

  const templateName = normalizeLabel(button.dataset.tokenTemplate, "");
  if (!templateName) {
    return;
  }

  applyTokenTemplate(templateName);
  if (tokenTemplateSearchInput) {
    tokenTemplateSearchInput.value = templateName;
  }
  renderTokenTemplateList();
}

function applyTokenTemplate(templateName) {
  const normalizedTemplate = normalizeLabel(templateName, "");
  if (!normalizedTemplate) {
    return;
  }

  const lowerTemplate = normalizedTemplate.toLowerCase();
  if (tokenNameInput) {
    tokenNameInput.value = normalizedTemplate;
  }
  if (tokenTypeInput) {
    tokenTypeInput.value = getTokenTemplateTypeLine(normalizedTemplate);
  }
  if (tokenPowerInput && tokenToughnessInput) {
    if (["treasure", "food", "clue", "blood", "map", "powerstone"].includes(lowerTemplate)) {
      tokenPowerInput.value = "0";
      tokenToughnessInput.value = "0";
    } else {
      tokenPowerInput.value = "1";
      tokenToughnessInput.value = "1";
    }
  }
}

function getTokenTemplateTypeLine(templateName) {
  const lowerTemplate = normalizeLabel(templateName, "").toLowerCase();
  if (["treasure", "food", "clue", "blood", "map", "powerstone"].includes(lowerTemplate)) {
    return "Artifact Token";
  }

  return `Token Creature — ${templateName}`;
}

function handleCopySelectedPermanentToken() {
  const selectedPermanent = state.boardState.permanents.find((permanent) => permanent.isSelected);
  if (!selectedPermanent) {
    showQuickToast("Select a permanent first, then open token creator.");
    return;
  }

  const copiedToken = createCopyTokenFromPermanent(selectedPermanent);
  state = {
    ...state,
    boardState: addOrStackPermanent(state.boardState, copiedToken),
    companion: {
      ...state.companion,
      recentTokenSearches: updateRecentTokenSearches(state.companion?.recentTokenSearches, copiedToken.name),
    },
  };
  registerCompanionAction({
    type: "token",
    summary: `Created copy token of ${selectedPermanent.name}`,
    payload: { sourcePermanentId: selectedPermanent.id, name: copiedToken.name },
  });

  persistState();
  render();
  genericTokenDialog?.close();
  showQuickToast(`Copied ${selectedPermanent.name}.`);
}

function createCopyTokenFromPermanent(sourcePermanent) {
  return createPermanent({
    name: `Copy of ${sourcePermanent.name}`,
    manaCost: sourcePermanent.manaCost,
    typeLine: sourcePermanent.typeLine || getFallbackTypeLine(sourcePermanent),
    oracleText: sourcePermanent.oracleText,
    imageUrl: sourcePermanent.imageUrl || sourcePermanent.cardImageUrl || "",
    cardImageUrl: sourcePermanent.cardImageUrl || sourcePermanent.imageUrl || "",
    power: sourcePermanent.power,
    toughness: sourcePermanent.toughness,
    quantity: 1,
    isToken: true,
    isNonCreature: Boolean(sourcePermanent.isNonCreature),
    isLegendary: false,
    isArtifact: Boolean(sourcePermanent.isArtifact),
    isCreature: Boolean(sourcePermanent.isCreature),
    plusOneCounters: 0,
    minusOneCounters: 0,
    counters: {},
    doublesTokens: false,
    createsTokens: false,
    addsCounters: false,
    isExpanded: false,
    isSelected: false,
    summoningSickness: Boolean(sourcePermanent.isCreature),
    notes: "Copy token (base characteristics only).",
  });
}

function handleGenericTokenSubmit(event) {
  event.preventDefault();
  const token = createGenericToken({
    name: tokenNameInput?.value,
    manaCost: tokenManaCostInput?.value,
    power: tokenPowerInput?.value,
    toughness: tokenToughnessInput?.value,
    quantity: tokenQuantityInput?.value,
    typeText: tokenTypeInput?.value,
    notes: tokenNotesInput?.value,
  });

  if (!token) {
    return;
  }

  state = {
    ...state,
    boardState: addOrStackPermanent(state.boardState, token),
    companion: {
      ...state.companion,
      recentTokenSearches: updateRecentTokenSearches(state.companion?.recentTokenSearches, token.name),
    },
  };
  registerCompanionAction({
    type: "token",
    summary: `Created ${token.quantity} ${token.name} token${token.quantity === 1 ? "" : "s"}`,
    payload: {
      name: token.name,
      quantity: token.quantity,
      power: token.power,
      toughness: token.toughness,
    },
  });
  boardUi = {
    ...boardUi,
    searchMessage: `Created ${token.quantity} ${token.name} token${token.quantity === 1 ? "" : "s"} on the battlefield.`,
    searchMessageTone: "success",
  };

  persistState();
  render();
  genericTokenDialog.close();
}

function removeAllTokensFromBoard() {
  const tokenStacks = state.boardState.permanents.filter((permanent) => permanent.isToken);
  if (tokenStacks.length === 0) {
    showQuickToast("No tokens to remove.");
    return;
  }

  const removedQuantity = tokenStacks.reduce((total, permanent) => total + normalizeCount(permanent.quantity, 1), 0);
  registerCompanionAction({
    type: "token",
    summary: `Removed all tokens (${removedQuantity})`,
    payload: {
      quantity: removedQuantity,
      tokenStacks: tokenStacks.map((permanent) => ({
        id: permanent.id,
        name: permanent.name,
        quantity: permanent.quantity,
      })),
    },
  });

  state = {
    ...state,
    boardState: removeTokenStacksFromBoardState(state.boardState, new Set(tokenStacks.map((permanent) => permanent.id))),
  };

  persistState();
  render();
  genericTokenDialog?.close();
  showQuickToast(`Removed ${removedQuantity} token${removedQuantity === 1 ? "" : "s"}.`);
}

function promptRemoveCustomTokenAmount() {
  const tokenStacks = state.boardState.permanents.filter((permanent) => permanent.isToken);
  if (tokenStacks.length === 0) {
    showQuickToast("No tokens to remove.");
    return;
  }

  const tokenOptions = tokenStacks
    .map((permanent, index) => `${index + 1}. ${permanent.name} x${permanent.quantity}`)
    .join("\n");
  const tokenChoice = window.prompt(`Remove from which token stack?\n\n${tokenOptions}`, "1");
  if (tokenChoice === null) {
    return;
  }

  const tokenIndex = Number(tokenChoice) - 1;
  if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokenStacks.length) {
    showQuickToast("Token selection canceled.");
    return;
  }

  const selectedToken = tokenStacks[tokenIndex];
  const amountPrompt = window.prompt(`How many ${selectedToken.name} tokens should be removed?`, "1");
  if (amountPrompt === null) {
    return;
  }

  const requestedAmount = normalizeCount(amountPrompt, 0);
  if (requestedAmount <= 0) {
    showQuickToast("Enter a token amount greater than 0.");
    return;
  }

  const removedQuantity = Math.min(requestedAmount, normalizeCount(selectedToken.quantity, 1));
  registerCompanionAction({
    type: "token",
    summary: `Removed ${removedQuantity} ${selectedToken.name} token${removedQuantity === 1 ? "" : "s"}`,
    payload: {
      id: selectedToken.id,
      name: selectedToken.name,
      quantity: removedQuantity,
    },
  });

  state = {
    ...state,
    boardState: removeTokenQuantityFromBoardState(state.boardState, selectedToken.id, removedQuantity),
  };

  persistState();
  render();
  genericTokenDialog?.close();
  showQuickToast(`Removed ${removedQuantity} ${selectedToken.name}.`);
}

function removeTokenStacksFromBoardState(boardState, tokenIds) {
  return {
    ...boardState,
    permanents: boardState.permanents.filter((permanent) => !tokenIds.has(permanent.id)),
    automationRules: boardState.automationRules.filter((rule) => !tokenIds.has(rule.sourcePermanentId)),
    automationSuggestions: boardState.automationSuggestions.filter((rule) => !tokenIds.has(rule.sourcePermanentId)),
    combatState: {
      ...boardState.combatState,
      attackerIds: boardState.combatState.attackerIds.filter((id) => !tokenIds.has(id)),
    },
  };
}

function removeTokenQuantityFromBoardState(boardState, tokenId, quantity) {
  const tokenIdsToRemove = new Set();
  const removedQuantity = Math.max(0, normalizeCount(quantity, 0));
  const nextPermanents = boardState.permanents.flatMap((permanent) => {
    if (permanent.id !== tokenId || !permanent.isToken) {
      return [permanent];
    }

    const nextQuantity = normalizeCount(permanent.quantity, 1) - removedQuantity;
    if (nextQuantity <= 0) {
      tokenIdsToRemove.add(permanent.id);
      return [];
    }

    return [
      createPermanent({
        ...permanent,
        quantity: nextQuantity,
      }),
    ];
  });

  return {
    ...boardState,
    permanents: nextPermanents,
    automationRules: boardState.automationRules.filter((rule) => !tokenIdsToRemove.has(rule.sourcePermanentId)),
    automationSuggestions: boardState.automationSuggestions.filter((rule) => !tokenIdsToRemove.has(rule.sourcePermanentId)),
    combatState: {
      ...boardState.combatState,
      attackerIds: boardState.combatState.attackerIds.filter((id) => !tokenIdsToRemove.has(id)),
    },
  };
}

function createGenericToken(source = {}) {
  const normalizedName = normalizeLabel(source.name, "");
  if (!normalizedName) {
    return null;
  }

  const manaCost = typeof source.manaCost === "string" ? source.manaCost.trim() : "";
  const typeText = normalizeLabel(source.typeText, "Token Creature");
  const notes = typeof source.notes === "string" ? source.notes.trim() : "";
  const tokenQuantity = applyTokenModifiers(normalizeCount(source.quantity, 1), state.boardState.permanents);

  const isCreatureToken = /\bcreature\b/i.test(typeText);
  return createPermanent({
    name: normalizedName,
    manaCost,
    typeLine: typeText,
    oracleText: "",
    imageUrl: "",
    cardImageUrl: "",
    power: source.power,
    toughness: source.toughness,
    quantity: tokenQuantity,
    isToken: true,
    isNonCreature: !isCreatureToken,
    isLegendary: false,
    isArtifact: /artifact/i.test(typeText),
    isCreature: isCreatureToken,
    plusOneCounters: 0,
    doublesTokens: false,
    createsTokens: false,
    addsCounters: false,
    isExpanded: false,
    isSelected: false,
    summoningSickness: isCreatureToken,
    notes,
  });
}

function getSupportDestinationLabel(permanent) {
  return permanent.isNonCreature ? "Non-Creature Permanents" : "Battlefield";
}

function getEffectMetadataFromText(text) {
  return extractEffectMetadata(text);
}

function getRulesForPermanent(permanentId) {
  return state.boardState.automationRules.filter((rule) => rule.sourcePermanentId === permanentId);
}

function getSuggestionsForPermanent(permanentId) {
  return state.boardState.automationSuggestions.filter((rule) => rule.sourcePermanentId === permanentId);
}

function filterAutomationSuggestionsAgainstRules(activeRules, suggestionRules) {
  const activeRuleKeys = new Set((activeRules || []).map((rule) => getAutomationRuleKey(rule)));
  return (suggestionRules || []).filter((rule) => !activeRuleKeys.has(getAutomationRuleKey(rule)));
}

function attachAutomationSuggestions(boardState, sourcePermanentId, sourceCardName, suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return boardState;
  }

  const preparedRules = suggestions.map((suggestion) =>
    createAutomationRule({
      ...suggestion,
      sourcePermanentId,
      sourceCardName,
    })
  );

  const activeCandidates = preparedRules.filter((rule) => rule.enabled);
  const pendingCandidates = preparedRules.filter((rule) => !rule.enabled);
  const activeMerge = mergeAutomationRules(boardState.automationRules, activeCandidates);
  const pendingMerge = mergeAutomationRules(
    filterAutomationSuggestionsAgainstRules(activeMerge.rules, boardState.automationSuggestions),
    pendingCandidates
  );
  const linkedRuleIds = [...activeMerge.ruleIds, ...pendingMerge.ruleIds];

  return {
    ...boardState,
    automationRules: activeMerge.rules,
    automationSuggestions: pendingMerge.rules,
    permanents: boardState.permanents.map((permanent) => {
      if (permanent.id !== sourcePermanentId) {
        return permanent;
      }

      return createPermanent({
        ...permanent,
        automationRules: Array.from(new Set([...(permanent.automationRules || []), ...linkedRuleIds])),
        autoRulesEnabled: activeMerge.ruleIds.length > 0,
      });
    }),
  };
}

function mergeAutomationRules(existingRules, incomingRules) {
  const byKey = new Map(existingRules.map((rule) => [getAutomationRuleKey(rule), rule]));
  const nextRules = [...existingRules];
  const ruleIds = [];

  incomingRules.forEach((rule) => {
    const normalizedRule = createAutomationRule(rule);
    const key = getAutomationRuleKey(normalizedRule);
    const existingRule = byKey.get(key);
    if (existingRule) {
      ruleIds.push(existingRule.id);
      return;
    }

    nextRules.push(normalizedRule);
    byKey.set(key, normalizedRule);
    ruleIds.push(normalizedRule.id);
  });

  return {
    rules: nextRules,
    ruleIds: Array.from(new Set(ruleIds)),
  };
}

function getAutomationRuleKey(rule) {
  return [
    rule.sourcePermanentId,
    rule.triggerType,
    rule.phase,
    rule.eventType,
    rule.eventSourceScope,
    rule.actionType,
    rule.targetType,
    rule.value,
    rule.tokenName,
    rule.tokenPower,
    rule.tokenToughness,
    rule.tokenTapped ? "tapped" : "untapped",
    rule.tokenAttacking ? "attacking" : "notattacking",
    rule.valueMode,
    rule.counterType,
    rule.buffPower,
    rule.buffToughness,
    rule.buffDuration,
  ].join("|");
}

function executeActiveAutomationRules(boardState, context = {}) {
  if (!boardState.automationEnabled) {
    return boardState;
  }

  const rules = collectMatchingAutomationRules(boardState, context);
  if (rules.length === 0) {
    return boardState;
  }

  let nextBoardState = boardState;
  let undoSnapshot = null;
  const logEntries = [];

  rules.forEach((rule) => {
    const executionCount = getAutomationExecutionCount(rule, nextBoardState, context);
    for (let index = 0; index < executionCount; index += 1) {
      const autoByAdhd = isDeterministicAdhdAutomationRule(rule, context);
      const confirmationStatus = shouldConfirmAutomationRule(rule, context)
        ? confirmAutomationRule(rule)
          ? "Confirmed"
          : "Skipped"
        : autoByAdhd
          ? "Auto (ADHD)"
          : "Auto";

      if (confirmationStatus === "Skipped") {
        logEntries.push(
          createAutomationLogEntry({
            id: createId(),
            timestamp: Date.now(),
            sourceCardName: rule.sourceCardName,
            actionSummary: "Automation skipped by player confirmation.",
            modifierSummary: "",
            confirmationStatus,
            detailSummary: rule.reasonSummary,
          })
        );
        continue;
      }

      const result = executeAutomationRule(rule, nextBoardState, context);
      if (!result.changed) {
        continue;
      }

      if (!undoSnapshot) {
        undoSnapshot = cloneBoardStateForUndo(nextBoardState);
      }

      nextBoardState = result.boardState;
      logEntries.push(
        createAutomationLogEntry({
          id: createId(),
          timestamp: Date.now(),
          sourceCardName: rule.sourceCardName,
          actionSummary: result.message || getAutomationRuleSummary(rule),
          modifierSummary: result.modifierSummary || "",
          confirmationStatus,
          detailSummary: rule.reasonSummary,
        })
      );
    }
  });

  if (!undoSnapshot) {
    return nextBoardState;
  }

  return {
    ...nextBoardState,
    lastAutomationUndo: undoSnapshot,
    automationLog: [...logEntries, ...nextBoardState.automationLog].slice(0, MAX_AUTOMATION_LOG_ENTRIES),
  };
}

function collectMatchingAutomationRules(boardState, context = {}) {
  const currentPhase = context.phase || PHASES[boardState.currentPhaseIndex];
  const activeRules = boardState.automationRules.filter((rule) => rule.enabled);
  const removedRulePool = Array.isArray(context.removedAutomationRules) ? context.removedAutomationRules : [];
  const allRules = [...activeRules, ...removedRulePool];
  const eventPermanent = context.eventPermanent || context.sourcePermanent || context.removedPermanent || null;

  return allRules.filter((rule) => {
    if (!rule.enabled || rule.actionType === "Board Buff" || rule.actionType === "Modify Token Amount" || rule.actionType === "Modify Counter Amount") {
      return false;
    }

    if (context.eventType === "ETB") {
      return rule.eventType === "ETB" && matchesAutomationEventSource(rule, context, eventPermanent, boardState);
    }

    if (context.eventType === "Phase") {
      return rule.eventType === "Phase" && normalizePhase(rule.phase) === normalizePhase(currentPhase);
    }

    if (context.eventType === "Attack") {
      return rule.eventType === "Attack";
    }

    if (context.eventType === "OnDeath" || context.eventType === "OnSacrifice" || context.eventType === "OnExile") {
      return rule.eventType === context.eventType && matchesAutomationEventSource(rule, context, eventPermanent, boardState);
    }

    return false;
  }).sort(compareAutomationRuleOrder);
}

function compareAutomationRuleOrder(left, right) {
  const sourceCompare = String(left.sourcePermanentId || "").localeCompare(String(right.sourcePermanentId || ""));
  if (sourceCompare !== 0) {
    return sourceCompare;
  }

  return getAutomationActionPriority(left.actionType) - getAutomationActionPriority(right.actionType);
}

function getAutomationActionPriority(actionType) {
  const normalizedAction = normalizeAutomationAction(actionType);
  if (normalizedAction === "Add +1/+1 Counters" || normalizedAction === "Add Counters") {
    return 10;
  }
  if (normalizedAction === "Create Tokens") {
    return 20;
  }
  if (normalizedAction === "Multiply Tokens") {
    return 30;
  }
  if (normalizedAction === "Apply Temporary Buff") {
    return 40;
  }
  return 50;
}

function matchesAutomationEventSource(rule, context = {}, eventPermanent = null, boardState = null) {
  const scope = normalizeAutomationEventSourceScope(rule?.eventSourceScope) || inferLegacyEventSourceScope(rule, boardState);
  const sourcePermanentId = rule?.sourcePermanentId || "";
  const eventSourceId = context.sourcePermanentId || eventPermanent?.id || "";

  if (scope === "self") {
    return sourcePermanentId === eventSourceId;
  }

  if (!eventPermanent) {
    return false;
  }

  if (scope === "any-creature") {
    return Boolean(eventPermanent.isCreature);
  }

  if (scope === "another-creature") {
    return Boolean(eventPermanent.isCreature) && eventPermanent.id !== sourcePermanentId;
  }

  if (scope === "any-token") {
    return Boolean(eventPermanent.isToken);
  }

  if (scope === "another-token") {
    return Boolean(eventPermanent.isToken) && eventPermanent.id !== sourcePermanentId;
  }

  if (scope === "any-enchantment") {
    return hasTypeLine(eventPermanent.typeLine || "", "Enchantment");
  }

  if (scope === "another-enchantment") {
    return hasTypeLine(eventPermanent.typeLine || "", "Enchantment") && eventPermanent.id !== sourcePermanentId;
  }

  if (scope === "any-permanent") {
    return true;
  }

  if (scope === "another-permanent") {
    return eventPermanent.id !== sourcePermanentId;
  }

  return sourcePermanentId === eventSourceId;
}

function inferLegacyEventSourceScope(rule, boardState) {
  if (!boardState || !rule?.sourcePermanentId) {
    return "self";
  }

  const sourcePermanent = boardState.permanents.find((permanent) => permanent.id === rule.sourcePermanentId);
  if (!sourcePermanent) {
    return "self";
  }

  const referenceText = getPermanentReferenceText(sourcePermanent);
  if (rule.eventType === "ETB") {
    if (
      referenceText.includes("whenever another enchantment enters") ||
      referenceText.includes("whenever an enchantment enters") ||
      referenceText.includes("whenever one or more enchantments enter")
    ) {
      return referenceText.includes("another enchantment enters") ? "another-enchantment" : "any-enchantment";
    }

    if (
      referenceText.includes("whenever another creature enters") ||
      referenceText.includes("whenever a creature enters") ||
      referenceText.includes("whenever a creature token enters") ||
      referenceText.includes("whenever one or more creatures enter") ||
      referenceText.includes("whenever one or more creature tokens enter") ||
      referenceText.includes("whenever creature tokens enter")
    ) {
      return referenceText.includes("another creature enters") ? "another-creature" : "any-creature";
    }
    if (
      referenceText.includes("whenever another token enters") ||
      referenceText.includes("whenever a token enters") ||
      referenceText.includes("whenever one or more tokens enter")
    ) {
      return referenceText.includes("another token enters") ? "another-token" : "any-token";
    }
    if (referenceText.includes("whenever another permanent enters") || referenceText.includes("whenever a permanent enters")) {
      return referenceText.includes("another permanent enters") ? "another-permanent" : "any-permanent";
    }
  }

  if (rule.eventType === "OnDeath") {
    if (
      referenceText.includes("whenever another creature dies") ||
      referenceText.includes("whenever a creature dies") ||
      referenceText.includes("whenever one or more creatures die")
    ) {
      return referenceText.includes("another creature dies") ? "another-creature" : "any-creature";
    }
  }

  if (rule.eventType === "OnSacrifice") {
    if (referenceText.includes("whenever a creature is sacrificed") || referenceText.includes("whenever you sacrifice a creature")) {
      return "any-creature";
    }
    if (referenceText.includes("whenever a permanent is sacrificed") || referenceText.includes("whenever you sacrifice a permanent")) {
      return "any-permanent";
    }
  }

  if (rule.eventType === "OnExile") {
    if (referenceText.includes("whenever a creature is exiled") || referenceText.includes("whenever a creature leaves")) {
      return "any-creature";
    }
    if (referenceText.includes("whenever a permanent is exiled") || referenceText.includes("whenever a permanent leaves")) {
      return "any-permanent";
    }
  }

  return "self";
}

function getAutomationExecutionCount(rule, boardState, context = {}) {
  const sourcePermanent =
    context.sourcePermanent ||
    boardState.permanents.find((permanent) => permanent.id === rule.sourcePermanentId) ||
    context.removedPermanent ||
    null;

  const sourceQuantity = Math.max(1, normalizeCount(sourcePermanent?.quantity, 1));

  if (context.eventType === "ETB" || context.eventType === "OnDeath" || context.eventType === "OnSacrifice" || context.eventType === "OnExile") {
    return Math.max(1, normalizeCount(context.instancesAdded || context.instancesRemoved || 1, 1));
  }

  if (context.eventType === "Phase") {
    return sourceQuantity;
  }

  if (context.eventType === "Attack") {
    const attackerIds = Array.isArray(context.attackerIds) ? context.attackerIds : [];
    switch (rule.triggerType) {
      case "Attack":
      case "attack-self":
        return attackerIds.includes(rule.sourcePermanentId) ? sourceQuantity : 0;
      default:
        return attackerIds.length > 0 ? sourceQuantity : 0;
    }
  }

  return 1;
}

function executeAutomationRule(rule, boardState, context = {}) {
  const sourcePermanent =
    boardState.permanents.find((permanent) => permanent.id === rule.sourcePermanentId) ||
    context.sourcePermanent ||
    context.removedPermanent ||
    null;
  const eventPermanent = context.eventPermanent || context.sourcePermanent || context.removedPermanent || null;
  const triggerLike = {
    ...rule,
    target: rule.targetType,
  };
  return executeTrigger(triggerLike, boardState, {
    ...context,
    eventPermanent,
    sourcePermanent,
    sourcePermanentId: rule.sourcePermanentId,
    attachedToId: sourcePermanent?.attachedToId || "",
  });
}

function shouldConfirmAutomationRule(rule, context = {}) {
  const companionSettings = state.companion?.settings || {};
  const adhdModeEnabled = Boolean(companionSettings.adhdMode);
  const autoResolveDeterministic = companionSettings.autoResolveDeterministic !== false;
  if (adhdModeEnabled && autoResolveDeterministic && isDeterministicAdhdAutomationRule(rule, context)) {
    return false;
  }

  return rule.askBeforeRun || rule.confidence !== "High";
}

function isDeterministicAdhdAutomationRule(rule, context = {}) {
  if (!rule || rule.confidence !== "High" || rule.askBeforeRun || rule.requiresTargetSelection) {
    return false;
  }

  const actionType = normalizeAutomationAction(rule.actionType);
  if (!["Create Tokens", "Multiply Tokens", "Add +1/+1 Counters", "Add Counters"].includes(actionType)) {
    return false;
  }

  const targetType = normalizeAutomationTarget(rule.targetType);
  if (targetType === "Selected" || targetType.includes("Target")) {
    return false;
  }

  const eventType = normalizeLabel(context.eventType, "");
  if (!["ETB", "Phase", "Attack", "OnDeath", "OnSacrifice", "OnExile"].includes(eventType)) {
    return false;
  }

  return true;
}

function confirmAutomationRule(rule) {
  return window.confirm(
    `${rule.sourceCardName}\n\n${getAutomationRuleSummary(rule)}\n\n${rule.reasonSummary || "Automation rule ready to resolve."}\n\nSources: ${summarizeRulesSources(
      getRulesReferenceEntries(rule)
    ) || "Oracle Text"}`
  );
}

function cloneBoardStateForUndo(boardState) {
  return normalizeBoardStateSnapshot(boardState);
}

function updateBoardPermanent(boardState, permanentId, updater) {
  return {
    ...boardState,
    permanents: boardState.permanents.map((permanent) => {
      if (permanent.id !== permanentId) {
        return permanent;
      }

      return createPermanent(updater(permanent));
    }),
  };
}

function buildManualTypeLine({ isLegendary, isArtifact, isCreature, isNonCreature, isToken }) {
  const parts = [];

  if (isLegendary) {
    parts.push("Legendary");
  }

  if (isArtifact) {
    parts.push("Artifact");
  }

  if (isToken) {
    parts.push("Token");
  }

  if (isCreature) {
    parts.push("Creature");
  } else if (isNonCreature) {
    parts.push("Non-Creature Permanent");
  } else {
    parts.push("Permanent");
  }

  return parts.join(" ");
}

function getFallbackTypeLine(permanent) {
  return buildManualTypeLine({
    isLegendary: permanent.isLegendary,
    isArtifact: permanent.isArtifact,
    isCreature: permanent.isCreature,
    isNonCreature: permanent.isNonCreature,
    isToken: permanent.isToken,
  });
}

function executeTrigger(trigger, boardState, context = {}) {
  const sourcePermanent =
    context.sourcePermanent ||
    boardState.permanents.find((permanent) => permanent.id === (trigger.sourcePermanentId || context.sourcePermanentId)) ||
    context.removedPermanent ||
    null;
  const targetLabel = trigger.targetType || trigger.target || "All";

  switch (trigger.actionType) {
    case "Create Tokens": {
      const resolvedTokenCount = resolveTriggeredValue(trigger, boardState, sourcePermanent);
      if (!trigger.tokenName || resolvedTokenCount <= 0) {
        return { boardState, changed: false, message: "", modifierSummary: "" };
      }

      const tokenResult = applyTokenModifiersDetailed(resolvedTokenCount, boardState.permanents);
      const fallbackEntryProfile = extractTokenEntryProfile(getPermanentReferenceText(sourcePermanent));
      const tokenAttacking = Boolean(trigger.tokenAttacking || fallbackEntryProfile.attacking);
      const tokenTapped = Boolean(trigger.tokenTapped || tokenAttacking || fallbackEntryProfile.tapped);
      const tokenPermanent = createPermanent({
        name: trigger.tokenName,
        manaCost: trigger.tokenManaCost,
        typeLine: tokenAttacking ? "Token Creature Attacking" : "Token Creature",
        oracleText: "",
        imageUrl: "",
        cardImageUrl: "",
        power: trigger.tokenPower,
        toughness: trigger.tokenToughness,
        quantity: tokenResult.value,
        isToken: true,
        isNonCreature: false,
        isLegendary: false,
        isArtifact: false,
        isCreature: true,
        plusOneCounters: 0,
        doublesTokens: false,
        doublesCounters: false,
        counterModifierBonus: 0,
        createsTokens: false,
        addsCounters: false,
        staticBuffPower: 0,
        staticBuffToughness: 0,
        staticBuffAppliesTo: "",
        staticBuffExcludesSelf: false,
        staticBuffRules: [],
        isExpanded: false,
        isSelected: false,
        isTapped: tokenTapped,
        isAttacking: tokenAttacking,
        summoningSickness: true,
      });
      const addResult = addOrStackPermanentDetailed(boardState, tokenPermanent);
      const etbResolvedBoardState = executeEnterBattlefieldAutomation(
        addResult.boardState,
        addResult.permanentId,
        addResult.instancesAdded
      );
      const combatAwareBoardState =
        tokenAttacking && addResult.permanentId
          ? addCombatAttackerId(etbResolvedBoardState, addResult.permanentId)
          : etbResolvedBoardState;

      return {
        boardState: combatAwareBoardState,
        changed: true,
        message: `${sourcePermanent?.name || "Automation"} created ${tokenResult.value} ${trigger.tokenName} token${tokenResult.value === 1 ? "" : "s"}${tokenAttacking ? " tapped and attacking" : tokenTapped ? " tapped" : ""}.`,
        modifierSummary: summarizeModifierList(tokenResult.modifiers, "No token modifiers applied."),
      };
    }

    case "Multiply Tokens": {
      const tokenTargets = getTargets(targetLabel, boardState.permanents, context).filter(
        (permanent) => permanent.isToken
      );

      if (tokenTargets.length === 0) {
        return { boardState, changed: false, message: "", modifierSummary: "" };
      }

      let nextBoardState = boardState;
      let totalCreated = 0;
      const targetIds = tokenTargets.map((permanent) => permanent.id);
      targetIds.forEach((targetId) => {
        const targetPermanent = nextBoardState.permanents.find((permanent) => permanent.id === targetId);
        if (!targetPermanent || !targetPermanent.isToken) {
          return;
        }

        const createdQuantity = applyTokenModifiersDetailed(targetPermanent.quantity, nextBoardState.permanents);
        const increment = normalizeCount(createdQuantity.value);
        if (increment <= 0) {
          return;
        }

        totalCreated += increment;
        nextBoardState = {
          ...nextBoardState,
          permanents: nextBoardState.permanents.map((permanent) => {
            if (permanent.id !== targetId) {
              return permanent;
            }

            return createPermanent({
              ...permanent,
              quantity: permanent.quantity + increment,
            });
          }),
        };
        nextBoardState = executeEnterBattlefieldAutomation(nextBoardState, targetId, increment);
      });

      if (totalCreated <= 0) {
        return { boardState, changed: false, message: "", modifierSummary: "" };
      }

      return {
        boardState: nextBoardState,
        changed: true,
        message: `${sourcePermanent?.name || "Automation"} multiplied ${tokenTargets.length} token stack${tokenTargets.length === 1 ? "" : "s"} and created ${totalCreated} token${totalCreated === 1 ? "" : "s"}.`,
        modifierSummary: "Token multiplication applied to supported token stacks.",
      };
    }

    case "Add +1/+1 Counters":
    case "Add Counters":
      return executeCounterPlacementTrigger(trigger, boardState, context, sourcePermanent, targetLabel);

    case "Apply Temporary Buff":
      return executeTemporaryBuffTrigger(trigger, boardState, context, sourcePermanent, targetLabel);

    default:
      return { boardState, changed: false, message: "", modifierSummary: "" };
  }
}

function executeCounterPlacementTrigger(trigger, boardState, context = {}, sourcePermanent = null, targetLabel = "All") {
  const needsManualTarget = trigger.requiresTargetSelection && targetLabel === "Selected";
  const resolvedSourcePermanent =
    sourcePermanent ||
    context.sourcePermanent ||
    boardState.permanents.find((permanent) => permanent.id === context.sourcePermanentId) ||
    null;
  const counterTargetEntity = resolveCounterTargetEntity(trigger, targetLabel, resolvedSourcePermanent);
  const canAutoResolveSelfTarget =
    needsManualTarget &&
    context.skipTargetSelection &&
    Boolean(resolvedSourcePermanent) &&
    hasSelfCounterTargetReference(getPermanentReferenceText(resolvedSourcePermanent), resolvedSourcePermanent.name);

  if (needsManualTarget && context.skipTargetSelection && !canAutoResolveSelfTarget) {
    return { boardState, changed: false, message: "", modifierSummary: "" };
  }

  const counterTargets = (
    canAutoResolveSelfTarget
      ? [resolvedSourcePermanent]
      : needsManualTarget
        ? resolveManualAutomationTargets(boardState, resolvedSourcePermanent, trigger, context)
        : getTargets(targetLabel, boardState.permanents, {
            ...context,
            counterTargetEntity,
          })
  ).filter((permanent) => canPermanentReceiveCounterFromRule(permanent, resolvedSourcePermanent, trigger, counterTargetEntity));

  if (counterTargets.length === 0 || trigger.value <= 0) {
    return { boardState, changed: false, message: "", modifierSummary: "" };
  }

  const counterResult = applyCounterModifiersDetailed(trigger.value, boardState.permanents);
  const counterType = normalizeCounterType(trigger.counterType || (trigger.actionType === "Add +1/+1 Counters" ? "+1/+1" : "Generic"));
  const targetIds = new Set(counterTargets.map((permanent) => permanent.id));

  return {
    boardState: {
      ...boardState,
      permanents: boardState.permanents.map((permanent) => {
        if (!targetIds.has(permanent.id)) {
          return permanent;
        }

        return applyCounterToPermanent(permanent, counterType, counterResult.value);
      }),
    },
    changed: true,
    message: `${resolvedSourcePermanent?.name || "Automation"} added ${counterResult.value} ${counterType} counter${counterResult.value === 1 ? "" : "s"}.`,
    modifierSummary: summarizeModifierList(counterResult.modifiers, "No counter modifiers applied."),
  };
}

function executeTemporaryBuffTrigger(trigger, boardState, context = {}, sourcePermanent = null, targetLabel = "All") {
  const needsManualTarget = trigger.requiresTargetSelection && targetLabel === "Selected";
  if (needsManualTarget && context.skipTargetSelection) {
    return { boardState, changed: false, message: "", modifierSummary: "" };
  }

  const targetEntity = normalizeCounterTargetEntity(trigger.counterTargetEntity) || "creature";
  const temporaryBuffTargets = (
    needsManualTarget
      ? resolveManualAutomationTargets(boardState, sourcePermanent, trigger, {
          ...context,
          counterTargetEntity: targetEntity,
        })
      : getTargets(targetLabel, boardState.permanents, {
          ...context,
          counterTargetEntity: targetEntity,
        })
  ).filter((permanent) => (targetEntity === "creature" ? permanent.isCreature : true));

  if (temporaryBuffTargets.length === 0) {
    return { boardState, changed: false, message: "", modifierSummary: "" };
  }

  const buffPower = normalizeSignedCount(trigger.buffPower);
  const buffToughness = normalizeSignedCount(trigger.buffToughness);
  if (buffPower === 0 && buffToughness === 0) {
    return { boardState, changed: false, message: "", modifierSummary: "" };
  }

  const duration = normalizeAutomationBuffDuration(trigger.buffDuration);
  const targetIds = new Set(temporaryBuffTargets.map((permanent) => permanent.id));

  return {
    boardState: {
      ...boardState,
      permanents: boardState.permanents.map((permanent) => {
        if (!targetIds.has(permanent.id)) {
          return permanent;
        }

        const nextPermanent = {
          ...permanent,
          temporaryPowerUntilTurnEnd: normalizeSignedCount(permanent.temporaryPowerUntilTurnEnd),
          temporaryToughnessUntilTurnEnd: normalizeSignedCount(permanent.temporaryToughnessUntilTurnEnd),
          temporaryPowerUntilCombatEnd: normalizeSignedCount(permanent.temporaryPowerUntilCombatEnd),
          temporaryToughnessUntilCombatEnd: normalizeSignedCount(permanent.temporaryToughnessUntilCombatEnd),
        };

        if (duration === "until-end-of-combat") {
          nextPermanent.temporaryPowerUntilCombatEnd += buffPower;
          nextPermanent.temporaryToughnessUntilCombatEnd += buffToughness;
        } else {
          nextPermanent.temporaryPowerUntilTurnEnd += buffPower;
          nextPermanent.temporaryToughnessUntilTurnEnd += buffToughness;
        }

        return createPermanent(nextPermanent);
      }),
    },
    changed: true,
    message: `${sourcePermanent?.name || "Automation"} applied ${buffPower >= 0 ? "+" : ""}${buffPower}/${buffToughness >= 0 ? "+" : ""}${buffToughness} ${duration === "until-end-of-combat" ? "until end of combat" : "until end of turn"}.`,
    modifierSummary: "Temporary stat effect applied.",
  };
}

function applyCounterToPermanent(permanent, rawCounterType, amount) {
  const counterType = normalizeCounterType(rawCounterType);
  const counterAmount = Math.max(0, normalizeCount(amount));
  if (!counterType || counterAmount <= 0) {
    return createPermanent(permanent);
  }

  const counters = normalizePermanentCounters(permanent.counters);
  const nextPermanent = {
    ...permanent,
    plusOneCounters: normalizeCount(permanent.plusOneCounters),
    minusOneCounters: normalizeCount(permanent.minusOneCounters),
    counters,
  };

  if (counterType === "+1/+1") {
    nextPermanent.plusOneCounters += counterAmount;
    const cancellationCount = Math.min(nextPermanent.plusOneCounters, nextPermanent.minusOneCounters);
    if (cancellationCount > 0) {
      nextPermanent.plusOneCounters -= cancellationCount;
      nextPermanent.minusOneCounters -= cancellationCount;
    }
    if (nextPermanent.plusOneCounters > 0) {
      nextPermanent.counters["+1/+1"] = nextPermanent.plusOneCounters;
    } else {
      delete nextPermanent.counters["+1/+1"];
    }
    if (nextPermanent.minusOneCounters > 0) {
      nextPermanent.counters["-1/-1"] = nextPermanent.minusOneCounters;
    } else {
      delete nextPermanent.counters["-1/-1"];
    }
    return createPermanent(nextPermanent);
  }

  if (counterType === "-1/-1") {
    nextPermanent.minusOneCounters += counterAmount;
    const cancellationCount = Math.min(nextPermanent.plusOneCounters, nextPermanent.minusOneCounters);
    if (cancellationCount > 0) {
      nextPermanent.plusOneCounters -= cancellationCount;
      nextPermanent.minusOneCounters -= cancellationCount;
    }
    if (nextPermanent.plusOneCounters > 0) {
      nextPermanent.counters["+1/+1"] = nextPermanent.plusOneCounters;
    } else {
      delete nextPermanent.counters["+1/+1"];
    }
    if (nextPermanent.minusOneCounters > 0) {
      nextPermanent.counters["-1/-1"] = nextPermanent.minusOneCounters;
    } else {
      delete nextPermanent.counters["-1/-1"];
    }
    return createPermanent(nextPermanent);
  }

  const currentCount = normalizeCount(nextPermanent.counters[counterType]);
  nextPermanent.counters[counterType] = currentCount + counterAmount;
  return createPermanent(nextPermanent);
}

function executeEventTriggers(eventName, boardState, context = {}) {
  const manualBoardState = boardState.triggers.reduce((nextBoardState, trigger) => {
    if (trigger.triggerEvent !== eventName) {
      return nextBoardState;
    }

    if (eventName === "Phase" && trigger.phase !== context.phase) {
      return nextBoardState;
    }

    const result = executeTrigger(trigger, nextBoardState, context);
    return result.boardState;
  }, boardState);

  return executeActiveAutomationRules(manualBoardState, {
    ...context,
    eventType: eventName,
  });
}

function getTargets(target, permanents, context = {}) {
  const selectedIds = new Set(context.selectedIds ?? getSelectedPermanentIds(permanents));
  const attackerIds = Array.isArray(context.attackerIds) ? context.attackerIds : [];
  const normalizedTarget = normalizeBoardTarget(target);
  return permanents.filter((permanent) =>
    matchesPermanentTarget(permanent, normalizedTarget, selectedIds, {
      ...context,
      attackerIds,
    })
  );
}

function applyTokenModifiers(quantity, permanents) {
  return applyTokenModifiersDetailed(quantity, permanents).value;
}

function addOrStackPermanentDetailed(boardState, permanent) {
  const shouldDefaultSummoningSickness =
    permanent?.summoningSickness === undefined &&
    (permanent?.isCreature === true || (permanent?.isCreature !== false && !permanent?.isNonCreature));
  const nextPermanent = createPermanent({
    ...permanent,
    summoningSickness:
      permanent?.summoningSickness === undefined
        ? shouldDefaultSummoningSickness
        : Boolean(permanent?.summoningSickness),
  });

  if (nextPermanent.isNonCreature) {
    return {
      boardState: {
        ...boardState,
        permanents: [...boardState.permanents, nextPermanent],
      },
      permanentId: nextPermanent.id,
      instancesAdded: nextPermanent.quantity,
      wasStacked: false,
    };
  }

  const stackKey = getPermanentStackKey(nextPermanent);
  const existingIndex = boardState.permanents.findIndex((entry) => {
    return !entry.isNonCreature && getPermanentStackKey(entry) === stackKey;
  });

  if (existingIndex < 0) {
    return {
      boardState: {
        ...boardState,
        permanents: [...boardState.permanents, nextPermanent],
      },
      permanentId: nextPermanent.id,
      instancesAdded: nextPermanent.quantity,
      wasStacked: false,
    };
  }

  const existingPermanent = boardState.permanents[existingIndex];
  const nextSummoningState = Boolean(existingPermanent.summoningSickness || nextPermanent.summoningSickness);
  return {
    boardState: {
      ...boardState,
      permanents: boardState.permanents.map((entry, index) => {
        if (index !== existingIndex) {
          return entry;
        }

        return createPermanent({
          ...entry,
          quantity: entry.quantity + nextPermanent.quantity,
          summoningSickness: nextSummoningState,
        });
      }),
    },
    permanentId: existingPermanent.id,
    instancesAdded: nextPermanent.quantity,
    wasStacked: true,
  };
}

function addOrStackPermanent(boardState, permanent) {
  return addOrStackPermanentDetailed(boardState, permanent).boardState;
}

function removePermanent(boardState, permanentId) {
  const removedPermanent = boardState.permanents.find((permanent) => permanent.id === permanentId);
  if (!removedPermanent) {
    return { boardState, removedPermanent: null, removedStackFully: false };
  }

  const removedStackFully = removedPermanent.quantity <= 1;
  return {
    removedPermanent,
    removedStackFully,
    boardState: {
      ...boardState,
      permanents: boardState.permanents.flatMap((permanent) => {
        if (permanent.id !== permanentId) {
          return [
            createPermanent({
              ...permanent,
              isSelected: false,
              attachedToId: permanent.attachedToId === permanentId ? "" : permanent.attachedToId,
            }),
          ];
        }

        if (removedStackFully) {
          return [];
        }

        return [
          createPermanent({
            ...permanent,
            quantity: permanent.quantity - 1,
            isSelected: false,
          }),
        ];
      }),
      automationRules: removedStackFully
        ? boardState.automationRules.filter((rule) => rule.sourcePermanentId !== permanentId)
        : boardState.automationRules,
      automationSuggestions: removedStackFully
        ? boardState.automationSuggestions.filter((rule) => rule.sourcePermanentId !== permanentId)
        : boardState.automationSuggestions,
    },
  };
}

function removePermanentInstance(permanentId) {
  const removalResult = removePermanent(state.boardState, permanentId);
  if (!removalResult.removedPermanent) {
    return;
  }

  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };

  state = {
    ...state,
    commander: syncCommanderStateAfterPermanentRemoval(state.commander, removalResult.removedPermanent),
    boardState: removalResult.boardState,
  };

  persistState();
  render();
  showQuickToast(`Removed 1 ${removalResult.removedPermanent.name}.`);
}

function applyPermanentRemoval(permanentId, removalType) {
  const removalOutcome = applyPermanentRemovalToBoardState(state.boardState, permanentId, removalType);
  if (!removalOutcome.changed) {
    return;
  }
  registerCompanionAction({
    type: "remove",
    summary: `${removalType}: ${removalOutcome.removedPermanent?.name || "Permanent"}`,
    payload: {
      permanentId,
      removalType,
      name: removalOutcome.removedPermanent?.name || "",
    },
  });

  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };

  state = {
    ...state,
    commander: syncCommanderStateAfterPermanentRemoval(state.commander, removalOutcome.removedPermanent),
    boardState: removalOutcome.boardState,
  };

  persistState();
  render();
}

function syncCommanderStateAfterPermanentRemoval(commanderState, removedPermanent) {
  const commander = normalizeCommanderState(commanderState);
  if (!removedPermanent?.isCommander) {
    return commander;
  }

  return normalizeCommanderState({
    ...commander,
    zone: "command",
  });
}

function applyPermanentRemovalToBoardState(boardState, permanentId, removalType) {
  const selectedIds = getSelectedPermanentIds(boardState.permanents);
  const removalResult = removePermanent(boardState, permanentId);

  if (!removalResult.removedPermanent) {
    return { boardState, changed: false };
  }

  let nextBoardState = removalResult.boardState;
  const removedAutomationRules = boardState.automationRules.filter((rule) => rule.sourcePermanentId === permanentId);
  const triggerContext = {
    selectedIds,
    removedPermanent: removalResult.removedPermanent,
    eventPermanent: removalResult.removedPermanent,
    sourcePermanentId: permanentId,
    removedAutomationRules,
    instancesRemoved: 1,
  };

  if (removalType === "destroy") {
    nextBoardState = executeEventTriggers("OnDeath", nextBoardState, triggerContext);
    nextBoardState = executeEventTriggers("OnSacrifice", nextBoardState, triggerContext);
  }

  if (removalType === "sacrifice") {
    nextBoardState = executeEventTriggers("OnSacrifice", nextBoardState, triggerContext);
  }

  if (removalType === "exile") {
    nextBoardState = executeEventTriggers("OnExile", nextBoardState, triggerContext);
  }

  return {
    boardState: nextBoardState,
    removedPermanent: removalResult.removedPermanent,
    changed: true,
  };
}

function destroyAllMatchingPermanents(destroyOption) {
  const targets = getBulkDestroyTargets(destroyOption, state.boardState.permanents);
  if (targets.length === 0) {
    bulkRemoveDialog.close();
    return;
  }

  let nextBoardState = state.boardState;
  for (const target of targets) {
    for (let instanceIndex = 0; instanceIndex < target.quantity; instanceIndex += 1) {
      const removalOutcome = applyPermanentRemovalToBoardState(nextBoardState, target.id, "destroy");
      if (!removalOutcome.changed) {
        break;
      }

      nextBoardState = removalOutcome.boardState;
    }
  }

  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };

  state = {
    ...state,
    commander: targets.some((target) => target.isCommander)
      ? normalizeCommanderState({ ...state.commander, zone: "command" })
      : state.commander,
    boardState: nextBoardState,
  };

  bulkRemoveDialog.close();
  persistState();
  render();
}

function getBulkDestroyTargets(destroyOption, permanents) {
  return permanents.filter((permanent) => matchesBulkDestroyOption(permanent, destroyOption));
}

function matchesBulkDestroyOption(permanent, destroyOption) {
  const normalizedTypeLine = (permanent.typeLine || "").toLowerCase();

  switch (destroyOption) {
    case "creatures":
      return permanent.isCreature;
    case "tokens":
      return permanent.isToken;
    case "non-creature-permanents":
      return permanent.isNonCreature;
    case "artifacts":
      return permanent.isArtifact;
    case "enchantments":
      return normalizedTypeLine.includes("enchantment");
    case "legendary-creatures":
      return permanent.isCreature && permanent.isLegendary;
    case "non-legendary-creatures":
      return permanent.isCreature && !permanent.isLegendary;
    default:
      return false;
  }
}

function normalizeBoardTarget(target) {
  const normalizedTarget = normalizeLabel(target, "All");
  return TRIGGER_TARGETS.includes(normalizedTarget) ? normalizedTarget : normalizedTarget;
}

function resolveManualAutomationTargets(boardState, sourcePermanent, trigger, context = {}) {
  const targetLabel = trigger.targetType || trigger.target || "Selected";
  const counterTargetEntity = resolveCounterTargetEntity(trigger, targetLabel, sourcePermanent);
  const targetIds = promptForCounterTarget(
    boardState.permanents,
    sourcePermanent || createPermanent({ name: trigger.sourceCardName || "Automation" }),
    {
      targetMode: trigger.targetMode || "manual",
      counterTargetEntity,
      optionalTarget: Boolean(trigger.optionalTarget),
    }
  );
  const targetIdSet = new Set(targetIds);
  return boardState.permanents.filter((permanent) => targetIdSet.has(permanent.id));
}

function matchesPermanentTarget(permanent, target, selectedIds, context = {}) {
  const attackerIds = new Set(context.attackerIds || []);

  switch (target) {
    case "Self":
      return permanent.id === context.sourcePermanentId;
    case "All Creatures":
      return permanent.isCreature;
    case "All Creature Tokens":
      return permanent.isCreature && permanent.isToken;
    case "All Attackers":
      return permanent.isCreature && attackerIds.has(permanent.id);
    case "All Permanents":
      return true;
    case "Board":
      return normalizeCounterTargetEntity(context.counterTargetEntity) === "permanent" ? true : permanent.isCreature;
    case "Attached Permanent":
      return permanent.id === context.attachedToId;
    case "All Tokens":
    case "Tokens Only":
      return permanent.isToken;
    case "Non-Tokens Only":
      return !permanent.isToken;
    case "All Artifacts":
      return permanent.isArtifact;
    case "All Enchantments":
      return hasTypeLine(permanent.typeLine || "", "Enchantment");
    case "All Planeswalkers":
      return hasTypeLine(permanent.typeLine || "", "Planeswalker");
    case "All Lands":
      return hasTypeLine(permanent.typeLine || "", "Land");
    case "All Nonbasic Lands":
      return hasTypeLine(permanent.typeLine || "", "Land") && !hasTypeLine(permanent.typeLine || "", "Basic");
    case "All Auras":
      return hasTypeLine(permanent.typeLine || "", "Aura");
    case "All Vehicles":
      return hasTypeLine(permanent.typeLine || "", "Vehicle");
    case "All Spacecraft":
      return hasTypeLine(permanent.typeLine || "", "Spacecraft");
    case "All Mounts":
      return hasTypeLine(permanent.typeLine || "", "Mount");
    case "All Planets":
      return hasTypeLine(permanent.typeLine || "", "Planet");
    case "Legendary Only":
      return permanent.isLegendary;
    case "Non-Legendary Only":
      return !permanent.isLegendary;
    case "Artifact Only":
      return permanent.isArtifact;
    case "Artifact Creature Only":
      return permanent.isArtifact && permanent.isCreature;
    case "Selected":
      return selectedIds.has(permanent.id);
    case "All":
    default:
      return true;
  }
}

function canPermanentReceiveCounterFromRule(permanent, sourcePermanent, trigger, targetEntity) {
  if (!permanent) {
    return false;
  }

  const targetLabel = trigger?.targetType || trigger?.target || "";
  if (targetLabel === "Self" || trigger?.targetMode === "self") {
    return Boolean(sourcePermanent) && permanent.id === sourcePermanent.id;
  }

  return targetEntity === "creature" ? permanent.isCreature : true;
}

function resolveCounterTargetEntity(trigger, targetLabel, sourcePermanent) {
  const explicitEntity = normalizeCounterTargetEntity(trigger?.counterTargetEntity);
  if (explicitEntity) {
    return explicitEntity;
  }

  const mode = normalizeLabel(trigger?.targetMode, "").toLowerCase();
  const counterType = normalizeCounterType(trigger?.counterType);
  if (mode.includes("permanent")) {
    return "permanent";
  }
  if (mode.includes("creature") || mode === "all-attackers" || mode === "all-creatures" || mode === "self") {
    return "creature";
  }

  if (counterType === "+1/+1" || counterType === "-1/-1") {
    if (targetLabel === "Self" && sourcePermanent && !sourcePermanent.isCreature) {
      return "permanent";
    }
    return "creature";
  }

  if (targetLabel === "All Creatures" || targetLabel === "All Attackers" || targetLabel === "Artifact Creature Only") {
    return "creature";
  }

  const referenceText = getPermanentReferenceText(sourcePermanent);
  if (hasPermanentCounterTargetReference(referenceText)) {
    return "permanent";
  }
  if (hasCreatureCounterTargetReference(referenceText)) {
    return "creature";
  }

  if (targetLabel === "Selected") {
    return "permanent";
  }

  if (targetLabel === "Board" || targetLabel === "Attached Permanent") {
    return "creature";
  }

  return "permanent";
}

function hasPermanentCounterTargetReference(text) {
  const normalizedText = normalizeCounterReferenceText(text);
  if (!normalizedText) {
    return false;
  }

  return (
    normalizedText.includes("target permanent") ||
    normalizedText.includes("another target permanent") ||
    normalizedText.includes("up to one target permanent") ||
    normalizedText.includes("each permanent") ||
    normalizedText.includes("permanents you control") ||
    normalizedText.includes("permanent you control")
  );
}

function hasCreatureCounterTargetReference(text) {
  const normalizedText = normalizeCounterReferenceText(text);
  if (!normalizedText) {
    return false;
  }

  return (
    normalizedText.includes("target creature") ||
    normalizedText.includes("another target creature") ||
    normalizedText.includes("up to one target creature") ||
    normalizedText.includes("each creature") ||
    normalizedText.includes("creatures you control")
  );
}

function getTokenMultiplier(permanents) {
  return applyTokenModifiersDetailed(1, permanents).value;
}

function getPermanentStackKey(permanent) {
  return [
    permanent.name.trim().toLowerCase(),
    permanent.manaCost.trim().toLowerCase(),
    permanent.power,
    permanent.toughness,
    permanent.isToken ? "token" : "nontoken",
    permanent.isNonCreature ? "effect" : "creature",
    permanent.isLegendary ? "legendary" : "nonlegendary",
    permanent.isArtifact ? "artifact" : "nonartifact",
    permanent.isCreature ? "creatureflag" : "noncreatureflag",
    permanent.isFaceDown ? "facedown" : "faceup",
    permanent.isTapped ? "tapped" : "untapped",
    permanent.isAttacking ? "attacking" : "notattacking",
  ].join("|");
}

function addCombatAttackerId(boardState, permanentId) {
  if (!permanentId) {
    return boardState;
  }

  const currentCombatState = normalizeCombatState(boardState.combatState);
  return {
    ...boardState,
    combatState: {
      ...currentCombatState,
      attackerIds: Array.from(new Set([...(currentCombatState.attackerIds || []), permanentId])),
      mode: currentCombatState.mode === "none" ? "selected" : currentCombatState.mode,
      summary: currentCombatState.summary || "A token entered tapped and attacking.",
      confirmed: currentCombatState.confirmed,
    },
  };
}

function bindBoardInteractionTargets(container) {
  if (!container) {
    return;
  }

  container.querySelectorAll("[data-board-action][data-permanent-id]").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleBoardAction(button.dataset.boardAction, button.dataset.permanentId);
    };
  });
}

function handleBoardAction(action, permanentId) {
  if (!action || !permanentId) {
    return;
  }

  if (action === "toggle-select") {
    togglePermanentSelection(permanentId);
    return;
  }

  if (action === "toggle-expand") {
    togglePermanentExpanded(permanentId);
    return;
  }

  if (action === "open-detail") {
    openCardDetailOverlay(permanentId);
    return;
  }

  if (action === "toggle-menu") {
    togglePermanentMenu(permanentId);
    return;
  }

  if (action === "tap" || action === "untap") {
    setPermanentTappedState(permanentId, action === "tap");
    return;
  }

  if (action === "loyalty-plus" || action === "loyalty-minus") {
    adjustPlaneswalkerLoyalty(permanentId, action === "loyalty-plus" ? 1 : -1);
    return;
  }

  if (action === "loyalty-activate") {
    activatePlaneswalkerLoyalty(permanentId);
    return;
  }

  if (action === "planeswalker-damage") {
    promptPlaneswalkerDamage(permanentId);
    return;
  }

  if (action === "remove") {
    removePermanentInstance(permanentId);
    return;
  }

  if (action === "destroy" || action === "exile" || action === "sacrifice") {
    applyPermanentRemoval(permanentId, action);
  }
}

function togglePermanentSelection(permanentId) {
  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };
  updatePermanent(permanentId, (permanent) => ({
    ...permanent,
    isSelected: !permanent.isSelected,
  }));
}

function togglePermanentExpanded(permanentId) {
  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };
  updatePermanent(permanentId, (permanent) => ({
    ...permanent,
    isExpanded: !permanent.isExpanded,
  }));
}

function setAllPermanentsExpanded(isExpanded) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      permanents: state.boardState.permanents.map((permanent) => ({
        ...permanent,
        isExpanded,
      })),
    },
  };

  persistState();
  render();
}

function openCardDetailOverlay(permanentId) {
  const permanent = state.boardState.permanents.find((entry) => entry.id === permanentId);
  if (!permanent) {
    return;
  }

  boardUi = {
    ...boardUi,
    detailPermanentId: permanentId,
    detailDialogPermanentId: permanentId,
    activeMenuPermanentId: "",
  };
  renderCardDetailOverlay();
}

function beginCombatSimulation(mode) {
  const attackerIds =
    mode === "selected"
      ? getSelectedCreatureIds(state.boardState.permanents)
      : getAllCreatureIds(state.boardState.permanents);

  if (attackerIds.length === 0) {
    registerCompanionAction({
      type: "combat",
      summary: `Combat prep (${mode}) found no legal attackers`,
      payload: { mode },
      includeUndo: false,
    });
    state = {
      ...state,
      boardState: {
        ...state.boardState,
        combatState: {
          attackerIds: [],
          mode,
          summary: "No creatures available for that attack mode.",
          confirmed: false,
        },
      },
    };
    persistState();
    render();
    return;
  }

  const attackerPreview = calculateCombatPreview({
    attackers: state.boardState.permanents.filter((permanent) => attackerIds.includes(permanent.id)),
    blockers: [],
  });
  registerCompanionAction({
    type: "combat",
    summary: `Combat prep (${mode}) ${attackerPreview.attackerTotal.power}/${attackerPreview.attackerTotal.toughness}`,
    payload: { mode, attackerIds, preview: attackerPreview },
  });

  state = {
    ...state,
    boardState: {
      ...state.boardState,
      combatState: {
        attackerIds,
        mode,
        summary: "Attackers ready. Confirm Combat to tap legal attackers and resolve supported combat triggers.",
        confirmed: false,
      },
    },
  };

  persistState();
  render();
}

function confirmCombatSimulation() {
  const preparedAttackerIds = state.boardState.combatState.attackerIds.filter((attackerId) => {
    const permanent = state.boardState.permanents.find((entry) => entry.id === attackerId);
    return canPermanentAttack(permanent);
  });

  if (preparedAttackerIds.length === 0) {
    registerCompanionAction({
      type: "combat",
      summary: "Combat confirm failed (no legal attackers)",
      payload: {},
      includeUndo: false,
    });
    state = {
      ...state,
      boardState: {
        ...state.boardState,
        combatState: {
          ...state.boardState.combatState,
          attackerIds: [],
          summary: "No legal untapped attackers are ready to confirm.",
          confirmed: false,
        },
      },
    };
    persistState();
    render();
    return;
  }

  const tapResult = tapAttackersForCombat(state.boardState, preparedAttackerIds);
  const automationResult = executeCombatTriggers(tapResult.boardState, preparedAttackerIds);
  const multiplayerCombatResult = resolveCombatAgainstActiveOpponent(automationResult.boardState);
  const tapSummaryParts = [];

  if (tapResult.tappedCount > 0) {
    tapSummaryParts.push(
      `Tapped ${tapResult.tappedCount} attacker${tapResult.tappedCount === 1 ? "" : "s"} for combat.`
    );
  }

  if (tapResult.exemptCount > 0) {
    tapSummaryParts.push(
      `${tapResult.exemptCount} attacker${tapResult.exemptCount === 1 ? "" : "s"} stayed untapped due to vigilance or explicit attack text.`
    );
  }

  const automationSummary = [...automationResult.messages, multiplayerCombatResult.message].filter(Boolean).join(" ");
  registerCompanionAction({
    type: "combat",
    summary: `Combat confirmed with ${preparedAttackerIds.length} attacker${preparedAttackerIds.length === 1 ? "" : "s"}`,
    payload: {
      attackers: preparedAttackerIds,
      blockers: multiplayerCombatResult.blockerIds,
      tapped: tapResult.tappedCount,
      vigilant: tapResult.exemptCount,
      automationSummary,
      preview: multiplayerCombatResult.preview,
    },
  });

  state = {
    ...state,
    multiplayer: multiplayerCombatResult.multiplayer || state.multiplayer,
    commander: multiplayerCombatResult.commander || state.commander,
    boardState: {
      ...automationResult.boardState,
      combatState: {
        attackerIds: preparedAttackerIds,
        mode: state.boardState.combatState.mode,
        summary: [tapSummaryParts.join(" "), automationSummary]
          .filter(Boolean)
          .join(" ")
          .trim() || "Combat confirmed. Supported attack triggers resolved.",
        confirmed: true,
      },
    },
  };
  persistState();
  render();
}

function clearCombatAttackers() {
  registerCompanionAction({
    type: "combat",
    summary: "Cleared combat attackers",
    payload: {},
  });
  const clearedBoardState = clearCombatEngagementFlags(state.boardState);
  state = {
    ...state,
    boardState: {
      ...clearedBoardState,
      combatState: createDefaultCombatState(),
    },
  };
  persistState();
  render();
}

function resolveCombatAgainstActiveOpponent(boardState) {
  const opponent = getActiveViewedOpponent();
  if (!opponent?.publicBoardState) {
    return {
      multiplayer: state.multiplayer,
      message: "",
      blockerIds: [],
      preview: null,
    };
  }

  const viewerBoardState = createViewerBoardState(opponent.publicBoardState, opponent.permissions);
  const attackerIds = normalizeCombatState(boardState.combatState).attackerIds || [];
  const attackers = boardState.permanents.filter((permanent) => attackerIds.includes(permanent.id) && permanent.isCreature);
  const blockers = viewerBoardState.permanents.filter((permanent) => permanent.isCreature);
  const attackerTotals = calculateAbsoluteBoardTotals(attackers, boardState.permanents);
  const blockerTotals = calculateAbsoluteBoardTotals(blockers, viewerBoardState.permanents);
  const trampleOverflow = estimateTrampleCombatDamage(attackers, blockerTotals.toughness, boardState.permanents);
  const estimatedDamage =
    blockers.length > 0
      ? Math.max(0, attackerTotals.power - blockerTotals.toughness, trampleOverflow)
      : Math.max(0, attackerTotals.power);
  const commanderDamage = estimateCommanderCombatDamage(attackers, blockers, blockerTotals.toughness, boardState.permanents, estimatedDamage);

  if (estimatedDamage <= 0) {
    return {
      multiplayer: state.multiplayer,
      message: `${opponent.displayName} prevented the simulated combat damage.`,
      blockerIds: blockers.map((permanent) => permanent.id),
      preview: {
        attackerTotal: attackerTotals,
        blockerTotal: blockerTotals,
        netPressure: attackerTotals.power - blockerTotals.toughness,
      },
    };
  }

  const nextConnectedPlayers = state.multiplayer.connectedPlayers.map((player) => {
    if (player.id !== opponent.id) {
      return player;
    }

    return createConnectedPlayer({
      ...player,
      lastUpdated: Date.now(),
      publicTrackerState: {
        ...player.publicTrackerState,
        life: Math.max(0, normalizeCount(player.publicTrackerState.life, 0) - estimatedDamage),
        commanderDamage:
          commanderDamage > 0
            ? addPublicCommanderDamage(player.publicTrackerState.commanderDamage, getActiveCommanderName(), commanderDamage)
            : player.publicTrackerState.commanderDamage,
      },
    });
  });
  const nextCommander =
    commanderDamage > 0
      ? normalizeCommanderState({
          ...state.commander,
          damageByOpponent: {
            ...(state.commander?.damageByOpponent || {}),
            [opponent.id]: normalizeCount(state.commander?.damageByOpponent?.[opponent.id], 0) + commanderDamage,
          },
        })
      : state.commander;

  return {
    multiplayer: {
      ...state.multiplayer,
      connectedPlayers: nextConnectedPlayers,
    },
    commander: nextCommander,
    message: `Simulated ${estimatedDamage} combat damage to ${opponent.displayName}.${commanderDamage > 0 ? ` Commander damage +${commanderDamage}.` : ""}`,
    blockerIds: blockers.map((permanent) => permanent.id),
    preview: {
      attackerTotal: attackerTotals,
      blockerTotal: blockerTotals,
      netPressure: attackerTotals.power - blockerTotals.toughness,
      estimatedDamage,
      commanderDamage,
    },
  };
}

function estimateCommanderCombatDamage(attackers, blockers, blockerToughness, sourcePermanents, estimatedDamage) {
  const commanderAttackers = attackers.filter((permanent) => permanent.isCommander);
  if (commanderAttackers.length === 0 || estimatedDamage <= 0) {
    return 0;
  }

  const commanderPower = commanderAttackers.reduce(
    (total, permanent) => total + getPermanentCurrentPower(permanent, sourcePermanents) * normalizeCount(permanent.quantity, 1),
    0
  );
  const trampleCommanderPower = commanderAttackers
    .filter((permanent) => getPermanentReferenceText(permanent).includes("trample"))
    .reduce((total, permanent) => total + getPermanentCurrentPower(permanent, sourcePermanents) * normalizeCount(permanent.quantity, 1), 0);

  if (blockers.length === 0) {
    return Math.min(commanderPower, estimatedDamage);
  }

  return Math.min(Math.max(0, trampleCommanderPower - normalizeCount(blockerToughness, 0)), estimatedDamage);
}

function addPublicCommanderDamage(entries = [], label, damage) {
  const normalizedLabel = normalizeLabel(label, "Commander");
  const damageAmount = normalizeCount(damage, 0);
  const list = Array.isArray(entries) ? entries : [];
  let updated = false;
  const nextEntries = list.map((entry) => {
    if (normalizeLabel(entry?.label, "") !== normalizedLabel) {
      return entry;
    }
    updated = true;
    return {
      ...entry,
      label: normalizedLabel,
      value: normalizeCount(entry?.value, 0) + damageAmount,
    };
  });

  return updated
    ? nextEntries
    : [
        ...nextEntries,
        {
          label: normalizedLabel,
          value: damageAmount,
        },
      ];
}

function estimateTrampleCombatDamage(attackers, blockerToughness, sourcePermanents = state.boardState.permanents) {
  const tramplePower = attackers
    .filter((permanent) => getPermanentReferenceText(permanent).includes("trample"))
    .reduce((sum, permanent) => sum + getPermanentCurrentPower(permanent, sourcePermanents) * normalizeCount(permanent.quantity, 1), 0);
  return Math.max(0, tramplePower - normalizeCount(blockerToughness, 0));
}

function setPermanentTappedState(permanentId, isTapped) {
  const permanent = state.boardState.permanents.find((entry) => entry.id === permanentId);
  if (permanent && permanent.isTapped !== isTapped) {
    registerCompanionAction({
      type: "tap",
      summary: `${isTapped ? "Tapped" : "Untapped"} ${permanent.name}`,
      payload: { permanentId, isTapped },
    });
  }
  boardUi = {
    ...boardUi,
    activeMenuPermanentId: "",
  };
  updatePermanent(permanentId, (permanent) => ({
    ...permanent,
    isTapped,
  }));
}

function adjustPlaneswalkerLoyalty(permanentId, delta) {
  const permanent = state.boardState.permanents.find((entry) => entry.id === permanentId);
  if (!permanent?.isPlaneswalker) {
    return;
  }

  const currentLoyalty = getPermanentCounterValue(permanent, "Loyalty");
  const nextLoyalty = Math.max(0, currentLoyalty + normalizeSignedCount(delta));
  registerCompanionAction({
    type: "planeswalker",
    summary: `${permanent.name} loyalty ${nextLoyalty - currentLoyalty >= 0 ? "+" : ""}${nextLoyalty - currentLoyalty}`,
    payload: { permanentId, from: currentLoyalty, to: nextLoyalty },
  });
  setPermanentCounterValue(permanentId, "Loyalty", nextLoyalty);
}

function activatePlaneswalkerLoyalty(permanentId) {
  const permanent = state.boardState.permanents.find((entry) => entry.id === permanentId);
  if (!permanent?.isPlaneswalker) {
    return;
  }

  if (permanent.loyaltyActivatedTurn === state.runtime.turnNumber) {
    showQuickToast(`${permanent.name} already used a loyalty ability this turn.`);
    return;
  }

  const costPrompt = window.prompt("Loyalty ability cost (+1, 0, -2, etc.)", "+1");
  if (costPrompt === null) {
    return;
  }

  const delta = normalizeSignedCount(costPrompt, 0);
  const currentLoyalty = getPermanentCounterValue(permanent, "Loyalty");
  if (currentLoyalty + delta < 0) {
    showQuickToast("Not enough loyalty counters.");
    return;
  }

  registerCompanionAction({
    type: "planeswalker",
    summary: `${permanent.name} loyalty ability ${delta >= 0 ? "+" : ""}${delta}`,
    payload: { permanentId, cost: delta, turnNumber: state.runtime.turnNumber },
  });

  state = {
    ...state,
    boardState: {
      ...state.boardState,
      permanents: state.boardState.permanents.map((entry) => {
        if (entry.id !== permanentId) {
          return createPermanent(entry);
        }
        const nextPermanent = setCounterOnPermanent(entry, "Loyalty", currentLoyalty + delta);
        return createPermanent({
          ...nextPermanent,
          loyaltyActivatedTurn: state.runtime.turnNumber,
        });
      }),
    },
  };

  persistState();
  render();
}

function promptPlaneswalkerDamage(permanentId) {
  const permanent = state.boardState.permanents.find((entry) => entry.id === permanentId);
  if (!permanent?.isPlaneswalker) {
    return;
  }

  const damagePrompt = window.prompt("Damage dealt to this planeswalker", "1");
  if (damagePrompt === null) {
    return;
  }

  const damage = normalizeCount(damagePrompt, 0);
  if (damage <= 0) {
    return;
  }

  adjustPlaneswalkerLoyalty(permanentId, -damage);
}

function setPermanentCounterValue(permanentId, counterType, value) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      permanents: state.boardState.permanents.map((permanent) =>
        permanent.id === permanentId ? setCounterOnPermanent(permanent, counterType, value) : createPermanent(permanent)
      ),
    },
  };

  persistState();
  render();
}

function setCounterOnPermanent(permanent, rawCounterType, value) {
  const counterType = normalizeCounterType(rawCounterType);
  const counters = normalizePermanentCounters(permanent.counters);
  const nextValue = Math.max(0, normalizeCount(value, 0));
  if (nextValue > 0) {
    counters[counterType] = nextValue;
  } else {
    delete counters[counterType];
  }

  return createPermanent({
    ...permanent,
    counters,
    plusOneCounters: counterType === "+1/+1" ? nextValue : permanent.plusOneCounters,
    minusOneCounters: counterType === "-1/-1" ? nextValue : permanent.minusOneCounters,
  });
}

function updatePermanent(permanentId, updater) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      permanents: state.boardState.permanents.map((permanent) => {
        if (permanent.id !== permanentId) {
          return permanent;
        }

        return createPermanent(updater(permanent));
      }),
    },
  };

  persistState();
  render();
}

function getPermanentCurrentPower(permanent, permanents = state.boardState.permanents) {
  return calculatePermanentPowerToughness(permanent, permanents).power;
}

function getPermanentCurrentToughness(permanent, permanents = state.boardState.permanents) {
  return calculatePermanentPowerToughness(permanent, permanents).toughness;
}

function calculateBoardTotals(permanents) {
  const selectedPermanents = permanents.filter((permanent) => permanent.isSelected);
  const activePermanents = selectedPermanents.length > 0 ? selectedPermanents : permanents;

  return calculateAbsoluteBoardTotals(activePermanents, permanents);
}

function calculateAbsoluteBoardTotals(permanentsToCount, sourcePermanents = permanentsToCount) {
  return permanentsToCount.reduce(
    (totals, permanent) => {
      if (!permanent.isCreature) {
        return totals;
      }

      const currentPower = getPermanentCurrentPower(permanent, sourcePermanents);
      const currentToughness = getPermanentCurrentToughness(permanent, sourcePermanents);

      return {
        power: totals.power + currentPower * permanent.quantity,
        toughness: totals.toughness + currentToughness * permanent.quantity,
      };
    },
    { power: 0, toughness: 0 }
  );
}

function getBoardTotals(permanents) {
  return calculateBoardTotals(permanents);
}

function getSelectedPermanentIds(permanents) {
  return permanents.filter((permanent) => permanent.isSelected).map((permanent) => permanent.id);
}

function canPermanentAttack(permanent) {
  if (!permanent || !permanent.isCreature || permanent.isTapped) {
    return false;
  }

  if (!permanent.summoningSickness) {
    return true;
  }

  return hasSummoningSicknessExemption(permanent);
}

function getSelectedCreatureIds(permanents) {
  return permanents
    .filter((permanent) => permanent.isSelected && canPermanentAttack(permanent))
    .map((permanent) => permanent.id);
}

function getAllCreatureIds(permanents) {
  return permanents.filter((permanent) => canPermanentAttack(permanent)).map((permanent) => permanent.id);
}

function getPermanentReferenceText(permanent) {
  const oracleText = typeof permanent?.oracleText === "string" ? permanent.oracleText.trim() : "";
  const notes = typeof permanent?.notes === "string" ? permanent.notes.trim() : "";
  const rulingsText = Array.isArray(permanent?.rulings)
    ? permanent.rulings.map((entry) => entry?.comment || "").join(" ")
    : "";

  return [oracleText, notes, rulingsText].filter(Boolean).join(" ").toLowerCase();
}

function getCardReferenceText(card) {
  const preview = getCardPreview(card);
  return [preview.oracleText, card?.notes].filter(Boolean).join(" ").toLowerCase();
}

function hasAttackTapExemption(permanent) {
  const referenceText = getPermanentReferenceText(permanent);
  return referenceText.includes("vigilance") || (referenceText.includes("doesn't tap") && referenceText.includes("attack"));
}

function hasSummoningSicknessExemption(permanent) {
  const referenceText = getPermanentReferenceText(permanent);
  return referenceText.includes("haste") || referenceText.includes("can attack as though it had haste");
}

function hasPersistentFloatingManaEffects(permanents = []) {
  return permanents.some((permanent) => {
    const text = getPermanentReferenceText(permanent);
    return (
      text.includes("mana doesn't empty") ||
      text.includes("mana doesn't empty as steps and phases end") ||
      text.includes("this mana doesn't empty")
    );
  });
}

function tapAttackersForCombat(boardState, attackerIds) {
  const attackerIdSet = new Set(attackerIds);
  let tappedCount = 0;
  let exemptCount = 0;

  return {
    boardState: {
      ...boardState,
      permanents: boardState.permanents.map((permanent) => {
        if (!permanent.isCreature) {
          return createPermanent({
            ...permanent,
            isAttacking: false,
          });
        }

        if (!attackerIdSet.has(permanent.id)) {
          return createPermanent({
            ...permanent,
            isAttacking: false,
          });
        }

        if (hasAttackTapExemption(permanent)) {
          exemptCount += 1;
          return createPermanent({
            ...permanent,
            isAttacking: true,
          });
        }

        if (permanent.isTapped) {
          return createPermanent({
            ...permanent,
            isAttacking: true,
          });
        }

        tappedCount += 1;
        return createPermanent({
          ...permanent,
          isTapped: true,
          isAttacking: true,
        });
      }),
    },
    tappedCount,
    exemptCount,
  };
}

function untapAllPermanents(boardState) {
  return {
    ...boardState,
    permanents: boardState.permanents.map((permanent) =>
      permanent.isTapped || permanent.summoningSickness || permanent.loyaltyActivatedTurn
        ? createPermanent({
            ...permanent,
            isTapped: false,
            summoningSickness: false,
            loyaltyActivatedTurn: 0,
          })
        : createPermanent(permanent)
    ),
  };
}

function calculatePowerToughness(permanents) {
  return calculateAbsoluteBoardTotals(
    permanents.filter((permanent) => permanent.isCreature),
    permanents
  );
}

function clearTemporaryBuffsByDuration(boardState, duration) {
  return {
    ...boardState,
    permanents: boardState.permanents.map((permanent) => {
      const nextPermanent = {
        ...permanent,
        temporaryPowerUntilTurnEnd: normalizeSignedCount(permanent.temporaryPowerUntilTurnEnd),
        temporaryToughnessUntilTurnEnd: normalizeSignedCount(permanent.temporaryToughnessUntilTurnEnd),
        temporaryPowerUntilCombatEnd: normalizeSignedCount(permanent.temporaryPowerUntilCombatEnd),
        temporaryToughnessUntilCombatEnd: normalizeSignedCount(permanent.temporaryToughnessUntilCombatEnd),
      };

      if (duration === "until-end-of-combat" || duration === "all") {
        nextPermanent.temporaryPowerUntilCombatEnd = 0;
        nextPermanent.temporaryToughnessUntilCombatEnd = 0;
      }

      if (duration === "until-end-of-turn" || duration === "all") {
        nextPermanent.temporaryPowerUntilTurnEnd = 0;
        nextPermanent.temporaryToughnessUntilTurnEnd = 0;
      }

      return createPermanent(nextPermanent);
    }),
  };
}

function clearCombatEngagementFlags(boardState) {
  return {
    ...boardState,
    permanents: boardState.permanents.map((permanent) =>
      permanent.isAttacking || permanent.isBlocking
        ? createPermanent({
            ...permanent,
            isAttacking: false,
            isBlocking: false,
          })
        : createPermanent(permanent)
    ),
  };
}

function runStateBasedActions(boardState) {
  const permanents = Array.isArray(boardState?.permanents) ? boardState.permanents : [];
  const removedIds = new Set(
    permanents
      .filter(
        (permanent) =>
          (permanent.isCreature && calculatePermanentPowerToughness(permanent, permanents).toughness <= 0) ||
          (permanent.isPlaneswalker && getPermanentCounterValue(permanent, "Loyalty") <= 0)
      )
      .map((permanent) => permanent.id)
  );

  if (removedIds.size === 0) {
    return {
      boardState,
      changed: false,
    };
  }

  const combatState = normalizeCombatState(boardState.combatState);
  return {
    changed: true,
    boardState: {
      ...boardState,
      permanents: permanents
        .filter((permanent) => !removedIds.has(permanent.id))
        .map((permanent) =>
          createPermanent({
            ...permanent,
            attachedToId: removedIds.has(permanent.attachedToId) ? "" : permanent.attachedToId,
            isSelected: false,
          })
        ),
      automationRules: boardState.automationRules.filter((rule) => !removedIds.has(rule.sourcePermanentId)),
      automationSuggestions: boardState.automationSuggestions.filter((rule) => !removedIds.has(rule.sourcePermanentId)),
      combatState: {
        ...combatState,
        attackerIds: combatState.attackerIds.filter((id) => !removedIds.has(id)),
      },
    },
  };
}

function calculateSelectedPowerToughness(permanents) {
  return calculateAbsoluteBoardTotals(
    permanents.filter((permanent) => permanent.isCreature && permanent.isSelected),
    permanents
  );
}

function calculateCombatTotals(permanents, attackerIds) {
  const attackerIdSet = new Set(attackerIds);
  return calculateAbsoluteBoardTotals(
    permanents.filter((permanent) => attackerIdSet.has(permanent.id) && permanent.isCreature),
    permanents
  );
}

function compareBoardTotals({ localTotals, opponentPermanents }) {
  const opponentTotals = calculateAbsoluteBoardTotals(
    opponentPermanents.filter((permanent) => permanent.isCreature),
    opponentPermanents
  );

  return {
    local: localTotals,
    opponent: opponentTotals,
    difference: {
      power: localTotals.power - opponentTotals.power,
      toughness: localTotals.toughness - opponentTotals.toughness,
    },
  };
}

function getActiveViewedOpponent() {
  return state.multiplayer.connectedPlayers.find((player) => player.id === multiplayerUi.activePlayerId) || null;
}

function updateAutomationRule(ruleId, updater) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      automationRules: state.boardState.automationRules.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }

        return createAutomationRule(updater(rule));
      }),
    },
  };
  persistState();
  render();
}

function updateAutomationSuggestion(ruleId, updater) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      automationSuggestions: state.boardState.automationSuggestions.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }

        return createAutomationRule(updater(rule));
      }),
    },
  };
  persistState();
  render();
}

function removeAutomationRule(ruleId) {
  const rule = state.boardState.automationRules.find((entry) => entry.id === ruleId);
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      automationRules: state.boardState.automationRules.filter((rule) => rule.id !== ruleId),
      permanents: state.boardState.permanents.map((permanent) =>
        createPermanent({
          ...permanent,
          automationRules: (permanent.automationRules || []).filter((id) => id !== ruleId),
          autoRulesEnabled:
            rule && permanent.id === rule.sourcePermanentId
              ? (permanent.automationRules || []).some((id) => id !== ruleId)
              : permanent.autoRulesEnabled,
        })
      ),
    },
  };
  persistState();
  render();
}

function acceptAutomationSuggestion(ruleId) {
  const rule = state.boardState.automationSuggestions.find((entry) => entry.id === ruleId);
  if (!rule) {
    return;
  }

  if (rule.confidence !== "High") {
    const confirmed = window.confirm(
      `${rule.sourceCardName}\n\nEnable this ${rule.confidence.toLowerCase()} confidence automation rule?\n\n${rule.reasonSummary || getAutomationRuleSummary(rule)}`
    );
    if (!confirmed) {
      return;
    }
  }

  const nextRule = createAutomationRule({
    ...rule,
    enabled: true,
  });

  const activeMerge = mergeAutomationRules(state.boardState.automationRules, [nextRule]);
  const acceptedRuleId = activeMerge.ruleIds[0] || nextRule.id;
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      automationRules: activeMerge.rules,
      automationSuggestions: state.boardState.automationSuggestions.filter((entry) => entry.id !== ruleId),
      permanents: state.boardState.permanents.map((permanent) => {
        if (permanent.id !== rule.sourcePermanentId) {
          return permanent;
        }

        return createPermanent({
          ...permanent,
          automationRules: Array.from(new Set([...(permanent.automationRules || []), acceptedRuleId])),
          autoRulesEnabled: true,
        });
      }),
    },
  };
  persistState();
  render();
}

function rejectAutomationSuggestion(ruleId) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      automationSuggestions: state.boardState.automationSuggestions.filter((rule) => rule.id !== ruleId),
    },
  };
  persistState();
  render();
}

function editAutomationSuggestion(ruleId) {
  const rule = state.boardState.automationSuggestions.find((entry) => entry.id === ruleId);
  if (!rule) {
    return;
  }

  const editedRule = promptEditAutomationRule(rule);
  if (!editedRule) {
    return;
  }

  updateAutomationSuggestion(ruleId, () => editedRule);
}

function forceRunAutomationRule(ruleId) {
  const rule = state.boardState.automationRules.find((entry) => entry.id === ruleId);
  if (!rule) {
    return;
  }

  const currentPhase = PHASES[state.boardState.currentPhaseIndex];
  const eventType =
    rule.eventType === "ETB" || rule.eventType === "OnDeath" || rule.eventType === "OnSacrifice" || rule.eventType === "OnExile"
      ? rule.eventType
      : rule.eventType === "Attack"
        ? "Attack"
        : "Phase";
  const executionContext = {
    eventType,
    phase: rule.phase || currentPhase,
    sourcePermanentId: rule.sourcePermanentId,
    sourcePermanent: state.boardState.permanents.find((permanent) => permanent.id === rule.sourcePermanentId) || null,
    attackerIds:
      rule.eventType === "Attack"
        ? state.boardState.combatState.attackerIds.length > 0
          ? state.boardState.combatState.attackerIds
          : getSelectedCreatureIds(state.boardState.permanents)
        : [],
    selectedIds: getSelectedPermanentIds(state.boardState.permanents),
    instancesAdded: 1,
    instancesRemoved: 1,
  };
  const result = executeAutomationRule(createAutomationRule({ ...rule, askBeforeRun: false, enabled: true }), state.boardState, executionContext);
  if (!result.changed) {
    return;
  }

  state = {
    ...state,
    boardState: {
      ...result.boardState,
      lastAutomationUndo: cloneBoardStateForUndo(state.boardState),
      automationLog: [
        createAutomationLogEntry({
          id: createId(),
          timestamp: Date.now(),
          sourceCardName: rule.sourceCardName,
          actionSummary: result.message || getAutomationRuleSummary(rule),
          modifierSummary: result.modifierSummary || "",
          confirmationStatus: "Force Run",
          detailSummary: rule.reasonSummary,
        }),
        ...state.boardState.automationLog,
      ].slice(0, MAX_AUTOMATION_LOG_ENTRIES),
    },
  };
  persistState();
  render();
}

function toggleAutomationGlobally() {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      automationEnabled: !state.boardState.automationEnabled,
    },
  };
  persistState();
  render();
}

function undoLastAutomationResult() {
  if (!state.boardState.lastAutomationUndo) {
    return;
  }

  state = {
    ...state,
    boardState: {
      ...normalizeBoardStateSnapshot(state.boardState.lastAutomationUndo),
      automationLog: state.boardState.automationLog,
      lastAutomationUndo: null,
    },
  };
  persistState();
  render();
}

function promptEditAutomationRule(rule) {
  const valuePrompt = window.prompt("Automation value", String(rule.value ?? 0));
  if (valuePrompt === null) {
    return null;
  }

  let tokenName = rule.tokenName;
  let tokenPower = rule.tokenPower;
  let tokenToughness = rule.tokenToughness;

  if (rule.actionType === "Create Tokens") {
    const tokenNamePrompt = window.prompt("Token name", rule.tokenName || "");
    if (tokenNamePrompt === null) {
      return null;
    }
    const tokenPowerPrompt = window.prompt("Token power", String(rule.tokenPower ?? 0));
    if (tokenPowerPrompt === null) {
      return null;
    }
    const tokenToughnessPrompt = window.prompt("Token toughness", String(rule.tokenToughness ?? 0));
    if (tokenToughnessPrompt === null) {
      return null;
    }
    tokenName = tokenNamePrompt;
    tokenPower = tokenPowerPrompt;
    tokenToughness = tokenToughnessPrompt;
  }

  return createAutomationRule({
    ...rule,
    value: valuePrompt,
    tokenName,
    tokenPower,
    tokenToughness,
  });
}

function removeTrigger(triggerId) {
  state = {
    ...state,
    boardState: {
      ...state.boardState,
      triggers: state.boardState.triggers.filter((trigger) => trigger.id !== triggerId),
    },
  };
  persistState();
  render();
}

function editManualTrigger(triggerId) {
  const trigger = state.boardState.triggers.find((entry) => entry.id === triggerId);
  if (!trigger) {
    return;
  }

  const nextValue = window.prompt("Trigger value", String(trigger.value));
  if (nextValue === null) {
    return;
  }

  state = {
    ...state,
    boardState: {
      ...state.boardState,
      triggers: state.boardState.triggers.map((entry) => {
        if (entry.id !== triggerId) {
          return entry;
        }

        return createTrigger({
          ...entry,
          value: nextValue,
        });
      }),
    },
  };
  persistState();
  render();
}

function executeCombatTriggers(boardState, attackerIds) {
  const attackers = boardState.permanents.filter((permanent) => attackerIds.includes(permanent.id));
  if (attackers.length === 0) {
    return {
      boardState,
      messages: [],
    };
  }

  const executionContext = {
    eventType: "Attack",
    phase: "Combat",
    attackerIds,
    selectedIds: getSelectedPermanentIds(boardState.permanents),
    skipTargetSelection: true,
  };
  const pendingManualRules = collectMatchingAutomationRules(boardState, executionContext).filter(
    (rule) => rule.requiresTargetSelection && getAutomationExecutionCount(rule, boardState, executionContext) > 0
  );
  let nextBoardState = executeActiveAutomationRules(boardState, executionContext);
  const messages = [];
  if (nextBoardState !== boardState) {
    messages.push("Active combat automation resolved.");
  }
  if (pendingManualRules.length > 0) {
    messages.push(
      `${pendingManualRules.length} combat trigger${pendingManualRules.length === 1 ? "" : "s"} still need manual targets.`
    );
  }
  const automatedRuleKeys = new Set(
    nextBoardState.automationRules
      .filter((rule) => rule.eventType === "Attack" && rule.enabled && !rule.requiresTargetSelection)
      .map((rule) => `${rule.sourcePermanentId}|${normalizeAutomationAction(rule.actionType)}`)
  );

  boardState.permanents.forEach((permanent) => {
    const rules = parseCombatAutomationRules(permanent);
    if (rules.length === 0) {
      return;
    }

    rules.forEach((rule) => {
      const ruleKey = `${permanent.id}|${normalizeAutomationAction(rule.actionType)}`;
      if (automatedRuleKeys.has(ruleKey)) {
        return;
      }

      const triggerCount = getCombatTriggerCount(rule, permanent, attackerIds);
      if (triggerCount <= 0) {
        return;
      }

      for (let index = 0; index < triggerCount; index += 1) {
        const result = applyCombatAutomationRule(nextBoardState, permanent, rule, attackerIds);
        nextBoardState = result.boardState;
        if (result.message) {
          messages.push(result.message);
        }
      }
    });
  });

  return {
    boardState: nextBoardState,
    messages,
  };
}

function parseCombatAutomationRules(permanent) {
  const oracleText = String(permanent.oracleText || permanent.notes || "").toLowerCase();
  const referenceText = getPermanentReferenceText(permanent);
  const triggerType = detectCombatTriggerType(referenceText, permanent.name);
  if (!triggerType) {
    return [];
  }

  /** @type {Array<Record<string, unknown>>} */
  const rules = [];

  if (referenceText.includes("create") && referenceText.includes("token")) {
    const tokenSpec = extractTokenSpec(oracleText || referenceText);
    const tokenEntryProfile = extractTokenEntryProfile(oracleText || referenceText);
    rules.push({
      actionType: "Create Tokens",
      triggerType,
      value: extractCountFromText(oracleText || referenceText),
      valueMode: extractValueModeFromText(oracleText || referenceText),
      tokenName: tokenSpec.name,
      tokenPower: tokenSpec.power,
      tokenToughness: tokenSpec.toughness,
      tokenManaCost: "",
      tokenTapped: tokenEntryProfile.tapped,
      tokenAttacking: tokenEntryProfile.attacking,
    });
  }

  if (hasCombatCounterPlacementLanguage(referenceText)) {
    const counterType = extractCounterTypeFromText(referenceText);
    const targetMode = extractCounterTargetMode(referenceText, permanent.name);
    rules.push({
      actionType: counterType === "+1/+1" ? "Add +1/+1 Counters" : "Add Counters",
      triggerType,
      value: extractCounterCountFromText(oracleText || referenceText),
      counterType,
      targetMode,
      counterTargetEntity: inferCounterTargetEntityFromMode(targetMode, referenceText, permanent),
      optionalTarget:
        referenceText.includes("up to one target creature") ||
        referenceText.includes("up to one target permanent") ||
        referenceText.includes("up to one target attacking creature") ||
        referenceText.includes("up to one target attacking permanent"),
    });
  }

  const temporaryBuff = extractTemporaryBuffFromText(oracleText || referenceText);
  if (temporaryBuff) {
    const targetMode = extractCounterTargetMode(referenceText, permanent.name);
    rules.push({
      actionType: "Apply Temporary Buff",
      triggerType,
      value: 0,
      targetMode,
      counterTargetEntity: inferCounterTargetEntityFromMode(targetMode, referenceText, permanent),
      buffPower: temporaryBuff.power,
      buffToughness: temporaryBuff.toughness,
      buffDuration: temporaryBuff.duration,
      optionalTarget:
        referenceText.includes("up to one target creature") ||
        referenceText.includes("up to one target permanent") ||
        referenceText.includes("up to one target attacking creature") ||
        referenceText.includes("up to one target attacking permanent"),
    });
  }

  if ((referenceText.includes("double") || referenceText.includes("twice")) && referenceText.includes("token")) {
    rules.push({
      actionType: "Multiply Tokens",
      triggerType,
    });
  }

  return rules;
}

function detectCombatTriggerType(referenceText, sourceName = "") {
  const normalizedText = normalizeCounterReferenceText(referenceText);
  if (!normalizedText.includes("whenever") || !/\battack(?:s|ing)?\b/.test(normalizedText)) {
    return "";
  }

  if (
    /whenever one or more [a-z0-9,\- ]*creatures?[a-z0-9,\- ]* attack/.test(normalizedText) ||
    /whenever you attack with one or more [a-z0-9,\- ]*creatures?/.test(normalizedText)
  ) {
    return "attack-group";
  }

  if (/whenever (?:a|another) [a-z0-9 ]*creatures?[a-z0-9 ]* attacks/.test(normalizedText)) {
    return "attack-any";
  }

  if (normalizedText.includes("equipped creature attacks")) {
    return "attack-equipped";
  }

  if (normalizedText.includes("enchanted creature attacks")) {
    return "attack-enchanted";
  }

  const normalizedName = normalizeCounterReferenceText(sourceName);
  if (
    normalizedText.includes("this creature attacks") ||
    normalizedText.includes("whenever this attacks") ||
    (normalizedName && normalizedText.includes(`${normalizedName} attacks`))
  ) {
    return "attack-self";
  }

  return "";
}

function hasCombatCounterPlacementLanguage(referenceText) {
  return (
    referenceText.includes("counter") &&
    /\bput\b|\bputs\b|\badd\b|\badds\b|\bmove\b|\bmoves\b|\bdistribute\b|\bdistributes\b/.test(referenceText)
  );
}

function getCombatTriggerCount(rule, sourcePermanent, attackerIds) {
  switch (rule.triggerType) {
    case "attack-group":
      return attackerIds.length > 0 ? 1 : 0;
    case "attack-any":
      return attackerIds.length;
    case "attack-equipped":
    case "attack-enchanted":
      return sourcePermanent.attachedToId && attackerIds.includes(sourcePermanent.attachedToId) ? 1 : 0;
    case "attack-self":
    default:
      return attackerIds.includes(sourcePermanent.id) ? 1 : 0;
  }
}

function applyCombatAutomationRule(boardState, sourcePermanent, rule, attackerIds) {
  if (rule.actionType === "Create Tokens") {
    const trigger = createTrigger({
      triggerEvent: "Phase",
      phase: "Combat",
      actionType: "Create Tokens",
      target: "All",
      value: rule.value,
      valueMode: rule.valueMode,
      tokenName: rule.tokenName,
      tokenManaCost: rule.tokenManaCost,
      tokenPower: rule.tokenPower,
      tokenToughness: rule.tokenToughness,
      tokenTapped: Boolean(rule.tokenTapped),
      tokenAttacking: Boolean(rule.tokenAttacking),
    });

    const result = executeTrigger(trigger, boardState, {
        selectedIds: attackerIds,
      });

    return {
      boardState: result.boardState,
      message: result.message || `${sourcePermanent.name} created ${rule.value} token${rule.value === 1 ? "" : "s"}.`,
    };
  }

  if (rule.actionType === "Multiply Tokens") {
    const trigger = createTrigger({
      triggerEvent: "Phase",
      phase: "Combat",
      actionType: "Multiply Tokens",
      target: "Tokens Only",
      value: 1,
    });

    return {
      boardState: executeTrigger(trigger, boardState, {
        selectedIds: attackerIds,
      }).boardState,
      message: `${sourcePermanent.name} doubled your tokens.`,
    };
  }

  if (rule.actionType === "Add +1/+1 Counters" || rule.actionType === "Add Counters") {
    const targetIds = resolveCounterAllocation(boardState, sourcePermanent, rule, attackerIds, {
      allowManualSelection: false,
    });
    if (targetIds === null) {
      return {
        boardState,
        message: `${sourcePermanent.name} needs a manual target before its combat counters can resolve.`,
      };
    }

    if (targetIds.length === 0) {
      return {
        boardState,
        message: rule.optionalTarget ? `${sourcePermanent.name} skipped its optional counter target.` : "",
      };
    }

    const counterResult = applyCounterModifiersDetailed(rule.value, boardState.permanents);
    const counterType = normalizeCounterType(rule.counterType || (rule.actionType === "Add +1/+1 Counters" ? "+1/+1" : "Generic"));
    const targetIdSet = new Set(targetIds);
    return {
      boardState: {
        ...boardState,
        permanents: boardState.permanents.map((permanent) => {
          if (!targetIdSet.has(permanent.id)) {
            return permanent;
          }

          return applyCounterToPermanent(permanent, counterType, counterResult.value);
        }),
      },
      message: `${sourcePermanent.name} added ${counterResult.value} ${counterType} counter${counterResult.value === 1 ? "" : "s"}.`,
    };
  }

  if (rule.actionType === "Apply Temporary Buff") {
    const targetIds = resolveCounterAllocation(boardState, sourcePermanent, rule, attackerIds, {
      allowManualSelection: false,
    });
    if (targetIds === null) {
      return {
        boardState,
        message: `${sourcePermanent.name} needs a manual target before its temporary buff can resolve.`,
      };
    }

    if (targetIds.length === 0) {
      return {
        boardState,
        message: rule.optionalTarget ? `${sourcePermanent.name} skipped its optional temporary buff target.` : "",
      };
    }

    const targetIdSet = new Set(targetIds);
    const buffPower = normalizeSignedCount(rule.buffPower);
    const buffToughness = normalizeSignedCount(rule.buffToughness);
    const duration = normalizeAutomationBuffDuration(rule.buffDuration);
    return {
      boardState: {
        ...boardState,
        permanents: boardState.permanents.map((permanent) => {
          if (!targetIdSet.has(permanent.id)) {
            return permanent;
          }

          const nextPermanent = {
            ...permanent,
            temporaryPowerUntilTurnEnd: normalizeSignedCount(permanent.temporaryPowerUntilTurnEnd),
            temporaryToughnessUntilTurnEnd: normalizeSignedCount(permanent.temporaryToughnessUntilTurnEnd),
            temporaryPowerUntilCombatEnd: normalizeSignedCount(permanent.temporaryPowerUntilCombatEnd),
            temporaryToughnessUntilCombatEnd: normalizeSignedCount(permanent.temporaryToughnessUntilCombatEnd),
          };

          if (duration === "until-end-of-combat") {
            nextPermanent.temporaryPowerUntilCombatEnd += buffPower;
            nextPermanent.temporaryToughnessUntilCombatEnd += buffToughness;
          } else {
            nextPermanent.temporaryPowerUntilTurnEnd += buffPower;
            nextPermanent.temporaryToughnessUntilTurnEnd += buffToughness;
          }

          return createPermanent(nextPermanent);
        }),
      },
      message: `${sourcePermanent.name} applied ${buffPower >= 0 ? "+" : ""}${buffPower}/${buffToughness >= 0 ? "+" : ""}${buffToughness} ${duration === "until-end-of-combat" ? "until end of combat" : "until end of turn"}.`,
    };
  }

  return {
    boardState,
    message: "",
  };
}

function resolveCounterAllocation(boardState, sourcePermanent, rule, attackerIds, options = {}) {
  const allowManualSelection = options.allowManualSelection !== false;
  const permanents = boardState.permanents;
  const attackerIdSet = new Set(attackerIds);
  const creatureIds = permanents.filter((permanent) => permanent.isCreature).map((permanent) => permanent.id);
  const allPermanentIds = permanents.map((permanent) => permanent.id);
  const targetEntity = resolveCounterTargetEntity(rule, "Board", sourcePermanent);

  switch (rule.targetMode) {
    case "self":
      return [sourcePermanent.id];
    case "all-attackers":
      return permanents.filter((permanent) => attackerIdSet.has(permanent.id) && permanent.isCreature).map((permanent) => permanent.id);
    case "all-creatures":
      return creatureIds;
    case "all-permanents":
      return allPermanentIds;
    case "board":
      return targetEntity === "permanent" ? allPermanentIds : creatureIds;
    case "attached":
      return sourcePermanent.attachedToId ? [sourcePermanent.attachedToId] : [];
    case "manual-other-creature":
    case "manual-creature":
    case "manual-other-permanent":
    case "manual-permanent":
      return allowManualSelection ? promptForCounterTarget(permanents, sourcePermanent, rule) : null;
    default:
      return [];
  }
}

function promptForCounterTarget(permanents, sourcePermanent, rule) {
  const targetEntity =
    normalizeCounterTargetEntity(rule?.counterTargetEntity) ||
    (String(rule?.targetMode || "").includes("permanent") ? "permanent" : "creature");
  const requiresCreatureTarget = targetEntity === "creature";
  const allowsSelf = !String(rule?.targetMode || "").includes("manual-other");
  const candidates = permanents.filter((permanent) => {
    if (requiresCreatureTarget && !permanent.isCreature) {
      return false;
    }

    if (!allowsSelf && permanent.id === sourcePermanent.id) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    return [];
  }

  const promptText = candidates
    .map((permanent, index) => `${index + 1}. ${permanent.name}`)
    .join("\n");
  const targetLabel = requiresCreatureTarget ? "creature" : "permanent";
  const response = window.prompt(
    `${sourcePermanent.name} needs a target.\nChoose a ${targetLabel} number:${rule.optionalTarget ? "\nLeave blank to skip." : ""}\n\n${promptText}`,
    rule.optionalTarget ? "" : "1"
  );

  if (response === null || (rule.optionalTarget && !response.trim())) {
    return [];
  }

  const choiceIndex = Number(response) - 1;
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= candidates.length) {
    return [];
  }

  return [candidates[choiceIndex].id];
}

function extractCounterTargetMode(oracleText, sourceName = "") {
  if (hasSelfCounterTargetReference(oracleText, sourceName)) {
    return "self";
  }

  if (
    oracleText.includes("each permanent you control") ||
    oracleText.includes("permanents you control") ||
    oracleText.includes("each permanent")
  ) {
    return "all-permanents";
  }

  if (
    oracleText.includes("each attacking creature") ||
    oracleText.includes("all attacking creatures") ||
    oracleText.includes("attacking creatures you control")
  ) {
    return "all-attackers";
  }

  if (oracleText.includes("each creature you control") || oracleText.includes("creatures you control")) {
    return "all-creatures";
  }

  if (oracleText.includes("equipped creature") || oracleText.includes("enchanted creature")) {
    return "attached";
  }

  if (oracleText.includes("another target attacking creature")) {
    return "manual-other-creature";
  }

  if (oracleText.includes("another target attacking permanent")) {
    return "manual-other-permanent";
  }

  if (oracleText.includes("up to one target attacking creature")) {
    return "manual-creature";
  }

  if (oracleText.includes("up to one target attacking permanent")) {
    return "manual-permanent";
  }

  if (oracleText.includes("target attacking creature")) {
    return "manual-creature";
  }

  if (oracleText.includes("target attacking permanent")) {
    return "manual-permanent";
  }

  if (oracleText.includes("another target creature")) {
    return "manual-other-creature";
  }

  if (oracleText.includes("another target permanent")) {
    return "manual-other-permanent";
  }

  if (oracleText.includes("target creature") || oracleText.includes("up to one target creature")) {
    return "manual-creature";
  }

  if (oracleText.includes("target permanent") || oracleText.includes("up to one target permanent")) {
    return "manual-permanent";
  }

  return "board";
}

function inferCounterTargetEntityFromMode(targetMode, referenceText = "", permanent = null) {
  if (targetMode.includes("permanent")) {
    return "permanent";
  }

  if (targetMode.includes("creature") || targetMode === "all-attackers" || targetMode === "all-creatures") {
    return "creature";
  }

  if (targetMode === "self") {
    return permanent?.isCreature ? "creature" : "permanent";
  }

  return hasPermanentCounterTargetReference(referenceText) ? "permanent" : "creature";
}

function extractCounterTypeFromText(referenceText) {
  const rawText = normalizeLabel(referenceText, "").toLowerCase();
  if (rawText.includes("+1/+1 counter") || rawText.includes("+1/+1 counters")) {
    return "+1/+1";
  }

  if (rawText.includes("-1/-1 counter") || rawText.includes("-1/-1 counters")) {
    return "-1/-1";
  }

  const normalized = normalizeCounterReferenceText(referenceText);
  if (!normalized) {
    return "Generic";
  }

  if (normalized.includes("plus 1 plus 1 counter")) {
    return "+1/+1";
  }

  if (normalized.includes("minus 1 minus 1 counter")) {
    return "-1/-1";
  }

  const match = normalized.match(/([a-z0-9]+(?:\s+[a-z0-9]+){0,2})\s+counters?\b/);
  if (!match) {
    return "Generic";
  }

  const candidate = match[1]
    .replace(/^(?:that\s+many|an?\s+additional|additional)\s+/i, "")
    .replace(/^(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+/i, "")
    .trim();
  return normalizeCounterType(candidate || "Generic");
}

function hasSelfCounterTargetReference(text, sourceName = "") {
  const normalizedText = normalizeCounterReferenceText(text);
  if (!normalizedText) {
    return false;
  }

  if (normalizedText.includes("on it") || normalizedText.includes("on itself")) {
    return true;
  }

  const normalizedName = normalizeCounterReferenceText(sourceName);
  if (!normalizedName) {
    return false;
  }

  return normalizedText.includes(`on ${normalizedName}`) || normalizedText.includes(`onto ${normalizedName}`);
}

function normalizeCounterReferenceText(value) {
  return normalizeLabel(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCounterType(value) {
  const raw = normalizeLabel(value, "").trim();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s+/g, "").toLowerCase();
  if (/^\+?1\/\+?1$/.test(compact) || compact === "plusoneplusone" || compact === "plus1plus1") {
    return "+1/+1";
  }

  if (/^-?1\/-?1$/.test(compact) || compact === "minusoneminusone" || compact === "minus1minus1") {
    return "-1/-1";
  }

  const normalized = raw
    .replace(/counter(s)?$/i, "")
    .trim()
    .replace(/[^a-z0-9]+/gi, " ")
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\s+/)
    .map((segment) => `${segment[0]?.toUpperCase() || ""}${segment.slice(1)}`)
    .join(" ");
}

function getPermanentCounterSummary(permanent) {
  const counters = normalizePermanentCounters(permanent?.counters);
  const entries = Object.entries(counters)
    .filter(([, count]) => normalizeCount(count) > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length === 0) {
    return "None";
  }

  return entries.map(([type, count]) => `${type}: ${count}`).join(" • ");
}

function extractTokenSpec(oracleText) {
  const ptMatch = oracleText.match(/(\d+)\/(\d+)/);
  const typeMatch = oracleText.match(/(?:create|creates?)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,3}?([a-z]+)\s+creature token/i);

  return {
    power: ptMatch ? normalizeSignedCount(ptMatch[1], 1) : 1,
    toughness: ptMatch ? normalizeSignedCount(ptMatch[2], 1) : 1,
    name: typeMatch ? `${normalizeLabel(typeMatch[1], "Token")} Token` : "Token",
  };
}

function extractTokenEntryProfile(oracleText) {
  const normalizedText = normalizeLabel(oracleText, "").toLowerCase();
  return {
    tapped: /\btapped\b/.test(normalizedText),
    attacking: /\battacking\b/.test(normalizedText),
  };
}

function extractValueModeFromText(oracleText) {
  const normalizedText = normalizeLabel(oracleText, "").toLowerCase();
  if (/\bwhere x is\b/.test(normalizedText) && normalizedText.includes("+1/+1 counter")) {
    return "source-plus-one-counters";
  }
  if (/\bwhere x is\b/.test(normalizedText) && normalizedText.includes("counter")) {
    return "source-counters";
  }
  return "fixed";
}

function resolveTriggeredValue(trigger, boardState, sourcePermanent = null) {
  const valueMode = normalizeValueMode(trigger.valueMode);
  if (valueMode === "source-plus-one-counters") {
    const source =
      sourcePermanent ||
      boardState.permanents.find((permanent) => permanent.id === (trigger.sourcePermanentId || trigger.sourcePermanentId));
    return Math.max(0, normalizeCount(source?.plusOneCounters, 0));
  }
  if (valueMode === "source-counters") {
    const source =
      sourcePermanent ||
      boardState.permanents.find((permanent) => permanent.id === (trigger.sourcePermanentId || trigger.sourcePermanentId));
    return Object.values(normalizePermanentCounters(source?.counters)).reduce(
      (sum, count) => sum + normalizeCount(count, 0),
      0
    );
  }
  return normalizeCount(trigger.value, 0);
}

function extractCountFromText(text) {
  const normalizedText = String(text || "").toLowerCase();
  const digitMatch = normalizedText.match(/\b(\d+)\b/);
  if (digitMatch) {
    return normalizeCount(digitMatch[1], 1);
  }

  const wordCounts = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  for (const [word, value] of Object.entries(wordCounts)) {
    if (new RegExp(`\\b${word}\\b`).test(normalizedText)) {
      return value;
    }
  }

  return 1;
}

function extractCounterCountFromText(text) {
  const normalizedText = String(text || "").toLowerCase();
  const countTokenPattern = "(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+)";
  const leadPattern = new RegExp(
    `(?:put|puts|add|adds|move|moves|distribute|distributes|with)\\s+${countTokenPattern}\\s+(?:[a-z0-9+\\/-]+\\s+){0,4}counters?\\b`,
    "i"
  );
  const leadMatch = normalizedText.match(leadPattern);
  if (leadMatch?.[1]) {
    return parseCountToken(leadMatch[1]);
  }

  return extractCountFromText(normalizedText);
}

function extractTemporaryBuffFromText(text) {
  const normalizedText = String(text || "").toLowerCase();
  if (!normalizedText.includes("until end of turn") && !normalizedText.includes("until end of combat")) {
    return null;
  }

  const match = normalizedText.match(/get(?:s)?\s+([+\-]\d+)\/([+\-]\d+)(?:[^.]*?)until end of (turn|combat)/i);
  if (!match) {
    return null;
  }

  return {
    power: normalizeSignedCount(match[1]),
    toughness: normalizeSignedCount(match[2]),
    duration: match[3] === "combat" ? "until-end-of-combat" : "until-end-of-turn",
  };
}

function parseCountToken(token) {
  const normalizedToken = normalizeLabel(token, "").toLowerCase();
  if (!normalizedToken) {
    return 1;
  }

  if (/^\d+$/.test(normalizedToken)) {
    return normalizeCount(normalizedToken, 1);
  }

  const wordCounts = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  return wordCounts[normalizedToken] || 1;
}

function getTriggerSummary(trigger) {
  if (trigger.actionType === "Create Tokens") {
    return `${trigger.triggerEvent === "Phase" ? trigger.phase : trigger.triggerEvent}: Create ${trigger.value} ${trigger.tokenPower}/${trigger.tokenToughness} ${trigger.tokenName || "Token"} Tokens`;
  }

  if (trigger.actionType === "Multiply Tokens") {
    return `${trigger.triggerEvent === "Phase" ? trigger.phase : trigger.triggerEvent}: Multiply Tokens for ${trigger.target}`;
  }

  if (trigger.actionType === "Add +1/+1 Counters" || trigger.actionType === "Add Counters") {
    const counterType = normalizeCounterType(trigger.counterType || (trigger.actionType === "Add +1/+1 Counters" ? "+1/+1" : "Generic"));
    return `${trigger.triggerEvent === "Phase" ? trigger.phase : trigger.triggerEvent}: Add ${trigger.value} ${counterType} Counter${trigger.value === 1 ? "" : "s"} to ${trigger.target}`;
  }

  if (trigger.actionType === "Apply Temporary Buff") {
    const buffPower = normalizeSignedCount(trigger.buffPower);
    const buffToughness = normalizeSignedCount(trigger.buffToughness);
    const durationLabel = normalizeAutomationBuffDuration(trigger.buffDuration) === "until-end-of-combat"
      ? "until end of combat"
      : "until end of turn";
    return `${trigger.triggerEvent === "Phase" ? trigger.phase : trigger.triggerEvent}: ${buffPower >= 0 ? "+" : ""}${buffPower}/${buffToughness >= 0 ? "+" : ""}${buffToughness} ${durationLabel} to ${trigger.target}`;
  }

  return `${trigger.triggerEvent}: ${trigger.actionType}`;
}

function getEnabledPlayerCounters() {
  return PLAYER_COUNTER_DEFS.filter((counter) => state.playerCounters[counter.id]?.enabled);
}

function getCounterBadgeScale(count) {
  if (count <= 2) {
    return "1";
  }

  return String(Math.max(0.8, 1 - (count - 2) * 0.08));
}

function getCommanderDamageModuleScale(count) {
  if (count <= 2) {
    return "1";
  }

  return String(Math.max(0.62, 1 - (count - 2) * 0.08));
}

function getInlineCounterScale(count) {
  if (count <= 2) {
    return "1";
  }

  return String(Math.max(0.72, 1 - (count - 2) * 0.12));
}

function getInlineDamageScale(count) {
  if (count <= 2) {
    return "1";
  }

  return String(Math.max(0.58, 1 - (count - 2) * 0.09));
}

function getConnectionTypeLabel(connectionType) {
  switch (connectionType) {
    case "wifi":
      return "Same WiFi";
    case "bluetooth":
      return "Bluetooth";
    case "simulated":
    default:
      return "Simulated";
  }
}

function formatLastUpdated(lastUpdated) {
  const secondsAgo = Math.max(0, Math.round((Date.now() - normalizeTimestamp(lastUpdated)) / 1000));

  if (secondsAgo < 10) {
    return "Updated just now";
  }

  if (secondsAgo < 60) {
    return `Updated ${secondsAgo}s ago`;
  }

  const minutesAgo = Math.round(secondsAgo / 60);
  return `Updated ${minutesAgo}m ago`;
}

function formatAutomationTimestamp(timestamp) {
  const date = new Date(normalizeTimestamp(timestamp));
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatConnectionMeta(player) {
  return `${getConnectionTypeLabel(player.connectionType)} • ${player.isConnected ? "Connected" : "Offline"} • ${formatLastUpdated(player.lastUpdated)}`;
}

function truncateText(value, maxLength) {
  const normalizedValue = String(value || "").trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function syncPageWithHash() {
  const params = new URLSearchParams(window.location.search);
  const hashValue = window.location.hash;
  const legacyHashMap = {
    "#boardstate": "board-state",
    "#leaderboard": "leaderboards",
  };
  const hashPage =
    legacyHashMap[hashValue] || Object.entries(PAGE_HASH_MAP).find(([, hash]) => hash === hashValue)?.[0];
  const queryPage = normalizeLabel(params.get("page"), "").toLowerCase();
  const normalizedQueryPage = PAGE_ORDER.includes(queryPage) ? queryPage : "";
  const targetPage = hashPage || normalizedQueryPage || "tracker";
  showPage(targetPage, { syncHash: false, behavior: "auto" });
}

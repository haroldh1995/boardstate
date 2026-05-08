export const CONNECTION_TYPES = ["wifi", "bluetooth", "simulated"];
export const MULTIPLAYER_VIEW_MODES = ["tracker", "board-state"];
export const PUBLIC_COUNTER_KEYS = ["poison", "energy", "experience", "tickets"];
export const DEFAULT_FACE_DOWN_LABEL = "Face-down Permanent";

/**
 * @typedef {Object} Permissions
 * @property {boolean} canViewFaceDownCards
 */

/**
 * @typedef {Object} PublicTrackerState
 * @property {number} life
 * @property {Record<string, number>} counters
 * @property {Array<{label: string, value: number}>} commanderDamage
 */

/**
 * @typedef {Object} PublicBoardState
 * @property {Array<object>} permanents
 * @property {Array<object>} effects
 * @property {string} currentPhase
 * @property {number} totalPower
 * @property {number} totalToughness
 */

/**
 * @typedef {Object} ConnectedPlayer
 * @property {string} id
 * @property {string} displayName
 * @property {"wifi" | "bluetooth" | "simulated"} connectionType
 * @property {boolean} isConnected
 * @property {number} lastUpdated
 * @property {PublicTrackerState} publicTrackerState
 * @property {PublicBoardState} publicBoardState
 * @property {Permissions} permissions
 */

/**
 * TODO: Future connection metadata can live here once the app supports:
 * - WebRTC peer discovery/signaling for same-network sessions
 * - Web Bluetooth pairing where browsers expose a safe API
 * - Optional relay/signaling services for hosted multiplayer sessions
 */

/*
 * Shared constants: action and mode identifiers (no string literals scattered
 * over the modules), sizing defaults and a few state lists.
 */

/** Action identifiers understood by the card. */
export const ACTION = Object.freeze({
  NONE: "none",
  TOGGLE: "toggle",
  PERFORM: "perform-action",
  CALL_SERVICE: "call-service", // legacy alias of PERFORM
  MORE_INFO: "more-info",
  NAVIGATE: "navigate",
  URL: "url",
  CYCLE: "cycle",
  CYCLE_BACK: "cycle_back",
});

/** Actions the HA action picker offers that this card does not implement. */
export const IGNORED_HA_ACTIONS = Object.freeze(["default", "assist", "fire-dom-event"]);

export const ACTION_TYPES = Object.freeze(Object.values(ACTION));

export const MODE = Object.freeze({ STATE: "state", LOCK: "lock", VALUE: "value" });
export const MODES = Object.freeze(Object.values(MODE));

/** Domains whose on/off state is switched with turn_on / turn_off. */
export const TOGGLE_DOMAINS = Object.freeze(["switch", "input_boolean", "light", "fan", "automation", "siren", "humidifier"]);
/** State values that count as "off". */
export const OFF_VALUES = Object.freeze(["off", "unavailable", "unknown", "none", "closed"]);

/** Matches "domain.object_id" (entities) and "domain.service" (actions). */
export const DOT_ID_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;

/** Default icon of a switch without `icon`. */
export const DEFAULT_SWITCH_ICON = "mdi:circle-outline";

/** Dashboard grid sizing (sections view) and legacy masonry card sizes. */
export const GRID = Object.freeze({
  horizontal: { columns: 6, rows: 2, min_columns: 3, min_rows: 1 },
  vertical: { columns: 3, rows: 4, min_columns: 2, min_rows: 3 },
});
export const CARD_SIZE = Object.freeze({ horizontal: 2, vertical: 4 });

/** Handle and bar geometry. */
export const OVAL_RATIO = 1.6;
export const DEFAULT_VERTICAL_LENGTH = 160;
export const SQUARE_BAR_RADIUS_RATIO = 0.25;
export const SQUARE_HANDLE_RADIUS_RATIO = 0.2;
export const PILL_RADIUS = "999px";

/** Actions of modes that only show information. */
export function infoActions() {
  return {
    tap_action: { action: ACTION.MORE_INFO },
    double_tap_action: { action: ACTION.NONE },
    hold_action: { action: ACTION.NONE },
  };
}

/** True when `action` is a configured action other than "none". */
export function hasAction(action) {
  return Boolean(action) && action.action !== ACTION.NONE;
}

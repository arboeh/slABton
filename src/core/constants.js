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

export const MODE = Object.freeze({
  STATE: "state",
  LOCK: "lock",
  VALUE: "value",
  COUNTER: "counter",
  TIMER: "timer",
  CLOCK: "clock",
});
export const MODES = Object.freeze(Object.values(MODE));

/**
 * Modes that only display information (the handle cannot be dragged). The value
 * mode is not listed: it is draggable for the domains in VALUE_SETTABLE_DOMAINS.
 */
export const READ_ONLY_MODES = Object.freeze([MODE.COUNTER, MODE.TIMER, MODE.CLOCK]);

/** Domains whose number the value mode can set by dragging (`<domain>.set_value`). */
export const VALUE_SETTABLE_DOMAINS = Object.freeze(["input_number", "number"]);

/** Interval of the local clock tick (timer and clock modes), in ms. */
export const TICK_MS = 1000;

/** Domains whose on/off state is switched with turn_on / turn_off. */
export const TOGGLE_DOMAINS = Object.freeze(["switch", "input_boolean", "light", "fan", "automation", "siren", "humidifier"]);
/** State values that count as "off". */
export const OFF_VALUES = Object.freeze(["off", "unavailable", "unknown", "none", "closed"]);

/** Domains whose states come from an entity attribute (options / hvac_modes): nothing to cycle without it. */
export const ATTRIBUTE_STATE_DOMAINS = Object.freeze(["select", "input_select", "climate"]);

/** Handle icon shown while the entity is unavailable. */
export const UNAVAILABLE_ICON = "mdi:alert-circle-outline";

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
/** One sections-view row including its gap, and one masonry card-size unit, in px. */
export const GRID_ROW_PX = 64;
export const CARD_UNIT_PX = 50;
/** Gap between two sections-view rows: a card of r rows is `GRID_ROW_PX * r - GRID_ROW_GAP_PX` px high. */
export const GRID_ROW_GAP_PX = 8;
/** Card height besides the bar (and the handle's excess over it): ha-card padding (2 x 12) plus its border, in px. */
export const CARD_CHROME_PX = 26;
/** Overshoot of the content over the row budget that still counts as fitting (rounding, theme differences), in px. */
export const GRID_FIT_TOLERANCE_PX = 2;

/**
 * The `text:` block: every area with its options and the CSS variable each one
 * sets. Options with a `unit` are sizes; their values are limited to
 * MIN/MAX_FONT_SIZE. Single source for config, styles and editor.
 */
export const TEXT_OPTIONS = Object.freeze({
  header: Object.freeze({
    font_size: Object.freeze({ css: "--slabton-header-size", unit: "px" }),
    color: Object.freeze({ css: "--slabton-header-color" }),
    icon_color: Object.freeze({ css: "--slabton-header-icon-color" }),
  }),
  bar: Object.freeze({
    font_size: Object.freeze({ css: "--slabton-bar-text-size", unit: "px" }),
    color: Object.freeze({ css: "--slabton-bar-text-color" }),
  }),
  info: Object.freeze({
    font_size: Object.freeze({ css: "--slabton-info-size", unit: "px" }),
    color: Object.freeze({ css: "--slabton-info-color" }),
  }),
  button: Object.freeze({
    font_size: Object.freeze({ css: "--slabton-button-size", unit: "px" }),
    color: Object.freeze({ css: "--slabton-button-color" }),
  }),
  scale: Object.freeze({
    font_size: Object.freeze({ css: "--slabton-scale-label-size", unit: "px" }),
    color: Object.freeze({ css: "--slabton-scale-label-color" }),
  }),
});
export const TEXT_AREAS = Object.freeze(Object.keys(TEXT_OPTIONS));
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 48;

/**
 * The `scale:` block (tick marks in the bar). Positions are across the bar:
 * `start` is the top (horizontal) or left (vertical) edge, `end` the opposite one.
 * `top`/`bottom` (horizontal) and `left`/`right` (vertical) are aliases of those.
 */
export const SCALE_AXIS_POSITIONS = Object.freeze(["start", "center", "end"]);
export const SCALE_ALIASES = Object.freeze({
  horizontal: Object.freeze({ top: "start", bottom: "end" }),
  vertical: Object.freeze({ left: "start", right: "end" }),
});
export const SCALE_OPTIONS = Object.freeze(["ticks", "position", "size", "color", "labels"]);
/** Smallest bar thickness (px) that has room for a tick plus its label. */
export const MIN_LABEL_THICKNESS = 28;
/** Clock scale labels: every n-th hour of the 24 h day (the bar always shows 24 h, whatever `hour_format` says). */
export const CLOCK_LABEL_STEP = 6;
export const DEFAULT_SCALE_POSITION = "end";
/** Segments of a scale (ticks = segments + 1): default, limits and the clock's hours. */
export const DEFAULT_SCALE_TICKS = 10;
export const MIN_SCALE_TICKS = 1;
export const MAX_SCALE_TICKS = 100;
export const CLOCK_SCALE_TICKS_24 = 24;
export const CLOCK_SCALE_TICKS_12 = 12;
/** Tick length in px: default and lower limit (the upper limit is the bar thickness). */
export const DEFAULT_SCALE_SIZE = 8;
export const MIN_SCALE_SIZE = 2;

/**
 * Analog clock face (`clock.face`). Numbers: none, the quarters (12, 3, 6, 9) or all hours.
 * The handle needs a minimum cross size (`handle_size`, px) for the dial and for each numbers level.
 */
export const CLOCK_FACE_NUMBERS = Object.freeze(["none", "quarters", "all"]);
export const CLOCK_FACE_OPTIONS = Object.freeze(["numbers", "ticks"]);
export const MIN_ANALOG_HANDLE_SIZE = 32;
export const MIN_DIAL_QUARTERS_SIZE = 48;
export const MIN_DIAL_NUMBERS_SIZE = 72;
/** `clock.face.ticks` default (the editor does not store a value that equals it). */
export const DEFAULT_FACE_TICKS = true;

/**
 * Smallest accepted `step` (value mode); smaller values are rejected. Matches the tolerance used
 * when counting steps, and keeps `toFixed` far below its limit of 100 digits.
 */
export const MIN_STEP = 1e-9;
/** Upper limit of the decimals `snap` rounds to (`toFixed` throws above 100). */
export const MAX_SNAP_DECIMALS = 20;

/** Positions the `scale.position` option accepts for an orientation (editor list). */
export function scalePositionsFor(orientation) {
  return [...Object.keys(SCALE_ALIASES[orientation] ?? SCALE_ALIASES.horizontal), ...SCALE_AXIS_POSITIONS];
}

/** Bar thickness limits in px (the upper one is also the longest tick of a scale). */
export const MIN_THICKNESS = 12;
export const MAX_THICKNESS = 200;

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

/** Predefined bar animations (names only; CSS lives in `ui/animations.js`). */
export const ANIMATIONS = ["none", "slide", "fade", "pulse", "shimmer"];
export const DEFAULT_ANIMATION = "slide";

/** Timer states as shown by the timer mode (the first three equal the HA `timer.*` states). */
export const TIMER_STATUS = Object.freeze({
  IDLE: "idle", ACTIVE: "active", PAUSED: "paused", EXPIRED: "expired", UNKNOWN: "unknown",
});
/** Where the timer mode takes its time from. */
export const TIMER_SOURCE = Object.freeze({ HA: "ha", TARGET: "target", UNSUPPORTED: "unsupported" });
/** Keys of one-time console notices a mode view can report (texts live in the card). */
export const NOTICE = Object.freeze({
  TIME_ONLY: "time_only", UNSUPPORTED_ENTITY: "unsupported_entity", INVALID_RANGE: "invalid_range",
  INVALID_VALUE_RANGE: "invalid_value_range",
});

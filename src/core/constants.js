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

/**
 * Cover entities (value mode): the position 0 (closed) .. 100 (open) is the attribute `current_position`, set with
 * `cover.set_cover_position`. `COVER_FEATURE` are the `supported_features` bits of Home Assistant's cover entity.
 */
export const COVER_DOMAIN = "cover";
export const COVER_POSITION_ATTRIBUTE = "current_position";
export const COVER_POSITION_UNIT = "%";
export const COVER_FEATURE = Object.freeze({ OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8 });
/** Cover states the card knows (the HA `cover` states). */
export const COVER_STATE = Object.freeze({ OPEN: "open", CLOSED: "closed", OPENING: "opening", CLOSING: "closing" });
/** Handle icon of a cover without `icon` (own icon of the entity wins), per state. */
export const COVER_ICONS = Object.freeze({
  [COVER_STATE.OPEN]: "mdi:window-shutter-open",
  [COVER_STATE.CLOSED]: "mdi:window-shutter",
  [COVER_STATE.OPENING]: "mdi:arrow-up",
  [COVER_STATE.CLOSING]: "mdi:arrow-down",
});
export const COVER_DEFAULT_ICON = COVER_ICONS[COVER_STATE.CLOSED];

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

/**
 * Dashboard grid sizing (sections view): the width in columns, the height from the content (`rows: "auto"`, like
 * HA's compact cards). `min_rows` is left out: it only acts on a number of rows. A `grid_options:` of the user
 * overrides each key.
 */
export const GRID = Object.freeze({
  horizontal: Object.freeze({ columns: 6, rows: "auto", min_columns: 3 }),
  vertical: Object.freeze({ columns: 3, rows: "auto", min_columns: 2 }),
});
/** Legacy masonry card size in units (`getCardSize`). */
export const CARD_SIZE = Object.freeze({ horizontal: 2, vertical: 4 });
/** One masonry card-size unit, in px. */
export const CARD_UNIT_PX = 50;
/** Card height besides the bar (and the handle's excess over it): ha-card padding (2 x 12) plus its border, in px. */
export const CARD_CHROME_PX = 26;
/** Air between a handle that sticks out of the stage and the card edge, on top of the card padding, in px. */
export const HANDLE_EDGE_GAP_PX = 4;
/** Card padding plus border on one side, in px (half of `CARD_CHROME_PX`). */
export const CARD_SIDE_CHROME_PX = CARD_CHROME_PX / 2;
/** Width of one dashboard grid column and the gap between columns in the sections view, in px (HA default theme, measured). */
export const GRID_COLUMN_PX = 34;
export const GRID_COLUMN_GAP_PX = 8;
/** Columns in a section of the sections view. */
export const GRID_MAX_COLUMNS = 12;
/** Overshoot of the content over the masonry size that still counts as fitting (rounding, theme differences), in px. */
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
    font_weight: Object.freeze({ css: "--slabton-header-weight" }),
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
export const SCALE_OPTIONS = Object.freeze(["ticks", "ticks_placement", "position", "size", "color", "labels", "labels_placement"]);
/**
 * Where the ticks stand: in the bar, outside it (on the side `scale.position` points to, between bar and labels),
 * or not at all ("none": only the labels show, on the track the ticks would have had).
 */
export const SCALE_TICK_PLACEMENTS = Object.freeze(["inside", "outside", "none"]);
export const DEFAULT_SCALE_TICK_PLACEMENT = "inside";
/** Where the labels stand: in the bar next to the ticks, or outside the bar (above/below, left/right of it). */
export const SCALE_LABEL_PLACEMENTS = Object.freeze(["inside", "outside"]);
export const DEFAULT_SCALE_LABEL_PLACEMENT = "inside";
/** Label font size in px without `text.scale.font_size` (also the CSS fallback). */
export const DEFAULT_SCALE_LABEL_SIZE = 10;
/** Gap between a label and its tick (inside) or between a label and the handle's reach (outside), in px. */
export const SCALE_LABEL_GAP_PX = 3;
/** Smallest bar thickness (px) that has room for a tick plus its label (labels inside only). */
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

/**
 * Stickshift (state mode): a fixed gate with one directly clickable point per state. The point defaults to 80 % of
 * the handle (never larger), the gate is a thin line between the points.
 */
export const STICKSHIFT_OPTIONS = Object.freeze(["enabled", "shape", "point_size", "point_opacity", "active_color", "gate"]);
export const STICKSHIFT_POINT_RATIO = 0.8;
export const STICKSHIFT_MIN_POINT_SIZE = 8;
export const STICKSHIFT_DEFAULT_OPACITY = 0.55;
export const STICKSHIFT_DEFAULT_GATE_SIZE = 4;
export const STICKSHIFT_MIN_GATE_SIZE = 1;
export const STICKSHIFT_MAX_GATE_SIZE = 40;

/**
 * Segmented bar (`bar.segments`): the bar is cut into `count` equal segments across the bar, `gap` px apart. Whole
 * segments are active (`on_color`) or inactive (`off_color`). The basis for later level-meter looks.
 */
export const SEGMENT_OPTIONS = Object.freeze(["count", "gap", "on_color", "off_color"]);
export const DEFAULT_SEGMENT_COUNT = 10;
export const MIN_SEGMENT_COUNT = 2;
export const MAX_SEGMENT_COUNT = 50;
export const DEFAULT_SEGMENT_GAP_PX = 3;
export const MIN_SEGMENT_GAP_PX = 0;
export const MAX_SEGMENT_GAP_PX = 20;

/** Bar thickness limits in px (the upper one is also the longest tick of a scale). */
export const MIN_THICKNESS = 12;
export const MAX_THICKNESS = 200;

/**
 * Handle text fit: mean glyph width in em and the width kept free for the padding, in px. The font size of a handle text
 * shrinks until `characters * HANDLE_CHAR_WIDTH_EM` em fit into the handle width minus `HANDLE_TEXT_SPACE_PX` (never
 * below `MIN_FONT_SIZE`; a longer text is cut with an ellipsis). The width is an estimate, not measured.
 */
export const HANDLE_CHAR_WIDTH_EM = 0.7;
export const HANDLE_TEXT_SPACE_PX = 8;

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
/** Animation a travelling cover opts into. */
export const ANIMATION_PULSE = "pulse";
/** `handle_position` value: the handle follows the value freely (the only one that can be dragged). */
export const HANDLE_FLEX = "flex";

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

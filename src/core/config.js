/*
 * Config schema, defaults and validation. `normalizeConfig` turns the raw
 * user config into a fully resolved, validated copy (the input is never
 * mutated). Invalid enum values and malformed actions throw an Error whose
 * message Home Assistant shows in the card.
 */

import {
  ACTION, ACTION_TYPES, ANIMATIONS, DEFAULT_ANIMATION, DEFAULT_SWITCH_ICON, DOT_ID_RE, IGNORED_HA_ACTIONS, MODE, MODES,
  MAX_FONT_SIZE, MIN_FONT_SIZE, OFF_VALUES, READ_ONLY_MODES, TEXT_AREAS, TEXT_OPTIONS, TOGGLE_DOMAINS,
} from "./constants.js";
import { unknownPlaceholders } from "./placeholders.js";
import { isValidTimeZone } from "./time.js";
import { isPlainObject, pickEnum, safeCss, str, toNumber, warn } from "./util.js";

export { ACTION_TYPES, IGNORED_HA_ACTIONS, MODES };
export const ORIENTATIONS = ["horizontal", "vertical"];
export const DIRECTIONS = ["ltr", "rtl"];
export const HANDLE_SHAPES = ["round", "oval", "square"];
export const HANDLE_POSITIONS = ["flex", "fixed", "switch", "start", "mid", "end"];
export const HANDLE_CONTENTS = ["icon", "position", "text", "none"];
export const HEADER_POSITIONS = ["top", "bottom", "none"];
export const HEADER_ICON_POSITIONS = ["left", "right"];
export const SWITCH_SLOTS = ["start", "mid", "end"];
export const ARM_SERVICES = ["alarm_arm_away", "alarm_arm_home", "alarm_arm_night", "alarm_arm_vacation"];
export const PRESET_NAMES = ["none", "thermometer", "energy", "soc"];
export const CLOCK_DISPLAYS = ["digital", "analog"];
/** Displays the editor offers (`analog` is reserved for a later release). */
export const CLOCK_DISPLAYS_OFFERED = ["digital"];
export const HOUR_FORMATS = ["auto", "12", "24"];

/** Names reserved for later releases: accepted, warned about once and ignored. */
export const RESERVED_KEYS = Object.freeze(["thresholds", "scale", "shape", "control"]);

/** Longest accepted `bar_text` / `timer.info`. */
export const MAX_TEXT_LENGTH = 200;

/** Keys of the `bar:` block that alias the flat top-level range options. */
const BAR_ALIAS_KEYS = ["min", "max", "unit", "decimals", "preset"];
const OPTIONAL_BLOCKS = [MODE.COUNTER, MODE.TIMER, MODE.CLOCK];

/** Defaults for the value-mode presets (plain defaults, overridable). */
export const PRESETS = {
  thermometer: { min: -10, max: 40, unit: "°C", icon: "mdi:thermometer", decimals: 1 },
  energy: { min: 0, max: 5000, unit: "W", icon: "mdi:flash", decimals: 0 },
  soc: { min: 0, max: 100, unit: "%", icon: "mdi:battery", decimals: 0 },
};

export const DEFAULTS = {
  orientation: "horizontal",
  direction: "ltr",
  length: 0,
  thickness: 48,
  handle_size: 40,
  handle_shape: "round",
  handle_position: "flex",
  fixed_position: 50,
  header_position: "top",
  header_icon_position: "left",
  border_width: 0,
  swipe_threshold: 85,
  arm_service: "alarm_arm_away",
  animation: DEFAULT_ANIMATION,
};

const COLOR_KEYS = ["bar_color", "fill_color", "handle_color", "text_color", "border_color"];
const STYLE_KEY_RE = /^(--slabton-[a-z0-9-]+|[a-z0-9][a-z0-9-]*)$/;

/** Default mode for an entity domain. */
export function inferMode(domain) {
  if (domain === "lock" || domain === "alarm_control_panel") return MODE.LOCK;
  if (domain === "sensor" || domain === "number" || domain === "input_number") return MODE.VALUE;
  if (domain === "counter") return MODE.COUNTER;
  if (domain === "timer") return MODE.TIMER;
  return MODE.STATE;
}

function checkEntity(value, key) {
  if (typeof value !== "string" || !DOT_ID_RE.test(value)) {
    throw new Error(`slabton-card: ${key} must look like "domain.object_id"`);
  }
  return value;
}

function normalizeAction(raw, key) {
  if (raw == null) return undefined;
  if (!isPlainObject(raw) || typeof raw.action !== "string") {
    throw new Error(`slabton-card: ${key} needs an "action"`);
  }
  if (IGNORED_HA_ACTIONS.includes(raw.action)) {
    warn(`${key}.action "${raw.action}" is not supported and was ignored`);
    return undefined;
  }
  if (!ACTION_TYPES.includes(raw.action)) {
    throw new Error(`slabton-card: invalid ${key}.action "${raw.action}" (allowed: ${ACTION_TYPES.join(", ")})`);
  }
  const entity = raw.entity == null ? undefined : checkEntity(raw.entity, `${key}.entity`);

  if (raw.action === ACTION.PERFORM || raw.action === ACTION.CALL_SERVICE) {
    const service = raw.perform_action ?? raw.service;
    if (typeof service !== "string" || !DOT_ID_RE.test(service)) {
      throw new Error(`slabton-card: ${key}.perform_action must look like "domain.service"`);
    }
    const data = raw.data ?? raw.service_data;
    return {
      action: ACTION.PERFORM,
      perform_action: service,
      target: isPlainObject(raw.target) ? { ...raw.target } : undefined,
      data: isPlainObject(data) ? { ...data } : undefined,
    };
  }
  if (raw.action === ACTION.NAVIGATE) {
    const path = raw.navigation_path;
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
      throw new Error(`slabton-card: ${key}.navigation_path must be a path starting with "/"`);
    }
    return { action: ACTION.NAVIGATE, navigation_path: path };
  }
  if (raw.action === ACTION.URL) {
    if (!str(raw.url_path)) throw new Error(`slabton-card: ${key}.url_path is required`);
    return { action: ACTION.URL, url_path: raw.url_path.trim() };
  }
  return entity ? { action: raw.action, entity } : { action: raw.action };
}

/** tap_action, double_tap_action and hold_action of `raw` (keys prefixed with `prefix`). */
function normalizeTriggers(raw, prefix = "") {
  return {
    tap_action: normalizeAction(raw.tap_action, `${prefix}tap_action`),
    double_tap_action: normalizeAction(raw.double_tap_action, `${prefix}double_tap_action`),
    hold_action: normalizeAction(raw.hold_action, `${prefix}hold_action`),
  };
}

function normalizeStates(list) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new Error("slabton-card: states must be a list");
  return list.map((entry, i) => {
    const item = typeof entry === "string" || typeof entry === "number" ? { value: String(entry) } : entry;
    if (!isPlainObject(item) || item.value == null || item.value === "") {
      throw new Error(`slabton-card: states[${i}] needs a "value"`);
    }
    return {
      value: String(item.value),
      label: str(item.label),
      icon: str(item.icon),
      text: str(item.text),
      color: safeCss(item.color, null),
    };
  });
}

/** Warn once at config time when free state values cannot be set on an on/off domain. */
function warnUnreachableStates(states, domain) {
  if (!TOGGLE_DOMAINS.includes(domain)) return;
  const unusual = states.map((s) => s.value).filter((v) => v !== "on" && !OFF_VALUES.includes(v));
  if (unusual.length) {
    warn(`states ${unusual.join(", ")} map to turn_on on ${domain} entities; use "on" / "off" or a select entity`);
  }
}

function normalizeStyles(raw) {
  if (raw == null) return {};
  if (!isPlainObject(raw)) throw new Error("slabton-card: styles must be a map");
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!STYLE_KEY_RE.test(key)) {
      warn(`ignored styles key "${key}"`);
      continue;
    }
    const css = typeof value === "number" ? String(value) : safeCss(value, null);
    if (css == null) {
      warn(`ignored unsafe styles value for "${key}"`);
      continue;
    }
    out[key.startsWith("--") ? key : `--slabton-${key}`] = css;
  }
  return out;
}

function normalizeSwitches(raw) {
  if (raw == null) return {};
  if (!isPlainObject(raw)) throw new Error("slabton-card: switches must be a map");
  const out = {};
  for (const slot of SWITCH_SLOTS) {
    const item = raw[slot];
    if (item == null) continue;
    if (!isPlainObject(item)) throw new Error(`slabton-card: switches.${slot} must be a map`);
    out[slot] = {
      entity: item.entity == null ? null : checkEntity(item.entity, `switches.${slot}.entity`),
      icon: str(item.icon) ?? DEFAULT_SWITCH_ICON,
      name: str(item.name),
      ...normalizeTriggers(item, `switches.${slot}.`),
    };
  }
  return out;
}

/** Bar and handle geometry options. */
function normalizeLayout(raw, mode) {
  return {
    header_position: pickEnum(raw.header_position, HEADER_POSITIONS, DEFAULTS.header_position, "header_position"),
    header_icon_position: pickEnum(
      raw.header_icon_position, HEADER_ICON_POSITIONS, DEFAULTS.header_icon_position, "header_icon_position",
    ),
    orientation: pickEnum(raw.orientation, ORIENTATIONS, DEFAULTS.orientation, "orientation"),
    direction: pickEnum(raw.direction, DIRECTIONS, DEFAULTS.direction, "direction"),
    length: toNumber(raw.length, DEFAULTS.length, 0, 2000),
    thickness: toNumber(raw.thickness, DEFAULTS.thickness, 12, 200),
    handle_size: toNumber(raw.handle_size, DEFAULTS.handle_size, 8, 200),
    handle_shape: pickEnum(raw.handle_shape, HANDLE_SHAPES, DEFAULTS.handle_shape, "handle_shape"),
    handle_position: pickEnum(raw.handle_position, HANDLE_POSITIONS, DEFAULTS.handle_position, "handle_position"),
    fixed_position: toNumber(raw.fixed_position, DEFAULTS.fixed_position, 0, 100),
    handle_overhang: raw.handle_overhang === true,
    handle_content: pickEnum(
      raw.handle_content, HANDLE_CONTENTS, READ_ONLY_MODES.includes(mode) ? "text" : "icon", "handle_content",
    ),
  };
}

/** Colors, border, animation and CSS overrides. */
function normalizeLook(raw) {
  const look = {
    border_width: toNumber(raw.border_width, DEFAULTS.border_width, 0, 20),
    border_radius: toNumber(raw.border_radius, null, 0, 999),
    animation: pickEnum(raw.animation, ANIMATIONS, DEFAULTS.animation, "animation"),
    styles: normalizeStyles(raw.styles),
  };
  for (const key of COLOR_KEYS) look[key] = safeCss(raw[key], null);
  return look;
}

/** Value range, unit and decimals (value mode, presets provide defaults). */
function normalizeRange(raw, presetDefaults) {
  const min = toNumber(raw.min, presetDefaults.min ?? 0, -1e9, 1e9);
  const max = toNumber(raw.max, presetDefaults.max ?? 100, -1e9, 1e9);
  if (max <= min) throw new Error("slabton-card: max must be greater than min");
  return {
    min,
    max,
    // Which bounds the user set explicitly (the counter mode prefers entity attributes over defaults).
    range_set: { min: toNumber(raw.min, null, -1e9, 1e9) != null, max: toNumber(raw.max, null, -1e9, 1e9) != null },
    unit: str(raw.unit) ?? presetDefaults.unit ?? null,
    decimals: toNumber(raw.decimals, presetDefaults.decimals ?? 1, 0, 6),
  };
}

/**
 * Resolve the `bar:` block. Flat range options stay as an alias; `bar:` wins
 * on conflict (with a warning). Returns the merged option source and the
 * optional separate bar entity (null = the bar follows `entity`).
 */
function resolveBar(raw) {
  if (raw.bar == null) return { source: raw, barEntity: null };
  if (!isPlainObject(raw.bar)) throw new Error("slabton-card: bar must be a map");
  const source = { ...raw };
  for (const key of BAR_ALIAS_KEYS) {
    const value = raw.bar[key];
    if (value == null || value === "") continue;
    const flat = raw[key];
    if (flat != null && flat !== "" && flat !== value) warn(`bar.${key} overrides the top-level ${key}`);
    source[key] = value;
  }
  const barEntity = raw.bar.entity == null || raw.bar.entity === "" ? null : checkEntity(raw.bar.entity, "bar.entity");
  return { source, barEntity };
}

/** A config block (`counter:`, `timer:`, `clock:`): missing -> {}, anything but a map -> error. */
function blockOf(raw, key) {
  if (raw[key] == null) return {};
  if (!isPlainObject(raw[key])) throw new Error(`slabton-card: ${key} must be a map`);
  return raw[key];
}

/** Text with placeholders, trimmed and capped; warns about names the mode does not know. */
function normalizeText(value, key, mode) {
  let text = str(value);
  if (text == null) return null;
  if (text.length > MAX_TEXT_LENGTH) {
    warn(`${key} was shortened to ${MAX_TEXT_LENGTH} characters`);
    text = text.slice(0, MAX_TEXT_LENGTH);
  }
  for (const name of unknownPlaceholders(text, mode)) {
    warn(`${key}: placeholder {${name}} is not available in mode "${mode}" and is shown as written`);
  }
  return text;
}

/** Decimal text only: rejects "0x10", "1e1" and similar that `Number()` would accept. */
const PLAIN_NUMBER_RE = /^\d+(\.\d+)?$/;

const isBlank = (value) => value == null || value === "";

/** Numeric value of a font size; NaN when it is neither a number nor a plain decimal text. */
function parseFontSize(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && PLAIN_NUMBER_RE.test(value.trim())) return Number(value);
  return NaN;
}

/** Font size in px within the accepted limits, or null (warns about an unusable value). */
function textFontSize(value, key) {
  if (isBlank(value)) return null;
  const n = parseFontSize(value);
  if (n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE) return n;
  warn(`${key} must be a number from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} and was ignored`);
  return null;
}

/** CSS color or null (warns about an unsafe value). */
function textColor(value, key) {
  if (isBlank(value)) return null;
  const css = safeCss(value, null);
  if (css == null) warn(`ignored unsafe ${key}`);
  return css;
}

function normalizeTextArea(raw, area) {
  const options = TEXT_OPTIONS[area];
  if (raw != null && !isPlainObject(raw)) throw new Error(`slabton-card: text.${area} must be a map`);
  const source = raw ?? {};
  const keys = Object.keys(options);
  for (const key of Object.keys(source)) {
    if (!keys.includes(key)) warn(`text.${area}.${key} is not a known option and was ignored`);
  }
  const out = {};
  for (const key of keys) {
    const path = `text.${area}.${key}`;
    out[key] = options[key].unit ? textFontSize(source[key], path) : textColor(source[key], path);
  }
  return out;
}

/** The `text:` block: font size and color per area (header, bar, info, button); null = not set. */
function normalizeTextStyle(raw) {
  if (raw != null && !isPlainObject(raw)) throw new Error("slabton-card: text must be a map");
  const source = raw ?? {};
  for (const area of Object.keys(source)) {
    if (!TEXT_AREAS.includes(area)) warn(`text.${area} is not a known area and was ignored`);
  }
  return Object.fromEntries(TEXT_AREAS.map((area) => [area, normalizeTextArea(source[area], area)]));
}

function normalizeTimeZone(value, key) {
  if (value == null || value === "") return null;
  if (!isValidTimeZone(value)) throw new Error(`slabton-card: ${key} "${String(value)}" is not a known time zone`);
  return value.trim();
}

const COUNTER_DEFAULTS = Object.freeze({ min: null, max: null });
const TIMER_DEFAULTS = Object.freeze({ pulse: true, pulse_seconds: 10, info: null, time_zone: null, span: 30 });
const CLOCK_DEFAULTS = Object.freeze({ display: "digital", time_zone: null, hour_format: "auto", seconds: false });

/** Only `min` and `max` override the counter entity's own range. */
function normalizeCounter(raw) {
  const block = blockOf(raw, MODE.COUNTER);
  const min = toNumber(block.min, null, -1e9, 1e9);
  const max = toNumber(block.max, null, -1e9, 1e9);
  if (min != null && max != null && max <= min) throw new Error("slabton-card: counter.max must be greater than counter.min");
  return { min, max };
}

function normalizeTimer(raw) {
  const block = blockOf(raw, MODE.TIMER);
  return {
    pulse: block.pulse !== false,
    pulse_seconds: toNumber(block.pulse_seconds, TIMER_DEFAULTS.pulse_seconds, 0, 3600),
    info: normalizeText(block.info, "timer.info", MODE.TIMER),
    time_zone: normalizeTimeZone(block.time_zone, "timer.time_zone"),
    span: toNumber(block.span, TIMER_DEFAULTS.span, 0.01, 3650),
  };
}

function normalizeClock(raw) {
  const block = blockOf(raw, MODE.CLOCK);
  const display = pickEnum(block.display, CLOCK_DISPLAYS, CLOCK_DEFAULTS.display, "clock.display");
  if (display === "analog") warn('clock.display "analog" is reserved for a later release; showing the digital clock');
  return {
    display: "digital",
    time_zone: normalizeTimeZone(block.time_zone, "clock.time_zone"),
    hour_format: pickEnum(block.hour_format == null ? null : String(block.hour_format), HOUR_FORMATS, CLOCK_DEFAULTS.hour_format, "clock.hour_format"),
    seconds: block.seconds === true,
  };
}

/** Warn about reserved keys and about mode blocks that the active mode ignores. */
function warnUnusedKeys(raw, mode) {
  for (const key of RESERVED_KEYS) {
    if (raw[key] != null) warn(`${key} is reserved for a later release and is ignored`);
  }
  for (const block of OPTIONAL_BLOCKS) {
    if (raw[block] != null && block !== mode) warn(`${block}: block is ignored in mode "${mode}"`);
  }
}

/** Options of the lock mode. */
function normalizeLock(raw) {
  return {
    swipe_threshold: toNumber(raw.swipe_threshold, DEFAULTS.swipe_threshold, 30, 100),
    unlock_action: normalizeAction(raw.unlock_action, "unlock_action"),
    lock_action: normalizeAction(raw.lock_action, "lock_action"),
    arm_service: pickEnum(raw.arm_service, ARM_SERVICES, DEFAULTS.arm_service, "arm_service"),
  };
}

export function normalizeConfig(raw) {
  if (!isPlainObject(raw)) throw new Error("slabton-card: invalid configuration");
  const hasEntity = raw.entity != null && raw.entity !== "";
  // The clock needs no entity; every other mode does.
  if (!hasEntity && raw.mode !== MODE.CLOCK) throw new Error("slabton-card: entity is required");
  const entity = hasEntity ? checkEntity(raw.entity, "entity") : null;
  const domain = entity ? entity.split(".")[0] : "";

  const mode = pickEnum(raw.mode, MODES, inferMode(domain), "mode");
  const { source, barEntity } = resolveBar(raw);
  const preset = pickEnum(source.preset, PRESET_NAMES, "none", "preset");
  const presetDefaults = PRESETS[preset] ?? {};
  const states = normalizeStates(raw.states);
  if (mode === MODE.STATE) warnUnreachableStates(states, domain);
  warnUnusedKeys(raw, mode);

  // `thresholds`, `scale`, `shape` and `control` are reserved (RESERVED_KEYS) and intentionally ignored.
  return {
    type: typeof raw.type === "string" ? raw.type : "custom:slabton-card",
    entity,
    mode,
    name: str(raw.name),
    icon: str(raw.icon) ?? presetDefaults.icon ?? null,
    bar_entity: barEntity,
    bar_text: normalizeText(raw.bar_text, "bar_text", mode),
    counter: mode === MODE.COUNTER ? normalizeCounter(raw) : { ...COUNTER_DEFAULTS },
    timer: mode === MODE.TIMER ? normalizeTimer(raw) : { ...TIMER_DEFAULTS },
    clock: mode === MODE.CLOCK ? normalizeClock(raw) : { ...CLOCK_DEFAULTS },
    ...normalizeLayout(raw, mode),
    ...normalizeLook(raw),
    ...normalizeTriggers(raw),
    states,
    hold_reverse: raw.hold_reverse === true,
    drag: raw.drag !== false,
    ...normalizeLock(raw),
    preset,
    ...normalizeRange(source, presetDefaults),
    switches: normalizeSwitches(raw.switches),
    text: normalizeTextStyle(raw.text),
  };
}

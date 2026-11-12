/*
 * Config schema, defaults and validation. `normalizeConfig` turns the raw
 * user config into a fully resolved, validated copy (the input is never
 * mutated). Invalid enum values and malformed actions throw an Error whose
 * message Home Assistant shows in the card.
 */

import { ANIMATIONS, DEFAULT_ANIMATION } from "./animations.js";
import {
  ACTION, ACTION_TYPES, DEFAULT_SWITCH_ICON, DOT_ID_RE, IGNORED_HA_ACTIONS, MODE, MODES,
  OFF_VALUES, TOGGLE_DOMAINS,
} from "./constants.js";
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
    handle_content: pickEnum(raw.handle_content, HANDLE_CONTENTS, mode === MODE.VALUE ? "text" : "icon", "handle_content"),
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
    unit: str(raw.unit) ?? presetDefaults.unit ?? null,
    decimals: toNumber(raw.decimals, presetDefaults.decimals ?? 1, 0, 6),
  };
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
  if (raw.entity == null || raw.entity === "") throw new Error("slabton-card: entity is required");
  const entity = checkEntity(raw.entity, "entity");
  const domain = entity.split(".")[0];

  const mode = pickEnum(raw.mode, MODES, inferMode(domain), "mode");
  const preset = pickEnum(raw.preset, PRESET_NAMES, "none", "preset");
  const presetDefaults = PRESETS[preset] ?? {};
  const states = normalizeStates(raw.states);
  if (mode === MODE.STATE) warnUnreachableStates(states, domain);

  // `thresholds` is reserved for a later release and intentionally ignored.
  return {
    type: typeof raw.type === "string" ? raw.type : "custom:slabton-card",
    entity,
    mode,
    name: str(raw.name),
    icon: str(raw.icon) ?? presetDefaults.icon ?? null,
    ...normalizeLayout(raw, mode),
    ...normalizeLook(raw),
    ...normalizeTriggers(raw),
    states,
    hold_reverse: raw.hold_reverse === true,
    drag: raw.drag !== false,
    ...normalizeLock(raw),
    preset,
    ...normalizeRange(raw, presetDefaults),
    switches: normalizeSwitches(raw.switches),
  };
}

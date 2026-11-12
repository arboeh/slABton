/*
 * Mode `state`: multi-state switch. Click cycles through the state list;
 * dragging snaps to the nearest state. Works with select/input_select
 * (options), climate (hvac_modes) and on/off domains.
 */

/**
 * View model every mode returns from `view()`; consumed by `render.js`.
 * @typedef {object} ModeView
 * @property {number} pos - logical handle position 0..1 (where the handle is drawn)
 * @property {number} fillPos - logical bar fill 0..1 (how far the bar is filled)
 * @property {string|null} icon - handle icon
 * @property {string} text - handle text and aria value text
 * @property {string} positionText - 1-based position or percent shown for `handle_content: position`
 * @property {string|null} color - CSS color that overrides the fill color, or null
 * @property {boolean} unavailable - entity missing or unavailable
 * @property {number} ariaNow - aria-valuenow, 0..100
 * @property {string} ariaText - aria-valuetext
 * @property {boolean} [locked] - lock mode only
 */

import { ACTION, MODE, OFF_VALUES, TOGGLE_DOMAINS } from "../constants.js";
import { isUnavailable, resolveHandlePosition } from "../util.js";

export const id = MODE.STATE;

function domainOf(config) {
  return config.entity.split(".")[0];
}

/** A state entry with only a value. */
function plainState(value) {
  return { value, label: null, icon: null, text: null, color: null };
}

/** Configured states, else derived from the entity. */
export function resolveStates(config, stateObj) {
  if (config.states.length) return config.states;
  const attrs = stateObj?.attributes ?? {};
  const derived = domainOf(config) === "climate" ? attrs.hvac_modes : attrs.options;
  if (Array.isArray(derived) && derived.length) return derived.map((value) => plainState(String(value)));
  return ["off", "on"].map(plainState);
}

/** perform-action that sets the entity to `value`. */
export function selectAction(config, value) {
  const domain = domainOf(config);
  const target = { entity_id: config.entity };
  if (domain === "select" || domain === "input_select") {
    return { action: ACTION.PERFORM, perform_action: `${domain}.select_option`, target, data: { option: value } };
  }
  if (domain === "climate") {
    return { action: ACTION.PERFORM, perform_action: "climate.set_hvac_mode", target, data: { hvac_mode: value } };
  }
  const service = OFF_VALUES.includes(value) ? "turn_off" : "turn_on";
  const serviceDomain = TOGGLE_DOMAINS.includes(domain) ? domain : "homeassistant";
  return { action: ACTION.PERFORM, perform_action: `${serviceDomain}.${service}`, target };
}

export function view(config, stateObj, pending) {
  const states = resolveStates(config, stateObj);
  const unavailable = isUnavailable(stateObj);
  const current = pending ?? stateObj?.state;
  const index = states.findIndex((s) => s.value === current);
  const known = index >= 0;
  const valuePos = known && states.length > 1 ? index / (states.length - 1) : 0;
  const isOn = known && !OFF_VALUES.includes(current);
  const entry = known ? states[index] : null;
  return {
    pos: resolveHandlePosition(config, valuePos, isOn),
    fillPos: valuePos,
    icon: entry?.icon ?? config.icon ?? stateObj?.attributes?.icon ?? null,
    text: entry?.text ?? entry?.label ?? current ?? "",
    positionText: known ? String(index + 1) : "–",
    color: entry?.color ?? null,
    unavailable,
    ariaNow: Math.round(valuePos * 100),
    ariaText: entry?.label ?? current ?? "",
  };
}

export function defaultActions(config) {
  return {
    tap_action: { action: ACTION.CYCLE },
    double_tap_action: { action: ACTION.NONE },
    hold_action: { action: config.hold_reverse ? ACTION.CYCLE_BACK : ACTION.NONE },
  };
}

/** Next/previous state as { action, value }, or null with fewer than two states. */
export function cycleAction(config, stateObj, step, pending) {
  const states = resolveStates(config, stateObj);
  if (states.length < 2) return null;
  const current = states.findIndex((s) => s.value === (pending ?? stateObj?.state));
  let next;
  if (current < 0) next = step > 0 ? 0 : states.length - 1;
  else next = (current + step + states.length) % states.length;
  const value = states[next].value;
  return { action: selectAction(config, value), value };
}

export function isDraggable(config, stateObj) {
  return config.drag && config.handle_position === "flex" && resolveStates(config, stateObj).length > 1;
}

/** Drag release: snap to the nearest state; null when it is already active. */
export function onRelease({ frac, config, stateObj, pending }) {
  const states = resolveStates(config, stateObj);
  if (states.length < 2) return null;
  const index = Math.round(frac * (states.length - 1));
  const value = states[index].value;
  if (value === (pending ?? stateObj?.state)) return null;
  return { action: selectAction(config, value), pending: value };
}

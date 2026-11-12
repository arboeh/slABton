/*
 * Mode `counter`: shows a Home Assistant `counter.*` entity. The bar fills
 * with the value between min and max. Range priority: `counter.min/max`,
 * then `bar.min/max` (or flat `min/max`), then the entity attributes
 * `minimum` / `maximum`, then 0 / 100. Tap increments, double tap decrements;
 * a reset is never a default action (configure `hold_action` for it).
 */

import { ACTION, MODE } from "../constants.js";
import { clamp, formatValue, isUnavailable, resolveHandlePosition } from "../util.js";

export const id = MODE.COUNTER;

const finite = (value) => (value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

/** Effective { min, max } for the entity. */
export function range(config, stateObj) {
  const attrs = stateObj?.attributes ?? {};
  const min = config.counter.min ?? (config.range_set.min ? config.min : null) ?? finite(attrs.minimum) ?? config.min;
  const max = config.counter.max ?? (config.range_set.max ? config.max : null) ?? finite(attrs.maximum) ?? config.max;
  return { min, max };
}

function parse(stateObj) {
  const raw = stateObj?.state;
  if (typeof raw !== "string" || raw.trim() === "") return NaN;
  return Number(raw);
}

export function view(config, stateObj) {
  const value = parse(stateObj);
  const valid = Number.isFinite(value) && !isUnavailable(stateObj);
  const { min, max } = range(config, stateObj);
  const rangeOk = max > min;
  const frac = valid && rangeOk ? clamp((value - min) / (max - min), 0, 1) : 0;
  const text = valid ? formatValue(value, 0, config.unit) : "–";
  return {
    pos: resolveHandlePosition(config, frac, frac > 0),
    fillPos: frac,
    icon: config.icon ?? stateObj?.attributes?.icon ?? "mdi:counter",
    text,
    positionText: String(Math.round(frac * 100)),
    color: null,
    unavailable: !valid,
    ariaNow: Math.round(frac * 100),
    ariaText: text,
    values: { state: stateObj?.state ?? "", value: text },
    notice: rangeOk ? null : "invalid_range",
  };
}

export function defaultActions(config) {
  const target = { entity_id: config.entity };
  return {
    tap_action: { action: ACTION.PERFORM, perform_action: "counter.increment", target },
    double_tap_action: { action: ACTION.PERFORM, perform_action: "counter.decrement", target },
    hold_action: { action: ACTION.NONE },
  };
}

export function isDraggable() {
  return false;
}

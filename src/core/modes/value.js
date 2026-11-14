/*
 * Mode `value`: shows a number on a bar between `min` and `max`; presets
 * (thermometer, energy, soc) only provide defaults for range, unit and icon
 * (see config.js). `input_number` and `number` entities can also be set: the
 * handle is dragged (or moved with the arrow keys) and `set_value` is called
 * on release. Range priority: explicit `bar.min/max` or flat `min/max`, then
 * the entity attributes `min` / `max` (settable domains), then preset / 0..100.
 * Step: `step` option, then the attribute `step`, else stepless.
 */

import { ACTION, MODE, NOTICE, VALUE_SETTABLE_DOMAINS, infoActions } from "../constants.js";
import { clamp, formatValue, isUnavailable, parseNumericState, resolveHandlePosition } from "../util.js";

export const id = MODE.VALUE;

/** Tolerance when counting steps (float noise of `(value - min) / step`). */
const STEP_EPSILON = 1e-9;
/** Share of the range one arrow key press moves without a step. */
const KEY_STEP_SHARE = 0.01;

const finite = (value) => (value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

const domainOf = (config, stateObj) => String(stateObj?.entity_id ?? config.entity ?? "").split(".")[0];

/** Number of decimal places of `n` (0.25 -> 2). */
function decimalPlaces(n) {
  const text = String(n);
  if (text.includes("e-")) return Number(text.split("e-")[1]) + (text.split("e-")[0].split(".")[1]?.length ?? 0);
  return text.split(".")[1]?.length ?? 0;
}

/** Effective { min, max } of the entity (attributes only for settable domains). */
export function range(config, stateObj) {
  if (!VALUE_SETTABLE_DOMAINS.includes(domainOf(config, stateObj))) return { min: config.min, max: config.max };
  const attrs = stateObj?.attributes ?? {};
  const min = (config.range_set.min ? config.min : null) ?? finite(attrs.min) ?? config.min;
  const max = (config.range_set.max ? config.max : null) ?? finite(attrs.max) ?? config.max;
  return { min, max };
}

/** Step size: `step` option, else the attribute `step`, else null (stepless). */
export function resolveStep(config, stateObj) {
  if (config.step != null) return config.step;
  const step = finite(stateObj?.attributes?.step);
  return step != null && step > 0 ? step : null;
}

/** Fraction (0..1), formatted text and validity of a numeric entity against its range. */
export function measure(config, stateObj, pending) {
  const value = pending ?? parseNumericState(stateObj);
  const valid = Number.isFinite(value) && !isUnavailable(stateObj);
  const { min, max } = range(config, stateObj);
  const rangeOk = max > min;
  const frac = valid && rangeOk ? clamp((value - min) / (max - min), 0, 1) : 0;
  const unit = config.unit ?? stateObj?.attributes?.unit_of_measurement ?? null;
  const text = valid ? formatValue(value, config.decimals, unit) : "–";
  return { valid, frac, text, value, rangeOk };
}

/** Round `raw` to the step grid (counted from `min`) or, stepless, to the decimals; kept within the range. */
function snap(config, stateObj, raw) {
  const { min, max } = range(config, stateObj);
  const step = resolveStep(config, stateObj);
  if (step == null) return Number(clamp(raw, min, max).toFixed(config.decimals));
  const lastIndex = Math.floor((max - min) / step + STEP_EPSILON);
  const index = clamp(Math.round((raw - min) / step), 0, lastIndex);
  return Number((min + index * step).toFixed(Math.max(decimalPlaces(step), decimalPlaces(min))));
}

/** Value (rounded to step or decimals, within the range) at a logical position 0..1. */
export function valueAt(config, stateObj, frac) {
  const { min, max } = range(config, stateObj);
  return snap(config, stateObj, min + clamp(frac, 0, 1) * (max - min));
}

/** The entity can be set from the card: settable domain, drag on, available, valid range, own bar. */
export function isDraggable(config, stateObj) {
  if (!config || !VALUE_SETTABLE_DOMAINS.includes(domainOf(config))) return false;
  if (!config.drag || config.bar_entity || config.handle_position !== "flex") return false;
  if (isUnavailable(stateObj) || !Number.isFinite(parseNumericState(stateObj))) return false;
  const { min, max } = range(config, stateObj);
  return max > min;
}

export function view(config, stateObj, pending, ctx) {
  const draggable = isDraggable(config, stateObj);
  const live = draggable && ctx?.dragPos != null ? valueAt(config, stateObj, ctx.dragPos) : undefined;
  const { valid, frac, text, rangeOk } = measure(config, stateObj, live ?? pending);
  return {
    pos: resolveHandlePosition(config, frac, frac > 0),
    fillPos: frac,
    icon: config.icon ?? stateObj?.attributes?.icon ?? "mdi:gauge",
    text,
    positionText: String(Math.round(frac * 100)),
    color: null,
    unavailable: !valid,
    ariaNow: Math.round(frac * 100),
    ariaText: text,
    notice: rangeOk ? null : NOTICE.INVALID_VALUE_RANGE,
  };
}

export const defaultActions = infoActions;

/** perform-action that sets the entity to `value`, plus the optimistic value. */
function setValue(config, value) {
  const domain = config.entity.split(".")[0];
  return {
    action: {
      action: ACTION.PERFORM,
      perform_action: `${domain}.set_value`,
      target: { entity_id: config.entity },
      data: { value },
    },
    pending: value,
  };
}

/** Value now shown: the optimistic value, else the entity state. */
const currentValue = (stateObj, pending) => pending ?? parseNumericState(stateObj);

/**
 * Drag release: set the value under the handle. Null when it is unchanged, when the entity is not
 * settable, or when the handle ended on the grid point it started from (a value off the grid
 * must not be rewritten by a drag that did not move it).
 */
export function onRelease({ frac, startPos, config, stateObj, pending }) {
  if (!isDraggable(config, stateObj)) return null;
  const value = valueAt(config, stateObj, frac);
  if (value === currentValue(stateObj, pending)) return null;
  if (startPos != null && value === valueAt(config, stateObj, startPos)) return null;
  return setValue(config, value);
}

/** Arrow key: one step (stepless: 1 % of the range, at least one unit of the last decimal) up or down. */
export function stepRelease({ direction, config, stateObj, pending }) {
  if (!isDraggable(config, stateObj)) return null;
  const { min, max } = range(config, stateObj);
  const size = resolveStep(config, stateObj) ?? Math.max((max - min) * KEY_STEP_SHARE, 10 ** -config.decimals);
  const current = currentValue(stateObj, pending);
  const value = snap(config, stateObj, current + direction * size);
  if (value === current) return null;
  return setValue(config, value);
}

/*
 * Mode `value`: read-only display. The bar fills with the entity value
 * between `min` and `max`; presets (thermometer, energy, soc) only provide
 * defaults for range, unit and icon (see config.js).
 */

import { MODE, infoActions } from "../constants.js";
import { clamp, formatValue, isUnavailable, parseNumericState, resolveHandlePosition } from "../util.js";

export const id = MODE.VALUE;

/** Fraction (0..1), formatted text and validity of a numeric entity against the configured range. */
export function measure(config, stateObj) {
  const value = parseNumericState(stateObj);
  const valid = Number.isFinite(value) && !isUnavailable(stateObj);
  const frac = valid ? clamp((value - config.min) / (config.max - config.min), 0, 1) : 0;
  const unit = config.unit ?? stateObj?.attributes?.unit_of_measurement ?? null;
  const text = valid ? formatValue(value, config.decimals, unit) : "–";
  return { valid, frac, text, value };
}

export function view(config, stateObj) {
  const { valid, frac, text } = measure(config, stateObj);
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
  };
}

export const defaultActions = infoActions;

export function isDraggable() {
  return false;
}

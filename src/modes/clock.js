/*
 * Mode `clock`: digital clock in a time zone. The handle text is the time,
 * the bar fills with the progress of the day (0:00 -> 24:00 in that zone).
 * Needs no entity. `clock.display: analog` is reserved (rendered as digital).
 * The card ticks once per second while the clock is on screen.
 */

import { ACTION, MODE } from "../constants.js";
import { t } from "../i18n.js";
import { dayProgress, formatClock, resolveTimeZone } from "../time.js";
import { resolveHandlePosition } from "../util.js";

export const id = MODE.CLOCK;

export function view(config, _stateObj, _pending, ctx) {
  const zone = resolveTimeZone(config.clock.time_zone, ctx.hassTimeZone);
  const time = formatClock(ctx.now, zone, {
    hourFormat: config.clock.hour_format,
    seconds: config.clock.seconds,
    locale: ctx.locale,
  });
  const frac = dayProgress(ctx.now, zone);
  return {
    pos: resolveHandlePosition(config, frac, true),
    fillPos: frac,
    icon: config.icon ?? "mdi:clock-outline",
    text: time,
    positionText: String(Math.round(frac * 100)),
    color: null,
    unavailable: false,
    ariaNow: Math.round(frac * 100),
    ariaText: time,
    ticking: true,
    values: { name: config.name ?? t(ctx.lang, "clock.name"), state: time, value: time, time },
  };
}

/** The clock has nothing to act on by default. */
export function defaultActions() {
  return {
    tap_action: { action: ACTION.NONE },
    double_tap_action: { action: ACTION.NONE },
    hold_action: { action: ACTION.NONE },
  };
}

export function needsTick() {
  return true;
}

export function isDraggable() {
  return false;
}

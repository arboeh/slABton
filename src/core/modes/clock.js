/*
 * Mode `clock`: clock in a time zone. The handle shows the time as text
 * (`display: digital`) or as a dial (`display: analog`, see `view().dial`);
 * the bar fills with the progress of the day (0:00 -> 24:00 in that zone).
 * Needs no entity. The card ticks once per second while the clock is on screen.
 */

import { ACTION, MODE } from "../constants.js";
import { t } from "../i18n.js";
import { dayProgress, formatClock, resolveTimeZone, zonedParts } from "../time.js";
import { resolveHandlePosition } from "../util.js";

export const id = MODE.CLOCK;

const DEGREES_PER_HOUR = 30;
const DEGREES_PER_MINUTE = 6;
const HOURS_ON_DIAL = 12;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

/**
 * Hand angles in degrees, clockwise from 12 o'clock. The dial always has 12 hours,
 * whatever `hour_format` says. `second` is null when the seconds hand is off.
 */
export function dialAngles(epochMs, timeZone, withSeconds) {
  const { hour, minute, second } = zonedParts(epochMs, timeZone);
  return {
    hour: ((hour % HOURS_ON_DIAL) + minute / MINUTES_PER_HOUR) * DEGREES_PER_HOUR,
    minute: (minute + second / SECONDS_PER_MINUTE) * DEGREES_PER_MINUTE,
    second: withSeconds ? second * DEGREES_PER_MINUTE : null,
  };
}

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
    dial: config.clock.display === "analog" ? dialAngles(ctx.now, zone, config.clock.seconds) : null,
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

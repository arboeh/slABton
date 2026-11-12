/*
 * Mode `timer`. Two sources:
 *  - `timer.*` (Home Assistant timer): the bar drains from the full duration
 *    to zero; remaining time comes from `finishes_at` (active) or `remaining`.
 *  - `input_datetime.*` (with date) / `input_date.*`: countdown to a target.
 *    The bar is full from `timer.span` days left and drains to the target.
 * The view is a pure function of (config, state, ctx); `ctx.now` is the
 * current time in ms. Expiry (for the pulse) is detected from two successive
 * `timing` samples by `detectExpiry`.
 */

import { ACTION, MODE, infoActions } from "../constants.js";
import { t } from "../i18n.js";
import {
  formatRemaining, formatRemainingText, formatTarget, isTimeOnly, parseDuration, resolveTimeZone, splitDuration,
  targetEpoch,
} from "../time.js";
import { clamp, isUnavailable, resolveHandlePosition } from "../util.js";

export const id = MODE.TIMER;

/** A timer that goes idle this close before its end (or later) counts as finished, not cancelled. */
export const EXPIRY_TOLERANCE_MS = 2000;

const DAY_SECONDS = 86400;
const TARGET_DOMAINS = ["input_datetime", "input_date"];
const ICONS = { idle: "mdi:timer-outline", active: "mdi:timer-sand", paused: "mdi:timer-pause-outline", expired: "mdi:timer-alert-outline" };

const domainOf = (config) => config.entity.split(".")[0];

function sourceOf(config) {
  const domain = domainOf(config);
  if (domain === "timer") return "ha";
  return TARGET_DOMAINS.includes(domain) ? "target" : "unsupported";
}

const secondsOrNull = (value) => (Number.isFinite(value) ? value : null);

/** Time zone for input_datetime / input_date and `{target}`. */
function zoneFor(config, ctx) {
  return resolveTimeZone(config.timer.time_zone, ctx.hassTimeZone);
}

/**
 * Raw timer facts at `ctx.now`:
 * { kind, status, remaining (s|null), duration (s|null), finishesAt (ms|null), active, notice }.
 * `status` is idle | active | paused | expired | unknown.
 */
function sample(config, stateObj, ctx) {
  const kind = sourceOf(config);
  const empty = { kind, status: "unknown", remaining: null, duration: null, finishesAt: null, active: false, notice: null };
  if (kind === "unsupported") return { ...empty, notice: "unsupported_entity" };
  if (isUnavailable(stateObj)) return empty;

  if (kind === "ha") {
    const attrs = stateObj.attributes ?? {};
    const status = ["idle", "active", "paused"].includes(stateObj.state) ? stateObj.state : "unknown";
    const duration = secondsOrNull(parseDuration(attrs.duration));
    let remaining = null;
    let finishesAt = null;
    if (status === "active") {
      const finish = Date.parse(attrs.finishes_at);
      if (Number.isFinite(finish)) {
        finishesAt = finish;
        remaining = Math.max(0, Math.ceil((finish - ctx.now) / 1000));
      } else {
        remaining = secondsOrNull(parseDuration(attrs.remaining));
      }
    } else if (status === "paused") {
      remaining = secondsOrNull(parseDuration(attrs.remaining));
    } else if (status === "idle") {
      remaining = duration;
    }
    return { kind, status, remaining, duration, finishesAt, active: status === "active", notice: null };
  }

  const state = stateObj.state;
  if (isTimeOnly(state)) return { ...empty, notice: "time_only" };
  const target = targetEpoch(state, zoneFor(config, ctx));
  if (target == null) return empty;
  const remaining = Math.max(0, Math.ceil((target - ctx.now) / 1000));
  const active = remaining > 0;
  return { kind, status: active ? "active" : "expired", remaining, duration: null, finishesAt: target, active, notice: null };
}

/**
 * Expiry-relevant facts of a sample: running, end time, and `upcoming` (running
 * with the end still in the future when sampled). Null without a usable timer.
 */
function timingOf(s, now) {
  if (s.status === "unknown") return null;
  return { active: s.active, finishesAt: s.finishesAt, upcoming: s.active && s.finishesAt != null && s.finishesAt > now };
}

export function timing(config, stateObj, ctx) {
  return timingOf(sample(config, stateObj, ctx), ctx.now);
}

/**
 * True when the timer ran out between two samples. `previous` is the last
 * `timing`, `current` the new one. Only a timer that was seen counting down
 * can expire: loading a card on a stale state, cancelling (idle well before
 * the end) and moving the target are not expiry.
 */
export function detectExpiry(previous, current, now) {
  if (!previous?.upcoming) return false;
  if (current?.active) return current.finishesAt != null && now >= current.finishesAt;
  return now >= previous.finishesAt - EXPIRY_TOLERANCE_MS;
}

/** True while the view changes by itself (a countdown is running). */
export function needsTick(view) {
  return view.ticking === true;
}

function iconFor(config, stateObj, status) {
  return config.icon ?? stateObj?.attributes?.icon ?? ICONS[status] ?? ICONS.idle;
}

function stateLabel(lang, status, raw) {
  return ["idle", "active", "paused", "expired"].includes(status) ? t(lang, `timer.${status}`) : (raw ?? "");
}

export function view(config, stateObj, _pending, ctx) {
  const s = sample(config, stateObj, ctx);
  const lang = ctx.lang;
  const status = ctx.expired ? "expired" : s.status;
  const label = stateLabel(lang, status, stateObj?.state);
  const known = s.remaining != null;

  let frac = 0;
  if (known && s.kind === "ha" && s.duration > 0) frac = clamp(s.remaining / s.duration, 0, 1);
  if (known && s.kind === "target") frac = clamp(s.remaining / (config.timer.span * DAY_SECONDS), 0, 1);

  const remainingText = known ? formatRemaining(s.remaining, lang) : null;
  const text = ctx.expired ? label : (remainingText ?? (s.status === "unknown" ? "–" : label));
  const parts = known ? splitDuration(s.remaining) : null;
  const zone = zoneFor(config, ctx);
  const withTime = domainOf(config) !== "input_date" && stateObj?.attributes?.has_time !== false;
  let target = null;
  if (s.finishesAt != null && (s.kind === "target" || s.status === "active")) {
    target = formatTarget(s.finishesAt, zone, ctx.locale, withTime || s.kind === "ha");
  }

  return {
    pos: resolveHandlePosition(config, frac, frac > 0),
    fillPos: frac,
    icon: iconFor(config, stateObj, status),
    text,
    positionText: String(Math.round(frac * 100)),
    color: null,
    unavailable: s.status === "unknown",
    ariaNow: Math.round(frac * 100),
    ariaText: known ? t(lang, "aria.timer", { state: label, remaining: formatRemainingText(lang, s.remaining) }) : label,
    ticking: s.active && s.remaining > 0,
    notice: s.notice,
    timing: timingOf(s, ctx.now),
    values: {
      state: label,
      value: remainingText,
      remaining: remainingText,
      remaining_text: known ? formatRemainingText(lang, s.remaining) : null,
      days: parts?.days ?? null,
      hours: parts?.hours ?? null,
      minutes: parts?.minutes ?? null,
      seconds: parts?.seconds ?? null,
      elapsed: known && s.duration != null ? formatRemaining(s.duration - s.remaining, lang) : null,
      target,
    },
  };
}

/** Home Assistant timers start / pause / cancel; countdown targets open more-info. */
export function defaultActions(config, stateObj) {
  if (sourceOf(config) !== "ha") return infoActions();
  const target = { entity_id: config.entity };
  const service = (name) => ({ action: ACTION.PERFORM, perform_action: `timer.${name}`, target });
  return {
    tap_action: service(stateObj?.state === "active" ? "pause" : "start"),
    double_tap_action: { action: ACTION.NONE },
    hold_action: service("cancel"),
  };
}

export function isDraggable() {
  return false;
}

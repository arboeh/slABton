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

import { ACTION, HANDLE_FLEX, MODE, NOTICE, TIMER_SOURCE, TIMER_STATUS, infoActions } from "../constants.js";
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
  if (domain === "timer") return TIMER_SOURCE.HA;
  return TARGET_DOMAINS.includes(domain) ? TIMER_SOURCE.TARGET : TIMER_SOURCE.UNSUPPORTED;
}

const secondsOrNull = (value) => (Number.isFinite(value) ? value : null);

/** Time zone for input_datetime / input_date and `{target}`. */
function zoneFor(config, ctx) {
  return resolveTimeZone(config.timer.time_zone, ctx.hassTimeZone);
}

const emptySample = (kind, notice = null) => ({
  kind, status: TIMER_STATUS.UNKNOWN, remaining: null, duration: null, finishesAt: null, active: false, notice,
});

/** Sample of a Home Assistant `timer.*` entity (state, `finishes_at`, `remaining`, `duration`). */
function sampleHaTimer(stateObj, ctx) {
  const kind = TIMER_SOURCE.HA;
  const attrs = stateObj.attributes ?? {};
  const status = [TIMER_STATUS.IDLE, TIMER_STATUS.ACTIVE, TIMER_STATUS.PAUSED].includes(stateObj.state)
    ? stateObj.state : TIMER_STATUS.UNKNOWN;
  const duration = secondsOrNull(parseDuration(attrs.duration));
  let remaining = null;
  let finishesAt = null;
  if (status === TIMER_STATUS.ACTIVE) {
    const finish = Date.parse(attrs.finishes_at);
    if (Number.isFinite(finish)) {
      finishesAt = finish;
      remaining = Math.max(0, Math.ceil((finish - ctx.now) / 1000));
    } else {
      remaining = secondsOrNull(parseDuration(attrs.remaining));
    }
  } else if (status === TIMER_STATUS.PAUSED) {
    remaining = secondsOrNull(parseDuration(attrs.remaining));
  } else if (status === TIMER_STATUS.IDLE) {
    remaining = duration;
  }
  return { kind, status, remaining, duration, finishesAt, active: status === TIMER_STATUS.ACTIVE, notice: null };
}

/** Sample of an `input_datetime` / `input_date` countdown target. */
function sampleTarget(config, stateObj, ctx) {
  const kind = TIMER_SOURCE.TARGET;
  const state = stateObj.state;
  if (isTimeOnly(state)) return emptySample(kind, NOTICE.TIME_ONLY);
  const target = targetEpoch(state, zoneFor(config, ctx));
  if (target == null) return emptySample(kind);
  const remaining = Math.max(0, Math.ceil((target - ctx.now) / 1000));
  const active = remaining > 0;
  return { kind, status: active ? TIMER_STATUS.ACTIVE : TIMER_STATUS.EXPIRED, remaining, duration: null, finishesAt: target, active, notice: null };
}

/**
 * Raw timer facts at `ctx.now`:
 * { kind, status, remaining (s|null), duration (s|null), finishesAt (ms|null), active, notice }.
 * `status` is idle | active | paused | expired | unknown.
 */
function sample(config, stateObj, ctx) {
  const kind = sourceOf(config);
  if (kind === TIMER_SOURCE.UNSUPPORTED) return emptySample(kind, NOTICE.UNSUPPORTED_ENTITY);
  if (isUnavailable(stateObj)) return emptySample(kind);
  return kind === TIMER_SOURCE.HA ? sampleHaTimer(stateObj, ctx) : sampleTarget(config, stateObj, ctx);
}

/**
 * Expiry-relevant facts of a sample: running, end time, and `upcoming` (running
 * with the end still in the future when sampled). Null without a usable timer.
 */
function timingOf(s, now) {
  if (s.status === TIMER_STATUS.UNKNOWN) return null;
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
  return [TIMER_STATUS.IDLE, TIMER_STATUS.ACTIVE, TIMER_STATUS.PAUSED, TIMER_STATUS.EXPIRED].includes(status) ? t(lang, `timer.${status}`) : (raw ?? "");
}

export function view(config, stateObj, _pending, ctx) {
  const s = sample(config, stateObj, ctx);
  const lang = ctx.lang;
  const status = ctx.expired ? TIMER_STATUS.EXPIRED : s.status;
  const label = stateLabel(lang, status, stateObj?.state);
  const known = s.remaining != null;

  let frac = 0;
  if (known && s.kind === TIMER_SOURCE.HA && s.duration > 0) frac = clamp(s.remaining / s.duration, 0, 1);
  if (known && s.kind === TIMER_SOURCE.TARGET) frac = clamp(s.remaining / (config.timer.span * DAY_SECONDS), 0, 1);
  // Switch layout: a timer that is off shows an empty bar, the handle at the start ("off").
  if (s.status === TIMER_STATUS.IDLE && isSwitchLike(config)) frac = 0;

  const remainingText = known ? formatRemaining(s.remaining, lang) : null;
  const text = ctx.expired ? label : (remainingText ?? (s.status === TIMER_STATUS.UNKNOWN ? "–" : label));
  const parts = known ? splitDuration(s.remaining) : null;
  const zone = zoneFor(config, ctx);
  const withTime = domainOf(config) !== "input_date" && stateObj?.attributes?.has_time !== false;
  let target = null;
  if (s.finishesAt != null && (s.kind === TIMER_SOURCE.TARGET || s.status === TIMER_STATUS.ACTIVE)) {
    target = formatTarget(s.finishesAt, zone, ctx.locale, withTime || s.kind === TIMER_SOURCE.HA);
  }

  return {
    pos: resolveHandlePosition(config, frac, frac > 0),
    fillPos: frac,
    icon: iconFor(config, stateObj, status),
    text,
    positionText: String(Math.round(frac * 100)),
    color: null,
    unavailable: s.status === TIMER_STATUS.UNKNOWN,
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

/** The `timer.<name>` service call on this entity: the mode's defaults and the card's start / end hooks share it. */
const timerService = (config, name) => ({
  action: ACTION.PERFORM, perform_action: `timer.${name}`, target: { entity_id: config.entity },
});

/** Home Assistant timers start / pause / cancel; countdown targets open more-info. */
export function defaultActions(config, stateObj) {
  if (sourceOf(config) !== TIMER_SOURCE.HA) return infoActions();
  return {
    tap_action: timerService(config, stateObj?.state === TIMER_STATUS.ACTIVE ? "pause" : "start"),
    double_tap_action: { action: ACTION.NONE },
    hold_action: timerService(config, "cancel"),
  };
}

/** Edges of a Home Assistant timer run that the `timer.start_action` / `timer.end_action` hook onto. */
export const EDGE = Object.freeze({ START: "start", CANCEL: "cancel" });

/** Share of the track the handle must pass towards the full end to start a timer that is off. */
const SWIPE_START_FRAC = 0.5;

const startAction = (config) => timerService(config, "start");

/**
 * Which edge of the timer run `action` causes, or null: `start` (timer.start of this entity while it is idle: a
 * resume from paused is no new start) or `cancel` (timer.cancel of this entity while it runs or is paused).
 * Only the card's own actions count; a start from outside never reaches this.
 */
export function edgeOf(config, stateObj, action) {
  if (sourceOf(config) !== TIMER_SOURCE.HA || action?.action !== ACTION.PERFORM) return null;
  const ids = [action.target?.entity_id].flat();
  if (ids.length !== 1 || ids[0] !== config.entity) return null;
  if (action.perform_action === "timer.start" && stateObj?.state === TIMER_STATUS.IDLE) return EDGE.START;
  const running = [TIMER_STATUS.ACTIVE, TIMER_STATUS.PAUSED].includes(stateObj?.state);
  return action.perform_action === "timer.cancel" && running ? EDGE.CANCEL : null;
}

const cancelAction = (config) => timerService(config, "cancel");

/** A running timer is stopped or restarted by dragging the handle into this outer share of the track. */
const EDGE_ZONE = 0.1;

/**
 * Switch layout of a Home Assistant timer: both `start_action` and `end_action` are configured. The handle then
 * sits at the start of the track while the timer is off, and the timer drains from the full end back to it.
 * Without both actions the card behaves as before.
 */
function isSwitchLike(config) {
  return sourceOf(config) === TIMER_SOURCE.HA && Boolean(config.timer.start_action && config.timer.end_action);
}

/**
 * In the switch layout the handle can be dragged: from off towards the full end starts the timer, while it runs
 * or is paused to the full end restarts it (resumes a paused one) and back to the start stops it.
 */
export function isDraggable(config, stateObj) {
  if (!config?.drag || config.handle_position !== HANDLE_FLEX || !isSwitchLike(config)) return false;
  if (![TIMER_STATUS.IDLE, TIMER_STATUS.ACTIVE, TIMER_STATUS.PAUSED].includes(stateObj?.state)) return false;
  return secondsOrNull(parseDuration(stateObj.attributes?.duration)) > 0;
}

/**
 * Drag release. Off: past the middle starts. Running or paused: into the full end (from outside it) starts again,
 * into the start end (from outside it) cancels. Anything else springs the handle back.
 */
export function onRelease({ frac, startPos, config, stateObj }) {
  if (!isDraggable(config, stateObj)) return null;
  if (stateObj.state === TIMER_STATUS.IDLE) {
    return frac >= SWIPE_START_FRAC ? { action: startAction(config), pending: undefined } : null;
  }
  if (frac >= 1 - EDGE_ZONE && startPos < 1 - EDGE_ZONE) return { action: startAction(config), pending: undefined };
  if (frac <= EDGE_ZONE && startPos > EDGE_ZONE) return { action: cancelAction(config), pending: undefined };
  return null;
}

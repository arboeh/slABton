/*
 * Mode `value`: shows a number on a bar between `min` and `max`; presets
 * (thermometer, energy, soc) only provide defaults for range, unit and icon
 * (see config.js). `input_number` and `number` entities can also be set: the
 * handle is dragged (or moved with the arrow keys) and `set_value` is called
 * on release. Range priority: explicit `bar.min/max` or flat `min/max`, then
 * the entity attributes `min` / `max` (settable domains; with `bar.attribute` any domain, plus
 * `min_temp` / `max_temp`), then preset / 0..100.
 * Step: `step` option, then the attribute `step`, else stepless.
 * A `cover` entity shows and sets its position (`current_position`, `cover.set_cover_position`), see "covers" below.
 */

import {
  ACTION, COVER_DEFAULT_ICON, COVER_DOMAIN, COVER_FEATURE, COVER_ICONS, COVER_POSITION_ATTRIBUTE, COVER_STATE,
  HANDLE_FLEX, MAX_SNAP_DECIMALS, MIN_STEP, MODE, NOTICE, VALUE_SETTABLE_DOMAINS, infoActions,
} from "../constants.js";
import { clamp, formatValue, isUnavailable, parseNumericState, resolveHandlePosition } from "../util.js";

export const id = MODE.VALUE;

/**
 * How long an own cover command may go unanswered before the handle returns to the reported position. A cover
 * (Shelly, Z-Wave) reports `opening` / `closing` late, far later than the 3 s of a number entity.
 */
export const COVER_PENDING_TIMEOUT_MS = 10000;

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

/**
 * Effective { min, max } of the entity (attributes only for settable domains). A bar that measures an
 * `attribute` takes `min_temp` / `max_temp` (climate) or `min` / `max` from any domain.
 */
export function range(config, stateObj, attribute) {
  if (!attribute && !VALUE_SETTABLE_DOMAINS.includes(domainOf(config, stateObj))) return { min: config.min, max: config.max };
  const attrs = stateObj?.attributes ?? {};
  const fromEntity = (bound, tempKey) => (attribute ? finite(attrs[tempKey]) : null) ?? finite(attrs[bound]);
  const min = (config.range_set.min ? config.min : null) ?? fromEntity("min", "min_temp") ?? config.min;
  const max = (config.range_set.max ? config.max : null) ?? fromEntity("max", "max_temp") ?? config.max;
  return { min, max };
}

/** Number of an entity attribute (a number or a plain decimal text), NaN when it is neither or missing. */
function parseAttribute(stateObj, attribute) {
  const raw = stateObj?.attributes?.[attribute];
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string" || raw.trim() === "") return NaN;
  return Number(raw);
}

/** Step size: `step` option, else the attribute `step`, else null (stepless). */
export function resolveStep(config, stateObj) {
  if (config.step != null) return config.step;
  const step = finite(stateObj?.attributes?.step);
  return step != null && step >= MIN_STEP ? step : null;
}

// --- covers --------------------------------------------------------------------------------------------------
// A `cover` entity (without a separate `bar.entity`) is measured by its attribute `current_position` (0 closed ..
// 100 open) and set with `cover.set_cover_position`. A cover without a position runs as a plain open / closed
// switch: no drag, the handle sits at the end that matches the state (halfway while it moves).

/** The card's own entity is a cover (a `bar.entity` hands the measuring to the generic rules). */
const isCoverCard = (config) => Boolean(config?.entity) && !config.bar_entity && domainOf(config) === COVER_DOMAIN;

/** `supported_features` of the entity as a bit mask, or null when it has none. */
const featuresOf = (stateObj) => finite(stateObj?.attributes?.supported_features);

/** The entity supports the feature `bit` (false without `supported_features`). */
const supports = (stateObj, bit) => ((featuresOf(stateObj) ?? 0) & bit) !== 0;

const coverPosition = (stateObj) => parseAttribute(stateObj, COVER_POSITION_ATTRIBUTE);

/**
 * The cover reports a position; otherwise the state fallback applies. A cover that only claims the set-position
 * feature but reports no `current_position` (yet) must not leave the card dead: it gets the state view and its taps.
 */
const hasPosition = (stateObj) => Number.isFinite(coverPosition(stateObj));

const isMoving = (stateObj) => stateObj?.state === COVER_STATE.OPENING || stateObj?.state === COVER_STATE.CLOSING;

/** View shared by all value-mode shapes: handle and fill at `frac`, aria values from `frac` and `text`. */
function buildView(config, { frac, text, unavailable, icon, notice = null }) {
  return {
    pos: resolveHandlePosition(config, frac, frac > 0),
    fillPos: frac,
    icon,
    text,
    positionText: String(Math.round(frac * 100)),
    color: null,
    unavailable,
    ariaNow: Math.round(frac * 100),
    ariaText: text,
    notice,
  };
}

/** Value under the dragged handle, undefined when nothing is being dragged. */
function liveValue(config, stateObj, ctx) {
  return isDraggable(config, stateObj) && ctx?.dragPos != null ? valueAt(config, stateObj, ctx.dragPos) : undefined;
}

/** Fraction of the bar per state of a cover without position (0..1). */
const COVER_STATE_FRACTION = Object.freeze({
  [COVER_STATE.CLOSED]: 0, [COVER_STATE.OPEN]: 1, [COVER_STATE.OPENING]: 0.5, [COVER_STATE.CLOSING]: 0.5,
});

/** Icon of a cover: the config, then the entity, then one per state. */
const coverIcon = (config, stateObj) => config.icon ?? stateObj?.attributes?.icon ?? COVER_ICONS[stateObj?.state] ?? COVER_DEFAULT_ICON;

/** Cover without position: state text, bar at the end that matches the state. */
function coverStateView(config, stateObj, pending) {
  const state = pending ?? stateObj?.state;
  const frac = COVER_STATE_FRACTION[state] ?? 0;
  const unavailable = isUnavailable(stateObj);
  const text = unavailable || state == null ? "–" : String(state);
  return { ...buildView(config, { frac, text, unavailable, icon: coverIcon(config, stateObj) }), moving: isMoving(stateObj) };
}

/** Position of a cover as the value mode shows it. `moving` lets the card show the travel. */
function coverPositionView(config, stateObj, pending, ctx) {
  const live = liveValue(config, stateObj, ctx);
  const { valid, frac, text, rangeOk } = measureValue(config, stateObj, live ?? pending ?? coverPosition(stateObj));
  const notice = rangeOk ? null : NOTICE.INVALID_VALUE_RANGE;
  return { ...buildView(config, { frac, text, unavailable: !valid, icon: coverIcon(config, stateObj), notice }), moving: isMoving(stateObj) };
}

/** The cover can be set from the card: position support, drag on, available, valid range. */
function isCoverDraggable(config, stateObj) {
  if (!config.drag || config.handle_position !== HANDLE_FLEX) return false;
  if (isUnavailable(stateObj) || !hasPosition(stateObj) || !supports(stateObj, COVER_FEATURE.SET_POSITION)) return false;
  const { min, max } = range(config, stateObj);
  return max > min;
}

/** perform-action on the cover entity. */
const coverService = (config, service) => ({
  action: ACTION.PERFORM, perform_action: `${COVER_DOMAIN}.${service}`, target: { entity_id: config.entity },
});

/**
 * Tap and hold of a cover: tap opens / closes (`cover.toggle`, or the one direction the entity supports), hold
 * stops the travel. Without the matching `supported_features` bit the service would be refused: the tap then opens
 * more-info, the hold does nothing.
 */
function coverActions(config, stateObj) {
  const open = supports(stateObj, COVER_FEATURE.OPEN);
  const close = supports(stateObj, COVER_FEATURE.CLOSE);
  let tap = { action: ACTION.MORE_INFO };
  if (open && close) tap = coverService(config, "toggle");
  else if (open) tap = coverService(config, "open_cover");
  else if (close) tap = coverService(config, "close_cover");
  return {
    tap_action: tap,
    double_tap_action: { action: ACTION.NONE },
    hold_action: supports(stateObj, COVER_FEATURE.STOP) ? coverService(config, "stop_cover") : { action: ACTION.NONE },
  };
}

/** Start timeout of a pending value in ms; undefined keeps the card default. */
export const pendingTimeoutMs = (config) => (isCoverCard(config) ? COVER_PENDING_TIMEOUT_MS : undefined);

/**
 * A pending position stays while the cover travels towards it and has not got there yet (the entity reports
 * `opening` / `closing` before the position moves, or only at the end): the handle would swing back otherwise.
 */
export function keepsPending(config, stateObj, pending) {
  if (!isCoverCard(config) || !isMoving(stateObj) || !Number.isFinite(pending)) return false;
  const position = coverPosition(stateObj);
  if (!Number.isFinite(position)) return true;
  return stateObj.state === COVER_STATE.OPENING ? position < pending : position > pending;
}

/**
 * Fraction (0..1), formatted text and validity of a numeric entity against its range. With `attribute`
 * the value is that attribute of the entity instead of its state.
 */
export function measure(config, stateObj, pending, attribute) {
  const value = pending ?? (attribute ? parseAttribute(stateObj, attribute) : parseNumericState(stateObj));
  return measureValue(config, stateObj, value, attribute);
}

/** `measure` for a value that is already read. */
function measureValue(config, stateObj, value, attribute) {
  const valid = Number.isFinite(value) && !isUnavailable(stateObj);
  const { min, max } = range(config, stateObj, attribute);
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
  // `toFixed` throws above 100 digits: cap the decimals (a `min` like 1e-101 would reach it).
  const decimals = Math.min(MAX_SNAP_DECIMALS, Math.max(decimalPlaces(step), decimalPlaces(min)));
  return Number((min + index * step).toFixed(decimals));
}

/** Value (rounded to step or decimals, within the range) at a logical position 0..1. */
export function valueAt(config, stateObj, frac) {
  const { min, max } = range(config, stateObj);
  return snap(config, stateObj, min + clamp(frac, 0, 1) * (max - min));
}

/** The entity can be set from the card: settable domain, drag on, available, valid range, own bar. */
export function isDraggable(config, stateObj) {
  if (isCoverCard(config)) return isCoverDraggable(config, stateObj);
  if (!config || !VALUE_SETTABLE_DOMAINS.includes(domainOf(config))) return false;
  if (!config.drag || config.bar_entity || config.handle_position !== HANDLE_FLEX) return false;
  if (isUnavailable(stateObj) || !Number.isFinite(parseNumericState(stateObj))) return false;
  const { min, max } = range(config, stateObj);
  return max > min;
}

export function view(config, stateObj, pending, ctx) {
  if (isCoverCard(config)) {
    return hasPosition(stateObj) ? coverPositionView(config, stateObj, pending, ctx) : coverStateView(config, stateObj, pending);
  }
  const live = liveValue(config, stateObj, ctx);
  const { valid, frac, text, rangeOk } = measure(config, stateObj, live ?? pending);
  const icon = config.icon ?? stateObj?.attributes?.icon ?? "mdi:gauge";
  return buildView(config, { frac, text, unavailable: !valid, icon, notice: rangeOk ? null : NOTICE.INVALID_VALUE_RANGE });
}

/** Info actions (a tap opens more-info); a cover opens / closes on tap and stops on hold. */
export function defaultActions(config, stateObj) {
  return isCoverCard(config) ? coverActions(config, stateObj) : infoActions();
}

/** perform-action that sets the entity to `value`, plus the optimistic value. */
function setValue(config, value) {
  const domain = config.entity.split(".")[0];
  const cover = domain === COVER_DOMAIN;
  return {
    action: {
      action: ACTION.PERFORM,
      perform_action: cover ? `${COVER_DOMAIN}.set_cover_position` : `${domain}.set_value`,
      target: { entity_id: config.entity },
      data: cover ? { position: value } : { value },
    },
    pending: value,
  };
}

/** Value now shown: the optimistic value, else the entity state (the position of a cover). */
const currentValue = (config, stateObj, pending) => (
  pending ?? (isCoverCard(config) ? coverPosition(stateObj) : parseNumericState(stateObj))
);

/**
 * Drag release: set the value under the handle. Null when it is unchanged, when the entity is not
 * settable, or when the handle ended on the grid point it started from (a value off the grid
 * must not be rewritten by a drag that did not move it).
 */
export function onRelease({ frac, startPos, config, stateObj, pending }) {
  if (!isDraggable(config, stateObj)) return null;
  const value = valueAt(config, stateObj, frac);
  if (value === currentValue(config, stateObj, pending)) return null;
  if (startPos != null && value === valueAt(config, stateObj, startPos)) return null;
  return setValue(config, value);
}

/** Arrow key: one step (stepless: 1 % of the range, at least one unit of the last decimal) up or down. */
export function stepRelease({ direction, config, stateObj, pending }) {
  if (!isDraggable(config, stateObj)) return null;
  const { min, max } = range(config, stateObj);
  const size = resolveStep(config, stateObj) ?? Math.max((max - min) * KEY_STEP_SHARE, 10 ** -config.decimals);
  const current = currentValue(config, stateObj, pending);
  if (!Number.isFinite(current)) return null;
  const value = snap(config, stateObj, current + direction * size);
  if (value === current) return null;
  return setValue(config, value);
}

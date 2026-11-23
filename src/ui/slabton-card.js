/*
 * slABton card - slider button bar for Home Assistant.
 *
 * A bar with a movable handle button. Modes: `state` (multi-state click /
 * drag), `lock` (swipe to lock/unlock), `value` (number display; drag sets
 * `input_number` / `number` and the position of a `cover`),
 * `counter`, `timer` and `clock`. Timer and clock tick locally once per
 * second, only while the card is connected and the page is visible.
 * Plain custom element, no runtime dependencies. All config values are
 * validated (config.js) before they reach the DOM, CSS or a service call.
 */

import { VERSION } from "../version.js";
import { normalizeConfig } from "../core/config.js";
import {
  ACTION, ANIMATION_PULSE, CARD_SIZE, CARD_UNIT_PX, GRID, GRID_FIT_TOLERANCE_PX, MODE, NOTICE, TICK_MS, hasAction,
} from "../core/constants.js";
import { resolveLanguage, resolveLocale, t } from "../core/i18n.js";
import { Pulse } from "../core/pulse.js";
import { createInteraction } from "./interaction.js";
import * as clockMode from "../core/modes/clock.js";
import * as counterMode from "../core/modes/counter.js";
import * as lockMode from "../core/modes/lock.js";
import * as stateMode from "../core/modes/state.js";
import * as timerMode from "../core/modes/timer.js";
import * as valueMode from "../core/modes/value.js";
import { renderTemplate } from "../core/placeholders.js";
import {
  matchState, renderCard, renderPoints, stickshiftSignature, updatePointContent, updatePoints, updateSwitches, updateView, zoneOf,
} from "./render.js";
import { applyVars, buildCss, cardHeightPx, gridColumns, handleDimensions } from "./styles.js";
import { isUnavailable, resolveHandlePosition, safeUrl, unavailableReason, warn } from "../core/util.js";
import { SlabtonCardEditor } from "./editor.js";

export const CARD_TAG = "slabton-card";
export const EDITOR_TAG = "slabton-card-editor";
export const MIN_CALL_INTERVAL_MS = 250;
export const PENDING_TIMEOUT_MS = 3000;
/** How long a pending cover position is kept while the cover travels towards it, in ms. */
export const TRAVEL_PENDING_TIMEOUT_MS = 180000;

const MODES = {
  [MODE.STATE]: stateMode,
  [MODE.LOCK]: lockMode,
  [MODE.VALUE]: valueMode,
  [MODE.COUNTER]: counterMode,
  [MODE.TIMER]: timerMode,
  [MODE.CLOCK]: clockMode,
};
const NOTICES = {
  [NOTICE.TIME_ONLY]: "timer: an input_datetime without a date cannot be used as a countdown target (use has_date or input_date)",
  [NOTICE.UNSUPPORTED_ENTITY]: "timer mode supports timer.*, input_datetime.* and input_date.* entities",
  [NOTICE.INVALID_RANGE]: "counter: the maximum must be greater than the minimum (check counter.min / counter.max or the entity attributes)",
  [NOTICE.INVALID_VALUE_RANGE]: "value: the maximum must be greater than the minimum (check min / max or the entity attributes); the bar cannot be dragged",
};
const STUB_DOMAINS = ["input_select", "select", "switch", "input_boolean", "light"];

export class SlabtonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._refs = null;
    this._mode = null;
    this._varKeys = [];
    this._interactions = [];
    // Stickshift points: rebuilt whenever the list of states changes, so they are kept apart.
    this._pointInteractions = [];
    this._pending = null;
    this._pendingTimer = null;
    this._dragPos = null;
    this._dragStartPos = 0;
    // True while the entity is unavailable and the config does not allow actions then (set by `_update`).
    this._blocked = false;
    this._lastCall = { key: "", at: 0 };
    this._tick = null;
    this._pulse = new Pulse();
    // Timer start / end actions: no re-entry, and the end time whose end action the card ran by cancelling.
    this._runningTimerAction = false;
    this._endRanFor = null;
    this._noticed = new Set();
    this._onVisibility = () => this._handleVisibility();
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states ?? {}).find((id) => STUB_DOMAINS.includes(id.split(".")[0]));
    return { type: `custom:${CARD_TAG}`, entity: entity ?? "" };
  }

  setConfig(raw) {
    const config = normalizeConfig(raw);
    this._teardown();
    this._config = config;
    this._mode = MODES[config.mode];
    this._varKeys = applyVars(this, config, this._varKeys);
    this._refs = renderCard(this.shadowRoot, config, buildCss());
    this._bind();
    if (this._hass) this._update();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (previous && !this._relevantChanged(previous, hass)) return;
    this._update();
  }

  get hass() {
    return this._hass;
  }

  /** Masonry size in units of `CARD_UNIT_PX`: the base size plus the units the content needs beyond it. */
  getCardSize() {
    const base = this._baseCardSize();
    return base + this._extraUnits(base);
  }

  /**
   * Sections view: the width in columns, the height from the content (`rows: "auto"`); a `grid_options:` of the user wins per key.
   * A vertical card whose handle is wider than the default columns gets more columns, and cannot shrink below them.
   */
  getGridOptions() {
    if (this._config?.orientation !== "vertical") return { ...GRID.horizontal };
    const columns = gridColumns(this._config);
    return columns > GRID.vertical.columns ? { ...GRID.vertical, columns, min_columns: columns } : { ...GRID.vertical };
  }

  _baseCardSize() {
    return this._config?.orientation === "vertical" ? CARD_SIZE.vertical : CARD_SIZE.horizontal;
  }

  /**
   * Extra masonry units on top of the base size: how far the card's height need (bar, handle and its overhang)
   * exceeds the height of the base size (`CARD_UNIT_PX` per unit), minus a small tolerance. A thin bar leaves room
   * in the base size, so a handle sticking out of it costs nothing until that room is used up. Not counted: the
   * header and the info line of a vertical card.
   */
  _extraUnits(baseUnits) {
    if (!this._config) return 0;
    const overflow = cardHeightPx(this._config) - GRID_FIT_TOLERANCE_PX - CARD_UNIT_PX * baseUnits;
    return overflow > 0 ? Math.ceil(overflow / CARD_UNIT_PX) : 0;
  }

  connectedCallback() {
    document.addEventListener("visibilitychange", this._onVisibility);
    if (this._config && this._refs) this._update();
  }

  disconnectedCallback() {
    document.removeEventListener("visibilitychange", this._onVisibility);
    this._clearPending();
    this._stopTick();
  }

  // --- clock tick ---------------------------------------------------------

  /** Run the 1 s tick only while it is needed, the card is on screen and the page is visible. */
  _syncTick(view) {
    const wanted = this.isConnected && !document.hidden
      && (this._mode.needsTick?.(view) === true || this._pulse.active);
    if (wanted && this._tick === null) this._tick = setInterval(() => this._update(), TICK_MS);
    else if (!wanted) this._stopTick();
  }

  _stopTick() {
    if (this._tick !== null) clearInterval(this._tick);
    this._tick = null;
  }

  _handleVisibility() {
    if (document.hidden) this._stopTick();
    else this._update();
  }

  // --- timer expiry (pulse) -----------------------------------------------

  /** Sample the timer and let the pulse start or end; a timer that ran out runs `timer.end_action`. Only `_update()` calls this. */
  _advance(now) {
    if (!this._mode.timing) return;
    const ctx = this._context(now, false);
    const expired = this._pulse.advance(this._mode.timing(this._config, this._stateObj(), ctx), now, this._config.timer);
    // A cancel that already ran the end action may land within the expiry tolerance: that end counts once.
    if (!expired || this._pulse.firedFor === this._endRanFor) return;
    this._endRanFor = this._pulse.firedFor;
    this._runTimerAction(this._config.timer.end_action);
  }

  /** Run `timer.start_action` / `timer.end_action` (a missing one does nothing; one that starts the timer again cannot loop). */
  _runTimerAction(action) {
    if (!hasAction(action) || this._runningTimerAction) return;
    this._runningTimerAction = true;
    try {
      this._runAction(action);
    } finally {
      this._runningTimerAction = false;
    }
  }

  /**
   * Edge of the timer run that `action` causes (`timerMode.edgeOf`), or null: the start action runs before
   * `timer.start`, the end action after `timer.cancel` (the device must not stay on).
   */
  _timerEdge(action) {
    if (this._runningTimerAction || !this._mode.edgeOf) return null;
    return this._mode.edgeOf(this._config, this._stateObj(), action);
  }

  /**
   * Remember the end time of the timer run the card cancels: its end action runs with the cancel. Returns true when
   * that end action already ran for this run (the timer expired just before a late hold).
   */
  _markEndRan() {
    const timing = this._mode.timing?.(this._config, this._stateObj(), this._context(Date.now(), false));
    const finishesAt = timing?.finishesAt ?? null;
    const alreadyRan = finishesAt != null && finishesAt === this._endRanFor;
    this._endRanFor = finishesAt;
    return alreadyRan;
  }

  /** A tap ends the pulse and does nothing else. Returns true when a pulse was running. */
  _dismissExpired() {
    if (!this._pulse.dismiss()) return false;
    this._update();
    return true;
  }

  // --- state helpers ------------------------------------------------------

  _entities() {
    const switches = Object.values(this._config.switches).map((s) => s.entity);
    const zones = Object.values(this._config.handle_zones).map((z) => z.entity);
    // Stickshift points show the state of their own entity: a change of it redraws the card, too.
    const points = this._config.stickshift ? this._config.states.map((state) => state.entity) : [];
    return [this._config.entity, this._config.bar_entity, ...switches, ...zones, ...points].filter(Boolean);
  }

  _relevantChanged(previous, next) {
    return this._entities().some((id) => previous.states?.[id] !== next.states?.[id]);
  }

  _stateObj() {
    return this._hass?.states?.[this._config.entity];
  }

  /** Optimistic value until the entity reports a new state (or a timeout). Pure read. */
  _pendingValue() {
    if (!this._pending || this._pending.base !== this._stateObj()) return null;
    return this._pending.value;
  }

  /**
   * Drop a pending value the entity has already replaced, unless the mode keeps it (a cover still travelling to
   * it): then it is bound to the new state and the timeout is extended to the length of a travel.
   */
  _expirePending() {
    if (!this._pending) return;
    const stateObj = this._stateObj();
    if (this._pending.base === stateObj) return;
    if (this._mode.keepsPending?.(this._config, stateObj, this._pending.value)) {
      this._pending = { ...this._pending, base: stateObj };
      this._armPendingTimer(TRAVEL_PENDING_TIMEOUT_MS);
      return;
    }
    this._clearPending();
  }

  _setPending(value) {
    this._clearPending();
    this._pending = { value, base: this._stateObj() };
    this._armPendingTimer(this._mode.pendingTimeoutMs?.(this._config) ?? PENDING_TIMEOUT_MS);
  }

  _armPendingTimer(ms) {
    clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(() => {
      this._clearPending();
      if (this._config) this._update();
    }, ms);
  }

  _clearPending() {
    this._pending = null;
    clearTimeout(this._pendingTimer);
    this._pendingTimer = null;
  }

  _context(now, expired) {
    const hass = this._hass;
    return {
      now,
      lang: resolveLanguage(hass),
      locale: resolveLocale(hass),
      hassTimeZone: hass?.config?.time_zone ?? null,
      expired,
    };
  }

  /** Mode view plus the parts the card adds: separate bar entity, texts, pulse state. Pure read. */
  _view(now = Date.now()) {
    const config = this._config;
    const stateObj = this._stateObj();
    const ctx = { ...this._context(now, this._pulse.active), dragPos: this._dragPos };
    const view = this._mode.view(config, stateObj, this._pendingValue() ?? undefined, ctx);
    return this._decorate(view, stateObj, ctx);
  }

  _decorate(view, stateObj, ctx) {
    const config = this._config;
    const barState = config.bar_entity ? this._hass?.states?.[config.bar_entity] : null;
    const bar = config.bar_entity ? valueMode.measure(config, barState, undefined, config.bar_attribute ?? undefined) : null;
    // A bar attribute that cannot be read is shown like an unavailable entity, but never blocks the actions.
    const barBroken = Boolean(config.bar_attribute && bar && !bar.valid);
    const unavailableKey = view.unavailable
      ? (unavailableReason(stateObj) ?? "invalid")
      : (barBroken ? (unavailableReason(barState) ?? "attribute") : null);
    const values = {
      name: config.name ?? stateObj?.attributes?.friendly_name ?? "",
      state: stateObj?.state ?? "",
      value: view.text,
      ...view.values,
      ...(bar ? { value: bar.text } : {}),
    };
    this._notify(view.notice);
    // State mode, bar attribute of the main entity: the handle sits on the measured value like in the value mode
    // (the state position of a cover or climate entity means nothing here). A separate `bar.entity` keeps the
    // handle on the state.
    const handleOnBar = Boolean(bar?.valid && config.bar_own_attribute && config.mode === MODE.STATE);
    const pos = handleOnBar ? resolveHandlePosition(config, bar.frac, bar.frac > 0) : view.pos;
    const zone = config.handle_zones[zoneOf(pos)];
    const zoneState = zone ? matchState(zone.states, zone.entity ? this._hass?.states?.[zone.entity] : null) : null;
    // Stickshift: the active point with an own entity shows that entity's state (above the zone and the main state).
    const pointState = this._pointMatch(this._activeEntry());
    return {
      ...view,
      icon: pointState?.icon ?? zoneState?.icon ?? zone?.icon ?? view.icon,
      iconColor: pointState?.color ?? zoneState?.color ?? this._stickshiftIconColor(view),
      pos,
      unavailable: Boolean(view.unavailable) || barBroken,
      blocked: Boolean(view.unavailable),
      unavailableText: unavailableKey ? t(ctx.lang, `unavailable.${unavailableKey}`) : null,
      fillPos: bar ? bar.frac : view.fillPos,
      modeFillPos: view.fillPos,
      scaleLabels: this._boundScaleLabels(barState),
      // A travelling cover pulses like an expired timer, but only with `animation: pulse` (opt-in).
      expired: ctx.expired || Boolean(view.moving && config.animation === ANIMATION_PULSE),
      barText: config.bar_text ? renderTemplate(config.bar_text, values, config.mode) : null,
      info: config.timer.info ? renderTemplate(config.timer.info, values, config.mode) : null,
    };
  }

  /** Stickshift: icon color of the handle on the active point (`active_color`, else the color of the state). */
  _stickshiftIconColor(view) {
    const sx = this._config.stickshift;
    // No active point (state not among the points): nothing to mark.
    return sx && this._activeEntry() ? (sx.active_color ?? view.color ?? null) : null;
  }

  /**
   * Texts of the scale labels that follow the range of the bar entity (its `min` / `max` attributes), or null
   * when no label does. A range that is not valid (max <= min) leaves both texts empty. Without a usable bar state
   * (missing or unavailable: HA drops its attributes) the labels keep their last text instead of falling back to
   * the configured range.
   */
  _boundScaleLabels(barState) {
    const config = this._config;
    if (!config.scale?.labels?.some((label) => label.bound)) return null;
    if (!barState || isUnavailable(barState)) return null;
    const { min, max } = valueMode.range(config, { entity_id: config.bar_entity, ...barState }, config.bar_attribute ?? undefined);
    if (!(max > min)) return { min: "", max: "" };
    return { min: min.toFixed(config.decimals), max: max.toFixed(config.decimals) };
  }

  /** Log a mode notice once per config. */
  _notify(notice) {
    if (!notice || this._noticed.has(notice)) return;
    this._noticed.add(notice);
    warn(NOTICES[notice] ?? notice);
  }

  _update() {
    if (!this._config || !this._refs) return;
    this._expirePending();
    const now = Date.now();
    this._advance(now);
    const view = this._view(now);
    this._blocked = Boolean(view.blocked) && !this._config.allow_unavailable_actions;
    updateView(this._refs, this._config, view, { dragPos: this._dragPos });
    this._syncNoDrag();
    updateSwitches(this._refs, this._config, this._hass);
    this._syncStickshift();
    this._syncTick(view);
  }

  // --- stickshift ---------------------------------------------------------

  /** Value of the active state: the optimistic value while a change is pending, else the entity's state. */
  _currentValue() {
    return this._pendingValue() ?? this._stateObj()?.state;
  }

  /** The state entry (with its own actions) for `value`, else undefined. */
  _stateEntry(value) {
    return stateMode.resolveStates(this._config, this._stateObj()).find((entry) => entry.value === value);
  }

  /** Stickshift only: the entry of the active state (its actions rank above the zone's and the card's). */
  _activeEntry() {
    return this._config.stickshift ? this._stateEntry(this._currentValue()) : undefined;
  }

  /** The `states` entry of the point's own entity that matches its current state, else null (no own entity). */
  _pointMatch(entry) {
    if (!entry?.entity || !entry.states?.length) return null;
    return matchState(entry.states, this._hass?.states?.[entry.entity]);
  }

  /** The point as shown: icon, color and text of the matching state of its own entity win over its own. */
  _pointDisplay(entry) {
    const match = this._pointMatch(entry);
    if (!match) return entry;
    return { ...entry, icon: match.icon ?? entry.icon, color: match.color ?? entry.color, text: match.text ?? entry.text };
  }

  /** Keep the points in step with the states of the entity; they are rebuilt only when the list changed. */
  _syncStickshift() {
    if (!this._config.stickshift) return;
    const all = stateMode.resolveStates(this._config, this._stateObj()).map((entry) => this._pointDisplay(entry));
    // Fewer than two states leave nothing to choose from.
    const states = all.length >= 2 ? all : [];
    if (this._refs.pointSignature !== stickshiftSignature(states)) this._rebuildPoints(states);
    updatePointContent(this._refs, states);
    updatePoints(this._refs, states.findIndex((entry) => entry.value === this._currentValue()), this._blocked);
  }

  _rebuildPoints(states) {
    for (const interaction of this._pointInteractions) interaction.destroy();
    const buttons = renderPoints(this._refs, this._config, states);
    this._pointInteractions = buttons.map((button, i) => this._bindPoint(button, states[i]));
  }

  _bindPoint(button, state) {
    const config = this._config;
    return createInteraction({
      horizontal: config.orientation === "horizontal",
      reversed: config.direction === "rtl",
      handle: button,
      // Double tap and hold belong to the active point (the handle): an inactive point only selects its state.
      hasDoubleTap: () => !this._blocked && this._isActivePoint(state) && hasAction(state.double_tap_action),
      hasHold: () => !this._blocked && this._isActivePoint(state) && hasAction(state.hold_action),
      onTap: () => this._pointTap(state),
      onDoubleTap: () => this._runPointAction(state, "double_tap_action"),
      onHold: () => this._runPointAction(state, "hold_action"),
      onStep: (step) => this._step(step),
    });
  }

  /**
   * Tap on a point. An inactive point selects its state at once (any distance) and then runs its own tap action;
   * the active point only runs its own action (else the card's or the mode's default), without a state change.
   */
  _pointTap(state) {
    if (this._blocked) return;
    if (state.value === this._currentValue()) {
      this._runTrigger("tap_action");
      return;
    }
    this._runAction(stateMode.selectAction(this._config, state.value));
    this._setPending(state.value);
    this._runPointAction(state, "tap_action");
    this._update();
  }

  _isActivePoint(state) {
    return state.value === this._currentValue();
  }

  /** Run the own action of a point (double tap and hold only run on the active point, never change the state). */
  _runPointAction(entry, kind) {
    if (this._blocked || !this._config.stickshift) return;
    const action = entry?.[kind];
    // A point action that cycles lands on the next point, whose action may cycle again: no re-entry.
    if (!hasAction(action) || this._runningPointAction) return;
    this._runningPointAction = true;
    try {
      this._runAction(action);
    } finally {
      this._runningPointAction = false;
    }
  }

  /** The handle arrived on the point of `value` (drag, key or cycle): run that point's tap action. */
  _runArrivalAction(value) {
    if (this._config.stickshift) this._runPointAction(this._stateEntry(value), "tap_action");
  }

  /** Timer card with both a start and an end action (the swipe layout); other timer cards stay as they were. */
  _timerSwitchLike() {
    const { start_action: start, end_action: end } = this._config.timer;
    return this._mode.id === MODE.TIMER && Boolean(start && end);
  }

  /**
   * Value mode and the timer swipe layout: `nodrag` (normal touch scrolling over the handle) follows what can really
   * be dragged now, not only the config: a read-only bar, a fixed handle or an invalid range cannot be dragged
   * either. Only the cursor and `touch-action` change, never a size.
   */
  _syncNoDrag() {
    if (this._mode.id !== MODE.VALUE && !this._timerSwitchLike()) return;
    this._refs.root.classList.toggle("nodrag", !this._mode.isDraggable(this._config, this._stateObj()));
  }

  // --- interaction --------------------------------------------------------

  _teardown() {
    for (const interaction of [...this._interactions, ...this._pointInteractions]) interaction.destroy();
    this._interactions = [];
    this._pointInteractions = [];
    this._clearPending();
    this._stopTick();
    this._dragPos = null;
    this._blocked = false;
    this._pulse.reset();
    this._runningTimerAction = false;
    this._endRanFor = null;
    this._noticed.clear();
  }

  /**
   * Own action of the active stickshift point, else of the handle zone the handle sits in, else the card action,
   * else the mode default.
   */
  _actionFor(kind) {
    const zone = this._config.handle_zones[zoneOf(this._view().pos)];
    return this._activeEntry()?.[kind] ?? zone?.[kind] ?? this._config[kind]
      ?? this._mode.defaultActions(this._config, this._stateObj())[kind];
  }

  /**
   * Run the action for `kind`; an action of a zone with its own entity acts on that entity (like a switch). An
   * action of a point carries its own `entity` and never takes the zone's.
   */
  _runTrigger(kind) {
    const zone = this._config.handle_zones[zoneOf(this._view().pos)];
    const zoneOwn = !this._activeEntry()?.[kind] && zone?.[kind];
    this._runAction(this._actionFor(kind), zoneOwn ? (zone.entity ?? undefined) : undefined);
  }

  _bind() {
    const { handle, rail, switches } = this._refs;
    const config = this._config;
    const horizontal = config.orientation === "horizontal";
    const common = { horizontal, reversed: config.direction === "rtl" };

    this._interactions.push(createInteraction({
      ...common,
      handle,
      rail,
      handleLength: handleDimensions(config).along,
      isDraggable: () => !this._blocked && this._mode.isDraggable(config, this._stateObj()),
      hasDoubleTap: () => !this._blocked && hasAction(this._actionFor("double_tap_action")),
      hasHold: () => !this._blocked && hasAction(this._actionFor("hold_action")),
      onTap: () => this._handleTap(),
      onDoubleTap: () => {
        if (!this._blocked) this._runTrigger("double_tap_action");
      },
      onHold: () => {
        if (!this._blocked) this._runTrigger("hold_action");
      },
      onDragStart: () => {
        // The logical position of the mode (lock: locked or not), not the measured bar value.
        this._dragStartPos = this._view().modeFillPos;
        this._refs.root.classList.add("dragging");
      },
      onDrag: (frac) => {
        this._dragPos = frac;
        this._update();
      },
      onDragEnd: (frac) => this._endDrag(frac),
      onDragCancel: () => this._endDrag(null),
      onStep: (step) => this._step(step),
    }));

    for (const [slot, button] of Object.entries(switches)) {
      const sw = config.switches[slot];
      const run = (action) => action && this._runAction(action, sw.entity ?? config.entity);
      this._interactions.push(createInteraction({
        ...common,
        handle: button,
        hasDoubleTap: () => hasAction(sw.double_tap_action),
        hasHold: () => hasAction(sw.hold_action),
        onTap: () => run(sw.tap_action ?? (sw.entity ? { action: ACTION.TOGGLE } : null)),
        onDoubleTap: () => run(sw.double_tap_action),
        onHold: () => run(sw.hold_action),
      }));
    }
  }

  /**
   * Tap on the handle. A locked unavailable card only opens more-info (read-only, cannot misfire).
   * A single tap delayed for double-tap detection that fires after the entity became unavailable
   * ends up here too, so it opens more-info instead of the tap action (harmless).
   */
  _handleTap() {
    if (this._blocked) {
      if (this._config.entity) this._runAction({ action: ACTION.MORE_INFO });
      return;
    }
    if (!this._dismissExpired()) this._runTrigger("tap_action");
  }

  _endDrag(frac) {
    this._refs.root.classList.remove("dragging");
    this._dragPos = null;
    // The entity may have become unavailable during the drag.
    if (frac != null && !this._blocked) this._release(frac, this._dragStartPos);
    this._update();
  }

  /** Apply the mode's release result (drag end or keyboard step). */
  _release(frac, startPos) {
    const result = this._mode.onRelease?.({
      frac,
      startPos,
      config: this._config,
      stateObj: this._stateObj(),
      pending: this._pendingValue() ?? undefined,
    });
    if (!result) return;
    this._runAction(result.action);
    // A result without a pending value (timer swipe) leaves the display to the entity.
    if (result.pending === undefined) return;
    this._setPending(result.pending);
    this._runArrivalAction(result.pending);
  }

  /** Arrow keys. Lock mode ignores them on purpose: one stray key press must not (un)lock. */
  _step(direction) {
    if (this._blocked) return;
    if (this._mode.id === MODE.STATE) this._cycle(direction);
    else if (this._mode.id === MODE.VALUE) this._stepValue(direction);
  }

  /** Value mode: one step up or down (only for settable entities, see `valueMode.isDraggable`). */
  _stepValue(direction) {
    const result = valueMode.stepRelease({
      direction,
      config: this._config,
      stateObj: this._stateObj(),
      pending: this._pendingValue() ?? undefined,
    });
    if (!result) return;
    this._runAction(result.action);
    this._setPending(result.pending);
    this._update();
  }

  _cycle(step) {
    if (this._mode.id !== MODE.STATE || this._blocked) return;
    const result = stateMode.cycleAction(this._config, this._stateObj(), step, this._pendingValue() ?? undefined);
    if (!result) return;
    this._runAction(result.action);
    this._setPending(result.value);
    this._runArrivalAction(result.value);
    this._update();
  }

  // --- actions ------------------------------------------------------------

  _runAction(action, entity = this._config.entity) {
    switch (action.action) {
      case ACTION.CYCLE:
        this._cycle(1);
        break;
      case ACTION.CYCLE_BACK:
        this._cycle(-1);
        break;
      case ACTION.TOGGLE: {
        const target = action.entity ?? entity;
        // A switch without its own entity would act on the locked main entity.
        if (this._blocked && target === this._config.entity) break;
        this._call("homeassistant", "toggle", { entity_id: target });
        break;
      }
      case ACTION.PERFORM: {
        const [domain, service] = action.perform_action.split(".");
        const edge = this._timerEdge(action);
        if (edge === timerMode.EDGE.START) this._runTimerAction(this._config.timer.start_action);
        const endRan = edge === timerMode.EDGE.CANCEL && this._markEndRan();
        this._call(domain, service, action.data ?? {}, action.target);
        if (edge === timerMode.EDGE.CANCEL && !endRan) this._runTimerAction(this._config.timer.end_action);
        break;
      }
      case ACTION.MORE_INFO:
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId: action.entity ?? entity }, bubbles: true, composed: true,
        }));
        break;
      case ACTION.NAVIGATE:
        window.history.pushState(null, "", action.navigation_path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        break;
      case ACTION.URL: {
        const url = safeUrl(action.url_path);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        break;
      }
      default:
        break;
    }
  }

  /** Service call; identical calls within MIN_CALL_INTERVAL_MS are dropped. */
  _call(domain, service, data, target) {
    if (!this._hass) return;
    const key = JSON.stringify([domain, service, data, target]);
    const now = Date.now();
    if (key === this._lastCall.key && now - this._lastCall.at < MIN_CALL_INTERVAL_MS) return;
    this._lastCall = { key, at: now };
    Promise.resolve(this._hass.callService(domain, service, data, target)).catch((error) => {
      console.error(`slabton-card: ${domain}.${service} failed`, error);
    });
  }
}

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, SlabtonCard);
if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, SlabtonCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "slABton Card",
    description: "Slider button bar: multi-state switch, swipe to lock/unlock and value display.",
    preview: true,
    documentationURL: "https://github.com/arboeh/slABton",
  });
}

console.info(`%c slabton-card %c v${VERSION} `, "color:#fff;background:#03a9f4;font-weight:700", "color:#03a9f4;background:#fff");

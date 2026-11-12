/*
 * slABton card - slider button bar for Home Assistant.
 *
 * A bar with a movable handle button. Modes: `state` (multi-state click /
 * drag), `lock` (swipe to lock/unlock), `value` (read-only display),
 * `counter`, `timer` and `clock`. Timer and clock tick locally once per
 * second, only while the card is connected and the page is visible.
 * Plain custom element, no runtime dependencies. All config values are
 * validated (config.js) before they reach the DOM, CSS or a service call.
 */

import { VERSION } from "./version.js";
import { normalizeConfig } from "./config.js";
import { ACTION, CARD_SIZE, GRID, MODE, TICK_MS, hasAction } from "./constants.js";
import { resolveLanguage, resolveLocale } from "./i18n.js";
import { createInteraction } from "./interaction.js";
import * as clockMode from "./modes/clock.js";
import * as counterMode from "./modes/counter.js";
import * as lockMode from "./modes/lock.js";
import * as stateMode from "./modes/state.js";
import * as timerMode from "./modes/timer.js";
import * as valueMode from "./modes/value.js";
import { renderTemplate } from "./placeholders.js";
import { renderCard, updateSwitches, updateView } from "./render.js";
import { applyVars, buildCss, handleDimensions } from "./styles.js";
import { safeUrl, warn } from "./util.js";
import { SlabtonCardEditor } from "./editor.js";

export const CARD_TAG = "slabton-card";
export const EDITOR_TAG = "slabton-card-editor";
export const MIN_CALL_INTERVAL_MS = 250;
export const PENDING_TIMEOUT_MS = 3000;

const MODES = {
  [MODE.STATE]: stateMode,
  [MODE.LOCK]: lockMode,
  [MODE.VALUE]: valueMode,
  [MODE.COUNTER]: counterMode,
  [MODE.TIMER]: timerMode,
  [MODE.CLOCK]: clockMode,
};
const NOTICES = {
  time_only: "timer: an input_datetime without a date cannot be used as a countdown target (use has_date or input_date)",
  unsupported_entity: "timer mode supports timer.*, input_datetime.* and input_date.* entities",
  invalid_range: "counter: the maximum must be greater than the minimum (check counter.min / counter.max or the entity attributes)",
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
    this._pending = null;
    this._pendingTimer = null;
    this._dragPos = null;
    this._dragStartPos = 0;
    this._lastCall = { key: "", at: 0 };
    this._tick = null;
    this._timing = null;
    this._expiredUntil = 0;
    this._firedFor = null;
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

  getCardSize() {
    return this._config?.orientation === "vertical" ? CARD_SIZE.vertical : CARD_SIZE.horizontal;
  }

  getGridOptions() {
    return { ...(this._config?.orientation === "vertical" ? GRID.vertical : GRID.horizontal) };
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
      && (this._mode.needsTick?.(view) === true || this._expiredUntil > 0);
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

  /** Compare the new timer sample with the last one; start or end the pulse. */
  _trackExpiry(timing, now) {
    const { pulse, pulse_seconds: seconds } = this._config.timer;
    if (this._expiredUntil && now >= this._expiredUntil) this._expiredUntil = 0;
    // Each end time pulses once, even when Home Assistant reports the end late.
    const endsAt = this._timing?.finishesAt ?? null;
    if (pulse && !this._expiredUntil && endsAt !== this._firedFor && timerMode.detectExpiry(this._timing, timing, now)) {
      this._firedFor = endsAt;
      this._expiredUntil = seconds > 0 ? now + seconds * 1000 : Infinity;
    } else if (timing?.active && (timing.finishesAt == null || timing.upcoming)) {
      this._expiredUntil = 0; // running again
    }
    this._timing = timing;
  }

  /** A tap ends the pulse and does nothing else. Returns true when a pulse was running. */
  _dismissExpired() {
    if (!this._expiredUntil) return false;
    this._expiredUntil = 0;
    this._timing = null;
    this._update();
    return true;
  }

  // --- state helpers ------------------------------------------------------

  _entities() {
    const switches = Object.values(this._config.switches).map((s) => s.entity);
    return [this._config.entity, this._config.bar_entity, ...switches].filter(Boolean);
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

  /** Drop a pending value the entity has already replaced. */
  _expirePending() {
    if (this._pending && this._pending.base !== this._stateObj()) this._clearPending();
  }

  _setPending(value) {
    this._clearPending();
    this._pending = { value, base: this._stateObj() };
    this._pendingTimer = setTimeout(() => {
      this._clearPending();
      if (this._config) this._update();
    }, PENDING_TIMEOUT_MS);
  }

  _clearPending() {
    this._pending = null;
    clearTimeout(this._pendingTimer);
    this._pendingTimer = null;
  }

  _context(now) {
    const hass = this._hass;
    return {
      now,
      lang: resolveLanguage(hass),
      locale: resolveLocale(hass),
      hassTimeZone: hass?.config?.time_zone ?? null,
      expired: false,
    };
  }

  /**
   * Mode view plus the parts the card adds: separate bar entity, texts, pulse state.
   * Pure read unless `track` is set; only `_update()` advances the expiry tracking.
   */
  _view(now = Date.now(), track = false) {
    const config = this._config;
    const stateObj = this._stateObj();
    const ctx = this._context(now);
    if (track && this._mode.timing) this._trackExpiry(this._mode.timing(config, stateObj, ctx), now);
    ctx.expired = this._expiredUntil > 0;
    const view = this._mode.view(config, stateObj, this._pendingValue() ?? undefined, ctx);
    return this._decorate(view, stateObj, ctx);
  }

  _decorate(view, stateObj, ctx) {
    const config = this._config;
    const bar = config.bar_entity ? valueMode.measure(config, this._hass?.states?.[config.bar_entity]) : null;
    const values = {
      name: config.name ?? stateObj?.attributes?.friendly_name ?? "",
      state: stateObj?.state ?? "",
      value: view.text,
      ...view.values,
      ...(bar ? { value: bar.text } : {}),
    };
    this._notify(view.notice);
    return {
      ...view,
      fillPos: bar ? bar.frac : view.fillPos,
      expired: ctx.expired,
      barText: config.bar_text ? renderTemplate(config.bar_text, values, config.mode) : null,
      info: config.timer.info ? renderTemplate(config.timer.info, values, config.mode) : null,
    };
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
    const view = this._view(Date.now(), true);
    updateView(this._refs, this._config, view, { dragPos: this._dragPos });
    updateSwitches(this._refs, this._config, this._hass);
    this._syncTick(view);
  }

  // --- interaction --------------------------------------------------------

  _teardown() {
    for (const interaction of this._interactions) interaction.destroy();
    this._interactions = [];
    this._clearPending();
    this._stopTick();
    this._dragPos = null;
    this._timing = null;
    this._expiredUntil = 0;
    this._firedFor = null;
    this._noticed.clear();
  }

  _actionFor(kind) {
    return this._config[kind] ?? this._mode.defaultActions(this._config, this._stateObj())[kind];
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
      isDraggable: () => this._mode.isDraggable(config, this._stateObj()),
      hasDoubleTap: () => hasAction(this._actionFor("double_tap_action")),
      hasHold: () => hasAction(this._actionFor("hold_action")),
      onTap: () => {
        if (!this._dismissExpired()) this._runAction(this._actionFor("tap_action"));
      },
      onDoubleTap: () => this._runAction(this._actionFor("double_tap_action")),
      onHold: () => this._runAction(this._actionFor("hold_action")),
      onDragStart: () => {
        this._dragStartPos = this._view().fillPos;
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

  _endDrag(frac) {
    this._refs.root.classList.remove("dragging");
    this._dragPos = null;
    if (frac != null) this._release(frac, this._dragStartPos);
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
    this._setPending(result.pending);
  }

  /** Arrow keys. Lock mode ignores them on purpose: one stray key press must not (un)lock. */
  _step(direction) {
    if (this._mode.id === MODE.STATE) this._cycle(direction);
  }

  _cycle(step) {
    if (this._mode.id !== MODE.STATE) return;
    const result = stateMode.cycleAction(this._config, this._stateObj(), step, this._pendingValue() ?? undefined);
    if (!result) return;
    this._runAction(result.action);
    this._setPending(result.value);
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
      case ACTION.TOGGLE:
        this._call("homeassistant", "toggle", { entity_id: action.entity ?? entity });
        break;
      case ACTION.PERFORM: {
        const [domain, service] = action.perform_action.split(".");
        this._call(domain, service, action.data ?? {}, action.target);
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

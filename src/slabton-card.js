/*
 * slABton card - slider button bar for Home Assistant.
 *
 * A bar with a movable handle button. Modes: `state` (multi-state click /
 * drag), `lock` (swipe to lock/unlock) and `value` (read-only display).
 * Plain custom element, no runtime dependencies. All config values are
 * validated (config.js) before they reach the DOM, CSS or a service call.
 */

import { VERSION } from "./version.js";
import { normalizeConfig } from "./config.js";
import { ACTION, CARD_SIZE, GRID, MODE, hasAction } from "./constants.js";
import { createInteraction } from "./interaction.js";
import * as lockMode from "./modes/lock.js";
import * as stateMode from "./modes/state.js";
import * as valueMode from "./modes/value.js";
import { renderCard, updateSwitches, updateView } from "./render.js";
import { applyVars, buildCss, handleDimensions } from "./styles.js";
import { safeUrl } from "./util.js";
import { SlabtonCardEditor } from "./editor.js";

export const CARD_TAG = "slabton-card";
export const EDITOR_TAG = "slabton-card-editor";
export const MIN_CALL_INTERVAL_MS = 250;
export const PENDING_TIMEOUT_MS = 3000;

const MODES = { [MODE.STATE]: stateMode, [MODE.LOCK]: lockMode, [MODE.VALUE]: valueMode };
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

  disconnectedCallback() {
    this._clearPending();
  }

  // --- state helpers ------------------------------------------------------

  _entities() {
    const switches = Object.values(this._config.switches).map((s) => s.entity);
    return [this._config.entity, ...switches].filter(Boolean);
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

  _view() {
    return this._mode.view(this._config, this._stateObj(), this._pendingValue() ?? undefined);
  }

  _update() {
    if (!this._config || !this._refs) return;
    this._expirePending();
    const view = this._view();
    updateView(this._refs, this._config, view, { dragPos: this._dragPos });
    updateSwitches(this._refs, this._config, this._hass);
  }

  // --- interaction --------------------------------------------------------

  _teardown() {
    for (const interaction of this._interactions) interaction.destroy();
    this._interactions = [];
    this._clearPending();
    this._dragPos = null;
  }

  _actionFor(kind) {
    return this._config[kind] ?? this._mode.defaultActions(this._config)[kind];
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
      onTap: () => this._runAction(this._actionFor("tap_action")),
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

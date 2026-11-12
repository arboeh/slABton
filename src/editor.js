/*
 * Visual editor built on Home Assistant's `ha-form` (schema editor, no
 * custom inputs). Fields depend on the selected mode. Complex structures
 * (states list, switches, styles) stay YAML-only; ha-form preserves keys it
 * does not know, so they survive editing in the UI.
 */

import { ANIMATIONS } from "./animations.js";
import {
  ARM_SERVICES, DIRECTIONS, HANDLE_CONTENTS, HANDLE_POSITIONS, HANDLE_SHAPES, HEADER_ICON_POSITIONS, HEADER_POSITIONS,
  ORIENTATIONS, PRESET_NAMES, inferMode,
} from "./config.js";
import { MODE, MODES } from "./constants.js";
import { warn } from "./util.js";

const LABELS = {
  entity: "Entity",
  mode: "Mode",
  name: "Header text",
  icon: "Icon",
  header_position: "Header position",
  header_icon_position: "Header icon position",
  orientation: "Orientation",
  direction: "Direction (ltr / rtl)",
  length: "Bar length in px (0 = auto)",
  thickness: "Bar thickness in px",
  handle_size: "Handle size in px",
  handle_shape: "Handle shape",
  handle_position: "Handle position",
  fixed_position: "Fixed position in %",
  handle_overhang: "Handle sticks out at both ends",
  handle_content: "Handle content",
  animation: "Animation",
  bar_color: "Bar color",
  fill_color: "Fill color",
  handle_color: "Handle color",
  text_color: "Text color",
  border_color: "Border color",
  border_width: "Border width in px",
  border_radius: "Bar corner radius in px",
  drag: "Allow dragging",
  hold_reverse: "Hold goes to previous state",
  swipe_threshold: "Swipe threshold in %",
  arm_service: "Arm service (alarm)",
  preset: "Preset",
  min: "Minimum",
  max: "Maximum",
  unit: "Unit",
  decimals: "Decimals",
  tap_action: "Tap action",
  double_tap_action: "Double tap action",
  hold_action: "Hold action",
};

const select = (options) => ({
  select: { mode: "dropdown", options: options.map((value) => ({ value, label: value })) },
});
const number = (min, max) => ({ number: { min, max, mode: "box" } });
const text = () => ({ text: {} });

/** Fields that only apply to one mode. */
function modeFields(mode) {
  return {
    [MODE.STATE]: [
      { name: "drag", selector: { boolean: {} } },
      { name: "hold_reverse", selector: { boolean: {} } },
    ],
    [MODE.LOCK]: [
      { name: "swipe_threshold", selector: number(30, 100) },
      { name: "arm_service", selector: select(ARM_SERVICES) },
    ],
    [MODE.VALUE]: [
      { name: "preset", selector: select(PRESET_NAMES) },
      { type: "grid", name: "", schema: [
        { name: "min", selector: number(-1e9, 1e9) },
        { name: "max", selector: number(-1e9, 1e9) },
        { name: "unit", selector: text() },
        { name: "decimals", selector: number(0, 6) },
      ] },
    ],
  }[mode];
}

/** Bar and handle geometry fields. */
function layoutFields(config) {
  return [
    { name: "orientation", selector: select(ORIENTATIONS) },
    { name: "direction", selector: select(DIRECTIONS) },
    { name: "length", selector: number(0, 2000) },
    { name: "thickness", selector: number(12, 200) },
    { name: "handle_size", selector: number(8, 200) },
    { name: "handle_shape", selector: select(HANDLE_SHAPES) },
    { name: "handle_position", selector: select(HANDLE_POSITIONS) },
    ...(config.handle_position === "fixed" ? [{ name: "fixed_position", selector: number(0, 100) }] : []),
    { name: "handle_overhang", selector: { boolean: {} } },
    { name: "handle_content", selector: select(HANDLE_CONTENTS) },
    { name: "animation", selector: select(ANIMATIONS) },
  ];
}

/** ha-form schema for the given (raw) config. */
export function buildSchema(config = {}) {
  const domain = typeof config.entity === "string" ? config.entity.split(".")[0] : "";
  const mode = MODES.includes(config.mode) ? config.mode : inferMode(domain);

  return [
    { name: "entity", required: true, selector: { entity: {} } },
    { name: "mode", selector: select(MODES) },
    { name: "name", selector: text() },
    { name: "icon", selector: { icon: {} } },
    { name: "header_position", selector: select(HEADER_POSITIONS) },
    { name: "header_icon_position", selector: select(HEADER_ICON_POSITIONS) },
    ...modeFields(mode),
    { type: "expandable", name: "", title: "Layout", schema: layoutFields(config) },
    { type: "expandable", name: "", title: "Colors", schema: [
      { name: "bar_color", selector: text() },
      { name: "fill_color", selector: text() },
      { name: "handle_color", selector: text() },
      { name: "text_color", selector: text() },
      { name: "border_color", selector: text() },
      { name: "border_width", selector: number(0, 20) },
      { name: "border_radius", selector: number(0, 999) },
    ] },
    { type: "expandable", name: "", title: "Actions", schema: [
      { name: "tap_action", selector: { ui_action: {} } },
      { name: "double_tap_action", selector: { ui_action: {} } },
      { name: "hold_action", selector: { ui_action: {} } },
    ] },
  ];
}

/** Drop keys the form cleared (undefined, null or empty string). */
export function cleanConfig(data) {
  const out = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export class SlabtonCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._form = null;
    this._waiting = false;
    this._computeLabel = (item) => LABELS[item.name] ?? item.title ?? item.name;
  }

  connectedCallback() {
    // ha-form is lazy-loaded by the frontend; ask for it, then re-render.
    window.loadCardHelpers?.()
      .then((helpers) => helpers.createCardElement({ type: "entities", entities: [] }))
      .then(() => this._render())
      .catch((error) => warn(`could not load the form component for the visual editor: ${error?.message ?? error}`));
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  get hass() {
    return this._hass;
  }

  _render() {
    if (!customElements.get("ha-form")) {
      this._form = null;
      this.shadowRoot.innerHTML = "<p>The visual editor needs Home Assistant's form component. Use the YAML editor instead.</p>";
      if (!this._waiting) {
        this._waiting = true;
        customElements.whenDefined("ha-form").then(() => {
          this._waiting = false;
          this._render();
        });
      }
      return;
    }
    if (!this._form) {
      this.shadowRoot.innerHTML = "";
      this._form = document.createElement("ha-form");
      this._form.computeLabel = this._computeLabel;
      this._form.addEventListener("value-changed", (event) => this._onChanged(event));
      this.shadowRoot.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = buildSchema(this._config);
  }

  _onChanged(event) {
    event.stopPropagation();
    this._config = cleanConfig(event.detail.value);
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
    this._form.schema = buildSchema(this._config);
  }
}

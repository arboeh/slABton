/*
 * Visual editor built on Home Assistant's `ha-form` (schema editor, no
 * custom inputs). Fields depend on the selected mode. Complex structures
 * (states list, switches, styles) stay YAML-only; ha-form preserves keys it
 * does not know, so they survive editing in the UI. Labels come from the
 * dictionaries in i18n.js (language of the Home Assistant user).
 */

import {
  ARM_SERVICES, CLOCK_DISPLAYS_OFFERED, DIRECTIONS, HANDLE_CONTENTS, HANDLE_POSITIONS, HANDLE_SHAPES, HEADER_ICON_POSITIONS,
  HEADER_POSITIONS, HOUR_FORMATS, ORIENTATIONS, PRESET_NAMES, inferMode,
} from "../core/config.js";
import { ANIMATIONS, MAX_FONT_SIZE, MIN_FONT_SIZE, MODE, MODES, TEXT_AREAS, TEXT_OPTIONS } from "../core/constants.js";
import { DEFAULT_LANGUAGE, hasTranslation, resolveLanguage, t } from "../core/i18n.js";
import { isPlainObject, warn } from "../core/util.js";

const select = (options) => ({
  select: { mode: "dropdown", options: options.map((value) => ({ value, label: value })) },
});
const number = (min, max, step) => ({ number: { min, max, mode: "box", ...(step === undefined ? {} : { step }) } });
const text = () => ({ text: {} });
const bool = () => ({ boolean: {} });

/** Named expandable section: ha-form passes `data[name]` to its fields. */
const section = (name, title, schema) => ({ type: "expandable", name, title, schema });

/** Fields that only apply to one mode. */
function modeFields(mode, lang) {
  return {
    [MODE.STATE]: [
      { name: "drag", selector: bool() },
      { name: "hold_reverse", selector: bool() },
    ],
    [MODE.LOCK]: [
      { name: "swipe_threshold", selector: number(30, 100) },
      { name: "arm_service", selector: select(ARM_SERVICES) },
    ],
    [MODE.VALUE]: [
      { name: "drag", selector: bool() },
      { name: "preset", selector: select(PRESET_NAMES) },
      { type: "grid", name: "", schema: [
        { name: "min", selector: number(-1e9, 1e9) },
        { name: "max", selector: number(-1e9, 1e9) },
        { name: "step", selector: number(0, 1e9, "any") },
        { name: "unit", selector: text() },
        { name: "decimals", selector: number(0, 6) },
      ] },
    ],
    [MODE.COUNTER]: [
      section("counter", t(lang, "editor.section.counter"), [
        { name: "min", selector: number(-1e9, 1e9) },
        { name: "max", selector: number(-1e9, 1e9) },
      ]),
    ],
    [MODE.TIMER]: [
      section("timer", t(lang, "editor.section.timer"), [
        { name: "pulse", selector: bool() },
        { name: "pulse_seconds", selector: number(0, 3600) },
        { name: "info", selector: text() },
        { name: "time_zone", selector: text() },
        { name: "span", selector: number(0.01, 3650) },
      ]),
    ],
    [MODE.CLOCK]: [
      section("clock", t(lang, "editor.section.clock"), [
        { name: "display", selector: select(CLOCK_DISPLAYS_OFFERED) },
        { name: "hour_format", selector: select(HOUR_FORMATS) },
        { name: "seconds", selector: bool() },
        { name: "time_zone", selector: text() },
      ]),
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
    { name: "handle_overhang", selector: bool() },
    { name: "handle_content", selector: select(HANDLE_CONTENTS) },
    { name: "animation", selector: select(ANIMATIONS) },
  ];
}

/** Bar value options: a separate entity and the range/unit it is measured with. */
function barFields() {
  return [
    { name: "entity", labelKey: "editor.entity_bar", selector: { entity: {} } },
    { type: "grid", name: "", schema: [
      { name: "min", selector: number(-1e9, 1e9) },
      { name: "max", selector: number(-1e9, 1e9) },
      { name: "unit", selector: text() },
      { name: "decimals", selector: number(0, 6) },
    ] },
    { name: "preset", selector: select(PRESET_NAMES) },
  ];
}

/** Schema field of one `text:` option: sizes get a number box, colors a text field. */
const textOptionField = ([name, option]) => ({
  name,
  selector: option.unit ? number(MIN_FONT_SIZE, MAX_FONT_SIZE) : text(),
});

/**
 * One nested section per text area, built from TEXT_OPTIONS. The labels come
 * from `labelKey`: the area names ("info", "bar") would otherwise pick up the
 * labels of the top-level fields of the same name.
 */
function textFields(lang) {
  return TEXT_AREAS.map((area) => ({
    ...section(area, t(lang, `editor.section.text_${area}`), Object.entries(TEXT_OPTIONS[area]).map(textOptionField)),
    labelKey: `editor.section.text_${area}`,
  }));
}

/** ha-form schema for the given (raw) config. */
export function buildSchema(config = {}, lang = DEFAULT_LANGUAGE) {
  const domain = typeof config.entity === "string" ? config.entity.split(".")[0] : "";
  const mode = MODES.includes(config.mode) ? config.mode : inferMode(domain);

  return [
    { name: "entity", required: mode !== MODE.CLOCK, selector: { entity: {} } },
    { name: "mode", selector: select(MODES) },
    { name: "name", selector: text() },
    { name: "icon", selector: { icon: {} } },
    { name: "header_position", selector: select(HEADER_POSITIONS) },
    { name: "header_icon_position", selector: select(HEADER_ICON_POSITIONS) },
    ...modeFields(mode, lang),
    { name: "bar_text", selector: text() },
    section("bar", t(lang, "editor.section.bar"), barFields()),
    section("", t(lang, "editor.section.layout"), layoutFields(config)),
    section("", t(lang, "editor.section.colors"), [
      { name: "bar_color", selector: text() },
      { name: "fill_color", selector: text() },
      { name: "handle_color", selector: text() },
      { name: "text_color", selector: text() },
      { name: "border_color", selector: text() },
      { name: "border_width", selector: number(0, 20) },
      { name: "border_radius", selector: number(0, 999) },
    ]),
    section("text", t(lang, "editor.section.text"), textFields(lang)),
    section("", t(lang, "editor.section.actions"), [
      { name: "tap_action", selector: { ui_action: {} } },
      { name: "double_tap_action", selector: { ui_action: {} } },
      { name: "hold_action", selector: { ui_action: {} } },
    ]),
  ];
}

/** Top-level blocks whose cleared fields are dropped at every depth (so no `header: {}` stays behind). */
const NESTED_CLEAN_KEYS = ["text"];

const isCleared = (value) => value === undefined || value === null || value === "";

/** Copy of `value` without cleared fields and without maps that end up empty. */
function pruneCleared(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    const pruned = isPlainObject(entry) ? pruneCleared(entry) : entry;
    if (isCleared(pruned) || (isPlainObject(pruned) && Object.keys(pruned).length === 0)) continue;
    out[key] = pruned;
  }
  return out;
}

/** Drop keys the form cleared (undefined, null or empty string). */
export function cleanConfig(data) {
  const out = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (isCleared(value)) continue;
    if (NESTED_CLEAN_KEYS.includes(key) && isPlainObject(value)) {
      const pruned = pruneCleared(value);
      if (Object.keys(pruned).length > 0) out[key] = pruned;
      continue;
    }
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
    this._computeLabel = (item) => this._label(item);
  }

  /** Label of a form item: dictionary entry, else the section title, else the field name. */
  _label(item) {
    const lang = resolveLanguage(this._hass);
    const key = `editor.${item.name}`;
    // Fields of the `bar:` section share names with top-level fields; the bar entity has its own label.
    if (item.labelKey) return t(lang, item.labelKey);
    if (item.name && hasTranslation(lang, key)) return t(lang, key);
    return item.title ?? item.name;
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

  _schema() {
    return buildSchema(this._config, resolveLanguage(this._hass));
  }

  _render() {
    if (!customElements.get("ha-form")) {
      this._form = null;
      const hint = document.createElement("p");
      hint.textContent = t(resolveLanguage(this._hass), "editor.no_form");
      this.shadowRoot.replaceChildren(hint);
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
    this._form.schema = this._schema();
  }

  _onChanged(event) {
    event.stopPropagation();
    this._config = cleanConfig(event.detail.value);
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
    this._form.schema = this._schema();
  }
}

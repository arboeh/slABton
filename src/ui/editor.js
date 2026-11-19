/*
 * Visual editor built on Home Assistant's `ha-form` (schema editor, no
 * custom inputs). Fields depend on the selected mode. Complex structures
 * (states list, switches, styles) stay YAML-only; ha-form preserves keys it
 * does not know, so they survive editing in the UI. Labels come from the
 * dictionaries in i18n.js (language of the Home Assistant user).
 */

import {
  ARM_SERVICES, CLOCK_DISPLAYS, CLOCK_FACE_NUMBERS, DEFAULTS, DIRECTIONS, HANDLE_CONTENTS, HANDLE_POSITIONS, HANDLE_SHAPES,
  HEADER_ICON_POSITIONS, HEADER_POSITIONS, HOUR_FORMATS, ORIENTATIONS, PRESET_NAMES, inferMode,
} from "../core/config.js";
import {
  ANIMATIONS, DEFAULT_FACE_TICKS, MAX_FONT_SIZE, MAX_SCALE_TICKS, MAX_THICKNESS, MIN_FONT_SIZE, MIN_SCALE_SIZE, MIN_SCALE_TICKS,
  MIN_STEP, MIN_THICKNESS, MODE, MODES, SCALE_ALIASES, SCALE_LABEL_PLACEMENTS, DEFAULT_SCALE_LABEL_PLACEMENT,
  SCALE_TICK_PLACEMENTS, DEFAULT_SCALE_TICK_PLACEMENT, TEXT_AREAS, TEXT_OPTIONS, VALUE_SETTABLE_DOMAINS, scalePositionsFor,
} from "../core/constants.js";
import { DEFAULT_LANGUAGE, hasTranslation, resolveLanguage, t } from "../core/i18n.js";
import { isPlainObject, safeCss, toNumber, warn } from "../core/util.js";

const select = (options) => ({
  select: { mode: "dropdown", options: options.map((value) => ({ value, label: value })) },
});
const number = (min, max, step) => ({ number: { min, max, mode: "box", ...(step === undefined ? {} : { step }) } });
const text = () => ({ text: {} });
const bool = () => ({ boolean: {} });

/** Named expandable section: ha-form passes `data[name]` to its fields. */
const section = (name, title, schema) => ({ type: "expandable", name, title, schema });

/**
 * Dial options of the analog clock (nested `clock.face` section, shown only for `display: analog`).
 * `labelKey`: "numbers" and "ticks" would clash with other labels.
 */
function clockFaceFields(config, lang) {
  if (!isPlainObject(config.clock) || config.clock.display !== "analog") return [];
  return [{
    ...section("face", t(lang, "editor.section.clock_face"), [
      { name: "numbers", labelKey: "editor.clock_face_numbers", selector: select(CLOCK_FACE_NUMBERS) },
      { name: "ticks", labelKey: "editor.clock_face_ticks", selector: bool() },
    ]),
    labelKey: "editor.section.clock_face",
  }];
}

/**
 * The value mode can be dragged only for a settable entity (input_number, number) that is its own bar:
 * with a sensor or a separate bar entity the `drag` switch would do nothing.
 */
function canDrag(config) {
  const domain = typeof config.entity === "string" ? config.entity.split(".")[0] : "";
  const ownBar = !(isPlainObject(config.bar) && (config.bar.entity || config.bar.attribute));
  return VALUE_SETTABLE_DOMAINS.includes(domain) && ownBar;
}

/** Fields that only apply to one mode. */
function modeFields(mode, lang, config) {
  return {
    [MODE.STATE]: [
      { name: "drag", selector: bool() },
      { name: "hold_reverse", selector: bool() },
      { name: "allow_unavailable_actions", selector: bool() },
    ],
    [MODE.LOCK]: [
      { name: "swipe_threshold", selector: number(30, 100) },
      { name: "arm_service", selector: select(ARM_SERVICES) },
    ],
    [MODE.VALUE]: [
      ...(canDrag(config) ? [{ name: "drag", selector: bool() }] : []),
      { name: "preset", selector: select(PRESET_NAMES) },
      { type: "grid", name: "", schema: [
        { name: "min", selector: number(-1e9, 1e9) },
        { name: "max", selector: number(-1e9, 1e9) },
        { name: "step", selector: number(MIN_STEP, 1e9, "any") },
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
        { name: "display", selector: select(CLOCK_DISPLAYS) },
        ...clockFaceFields(config, lang),
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
    { name: "thickness", selector: number(MIN_THICKNESS, MAX_THICKNESS) },
    { name: "handle_size", selector: number(8, 200) },
    { name: "handle_shape", selector: select(HANDLE_SHAPES) },
    { name: "handle_position", selector: select(HANDLE_POSITIONS) },
    ...(config.handle_position === "fixed" ? [{ name: "fixed_position", selector: number(0, 100) }] : []),
    { name: "handle_overhang", selector: bool() },
    { name: "bar_state_color", selector: bool() },
    { name: "handle_content", selector: select(HANDLE_CONTENTS) },
    { name: "animation", selector: select(ANIMATIONS) },
  ];
}

/** Bar value options: a separate entity and the range/unit it is measured with. */
function barFields() {
  return [
    { name: "entity", labelKey: "editor.entity_bar", selector: { entity: {} } },
    { name: "attribute", labelKey: "editor.bar_attribute", selector: text() },
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

/** Bar thickness the config resolves to (the longest tick): same limits and default as `normalizeConfig`. */
const thicknessOf = (config) => toNumber(config.thickness, DEFAULTS.thickness, MIN_THICKNESS, MAX_THICKNESS);

/**
 * Fields of the `scale:` block. `enabled` is form-only (never stored, see `resolveScale`).
 * `labelKey`: "position", "size" and "color" would clash with other labels.
 */
function scaleFields(config) {
  return [
    { name: "enabled", labelKey: "editor.scale_enabled", selector: bool() },
    { name: "ticks", labelKey: "editor.scale_ticks", selector: number(MIN_SCALE_TICKS, MAX_SCALE_TICKS) },
    { name: "ticks_placement", labelKey: "editor.scale_ticks_placement", selector: select(SCALE_TICK_PLACEMENTS) },
    { name: "position", labelKey: "editor.scale_position", selector: select(scalePositionsFor(config.orientation)) },
    { name: "size", labelKey: "editor.scale_size", selector: number(MIN_SCALE_SIZE, thicknessOf(config)) },
    { name: "color", labelKey: "editor.scale_color", selector: text() },
    { name: "labels", labelKey: "editor.scale_labels", selector: bool() },
    { name: "labels_placement", labelKey: "editor.scale_labels_placement", selector: select(SCALE_LABEL_PLACEMENTS) },
  ];
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
    ...modeFields(mode, lang, config),
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
    section("scale", t(lang, "editor.section.scale"), scaleFields(config)),
    section("text", t(lang, "editor.section.text"), textFields(lang)),
    section("", t(lang, "editor.section.actions"), [
      { name: "tap_action", selector: { ui_action: {} } },
      { name: "double_tap_action", selector: { ui_action: {} } },
      { name: "hold_action", selector: { ui_action: {} } },
    ]),
  ];
}

/** Top-level blocks whose cleared fields are dropped at every depth (so no `header: {}` stays behind). */
const NESTED_CLEAN_KEYS = ["text", "scale", "clock", "bar"];

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

/**
 * Form data of a config. The form cannot show `scale: true` or `scale: false`, so the scale becomes a section
 * with the `enabled` switch (on for `true` and for a map); a missing or false scale has no section data.
 */
function formData(config) {
  const { scale, ...base } = config;
  const rest = withFaceDefaults(base);
  if (scale === true) return { ...rest, scale: { ...DEFAULT_PLACEMENTS, enabled: true } };
  return isPlainObject(scale) ? { ...rest, scale: { ...DEFAULT_PLACEMENTS, ...scale, enabled: true } } : rest;
}

/** The placements a scale has without options: the form shows them, the editor never stores them (`dropDefaultPlacements`). */
const DEFAULT_PLACEMENTS = Object.freeze({
  labels_placement: DEFAULT_SCALE_LABEL_PLACEMENT,
  ticks_placement: DEFAULT_SCALE_TICK_PLACEMENT,
});

const isAnalog = (config) => isPlainObject(config.clock) && config.clock.display === "analog";

/** An analog clock draws its tick marks unless told otherwise: show the switch on, not unset. */
function withFaceDefaults(config) {
  if (!isAnalog(config)) return config;
  const face = isPlainObject(config.clock.face) ? config.clock.face : {};
  return { ...config, clock: { ...config.clock, face: { ticks: DEFAULT_FACE_TICKS, ...face } } };
}

/** The editor stores no default: `face.ticks` equal to the default goes (the form shows it on anyway). */
function withoutDefaultFace(config) {
  const face = isPlainObject(config.clock) ? config.clock.face : undefined;
  if (!isPlainObject(face) || face.ticks !== DEFAULT_FACE_TICKS) return config;
  const rest = omit(face, "ticks");
  const clock = Object.keys(rest).length > 0 ? { ...config.clock, face: rest } : omit(config.clock, "face");
  const others = omit(config, "clock");
  return Object.keys(clock).length > 0 ? { ...others, clock } : others;
}

/** `clock.face` only means something for an analog clock; drop it when the display goes back to digital. */
function withoutUnusedFace(config) {
  if (isAnalog(config) || !isPlainObject(config.clock) || config.clock.face === undefined) return config;
  const clock = omit(config.clock, "face");
  const rest = omit(config, "clock");
  return Object.keys(clock).length > 0 ? { ...rest, clock } : rest;
}

/** Copy of `map` without `key`. */
const omit = (map, key) => Object.fromEntries(Object.entries(map).filter(([name]) => name !== key));

/** The scale fields without a placement that equals its default (copy; the input stays as it is). */
function dropDefaultPlacements(fields) {
  const kept = { ...fields };
  if (kept.labels_placement === DEFAULT_SCALE_LABEL_PLACEMENT) delete kept.labels_placement;
  if (kept.ticks_placement === DEFAULT_SCALE_TICK_PLACEMENT) delete kept.ticks_placement;
  return kept;
}

/**
 * Scale to store after a form change: the option map, `true` (defaults) or undefined (off).
 * A scale that was on stays on when its last option is cleared; setting an option switches it on.
 */
function resolveScale(formScale, previous) {
  if (formScale === true) return true;
  if (!isPlainObject(formScale)) return undefined;
  const { enabled, ...fields } = formScale;
  if (enabled === false) return undefined;
  // The editor stores no default: `labels_placement: inside` and `ticks_placement: inside` go.
  const options = pruneCleared(dropDefaultPlacements(fields));
  if (Object.keys(options).length > 0) return options;
  const wasOn = previous !== undefined && previous !== null && previous !== false;
  return enabled === true || wasOn ? true : undefined;
}

const orientationOf = (config) => (config.orientation === "vertical" ? "vertical" : "horizontal");

/** `top`/`bottom` become `left`/`right` (and back) when the orientation changes; other positions stay. */
function mapScalePosition(position, from, to) {
  if (from === to || typeof position !== "string" || !Object.hasOwn(SCALE_ALIASES[from], position)) return position;
  const axis = SCALE_ALIASES[from][position];
  return Object.keys(SCALE_ALIASES[to]).find((alias) => SCALE_ALIASES[to][alias] === axis);
}

/** `scale` with its position carried over to the new orientation. */
function scaleForOrientation(scale, from, to) {
  if (!isPlainObject(scale) || scale.position === undefined) return scale;
  return { ...scale, position: mapScalePosition(scale.position, from, to) };
}

/** `scale.size` after the bar thickness changed from `from` to `to`: a tick longer than the bar is shortened to it. */
function scaleForThickness(scale, from, to) {
  if (from === to || !isPlainObject(scale)) return scale;
  const size = toNumber(scale.size, null, -Infinity, Infinity);
  return size != null && size > to ? { ...scale, size: to } : scale;
}

/** Top-level color options (same list as `COLOR_KEYS` in config.js). */
const COLOR_FIELDS = ["bar_color", "fill_color", "handle_color", "text_color", "border_color"];

const isSet = (value) => value !== undefined && value !== null && value !== "";

/** Names (as written in YAML) of the color options in `config` that the card would not accept. */
function invalidColorFields(config) {
  const entries = COLOR_FIELDS.map((name) => [name, config[name]]);
  if (isPlainObject(config.scale)) entries.push(["scale.color", config.scale.color]);
  if (isPlainObject(config.text)) {
    for (const [area, options] of Object.entries(config.text)) {
      if (!isPlainObject(options)) continue;
      for (const name of ["color", "icon_color"]) entries.push([`text.${area}.${name}`, options[name]]);
    }
  }
  return entries.filter(([, value]) => isSet(value) && safeCss(value, null) === null).map(([name]) => name);
}

/**
 * Notes on values the card would ignore (with a warning in the console). The values stay in the form so that
 * typing a longer value is not cut off; the note disappears once the value is usable.
 * @returns {string[]} texts in the language `lang`
 */
export function validationHints(config, lang = DEFAULT_LANGUAGE) {
  const hints = invalidColorFields(config).map((field) => t(lang, "editor.hint_color", { field }));

  // The card takes `bar.step` over the flat `step` (resolveBar) and reads both within +-1e9 (normalizeStep).
  const barStep = isPlainObject(config.bar) ? config.bar.step : undefined;
  const step = isSet(barStep) ? barStep : config.step;
  if (isSet(step) && !(toNumber(step, NaN, -1e9, 1e9) >= MIN_STEP)) {
    hints.push(t(lang, "editor.hint_step", { min: MIN_STEP }));
  }

  const thickness = thicknessOf(config);
  const size = isPlainObject(config.scale) ? toNumber(config.scale.size, null, -Infinity, Infinity) : null;
  if (size != null && size > thickness) hints.push(t(lang, "editor.hint_scale_size", { size, thickness }));
  else if (size != null && size < MIN_SCALE_SIZE) hints.push(t(lang, "editor.hint_scale_size_min", { size, min: MIN_SCALE_SIZE }));
  return hints;
}

export class SlabtonCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._form = null;
    this._hints = null;
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
      this._hints = null;
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
      this._hints = document.createElement("div");
      this._hints.className = "hints";
      this._hints.setAttribute("role", "status");
      const style = document.createElement("style");
      style.textContent = ".hints p { margin: 8px 0 0; font-size: 12px; color: var(--error-color, #db4437); }";
      this.shadowRoot.append(this._form, style, this._hints);
    }
    this._form.hass = this._hass;
    this._form.data = formData(this._config);
    this._form.schema = this._schema();
    this._renderHints();
  }

  /** Show the notes of `validationHints` (text only) below the form. */
  _renderHints() {
    if (!this._hints) return;
    const notes = validationHints(this._config, resolveLanguage(this._hass)).map((text) => {
      const note = document.createElement("p");
      note.textContent = text;
      return note;
    });
    this._hints.replaceChildren(...notes);
  }

  _onChanged(event) {
    event.stopPropagation();
    const { scale: formScale, ...rest } = event.detail.value ?? {};
    const cleaned = withoutUnusedFace(withoutDefaultFace(cleanConfig(rest)));
    const resolved = scaleForOrientation(
      resolveScale(formScale, this._config.scale), orientationOf(this._config), orientationOf(cleaned),
    );
    const scale = scaleForThickness(resolved, thicknessOf(this._config), thicknessOf(cleaned));
    this._config = scale === undefined ? cleaned : { ...cleaned, scale };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
    // Keep the form in step with the stored config, whether or not HA calls setConfig back.
    this._form.data = formData(this._config);
    this._form.schema = this._schema();
    this._renderHints();
  }
}

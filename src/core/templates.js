/*
 * Quick start catalog (no DOM): the templates the visual editor offers for a card that has not been set up yet.
 * A template is data. `build(entity)` expands it into a plain card config (without `type`): the card never
 * refers back to the template, so the result is ordinary YAML the user can edit freely.
 *
 * Entry fields:
 *  - `id`, `icon` (mdi icon name), `labelKey` / `descriptionKey` (dictionary keys, see i18n.js)
 *  - `entity`: `null` (the template asks nothing) or `{ domains, deviceClasses? }`, the filter of the entity question
 *  - `sample`: static example for the preview tile (`entity`, `state`, `attributes`), never a real entity
 *  - `build(entity)`: pure, returns a new config object; `null` for the entry that only closes the selection
 *
 * More fields can be added later without breaking users of the catalog.
 */

import { MODE } from "./constants.js";
import { isPlainObject } from "./util.js";

/** Keys Home Assistant manages on a card: the quick start keeps them when it replaces the other options. */
export const HA_MANAGED_KEYS = Object.freeze(["type", "grid_options", "layout_options", "view_layout", "visibility"]);

/** Options that do not count as "set up": a card with only these (plus the HA keys) is still untouched. */
const UNTOUCHED_KEYS = Object.freeze(["entity", "name"]);

/** Id of the entry that closes the selection without changing the config. */
export const NONE_TEMPLATE_ID = "none";

/** Entity domains `getStubConfig` picks from, in order of preference (owned by the "none" entry). */
const STUB_DOMAIN_LIST = Object.freeze(["input_select", "select", "switch", "input_boolean", "light"]);

/** Look of the shutter template: slat count and gap, bar width in px, open (blue) and closed (shutter grey). */
const SHUTTER_SEGMENTS = 10;
const SHUTTER_GAP = 3;
const SHUTTER_THICKNESS = 64;
const SHUTTER_OPEN_COLOR = "#2196f3";
const SHUTTER_CLOSED_COLOR = "#757575";

const entry = (fields) => Object.freeze({
  entity: null,
  build: null,
  sample: null,
  ...fields,
  ...(fields.entity ? { entity: Object.freeze({ ...fields.entity }) } : {}),
});

export const TEMPLATES = Object.freeze([
  entry({
    id: NONE_TEMPLATE_ID,
    icon: "mdi:tune-variant",
    labelKey: "editor.template.none",
    descriptionKey: "editor.template.none_desc",
    stubDomains: STUB_DOMAIN_LIST,
  }),
  entry({
    id: "clock",
    icon: "mdi:clock-outline",
    labelKey: "editor.template.clock",
    descriptionKey: "editor.template.clock_desc",
    sample: { entity: null, state: null, attributes: {} },
    build: () => ({ mode: MODE.CLOCK }),
  }),
  entry({
    id: "timer",
    icon: "mdi:timer-outline",
    labelKey: "editor.template.timer",
    descriptionKey: "editor.template.timer_desc",
    entity: { domains: ["timer"] },
    sample: {
      entity: "timer.sample",
      state: "paused",
      attributes: { friendly_name: "Timer", duration: "0:10:00", remaining: "0:06:40" },
    },
    build: (entityId) => ({ entity: entityId, mode: MODE.TIMER }),
  }),
  entry({
    id: "lock",
    icon: "mdi:lock-outline",
    labelKey: "editor.template.lock",
    descriptionKey: "editor.template.lock_desc",
    entity: { domains: ["lock", "alarm_control_panel"] },
    sample: { entity: "lock.sample", state: "locked", attributes: { friendly_name: "Door" } },
    build: (entityId) => ({ entity: entityId, mode: MODE.LOCK }),
  }),
  entry({
    id: "thermometer",
    icon: "mdi:thermometer",
    labelKey: "editor.template.thermometer",
    descriptionKey: "editor.template.thermometer_desc",
    entity: { domains: ["sensor"], deviceClasses: ["temperature"] },
    sample: {
      entity: "sensor.sample",
      state: "21.5",
      attributes: { friendly_name: "Temperature", device_class: "temperature", unit_of_measurement: "°C" },
    },
    build: (entityId) => ({ entity: entityId, mode: MODE.VALUE, preset: "thermometer" }),
  }),
  entry({
    id: "thermostat",
    icon: "mdi:thermostat",
    labelKey: "editor.template.thermostat",
    descriptionKey: "editor.template.thermostat_desc",
    entity: { domains: ["climate"] },
    sample: {
      entity: "climate.sample",
      state: "heat",
      attributes: {
        friendly_name: "Thermostat", current_temperature: 21.5, min_temp: 5, max_temp: 30, hvac_modes: ["off", "heat"],
      },
    },
    // No `mode`: the state mode of the domain stays, the bar only reads the measured temperature (see `bar.attribute`).
    build: (entityId) => ({ entity: entityId, bar: { attribute: "current_temperature", unit: "°C" }, bar_text: "{value}" }),
  }),
  entry({
    id: "shutter",
    icon: "mdi:window-shutter",
    labelKey: "editor.template.shutter",
    descriptionKey: "editor.template.shutter_desc",
    // Any cover, no device class: many covers report none (a garage door shows up in the list too).
    entity: { domains: ["cover"] },
    sample: {
      entity: "cover.sample",
      state: "open",
      attributes: { friendly_name: "Shutter", current_position: 60, supported_features: 15, device_class: "shutter" },
    },
    // Slats across a vertical bar: closed (grey) on top, open (blue) below.
    build: (entityId) => ({
      entity: entityId,
      mode: MODE.VALUE,
      orientation: "vertical",
      thickness: SHUTTER_THICKNESS,
      bar: { segments: { count: SHUTTER_SEGMENTS, gap: SHUTTER_GAP, on_color: SHUTTER_OPEN_COLOR, off_color: SHUTTER_CLOSED_COLOR } },
    }),
  }),
  entry({
    id: "battery",
    icon: "mdi:battery-70",
    labelKey: "editor.template.battery",
    descriptionKey: "editor.template.battery_desc",
    entity: { domains: ["sensor"], deviceClasses: ["battery"] },
    sample: {
      entity: "sensor.sample",
      state: "73",
      attributes: { friendly_name: "Battery", device_class: "battery", unit_of_measurement: "%" },
    },
    build: (entityId) => ({ entity: entityId, mode: MODE.VALUE, preset: "soc" }),
  }),
]);

/** Domains `getStubConfig` picks its entity from (the "none" entry). */
export const STUB_DOMAINS = TEMPLATES.find((template) => template.id === NONE_TEMPLATE_ID).stubDomains;

/** The catalog entry with this id, or undefined. */
export const findTemplate = (id) => TEMPLATES.find((template) => template.id === id);

/**
 * True for a card that has not been set up: only the HA-managed keys, `entity` and `name`
 * (what `getStubConfig` and a first pick of the entity leave behind).
 */
export function isUntouchedConfig(config) {
  if (!isPlainObject(config)) return false;
  return Object.keys(config).every((key) => HA_MANAGED_KEYS.includes(key) || UNTOUCHED_KEYS.includes(key));
}

/** Filter list for an `entity` selector of ha-form, from the `entity` field of a template. */
export function entityFilter(entityQuestion) {
  if (!entityQuestion) return [];
  const { domains, deviceClasses } = entityQuestion;
  return [{ domain: [...domains], ...(deviceClasses ? { device_class: [...deviceClasses] } : {}) }];
}

/** True when `entityId` looks like `domain.object_id` with a domain the template asks for. */
export function isEntityFor(template, entityId) {
  if (!template?.entity || typeof entityId !== "string") return false;
  const [domain, objectId, ...rest] = entityId.split(".");
  return rest.length === 0 && Boolean(objectId) && /^[a-z0-9_]+$/.test(objectId) && template.entity.domains.includes(domain);
}

import { describe, expect, it } from "vitest";
import de from "../../src/core/locales/de.json";
import en from "../../src/core/locales/en.json";
import { normalizeConfig } from "../../src/core/config.js";
import {
  HA_MANAGED_KEYS, NONE_TEMPLATE_ID, STUB_DOMAINS, TEMPLATES, entityFilter, findTemplate, isEntityFor, isUntouchedConfig,
} from "../../src/core/templates.js";

const withEntity = TEMPLATES.filter((template) => template.build);
const SAMPLE_MODES = {
  clock: "clock", timer: "timer", lock: "lock", thermometer: "value", thermostat: "state", shutter: "value", battery: "value",
};

describe("catalog", () => {
  it("has the phase A and B templates in order with unique ids", () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(ids).toEqual(["none", "clock", "timer", "lock", "thermometer", "thermostat", "shutter", "battery"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(TEMPLATES)).toBe(true);
    expect(Object.isFrozen(TEMPLATES[0])).toBe(true);
  });

  it("has label and description keys in both languages", () => {
    for (const template of TEMPLATES) {
      for (const key of [template.labelKey, template.descriptionKey]) {
        expect(typeof en[key], key).toBe("string");
        expect(typeof de[key], key).toBe("string");
      }
    }
  });

  it("takes the stub domains from the none entry", () => {
    expect(STUB_DOMAINS).toEqual(["input_select", "select", "switch", "input_boolean", "light"]);
    expect(findTemplate(NONE_TEMPLATE_ID).stubDomains).toBe(STUB_DOMAINS);
    expect(findTemplate(NONE_TEMPLATE_ID).build).toBeNull();
  });
});

describe("build", () => {
  const entityOf = (template) => template.sample.entity;

  it.each(withEntity.map((template) => [template.id, template]))("%s expands to a config the card accepts", (id, template) => {
    const config = template.build(entityOf(template));
    const normalized = normalizeConfig({ type: "custom:slabton-card", ...config });
    expect(normalized.mode).toBe(SAMPLE_MODES[id]);
  });

  it("asks for an entity exactly where the config needs one", () => {
    expect(findTemplate("clock").entity).toBeNull();
    for (const id of ["timer", "lock", "thermometer", "thermostat", "shutter", "battery"]) {
      expect(findTemplate(id).entity.domains.length).toBeGreaterThan(0);
    }
  });

  it("expands the thermostat to a bar that reads the measured temperature in the state mode", () => {
    const config = findTemplate("thermostat").build("climate.living_room");
    expect(config).toEqual({
      entity: "climate.living_room", bar: { attribute: "current_temperature", unit: "°C" }, bar_text: "{value}",
    });
    expect(config).not.toHaveProperty("mode");
    const normalized = normalizeConfig(config);
    expect(normalized).toMatchObject({ mode: "state", bar_attribute: "current_temperature", unit: "°C" });
  });

  it("expands the shutter to a vertical segmented cover bar", () => {
    const config = findTemplate("shutter").build("cover.living_room");
    expect(config).toMatchObject({ entity: "cover.living_room", mode: "value", orientation: "vertical" });
    const normalized = normalizeConfig(config);
    expect(normalized.bar_segments).toEqual({ count: 10, gap: 3, on_color: "#2196f3", off_color: "#757575" });
    expect(normalized).toMatchObject({ mode: "value", orientation: "vertical", unit: "%", decimals: 0 });
  });

  it("expands the battery to the soc preset", () => {
    expect(findTemplate("battery").build("sensor.battery")).toEqual({ entity: "sensor.battery", mode: "value", preset: "soc" });
    expect(normalizeConfig(findTemplate("battery").build("sensor.battery"))).toMatchObject({ preset: "soc", min: 0, max: 100, unit: "%" });
  });

  it("builds the new templates without touching their input or sharing nested objects", () => {
    const first = findTemplate("shutter").build("cover.a");
    first.bar.segments.count = 99;
    expect(findTemplate("shutter").build("cover.a").bar.segments.count).toBe(10);
    const thermostat = findTemplate("thermostat").build("climate.a");
    thermostat.bar.unit = "x";
    expect(findTemplate("thermostat").build("climate.a").bar.unit).toBe("°C");
  });

  it("returns a new object on every call and keeps no reference to the template", () => {
    const timer = findTemplate("timer");
    const first = timer.build("timer.a");
    const second = timer.build("timer.a");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.mode = "changed";
    expect(timer.build("timer.a").mode).toBe("timer");
  });

  it("never carries a type (HA owns it) and puts the entity in", () => {
    expect(findTemplate("clock").build()).toEqual({ mode: "clock" });
    expect(findTemplate("lock").build("lock.door")).toEqual({ entity: "lock.door", mode: "lock" });
    expect(findTemplate("thermometer").build("sensor.t")).toEqual({ entity: "sensor.t", mode: "value", preset: "thermometer" });
    for (const template of withEntity) expect(template.build(entityOf(template))).not.toHaveProperty("type");
  });

  it("keeps the thermometer preset defaults", () => {
    const normalized = normalizeConfig(findTemplate("thermometer").build("sensor.t"));
    expect(normalized).toMatchObject({ preset: "thermometer", icon: "mdi:thermometer" });
  });
});

describe("isUntouchedConfig", () => {
  it("accepts type, entity, name and the HA-managed keys", () => {
    expect(isUntouchedConfig({})).toBe(true);
    expect(isUntouchedConfig({ type: "custom:slabton-card", entity: "" })).toBe(true);
    expect(isUntouchedConfig({ type: "x", entity: "switch.a", name: "A" })).toBe(true);
    expect(isUntouchedConfig(Object.fromEntries(HA_MANAGED_KEYS.map((key) => [key, 1])))).toBe(true);
  });

  it("rejects any other option", () => {
    expect(isUntouchedConfig({ entity: "switch.a", thickness: 40 })).toBe(false);
    expect(isUntouchedConfig({ mode: "clock" })).toBe(false);
  });

  it("rejects values that are not a config", () => {
    for (const value of [null, undefined, "x", 3, []]) expect(isUntouchedConfig(value)).toBe(false);
  });
});

describe("entity question", () => {
  it("builds the ha-form filter from the catalog", () => {
    expect(entityFilter(findTemplate("thermometer").entity)).toEqual([{ domain: ["sensor"], device_class: ["temperature"] }]);
    expect(entityFilter(findTemplate("lock").entity)).toEqual([{ domain: ["lock", "alarm_control_panel"] }]);
    expect(entityFilter(findTemplate("thermostat").entity)).toEqual([{ domain: ["climate"] }]);
    expect(entityFilter(findTemplate("shutter").entity)).toEqual([{ domain: ["cover"] }]);
    expect(entityFilter(findTemplate("battery").entity)).toEqual([{ domain: ["sensor"], device_class: ["battery"] }]);
    expect(entityFilter(null)).toEqual([]);
  });

  it("accepts the right domain for each new template", () => {
    expect(isEntityFor(findTemplate("thermostat"), "climate.living_room")).toBe(true);
    expect(isEntityFor(findTemplate("thermostat"), "sensor.living_room")).toBe(false);
    expect(isEntityFor(findTemplate("shutter"), "cover.garage")).toBe(true);
    expect(isEntityFor(findTemplate("shutter"), "switch.garage")).toBe(false);
    expect(isEntityFor(findTemplate("battery"), "sensor.battery")).toBe(true);
    expect(isEntityFor(findTemplate("battery"), "cover.battery")).toBe(false);
  });

  it("accepts only entities of the asked domains", () => {
    const lock = findTemplate("lock");
    expect(isEntityFor(lock, "lock.door")).toBe(true);
    expect(isEntityFor(lock, "alarm_control_panel.home")).toBe(true);
    expect(isEntityFor(lock, "switch.door")).toBe(false);
    expect(isEntityFor(lock, "lock.")).toBe(false);
    expect(isEntityFor(lock, "lock.a.b")).toBe(false);
    expect(isEntityFor(lock, "lock.<b>")).toBe(false);
    expect(isEntityFor(lock, "")).toBe(false);
    expect(isEntityFor(lock, undefined)).toBe(false);
    expect(isEntityFor(findTemplate("clock"), "lock.door")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import de from "../../src/core/locales/de.json";
import en from "../../src/core/locales/en.json";
import { normalizeConfig } from "../../src/core/config.js";
import {
  HA_MANAGED_KEYS, NONE_TEMPLATE_ID, STUB_DOMAINS, TEMPLATES, entityFilter, findTemplate, isEntityFor, isUntouchedConfig,
} from "../../src/core/templates.js";

const withEntity = TEMPLATES.filter((template) => template.build);
const SAMPLE_MODES = { clock: "clock", timer: "timer", lock: "lock", thermometer: "value" };

describe("catalog", () => {
  it("has the five phase A templates with unique ids", () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(ids).toEqual(["none", "clock", "timer", "lock", "thermometer"]);
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
    for (const id of ["timer", "lock", "thermometer"]) expect(findTemplate(id).entity.domains.length).toBeGreaterThan(0);
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
    expect(entityFilter(null)).toEqual([]);
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

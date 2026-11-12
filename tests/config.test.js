import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULTS, inferMode, normalizeConfig } from "../src/config.js";

afterEach(() => vi.restoreAllMocks());

const base = { type: "custom:slabton-card", entity: "input_select.mode" };

describe("normalizeConfig defaults", () => {
  it("resolves a minimal config", () => {
    const c = normalizeConfig(base);
    expect(c.mode).toBe("state");
    expect(c.orientation).toBe(DEFAULTS.orientation);
    expect(c.direction).toBe("ltr");
    expect(c.handle_shape).toBe("round");
    expect(c.handle_position).toBe("flex");
    expect(c.animation).toBe("slide");
    expect(c.handle_content).toBe("icon");
    expect(c.drag).toBe(true);
    expect(c.states).toEqual([]);
    expect(c.switches).toEqual({});
  });

  it("does not mutate the input", () => {
    const raw = { ...base, thickness: 9999 };
    normalizeConfig(raw);
    expect(raw.thickness).toBe(9999);
  });
});

describe("validation", () => {
  it("rejects non-objects and missing entities", () => {
    expect(() => normalizeConfig(null)).toThrow(/invalid configuration/);
    expect(() => normalizeConfig({})).toThrow(/entity is required/);
    expect(() => normalizeConfig({ entity: "nodot" })).toThrow(/domain.object_id/);
  });

  it("rejects unknown enum values with the allowed list", () => {
    expect(() => normalizeConfig({ ...base, handle_shape: "star" })).toThrow(/handle_shape "star".*round, oval, square/);
    expect(() => normalizeConfig({ ...base, mode: "clock" })).toThrow(/invalid mode/);
    expect(() => normalizeConfig({ ...base, animation: "spin" })).toThrow(/invalid animation/);
  });

  it("clamps numbers", () => {
    const c = normalizeConfig({ ...base, thickness: 9999, handle_size: -4, swipe_threshold: 5 });
    expect(c.thickness).toBe(200);
    expect(c.handle_size).toBe(8);
    expect(c.swipe_threshold).toBe(30);
  });

  it("drops unsafe colors", () => {
    const c = normalizeConfig({ ...base, bar_color: "red;}", fill_color: "var(--accent)" });
    expect(c.bar_color).toBeNull();
    expect(c.fill_color).toBe("var(--accent)");
  });

  it("requires max greater than min", () => {
    expect(() => normalizeConfig({ entity: "sensor.t", min: 10, max: 10 })).toThrow(/max must be greater/);
  });

  it("ignores reserved thresholds", () => {
    const c = normalizeConfig({ ...base, thresholds: [{ value: 1 }] });
    expect(c.thresholds).toBeUndefined();
  });
});

describe("mode inference", () => {
  it.each([
    ["lock", "lock"],
    ["alarm_control_panel", "lock"],
    ["sensor", "value"],
    ["number", "value"],
    ["input_number", "value"],
    ["select", "state"],
    ["switch", "state"],
  ])("%s -> %s", (domain, mode) => {
    expect(inferMode(domain)).toBe(mode);
    expect(normalizeConfig({ entity: `${domain}.x` }).mode).toBe(mode);
  });

  it("honors an explicit mode and picks mode-specific content default", () => {
    expect(normalizeConfig({ entity: "sensor.t", mode: "state" }).mode).toBe("state");
    expect(normalizeConfig({ entity: "sensor.t" }).handle_content).toBe("text");
  });
});

describe("presets", () => {
  it("apply range, unit, icon and decimals as defaults", () => {
    const c = normalizeConfig({ entity: "sensor.t", preset: "thermometer" });
    expect(c).toMatchObject({ min: -10, max: 40, unit: "°C", icon: "mdi:thermometer", decimals: 1 });
  });

  it("can be overridden", () => {
    const c = normalizeConfig({ entity: "sensor.p", preset: "energy", max: 9000, unit: "kW" });
    expect(c).toMatchObject({ min: 0, max: 9000, unit: "kW" });
  });

  it("reject unknown presets", () => {
    expect(() => normalizeConfig({ entity: "sensor.t", preset: "x" })).toThrow(/preset/);
  });
});

describe("actions", () => {
  it("normalizes perform-action and legacy call-service", () => {
    const a = normalizeConfig({ ...base, tap_action: { action: "perform-action", perform_action: "light.turn_on", target: { entity_id: "light.a" }, data: { brightness: 5 } } }).tap_action;
    expect(a).toEqual({ action: "perform-action", perform_action: "light.turn_on", target: { entity_id: "light.a" }, data: { brightness: 5 } });
    const legacy = normalizeConfig({ ...base, tap_action: { action: "call-service", service: "light.toggle" } }).tap_action;
    expect(legacy.action).toBe("perform-action");
    expect(legacy.perform_action).toBe("light.toggle");
  });

  it("defaults the header icon to the left and validates the option", () => {
    expect(normalizeConfig(base).header_icon_position).toBe("left");
    expect(normalizeConfig({ ...base, header_icon_position: "right" }).header_icon_position).toBe("right");
    expect(() => normalizeConfig({ ...base, header_icon_position: "top" })).toThrow(/invalid header_icon_position/);
  });

  it("ignores actions of the HA picker that the card does not implement", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const action of ["default", "assist", "fire-dom-event"]) {
      const config = normalizeConfig({ ...base, tap_action: { action } });
      expect(config.tap_action).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("warns about free state values on on/off domains only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    normalizeConfig({ entity: "switch.a", states: ["off", "Auto"] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Auto/);
    warn.mockClear();
    normalizeConfig({ entity: "input_select.a", states: ["off", "Auto"] });
    normalizeConfig({ entity: "switch.a", states: ["off", "on"] });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("rejects malformed actions", () => {
    expect(() => normalizeConfig({ ...base, tap_action: { action: "explode" } })).toThrow(/tap_action.action/);
    expect(() => normalizeConfig({ ...base, tap_action: "toggle" })).toThrow(/needs an "action"/);
    expect(() => normalizeConfig({ ...base, tap_action: { action: "perform-action", perform_action: "bad" } })).toThrow(/domain.service/);
    expect(() => normalizeConfig({ ...base, tap_action: { action: "navigate", navigation_path: "//evil" } })).toThrow(/navigation_path/);
    expect(() => normalizeConfig({ ...base, tap_action: { action: "url" } })).toThrow(/url_path/);
  });

  it("keeps cycle actions and navigate paths", () => {
    expect(normalizeConfig({ ...base, hold_action: { action: "cycle_back" } }).hold_action).toEqual({ action: "cycle_back" });
    expect(normalizeConfig({ ...base, tap_action: { action: "navigate", navigation_path: "/lovelace/0" } }).tap_action.navigation_path).toBe("/lovelace/0");
  });
});

describe("states", () => {
  it("accepts strings and objects", () => {
    const c = normalizeConfig({ ...base, states: ["off", { value: "auto", icon: "mdi:auto-fix", color: "orange" }, 3] });
    expect(c.states.map((s) => s.value)).toEqual(["off", "auto", "3"]);
    expect(c.states[1]).toMatchObject({ icon: "mdi:auto-fix", color: "orange" });
  });

  it("rejects entries without a value", () => {
    expect(() => normalizeConfig({ ...base, states: [{ label: "x" }] })).toThrow(/states\[0\]/);
    expect(() => normalizeConfig({ ...base, states: "off" })).toThrow(/list/);
  });
});

describe("styles and switches", () => {
  it("prefixes short style keys and drops unsafe entries", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, styles: { "bar-color": "navy", "--slabton-x": "1px", "Bad Key": "red", "handle-color": "red;" } });
    expect(c.styles).toEqual({ "--slabton-bar-color": "navy", "--slabton-x": "1px" });
  });

  it("normalizes switch slots", () => {
    const c = normalizeConfig({ ...base, switches: { start: { entity: "switch.a", icon: "mdi:power" }, end: { name: "End" } } });
    expect(c.switches.start.entity).toBe("switch.a");
    expect(c.switches.end.icon).toBe("mdi:circle-outline");
    expect(c.switches.mid).toBeUndefined();
  });

  it("rejects invalid switch entities", () => {
    expect(() => normalizeConfig({ ...base, switches: { start: { entity: "bad" } } })).toThrow(/switches.start.entity/);
  });
});

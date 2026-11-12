import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULTS, MAX_TEXT_LENGTH, RESERVED_KEYS, inferMode, normalizeConfig } from "../../src/core/config.js";

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
    expect(() => normalizeConfig({ ...base, mode: "banana" })).toThrow(/invalid mode/);
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
    ["counter", "counter"],
    ["timer", "timer"],
    ["input_datetime", "state"],
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

describe("bar block", () => {
  it("keeps flat options working and leaves the bar coupled to the entity", () => {
    const c = normalizeConfig({ entity: "sensor.t", min: 5, max: 50, unit: "V", decimals: 2 });
    expect(c).toMatchObject({ min: 5, max: 50, unit: "V", decimals: 2, bar_entity: null });
    expect(c.range_set).toEqual({ min: true, max: true });
  });

  it("reads range options and the entity from bar:", () => {
    const c = normalizeConfig({
      entity: "timer.sauna",
      bar: { entity: "sensor.sauna_temp", min: 20, max: 100, unit: "°C", decimals: 0, preset: "thermometer" },
    });
    expect(c).toMatchObject({ bar_entity: "sensor.sauna_temp", min: 20, max: 100, unit: "°C", decimals: 0, preset: "thermometer" });
  });

  it("lets bar: win over flat options and warns about the conflict", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ entity: "sensor.t", max: 10, bar: { max: 20 } });
    expect(c.max).toBe(20);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/bar\.max/);
    warn.mockClear();
    normalizeConfig({ entity: "sensor.t", max: 20, bar: { max: 20 } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("validates bar:", () => {
    expect(() => normalizeConfig({ entity: "sensor.t", bar: "x" })).toThrow(/bar must be a map/);
    expect(() => normalizeConfig({ entity: "sensor.t", bar: { entity: "nodot" } })).toThrow(/bar\.entity/);
    expect(() => normalizeConfig({ entity: "sensor.t", bar: { min: 5, max: 5 } })).toThrow(/max must be greater/);
  });
});

describe("new modes", () => {
  it("allows the clock without an entity but nothing else", () => {
    const c = normalizeConfig({ mode: "clock" });
    expect(c.entity).toBeNull();
    expect(c.mode).toBe("clock");
    expect(() => normalizeConfig({ mode: "timer" })).toThrow(/entity is required/);
  });

  it("defaults the handle to text for counter, timer and clock", () => {
    expect(normalizeConfig({ entity: "counter.a" }).handle_content).toBe("text");
    expect(normalizeConfig({ entity: "timer.a" }).handle_content).toBe("text");
    expect(normalizeConfig({ mode: "clock" }).handle_content).toBe("text");
  });

  it("normalizes the counter block", () => {
    expect(normalizeConfig({ entity: "counter.a" }).counter).toEqual({ min: null, max: null });
    expect(normalizeConfig({ entity: "counter.a", counter: { min: 1, max: 9 } }).counter).toEqual({ min: 1, max: 9 });
    expect(() => normalizeConfig({ entity: "counter.a", counter: { min: 9, max: 1 } })).toThrow(/counter\.max/);
    expect(() => normalizeConfig({ entity: "counter.a", counter: "x" })).toThrow(/counter must be a map/);
  });

  it("normalizes the timer block with defaults", () => {
    expect(normalizeConfig({ entity: "timer.a" }).timer).toEqual({
      pulse: true, pulse_seconds: 10, info: null, time_zone: null, span: 30,
    });
    const c = normalizeConfig({
      entity: "input_datetime.t",
      mode: "timer",
      timer: { pulse: false, pulse_seconds: 0, info: "Ende {target}", time_zone: "Europe/Berlin", span: 7 },
    });
    expect(c.timer).toEqual({ pulse: false, pulse_seconds: 0, info: "Ende {target}", time_zone: "Europe/Berlin", span: 7 });
  });

  it("rejects unknown time zones", () => {
    expect(() => normalizeConfig({ entity: "timer.a", timer: { time_zone: "Mars/Olympus" } })).toThrow(/timer\.time_zone/);
    expect(() => normalizeConfig({ mode: "clock", clock: { time_zone: "nope" } })).toThrow(/clock\.time_zone/);
  });

  it("normalizes the clock block and reserves analog", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ mode: "clock" }).clock).toEqual({
      display: "digital", time_zone: null, hour_format: "auto", seconds: false,
    });
    const c = normalizeConfig({ mode: "clock", clock: { display: "analog", hour_format: 12, seconds: true, time_zone: "UTC" } });
    expect(c.clock).toEqual({ display: "digital", time_zone: "UTC", hour_format: "12", seconds: true });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/analog.*reserved/));
    expect(() => normalizeConfig({ mode: "clock", clock: { hour_format: "13" } })).toThrow(/clock\.hour_format/);
    expect(() => normalizeConfig({ mode: "clock", clock: { display: "x" } })).toThrow(/clock\.display/);
  });

  it("warns about blocks of other modes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    normalizeConfig({ entity: "timer.a", counter: { min: 1 } });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/counter: block is ignored/));
  });
});

describe("reserved keys and texts", () => {
  it("warns once per reserved key and ignores it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, thresholds: [], scale: {}, shape: "circle", control: "select" });
    expect(RESERVED_KEYS).toEqual(["thresholds", "scale", "shape", "control"]);
    expect(warn).toHaveBeenCalledTimes(4);
    for (const key of RESERVED_KEYS) expect(c[key]).toBeUndefined();
  });

  it("keeps bar_text and warns about placeholders the mode does not know", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ entity: "timer.a", bar_text: "noch {remaining_text}" }).bar_text).toBe("noch {remaining_text}");
    expect(warn).not.toHaveBeenCalled();
    normalizeConfig({ entity: "counter.a", bar_text: "{remaining}" });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/\{remaining\}.*counter/));
  });

  it("shortens very long texts", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ ...base, bar_text: "x".repeat(500) }).bar_text).toHaveLength(MAX_TEXT_LENGTH);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/shortened/));
  });
});

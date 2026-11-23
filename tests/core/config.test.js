import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULTS, MAX_TEXT_LENGTH, RESERVED_KEYS, inferMode, normalizeConfig } from "../../src/core/config.js";

afterEach(() => vi.restoreAllMocks());

const base = { type: "custom:slabton-card", entity: "input_select.mode" };

// Shared by the scale placement blocks below.
const valueBase = { ...base, entity: "sensor.x", mode: "value", min: 0, max: 100 };
const scaleOf = (scale, extra = {}) => normalizeConfig({ ...valueBase, ...extra, scale }).scale;
const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

describe("timer.start_action and timer.end_action", () => {
  const timerBase = { ...base, entity: "timer.klima" };
  const on = { action: "perform-action", perform_action: "climate.turn_on", target: { entity_id: "climate.a" } };
  const off = { action: "perform-action", perform_action: "climate.turn_off", target: { entity_id: "climate.a" } };
  const timerOf = (timer, extra = {}) => normalizeConfig({ ...timerBase, ...extra, timer }).timer;

  it("default to no action", () => {
    expect(timerOf(undefined)).toMatchObject({ start_action: null, end_action: null });
    expect(normalizeConfig({ ...base, entity: "sensor.x" }).timer).toMatchObject({ start_action: null, end_action: null });
  });

  it("normalize both actions like the card's other actions", () => {
    const timer = timerOf({ start_action: { ...on, data: { x: 1 } }, end_action: { action: "call-service", service: "climate.turn_off", service_data: { y: 2 } } });
    expect(timer.start_action).toEqual({ action: "perform-action", perform_action: "climate.turn_on", target: { entity_id: "climate.a" }, data: { x: 1 } });
    expect(timer.end_action).toMatchObject({ action: "perform-action", perform_action: "climate.turn_off", data: { y: 2 } });
  });

  it("accept one action without the other", () => {
    expect(timerOf({ end_action: off })).toMatchObject({ start_action: null, end_action: off });
    expect(timerOf({ start_action: on })).toMatchObject({ start_action: on, end_action: null });
  });

  it("throw a readable error for a malformed action", () => {
    expect(() => timerOf({ start_action: { perform_action: "x.y" } })).toThrow(/timer\.start_action needs an "action"/);
    expect(() => timerOf({ end_action: { action: "perform-action", perform_action: "nope" } })).toThrow(/timer\.end_action\.perform_action/);
    expect(() => timerOf({ end_action: { action: "fly" } })).toThrow(/timer\.end_action\.action/);
  });

  it("warn and drop an ignored Home Assistant action", () => {
    const warn = warnSpy();
    expect(timerOf({ end_action: { action: "assist" } }).end_action).toBeNull();
    expect(warn.mock.calls.flat().join(" ")).toContain("timer.end_action.action");
  });

  it("drop action none without a warning, and unattended-unsuitable actions with one", () => {
    const warn = warnSpy();
    expect(timerOf({ end_action: { action: "none" } }).end_action).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    for (const bad of [{ action: "toggle" }, { action: "more-info" }, { action: "navigate", navigation_path: "/x" }, { action: "url", url_path: "https://a.b" }]) {
      expect(timerOf({ start_action: bad }).start_action).toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls[0][0]).toContain("timer.start_action must be a perform-action");
  });

  it("drop a toggle even when it names its entity (two cards would flip the device back)", () => {
    const warn = warnSpy();
    expect(timerOf({ end_action: { action: "toggle", entity: "switch.a" } }).end_action).toBeNull();
    expect(warn.mock.calls[0][0]).toContain("timer.end_action must be a perform-action");
  });

  it("warn and drop both for a countdown target, and keep the card running", () => {
    const warn = warnSpy();
    const timer = normalizeConfig({ ...base, entity: "input_datetime.fest", mode: "timer", timer: { start_action: on, end_action: off } }).timer;
    expect(timer).toMatchObject({ start_action: null, end_action: null });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain("timer.start_action only works with a timer.* entity");
  });

  it("do not warn without an action for a countdown target", () => {
    const warn = warnSpy();
    normalizeConfig({ ...base, entity: "input_date.fest", mode: "timer" });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("scale.labels_placement", () => {
  it("defaults to inside", () => {
    expect(scaleOf({ labels: true }).labelsPlacement).toBe("inside");
    expect(scaleOf(true).labelsPlacement).toBe("inside");
  });

  it("accepts outside together with labels, without a warning", () => {
    const warn = warnSpy();
    const scale = scaleOf({ labels: true, labels_placement: "outside" });
    expect(scale.labelsPlacement).toBe("outside");
    expect(scale.labels).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns about an invalid value and falls back to inside", () => {
    const warn = warnSpy();
    expect(scaleOf({ labels: true, labels_placement: "sideways" }).labelsPlacement).toBe("inside");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("scale.labels_placement");
  });

  it("warns and stays inside when outside has no labels to place", () => {
    const warn = warnSpy();
    expect(scaleOf({ labels_placement: "outside" }).labelsPlacement).toBe("inside");
    expect(scaleOf({ labels: false, labels_placement: "outside" }).labelsPlacement).toBe("inside");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("drops the minimum bar thickness for labels outside", () => {
    warnSpy();
    expect(scaleOf({ labels: true }, { thickness: 14 }).labels).toBeNull();
    const outside = scaleOf({ labels: true, labels_placement: "outside" }, { thickness: 14 });
    expect(outside.labels).toHaveLength(2);
    expect(outside.labelsPlacement).toBe("outside");
  });

  it("is not a reason for an unknown-option warning", () => {
    const warn = warnSpy();
    scaleOf({ labels: true, labels_placement: "outside" });
    expect(warn.mock.calls.flat().join(" ")).not.toContain("not a known option");
  });
});

describe("scale.ticks_placement", () => {
  it("defaults to inside", () => {
    expect(scaleOf(true).ticksPlacement).toBe("inside");
    expect(scaleOf({ ticks: 4 }).ticksPlacement).toBe("inside");
  });

  it("accepts outside without a warning, with and without labels", () => {
    const warn = warnSpy();
    expect(scaleOf({ ticks_placement: "outside" }).ticksPlacement).toBe("outside");
    const both = scaleOf({ labels: true, ticks_placement: "outside", labels_placement: "outside" });
    expect(both.ticksPlacement).toBe("outside");
    expect(both.labelsPlacement).toBe("outside");
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the two placements independent", () => {
    warnSpy();
    const ticksOnly = scaleOf({ labels: true, ticks_placement: "outside" });
    expect(ticksOnly.ticksPlacement).toBe("outside");
    expect(ticksOnly.labelsPlacement).toBe("inside");
    const labelsOnly = scaleOf({ labels: true, labels_placement: "outside" });
    expect(labelsOnly.ticksPlacement).toBe("inside");
    expect(labelsOnly.labelsPlacement).toBe("outside");
  });

  it("warns about an invalid value and falls back to inside", () => {
    const warn = warnSpy();
    expect(scaleOf({ ticks_placement: "sideways" }).ticksPlacement).toBe("inside");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("scale.ticks_placement");
  });

  it("is not a reason for an unknown-option warning", () => {
    const warn = warnSpy();
    scaleOf({ ticks_placement: "outside" });
    expect(warn.mock.calls.flat().join(" ")).not.toContain("not a known option");
  });

  it("accepts none together with labels, without a warning", () => {
    const warn = warnSpy();
    const scale = scaleOf({ labels: true, ticks_placement: "none" });
    expect(scale.ticksPlacement).toBe("none");
    expect(scale.labels).toHaveLength(2);
    expect(scale.ticks).toBe(10);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and stays inside when none has no labels to show", () => {
    const warn = warnSpy();
    expect(scaleOf({ ticks_placement: "none" }).ticksPlacement).toBe("inside");
    expect(scaleOf({ labels: false, ticks_placement: "none" }).ticksPlacement).toBe("inside");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain("scale.ticks_placement");
  });

  it("gives one warning only when the labels were requested but rejected", () => {
    const warn = warnSpy();
    expect(scaleOf({ labels: true, ticks_placement: "none" }, { thickness: 14 }).ticksPlacement).toBe("inside");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("scale.labels");
  });

  it("keeps none for labels outside on a thin bar", () => {
    const warn = warnSpy();
    const scale = scaleOf({ labels: true, ticks_placement: "none", labels_placement: "outside" }, { thickness: 14 });
    expect(scale.ticksPlacement).toBe("none");
    expect(scale.labelsPlacement).toBe("outside");
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the minimum bar thickness for labels inside next to ticks outside", () => {
    warnSpy();
    expect(scaleOf({ labels: true, ticks_placement: "outside" }, { thickness: 14 }).labels).toBeNull();
  });
});

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

describe("allow_unavailable_actions", () => {
  const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("defaults to false", () => {
    expect(normalizeConfig(base).allow_unavailable_actions).toBe(false);
  });

  it("keeps true in state mode without a warning", () => {
    const warn = warnSpy();
    expect(normalizeConfig({ ...base, allow_unavailable_actions: true }).allow_unavailable_actions).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("is false and warns for true in every other mode", () => {
    for (const entity of ["lock.a", "sensor.a", "counter.a", "timer.a"]) {
      const warn = warnSpy();
      expect(normalizeConfig({ entity, allow_unavailable_actions: true }).allow_unavailable_actions, entity).toBe(false);
      expect(warn, entity).toHaveBeenCalledWith(expect.stringMatching(/allow_unavailable_actions has no effect in mode/));
      warn.mockRestore();
    }
    const warn = warnSpy();
    expect(normalizeConfig({ mode: "clock", allow_unavailable_actions: true }).allow_unavailable_actions).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns about a non-boolean value and falls back to false", () => {
    for (const value of ["yes", 1]) {
      const warn = warnSpy();
      expect(normalizeConfig({ ...base, allow_unavailable_actions: value }).allow_unavailable_actions).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/allow_unavailable_actions must be true or false/));
      warn.mockRestore();
    }
  });

  it("does not mutate the input", () => {
    const raw = { ...base, allow_unavailable_actions: "yes" };
    warnSpy();
    normalizeConfig(raw);
    expect(raw.allow_unavailable_actions).toBe("yes");
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

describe("bar.attribute", () => {
  it("reads the attribute and lets the bar measure the main entity", () => {
    const c = normalizeConfig({ entity: "climate.room", bar: { attribute: "current_temperature" } });
    expect(c).toMatchObject({ bar_attribute: "current_temperature", bar_entity: "climate.room" });
    expect(c.bar_own_attribute).toBe(true);
  });

  it("keeps a separate bar entity", () => {
    const c = normalizeConfig({ entity: "switch.a", bar: { entity: "cover.b", attribute: "current_position" } });
    expect(c).toMatchObject({ bar_attribute: "current_position", bar_entity: "cover.b" });
  });

  it("defaults to no attribute", () => {
    expect(normalizeConfig({ entity: "sensor.t" }).bar_attribute).toBeNull();
    expect(normalizeConfig({ entity: "sensor.t", bar: { attribute: "" } }).bar_attribute).toBeNull();
  });

  it("ignores an unusable attribute name with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const attribute of ["a b", "x.y", 5, "a".repeat(65)]) {
      const c = normalizeConfig({ entity: "sensor.t", bar: { attribute } });
      expect(c).toMatchObject({ bar_attribute: null, bar_entity: null });
    }
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls[0][0]).toMatch(/bar\.attribute/);
  });

  it("is not accepted as a flat option", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ entity: "sensor.t", attribute: "x" }).bar_attribute).toBeNull();
  });

  it("needs an entity (clock mode without entity ignores it)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ mode: "clock", bar: { attribute: "x" } });
    expect(c.bar_attribute).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("works next to the lock, timer, counter and clock modes", () => {
    for (const [entity, mode] of [["lock.door", "lock"], ["timer.t", "timer"], ["counter.c", "counter"]]) {
      const c = normalizeConfig({ entity, mode, bar: { attribute: "level" } });
      expect(c).toMatchObject({ mode, bar_attribute: "level", bar_entity: entity });
    }
    const clock = normalizeConfig({ mode: "clock", bar: { entity: "cover.b", attribute: "current_position" } });
    expect(clock).toMatchObject({ bar_attribute: "current_position", bar_entity: "cover.b", entity: null });
  });

  it("marks scale labels that follow the entity range as runtime bound", () => {
    const c = normalizeConfig({ entity: "climate.room", bar: { attribute: "current_temperature" }, scale: { labels: true } });
    expect(c.scale.labels.some((label) => label.bound)).toBe(true);
    const fixed = normalizeConfig({ entity: "climate.room", bar: { attribute: "current_temperature", min: 10, max: 30 }, scale: { labels: true } });
    expect(fixed.scale.labels.some((label) => label.bound)).toBe(false);
  });
});

describe("value mode: step and drag", () => {
  it("has no step by default and accepts a positive number", () => {
    expect(normalizeConfig({ entity: "input_number.v" }).step).toBeNull();
    expect(normalizeConfig({ entity: "input_number.v", step: 5 }).step).toBe(5);
    expect(normalizeConfig({ entity: "input_number.v", step: "0.5" }).step).toBe(0.5);
  });

  it("reads the step from bar: as an alias", () => {
    expect(normalizeConfig({ entity: "input_number.v", bar: { step: 2 } }).step).toBe(2);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ entity: "input_number.v", step: 1, bar: { step: 2 } }).step).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/bar\.step/));
  });

  it.each([[0], [-1], ["abc"]])("ignores the step %j with a warning", (value) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ entity: "input_number.v", step: value }).step).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/step/));
  });

  it("does not warn about an empty step", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ entity: "input_number.v", step: "" }).step).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("allows dragging for input_number and number, not for sensors", () => {
    expect(normalizeConfig({ entity: "input_number.v" }).drag).toBe(true);
    expect(normalizeConfig({ entity: "number.v" }).drag).toBe(true);
    expect(normalizeConfig({ entity: "sensor.t" }).drag).toBe(false);
    expect(normalizeConfig({ entity: "sensor.t", drag: true }).drag).toBe(false);
    expect(normalizeConfig({ entity: "counter.c", mode: "value" }).drag).toBe(false);
  });

  it("switches dragging off with drag: false", () => {
    expect(normalizeConfig({ entity: "input_number.v", drag: false }).drag).toBe(false);
  });

  it("leaves drag alone in the other modes", () => {
    expect(normalizeConfig({ entity: "sensor.t", mode: "state" }).drag).toBe(true);
    expect(normalizeConfig({ entity: "lock.a" }).drag).toBe(true);
  });

  it("still shows text in the handle for value mode", () => {
    expect(normalizeConfig({ entity: "input_number.v" }).handle_content).toBe("text");
  });
});

describe("step minimum", () => {
  it("ignores a step below 1e-9 with a warning and accepts the limit and small steps above it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ entity: "input_number.v", step: 1e-101 }).step).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/step must be a number of at least/));
    expect(normalizeConfig({ entity: "input_number.v", step: 1e-9 }).step).toBe(1e-9);
    expect(normalizeConfig({ entity: "input_number.v", step: 1e-7 }).step).toBe(1e-7);
  });
});

describe("styles values", () => {
  it("accepts finite numbers and drops NaN and Infinity with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, styles: { "scale-size": 12, "bar-opacity": Infinity, "x-nan": NaN } });
    expect(c.styles).toEqual({ "--slabton-scale-size": "12" });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("checks the keys that override scale options like every other value", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({
      ...base,
      styles: { "scale-color": "red;}", "--slabton-scale-size": "url(x)", "scale-label-color": "red" },
    });
    expect(c.styles).toEqual({ "--slabton-scale-label-color": "red" });
  });
});

describe("scale labels with a bar entity", () => {
  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  const labelsOf = (config) => normalizeConfig({ ...config, scale: { labels: true } }).scale.labels;

  it("follow the range of the bar entity at runtime when it is settable and not fully configured", () => {
    const warn = quiet();
    expect(labelsOf({ entity: "sensor.x", bar: { entity: "input_number.y" } })).toEqual([
      { index: 0, text: "0.0", bound: "min" },
      { index: 10, text: "100.0", bound: "max" },
    ]);
    expect(labelsOf({ entity: "sensor.x", min: 5, bar: { entity: "number.y" } }).map((l) => l.bound)).toEqual(["min", "max"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keep fixed labels for a non-settable bar entity, even when the main entity is settable", () => {
    const warn = quiet();
    expect(labelsOf({ entity: "input_number.x", bar: { entity: "sensor.y" } })).toEqual([
      { index: 0, text: "0.0" },
      { index: 10, text: "100.0" },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keep fixed labels when min and max are both configured", () => {
    expect(labelsOf({ entity: "sensor.x", min: 0, max: 50, decimals: 0, bar: { entity: "input_number.y" } })).toEqual([
      { index: 0, text: "0" },
      { index: 10, text: "50" },
    ]);
  });

  it("apply to the counter mode too, with the decimals of the bar", () => {
    const warn = quiet();
    expect(labelsOf({ entity: "counter.c", min: 0, max: 20, decimals: 0, bar: { entity: "sensor.y" } })).toEqual([
      { index: 0, text: "0" },
      { index: 10, text: "20" },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("do not change without a bar entity", () => {
    quiet();
    expect(labelsOf({ entity: "input_number.v" })).toBeNull();
    expect(labelsOf({ entity: "sensor.t", min: 0, max: 10, decimals: 0 })).toEqual([
      { index: 0, text: "0" },
      { index: 10, text: "10" },
    ]);
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
      pulse: true, pulse_seconds: 10, info: null, time_zone: null, span: 30, start_action: null, end_action: null,
    });
    const c = normalizeConfig({
      entity: "input_datetime.t",
      mode: "timer",
      timer: { pulse: false, pulse_seconds: 0, info: "Ende {target}", time_zone: "Europe/Berlin", span: 7 },
    });
    expect(c.timer).toEqual({ pulse: false, pulse_seconds: 0, info: "Ende {target}", time_zone: "Europe/Berlin", span: 7, start_action: null, end_action: null });
  });

  it("rejects unknown time zones", () => {
    expect(() => normalizeConfig({ entity: "timer.a", timer: { time_zone: "Mars/Olympus" } })).toThrow(/timer\.time_zone/);
    expect(() => normalizeConfig({ mode: "clock", clock: { time_zone: "nope" } })).toThrow(/clock\.time_zone/);
  });

  it("normalizes the clock block with the digital display as default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ mode: "clock" }).clock).toEqual({
      display: "digital", face: { numbers: "none", ticks: true }, time_zone: null, hour_format: "auto", seconds: false,
    });
    expect(normalizeConfig({ entity: "sensor.t" }).clock.face).toEqual({ numbers: "none", ticks: true });
    expect(warn).not.toHaveBeenCalled();
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
    const c = normalizeConfig({ ...base, thresholds: [], shape: "circle", control: "select" });
    expect(RESERVED_KEYS).toEqual(["thresholds", "shape", "control"]);
    expect(warn).toHaveBeenCalledTimes(3);
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

describe("scale block", () => {
  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  const scaleOf = (extra, scale) => normalizeConfig({ ...base, ...extra, scale }).scale;

  it("is off without scale: and with scale: false", () => {
    const warn = quiet();
    expect(normalizeConfig(base).scale).toBeNull();
    expect(scaleOf({}, false)).toBeNull();
    expect(scaleOf({}, null)).toBeNull();
    expect(scaleOf({}, "")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("is no longer reserved", () => {
    const warn = quiet();
    expect(scaleOf({}, true)).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses defaults for scale: true and an empty map", () => {
    const expected = { ticks: 10, position: "end", size: null, color: null, labels: null, labelsPlacement: "inside", ticksPlacement: "inside" };
    expect(scaleOf({}, true)).toEqual(expected);
    expect(scaleOf({}, {})).toEqual(expected);
  });

  it("keeps valid values", () => {
    expect(scaleOf({}, { ticks: 4, position: "center", size: 6, color: "#888" })).toEqual({
      ticks: 4, position: "center", size: 6, color: "#888", labels: null, labelsPlacement: "inside", ticksPlacement: "inside",
    });
    expect(scaleOf({}, { ticks: "20", size: "5" })).toMatchObject({ ticks: 20, size: 5 });
  });

  it("does not mutate the input", () => {
    const raw = { ...base, scale: { ticks: 4 } };
    normalizeConfig(raw);
    expect(raw.scale).toEqual({ ticks: 4 });
  });

  it("counts hours in clock mode: 24 by default, 12 for hour_format 12", () => {
    expect(normalizeConfig({ mode: "clock", scale: true }).scale.ticks).toBe(24);
    expect(normalizeConfig({ mode: "clock", scale: {}, clock: { hour_format: "24" } }).scale.ticks).toBe(24);
    expect(normalizeConfig({ mode: "clock", scale: true, clock: { hour_format: "12" } }).scale.ticks).toBe(12);
    expect(normalizeConfig({ mode: "clock", scale: true, clock: { hour_format: 12 } }).scale.ticks).toBe(12);
  });

  it("lets an explicit ticks win over the clock rule and adds no scale to a clock without scale:", () => {
    expect(normalizeConfig({ mode: "clock", scale: { ticks: 6 }, clock: { hour_format: "12" } }).scale.ticks).toBe(6);
    expect(normalizeConfig({ mode: "clock" }).scale).toBeNull();
  });

  it("uses 10 segments in every other mode", () => {
    for (const entity of ["sensor.t", "lock.a", "counter.a", "timer.a"]) {
      expect(normalizeConfig({ entity, scale: true }).scale.ticks).toBe(10);
    }
  });

  it.each([
    ["end", "horizontal", "end"],
    ["start", "horizontal", "start"],
    ["center", "horizontal", "center"],
    ["top", "horizontal", "start"],
    ["bottom", "horizontal", "end"],
    ["start", "vertical", "start"],
    ["end", "vertical", "end"],
    ["center", "vertical", "center"],
    ["left", "vertical", "start"],
    ["right", "vertical", "end"],
  ])("maps position %s on a %s bar to %s", (position, orientation, expected) => {
    expect(scaleOf({ orientation }, { position }).position).toBe(expected);
  });

  it.each([
    ["top", "vertical"], ["bottom", "vertical"], ["left", "horizontal"], ["right", "horizontal"],
    ["middle", "horizontal"], ["constructor", "horizontal"], ["__proto__", "vertical"], [5, "horizontal"],
  ])("warns about position %j on a %s bar and uses the default", (position, orientation) => {
    const warn = quiet();
    expect(scaleOf({ orientation }, { position }).position).toBe("end");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.position/));
  });

  it("does not warn about an empty position, ticks, size or color", () => {
    const warn = quiet();
    expect(scaleOf({}, { position: "", ticks: "", size: null, color: "", labels: "" })).toEqual({
      ticks: 10, position: "end", size: null, color: null, labels: null, labelsPlacement: "inside", ticksPlacement: "inside",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([[0], [101], [2.5], [-1], ["abc"], ["1e1"], [true], [{}]])("warns about ticks %j and uses the default", (value) => {
    const warn = quiet();
    expect(scaleOf({}, { ticks: value }).ticks).toBe(10);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.ticks/));
  });

  it("accepts the limits 1 and 100 for ticks", () => {
    expect(scaleOf({}, { ticks: 1 }).ticks).toBe(1);
    expect(scaleOf({}, { ticks: 100 }).ticks).toBe(100);
  });

  it("falls back to the default ticks of the clock after an invalid value", () => {
    quiet();
    expect(normalizeConfig({ mode: "clock", scale: { ticks: 0 }, clock: { hour_format: "12" } }).scale.ticks).toBe(12);
  });

  it.each([[1], [0], ["abc"], [-4], [{}]])("warns about size %j and leaves it unset", (value) => {
    const warn = quiet();
    expect(scaleOf({}, { size: value }).size).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.size/));
  });

  it("limits the size to the bar thickness", () => {
    const warn = quiet();
    expect(scaleOf({ thickness: 20 }, { size: 20 }).size).toBe(20);
    expect(scaleOf({ thickness: 20 }, { size: 21 }).size).toBeNull();
    expect(scaleOf({}, { size: 2 }).size).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([["red;}"], ["url(http://x)"], ["javascript:alert(1)"], [12]])("warns about unsafe color %j", (value) => {
    const warn = quiet();
    expect(scaleOf({}, { color: value }).color).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.color/));
  });

  it("accepts theme variables as color", () => {
    expect(scaleOf({}, { color: "var(--divider-color)" }).color).toBe("var(--divider-color)");
  });

  it("rejects anything but a boolean or a map", () => {
    for (const value of ["yes", 3, [], [1]]) {
      expect(() => scaleOf({}, value)).toThrow(/scale must be/);
    }
  });

  it("warns about unknown options and ignores them", () => {
    const warn = quiet();
    const scale = scaleOf({}, { ticks: 5, glow: true });
    expect(scale).toEqual({ ticks: 5, position: "end", size: null, color: null, labels: null, labelsPlacement: "inside", ticksPlacement: "inside" });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.glow/));
  });
});

describe("scale labels", () => {
  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  const labelsOf = (config, scale = { labels: true }) => normalizeConfig({ ...config, scale }).scale.labels;
  const texts = (labels) => labels.map((l) => `${l.index}:${l.text}`);

  it("are off by default and with labels: false", () => {
    const warn = quiet();
    expect(labelsOf({ entity: "sensor.t" }, true)).toBeNull();
    expect(labelsOf({ entity: "sensor.t" }, { labels: false })).toBeNull();
    expect(labelsOf({ mode: "clock" }, { ticks: 6 })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("label every sixth hour on a 24 h clock scale", () => {
    expect(texts(labelsOf({ mode: "clock" }))).toEqual(["0:0", "6:6", "12:12", "18:18", "24:24"]);
    expect(texts(labelsOf({ mode: "clock", clock: { hour_format: "24" } }))).toEqual(["0:0", "6:6", "12:12", "18:18", "24:24"]);
  });

  it("label the hours of the 24 h day on a 12 h clock scale too (12 ticks, two hours apart)", () => {
    expect(texts(labelsOf({ mode: "clock", clock: { hour_format: "12" } }))).toEqual(["0:0", "3:6", "6:12", "9:18", "12:24"]);
  });

  it("follow an explicit tick count on a clock scale", () => {
    expect(texts(labelsOf({ mode: "clock" }, { ticks: 4, labels: true }))).toEqual(["0:0", "1:6", "2:12", "3:18", "4:24"]);
    expect(texts(labelsOf({ mode: "clock" }, { ticks: 8, labels: true }))).toEqual(["0:0", "2:6", "4:12", "6:18", "8:24"]);
  });

  it("show the range limits in value mode with the decimals, without unit", () => {
    expect(texts(labelsOf({ entity: "sensor.t", preset: "thermometer" }))).toEqual(["0:-10.0", "10:40.0"]);
    expect(texts(labelsOf({ entity: "sensor.t", min: 0, max: 5000, unit: "W", decimals: 0 }, { ticks: 4, labels: true }))).toEqual(["0:0", "4:5000"]);
  });

  it("show the limits of a settable entity only when min and max are configured", () => {
    const warn = quiet();
    expect(texts(labelsOf({ entity: "input_number.v", min: 5, max: 25, decimals: 0 }))).toEqual(["0:5", "10:25"]);
    expect(labelsOf({ entity: "input_number.v" })).toBeNull();
    expect(labelsOf({ entity: "number.v", min: 5 })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels needs a fixed range/));
  });

  it("show the limits of a counter from counter: or min/max, else warn", () => {
    const warn = quiet();
    expect(texts(labelsOf({ entity: "counter.c", counter: { min: 0, max: 10 } }))).toEqual(["0:0", "10:10"]);
    expect(texts(labelsOf({ entity: "counter.c", min: 1, max: 9 }))).toEqual(["0:1", "10:9"]);
    expect(texts(labelsOf({ entity: "counter.c", min: 1, counter: { max: 7 } }))).toEqual(["0:1", "10:7"]);
    expect(labelsOf({ entity: "counter.c" })).toBeNull();
    expect(labelsOf({ entity: "counter.c", counter: { min: 0 } })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("name the configured states at the handle position of each state", () => {
    const warn = quiet();
    const states = [{ value: "Off" }, { value: "Auto", label: "Automatik" }, { value: "On" }, { value: "Idle" }];
    const config = { entity: "input_select.s", mode: "state", states };
    // 4 states on the default 10 ticks: the labels lie between ticks, exactly where the handle stops.
    expect(texts(labelsOf(config))).toEqual(["0:Off", "3.3333333333333335:Automatik", "6.666666666666667:On", "10:Idle"]);
    expect(texts(labelsOf(config, { ticks: 3, labels: true }))).toEqual(["0:Off", "1:Automatik", "2:On", "3:Idle"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("need at least two configured states in mode state: warn and ignore", () => {
    const warn = quiet();
    expect(labelsOf({ entity: "input_select.s", mode: "state" })).toBeNull();
    expect(labelsOf({ entity: "input_select.s", mode: "state", states: [{ value: "a" }] })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels needs at least two configured states/));
  });

  it.each([["lock.a"], ["timer.a"]])("are not available for %s: warn and ignore", (entity) => {
    const warn = quiet();
    expect(labelsOf({ entity })).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels is not available in mode/));
  });

  it("report the mode before the thickness: a mode without labels never gets the thickness warning", () => {
    const warn = quiet();
    expect(labelsOf({ entity: "lock.a", thickness: 20 })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels is not available in mode "lock"/));
  });

  it("need a bar thickness of at least 28 px", () => {
    const warn = quiet();
    expect(labelsOf({ mode: "clock", thickness: 28 })).not.toBeNull();
    expect(labelsOf({ mode: "clock", thickness: 27 })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels needs a bar thickness of at least 28 \(is 27\)/));
  });

  it("warn about a value that is not a boolean", () => {
    const warn = quiet();
    expect(labelsOf({ mode: "clock" }, { labels: "yes" })).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels must be true or false/));
  });
});

describe("analog clock", () => {
  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  const clockOf = (extra = {}, clock = {}) => normalizeConfig({ mode: "clock", ...extra, clock: { display: "analog", ...clock } }).clock;

  it("is accepted with the dial defaults", () => {
    const warn = quiet();
    expect(clockOf({}, { hour_format: 12, seconds: true, time_zone: "UTC" })).toEqual({
      display: "analog", face: { numbers: "none", ticks: true }, time_zone: "UTC", hour_format: "12", seconds: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the face options", () => {
    quiet();
    expect(clockOf({ handle_size: 80 }, { face: { numbers: "all", ticks: false } }).face).toEqual({ numbers: "all", ticks: false });
    expect(clockOf({ handle_size: 48 }, { face: { numbers: "quarters" } }).face).toEqual({ numbers: "quarters", ticks: true });
  });

  it("accepts the minimum handle size and falls back to digital below it, with a warning", () => {
    const warn = quiet();
    expect(clockOf({ handle_size: 32 }).display).toBe("analog");
    expect(warn).not.toHaveBeenCalled();
    expect(clockOf({ handle_size: 31 }).display).toBe("digital");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/analog.*handle_size 31 is below the minimum of 32.*digital/));
  });

  it("falls back to digital when the handle does not show text", () => {
    const warn = quiet();
    for (const handle_content of ["icon", "position", "none"]) {
      expect(clockOf({ handle_content }).display).toBe("digital");
    }
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/handle_content is "icon"/));
  });

  it("resets the face to the defaults after a fallback", () => {
    quiet();
    expect(clockOf({ handle_size: 20 }, { face: { numbers: "all", ticks: false } }).face).toEqual({ numbers: "none", ticks: true });
  });

  it("steps the numbers down for a small handle, one warning per step", () => {
    const warn = quiet();
    expect(clockOf({ handle_size: 72 }, { face: { numbers: "all" } }).face.numbers).toBe("all");
    expect(warn).not.toHaveBeenCalled();
    expect(clockOf({ handle_size: 71 }, { face: { numbers: "all" } }).face.numbers).toBe("quarters");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockClear();
    expect(clockOf({ handle_size: 47 }, { face: { numbers: "all" } }).face.numbers).toBe("none");
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockClear();
    expect(clockOf({ handle_size: 47 }, { face: { numbers: "quarters" } }).face.numbers).toBe("none");
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/clock\.face\.numbers "quarters" needs a handle_size of at least 48/));
  });

  it("rejects an unknown numbers level and a face that is not a map", () => {
    expect(() => clockOf({}, { face: { numbers: "some" } })).toThrow(/clock\.face\.numbers "some".*none, quarters, all/);
    expect(() => clockOf({}, { face: "all" })).toThrow(/clock\.face must be a map/);
  });

  it("warns when face.ticks is not a boolean and keeps the default", () => {
    const warn = quiet();
    expect(clockOf({}, { face: { ticks: "false" } }).face.ticks).toBe(true);
    expect(clockOf({}, { face: { ticks: 0 } }).face.ticks).toBe(true);
    expect(clockOf({}, { face: { ticks: false } }).face.ticks).toBe(false);
    expect(clockOf({}, { face: { ticks: true } }).face.ticks).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/clock\.face\.ticks must be true or false/));
  });

  it("warns about unknown face options and ignores them", () => {
    const warn = quiet();
    expect(clockOf({}, { face: { glow: true } }).face).toEqual({ numbers: "none", ticks: true });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/clock\.face\.glow/));
  });

  it("warns about a face on a digital clock and ignores it", () => {
    const warn = quiet();
    const c = normalizeConfig({ mode: "clock", clock: { face: { numbers: "all" } } }).clock;
    expect(c.display).toBe("digital");
    expect(c.face).toEqual({ numbers: "none", ticks: true });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/clock\.face is only used with clock\.display "analog"/));
  });

  it("does not mutate the shared defaults", () => {
    const first = normalizeConfig({ entity: "sensor.t" }).clock;
    first.face.numbers = "all";
    expect(normalizeConfig({ entity: "sensor.t" }).clock.face.numbers).toBe("none");
  });
});

describe("text block", () => {
  const empty = {
    header: { font_size: null, color: null, font_weight: null, icon_color: null },
    bar: { font_size: null, color: null },
    info: { font_size: null, color: null },
    button: { font_size: null, color: null },
    scale: { font_size: null, color: null },
  };

  it("defaults every value to null without text:", () => {
    expect(normalizeConfig(base).text).toEqual(empty);
    expect(normalizeConfig({ ...base, text: {} }).text).toEqual(empty);
  });

  it("keeps valid values per area", () => {
    const c = normalizeConfig({
      ...base,
      text: {
        header: { font_size: 16, color: "#ff9800", font_weight: 700, icon_color: "#2196f3" },
        bar: { font_size: "12", color: "var(--secondary-text-color)" },
        info: { font_size: 11, color: "grey" },
        button: { font_size: 18, color: "white" },
        scale: { font_size: 9, color: "#888" },
      },
    });
    expect(c.text).toEqual({
      header: { font_size: 16, color: "#ff9800", font_weight: "700", icon_color: "#2196f3" },
      bar: { font_size: 12, color: "var(--secondary-text-color)" },
      info: { font_size: 11, color: "grey" },
      button: { font_size: 18, color: "white" },
      scale: { font_size: 9, color: "#888" },
    });
  });

  it("does not mutate the input", () => {
    const raw = { ...base, text: { header: { font_size: 16 } } };
    normalizeConfig(raw);
    expect(raw.text).toEqual({ header: { font_size: 16 } });
  });

  it("treats cleared values as not set without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, text: { header: { font_size: "", color: null }, bar: null } });
    expect(c.text).toEqual(empty);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects text and areas that are not maps", () => {
    expect(() => normalizeConfig({ ...base, text: "big" })).toThrow(/text must be a map/);
    expect(() => normalizeConfig({ ...base, text: [] })).toThrow(/text must be a map/);
    expect(() => normalizeConfig({ ...base, text: { header: 16 } })).toThrow(/text\.header must be a map/);
  });

  it("warns about unknown areas and keys and ignores them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, text: { footer: { color: "red" }, bar: { weight: 700, color: "red" } } });
    expect(c.text.footer).toBeUndefined();
    expect(c.text.bar).toEqual({ font_size: null, color: "red" });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.footer/));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.bar\.weight/));
  });

  it("rejects icon_color outside the header", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, text: { bar: { icon_color: "red" } } });
    expect(c.text.bar).toEqual({ font_size: null, color: null });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.bar\.icon_color/));
  });

  it.each([["abc"], [0], [-3], [7], [49], [NaN], [{}], [true], ["0x10"], ["1e1"], ["-12"], ["12px"]])("ignores font_size %j with a warning", (value) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = normalizeConfig({ ...base, text: { header: { font_size: value, color: "red" } } });
    expect(c.text.header).toEqual({ font_size: null, color: "red", font_weight: null, icon_color: null });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.header\.font_size/));
  });

  it.each([[700, "700"], ["600", "600"], [" 700 ", "700"], [1, "1"], [1000, "1000"], ["bold", "bold"], ["Bolder", "Bolder"], ["var(--font-weight-l)", "var(--font-weight-l)"], ["var(--w, 700)", "var(--w, 700)"]])(
    "keeps font_weight %j as CSS text",
    (value, css) => {
      expect(normalizeConfig({ ...base, text: { header: { font_weight: value } } }).text.header.font_weight).toBe(css);
    },
  );

  it.each([[0], [1001], [-5], [0.5], ["heavy"], ["0x10"], ["700px"], ["bold 700"], ["inherit"], ["calc(1 + 1)"], ["var(--w;)"], ["abc;"], ["url(http://x)"], [{}], [true]])("ignores font_weight %j with a warning", (value) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ ...base, text: { header: { font_weight: value } } }).text.header.font_weight).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.header\.font_weight/));
  });

  it("rejects font_weight outside the header", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig({ ...base, text: { bar: { font_weight: 700 } } }).text.bar).toEqual({ font_size: null, color: null });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.bar\.font_weight/));
  });

  it("accepts the limits 8 and 48", () => {
    const c = normalizeConfig({ ...base, text: { info: { font_size: 8 }, button: { font_size: 48 } } });
    expect(c.text.info.font_size).toBe(8);
    expect(c.text.button.font_size).toBe(48);
  });

  it.each([["red;}"], ["url(http://x)"], ["javascript:alert(1)"], ["red\"x"], [12]])(
    "ignores unsafe color %j with a warning",
    (value) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const c = normalizeConfig({ ...base, text: { header: { color: value, icon_color: value, font_size: 20 } } });
      expect(c.text.header).toEqual({ font_size: 20, color: null, font_weight: null, icon_color: null });
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.header\.color/));
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/text\.header\.icon_color/));
    },
  );
});

describe("bar_state_color", () => {
  it("defaults to false", () => {
    expect(normalizeConfig(base).bar_state_color).toBe(false);
  });

  it("is on only for the boolean true", () => {
    expect(normalizeConfig({ ...base, bar_state_color: true }).bar_state_color).toBe(true);
    for (const value of [false, "true", 1, null, "yes"]) {
      expect(normalizeConfig({ ...base, bar_state_color: value }).bar_state_color).toBe(false);
    }
  });

  it("raises no warning in value mode", () => {
    const warn = warnSpy();
    expect(normalizeConfig({ ...valueBase, bar_state_color: true }).bar_state_color).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("switch states and handle zones", () => {
  it("normalizes switch states (value, icon, color, label)", () => {
    const c = normalizeConfig({
      ...base,
      switches: { start: { entity: "sensor.m", states: [{ value: "auto", icon: "mdi:robot", color: "green", label: "Auto" }, "off"] } },
    });
    expect(c.switches.start.states).toEqual([
      { value: "auto", label: "Auto", icon: "mdi:robot", text: null, color: "green" },
      { value: "off", label: null, icon: null, text: null, color: null },
    ]);
  });

  it("defaults switch states to an empty list and rejects an entry without value", () => {
    expect(normalizeConfig({ ...base, switches: { end: {} } }).switches.end.states).toEqual([]);
    expect(() => normalizeConfig({ ...base, switches: { end: { states: [{ icon: "mdi:x" }] } } })).toThrow(/needs a "value"/);
  });

  it("normalizes handle zones with actions, entity and states", () => {
    const c = normalizeConfig({
      ...base,
      handle_zones: { end: { entity: "sensor.m", icon: "mdi:cog", states: ["auto"], hold_action: { action: "toggle" } } },
    });
    expect(c.handle_zones.end.entity).toBe("sensor.m");
    expect(c.handle_zones.end.hold_action).toEqual({ action: "toggle" });
    expect(c.handle_zones.start).toBeUndefined();
  });

  it("keeps old configs unchanged and rejects bad handle zones", () => {
    expect(normalizeConfig(base).handle_zones).toEqual({});
    expect(() => normalizeConfig({ ...base, handle_zones: [] })).toThrow(/handle_zones must be a map/);
    expect(() => normalizeConfig({ ...base, handle_zones: { mid: "x" } })).toThrow(/handle_zones.mid/);
    expect(() => normalizeConfig({ ...base, handle_zones: { mid: { entity: "bad" } } })).toThrow(/handle_zones.mid.entity/);
  });
});

describe("state colors", () => {
  it("drops an unsafe color in switch states and handle zones", () => {
    const c = normalizeConfig({
      ...base,
      switches: { end: { states: [{ value: "a", color: "red;" }] } },
      handle_zones: { end: { states: [{ value: "a", color: "url(x)" }] } },
    });
    expect(c.switches.end.states[0].color).toBeNull();
    expect(c.handle_zones.end.states[0].color).toBeNull();
  });
});

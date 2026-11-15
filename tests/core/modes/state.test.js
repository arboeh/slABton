import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { cycleAction, defaultActions, isDraggable, onRelease, resolveStates, selectAction, view } from "../../../src/core/modes/state.js";
import { unavailableReason } from "../../../src/core/util.js";
import { makeState } from "../../helpers/mock-hass.js";

const select = (extra = {}) => normalizeConfig({ entity: "input_select.mode", ...extra });
const modeState = makeState("input_select.mode", "auto", { options: ["off", "auto", "on", "idle"] });

describe("resolveStates", () => {
  it("uses configured states first", () => {
    expect(resolveStates(select({ states: ["a", "b"] }), modeState).map((s) => s.value)).toEqual(["a", "b"]);
  });

  it("derives options, hvac modes and on/off", () => {
    expect(resolveStates(select(), modeState).map((s) => s.value)).toEqual(["off", "auto", "on", "idle"]);
    const climate = normalizeConfig({ entity: "climate.room" });
    expect(resolveStates(climate, makeState("climate.room", "heat", { hvac_modes: ["off", "heat"] })).map((s) => s.value)).toEqual(["off", "heat"]);
    const sw = normalizeConfig({ entity: "switch.a" });
    expect(resolveStates(sw, makeState("switch.a", "on")).map((s) => s.value)).toEqual(["off", "on"]);
  });
});

describe("resolveStates without the entity's list", () => {
  it("returns no states for select, input_select and climate", () => {
    const gone = (entity) => resolveStates(normalizeConfig({ entity }), makeState(entity, "unavailable"));
    expect(gone("select.a")).toEqual([]);
    expect(gone("input_select.a")).toEqual([]);
    expect(gone("climate.a")).toEqual([]);
    expect(resolveStates(select(), undefined)).toEqual([]);
  });

  it("sends nothing and cannot be dragged without a state list", () => {
    const config = select();
    const stateObj = makeState("input_select.mode", "unavailable");
    expect(cycleAction(config, stateObj, 1)).toBeNull();
    expect(onRelease({ frac: 1, config, stateObj })).toBeNull();
    expect(isDraggable(config, stateObj)).toBe(false);
  });

  it("still derives the list while unavailable when the entity keeps its options", () => {
    const stateObj = makeState("input_select.mode", "unavailable", modeState.attributes);
    expect(resolveStates(select(), stateObj)).toHaveLength(4);
  });

  it("cycles configured states and toggle domains from an unavailable entity", () => {
    const config = select({ states: ["a", "b"] });
    expect(cycleAction(config, makeState("input_select.mode", "unavailable"), 1).value).toBe("a");
    const sw = normalizeConfig({ entity: "switch.a" });
    expect(cycleAction(sw, makeState("switch.a", "unavailable"), 1).value).toBe("off");
  });
});

describe("unavailableReason", () => {
  it("names why an entity is unavailable and is null for a usable state", () => {
    expect(unavailableReason(undefined)).toBe("missing");
    expect(unavailableReason(makeState("switch.a", "unavailable"))).toBe("unavailable");
    expect(unavailableReason(makeState("switch.a", "unknown"))).toBe("unknown");
    expect(unavailableReason(makeState("switch.a", "on"))).toBeNull();
  });
});

describe("selectAction", () => {
  it("builds domain specific services", () => {
    expect(selectAction(select(), "on")).toMatchObject({ perform_action: "input_select.select_option", data: { option: "on" }, target: { entity_id: "input_select.mode" } });
    expect(selectAction(normalizeConfig({ entity: "climate.r" }), "heat")).toMatchObject({ perform_action: "climate.set_hvac_mode", data: { hvac_mode: "heat" } });
    expect(selectAction(normalizeConfig({ entity: "light.a" }), "off").perform_action).toBe("light.turn_off");
    expect(selectAction(normalizeConfig({ entity: "light.a" }), "on").perform_action).toBe("light.turn_on");
    expect(selectAction(normalizeConfig({ entity: "cover.a", mode: "state" }), "on").perform_action).toBe("homeassistant.turn_on");
  });
});

describe("view", () => {
  it("positions the handle by state index", () => {
    const v = view(select(), modeState);
    expect(v.fillPos).toBeCloseTo(1 / 3);
    expect(v.pos).toBeCloseTo(1 / 3);
    expect(v.positionText).toBe("2");
    expect(v.text).toBe("auto");
    expect(v.unavailable).toBe(false);
  });

  it("uses per-state icon, text and color", () => {
    const cfg = select({ states: [{ value: "off", icon: "mdi:power" }, { value: "auto", icon: "mdi:auto-fix", text: "A", color: "orange" }] });
    const v = view(cfg, modeState);
    expect(v).toMatchObject({ icon: "mdi:auto-fix", text: "A", color: "orange" });
  });

  it("honors handle_position", () => {
    expect(view(select({ handle_position: "end" }), modeState).pos).toBe(1);
    expect(view(select({ handle_position: "fixed", fixed_position: 20 }), modeState).pos).toBe(0.2);
    expect(view(select({ handle_position: "switch" }), modeState).pos).toBe(1);
    expect(view(select({ handle_position: "switch" }), makeState("input_select.mode", "off", { options: ["off", "on"] })).pos).toBe(0);
  });

  it("prefers a pending value", () => {
    expect(view(select(), modeState, "idle").pos).toBe(1);
  });

  it("flags unavailable and unknown states", () => {
    expect(view(select(), undefined).unavailable).toBe(true);
    for (const state of ["unavailable", "unknown"]) {
      expect(view(select(), makeState("input_select.mode", state, modeState.attributes)).unavailable, state).toBe(true);
    }
    const v = view(select(), makeState("input_select.mode", "weird", { options: ["a", "b"] }));
    expect(v.positionText).toBe("–");
    expect(v.pos).toBe(0);
  });
});

describe("cycleAction", () => {
  it("steps forward and wraps", () => {
    expect(cycleAction(select(), modeState, 1).value).toBe("on");
    expect(cycleAction(select(), makeState("input_select.mode", "idle", modeState.attributes), 1).value).toBe("off");
  });

  it("steps backward and wraps", () => {
    expect(cycleAction(select(), modeState, -1).value).toBe("off");
    expect(cycleAction(select(), makeState("input_select.mode", "off", modeState.attributes), -1).value).toBe("idle");
  });

  it("continues from a pending value", () => {
    expect(cycleAction(select(), modeState, 1, "on").value).toBe("idle");
  });

  it("starts at an end when the current state is unknown", () => {
    const unknown = makeState("input_select.mode", "zzz", modeState.attributes);
    expect(cycleAction(select(), unknown, 1).value).toBe("off");
    expect(cycleAction(select(), unknown, -1).value).toBe("idle");
  });

  it("returns null with fewer than two states", () => {
    expect(cycleAction(select({ states: ["only"] }), modeState, 1)).toBeNull();
  });
});

describe("drag and defaults", () => {
  it("snaps to the nearest state on release", () => {
    expect(onRelease({ frac: 1, config: select(), stateObj: modeState }).pending).toBe("idle");
    expect(onRelease({ frac: 0.34, config: select(), stateObj: modeState })).toBeNull();
  });

  it("is only draggable with flex positioning", () => {
    expect(isDraggable(select(), modeState)).toBe(true);
    expect(isDraggable(select({ handle_position: "end" }), modeState)).toBe(false);
    expect(isDraggable(select({ drag: false }), modeState)).toBe(false);
  });

  it("defaults tap to cycle and hold to none or reverse", () => {
    expect(defaultActions(select()).tap_action.action).toBe("cycle");
    expect(defaultActions(select()).hold_action.action).toBe("none");
    expect(defaultActions(select({ hold_reverse: true })).hold_action.action).toBe("cycle_back");
  });
});

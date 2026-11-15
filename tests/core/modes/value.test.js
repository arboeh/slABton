import { describe, expect, it, vi } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { NOTICE } from "../../../src/core/constants.js";
import {
  defaultActions, isDraggable, measure, onRelease, range, resolveStep, stepRelease, valueAt, view,
} from "../../../src/core/modes/value.js";
import { makeState } from "../../helpers/mock-hass.js";

const sensor = (extra = {}) => normalizeConfig({ entity: "sensor.t", ...extra });

describe("tiny steps and many decimals", () => {
  const input = (extra = {}) => normalizeConfig({ entity: "input_number.v", ...extra });
  const stateOf = (attributes) => makeState("input_number.v", "0", attributes);

  it("treats a step attribute below the minimum as stepless instead of throwing", () => {
    const stateObj = stateOf({ min: 0, max: 100, step: 1e-101 });
    expect(resolveStep(input(), stateObj)).toBeNull();
    expect(() => valueAt(input(), stateObj, 0.5)).not.toThrow();
    expect(valueAt(input(), stateObj, 0.5)).toBe(50);
    expect(() => stepRelease({ direction: 1, config: input(), stateObj })).not.toThrow();
  });

  it("drops a tiny step option with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = input({ step: 1e-101 });
    expect(config.step).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/step/));
    expect(() => valueAt(config, stateOf({ min: 0, max: 100 }), 0.5)).not.toThrow();
    warn.mockRestore();
  });

  it("keeps steps from the minimum upwards", () => {
    expect(resolveStep(input(), stateOf({ step: 1e-9 }))).toBe(1e-9);
    expect(resolveStep(input(), stateOf({ step: 0 }))).toBeNull();
  });

  it("does not throw for a minimum with more decimals than toFixed accepts", () => {
    const stateObj = stateOf({ min: 1e-101, max: 10, step: 1 });
    expect(() => valueAt(input(), stateObj, 0.5)).not.toThrow();
    expect(valueAt(input(), stateObj, 0.5)).toBe(5);
  });
});

describe("view", () => {
  it("maps the value onto the range", () => {
    const v = view(sensor({ min: 0, max: 200 }), makeState("sensor.t", "50"));
    expect(v.fillPos).toBe(0.25);
    expect(v.pos).toBe(0.25);
    expect(v.positionText).toBe("25");
  });

  it("clamps outside the range", () => {
    expect(view(sensor(), makeState("sensor.t", "250")).fillPos).toBe(1);
    expect(view(sensor(), makeState("sensor.t", "-5")).fillPos).toBe(0);
  });

  it("formats with the preset unit", () => {
    const v = view(sensor({ preset: "thermometer" }), makeState("sensor.t", "21.46"));
    expect(v.text).toBe("21.5°C");
    expect(v.icon).toBe("mdi:thermometer");
  });

  it("falls back to the entity unit and icon", () => {
    const v = view(sensor({ decimals: 0 }), makeState("sensor.t", "12", { unit_of_measurement: "V", icon: "mdi:sine-wave" }));
    expect(v.text).toBe("12 V");
    expect(v.icon).toBe("mdi:sine-wave");
  });

  it("marks non-numeric and unavailable values", () => {
    for (const state of ["unavailable", "unknown", "abc", ""]) {
      const v = view(sensor(), makeState("sensor.t", state));
      expect(v.unavailable).toBe(true);
      expect(v.text).toBe("–");
    }
    expect(view(sensor(), undefined).unavailable).toBe(true);
  });

  it("keeps the fill on the value when the handle is pinned", () => {
    const v = view(sensor({ handle_position: "end" }), makeState("sensor.t", "50"));
    expect(v.pos).toBe(1);
    expect(v.fillPos).toBe(0.5);
  });
});

describe("behaviour", () => {
  it("keeps the info actions: a tap opens more-info and sets nothing", () => {
    expect(isDraggable()).toBe(false);
    expect(isDraggable(sensor(), makeState("sensor.t", "5"))).toBe(false);
    expect(defaultActions().tap_action.action).toBe("more-info");
    expect(defaultActions().double_tap_action.action).toBe("none");
  });
});

const num = (extra = {}) => normalizeConfig({ entity: "input_number.v", ...extra });
const numState = (state = "50", attrs = {}) => makeState("input_number.v", state, attrs);

describe("range", () => {
  it("takes min and max from the attributes of input_number and number", () => {
    expect(range(num(), numState("5", { min: 10, max: 20 }))).toEqual({ min: 10, max: 20 });
    const config = normalizeConfig({ entity: "number.v" });
    expect(range(config, makeState("number.v", "5", { min: -5, max: 5 }))).toEqual({ min: -5, max: 5 });
  });

  it("lets explicit config bounds win over the attributes", () => {
    expect(range(num({ min: 5 }), numState("5", { min: 10, max: 20 }))).toEqual({ min: 5, max: 20 });
    expect(range(num({ bar: { max: 80 } }), numState("5", { min: 10, max: 20 }))).toEqual({ min: 10, max: 80 });
  });

  it("falls back to the preset and then to 0..100 without attributes", () => {
    expect(range(num({ preset: "thermometer" }), numState())).toEqual({ min: -10, max: 40 });
    expect(range(num(), numState())).toEqual({ min: 0, max: 100 });
    expect(range(num({ preset: "soc" }), numState("5", { min: 10 }))).toEqual({ min: 10, max: 100 });
  });

  it("keeps the config range for sensors", () => {
    expect(range(sensor(), makeState("sensor.t", "5", { min: 10, max: 20 }))).toEqual({ min: 0, max: 100 });
  });

  it("ignores attributes that are not numbers", () => {
    expect(range(num(), numState("5", { min: "abc", max: null }))).toEqual({ min: 0, max: 100 });
  });

  it("maps the value onto the entity range", () => {
    const v = view(num(), numState("15", { min: 10, max: 20 }));
    expect(v.fillPos).toBe(0.5);
    expect(measure(num(), numState("15", { min: 10, max: 20 })).frac).toBe(0.5);
  });

  it("reports an invalid entity range and shows no fill", () => {
    const v = view(num(), numState("15", { min: 20, max: 10 }));
    expect(v.notice).toBe(NOTICE.INVALID_VALUE_RANGE);
    expect(v.fillPos).toBe(0);
    expect(view(num(), numState("15", { min: 0, max: 10 })).notice).toBeNull();
  });
});

describe("step", () => {
  it("uses the entity attribute", () => {
    expect(resolveStep(num(), numState("5", { step: 5 }))).toBe(5);
  });

  it("lets the option override the attribute", () => {
    expect(resolveStep(num({ step: 2 }), numState("5", { step: 5 }))).toBe(2);
    expect(resolveStep(num({ bar: { step: 0.5 } }), numState("5", { step: 5 }))).toBe(0.5);
  });

  it("is stepless without option and attribute, or with unusable values", () => {
    expect(resolveStep(num(), numState())).toBeNull();
    for (const step of [0, -1, "abc", null]) expect(resolveStep(num(), numState("5", { step }))).toBeNull();
  });
});

describe("valueAt", () => {
  const attrs = { min: 0, max: 100, step: 5 };

  it("rounds to the step", () => {
    expect(valueAt(num(), numState("0", attrs), 0.5)).toBe(50);
    expect(valueAt(num(), numState("0", attrs), 0.53)).toBe(55);
    expect(valueAt(num(), numState("0", attrs), 0.52)).toBe(50);
  });

  it("counts steps from the minimum", () => {
    expect(valueAt(num(), numState("0", { min: 3, max: 23, step: 5 }), 0.3)).toBe(8);
  });

  it("rounds to the decimals of the step without float noise", () => {
    expect(valueAt(num(), numState("0", { min: 0, max: 1, step: 0.1 }), 0.33)).toBe(0.3);
    expect(valueAt(num(), numState("0", { min: 0, max: 1, step: 0.1 }), 0.7)).toBe(0.7);
    expect(valueAt(num(), numState("0", { min: 0, max: 5, step: 0.5 }), 0.37)).toBe(2);
  });

  it("stays on the grid when the maximum is not a multiple of the step", () => {
    const state = numState("0", { min: 0, max: 10, step: 3 });
    expect(valueAt(num(), state, 1)).toBe(9);
    expect(valueAt(num(), state, 0)).toBe(0);
  });

  it("rounds a stepless value to the decimals only", () => {
    expect(valueAt(num({ decimals: 0 }), numState(), 0.333)).toBe(33);
    expect(valueAt(num({ decimals: 1 }), numState(), 0.3333)).toBe(33.3);
  });
});

describe("dragging", () => {
  it("is allowed for input_number and number only", () => {
    expect(isDraggable(num(), numState())).toBe(true);
    expect(isDraggable(normalizeConfig({ entity: "number.v" }), makeState("number.v", "5"))).toBe(true);
    expect(isDraggable(sensor(), makeState("sensor.t", "5"))).toBe(false);
    expect(isDraggable(normalizeConfig({ entity: "sensor.t", mode: "value", drag: true }), makeState("sensor.t", "5"))).toBe(false);
    expect(isDraggable(normalizeConfig({ entity: "counter.c", mode: "value" }), makeState("counter.c", "5"))).toBe(false);
  });

  it("respects drag: false, availability, handle position, range and a separate bar entity", () => {
    expect(isDraggable(num({ drag: false }), numState())).toBe(false);
    expect(isDraggable(num(), numState("unavailable"))).toBe(false);
    expect(isDraggable(num(), numState("unknown"))).toBe(false);
    expect(isDraggable(num(), undefined)).toBe(false);
    expect(isDraggable(num({ handle_position: "end" }), numState())).toBe(false);
    expect(isDraggable(num(), numState("5", { min: 20, max: 10 }))).toBe(false);
    expect(isDraggable(num({ bar: { entity: "sensor.other" } }), numState())).toBe(false);
  });
});

describe("onRelease", () => {
  const attrs = { min: 0, max: 100, step: 5 };

  it("calls input_number.set_value with the snapped value", () => {
    const result = onRelease({ frac: 0.5, config: num(), stateObj: numState("20", attrs) });
    expect(result).toEqual({
      action: {
        action: "perform-action",
        perform_action: "input_number.set_value",
        target: { entity_id: "input_number.v" },
        data: { value: 50 },
      },
      pending: 50,
    });
  });

  it("calls number.set_value for number entities", () => {
    const result = onRelease({
      frac: 1,
      config: normalizeConfig({ entity: "number.v" }),
      stateObj: makeState("number.v", "20", attrs),
    });
    expect(result.action.perform_action).toBe("number.set_value");
    expect(result.action.target).toEqual({ entity_id: "number.v" });
    expect(result.action.data).toEqual({ value: 100 });
  });

  it("leaves a value off the grid alone when the drag ends where it started", () => {
    const off = numState("52", attrs);
    expect(onRelease({ frac: 0.5, startPos: 0.52, config: num(), stateObj: off })).toBeNull();
    expect(onRelease({ frac: 0.52, startPos: 0.52, config: num(), stateObj: off })).toBeNull();
    expect(onRelease({ frac: 0.7, startPos: 0.52, config: num(), stateObj: off }).pending).toBe(70);
  });

  it("rounds a fractional step with a negative minimum without float noise", () => {
    const stateObj = numState("0", { min: -1, max: 1, step: 0.1 });
    expect(valueAt(num(), stateObj, 0.65)).toBe(0.3);
    expect(valueAt(num(), stateObj, 0.35)).toBe(-0.3);
  });

  it("copes with a step larger than the range and with an exponent step", () => {
    expect(valueAt(num(), numState("0", { min: 0, max: 10, step: 50 }), 1)).toBe(0);
    const tiny = numState("0", { min: 0, max: 0.000001, step: 1e-7 });
    expect(valueAt(num({ decimals: 7 }), tiny, 0.5)).toBe(5e-7);
  });

  it("clamps to the range", () => {
    expect(onRelease({ frac: 1, config: num(), stateObj: numState("20", attrs) }).pending).toBe(100);
    expect(onRelease({ frac: 0, config: num(), stateObj: numState("20", attrs) }).pending).toBe(0);
  });

  it("sends nothing when the value is unchanged", () => {
    expect(onRelease({ frac: 0.5, config: num(), stateObj: numState("50", attrs) })).toBeNull();
    expect(onRelease({ frac: 0.51, config: num(), stateObj: numState("50", attrs) })).toBeNull();
  });

  it("compares with the pending value first", () => {
    expect(onRelease({ frac: 0.5, config: num(), stateObj: numState("20", attrs), pending: 50 })).toBeNull();
    expect(onRelease({ frac: 0.2, config: num(), stateObj: numState("20", attrs), pending: 50 }).pending).toBe(20);
  });

  it("sends nothing when the entity cannot be dragged", () => {
    expect(onRelease({ frac: 0.5, config: num({ drag: false }), stateObj: numState("20", attrs) })).toBeNull();
    expect(onRelease({ frac: 0.5, config: sensor(), stateObj: makeState("sensor.t", "20") })).toBeNull();
    expect(onRelease({ frac: 0.5, config: num(), stateObj: numState("unavailable", attrs) })).toBeNull();
  });
});

describe("stepRelease", () => {
  const attrs = { min: 0, max: 100, step: 5 };

  it("moves one step up and down", () => {
    expect(stepRelease({ direction: 1, config: num(), stateObj: numState("50", attrs) }).pending).toBe(55);
    expect(stepRelease({ direction: -1, config: num(), stateObj: numState("50", attrs) }).pending).toBe(45);
    expect(stepRelease({ direction: 1, config: num(), stateObj: numState("50", attrs) }).action.data).toEqual({ value: 55 });
  });

  it("moves 1 % of the range without a step, at least one decimal unit", () => {
    expect(stepRelease({ direction: 1, config: num(), stateObj: numState("50", { min: 0, max: 100 }) }).pending).toBe(51);
    expect(stepRelease({ direction: -1, config: num(), stateObj: numState("500", { min: 0, max: 1000 }) }).pending).toBe(490);
    expect(stepRelease({ direction: 1, config: num({ decimals: 0 }), stateObj: numState("5", { min: 0, max: 10 }) }).pending).toBe(6);
  });

  it("stops at the bounds", () => {
    expect(stepRelease({ direction: 1, config: num(), stateObj: numState("100", attrs) })).toBeNull();
    expect(stepRelease({ direction: -1, config: num(), stateObj: numState("0", attrs) })).toBeNull();
  });

  it("continues from the pending value", () => {
    expect(stepRelease({ direction: 1, config: num(), stateObj: numState("50", attrs), pending: 55 }).pending).toBe(60);
  });

  it("does nothing when the entity cannot be dragged", () => {
    expect(stepRelease({ direction: 1, config: num({ drag: false }), stateObj: numState("50", attrs) })).toBeNull();
    expect(stepRelease({ direction: 1, config: sensor(), stateObj: makeState("sensor.t", "50") })).toBeNull();
  });
});

describe("live value", () => {
  const attrs = { min: 0, max: 100, step: 5 };

  it("shows the pending value instead of the state", () => {
    const v = view(num({ decimals: 0 }), numState("20", attrs), 50);
    expect(v.text).toBe("50");
    expect(v.fillPos).toBe(0.5);
  });

  it("shows the value under the finger while dragging", () => {
    const v = view(num({ decimals: 0 }), numState("20", attrs), undefined, { dragPos: 0.53 });
    expect(v.text).toBe("55");
  });

  it("ignores the drag position when the entity cannot be dragged", () => {
    expect(view(sensor({ decimals: 0 }), makeState("sensor.t", "20"), undefined, { dragPos: 0.9 }).text).toBe("20");
  });
});

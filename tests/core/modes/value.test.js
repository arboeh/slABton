import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { defaultActions, isDraggable, view } from "../../../src/core/modes/value.js";
import { makeState } from "../../helpers/mock-hass.js";

const sensor = (extra = {}) => normalizeConfig({ entity: "sensor.t", ...extra });

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
  it("is read-only and opens more-info on tap", () => {
    expect(isDraggable()).toBe(false);
    expect(defaultActions().tap_action.action).toBe("more-info");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { defaultActions, isDraggable, range, view } from "../../../src/core/modes/counter.js";
import { makeState } from "../../helpers/mock-hass.js";

const ENTITY = "counter.visitors";
const cfg = (extra = {}) => normalizeConfig({ entity: ENTITY, ...extra });
const counter = (state, attributes = {}) => makeState(ENTITY, state, attributes);

describe("invalid range notice", () => {
  it("reports max <= min coming from the attributes or from mixed sources", () => {
    expect(view(cfg(), counter("3", { minimum: 5, maximum: 5 })).notice).toBe("invalid_range");
    expect(view(cfg(), counter("3", { minimum: 9, maximum: 2 })).fillPos).toBe(0);
    // counter.min alone passes the config check but conflicts with the entity's maximum
    expect(view(cfg({ counter: { min: 20 } }), counter("3", { maximum: 10 })).notice).toBe("invalid_range");
  });

  it("reports nothing for a valid range", () => {
    expect(view(cfg(), counter("3", { minimum: 0, maximum: 10 })).notice).toBeNull();
  });
});

describe("range", () => {
  it("falls back to 0 / 100 without any information", () => {
    expect(range(cfg(), counter("3"))).toEqual({ min: 0, max: 100 });
    expect(range(cfg(), counter("3", { minimum: null, maximum: null }))).toEqual({ min: 0, max: 100 });
    expect(range(cfg(), undefined)).toEqual({ min: 0, max: 100 });
  });

  it("uses the entity attributes", () => {
    expect(range(cfg(), counter("3", { minimum: 1, maximum: 10 }))).toEqual({ min: 1, max: 10 });
  });

  it("prefers bar / flat options over attributes and counter: over both", () => {
    const attrs = { minimum: 1, maximum: 10 };
    expect(range(cfg({ min: 2, max: 20 }), counter("3", attrs))).toEqual({ min: 2, max: 20 });
    expect(range(cfg({ bar: { max: 30 } }), counter("3", attrs))).toEqual({ min: 1, max: 30 });
    expect(range(cfg({ min: 2, max: 20, counter: { min: 5, max: 50 } }), counter("3", attrs))).toEqual({ min: 5, max: 50 });
  });
});

describe("view", () => {
  it("fills the bar between minimum and maximum", () => {
    const v = view(cfg(), counter("3", { minimum: 0, maximum: 10 }));
    expect(v.fillPos).toBe(0.3);
    expect(v.pos).toBe(0.3);
    expect(v.text).toBe("3");
    expect(v.positionText).toBe("30");
    expect(v.ariaNow).toBe(30);
    expect(v.unavailable).toBe(false);
    expect(v.values).toEqual({ state: "3", value: "3" });
  });

  it("clamps values outside the range", () => {
    expect(view(cfg(), counter("15", { minimum: 0, maximum: 10 })).fillPos).toBe(1);
    expect(view(cfg(), counter("-4", { minimum: 0, maximum: 10 })).fillPos).toBe(0);
  });

  it("appends the unit and uses the entity icon", () => {
    const v = view(cfg({ unit: "x" }), counter("4", { icon: "mdi:account" }));
    expect(v.text).toBe("4 x");
    expect(v.icon).toBe("mdi:account");
    expect(view(cfg({ icon: "mdi:star" }), counter("4")).icon).toBe("mdi:star");
    expect(view(cfg(), counter("4")).icon).toBe("mdi:counter");
  });

  it("shows an empty bar when the range is empty", () => {
    const v = view(cfg({ counter: { min: 5 } }), counter("3", { maximum: 5 }));
    expect(v.fillPos).toBe(0);
    expect(v.text).toBe("3");
  });

  it("marks unavailable and non-numeric counters", () => {
    for (const state of ["unavailable", "unknown", "abc", ""]) {
      const v = view(cfg(), counter(state));
      expect(v.unavailable).toBe(true);
      expect(v.text).toBe("–");
      expect(v.fillPos).toBe(0);
    }
    expect(view(cfg(), undefined).unavailable).toBe(true);
  });
});

describe("behaviour", () => {
  it("increments on tap, decrements on double tap and never resets by default", () => {
    const actions = defaultActions(cfg());
    expect(actions.tap_action).toEqual({
      action: "perform-action", perform_action: "counter.increment", target: { entity_id: ENTITY },
    });
    expect(actions.double_tap_action.perform_action).toBe("counter.decrement");
    expect(actions.hold_action).toEqual({ action: "none" });
  });

  it("is read-only", () => {
    expect(isDraggable()).toBe(false);
  });
});

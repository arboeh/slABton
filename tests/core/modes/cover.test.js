import { afterEach, describe, expect, it, vi } from "vitest";
import { inferMode, isLegacyCoverConfig, normalizeConfig } from "../../../src/core/config.js";
import { COVER_FEATURE } from "../../../src/core/constants.js";
import {
  defaultActions, isDraggable, keepsPending, onRelease, range, stepRelease, view,
} from "../../../src/core/modes/value.js";
import { makeState } from "../../helpers/mock-hass.js";

afterEach(() => vi.restoreAllMocks());

const ALL = COVER_FEATURE.OPEN | COVER_FEATURE.CLOSE | COVER_FEATURE.SET_POSITION | COVER_FEATURE.STOP;
const ID = "cover.living_room";

const config = (extra = {}) => normalizeConfig({ entity: ID, ...extra });
const cover = (state = "open", attributes = {}) => makeState(ID, state, { supported_features: ALL, current_position: 40, ...attributes });
/** A cover without position support: only open / close / stop. */
const simple = (state = "closed", attributes = {}) => makeState(ID, state, {
  supported_features: COVER_FEATURE.OPEN | COVER_FEATURE.CLOSE | COVER_FEATURE.STOP, ...attributes,
});

describe("cover config", () => {
  it("infers the value mode for a cover", () => {
    expect(inferMode("cover")).toBe("value");
    expect(config().mode).toBe("value");
  });

  it("keeps the other domains as they were", () => {
    expect(inferMode("sensor")).toBe("value");
    expect(inferMode("lock")).toBe("lock");
    expect(inferMode("switch")).toBe("state");
    expect(inferMode("input_select", { legacyCover: true })).toBe("state");
  });

  it("measures a whole percent: range 0..100, no decimals, unit %, drag on, no header icon", () => {
    const c = config();
    expect(c).toMatchObject({ min: 0, max: 100, decimals: 0, unit: "%", drag: true, icon: null });
  });

  it("lets the user override range, unit and decimals", () => {
    expect(config({ min: 10, max: 90, unit: "pct", decimals: 1 })).toMatchObject({ min: 10, max: 90, unit: "pct", decimals: 1 });
    expect(config({ drag: false }).drag).toBe(false);
  });

  it("keeps the state mode for cover configs written before covers had a position bar", () => {
    const states = [{ value: "open" }, { value: "closed" }];
    for (const extra of [{ states }, { bar: { attribute: "current_position" } }, { bar: { entity: "sensor.x" } }]) {
      expect(isLegacyCoverConfig({ entity: ID, ...extra })).toBe(true);
      expect(config(extra).mode).toBe("state");
    }
    expect(isLegacyCoverConfig({ entity: ID })).toBe(false);
    expect(isLegacyCoverConfig({ entity: ID, states: [], bar: {} })).toBe(false);
    expect(isLegacyCoverConfig(null)).toBe(false);
  });

  it("keeps the old display defaults of a legacy cover with a bar attribute", () => {
    const c = config({ bar: { attribute: "current_position" } });
    expect(c).toMatchObject({ mode: "state", decimals: 1, unit: null, bar_own_attribute: true });
  });

  it("honors an explicit mode", () => {
    expect(config({ mode: "state" }).mode).toBe("state");
    expect(config({ mode: "value" }).mode).toBe("value");
    expect(config({ mode: "state" })).toMatchObject({ decimals: 1, unit: null });
  });

  it("labels the scale with the fixed range 0 and 100", () => {
    const c = config({ scale: { labels: true } });
    expect(c.scale.labels.map((l) => l.text)).toEqual(["0", "100"]);
  });
});

describe("cover view with a position", () => {
  it("shows current_position on the range: 0 closed (empty), 100 open (full)", () => {
    const v = view(config(), cover("open"));
    expect(v).toMatchObject({ fillPos: 0.4, pos: 0.4, text: "40%", positionText: "40", ariaNow: 40, unavailable: false, moving: false });
    expect(view(config(), cover("closed", { current_position: 0 })).fillPos).toBe(0);
    expect(view(config(), cover("open", { current_position: 100 })).fillPos).toBe(1);
  });

  it("does not read the state as a number", () => {
    expect(view(config(), cover("open")).unavailable).toBe(false);
  });

  it("follows a configured range", () => {
    expect(view(config({ min: 0, max: 50 }), cover("open", { current_position: 25 })).fillPos).toBe(0.5);
    expect(range(config({ min: 10, max: 90 }), cover())).toEqual({ min: 10, max: 90 });
  });

  it("picks an icon per state, the entity icon, then the config icon", () => {
    expect(view(config(), cover("open")).icon).toBe("mdi:window-shutter-open");
    expect(view(config(), cover("closed")).icon).toBe("mdi:window-shutter");
    expect(view(config(), cover("opening")).icon).toBe("mdi:arrow-up");
    expect(view(config(), cover("closing")).icon).toBe("mdi:arrow-down");
    expect(view(config(), cover("open", { icon: "mdi:blinds" })).icon).toBe("mdi:blinds");
    expect(view(config({ icon: "mdi:garage" }), cover("open", { icon: "mdi:blinds" })).icon).toBe("mdi:garage");
  });

  it("marks a travelling cover and follows its position live", () => {
    const v = view(config(), cover("opening", { current_position: 55 }));
    expect(v.moving).toBe(true);
    expect(v.fillPos).toBe(0.55);
    expect(view(config(), cover("closing")).moving).toBe(true);
  });

  it("shows the pending value and the value under the finger", () => {
    expect(view(config(), cover(), 70).text).toBe("70%");
    expect(view(config(), cover(), undefined, { dragPos: 0.3 }).text).toBe("30%");
    expect(view(config({ drag: false }), cover(), undefined, { dragPos: 0.3 }).text).toBe("40%");
  });

  it("is unavailable while the entity is", () => {
    expect(view(config(), cover("unavailable", {})).unavailable).toBe(true);
    expect(view(config(), undefined).unavailable).toBe(true);
  });

  it("falls back to the state view when it claims set-position but reports no position", () => {
    const noPosition = cover("open", { current_position: null });
    expect(view(config(), noPosition)).toMatchObject({ unavailable: false, text: "open", fillPos: 1 });
    expect(isDraggable(config(), noPosition)).toBe(false);
    expect(defaultActions(config(), noPosition).tap_action).toMatchObject({ perform_action: "cover.toggle" });
  });

  it("shows a position the cover reports even when it cannot set it", () => {
    const readOnly = cover("open", { supported_features: COVER_FEATURE.OPEN | COVER_FEATURE.CLOSE });
    expect(view(config(), readOnly)).toMatchObject({ fillPos: 0.4, unavailable: false });
    expect(isDraggable(config(), readOnly)).toBe(false);
  });
});

describe("cover state fallback (no position)", () => {
  it("puts the bar at the end that matches the state, halfway while travelling", () => {
    expect(view(config(), simple("closed"))).toMatchObject({ fillPos: 0, text: "closed", unavailable: false, moving: false });
    expect(view(config(), simple("open"))).toMatchObject({ fillPos: 1, text: "open" });
    expect(view(config(), simple("opening"))).toMatchObject({ fillPos: 0.5, moving: true });
    expect(view(config(), simple("closing"))).toMatchObject({ fillPos: 0.5, moving: true });
  });

  it("keeps the handle pinned by handle_position", () => {
    expect(view(config({ handle_position: "end" }), simple("closed")).pos).toBe(1);
  });

  it("uses the state icons and is unavailable like any entity", () => {
    expect(view(config(), simple("open")).icon).toBe("mdi:window-shutter-open");
    const v = view(config(), simple("unavailable"));
    expect(v).toMatchObject({ unavailable: true, text: "–" });
    expect(view(config(), undefined).unavailable).toBe(true);
  });

  it("cannot be dragged", () => {
    expect(isDraggable(config(), simple("closed"))).toBe(false);
    expect(onRelease({ frac: 0.5, config: config(), stateObj: simple("closed") })).toBeNull();
    expect(stepRelease({ direction: 1, config: config(), stateObj: simple("closed") })).toBeNull();
  });

  it("takes the position path as soon as the entity reports one", () => {
    expect(view(config(), simple("open", { current_position: 30 })).text).toBe("30%");
  });
});

describe("cover dragging", () => {
  it("needs the set-position feature", () => {
    expect(isDraggable(config(), cover())).toBe(true);
    expect(isDraggable(config(), cover("open", { supported_features: COVER_FEATURE.OPEN | COVER_FEATURE.CLOSE }))).toBe(false);
    expect(isDraggable(config(), cover("open", { supported_features: undefined }))).toBe(false);
  });

  it("respects drag: false, availability, handle position and a separate bar entity", () => {
    expect(isDraggable(config({ drag: false }), cover())).toBe(false);
    expect(isDraggable(config(), cover("unavailable"))).toBe(false);
    expect(isDraggable(config(), undefined)).toBe(false);
    expect(isDraggable(config({ handle_position: "end" }), cover())).toBe(false);
    expect(isDraggable(config({ mode: "value", bar: { entity: "sensor.other" } }), cover())).toBe(false);
  });

  it("is draggable for any cover state with a position (a travel can be redirected)", () => {
    expect(isDraggable(config(), cover("opening"))).toBe(true);
  });
});

describe("cover onRelease", () => {
  it("calls cover.set_cover_position with the position under the handle", () => {
    expect(onRelease({ frac: 0.5, config: config(), stateObj: cover("open", { current_position: 100 }) })).toEqual({
      action: {
        action: "perform-action",
        perform_action: "cover.set_cover_position",
        target: { entity_id: ID },
        data: { position: 50 },
      },
      pending: 50,
    });
  });

  it("rounds to a whole percent and clamps to the range", () => {
    expect(onRelease({ frac: 0.336, config: config(), stateObj: cover() }).pending).toBe(34);
    expect(onRelease({ frac: 1, config: config(), stateObj: cover() }).pending).toBe(100);
    expect(onRelease({ frac: 0, config: config(), stateObj: cover() }).pending).toBe(0);
  });

  it("sends nothing when the position is unchanged", () => {
    expect(onRelease({ frac: 0.4, config: config(), stateObj: cover() })).toBeNull();
    expect(onRelease({ frac: 0.5, config: config(), stateObj: cover(), pending: 50 })).toBeNull();
    expect(onRelease({ frac: 0.5, startPos: 0.5, config: config(), stateObj: cover() })).toBeNull();
  });

  it("sends nothing when the cover cannot be set", () => {
    expect(onRelease({ frac: 0.5, config: config({ drag: false }), stateObj: cover() })).toBeNull();
    expect(onRelease({ frac: 0.5, config: config(), stateObj: cover("unavailable") })).toBeNull();
  });

  it("does not touch set_value of other domains", () => {
    const stateObj = makeState("input_number.v", "20", { min: 0, max: 100 });
    const result = onRelease({ frac: 0.5, config: normalizeConfig({ entity: "input_number.v" }), stateObj });
    expect(result.action.perform_action).toBe("input_number.set_value");
  });
});

describe("cover stepRelease (arrow keys)", () => {
  it("moves the position by 1 % per key press", () => {
    expect(stepRelease({ direction: 1, config: config(), stateObj: cover() })).toMatchObject({ pending: 41 });
    expect(stepRelease({ direction: -1, config: config(), stateObj: cover() }).action).toMatchObject({
      perform_action: "cover.set_cover_position", data: { position: 39 },
    });
  });

  it("continues from the pending value and stops at the ends", () => {
    expect(stepRelease({ direction: 1, config: config(), stateObj: cover(), pending: 60 }).pending).toBe(61);
    expect(stepRelease({ direction: 1, config: config(), stateObj: cover("open", { current_position: 100 }) })).toBeNull();
    expect(stepRelease({ direction: -1, config: config(), stateObj: cover("closed", { current_position: 0 }) })).toBeNull();
  });

  it("does nothing without a known position", () => {
    expect(stepRelease({ direction: 1, config: config(), stateObj: cover("open", { current_position: null }) })).toBeNull();
  });
});

describe("cover default actions", () => {
  const actions = (stateObj, extra) => defaultActions(config(extra), stateObj);
  const service = (name) => ({
    action: "perform-action", perform_action: `cover.${name}`, target: { entity_id: ID },
  });

  it("toggles on tap and stops on hold", () => {
    expect(actions(cover())).toEqual({
      tap_action: service("toggle"),
      double_tap_action: { action: "none" },
      hold_action: service("stop_cover"),
    });
  });

  it("works the same for a cover without position", () => {
    expect(actions(simple()).tap_action).toEqual(service("toggle"));
    expect(actions(simple()).hold_action).toEqual(service("stop_cover"));
  });

  it("calls only the direction the entity supports", () => {
    expect(actions(cover("open", { supported_features: COVER_FEATURE.OPEN })).tap_action).toEqual(service("open_cover"));
    expect(actions(cover("open", { supported_features: COVER_FEATURE.CLOSE })).tap_action).toEqual(service("close_cover"));
  });

  it("calls no service the entity would refuse: tap opens more-info, hold does nothing", () => {
    for (const supported_features of [0, COVER_FEATURE.SET_POSITION, undefined]) {
      const result = actions(cover("open", { supported_features }));
      expect(result.tap_action).toEqual({ action: "more-info" });
      expect(result.hold_action).toEqual({ action: "none" });
    }
    expect(actions(cover("open", { supported_features: COVER_FEATURE.OPEN | COVER_FEATURE.CLOSE })).hold_action).toEqual({ action: "none" });
  });

  it("keeps the info actions for every other entity and for a cover with a bar entity", () => {
    expect(defaultActions(normalizeConfig({ entity: "sensor.t" }), makeState("sensor.t", "5")).tap_action).toEqual({ action: "more-info" });
    expect(defaultActions(config({ mode: "value", bar: { entity: "sensor.x" } }), cover()).tap_action).toEqual({ action: "more-info" });
    expect(defaultActions().hold_action).toEqual({ action: "none" });
  });
});

describe("cover keepsPending", () => {
  it("keeps a position the cover is still travelling to", () => {
    expect(keepsPending(config(), cover("opening", { current_position: 40 }), 70)).toBe(true);
    expect(keepsPending(config(), cover("closing", { current_position: 90 }), 30)).toBe(true);
  });

  it("lets go once the position has been reached or passed", () => {
    expect(keepsPending(config(), cover("opening", { current_position: 70 }), 70)).toBe(false);
    expect(keepsPending(config(), cover("opening", { current_position: 80 }), 70)).toBe(false);
    expect(keepsPending(config(), cover("closing", { current_position: 30 }), 30)).toBe(false);
  });

  it("lets go when the cover stands still (stopped, refused, arrived)", () => {
    expect(keepsPending(config(), cover("open", { current_position: 40 }), 70)).toBe(false);
    expect(keepsPending(config(), cover("closed", { current_position: 0 }), 70)).toBe(false);
  });

  it("keeps it while a travelling cover reports no position yet", () => {
    expect(keepsPending(config(), cover("opening", { current_position: null }), 70)).toBe(true);
  });

  it("does not apply to other entities or a missing pending value", () => {
    expect(keepsPending(normalizeConfig({ entity: "input_number.v" }), makeState("input_number.v", "5"), 70)).toBe(false);
    expect(keepsPending(config(), cover("opening"), undefined)).toBe(false);
    expect(keepsPending(undefined, cover("opening"), 70)).toBe(false);
  });
});

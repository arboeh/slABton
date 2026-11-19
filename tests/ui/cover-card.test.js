import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../src/ui/slabton-card.js";
import { PENDING_TIMEOUT_MS, TRAVEL_PENDING_TIMEOUT_MS } from "../../src/ui/slabton-card.js";
import { COVER_PENDING_TIMEOUT_MS } from "../../src/core/modes/value.js";
import { createHass, makeState, pointer, withState } from "../helpers/mock-hass.js";

const COVER = "cover.living_room";
const ALL = 15; // open, close, set position, stop
const FULL = { supported_features: ALL, current_position: 100 };

function create(config = {}, state = makeState(COVER, "open", FULL)) {
  const el = document.createElement("slabton-card");
  el.setConfig({ type: "custom:slabton-card", entity: COVER, ...config });
  el.hass = createHass({ [COVER]: state });
  document.body.appendChild(el);
  vi.advanceTimersByTime(0);
  return el;
}

const q = (el, selector) => el.shadowRoot.querySelector(selector);
const fill = (el) => q(el, ".root").style.getPropertyValue("--slabton-p");
const tap = (target) => {
  pointer(target, "pointerdown");
  pointer(target, "pointerup");
};
/** The cover entity changes (new state object, like HA). */
const report = (el, state, attributes) => {
  el.hass = withState(el.hass, COVER, state, { ...FULL, ...attributes });
};

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("cover card", () => {
  it("runs in the value mode and shows the position", () => {
    const el = create({}, makeState(COVER, "open", { ...FULL, current_position: 40 }));
    expect(fill(el)).toBe("0.4");
    expect(q(el, ".h-text").textContent).toBe("40%");
    expect(q(el, ".handle").getAttribute("aria-valuenow")).toBe("40");
    expect(q(el, ".root").classList.contains("nodrag")).toBe(false);
  });

  it("taps open / close with cover.toggle", () => {
    const el = create();
    tap(q(el, ".handle"));
    expect(el.hass.callService).toHaveBeenCalledWith("cover", "toggle", {}, { entity_id: COVER });
  });

  it("stops the travel on hold", () => {
    const el = create();
    expect(el._actionFor("hold_action")).toMatchObject({ perform_action: "cover.stop_cover" });
    expect(el._actionFor("double_tap_action")).toEqual({ action: "none" });
  });

  it("lets an explicit tap_action win", () => {
    const el = create({ tap_action: { action: "more-info" } });
    const events = [];
    el.addEventListener("hass-more-info", (event) => events.push(event.detail.entityId));
    tap(q(el, ".handle"));
    expect(events).toEqual([COVER]);
    expect(el.hass.callService).not.toHaveBeenCalled();
  });

  it("opens more-info instead of calling a service the entity does not support", () => {
    const el = create({}, makeState(COVER, "open", { supported_features: 0, current_position: 50 }));
    const events = [];
    el.addEventListener("hass-more-info", (event) => events.push(event.detail.entityId));
    tap(q(el, ".handle"));
    expect(events).toEqual([COVER]);
    expect(el.hass.callService).not.toHaveBeenCalled();
  });

  it("sets the position on a drag release and on arrow keys", () => {
    const el = create();
    el._release(0.3, 1);
    expect(el.hass.callService).toHaveBeenCalledWith("cover", "set_cover_position", { position: 30 }, { entity_id: COVER });
    el._step(-1);
    expect(el.hass.callService).toHaveBeenLastCalledWith("cover", "set_cover_position", { position: 29 }, { entity_id: COVER });
  });

  it("does not turn drag on for a cover that cannot set a position", () => {
    const el = create({}, makeState(COVER, "closed", { supported_features: 3 }));
    expect(q(el, ".root").classList.contains("nodrag")).toBe(true);
    expect(fill(el)).toBe("0");
    tap(q(el, ".handle"));
    expect(el.hass.callService).toHaveBeenCalledWith("cover", "toggle", {}, { entity_id: COVER });
  });

  it("blocks the gestures of an unavailable cover and opens more-info on tap", () => {
    const el = create({}, makeState(COVER, "unavailable"));
    expect(q(el, ".root").classList.contains("blocked")).toBe(true);
    const events = [];
    el.addEventListener("hass-more-info", (event) => events.push(event.detail.entityId));
    tap(q(el, ".handle"));
    expect(events).toEqual([COVER]);
    expect(el.hass.callService).not.toHaveBeenCalled();
  });

  it("still runs a cover with states or a bar attribute in the state mode", () => {
    const states = create({ states: [{ value: "closed" }, { value: "open" }] }, makeState(COVER, "open", FULL));
    expect(states._config.mode).toBe("state");
    const attribute = create({ bar: { attribute: "current_position" } });
    expect(attribute._config.mode).toBe("state");
    expect(fill(attribute)).toBe("1");
  });
});

describe("cover travel", () => {
  it("follows the reported position live when it moves on its own", () => {
    const el = create({}, makeState(COVER, "opening", { ...FULL, current_position: 20 }));
    expect(fill(el)).toBe("0.2");
    report(el, "opening", { current_position: 50 });
    expect(fill(el)).toBe("0.5");
    report(el, "open", { current_position: 80 });
    expect(fill(el)).toBe("0.8");
  });

  it("pulses a travelling cover only with animation: pulse", () => {
    const pulsing = create({ animation: "pulse" }, makeState(COVER, "closing", FULL));
    expect(q(pulsing, ".root").classList.contains("expired")).toBe(true);
    report(pulsing, "closed", { current_position: 0 });
    expect(q(pulsing, ".root").classList.contains("expired")).toBe(false);
    expect(q(create({}, makeState(COVER, "closing", FULL)), ".root").classList.contains("expired")).toBe(false);
  });

  it("keeps the handle on the dragged position while the cover travels towards it", () => {
    const el = create();
    el._release(0.3, 1);
    el._update();
    expect(fill(el)).toBe("0.3");
    report(el, "closing", { current_position: 100 }); // moving, position not reported yet
    expect(fill(el)).toBe("0.3");
    report(el, "closing", { current_position: 60 });
    expect(fill(el)).toBe("0.3");
    report(el, "closed", { current_position: 30 }); // arrived
    expect(fill(el)).toBe("0.3");
    expect(el._pending).toBeNull();
  });

  it("extends the timeout while the cover travels and drops it afterwards", () => {
    const el = create();
    el._release(0.3, 1);
    report(el, "closing", { current_position: 100 });
    vi.advanceTimersByTime(PENDING_TIMEOUT_MS + 1000);
    expect(fill(el)).toBe("0.3");
    vi.advanceTimersByTime(TRAVEL_PENDING_TIMEOUT_MS);
    expect(el._pending).toBeNull();
    expect(fill(el)).toBe("1");
  });

  it("drops the pending position when the cover stops short of it", () => {
    const el = create();
    el._release(0.3, 1);
    report(el, "closing", { current_position: 90 });
    report(el, "open", { current_position: 60 }); // stopped on the way
    expect(el._pending).toBeNull();
    expect(fill(el)).toBe("0.6");
  });

  it("drops the pending position when the command is refused (the state never changes)", () => {
    const el = create();
    el._release(0.3, 1);
    vi.advanceTimersByTime(COVER_PENDING_TIMEOUT_MS + 1);
    expect(el._pending).toBeNull();
    expect(fill(el)).toBe("1");
  });

  it("keeps the dragged position when the cover reports its travel later than the default timeout", () => {
    // Behaviour fix (step 5): a late `closing` (slow Shelly) must not let the handle swing back first.
    const el = create();
    el._release(0.3, 1);
    el._update();
    vi.advanceTimersByTime(PENDING_TIMEOUT_MS + 500);
    el._update();
    expect(fill(el)).toBe("0.3");
    report(el, "closing", { current_position: 100 });
    expect(fill(el)).toBe("0.3");
    expect(el._pending).not.toBeNull();
  });

  it("clears the timer when the card is removed", () => {
    const el = create();
    el._release(0.3, 1);
    report(el, "closing", { current_position: 100 });
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});

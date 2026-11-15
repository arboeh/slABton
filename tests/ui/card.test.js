import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../src/ui/slabton-card.js";
import { MIN_CALL_INTERVAL_MS, PENDING_TIMEOUT_MS, SlabtonCard } from "../../src/ui/slabton-card.js";
import { createHass, makeState, mockRect, pointer, withState } from "../helpers/mock-hass.js";

const SELECT = "input_select.mode";
const selectState = (state = "auto") => makeState(SELECT, state, { options: ["off", "auto", "on", "idle"] });

function create(config, states) {
  const el = document.createElement("slabton-card");
  const hass = createHass(states ?? { [SELECT]: selectState() });
  el.setConfig({ type: "custom:slabton-card", entity: SELECT, ...config });
  el.hass = hass;
  document.body.appendChild(el);
  // jsdom >= 31 schedules a one-off timer for the stylesheet in the shadow root; flush it
  // so vi.getTimerCount() only counts timers started by the card itself.
  vi.advanceTimersByTime(0);
  return { el, hass };
}

const q = (el, selector) => el.shadowRoot.querySelector(selector);
const tap = (target) => {
  pointer(target, "pointerdown");
  pointer(target, "pointerup");
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("registration", () => {
  it("defines the elements and registers in customCards", () => {
    expect(customElements.get("slabton-card")).toBe(SlabtonCard);
    expect(customElements.get("slabton-card-editor")).toBeDefined();
    expect(window.customCards.filter((c) => c.type === "slabton-card")).toHaveLength(1);
  });

  it("provides a stub config and editor element", () => {
    const stub = SlabtonCard.getStubConfig({ states: { "sensor.a": {}, "switch.b": {} } });
    expect(stub).toEqual({ type: "custom:slabton-card", entity: "switch.b" });
    expect(SlabtonCard.getStubConfig(undefined).entity).toBe("");
    expect(SlabtonCard.getConfigElement().tagName.toLowerCase()).toBe("slabton-card-editor");
  });
});

describe("setConfig", () => {
  it("throws readable errors for invalid configs", () => {
    const el = document.createElement("slabton-card");
    expect(() => el.setConfig({})).toThrow(/entity is required/);
    expect(() => el.setConfig({ entity: SELECT, handle_shape: "star" })).toThrow(/handle_shape/);
  });

  it("applies layout variables to the host", () => {
    const { el } = create({ thickness: 60, bar_color: "navy" });
    expect(el.style.getPropertyValue("--slabton-thickness")).toBe("60px");
    expect(el.style.getPropertyValue("--slabton-bar-color")).toBe("navy");
  });

  it("rebuilds cleanly on reconfiguration without duplicating handlers", () => {
    const { el, hass } = create({});
    el.setConfig({ type: "custom:slabton-card", entity: SELECT });
    tap(q(el, ".handle"));
    expect(hass.callService).toHaveBeenCalledTimes(1);
  });

  it("reports card size and grid options", () => {
    const { el } = create({});
    expect(el.getCardSize()).toBe(2);
    expect(el.getGridOptions().rows).toBe(2);
    el.setConfig({ entity: SELECT, orientation: "vertical" });
    expect(el.getCardSize()).toBe(4);
  });

  it("keeps card size and rows when the handle is not larger than the bar", () => {
    const { el } = create({ thickness: 48, handle_size: 48 });
    expect(el.getCardSize()).toBe(2);
    expect(el.getGridOptions().rows).toBe(2);
  });

  it("grows card size and rows for a handle larger than the bar", () => {
    const { el } = create({ thickness: 18, handle_size: 70 });
    expect(el.getGridOptions().rows).toBe(3);
    expect(el.getCardSize()).toBe(4);
    el.setConfig({ entity: SELECT, orientation: "vertical", thickness: 18, handle_size: 70 });
    expect(el.getGridOptions().rows).toBe(5);
    expect(el.getCardSize()).toBe(6);
  });

  it("does not change the shared grid defaults", () => {
    const { el } = create({ thickness: 18, handle_size: 70 });
    el.getGridOptions();
    el.setConfig({ entity: SELECT });
    expect(el.getGridOptions().rows).toBe(2);
  });
});

describe("unavailable entity", () => {
  const unavailable = (attributes = selectState().attributes) => ({ [SELECT]: makeState(SELECT, "unavailable", attributes) });
  const key = (target, name) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
  const watchMoreInfo = (el) => {
    const spy = vi.fn();
    el.addEventListener("hass-more-info", spy);
    return spy;
  };

  it("shows the hint: warning icon, reason as title and aria-valuetext", () => {
    const { el } = create({}, unavailable());
    expect(q(el, ".root").classList.contains("unavailable")).toBe(true);
    expect(q(el, ".h-icon").getAttribute("icon")).toBe("mdi:alert-circle-outline");
    expect(q(el, ".root").getAttribute("title")).toBe("Entity unavailable");
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("Entity unavailable");
  });

  it("names the reason: missing entity, unknown state", () => {
    expect(q(create({}, {}).el, ".root").getAttribute("title")).toBe("Entity not found");
    const unknown = { [SELECT]: makeState(SELECT, "unknown", selectState().attributes) };
    expect(q(create({}, unknown).el, ".root").getAttribute("title")).toBe("Entity state unknown");
  });

  it("names a value mode entity without a number as having no usable value", () => {
    const states = { "sensor.t": makeState("sensor.t", "abc") };
    expect(q(create({ entity: "sensor.t" }, states).el, ".root").getAttribute("title")).toBe("Entity has no usable value");
  });

  it("opens more-info on a tap instead of the tap action", () => {
    const { el, hass } = create({}, unavailable());
    const moreInfo = watchMoreInfo(el);
    tap(q(el, ".handle"));
    expect(moreInfo).toHaveBeenCalledTimes(1);
    expect(moreInfo.mock.calls[0][0].detail).toEqual({ entityId: SELECT });
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("opens more-info on Enter and ignores the arrow keys", () => {
    const { el, hass } = create({}, unavailable());
    const moreInfo = watchMoreInfo(el);
    key(q(el, ".handle"), "ArrowRight");
    key(q(el, ".handle"), "ArrowLeft");
    expect(hass.callService).not.toHaveBeenCalled();
    key(q(el, ".handle"), "Enter");
    expect(moreInfo).toHaveBeenCalledTimes(1);
  });

  it("ignores hold and double tap, and does not delay the tap for a double tap", () => {
    const action = { action: "perform-action", perform_action: "script.turn_on", target: { entity_id: "script.x" } };
    const { el, hass } = create({ hold_action: action, double_tap_action: action }, unavailable());
    const moreInfo = watchMoreInfo(el);
    // No hold timer runs, so a long press ends as a plain tap (more-info), never as the hold action.
    pointer(q(el, ".handle"), "pointerdown");
    vi.advanceTimersByTime(600);
    pointer(q(el, ".handle"), "pointerup");
    expect(hass.callService).not.toHaveBeenCalled();
    // A second tap right after the first is not held back for a double tap either.
    tap(q(el, ".handle"));
    expect(moreInfo).toHaveBeenCalledTimes(2);
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("only opens more-info in the other modes too", () => {
    const states = { "lock.front": makeState("lock.front", "unavailable") };
    const { el, hass } = create({ entity: "lock.front" }, states);
    const moreInfo = watchMoreInfo(el);
    tap(q(el, ".handle"));
    expect(moreInfo.mock.calls[0][0].detail).toEqual({ entityId: "lock.front" });
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("sends nothing when the entity became unavailable during a drag", () => {
    const { el, hass } = create({});
    const handle = q(el, ".handle");
    mockRect(q(el, ".rail"), { left: 0, width: 200 });
    pointer(handle, "pointerdown", { clientX: 20 });
    pointer(handle, "pointermove", { clientX: 180 });
    el.hass = withState(hass, SELECT, "unavailable", selectState().attributes);
    pointer(handle, "pointerup", { clientX: 180 });
    expect(hass.callService).not.toHaveBeenCalled();
    expect(q(el, ".root").classList.contains("dragging")).toBe(false);
  });

  it("goes back to normal operation when the entity returns", () => {
    const { el, hass } = create({}, unavailable());
    el.hass = withState(hass, SELECT, "auto", selectState().attributes);
    expect(q(el, ".root").hasAttribute("title")).toBe(false);
    expect(q(el, ".root").classList.contains("unavailable")).toBe(false);
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("auto");
    tap(q(el, ".handle"));
    expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "on" }, { entity_id: SELECT });
  });

  describe("separate switches on a locked card", () => {
    const withSwitch = (sw) => ({ switches: { start: sw } });
    const states = () => ({ ...unavailable(), "switch.a": makeState("switch.a", "on") });

    it("ignores a switch without its own entity that cycles the main entity", () => {
      const { el, hass } = create(withSwitch({ tap_action: { action: "cycle" } }), states());
      tap(q(el, ".sw-start"));
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("ignores a switch without its own entity that toggles the main entity", () => {
      const { el, hass } = create(withSwitch({ tap_action: { action: "toggle" } }), states());
      tap(q(el, ".sw-start"));
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("keeps a switch with its own entity operable", () => {
      const { el, hass } = create(withSwitch({ entity: "switch.a" }), states());
      tap(q(el, ".sw-start"));
      expect(hass.callService).toHaveBeenCalledWith("homeassistant", "toggle", { entity_id: "switch.a" }, undefined);
    });

    it("still cycles the main entity when the card is not locked", () => {
      const { el, hass } = create(withSwitch({ tap_action: { action: "cycle" } }));
      tap(q(el, ".sw-start"));
      expect(hass.callService).toHaveBeenCalledTimes(1);
    });
  });

  it("opens more-info for a single tap that was delayed for a double tap and fires after the entity became unavailable", () => {
    const action = { action: "perform-action", perform_action: "script.turn_on", target: { entity_id: "script.x" } };
    const { el, hass } = create({ double_tap_action: action });
    const moreInfo = watchMoreInfo(el);
    tap(q(el, ".handle"));
    el.hass = withState(hass, SELECT, "unavailable", selectState().attributes);
    vi.advanceTimersByTime(600);
    expect(hass.callService).not.toHaveBeenCalled();
    expect(moreInfo).toHaveBeenCalledTimes(1);
  });

  describe("with allow_unavailable_actions", () => {
    it("runs the tap action from an unknown state: the first state", () => {
      const { el, hass } = create({ allow_unavailable_actions: true }, unavailable());
      tap(q(el, ".handle"));
      expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "off" }, { entity_id: SELECT });
      expect(q(el, ".handle").getAttribute("aria-disabled")).toBe("false");
    });

    it("steps with the arrow keys and runs hold_reverse", () => {
      const { el, hass } = create({ allow_unavailable_actions: true, hold_reverse: true }, unavailable());
      key(q(el, ".handle"), "ArrowRight");
      expect(hass.callService).toHaveBeenCalledTimes(1);
      pointer(q(el, ".handle"), "pointerdown");
      vi.advanceTimersByTime(600);
      expect(hass.callService).toHaveBeenCalledTimes(2);
    });

    it("keeps the hint visible", () => {
      const { el } = create({ allow_unavailable_actions: true }, unavailable());
      expect(q(el, ".h-icon").getAttribute("icon")).toBe("mdi:alert-circle-outline");
      expect(q(el, ".root").getAttribute("title")).toBe("Entity unavailable");
    });

    it("sends nothing when the entity has no state list and no states are configured", () => {
      const { el, hass } = create({ allow_unavailable_actions: true }, unavailable({}));
      tap(q(el, ".handle"));
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("cycles configured states on a dead select", () => {
      const { el, hass } = create({ allow_unavailable_actions: true, states: ["low", "high"] }, unavailable({}));
      tap(q(el, ".handle"));
      expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "low" }, { entity_id: SELECT });
    });

    it("has no effect in lock mode: a tap only opens more-info", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const states = { "lock.front": makeState("lock.front", "unavailable") };
      const { el, hass } = create({ entity: "lock.front", allow_unavailable_actions: true }, states);
      const moreInfo = watchMoreInfo(el);
      tap(q(el, ".handle"));
      expect(moreInfo).toHaveBeenCalledTimes(1);
      expect(hass.callService).not.toHaveBeenCalled();
    });
  });
});

describe("state mode", () => {
  it("renders the current state", () => {
    const { el } = create({});
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe(String(1 / 3));
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("auto");
  });

  it("cycles to the next state on tap, optimistically", () => {
    const { el, hass } = create({});
    tap(q(el, ".handle"));
    expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "on" }, { entity_id: SELECT });
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("on");
    tap(q(el, ".handle"));
    expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "idle" }, { entity_id: SELECT });
  });

  it("drops the optimistic value once the entity reports a state", () => {
    const { el, hass } = create({});
    tap(q(el, ".handle"));
    el.hass = withState(hass, SELECT, "idle", selectState().attributes);
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("idle");
  });

  it("reverts the optimistic value after a timeout", () => {
    const { el } = create({});
    tap(q(el, ".handle"));
    vi.advanceTimersByTime(PENDING_TIMEOUT_MS + 1);
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("auto");
  });

  it("goes back on hold when hold_reverse is set", () => {
    const { el, hass } = create({ hold_reverse: true });
    pointer(q(el, ".handle"), "pointerdown");
    vi.advanceTimersByTime(600);
    expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "off" }, { entity_id: SELECT });
  });

  it("runs the double tap action instead of the tap action", () => {
    const { el, hass } = create({ double_tap_action: { action: "perform-action", perform_action: "script.turn_on", target: { entity_id: "script.x" } } });
    const handle = q(el, ".handle");
    tap(handle);
    vi.advanceTimersByTime(100);
    tap(handle);
    vi.advanceTimersByTime(1000);
    expect(hass.callService).toHaveBeenCalledTimes(1);
    expect(hass.callService).toHaveBeenCalledWith("script", "turn_on", {}, { entity_id: "script.x" });
  });

  it("snaps to the nearest state when dragged", () => {
    const { el, hass } = create({});
    mockRect(q(el, ".rail"), { left: 0, width: 200 });
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown", { clientX: 20 });
    pointer(handle, "pointermove", { clientX: 200 });
    expect(q(el, ".root").classList.contains("dragging")).toBe(true);
    pointer(handle, "pointerup", { clientX: 220 });
    expect(hass.callService).toHaveBeenCalledWith("input_select", "select_option", { option: "idle" }, { entity_id: SELECT });
    expect(q(el, ".root").classList.contains("dragging")).toBe(false);
  });

  it("supports keyboard stepping", () => {
    const { el, hass } = create({});
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    event.key = "ArrowLeft";
    q(el, ".handle").dispatchEvent(event);
    expect(hass.callService).toHaveBeenLastCalledWith("input_select", "select_option", { option: "off" }, { entity_id: SELECT });
  });
});

describe("lock mode", () => {
  const lockStates = (state) => ({ "lock.front": makeState("lock.front", state) });

  it("unlocks when swiped past the threshold", () => {
    const { el, hass } = create({ entity: "lock.front" }, lockStates("locked"));
    mockRect(q(el, ".rail"), { left: 0, width: 200 });
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown", { clientX: 20 });
    pointer(handle, "pointermove", { clientX: 200 });
    pointer(handle, "pointerup", { clientX: 200 });
    expect(hass.callService).toHaveBeenCalledWith("lock", "unlock", {}, { entity_id: "lock.front" });
    expect(handle.getAttribute("aria-checked")).toBe("true");
  });

  it("springs back below the threshold without a service call", () => {
    const { el, hass } = create({ entity: "lock.front" }, lockStates("locked"));
    mockRect(q(el, ".rail"), { left: 0, width: 200 });
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown", { clientX: 20 });
    pointer(handle, "pointermove", { clientX: 100 });
    pointer(handle, "pointerup", { clientX: 100 });
    expect(hass.callService).not.toHaveBeenCalled();
    expect(handle.getAttribute("aria-checked")).toBe("false");
    expect(q(el, ".root").style.getPropertyValue("--slabton-e")).toBe("0");
  });

  it("locks again by swiping back", () => {
    const { el, hass } = create({ entity: "lock.front" }, lockStates("unlocked"));
    mockRect(q(el, ".rail"), { left: 0, width: 200 });
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown", { clientX: 180 });
    pointer(handle, "pointermove", { clientX: 20 });
    pointer(handle, "pointerup", { clientX: 20 });
    expect(hass.callService).toHaveBeenCalledWith("lock", "lock", {}, { entity_id: "lock.front" });
  });

  it("opens more-info on tap by default", () => {
    const { el } = create({ entity: "lock.front" }, lockStates("locked"));
    const listener = vi.fn();
    el.addEventListener("hass-more-info", listener);
    tap(q(el, ".handle"));
    expect(listener.mock.calls[0][0].detail.entityId).toBe("lock.front");
  });

  it("ignores arrow keys so a stray key press cannot unlock", () => {
    const { el, hass } = create({ entity: "lock.front" }, lockStates("locked"));
    for (const key of ["ArrowRight", "ArrowLeft"]) {
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      event.key = key;
      q(el, ".handle").dispatchEvent(event);
    }
    expect(hass.callService).not.toHaveBeenCalled();
  });
});

describe("value mode", () => {
  const sensor = (state) => ({ "sensor.t": makeState("sensor.t", state) });

  it("fills the bar and shows the formatted value", () => {
    const { el } = create({ entity: "sensor.t", preset: "thermometer" }, sensor("15"));
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0.5");
    expect(q(el, ".h-text").textContent).toBe("15.0°C");
  });

  it("is not draggable", () => {
    const { el, hass } = create({ entity: "sensor.t" }, sensor("15"));
    mockRect(q(el, ".rail"), { left: 0, width: 200 });
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown", { clientX: 20 });
    pointer(handle, "pointermove", { clientX: 150 });
    pointer(handle, "pointerup", { clientX: 150 });
    expect(hass.callService).not.toHaveBeenCalled();
    expect(q(el, ".root").classList.contains("dragging")).toBe(false);
  });

  it("marks a sensor handle as not draggable", () => {
    const { el } = create({ entity: "sensor.t" }, sensor("15"));
    expect(q(el, ".root").classList.contains("nodrag")).toBe(true);
  });

  describe("settable entities", () => {
    const NUM = "input_number.v";
    const numStates = (state = "20", attrs = { min: 0, max: 100, step: 5 }) => ({ [NUM]: makeState(NUM, state, attrs) });
    const setup = (config = {}, states = numStates()) => {
      const made = create({ entity: NUM, decimals: 0, ...config }, states);
      mockRect(q(made.el, ".rail"), { left: 0, width: 200 });
      return made;
    };
    // The handle is 40px wide: its centre follows the pointer, so x = 20 + 200 * fraction.
    const dragTo = (el, x, release = true) => {
      const handle = q(el, ".handle");
      pointer(handle, "pointerdown", { clientX: 20 });
      pointer(handle, "pointermove", { clientX: x });
      if (release) pointer(handle, "pointerup", { clientX: x });
    };
    const key = (el, name) => {
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      event.key = name;
      q(el, ".handle").dispatchEvent(event);
    };

    it("sets the value on release, snapped to the step", () => {
      const { el, hass } = setup();
      dragTo(el, 120);
      expect(hass.callService).toHaveBeenCalledTimes(1);
      expect(hass.callService).toHaveBeenCalledWith("input_number", "set_value", { value: 50 }, { entity_id: NUM });
      expect(q(el, ".root").classList.contains("dragging")).toBe(false);
    });

    it("uses number.set_value for number entities", () => {
      const { el, hass } = setup({ entity: "number.v" }, { "number.v": makeState("number.v", "20", { min: 0, max: 100, step: 5 }) });
      dragTo(el, 220);
      expect(hass.callService).toHaveBeenCalledWith("number", "set_value", { value: 100 }, { entity_id: "number.v" });
    });

    it("shows the value under the finger without calling a service while dragging", () => {
      const { el, hass } = setup();
      dragTo(el, 120, false);
      expect(q(el, ".h-text").textContent).toBe("50");
      expect(q(el, ".root").classList.contains("dragging")).toBe(true);
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("keeps the new value until the entity reports it", () => {
      const { el, hass } = setup();
      dragTo(el, 120);
      expect(q(el, ".h-text").textContent).toBe("50");
      expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0.5");
      el.hass = withState(hass, NUM, "50", { min: 0, max: 100, step: 5 });
      expect(q(el, ".h-text").textContent).toBe("50");
    });

    it("falls back to the entity value when it never changes", () => {
      const { el } = setup();
      dragTo(el, 120);
      vi.advanceTimersByTime(PENDING_TIMEOUT_MS + 1);
      expect(q(el, ".h-text").textContent).toBe("20");
    });

    it("sends nothing when the value stays the same", () => {
      const { el, hass } = setup();
      dragTo(el, 60);
      expect(hass.callService).not.toHaveBeenCalled();
      expect(q(el, ".h-text").textContent).toBe("20");
    });

    it("does not drag with drag: false", () => {
      const { el, hass } = setup({ drag: false });
      dragTo(el, 120);
      expect(hass.callService).not.toHaveBeenCalled();
      expect(q(el, ".root").classList.contains("dragging")).toBe(false);
      expect(q(el, ".root").classList.contains("nodrag")).toBe(true);
    });

    it("does not drag while the entity is unavailable", () => {
      const { el, hass } = setup({}, numStates("unavailable"));
      dragTo(el, 120);
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("lets the config step override the entity step", () => {
      const { el, hass } = setup({ step: 20 });
      dragTo(el, 120);
      expect(hass.callService).toHaveBeenCalledWith("input_number", "set_value", { value: 60 }, { entity_id: NUM });
    });

    it("steps with the arrow keys", () => {
      const { el, hass } = setup();
      key(el, "ArrowRight");
      expect(hass.callService).toHaveBeenLastCalledWith("input_number", "set_value", { value: 25 }, { entity_id: NUM });
      expect(q(el, ".h-text").textContent).toBe("25");
      vi.advanceTimersByTime(MIN_CALL_INTERVAL_MS + 1);
      key(el, "ArrowLeft");
      expect(hass.callService).toHaveBeenLastCalledWith("input_number", "set_value", { value: 20 }, { entity_id: NUM });
    });

    it("ignores the arrow keys when dragging is off or the entity is a sensor", () => {
      const off = setup({ drag: false });
      key(off.el, "ArrowRight");
      expect(off.hass.callService).not.toHaveBeenCalled();
      const read = create({ entity: "sensor.t" }, sensor("15"));
      key(read.el, "ArrowRight");
      expect(read.hass.callService).not.toHaveBeenCalled();
    });

    it("sends one call per key press, not one per auto-repeat", () => {
      const { el, hass } = setup();
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      event.key = "ArrowRight";
      q(el, ".handle").dispatchEvent(event);
      for (let i = 0; i < 5; i += 1) {
        const repeat = new Event("keydown", { bubbles: true, cancelable: true });
        repeat.key = "ArrowRight";
        repeat.repeat = true;
        q(el, ".handle").dispatchEvent(repeat);
      }
      expect(hass.callService).toHaveBeenCalledTimes(1);
    });

    it("does not rewrite an off-grid value when the drag ends where it started", () => {
      const { el, hass } = setup({}, numStates("52"));
      dragTo(el, 120);
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("is not draggable with a separate bar entity", () => {
      const { el, hass } = setup({ bar: { entity: "sensor.other" } }, { ...numStates(), "sensor.other": makeState("sensor.other", "40") });
      dragTo(el, 220);
      key(el, "ArrowRight");
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("still opens more-info on tap", () => {
      const { el, hass } = setup();
      const listener = vi.fn();
      el.addEventListener("hass-more-info", listener);
      tap(q(el, ".handle"));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(hass.callService).not.toHaveBeenCalled();
    });

    it("warns once about an invalid entity range", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { el } = setup({}, numStates("5", { min: 20, max: 10 }));
      el.hass = withState(el.hass, NUM, "6", { min: 20, max: 10 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/maximum must be greater/));
    });
  });

  it("updates when the sensor changes", () => {
    const { el, hass } = create({ entity: "sensor.t" }, sensor("10"));
    el.hass = withState(hass, "sensor.t", "80");
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0.8");
  });
});

describe("actions", () => {
  it("throttles identical service calls", () => {
    const { el, hass } = create({ tap_action: { action: "perform-action", perform_action: "light.toggle", target: { entity_id: "light.a" } } });
    const handle = q(el, ".handle");
    tap(handle);
    tap(handle);
    expect(hass.callService).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MIN_CALL_INTERVAL_MS + 1);
    tap(handle);
    expect(hass.callService).toHaveBeenCalledTimes(2);
  });

  it("logs failed service calls", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { el, hass } = create({});
    hass.callService.mockReturnValueOnce(Promise.reject(new Error("boom")));
    tap(q(el, ".handle"));
    await vi.advanceTimersByTimeAsync(0);
    expect(error).toHaveBeenCalled();
  });

  it("opens only http(s) urls", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = create({ tap_action: { action: "url", url_path: "https://example.com" } });
    tap(q(ok.el, ".handle"));
    expect(open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    open.mockClear();
    const bad = create({ tap_action: { action: "url", url_path: "javascript:alert(1)" } });
    tap(q(bad.el, ".handle"));
    expect(open).not.toHaveBeenCalled();
  });

  it("navigates and notifies the frontend", () => {
    const { el } = create({ tap_action: { action: "navigate", navigation_path: "/lovelace/1" } });
    const listener = vi.fn();
    window.addEventListener("location-changed", listener);
    tap(q(el, ".handle"));
    window.removeEventListener("location-changed", listener);
    expect(window.location.pathname).toBe("/lovelace/1");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does nothing for the none action", () => {
    const { el, hass } = create({ tap_action: { action: "none" } });
    tap(q(el, ".handle"));
    expect(hass.callService).not.toHaveBeenCalled();
  });
});

describe("separate switches", () => {
  const states = { [SELECT]: selectState(), "switch.a": makeState("switch.a", "on") };

  it("toggles their own entity independent of the handle", () => {
    const { el, hass } = create({ switches: { start: { entity: "switch.a" } } }, states);
    tap(q(el, ".sw-start"));
    expect(hass.callService).toHaveBeenCalledTimes(1);
    expect(hass.callService).toHaveBeenCalledWith("homeassistant", "toggle", { entity_id: "switch.a" }, undefined);
  });

  it("shows the active state and follows updates", () => {
    const { el, hass } = create({ switches: { start: { entity: "switch.a" } } }, states);
    expect(q(el, ".sw-start").classList.contains("active")).toBe(true);
    el.hass = withState(hass, "switch.a", "off");
    expect(q(el, ".sw-start").classList.contains("active")).toBe(false);
  });
});

describe("hass updates", () => {
  it("skips re-rendering when no relevant entity changed", () => {
    const { el, hass } = create({});
    const update = vi.spyOn(el, "_update");
    el.hass = withState(hass, "light.unrelated", "on");
    expect(update).not.toHaveBeenCalled();
    el.hass = withState(el.hass, SELECT, "on", selectState().attributes);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("renders when hass arrives before the config", () => {
    const el = document.createElement("slabton-card");
    el.hass = createHass({ [SELECT]: selectState("on") });
    el.setConfig({ entity: SELECT });
    expect(q(el, ".handle").getAttribute("aria-valuetext")).toBe("on");
  });

  it("marks a missing entity as unavailable", () => {
    const { el } = create({}, {});
    expect(q(el, ".root").classList.contains("unavailable")).toBe(true);
  });
});

// --- counter, timer, clock --------------------------------------------------

const NOW = Date.UTC(2026, 0, 1, 12);
let pageHidden = false;

function stubVisibility() {
  beforeEach(() => {
    pageHidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => pageHidden });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    delete document.hidden;
  });
}

describe("counter mode", () => {
  stubVisibility();
  const COUNTER = "counter.visitors";
  const counterStates = (state = "3") => ({ [COUNTER]: makeState(COUNTER, state, { minimum: 0, maximum: 10 }) });

  it("shows the value and fills the bar", () => {
    const { el } = create({ entity: COUNTER }, counterStates());
    expect(q(el, ".h-text").textContent).toBe("3");
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0.3");
    expect(q(el, ".root").classList.contains("nodrag")).toBe(true);
  });

  it("increments on tap and decrements on double tap", () => {
    const { el, hass } = create({ entity: COUNTER }, counterStates());
    tap(q(el, ".handle"));
    vi.advanceTimersByTime(1000);
    expect(hass.callService).toHaveBeenCalledTimes(1);
    expect(hass.callService).toHaveBeenLastCalledWith("counter", "increment", {}, { entity_id: COUNTER });
    tap(q(el, ".handle"));
    vi.advanceTimersByTime(100);
    tap(q(el, ".handle"));
    vi.advanceTimersByTime(1000);
    expect(hass.callService).toHaveBeenLastCalledWith("counter", "decrement", {}, { entity_id: COUNTER });
  });

  it("warns once and keeps the bar empty when the range is not valid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const states = { [COUNTER]: makeState(COUNTER, "3", { minimum: 10, maximum: 10 }) };
    const { el, hass } = create({ entity: COUNTER }, states);
    el.hass = withState(hass, COUNTER, "4", { minimum: 10, maximum: 10 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/maximum must be greater than the minimum/);
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0");
  });

  it("does not tick", () => {
    create({ entity: COUNTER }, counterStates());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders bar_text placeholders", () => {
    const { el } = create({ entity: COUNTER, bar_text: "{value} of 10 {name}", name: "Guests" }, counterStates());
    expect(q(el, ".bar-text").textContent).toBe("3 of 10 Guests");
    expect(q(el, ".bar-text").hidden).toBe(false);
  });
});

describe("timer mode", () => {
  stubVisibility();
  const TIMER = "timer.sauna";
  const running = (ms) => makeState(TIMER, "active", {
    duration: "0:10:00", remaining: "0:10:00", finishes_at: new Date(NOW + ms).toISOString(),
  });
  const idleTimer = () => makeState(TIMER, "idle", { duration: "0:10:00", remaining: "0:10:00" });
  const text = (el) => q(el, ".h-text").textContent;

  it("counts down once per second", () => {
    const { el } = create({ entity: TIMER }, { [TIMER]: running(300000) });
    expect(text(el)).toBe("5:00");
    vi.advanceTimersByTime(1000);
    expect(text(el)).toBe("4:59");
    vi.advanceTimersByTime(59000);
    expect(text(el)).toBe("4:00");
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0.4");
  });

  it("ticks only while counting, connected and visible", () => {
    const { el, hass } = create({ entity: TIMER }, { [TIMER]: running(300000) });
    expect(vi.getTimerCount()).toBe(1);

    pageHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);
    pageHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(1);

    el.hass = withState(hass, TIMER, "paused", { duration: "0:10:00", remaining: "0:04:00" });
    expect(vi.getTimerCount()).toBe(0);
    expect(text(el)).toBe("4:00");
    el.hass = { ...hass, states: { [TIMER]: running(300000) } };
    expect(vi.getTimerCount()).toBe(1);

    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts the tick when reconnected and never leaks on reconfiguration", () => {
    const { el } = create({ entity: TIMER }, { [TIMER]: running(300000) });
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.appendChild(el);
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(1);
    el.setConfig({ type: "custom:slabton-card", entity: TIMER });
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(1);
    el.setConfig({ type: "custom:slabton-card", entity: SELECT });
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not tick for an idle timer and makes no service calls on its own", () => {
    const { hass } = create({ entity: TIMER }, { [TIMER]: idleTimer() });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("pulses when the timer runs out and ends the pulse after pulse_seconds", () => {
    const { el } = create({ entity: TIMER, timer: { pulse_seconds: 5 } }, { [TIMER]: running(3000) });
    const root = q(el, ".root");
    vi.advanceTimersByTime(2000);
    expect(root.classList.contains("expired")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(root.classList.contains("expired")).toBe(true);
    expect(text(el)).toBe("Expired");
    vi.advanceTimersByTime(4000);
    expect(root.classList.contains("expired")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(root.classList.contains("expired")).toBe(false);
    vi.advanceTimersByTime(30000);
    expect(root.classList.contains("expired")).toBe(false);
  });

  it("pulses when Home Assistant reports the end first", () => {
    const { el, hass } = create({ entity: TIMER }, { [TIMER]: running(3000) });
    vi.setSystemTime(NOW + 3000);
    el.hass = withState(hass, TIMER, "idle", { duration: "0:10:00", remaining: "0:10:00" });
    expect(q(el, ".root").classList.contains("expired")).toBe(true);
  });

  it("does not pulse for a cancelled timer", () => {
    const { el, hass } = create({ entity: TIMER }, { [TIMER]: running(300000) });
    vi.advanceTimersByTime(1000);
    el.hass = withState(hass, TIMER, "idle", { duration: "0:10:00", remaining: "0:10:00" });
    vi.advanceTimersByTime(5000);
    expect(q(el, ".root").classList.contains("expired")).toBe(false);
  });

  it("does not pulse when pulse is off or when loaded already expired", () => {
    const off = create({ entity: TIMER, timer: { pulse: false } }, { [TIMER]: running(2000) });
    vi.advanceTimersByTime(5000);
    expect(q(off.el, ".root").classList.contains("expired")).toBe(false);
    const late = create({ entity: TIMER }, { [TIMER]: running(-5000) });
    expect(q(late.el, ".root").classList.contains("expired")).toBe(false);
  });

  it("stays on until a tap when pulse_seconds is 0, and the tap only ends the pulse", () => {
    const { el, hass } = create({ entity: TIMER, timer: { pulse_seconds: 0 } }, { [TIMER]: running(1000) });
    vi.advanceTimersByTime(60000);
    const root = q(el, ".root");
    expect(root.classList.contains("expired")).toBe(true);
    tap(q(el, ".handle"));
    expect(root.classList.contains("expired")).toBe(false);
    expect(hass.callService).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60000);
    expect(root.classList.contains("expired")).toBe(false);
  });

  it("pulses again for the next run", () => {
    const { el, hass } = create({ entity: TIMER, timer: { pulse_seconds: 2 } }, { [TIMER]: running(1000) });
    vi.advanceTimersByTime(1000);
    expect(q(el, ".root").classList.contains("expired")).toBe(true);
    el.hass = withState(hass, TIMER, "idle", { duration: "0:10:00", remaining: "0:10:00" });
    vi.advanceTimersByTime(5000);
    expect(q(el, ".root").classList.contains("expired")).toBe(false);
    el.hass = { ...hass, states: { [TIMER]: makeState(TIMER, "active", {
      duration: "0:10:00", remaining: "0:10:00", finishes_at: new Date(Date.now() + 2000).toISOString(),
    }) } };
    vi.advanceTimersByTime(2000);
    expect(q(el, ".root").classList.contains("expired")).toBe(true);
  });

  it("starts, pauses and cancels the Home Assistant timer", () => {
    const { el, hass } = create({ entity: TIMER }, { [TIMER]: idleTimer() });
    tap(q(el, ".handle"));
    expect(hass.callService).toHaveBeenLastCalledWith("timer", "start", {}, { entity_id: TIMER });
    el.hass = withState(hass, TIMER, "active", running(300000).attributes);
    vi.advanceTimersByTime(MIN_CALL_INTERVAL_MS + 1);
    tap(q(el, ".handle"));
    expect(hass.callService).toHaveBeenLastCalledWith("timer", "pause", {}, { entity_id: TIMER });
    pointer(q(el, ".handle"), "pointerdown");
    vi.advanceTimersByTime(600);
    expect(hass.callService).toHaveBeenLastCalledWith("timer", "cancel", {}, { entity_id: TIMER });
  });

  it("renders bar_text and info with translated placeholders", () => {
    const el = document.createElement("slabton-card");
    el.setConfig({
      type: "custom:slabton-card", entity: TIMER, bar_text: "noch {remaining_text}", timer: { info: "{state}" },
    });
    el.hass = createHass({ [TIMER]: running(180000) }, { locale: { language: "de-DE" } });
    document.body.appendChild(el);
    expect(q(el, ".bar-text").textContent).toBe("noch 3 Minuten");
    expect(q(el, ".info").textContent).toBe("Läuft");
  });

  it("counts down to an input_datetime in the Home Assistant time zone", () => {
    const id = "input_datetime.fest";
    const el = document.createElement("slabton-card");
    el.setConfig({ type: "custom:slabton-card", entity: id, mode: "timer" });
    // 13:00 Berlin = 12:00 UTC = NOW + 1 day (2026-01-02).
    el.hass = createHass({ [id]: makeState(id, "2026-01-02 13:00:00", { has_date: true, has_time: true }) }, {
      config: { time_zone: "Europe/Berlin" },
    });
    document.body.appendChild(el);
    expect(text(el)).toBe("1 d");
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("reads the view without advancing the pulse tracking; only an update tracks", () => {
    const { el } = create({ entity: TIMER }, { [TIMER]: running(3000) });
    const track = vi.spyOn(el, "_advance");
    el._view(NOW + 5000);
    expect(track).not.toHaveBeenCalled();
    expect(el._pulse.until).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(track).toHaveBeenCalled();
    expect(q(el, ".root").classList.contains("expired")).toBe(true);
  });

  it("warns once about a countdown target without a date", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const id = "input_datetime.t";
    const { el, hass } = create({ entity: id, mode: "timer" }, { [id]: makeState(id, "18:00:00", { has_date: false }) });
    el.hass = withState(hass, id, "19:00:00", { has_date: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/without a date/);
    expect(q(el, ".root").classList.contains("unavailable")).toBe(true);
  });
});

describe("clock mode", () => {
  stubVisibility();
  const clock = (config = {}) => create(
    { entity: undefined, mode: "clock", clock: { time_zone: "UTC", hour_format: "24", ...config } },
    {},
  );

  it("works without an entity and shows the time", () => {
    const { el } = clock();
    expect(q(el, ".h-text").textContent).toBe("12:00");
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0.5");
    expect(q(el, ".handle").getAttribute("aria-label")).toBe("slABton");
  });

  it("advances every second", () => {
    const { el } = clock({ seconds: true });
    expect(q(el, ".h-text").textContent).toBe("12:00:00");
    vi.advanceTimersByTime(1000);
    expect(q(el, ".h-text").textContent).toBe("12:00:01");
    vi.advanceTimersByTime(59000);
    expect(q(el, ".h-text").textContent).toBe("12:01:00");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops ticking when removed and does nothing on tap", () => {
    const { el, hass } = clock();
    tap(q(el, ".handle"));
    expect(hass.callService).not.toHaveBeenCalled();
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("separate bar value", () => {
  const SENSOR = "sensor.t";
  const states = () => ({ [SELECT]: selectState("on"), [SENSOR]: makeState(SENSOR, "50") });

  it("fills the bar from bar.entity while the handle follows the entity", () => {
    const { el, hass } = create({ bar: { entity: SENSOR, min: 0, max: 200 } }, states());
    const root = q(el, ".root");
    expect(root.style.getPropertyValue("--slabton-p")).toBe("0.25");
    expect(root.style.getPropertyValue("--slabton-e")).toBe(String(2 / 3));
    el.hass = withState(hass, SENSOR, "100");
    expect(root.style.getPropertyValue("--slabton-p")).toBe("0.5");
  });

  it("offers the bar value as {value}", () => {
    const { el } = create({ bar_text: "{value}", bar: { entity: SENSOR, unit: "W", decimals: 0 } }, states());
    expect(q(el, ".bar-text").textContent).toBe("50 W");
  });

  it("empties the bar when the bar entity is missing", () => {
    const { el } = create({ bar: { entity: SENSOR } }, { [SELECT]: selectState("on") });
    expect(q(el, ".root").style.getPropertyValue("--slabton-p")).toBe("0");
  });
});

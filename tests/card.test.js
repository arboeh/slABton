import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/slabton-card.js";
import { MIN_CALL_INTERVAL_MS, PENDING_TIMEOUT_MS, SlabtonCard } from "../src/slabton-card.js";
import { createHass, makeState, mockRect, pointer, withState } from "./helpers/mock-hass.js";

const SELECT = "input_select.mode";
const selectState = (state = "auto") => makeState(SELECT, state, { options: ["off", "auto", "on", "idle"] });

function create(config, states) {
  const el = document.createElement("slabton-card");
  const hass = createHass(states ?? { [SELECT]: selectState() });
  el.setConfig({ type: "custom:slabton-card", entity: SELECT, ...config });
  el.hass = hass;
  document.body.appendChild(el);
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

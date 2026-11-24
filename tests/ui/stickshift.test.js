import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../src/ui/slabton-card.js";
import { normalizeConfig } from "../../src/core/config.js";
import { SlabtonCardEditor, buildSchema, validationHints } from "../../src/ui/editor.js";
import { buildCss, buildVars, handleOverhang } from "../../src/ui/styles.js";
import { createHass, makeState, mockRect, pointer, withState } from "../helpers/mock-hass.js";

if (!customElements.get("slabton-card-editor")) customElements.define("slabton-card-editor", SlabtonCardEditor);

const SELECT = "input_select.mode";
const OPTIONS = ["off", "auto", "on", "idle"];
const selectState = (state = "auto", options = OPTIONS) => makeState(SELECT, state, { options });
const SCRIPT = { action: "perform-action", perform_action: "script.turn_on", target: { entity_id: "script.go" } };

const base = { entity: SELECT, mode: "state" };
const withSx = (extra = {}, sx = true) => normalizeConfig({ ...base, stickshift: sx, ...extra });

describe("stickshift config", () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("is off without the option, with false and with enabled: false", () => {
    expect(normalizeConfig(base).stickshift).toBeNull();
    expect(withSx({}, false).stickshift).toBeNull();
    expect(withSx({}, { enabled: false }).stickshift).toBeNull();
  });

  it("true gives the defaults (point 80 % of the handle, thin visible gate)", () => {
    expect(withSx().stickshift).toEqual({
      shape: "round",
      point_size: 32,
      point_opacity: 0.55,
      active_color: null,
      gate: { visible: true, size: 4, color: null },
    });
    expect(withSx({ handle_size: 50 }).stickshift.point_size).toBe(40);
  });

  it("accepts a map with options and turns on by its presence", () => {
    const sx = withSx({}, {
      shape: "square", point_size: 20, point_opacity: 0.5, active_color: "red",
      gate: { size: 6, color: "gray" },
    }).stickshift;
    expect(sx).toEqual({
      shape: "square", point_size: 20, point_opacity: 0.5, active_color: "red",
      gate: { visible: true, size: 6, color: "gray" },
    });
  });

  it("limits the point size to the handle and the opacity to 0..1", () => {
    const sx = withSx({ handle_size: 40 }, { point_size: 90, point_opacity: 7 }).stickshift;
    expect(sx.point_size).toBe(40);
    expect(sx.point_opacity).toBe(1);
    expect(withSx({}, { point_size: 1 }).stickshift.point_size).toBe(8);
  });

  it("rejects an unknown shape and a non-map value", () => {
    expect(() => withSx({}, { shape: "star" })).toThrow(/shape/);
    expect(() => withSx({}, "yes")).toThrow(/stickshift/);
  });

  it("supports gate false", () => {
    expect(withSx({}, { gate: false }).stickshift.gate.visible).toBe(false);
    expect(withSx({}, { gate: { visible: false } }).stickshift.gate.visible).toBe(false);
    expect(withSx({}, { pill: true }).stickshift.pill).toBeUndefined();
  });

  it("ignores unsafe colors with a warning", () => {
    const sx = withSx({}, { active_color: "red; x", gate: { color: "url(http://x)" } }).stickshift;
    expect(sx.active_color).toBeNull();
    expect(sx.gate.color).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("is ignored with a warning outside the state mode", () => {
    const config = normalizeConfig({ entity: "sensor.a", mode: "value", stickshift: true });
    expect(config.stickshift).toBeNull();
    expect(warnSpy.mock.calls.flat().join(" ")).toMatch(/stickshift/);
  });

  it("is ignored with a warning when the bar measures an own attribute", () => {
    const config = withSx({ bar: { attribute: "temperature" } });
    expect(config.stickshift).toBeNull();
    expect(warnSpy.mock.calls.flat().join(" ")).toMatch(/stickshift/);
  });

  it("is ignored with a warning for a single configured state", () => {
    const config = withSx({ states: ["off"] });
    expect(config.stickshift).toBeNull();
    expect(warnSpy.mock.calls.flat().join(" ")).toMatch(/at least two/);
  });

  it("warns when the points do not fit the configured length", () => {
    withSx({ length: 100, states: ["a", "b", "c", "d"] });
    expect(warnSpy.mock.calls.flat().join(" ")).toMatch(/do not fit/);
    warnSpy.mockClear();
    withSx({ length: 300, states: ["a", "b", "c", "d"] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("forces a flexible handle with a warning", () => {
    const config = withSx({ handle_position: "fixed" });
    expect(config.handle_position).toBe("flex");
    expect(warnSpy.mock.calls.flat().join(" ")).toMatch(/handle_position/);
    expect(withSx().handle_position).toBe("flex");
  });

  it("keeps the actions of a state, with an own entity, when stickshift is on", () => {
    const config = withSx({
      states: [
        { value: "off" },
        { value: "on", tap_action: SCRIPT, double_tap_action: { action: "more-info", entity: "light.a" }, hold_action: { action: "toggle", entity: "light.b" } },
      ],
    });
    expect(config.states[0].tap_action).toBeUndefined();
    expect(config.states[1].tap_action.perform_action).toBe("script.turn_on");
    expect(config.states[1].double_tap_action).toEqual({ action: "more-info", entity: "light.a" });
    expect(config.states[1].hold_action).toEqual({ action: "toggle", entity: "light.b" });
  });

  it("does not add action keys to states without stickshift", () => {
    const config = normalizeConfig({ ...base, states: [{ value: "on", tap_action: SCRIPT }] });
    expect(Object.keys(config.states[0]).sort()).toEqual(["color", "icon", "label", "text", "value"]);
  });

  it("rejects a malformed point action", () => {
    expect(() => withSx({ states: [{ value: "a", tap_action: { foo: 1 } }, "b"] })).toThrow(/tap_action/);
  });
});

describe("stickshift styles", () => {
  it("sets the point and gate variables", () => {
    const vars = buildVars(withSx({}, {
      point_size: 24, point_opacity: 0.5, gate: { size: 6, color: "gray" },
    }));
    expect(vars["--slabton-sx-d"]).toBe("24px");
    expect(vars["--slabton-sx-opacity"]).toBe("0.5");
    expect(vars["--slabton-sx-gate-size"]).toBe("6px");
    expect(vars["--slabton-sx-gate-color"]).toBe("gray");
  });

  it("sets no stickshift variable without stickshift and no color variables when unset", () => {
    expect(Object.keys(buildVars(normalizeConfig(base))).some((key) => key.includes("-sx-"))).toBe(false);
    const vars = buildVars(withSx());
    expect(vars["--slabton-sx-gate-color"]).toBeUndefined();
  });

  it("lets a styles: override win", () => {
    const vars = buildVars(withSx({ styles: { "--slabton-sx-d": "10px" } }));
    expect(vars["--slabton-sx-d"]).toBe("10px");
  });

  it("has rules for points and gate on the handle-centre track", () => {
    const css = buildCss();
    for (const part of [".sx-pt", ".sx-seg", ".sx-on .bar", ".sx-on .fill-clip", ".sx-pt:focus-visible", "prefers-reduced-motion"]) {
      expect(css).toContain(part);
    }
  });

  it("keeps inactive points readable: opacity 0.55 on the frame, icon and text pulled toward the text color", () => {
    const css = buildCss();
    expect(css).toContain("--slabton-sx-o: var(--slabton-sx-opacity, 0.55);");
    // The opacity dims ring and background, not the whole button (icon and text stay near full strength).
    expect(css).not.toMatch(/\.sx-pt \{[^}]*[^-]opacity: var\(--slabton-sx-opacity/);
    expect(css).toMatch(/\.sx-pt \{[^}]*border: 1px solid color-mix\(in srgb, [^;]*calc\(var\(--slabton-sx-o\) \* 80%\), transparent\)/);
    expect(css).toMatch(/\.sx-pt ha-icon, \.sx-pt \.sx-text \{ color: color-mix\(in srgb, var\(--slabton-sx-c, [^;]*\) 60%, [^;]*\); opacity: min\(1, calc\(var\(--slabton-sx-o\) \+ 0\.45\)\); \}/);
  });

  it("makes the gate clearly visible (50 % of the text color) and lets hover and focus win over rest", () => {
    const css = buildCss();
    expect(css).toMatch(/\.sx-seg \{[^}]*color-mix\(in srgb, [^;]* 50%, transparent\)/);
    expect(css).toMatch(/\.sx-pt:hover \{ --slabton-sx-o: min\(1, calc\(var\(--slabton-sx-opacity, 0\.55\) \+ 0\.35\)\); \}/);
    expect(css).toMatch(/\.sx-pt:focus-visible \{ --slabton-sx-o: 1;/);
  });

  it("cuts the gate along the outline of round and oval points and straight at square points", () => {
    const css = buildCss();
    // Round and oval: the segment runs centre to centre and a mask (two ellipses, intersected) follows each point's outline.
    expect(css).toMatch(/\.o-h \.sxs-round \.sx-seg, \.o-h \.sxs-oval \.sx-seg \{[^}]*radial-gradient\(ellipse[^}]*mask-composite: intersect/);
    expect(css).toMatch(/\.o-v \.sxs-round \.sx-seg, \.o-v \.sxs-oval \.sx-seg \{[^}]*radial-gradient\(ellipse[^}]*mask-composite: intersect/);
    // Square: no mask, the segment stops at the point's edge with a straight cut (no rounded ends).
    expect(css).toMatch(/\.o-h \.sxs-square \.sx-seg \{ left: calc\([^;]*var\(--slabton-sx-pl\) \/ 2\)/);
    expect(css).not.toMatch(/\.sx-seg \{[^}]*border-radius/);
  });

  it("rings the active handle in the icon color (pulled toward the text color)", () => {
    expect(buildCss()).toMatch(/\.root\.sx-on \.handle \{ border: 2px solid color-mix\(in srgb, var\(--slabton-sx-ring, transparent\) 60%, /);
  });
});

describe("stickshift oval overhang", () => {
  it("keeps the track in by the excess of an oval point, and leaves round and square points alone", () => {
    const oval = withSx({ stickshift: { shape: "oval", point_size: 32 } });
    const round = withSx({ stickshift: { shape: "round", point_size: 32 } });
    // (1.6 - 1) * 32 / 2 = 9.6 px; a vertical track sets in by the same amount along the bar.
    expect(handleOverhang(oval)).toBeCloseTo(9.6, 5);
    expect(handleOverhang(withSx({ orientation: "vertical", stickshift: { shape: "oval", point_size: 32 } }))).toBeCloseTo(9.6, 5);
    expect(handleOverhang(withSx({ stickshift: { shape: "square", point_size: 32 } }))).toBe(handleOverhang(withSx({ stickshift: false }, false)));
    expect(handleOverhang(round)).toBe(handleOverhang(withSx({ stickshift: false }, false)));
  });
});

describe("stickshift card", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function create(config = {}, state = selectState()) {
    const el = document.createElement("slabton-card");
    const hass = createHass({ [SELECT]: state });
    el.setConfig({ type: "custom:slabton-card", entity: SELECT, stickshift: true, ...config });
    el.hass = hass;
    document.body.appendChild(el);
    vi.advanceTimersByTime(0);
    return { el, hass };
  }
  const q = (el, selector) => el.shadowRoot.querySelector(selector);
  const points = (el) => [...el.shadowRoot.querySelectorAll(".sx-pt")];
  const tap = (target) => {
    pointer(target, "pointerdown");
    pointer(target, "pointerup");
  };
  const selected = (hass) => hass.callService.mock.calls.filter(([d, s]) => d === "input_select" && s === "select_option").map((c) => c[2].option);

  it("renders no stickshift layer without the option", () => {
    const { el } = create({ stickshift: undefined });
    expect(q(el, ".sx")).toBeNull();
    expect(points(el)).toHaveLength(0);
  });

  it("renders one button per state, evenly spread on the track", () => {
    const { el } = create();
    const buttons = points(el);
    expect(buttons).toHaveLength(4);
    expect(buttons.every((b) => b.tagName === "BUTTON" && b.getAttribute("type") === "button")).toBe(true);
    const e = buttons.map((b) => Number(b.style.getPropertyValue("--slabton-sx-e")));
    [0, 1 / 3, 2 / 3, 1].forEach((expected, i) => expect(e[i]).toBeCloseTo(expected, 3));
  });

  it("drops the bar in stickshift mode and keeps it without", () => {
    expect(q(create().el, ".root").classList.contains("sx-on")).toBe(true);
    expect(q(create({ stickshift: undefined }).el, ".root").classList.contains("sx-on")).toBe(false);
  });

  it("draws the gate as one segment between each two neighbouring points (n - 1), not behind the points", () => {
    const { el } = create();
    const segs = [...el.shadowRoot.querySelectorAll(".sx .sx-seg")];
    expect(segs).toHaveLength(3);
    segs.forEach((seg, i) => {
      expect(Number(seg.style.getPropertyValue("--slabton-sx-a"))).toBeCloseTo(i / 3, 3);
      expect(Number(seg.style.getPropertyValue("--slabton-sx-b"))).toBeCloseTo((i + 1) / 3, 3);
    });
  });

  it("mirrors the gate segments with direction rtl (a < b stays true)", () => {
    const { el } = create({ direction: "rtl" });
    const segs = [...el.shadowRoot.querySelectorAll(".sx-seg")];
    expect(segs).toHaveLength(3);
    segs.forEach((seg) => {
      expect(Number(seg.style.getPropertyValue("--slabton-sx-a"))).toBeLessThan(Number(seg.style.getPropertyValue("--slabton-sx-b")));
    });
  });

  it("omits the gate with gate.visible false", () => {
    expect(q(create({ stickshift: { gate: { visible: false } } }).el, ".sx-seg")).toBeNull();
  });

  it("mirrors the points for rtl and runs vertical upwards, like the handle", () => {
    const rtl = points(create({ direction: "rtl" }).el).map((b) => Number(b.style.getPropertyValue("--slabton-sx-e")));
    expect(rtl[0]).toBeCloseTo(1, 3);
    expect(rtl[3]).toBeCloseTo(0, 3);
    const vertical = points(create({ orientation: "vertical" }).el).map((b) => Number(b.style.getPropertyValue("--slabton-sx-e")));
    expect(vertical[0]).toBeCloseTo(1, 3);
    expect(vertical[3]).toBeCloseTo(0, 3);
  });

  it("puts the handle exactly on the active point", () => {
    const { el, hass } = create();
    const edge = () => Number(q(el, ".root").style.getPropertyValue("--slabton-e"));
    expect(edge()).toBeCloseTo(1 / 3, 3);
    el.hass = withState(hass, SELECT, "idle");
    expect(edge()).toBeCloseTo(1, 3);
  });

  it.each([2, 3, 4, 6])("spreads %i states evenly", (count) => {
    const options = Array.from({ length: count }, (_, i) => `s${i}`);
    const { el } = create({}, selectState("s0", options));
    const e = points(el).map((b) => Number(b.style.getPropertyValue("--slabton-sx-e")));
    expect(e).toHaveLength(count);
    e.forEach((value, i) => expect(value).toBeCloseTo(i / (count - 1), 3));
  });

  it("marks the active point and shows icon, text or value on the points", () => {
    const { el } = create({ states: [{ value: "off", icon: "mdi:power", color: "gray" }, { value: "auto", label: "Auto" }, { value: "on", text: "ON" }, "idle"] });
    const buttons = points(el);
    expect(buttons[1].getAttribute("aria-current")).toBe("true");
    expect(buttons[1].classList.contains("active")).toBe(true);
    expect(buttons[0].hasAttribute("aria-current")).toBe(false);
    expect(buttons[0].querySelector("ha-icon").getAttribute("icon")).toBe("mdi:power");
    expect(buttons[0].querySelector("ha-icon").style.getPropertyValue("--slabton-sx-c")).toBe("gray");
    expect(buttons[1].querySelector(".sx-text").style.getPropertyValue("--slabton-sx-c")).toBe("");
    expect(buttons[1].textContent.trim()).toBe("Auto");
    expect(buttons[2].textContent.trim()).toBe("ON");
    expect(buttons[3].textContent.trim()).toBe("idle");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["off", "Auto", "on", "idle"]);
  });

  it("colors the handle icon with active_color, else with the state color", () => {
    const states = [{ value: "off", icon: "mdi:power" }, { value: "auto", icon: "mdi:auto-fix", color: "green" }, "on", "idle"];
    const own = create({ states, stickshift: { active_color: "red" } }).el;
    expect(q(own, ".h-icon").style.color).toBe("red");
    const fallback = create({ states }).el;
    expect(q(fallback, ".h-icon").style.color).toBe("green");
  });

  it("rings the active handle in the icon color and drops the ring without a color or without stickshift", () => {
    const ring = (el) => q(el, ".handle").style.getPropertyValue("--slabton-sx-ring");
    const states = [{ value: "off", icon: "mdi:power" }, { value: "auto", icon: "mdi:auto-fix", color: "green" }, "on", "idle"];
    expect(ring(create({ states }).el)).toBe("green");
    expect(ring(create({ states, stickshift: { active_color: "red" } }).el)).toBe("red");
    // Active point without a color: no ring variable (the CSS keeps a faint ring in the text color).
    expect(ring(create({ states }, selectState("off")).el)).toBe("");
    // Not a stickshift card: nothing is set, even though the entity has a state color.
    expect(ring(create({ stickshift: undefined, states }).el)).toBe("");
  });

  it("rebuilds the points when the entity's options change", () => {
    const { el, hass } = create();
    expect(points(el)).toHaveLength(4);
    el.hass = withState(hass, SELECT, "auto", { options: ["a", "auto", "b"] });
    expect(points(el)).toHaveLength(3);
  });

  it("jumps straight to the tapped point (0 to 3) without further actions", () => {
    const { el, hass } = create({}, selectState("off"));
    tap(points(el)[3]);
    expect(selected(hass)).toEqual(["idle"]);
    expect(hass.callService).toHaveBeenCalledTimes(1);
  });

  it("changes the state first and then runs the tap action of the tapped point", () => {
    const { el, hass } = create({ states: ["off", "auto", { value: "on", tap_action: SCRIPT }, "idle"] });
    tap(points(el)[2]);
    const order = hass.callService.mock.calls.map(([domain]) => domain);
    expect(order).toEqual(["input_select", "script"]);
    expect(hass.callService.mock.calls[1][3]).toEqual({ entity_id: "script.go" });
  });

  it("runs only the own action when the active handle is tapped, no state change", () => {
    const { el, hass } = create({ states: ["off", { value: "auto", tap_action: SCRIPT }, "on", "idle"] });
    tap(q(el, ".handle"));
    expect(selected(hass)).toEqual([]);
    expect(hass.callService).toHaveBeenCalledWith("script", "turn_on", {}, { entity_id: "script.go" });
  });

  it("keeps the default (cycle) for the handle when the active point has no tap action", () => {
    const { el, hass } = create();
    tap(q(el, ".handle"));
    expect(selected(hass)).toEqual(["on"]);
  });

  it("runs the action of the point the handle is dragged onto", () => {
    const { el, hass } = create({ states: ["off", "auto", { value: "on", tap_action: SCRIPT }, "idle"] });
    mockRect(q(el, ".rail"), { left: 0, top: 0, width: 300, height: 48 });
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown", { clientX: 20 });
    pointer(handle, "pointermove", { clientX: 200 });
    pointer(handle, "pointerup", { clientX: 200 });
    expect(selected(hass)).toEqual(["on"]);
    expect(hass.callService).toHaveBeenCalledWith("script", "turn_on", {}, { entity_id: "script.go" });
  });

  it("ignores the double tap and hold actions of an inactive point (they only run on the active point)", () => {
    const double = { action: "perform-action", perform_action: "script.double" };
    const hold = { action: "perform-action", perform_action: "script.hold" };
    const { el, hass } = create({ states: ["off", "auto", { value: "on", double_tap_action: double, hold_action: hold }, "idle"] });
    const target = points(el)[2];
    pointer(target, "pointerdown");
    vi.advanceTimersByTime(600);
    pointer(target, "pointerup");
    // A long press without a hold action is a tap: the state changes, no hold action runs.
    expect(hass.callService).not.toHaveBeenCalledWith("script", "hold", {}, undefined);
    expect(selected(hass)).toEqual(["on"]);
    hass.callService.mockClear();
    const other = points(el)[3];
    tap(other);
    vi.advanceTimersByTime(400);
    expect(hass.callService).not.toHaveBeenCalledWith("script", "double", {}, undefined);
  });

  it("runs hold and double tap of the active point from the handle, not those of an inactive point", () => {
    const hold = (n) => ({ action: "perform-action", perform_action: `script.hold_${n}` });
    const double = { action: "perform-action", perform_action: "script.double_off" };
    const { el, hass } = create({
      states: [{ value: "off", hold_action: hold("off"), double_tap_action: double }, { value: "auto", hold_action: hold("auto") }, "on", "idle"],
    }, selectState("off"));
    const handle = q(el, ".handle");
    pointer(handle, "pointerdown");
    vi.advanceTimersByTime(600);
    pointer(handle, "pointerup");
    expect(hass.callService).toHaveBeenCalledWith("script", "hold_off", {}, undefined);
    hass.callService.mockClear();
    tap(handle);
    tap(handle);
    expect(hass.callService).toHaveBeenCalledWith("script", "double_off", {}, undefined);
    hass.callService.mockClear();
    const inactive = points(el)[1];
    pointer(inactive, "pointerdown");
    vi.advanceTimersByTime(600);
    pointer(inactive, "pointerup");
    expect(hass.callService).not.toHaveBeenCalledWith("script", "hold_auto", {}, undefined);
  });

  it("shows the state of a point's own entity on the point and, while active, on the handle (like handle_zones)", () => {
    const FLAG = "input_boolean.flag";
    const states = [
      { value: "off", icon: "mdi:power", entity: FLAG, states: [{ value: "on", icon: "mdi:flash", color: "orange" }, { value: "off", icon: "mdi:flash-off", color: "grey" }] },
      "auto", "on", "idle",
    ];
    const hass = createHass({ [SELECT]: selectState("auto"), [FLAG]: makeState(FLAG, "on") });
    const el = document.createElement("slabton-card");
    el.setConfig({ type: "custom:slabton-card", entity: SELECT, stickshift: true, states });
    el.hass = hass;
    document.body.appendChild(el);
    vi.advanceTimersByTime(0);
    const icon = () => points(el)[0].querySelector("ha-icon");
    expect(icon().getAttribute("icon")).toBe("mdi:flash");
    expect(icon().style.getPropertyValue("--slabton-sx-c")).toBe("orange");
    el.hass = createHass({ [SELECT]: selectState("auto"), [FLAG]: makeState(FLAG, "off") });
    vi.advanceTimersByTime(0);
    expect(icon().getAttribute("icon")).toBe("mdi:flash-off");
    // active: the handle shows it too
    el.hass = createHass({ [SELECT]: selectState("off"), [FLAG]: makeState(FLAG, "on") });
    vi.advanceTimersByTime(0);
    expect(q(el, ".handle .h-icon").getAttribute("icon")).toBe("mdi:flash");
    // the own entity changes while the point stays active: the handle follows
    el.hass = createHass({ [SELECT]: selectState("off"), [FLAG]: makeState(FLAG, "off") });
    vi.advanceTimersByTime(0);
    expect(q(el, ".handle .h-icon").getAttribute("icon")).toBe("mdi:flash-off");
    expect(icon().getAttribute("icon")).toBe("mdi:flash-off");
  });

  it("redraws when only the own entity of a point changes (the main entity object stays the same)", () => {
    const FLAG = "input_boolean.flag";
    const states = [
      { value: "off", entity: FLAG, states: [{ value: "on", icon: "mdi:flash", color: "orange" }, { value: "off", icon: "mdi:flash-off", color: "grey" }] },
      "auto", "on", "idle",
    ];
    const main = selectState("off");
    const el = document.createElement("slabton-card");
    el.setConfig({ type: "custom:slabton-card", entity: SELECT, stickshift: true, states });
    el.hass = createHass({ [SELECT]: main, [FLAG]: makeState(FLAG, "on") });
    document.body.appendChild(el);
    vi.advanceTimersByTime(0);
    const point = () => points(el)[0].querySelector("ha-icon").getAttribute("icon");
    const handle = () => q(el, ".handle .h-icon").getAttribute("icon");
    expect([point(), handle()]).toEqual(["mdi:flash", "mdi:flash"]);
    el.hass = createHass({ [SELECT]: main, [FLAG]: makeState(FLAG, "off") });
    vi.advanceTimersByTime(0);
    expect([point(), handle()]).toEqual(["mdi:flash-off", "mdi:flash-off"]);
  });

  it("does not loop forever when every point's tap_action is cycle", () => {
    const cycle = { action: "cycle" };
    const { el, hass } = create({ states: [{ value: "off", tap_action: cycle }, { value: "auto", tap_action: cycle }, { value: "on", tap_action: cycle }, { value: "idle", tap_action: cycle }] });
    expect(() => tap(points(el)[0])).not.toThrow();
    expect(selected(hass).length).toBeLessThan(6);
  });

  it("marks the points aria-disabled while the entity is blocked (unavailable)", () => {
    const { el } = create({}, makeState(SELECT, "unavailable", { options: OPTIONS }));
    const buttons = points(el);
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(points(create().el).every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
  });

  it("keeps the point buttons (focus, running taps) when only the own entity of a point changes", () => {
    const FLAG = "input_boolean.flag";
    const states = [{ value: "off", entity: FLAG, states: [{ value: "on", icon: "mdi:flash" }, { value: "off", icon: "mdi:flash-off" }] }, "auto", "on", "idle"];
    const main = selectState("auto");
    const el = document.createElement("slabton-card");
    el.setConfig({ type: "custom:slabton-card", entity: SELECT, stickshift: true, states });
    el.hass = createHass({ [SELECT]: main, [FLAG]: makeState(FLAG, "on") });
    document.body.appendChild(el);
    vi.advanceTimersByTime(0);
    const before = points(el)[0];
    el.hass = createHass({ [SELECT]: main, [FLAG]: makeState(FLAG, "off") });
    vi.advanceTimersByTime(0);
    expect(points(el)[0]).toBe(before);
    expect(before.querySelector("ha-icon").getAttribute("icon")).toBe("mdi:flash-off");
  });

  it("does not color the handle with active_color while no point is active (unknown state)", () => {
    const { el } = create({ stickshift: { active_color: "red" } }, selectState("not-a-state"));
    expect(q(el, ".handle .h-icon").style.color).toBe("");
  });

  it("warns about unknown keys of stickshift.gate", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    withSx({}, { gate: { colour: "red" } });
    expect(warn.mock.calls.flat().join(" ")).toContain("stickshift.gate.colour");
  });

  it("keeps the own entity and display states of a point in the config", () => {
    const config = withSx({ states: [{ value: "a", entity: "input_boolean.x", states: [{ value: "on", icon: "mdi:flash" }] }, "b"] });
    expect(config.states[0].entity).toBe("input_boolean.x");
    expect(config.states[0].states).toEqual([expect.objectContaining({ value: "on", icon: "mdi:flash" })]);
  });

  it("selects with Enter on a focused point and steps with the arrow keys", () => {
    const { el, hass } = create();
    points(el)[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(selected(hass)).toEqual(["off"]);
    hass.callService.mockClear();
    vi.advanceTimersByTime(400);
    points(el)[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    // The pending "off" (the entity has not answered yet) is the position the key steps from.
    expect(selected(hass)).toEqual(["auto"]);
  });

  it("does nothing on a point while the entity is unavailable", () => {
    const { el, hass } = create({}, makeState(SELECT, "unavailable", { options: OPTIONS }));
    tap(points(el)[2]);
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("removes the point listeners on reconfiguration", () => {
    const { el, hass } = create();
    el.setConfig({ type: "custom:slabton-card", entity: SELECT, stickshift: true });
    expect(points(el)).toHaveLength(4);
    tap(points(el)[3]);
    expect(selected(hass)).toEqual(["idle"]);
  });
});

describe("stickshift editor", () => {
  const flat = (items) => items.flatMap((item) => (item.schema ? [item, ...flat(item.schema)] : [item]));
  const fieldNames = (config) => flat(buildSchema(config)).map((f) => f.name);

  it("offers the style choice in the state mode only", () => {
    const style = flat(buildSchema({ entity: SELECT })).find((f) => f.name === "style");
    expect(style.selector.select.options.map((o) => o.value)).toEqual(["standard", "stickshift"]);
    expect(fieldNames({ entity: "sensor.a" })).not.toContain("style");
    expect(fieldNames({ entity: "lock.a" })).not.toContain("style");
  });

  it("shows the stickshift section only while it is on", () => {
    expect(fieldNames({ entity: SELECT })).not.toContain("stickshift");
    const names = fieldNames({ entity: SELECT, stickshift: true });
    expect(names).toEqual(expect.arrayContaining(["stickshift", "shape", "point_size", "point_opacity", "active_color", "gate", "visible", "enabled"]));
  });

  it("labels every stickshift field with its own key", () => {
    const section = buildSchema({ entity: SELECT, stickshift: true }).find((f) => f.name === "stickshift");
    const leaves = flat(section.schema).filter((f) => !f.schema);
    expect(leaves.length).toBeGreaterThan(5);
    for (const field of leaves) expect(field.labelKey, field.name).toMatch(/^editor\.sx_/);
  });

  function editor(config) {
    const el = document.createElement("slabton-card-editor");
    el.setConfig(config);
    el._form = {};
    const events = [];
    el.addEventListener("config-changed", (e) => events.push(e.detail.config));
    const change = (value) => el._onChanged({ stopPropagation() {}, detail: { value } });
    return { el, events, change };
  }

  it("selecting stickshift stores the block, deselecting removes it", () => {
    const { events, change } = editor({ entity: SELECT });
    change({ entity: SELECT, style: "stickshift", stickshift: {} });
    expect(events.at(-1).stickshift).toBe(true);
    expect(events.at(-1).style).toBeUndefined();
    change({ entity: SELECT, style: "standard" });
    expect(events.at(-1).stickshift).toBeUndefined();
    expect("stickshift" in events.at(-1)).toBe(false);
  });

  it("stores options, drops cleared ones and keeps states with their point actions", () => {
    const states = [{ value: "off" }, { value: "on", tap_action: SCRIPT }];
    const { events, change } = editor({ entity: SELECT, states, stickshift: true });
    change({
      entity: SELECT, states, style: "stickshift",
      stickshift: { shape: "oval", point_size: undefined, gate: { visible: false, size: "" } },
    });
    const config = events.at(-1);
    expect(config.stickshift).toEqual({ shape: "oval", gate: { visible: false } });
    expect(config.states).toEqual(states);
  });

  it("does not drop a stickshift block while another field changes", () => {
    const config = { entity: SELECT, stickshift: { shape: "square", gate: { color: "red" } }, states: [{ value: "a", hold_action: SCRIPT }, "b"] };
    const { events, change } = editor(config);
    change({ entity: SELECT, name: "New", style: "stickshift", states: config.states, stickshift: { shape: "square", gate: { color: "red" } } });
    expect(events.at(-1)).toEqual({ ...config, name: "New" });
  });

  it("keeps a block that was switched off with enabled: false", () => {
    const { events, change } = editor({ entity: SELECT, stickshift: { enabled: false, shape: "square" } });
    change({ entity: SELECT, name: "x", style: "standard", stickshift: { enabled: false, shape: "square" } });
    expect(events.at(-1).stickshift).toEqual({ enabled: false, shape: "square" });
  });

  it("notes unusable stickshift colors", () => {
    const hints = validationHints({ entity: SELECT, stickshift: { active_color: "red;", gate: { color: "{x}" } } }, "en");
    expect(hints).toHaveLength(2);
    expect(hints.join(" ")).toContain("stickshift.active_color");
    expect(validationHints({ entity: SELECT, stickshift: true }, "en")).toEqual([]);
  });
});

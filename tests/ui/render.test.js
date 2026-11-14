import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../src/core/config.js";
import { renderCard, rootClasses, updateSwitches, updateView } from "../../src/ui/render.js";
import { buildCss } from "../../src/ui/styles.js";
import * as stateMode from "../../src/core/modes/state.js";
import * as lockMode from "../../src/core/modes/lock.js";
import { makeState } from "../helpers/mock-hass.js";

function setup(extra = {}) {
  const config = normalizeConfig({ entity: "input_select.mode", ...extra });
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const refs = renderCard(shadow, config, buildCss());
  return { config, shadow, refs };
}

const modeState = makeState("input_select.mode", "on", { options: ["off", "auto", "on"] });

describe("renderCard", () => {
  it("builds the core structure", () => {
    const { shadow, refs } = setup();
    expect(shadow.querySelector("ha-card")).not.toBeNull();
    expect(refs.handle.getAttribute("tabindex")).toBe("0");
    expect(refs.root.className).toContain("o-h");
    expect(shadow.querySelector(".header")).toBeNull();
  });

  it("escapes the header text", () => {
    const { shadow } = setup({ name: '<img src=x onerror="alert(1)">' });
    expect(shadow.querySelector(".title").textContent).toBe('<img src=x onerror="alert(1)">');
    expect(shadow.querySelector(".title img")).toBeNull();
  });

  it("places the header at the bottom", () => {
    const { shadow } = setup({ name: "N", header_position: "bottom" });
    const stage = shadow.querySelector(".stage");
    expect(stage.nextElementSibling.classList.contains("header")).toBe(true);
  });

  it("puts the header icon on the left by default and on the right on request", () => {
    const left = setup({ name: "N", icon: "mdi:fire" }).shadow.querySelector(".header");
    expect(left.classList.contains("icon-right")).toBe(false);
    const right = setup({ name: "N", icon: "mdi:fire", header_icon_position: "right" }).shadow.querySelector(".header");
    expect(right.classList.contains("icon-right")).toBe(true);
  });

  it("hides the header when set to none", () => {
    const { shadow } = setup({ name: "N", header_position: "none" });
    expect(shadow.querySelector(".header")).toBeNull();
  });

  it("renders switch slots with axis positions", () => {
    const { refs } = setup({ switches: { start: { entity: "switch.a", icon: "mdi:power" }, end: { entity: "switch.b" } } });
    expect(Object.keys(refs.switches)).toEqual(["start", "end"]);
    expect(refs.switches.start.style.getPropertyValue("--slabton-sw-e")).toBe("0");
    expect(refs.switches.end.style.getPropertyValue("--slabton-sw-e")).toBe("1");
    expect(refs.switches.start.querySelector("ha-icon").getAttribute("icon")).toBe("mdi:power");
  });

  it("mirrors switch positions for rtl and vertical", () => {
    const rtl = setup({ direction: "rtl", switches: { start: {} } });
    expect(rtl.refs.switches.start.style.getPropertyValue("--slabton-sw-e")).toBe("1");
    const vertical = setup({ orientation: "vertical", switches: { start: {} } });
    expect(vertical.refs.switches.start.style.getPropertyValue("--slabton-sw-e")).toBe("1");
  });
});

describe("scale", () => {
  const tickValues = (shadow) => [...shadow.querySelectorAll(".scale .tick")].map((t) => t.style.getPropertyValue("--slabton-tick-e"));

  it("renders nothing without scale:", () => {
    const { shadow } = setup();
    expect(shadow.querySelector(".scale")).toBeNull();
  });

  it("renders ticks + 1 marks that sit on the handle centre positions", () => {
    const { shadow } = setup({ scale: { ticks: 4 } });
    expect(shadow.querySelectorAll(".scale .tick")).toHaveLength(5);
    expect(tickValues(shadow)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
  });

  it("defaults to 10 segments at the end edge", () => {
    const { shadow } = setup({ scale: true });
    const scale = shadow.querySelector(".scale");
    expect(scale.querySelectorAll(".tick")).toHaveLength(11);
    expect(scale.classList.contains("sc-end")).toBe(true);
  });

  it("encodes the position as a class, aliases resolved", () => {
    const classOf = (extra, position) => setup({ ...extra, scale: { position } }).shadow.querySelector(".scale").className;
    expect(classOf({}, "start")).toContain("sc-start");
    expect(classOf({}, "top")).toContain("sc-start");
    expect(classOf({}, "bottom")).toContain("sc-end");
    expect(classOf({}, "center")).toContain("sc-center");
    expect(classOf({ orientation: "vertical" }, "left")).toContain("sc-start");
    expect(classOf({ orientation: "vertical" }, "right")).toContain("sc-end");
  });

  it("mirrors the ticks for rtl and vertical like the handle", () => {
    expect(tickValues(setup({ direction: "rtl", scale: { ticks: 4 } }).shadow)).toEqual(["1", "0.75", "0.5", "0.25", "0"]);
    expect(tickValues(setup({ orientation: "vertical", scale: { ticks: 4 } }).shadow)).toEqual(["1", "0.75", "0.5", "0.25", "0"]);
    expect(tickValues(setup({ orientation: "vertical", direction: "rtl", scale: { ticks: 4 } }).shadow)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
  });

  it("rounds odd fractions to a short number", () => {
    expect(tickValues(setup({ scale: { ticks: 3 } }).shadow)).toEqual(["0", "0.3333", "0.6667", "1"]);
  });

  it("renders one tick per hour on a clock", () => {
    const day = setup({ entity: undefined, mode: "clock", scale: true }).shadow;
    expect(day.querySelectorAll(".tick")).toHaveLength(25);
    const half = setup({ entity: undefined, mode: "clock", scale: true, clock: { hour_format: "12" } }).shadow;
    expect(half.querySelectorAll(".tick")).toHaveLength(13);
  });

  it("sits after the fill and before the text, hidden from assistive technology", () => {
    const { shadow, refs } = setup({ entity: "timer.a", bar_text: "x", scale: true });
    const scale = shadow.querySelector(".bar > .scale");
    expect(scale.previousElementSibling.classList.contains("fill-clip")).toBe(true);
    expect(scale.nextElementSibling).toBe(refs.barText);
    expect(scale.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the scale when the view updates", () => {
    const { config, shadow, refs } = setup({ scale: { ticks: 2 } });
    const before = shadow.querySelector(".scale");
    updateView(refs, config, stateMode.view(config, modeState));
    expect(shadow.querySelector(".scale")).toBe(before);
    expect(tickValues(shadow)).toEqual(["0", "0.5", "1"]);
  });
});

describe("rootClasses", () => {
  it("encodes orientation, direction, shape, animation and drag", () => {
    const c = normalizeConfig({ entity: "sensor.t", orientation: "vertical", direction: "rtl", handle_shape: "oval", animation: "pulse" });
    const classes = rootClasses(c).split(" ");
    expect(classes).toEqual(expect.arrayContaining(["o-v", "dir-rtl", "rev", "shape-oval", "anim-pulse", "nodrag"]));
  });
});

describe("updateView", () => {
  it("sets position variables from the view", () => {
    const { config, refs } = setup();
    updateView(refs, config, stateMode.view(config, modeState));
    expect(refs.root.style.getPropertyValue("--slabton-p")).toBe("1");
    expect(refs.root.style.getPropertyValue("--slabton-e")).toBe("1");
  });

  it("uses the live drag position and the vertical axis", () => {
    const { config, refs } = setup({ orientation: "vertical" });
    updateView(refs, config, stateMode.view(config, modeState), { dragPos: 0.25 });
    expect(refs.root.style.getPropertyValue("--slabton-p")).toBe("0.25");
    expect(refs.root.style.getPropertyValue("--slabton-e")).toBe("0.75");
  });

  it("shows the icon, position or text in the handle", () => {
    const icon = setup({ icon: "mdi:fan" });
    updateView(icon.refs, icon.config, stateMode.view(icon.config, modeState));
    expect(icon.refs.icon.hidden).toBe(false);
    expect(icon.refs.icon.getAttribute("icon")).toBe("mdi:fan");
    expect(icon.refs.text.hidden).toBe(true);

    const position = setup({ handle_content: "position" });
    updateView(position.refs, position.config, stateMode.view(position.config, modeState));
    expect(position.refs.text.textContent).toBe("3");
    expect(position.refs.icon.hidden).toBe(true);

    const text = setup({ handle_content: "text" });
    updateView(text.refs, text.config, stateMode.view(text.config, modeState));
    expect(text.refs.text.textContent).toBe("on");

    const none = setup({ handle_content: "none" });
    updateView(none.refs, none.config, stateMode.view(none.config, modeState));
    expect(none.refs.text.hidden).toBe(true);
    expect(none.refs.icon.hidden).toBe(true);
  });

  it("sets slider semantics", () => {
    const { config, refs } = setup();
    updateView(refs, config, stateMode.view(config, modeState));
    expect(refs.handle.getAttribute("role")).toBe("slider");
    expect(refs.handle.getAttribute("aria-valuenow")).toBe("100");
    expect(refs.handle.getAttribute("aria-valuetext")).toBe("on");
  });

  it("sets switch semantics in lock mode", () => {
    const { config, refs } = setup({ entity: "lock.front" });
    updateView(refs, config, lockMode.view(config, makeState("lock.front", "locked")));
    expect(refs.handle.getAttribute("role")).toBe("switch");
    expect(refs.handle.getAttribute("aria-checked")).toBe("false");
  });

  it("marks unavailable entities and removes focusability", () => {
    const { config, refs } = setup();
    updateView(refs, config, stateMode.view(config, undefined));
    expect(refs.root.classList.contains("unavailable")).toBe(true);
    expect(refs.handle.getAttribute("tabindex")).toBe("-1");
    expect(refs.handle.getAttribute("aria-disabled")).toBe("true");
  });

  it("applies and clears the state color", () => {
    const { config, refs } = setup({ states: [{ value: "on", color: "orange" }, "off"] });
    updateView(refs, config, stateMode.view(config, modeState));
    expect(refs.root.style.getPropertyValue("--slabton-active-color")).toBe("orange");
    updateView(refs, config, stateMode.view(config, makeState("input_select.mode", "off")));
    expect(refs.root.style.getPropertyValue("--slabton-active-color")).toBe("");
  });

  it("restarts the keyframe animation when the content changes", () => {
    const { config, refs } = setup({ animation: "pulse" });
    updateView(refs, config, stateMode.view(config, modeState));
    expect(refs.handle.classList.contains("changed")).toBe(false);
    updateView(refs, config, stateMode.view(config, makeState("input_select.mode", "off", modeState.attributes)));
    expect(refs.handle.classList.contains("changed")).toBe(true);
  });
});

describe("bar text, info and expiry", () => {
  const view = (extra = {}) => ({
    pos: 0, fillPos: 0, icon: "mdi:timer", text: "5:00", positionText: "0", color: null,
    unavailable: false, ariaNow: 0, ariaText: "5:00", ...extra,
  });

  it("renders no text elements unless configured", () => {
    const { shadow, refs } = setup();
    expect(refs.barText).toBeNull();
    expect(refs.info).toBeNull();
    expect(shadow.querySelector(".bar-text")).toBeNull();
  });

  it("puts bar_text between the fill and the handle and hides it when empty", () => {
    const { config, shadow, refs } = setup({ entity: "timer.a", bar_text: "x" });
    expect(shadow.querySelector(".bar > .bar-text")).toBe(refs.barText);
    expect(refs.barText.previousElementSibling.classList.contains("fill-clip")).toBe(true);
    expect(refs.barText.hidden).toBe(true);
    updateView(refs, config, view({ barText: "noch 3 Tage" }));
    expect(refs.barText.textContent).toBe("noch 3 Tage");
    expect(refs.barText.hidden).toBe(false);
    updateView(refs, config, view({ barText: null }));
    expect(refs.barText.hidden).toBe(true);
    expect(refs.barText.textContent).toBe("");
  });

  it("shows texts as plain text, never as markup", () => {
    const { config, shadow, refs } = setup({ entity: "timer.a", bar_text: "x", timer: { info: "y" } });
    const payload = '<img src=x onerror="alert(1)">';
    updateView(refs, config, view({ barText: payload, info: payload }));
    expect(refs.barText.textContent).toBe(payload);
    expect(refs.info.textContent).toBe(payload);
    expect(shadow.querySelector("img")).toBeNull();
  });

  it("places the info inside the bar when horizontal and above it when vertical", () => {
    const horizontal = setup({ entity: "timer.a", timer: { info: "i" } });
    expect(horizontal.shadow.querySelector(".bar > .info")).toBe(horizontal.refs.info);
    expect(horizontal.shadow.querySelector(".stage").classList.contains("has-info")).toBe(true);

    const vertical = setup({ entity: "timer.a", orientation: "vertical", timer: { info: "i" } });
    const stage = vertical.shadow.querySelector(".stage");
    expect(vertical.shadow.querySelector(".bar > .info")).toBeNull();
    expect(stage.firstElementChild).toBe(vertical.refs.info);
    expect(vertical.refs.info.nextElementSibling.classList.contains("bar")).toBe(true);
  });

  it("moves the info to the side with more room", () => {
    const { config, refs } = setup({ entity: "timer.a", timer: { info: "i" } });
    updateView(refs, config, view({ pos: 0, info: "Ende" }));
    expect(refs.info.textContent).toBe("Ende");
    expect(refs.info.classList.contains("info-right")).toBe(true);
    updateView(refs, config, view({ pos: 1, info: "Ende" }));
    expect(refs.info.classList.contains("info-right")).toBe(false);
  });

  it("toggles the expired class", () => {
    const { config, refs } = setup();
    updateView(refs, config, view({ expired: true }));
    expect(refs.root.classList.contains("expired")).toBe(true);
    updateView(refs, config, view());
    expect(refs.root.classList.contains("expired")).toBe(false);
  });

  it("labels an entity-less clock and replays animations only on state changes in timer and clock", () => {
    const clock = setup({ entity: undefined, mode: "clock", animation: "pulse" });
    updateView(clock.refs, clock.config, view({ text: "12:00" }));
    expect(clock.refs.handle.getAttribute("aria-label")).toBe("slABton");
    updateView(clock.refs, clock.config, view({ text: "12:01" }));
    expect(clock.refs.handle.classList.contains("changed")).toBe(false);
    updateView(clock.refs, clock.config, view({ text: "12:01", icon: "mdi:other" }));
    expect(clock.refs.handle.classList.contains("changed")).toBe(true);
  });
});

describe("read-only modes", () => {
  it("cannot be dragged", () => {
    for (const extra of [{ entity: "counter.a" }, { entity: "timer.a" }, { mode: "clock" }]) {
      const config = normalizeConfig(extra);
      expect(rootClasses(config).split(" ")).toContain("nodrag");
    }
  });
});

describe("updateSwitches", () => {
  it("highlights switches whose entity is on", () => {
    const { config, refs } = setup({ switches: { start: { entity: "switch.a" }, end: { entity: "switch.b" } } });
    updateSwitches(refs, config, { states: { "switch.a": makeState("switch.a", "on"), "switch.b": makeState("switch.b", "off") } });
    expect(refs.switches.start.classList.contains("active")).toBe(true);
    expect(refs.switches.end.classList.contains("active")).toBe(false);
  });
});

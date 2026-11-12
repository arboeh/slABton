import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../src/config.js";
import { renderCard, rootClasses, updateSwitches, updateView } from "../src/render.js";
import { buildCss } from "../src/styles.js";
import * as stateMode from "../src/modes/state.js";
import * as lockMode from "../src/modes/lock.js";
import { makeState } from "./helpers/mock-hass.js";

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

describe("updateSwitches", () => {
  it("highlights switches whose entity is on", () => {
    const { config, refs } = setup({ switches: { start: { entity: "switch.a" }, end: { entity: "switch.b" } } });
    updateSwitches(refs, config, { states: { "switch.a": makeState("switch.a", "on"), "switch.b": makeState("switch.b", "off") } });
    expect(refs.switches.start.classList.contains("active")).toBe(true);
    expect(refs.switches.end.classList.contains("active")).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/ui/slabton-card.js";
import { normalizeConfig } from "../../src/core/config.js";
import { renderCard, rootClasses, segmentsActive, updateSwitches, updateView, zoneOf } from "../../src/ui/render.js";
import { buildCss } from "../../src/ui/styles.js";
import * as stateMode from "../../src/core/modes/state.js";
import * as lockMode from "../../src/core/modes/lock.js";
import * as valueMode from "../../src/core/modes/value.js";
import { createHass, makeState } from "../helpers/mock-hass.js";

function setup(extra = {}) {
  const config = normalizeConfig({ entity: "input_select.mode", ...extra });
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "open" });
  const refs = renderCard(shadow, config, buildCss());
  return { config, shadow, refs };
}

const modeState = makeState("input_select.mode", "on", { options: ["off", "auto", "on"] });

/** `read(element)` for every element matching `selector` in the shadow root. */
const mapAll = (shadow, selector, read) => [...shadow.querySelectorAll(selector)].map(read);
const textOf = (el) => el.textContent;
const edgeOf = (el) => el.style.getPropertyValue("--slabton-tick-e");

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

  it("leaves out the header icon for header_icon_position none and keeps the name", () => {
    const header = setup({ name: "N", icon: "mdi:fire", header_icon_position: "none" }).shadow.querySelector(".header");
    expect(header.querySelector(".header-icon")).toBeNull();
    expect(header.querySelector(".title").textContent).toBe("N");
    expect(header.classList.contains("icon-right")).toBe(false);
  });

  it("renders no header without a name when the icon is none", () => {
    const { shadow } = setup({ icon: "mdi:fire", header_icon_position: "none" });
    expect(shadow.querySelector(".header")).toBeNull();
  });

  it("aligns the header only when asked to", () => {
    const start = setup({ name: "N" }).shadow.querySelector(".header");
    expect([...start.classList].some((c) => c.startsWith("align-"))).toBe(false);
    const center = setup({ name: "N", header_align: "center" }).shadow.querySelector(".header");
    expect(center.classList.contains("align-center")).toBe(true);
    const end = setup({ name: "N", icon: "mdi:fire", header_align: "end", header_icon_position: "right" }).shadow.querySelector(".header");
    expect(end.classList.contains("align-end")).toBe(true);
    expect(end.classList.contains("icon-right")).toBe(true);
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

describe("scale labels outside the bar", () => {
  const outside = (extra = {}, scale = {}) => setup({
    entity: "sensor.x", mode: "value", min: 0, max: 100,
    scale: { ticks: 4, labels: true, labels_placement: "outside", ...scale }, ...extra,
  });
  const texts = (shadow) => mapAll(shadow, ".scale-labels .tick-label", textOf);

  it("builds a label container beside the bar and keeps the ticks in the bar", () => {
    const { shadow } = outside();
    const container = shadow.querySelector(".stage > .scale-labels");
    expect(container).not.toBeNull();
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(shadow.querySelectorAll(".bar .scale .tick")).toHaveLength(5);
    expect(shadow.querySelector(".bar .tick-label")).toBeNull();
    expect(texts(shadow)).toEqual(["0.0", "100.0"]);
  });

  it("puts the labels before the bar for start and center, after it for end", () => {
    for (const position of ["start", "center"]) {
      const { shadow } = outside({}, { position });
      const stage = shadow.querySelector(".stage");
      expect(stage.classList.contains("lbl-out")).toBe(true);
      expect(stage.classList.contains("lbl-start")).toBe(true);
      expect(stage.firstElementChild.classList.contains("scale-labels")).toBe(true);
    }
    const end = outside({}, { position: "end" }).shadow.querySelector(".stage");
    expect(end.classList.contains("lbl-end")).toBe(true);
    expect(end.lastElementChild.classList.contains("scale-labels")).toBe(true);
  });

  it("puts the labels on the tick track (mirrored for rtl)", () => {
    const ltr = outside().shadow.querySelectorAll(".scale-labels .tick-label");
    expect([...ltr].map((l) => l.style.getPropertyValue("--slabton-tick-e"))).toEqual(["0", "1"]);
    const rtl = outside({ direction: "rtl" }).shadow.querySelectorAll(".scale-labels .tick-label");
    expect([...rtl].map((l) => l.style.getPropertyValue("--slabton-tick-e"))).toEqual(["1", "0"]);
  });

  it("works for a vertical bar", () => {
    const { shadow } = outside({ orientation: "vertical" }, { position: "left" });
    expect(shadow.querySelector(".stage").classList.contains("lbl-start")).toBe(true);
    expect(texts(shadow)).toEqual(["0.0", "100.0"]);
  });

  it("updates bound labels in the outside container", () => {
    const { config, shadow, refs } = setup({
      entity: "sensor.x", scale: { ticks: 4, labels: true, labels_placement: "outside" }, bar: { entity: "input_number.y" },
    });
    expect(refs.boundLabels.map((label) => label.bound)).toEqual(["min", "max"]);
    const view = valueMode.view(config, makeState("sensor.x", "5"));
    updateView(refs, config, { ...view, scaleLabels: { min: "10", max: "80" } });
    expect(texts(shadow)).toEqual(["10", "80"]);
  });

  it("changes nothing for labels inside", () => {
    const { shadow } = setup({ entity: "sensor.x", mode: "value", min: 0, max: 100, scale: { labels: true } });
    expect(shadow.querySelector(".scale-labels")).toBeNull();
    expect(shadow.querySelector(".stage").classList.contains("lbl-out")).toBe(false);
    expect(shadow.querySelectorAll(".scale .tick-label")).toHaveLength(2);
  });
});

describe("scale ticks outside the bar", () => {
  const ticksOut = (extra = {}, scale = {}) => setup({
    entity: "sensor.x", mode: "value", min: 0, max: 100,
    scale: { ticks: 4, ticks_placement: "outside", ...scale }, ...extra,
  });
  const edges = (shadow) => mapAll(shadow, ".scale-ticks .tick", edgeOf);

  it("builds a tick container beside the bar and keeps nothing in the bar", () => {
    const { shadow } = ticksOut();
    const container = shadow.querySelector(".stage > .scale-ticks");
    expect(container).not.toBeNull();
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(".tick")).toHaveLength(5);
    expect(shadow.querySelector(".bar .scale")).toBeNull();
    expect(shadow.querySelector(".bar .tick")).toBeNull();
  });

  it("puts the ticks before the bar for start and center, after it for end", () => {
    for (const position of ["start", "center"]) {
      const stage = ticksOut({}, { position }).shadow.querySelector(".stage");
      expect(stage.classList.contains("tk-out")).toBe(true);
      expect(stage.classList.contains("tk-start")).toBe(true);
      expect(stage.firstElementChild.classList.contains("scale-ticks")).toBe(true);
    }
    const end = ticksOut({}, { position: "end" }).shadow.querySelector(".stage");
    expect(end.classList.contains("tk-end")).toBe(true);
    expect(end.lastElementChild.classList.contains("scale-ticks")).toBe(true);
  });

  it("puts the ticks on the tick track (mirrored for rtl)", () => {
    expect(edges(ticksOut().shadow)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
    expect(edges(ticksOut({ direction: "rtl" }).shadow)).toEqual(["1", "0.75", "0.5", "0.25", "0"]);
  });

  it("works for a vertical bar", () => {
    const { shadow } = ticksOut({ orientation: "vertical" }, { position: "left" });
    expect(shadow.querySelector(".stage").classList.contains("tk-start")).toBe(true);
    expect(shadow.querySelectorAll(".scale-ticks .tick")).toHaveLength(5);
  });

  it("stacks bar, ticks, labels outwards when both stand outside", () => {
    const end = ticksOut({}, { position: "end", labels: true, labels_placement: "outside" }).shadow.querySelector(".stage");
    expect([...end.children].map((c) => c.className.split(" ")[0])).toEqual(["bar", "scale-ticks", "scale-labels"]);
    const start = ticksOut({}, { position: "start", labels: true, labels_placement: "outside" }).shadow.querySelector(".stage");
    expect([...start.children].map((c) => c.className.split(" ")[0])).toEqual(["scale-labels", "scale-ticks", "bar"]);
    expect(start.classList.contains("lbl-out") && start.classList.contains("tk-out")).toBe(true);
  });

  it("keeps labels inside in the bar next to ticks outside", () => {
    const { shadow } = ticksOut({}, { labels: true });
    const scale = shadow.querySelector(".bar .scale");
    expect(scale.classList.contains("tk-out")).toBe(true);
    expect(scale.querySelectorAll(".tick")).toHaveLength(0);
    expect(scale.querySelectorAll(".tick-label")).toHaveLength(2);
    expect(shadow.querySelectorAll(".scale-ticks .tick")).toHaveLength(5);
  });

  it("changes nothing for ticks inside", () => {
    const { shadow } = setup({ entity: "sensor.x", mode: "value", min: 0, max: 100, scale: { ticks: 4 } });
    expect(shadow.querySelector(".scale-ticks")).toBeNull();
    expect(shadow.querySelector(".stage").classList.contains("tk-out")).toBe(false);
    expect(shadow.querySelectorAll(".bar .scale .tick")).toHaveLength(5);
  });
});

describe("scale without ticks (ticks_placement none)", () => {
  const noTicks = (extra = {}, scale = {}) => setup({
    entity: "sensor.x", mode: "value", min: 0, max: 100,
    scale: { ticks: 4, labels: true, ticks_placement: "none", ...scale }, ...extra,
  });
  const labelTexts = (shadow) => mapAll(shadow, ".tick-label", textOf);

  it("draws no ticks and keeps the labels in the bar", () => {
    const { shadow } = noTicks();
    expect(shadow.querySelector(".tick")).toBeNull();
    expect(shadow.querySelector(".scale-ticks")).toBeNull();
    const scale = shadow.querySelector(".bar .scale");
    expect(scale.classList.contains("tk-out")).toBe(true);
    expect(labelTexts(shadow)).toEqual(["0.0", "100.0"]);
    expect(shadow.querySelector(".stage").classList.contains("tk-out")).toBe(false);
  });

  it("keeps the labels on the track of the tick positions", () => {
    const labels = noTicks({ direction: "rtl" }).shadow.querySelectorAll(".tick-label");
    expect([...labels].map((l) => l.style.getPropertyValue("--slabton-tick-e"))).toEqual(["1", "0"]);
  });

  it("puts the labels outside the bar without a tick container", () => {
    const { shadow } = noTicks({}, { labels_placement: "outside" });
    const stage = shadow.querySelector(".stage");
    expect(shadow.querySelector(".tick")).toBeNull();
    expect(shadow.querySelector(".bar .scale")).toBeNull();
    expect(stage.classList.contains("lbl-out")).toBe(true);
    expect(stage.classList.contains("tk-out")).toBe(false);
    expect([...stage.children].map((c) => c.className.split(" ")[0])).toEqual(["bar", "scale-labels"]);
    expect(labelTexts(shadow)).toEqual(["0.0", "100.0"]);
  });
});

describe("scale labels that follow the bar entity", () => {
  const options = { entity: "sensor.x", scale: { ticks: 4, labels: true }, bar: { entity: "input_number.y" } };
  const texts = (shadow) => [...shadow.querySelectorAll(".tick-label")].map((label) => label.textContent);

  it("remembers the bound labels and rewrites only their text", () => {
    const { config, shadow, refs } = setup(options);
    expect(refs.boundLabels.map((label) => label.bound)).toEqual(["min", "max"]);
    const first = shadow.querySelector(".tick-label");
    const view = valueMode.view(config, makeState("sensor.x", "5"));

    updateView(refs, config, { ...view, scaleLabels: { min: "10", max: "80" } });
    expect(texts(shadow)).toEqual(["10", "80"]);
    expect(shadow.querySelector(".tick-label")).toBe(first);

    updateView(refs, config, view);
    expect(texts(shadow)).toEqual(["10", "80"]);
  });

  it("has no bound labels without a bar entity or without labels", () => {
    expect(setup({ entity: "sensor.x", scale: { labels: true }, min: 0, max: 10 }).refs.boundLabels).toEqual([]);
    expect(setup({ entity: "sensor.x", bar: { entity: "input_number.y" } }).refs.boundLabels).toEqual([]);
  });
});

describe("scale", () => {
  const tickValues = (shadow) => [...shadow.querySelectorAll(".scale .tick")].map((t) => t.style.getPropertyValue("--slabton-tick-e"));

  it("renders nothing without scale:", () => {
    const { shadow } = setup();
    expect(shadow.querySelector(".scale")).toBeNull();
  });

  it("renders ticks + 1 marks at their share of the scale track", () => {
    const { shadow } = setup({ scale: { ticks: 4 } });
    expect(shadow.querySelectorAll(".scale .tick")).toHaveLength(5);
    expect(tickValues(shadow)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
  });

  it("keeps every mode on the handle-centre track: no scale-full class on the rendered root", () => {
    const root = (extra) => setup({ scale: { ticks: 4 }, ...extra }).shadow.querySelector(".root");
    expect(root({ entity: "sensor.t", mode: "value" }).classList.contains("scale-full")).toBe(false);
    expect(root({}).classList.contains("scale-full")).toBe(false);
  });

  it("leaves the labels at the bar ends without an edge mark: they stand centred on their tick, mirrored for rtl", () => {
    const labels = (extra) => [...setup({ entity: "sensor.t", mode: "value", min: 0, max: 100, scale: { ticks: 4, labels: true }, ...extra })
      .shadow.querySelectorAll(".scale .tick-label")];
    expect(labels({}).map((l) => l.style.getPropertyValue("--slabton-tick-e"))).toEqual(["0", "1"]);
    expect(labels({ direction: "rtl" }).map((l) => l.style.getPropertyValue("--slabton-tick-e"))).toEqual(["1", "0"]);
    for (const label of [...labels({}), ...labels({ direction: "rtl" })]) expect(label.hasAttribute("data-edge")).toBe(false);
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

describe("scale labels", () => {
  const labelsOf = (shadow) => [...shadow.querySelectorAll(".scale .tick-label")];
  const texts = (shadow) => labelsOf(shadow).map((label) => label.textContent);
  const edges = (shadow) => labelsOf(shadow).map((label) => label.style.getPropertyValue("--slabton-tick-e"));

  it("renders none without scale.labels", () => {
    expect(labelsOf(setup({ entity: "sensor.t", scale: { ticks: 4 } }).shadow)).toHaveLength(0);
    expect(labelsOf(setup({ entity: "sensor.t" }).shadow)).toHaveLength(0);
  });

  it("puts the minimum and maximum at the first and last tick in value mode", () => {
    const { shadow } = setup({ entity: "sensor.soc", preset: "soc", scale: { ticks: 4, labels: true } });
    expect(texts(shadow)).toEqual(["0", "100"]);
    expect(edges(shadow)).toEqual(["0", "1"]);
    expect(shadow.querySelectorAll(".scale .tick")).toHaveLength(5);
  });

  it("puts the hours of a 24 h clock scale on the matching ticks", () => {
    const { shadow } = setup({ entity: undefined, mode: "clock", scale: { labels: true } });
    expect(texts(shadow)).toEqual(["0", "6", "12", "18", "24"]);
    expect(edges(shadow)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
  });

  it("labels a 12 h clock scale with the hours of the 24 h day, at the position of that hour", () => {
    const { shadow } = setup({ entity: undefined, mode: "clock", clock: { hour_format: "12" }, scale: { labels: true } });
    expect(texts(shadow)).toEqual(["0", "6", "12", "18", "24"]);
    expect(edges(shadow)).toEqual(["0", "0.25", "0.5", "0.75", "1"]);
  });

  it("mirrors the labels like the ticks for rtl and vertical bars", () => {
    const base = { entity: "sensor.soc", preset: "soc", scale: { ticks: 4, labels: true } };
    expect(edges(setup({ ...base, direction: "rtl" }).shadow)).toEqual(["1", "0"]);
    expect(edges(setup({ ...base, orientation: "vertical" }).shadow)).toEqual(["1", "0"]);
  });

  it("puts the state names where the handle stops, also between ticks and mirrored vertically", () => {
    const states = [{ value: "Off" }, { value: "Auto" }, { value: "On" }, { value: "Idle" }];
    const base = { entity: "input_select.s", mode: "state", states, orientation: "vertical", scale: { labels: true } };
    const { shadow } = setup(base);
    expect(texts(shadow)).toEqual(["Off", "Auto", "On", "Idle"]);
    expect(edges(shadow)).toEqual(["1", "0.6667", "0.3333", "0"]);
  });

  it("renders no labels in modes without any and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { shadow } = setup({ entity: "lock.a", scale: { labels: true } });
    expect(labelsOf(shadow)).toHaveLength(0);
    expect(shadow.querySelectorAll(".scale .tick").length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/scale\.labels is not available/));
    warn.mockRestore();
  });

  it("keeps the labels when the view updates and shows them as plain text", () => {
    const { config, shadow, refs } = setup({ entity: "sensor.soc", preset: "soc", scale: { ticks: 2, labels: true } });
    const before = labelsOf(shadow);
    updateView(refs, config, {
      pos: 0.5, fillPos: 0.5, icon: "mdi:gauge", text: "50", positionText: "50", color: null, unavailable: false, ariaNow: 50, ariaText: "50",
    });
    expect(labelsOf(shadow)).toHaveLength(2);
    expect(labelsOf(shadow).every((label, i) => label === before[i])).toBe(true);
    expect(labelsOf(shadow).every((label) => label.children.length === 0)).toBe(true);
  });
});

describe("analog dial", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete document.hidden;
    document.body.innerHTML = "";
  });

  const analog =(extra = {}, clock = {}) => setup({
    entity: undefined, mode: "clock", clock: { display: "analog", time_zone: "UTC", ...clock }, ...extra,
  });
  const clockView = (extra = {}) => ({
    pos: 0.5, fillPos: 0.5, icon: "mdi:clock-outline", text: "12:00", positionText: "50", color: null,
    unavailable: false, ariaNow: 50, ariaText: "12:00", ...extra,
  });
  const numbers = (shadow) => [...shadow.querySelectorAll(".dial-num")].map((n) => n.textContent);

  it("renders no dial for the digital clock or any other mode", () => {
    for (const extra of [{ entity: undefined, mode: "clock" }, {}, { entity: "sensor.t" }]) {
      const { shadow, refs } = setup(extra);
      expect(shadow.querySelector(".dial")).toBeNull();
      expect(refs.dial).toBeNull();
    }
  });

  it("renders an aria-hidden SVG in the handle next to the icon and the text", () => {
    const { shadow, refs } = analog();
    const svg = shadow.querySelector(".content > svg.dial");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("viewBox")).toBe("-50 -50 100 100");
    expect(refs.icon.parentElement).toBe(refs.content);
    expect(refs.text.parentElement).toBe(refs.content);
  });

  it("draws the hour and minute hands, the seconds hand only with clock.seconds", () => {
    const without = analog();
    expect(without.refs.dial.hour).not.toBeNull();
    expect(without.refs.dial.minute).not.toBeNull();
    expect(without.refs.dial.second).toBeNull();
    expect(without.shadow.querySelector(".hand-second")).toBeNull();
    const withSeconds = analog({}, { seconds: true });
    expect(withSeconds.refs.dial.second).not.toBeNull();
  });

  it("draws 12 tick marks with 4 emphasised quarters, or none with ticks: false", () => {
    const on = analog().shadow;
    expect(on.querySelectorAll(".dial-tick")).toHaveLength(12);
    expect(on.querySelectorAll(".dial-tick.quarter")).toHaveLength(4);
    expect(analog({}, { face: { ticks: false } }).shadow.querySelectorAll(".dial-tick")).toHaveLength(0);
  });

  it("draws no numbers, the quarters or all twelve", () => {
    expect(numbers(analog().shadow)).toEqual([]);
    expect(numbers(analog({ handle_size: 60 }, { face: { numbers: "quarters" } }).shadow)).toEqual(["12", "3", "6", "9"]);
    expect(numbers(analog({ handle_size: 80 }, { face: { numbers: "all" } }).shadow))
      .toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  });

  it("places the numbers around the dial: 12 on top, 3 right, 6 bottom, 9 left", () => {
    const { shadow } = analog({ handle_size: 60 }, { face: { numbers: "quarters", ticks: false } });
    const at = (hour) => {
      const el = [...shadow.querySelectorAll(".dial-num")].find((n) => n.textContent === hour);
      return [Number(el.getAttribute("x")), Number(el.getAttribute("y"))];
    };
    expect(at("12")).toEqual([0, -37]);
    expect(at("3")).toEqual([37, 0]);
    expect(at("6")).toEqual([0, 37]);
    expect(at("9")).toEqual([-37, 0]);
  });

  it("builds the SVG from fixed elements only, without any configuration string", () => {
    const { shadow } = analog({ name: "Küche", icon: "mdi:fire", handle_size: 80 }, {
      time_zone: "Europe/Berlin", seconds: true, face: { numbers: "all" },
    });
    const svg = shadow.querySelector(".dial");
    const tags = new Set([...svg.querySelectorAll("*")].map((el) => el.tagName.toLowerCase()));
    expect([...tags].sort()).toEqual(["circle", "g", "line", "text"]);
    for (const secret of ["Küche", "mdi:fire", "Berlin", "analog", "all"]) expect(svg.outerHTML).not.toContain(secret);
  });

  it("hides the handle text and icon and turns the hands from the view", () => {
    const { config, refs } = analog({}, { seconds: true });
    updateView(refs, config, clockView({ dial: { hour: 105, minute: 184.5, second: 270 } }));
    expect(refs.text.hidden).toBe(true);
    expect(refs.text.textContent).toBe("");
    expect(refs.icon.hidden).toBe(true);
    expect(refs.dial.hour.getAttribute("transform")).toBe("rotate(105)");
    expect(refs.dial.minute.getAttribute("transform")).toBe("rotate(184.5)");
    expect(refs.dial.second.getAttribute("transform")).toBe("rotate(270)");
  });

  it("rounds the angles to two decimals and ignores a missing seconds angle", () => {
    const { config, refs } = analog({}, { seconds: true });
    updateView(refs, config, clockView({ dial: { hour: 59.50000000000001, minute: 1 / 3, second: null } }));
    expect(refs.dial.hour.getAttribute("transform")).toBe("rotate(59.5)");
    expect(refs.dial.minute.getAttribute("transform")).toBe("rotate(0.33)");
    expect(refs.dial.second.hasAttribute("transform")).toBe(false);
  });

  it("changes only the transform attributes between updates", () => {
    const { config, shadow, refs } = analog({}, { seconds: true });
    const handle = refs.handle;
    const svg = shadow.querySelector(".dial");
    const markup = svg.innerHTML.replace(/ transform="rotate\([\d.]+\)"/g, "");
    updateView(refs, config, clockView({ dial: { hour: 0, minute: 0, second: 0 } }));
    updateView(refs, config, clockView({ dial: { hour: 0, minute: 0.1, second: 6 } }));
    expect(refs.dial.second.getAttribute("transform")).toBe("rotate(6)");
    expect(shadow.querySelector(".handle")).toBe(handle);
    expect(shadow.querySelector(".dial")).toBe(svg);
    expect(svg.innerHTML.replace(/ transform="rotate\([\d.]+\)"/g, "")).toBe(markup);
  });

  it("does not replay the handle animation when only the hands move", () => {
    const { config, refs } = analog({ animation: "pulse" });
    updateView(refs, config, clockView({ dial: { hour: 0, minute: 0, second: null } }));
    updateView(refs, config, clockView({ text: "12:01", dial: { hour: 0.5, minute: 6, second: null } }));
    expect(refs.handle.classList.contains("changed")).toBe(false);
  });

  it("turns the hands every second without rebuilding the card", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 0, 1, 15, 30, 45));
    // Like card.test.js: the tick only runs while the page counts as visible.
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    const el = document.createElement("slabton-card");
    el.setConfig({ type: "custom:slabton-card", mode: "clock", clock: { display: "analog", time_zone: "UTC", seconds: true } });
    el.hass = createHass({}, { config: { time_zone: "UTC" } });
    document.body.appendChild(el);
    vi.advanceTimersByTime(0);

    const root = el.shadowRoot;
    const handle = root.querySelector(".handle");
    const svg = root.querySelector(".dial");
    const second = root.querySelector(".hand-second");
    const minute = root.querySelector(".hand-minute");
    expect(second.getAttribute("transform")).toBe("rotate(270)");
    expect(minute.getAttribute("transform")).toBe("rotate(184.5)");

    vi.advanceTimersByTime(1000);
    expect(second.getAttribute("transform")).toBe("rotate(276)");
    expect(minute.getAttribute("transform")).toBe("rotate(184.6)");
    vi.advanceTimersByTime(15000);
    expect(second.getAttribute("transform")).toBe("rotate(6)");

    expect(root.querySelector(".handle")).toBe(handle);
    expect(root.querySelector(".dial")).toBe(svg);
    expect(root.querySelector(".hand-second")).toBe(second);
    expect(root.querySelector(".h-text").hidden).toBe(true);
  });

  it("falls back to the digital text below the minimum handle size", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { shadow, config, refs } = analog({ handle_size: 24 });
    expect(config.clock.display).toBe("digital");
    expect(shadow.querySelector(".dial")).toBeNull();
    updateView(refs, config, clockView());
    expect(refs.text.textContent).toBe("12:00");
    warn.mockRestore();
  });
});

describe("rootClasses", () => {
  it("encodes orientation, direction, shape, animation and drag", () => {
    const c = normalizeConfig({ entity: "sensor.t", orientation: "vertical", direction: "rtl", handle_shape: "oval", animation: "pulse" });
    const classes = rootClasses(c).split(" ");
    expect(classes).toEqual(expect.arrayContaining(["o-v", "dir-rtl", "rev", "shape-oval", "anim-pulse", "nodrag"]));
  });

  it("never adds a scale-full class in any mode: scale, fill edge and labels share the handle-centre track", () => {
    const classes = (mode, extra = {}) => rootClasses(normalizeConfig({ entity: "sensor.t", mode, ...extra })).split(" ");
    for (const mode of ["value", "counter", "timer", "clock", "state", "lock"]) expect(classes(mode)).not.toContain("scale-full");
  });

  it("marks nodrag only for a state card whose handle shows its own attribute", () => {
    const classes = (extra) => rootClasses(normalizeConfig({ entity: "cover.c", mode: "state", ...extra })).split(" ");
    expect(classes({ bar: { attribute: "current_position" } })).toContain("nodrag");
    expect(classes({ bar: { entity: "cover.d", attribute: "current_position" } })).not.toContain("nodrag");
    expect(classes({})).not.toContain("nodrag");
  });

  it("does not mark scale-full for a bar attribute in the state mode either", () => {
    const classes = rootClasses(normalizeConfig({ entity: "cover.c", mode: "state", bar: { attribute: "current_position" } })).split(" ");
    expect(classes).not.toContain("scale-full");
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

  it("fills the handle with the state color in every mode, the icon color comes from the CSS", () => {
    const { config, refs } = setup({ icon: "mdi:fan", states: [{ value: "on", color: "orange" }, "off", "auto"] });
    updateView(refs, config, { ...stateMode.view(config, modeState), iconColor: "orange" });
    expect(refs.handle.style.getPropertyValue("--slabton-handle-fill")).toBe("orange");
    expect(refs.icon.style.color).toBe("");
    // handle_color keeps the old look: no fill variable, the icon takes the state color.
    const own = setup({ icon: "mdi:fan", handle_color: "white" });
    updateView(own.refs, own.config, { ...stateMode.view(own.config, modeState), iconColor: "orange" });
    expect(own.refs.handle.style.getPropertyValue("--slabton-handle-fill")).toBe("");
    expect(own.refs.icon.style.color).toBe("orange");
  });

  it("writes the length of the handle text as --slabton-chars (at least 1) for the font size to fit", () => {
    const text = setup({ handle_content: "text" });
    updateView(text.refs, text.config, { ...stateMode.view(text.config, modeState), text: "23.5 °C" });
    expect(text.refs.handle.style.getPropertyValue("--slabton-chars")).toBe("7");
    updateView(text.refs, text.config, { ...stateMode.view(text.config, modeState), text: "" });
    expect(text.refs.handle.style.getPropertyValue("--slabton-chars")).toBe("1");
    const icon = setup({ icon: "mdi:fan" });
    updateView(icon.refs, icon.config, stateMode.view(icon.config, modeState));
    expect(icon.refs.handle.style.getPropertyValue("--slabton-chars")).toBe("1");
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

  it("marks unavailable entities as disabled but keeps them focusable for more-info", () => {
    const { config, refs } = setup();
    updateView(refs, config, stateMode.view(config, undefined));
    expect(refs.root.classList.contains("unavailable")).toBe(true);
    expect(refs.handle.getAttribute("tabindex")).toBe("0");
    expect(refs.handle.getAttribute("aria-disabled")).toBe("true");
  });

  describe("unavailable hint", () => {
    const unavailableView = (config, extra = {}) => ({
      ...stateMode.view(config, undefined), unavailableText: "Entity unavailable", ...extra,
    });

    it("shows the warning icon whatever handle_content says", () => {
      for (const handle_content of ["icon", "position", "text", "none"]) {
        const { config, refs } = setup({ handle_content, icon: "mdi:fan" });
        updateView(refs, config, unavailableView(config));
        expect(refs.icon.hidden, handle_content).toBe(false);
        expect(refs.icon.getAttribute("icon"), handle_content).toBe("mdi:alert-circle-outline");
        expect(refs.text.hidden, handle_content).toBe(true);
        expect(refs.text.textContent, handle_content).toBe("");
      }
    });

    it("puts the reason in the root title and in aria-valuetext", () => {
      const { config, refs } = setup();
      updateView(refs, config, unavailableView(config));
      expect(refs.root.getAttribute("title")).toBe("Entity unavailable");
      expect(refs.handle.getAttribute("aria-valuetext")).toBe("Entity unavailable");
    });

    it("also puts the reason in aria-description, because the switch role of lock mode has no aria-valuetext", () => {
      const { config, refs } = setup();
      updateView(refs, config, unavailableView(config));
      expect(refs.handle.getAttribute("aria-description")).toBe("Entity unavailable");
      updateView(refs, config, stateMode.view(config, modeState));
      expect(refs.handle.hasAttribute("aria-description")).toBe(false);
    });

    it("goes back to the normal icon, text and title when the entity is available again", () => {
      const { config, refs } = setup({ handle_content: "text" });
      updateView(refs, config, unavailableView(config));
      updateView(refs, config, stateMode.view(config, modeState));
      expect(refs.root.hasAttribute("title")).toBe(false);
      expect(refs.icon.hidden).toBe(true);
      expect(refs.text.textContent).toBe("on");
      expect(refs.handle.getAttribute("aria-valuetext")).toBe("on");
    });

    it("keeps the handle enabled with allow_unavailable_actions", () => {
      const { config, refs } = setup({ allow_unavailable_actions: true });
      updateView(refs, config, unavailableView(config));
      expect(refs.root.classList.contains("allow-actions")).toBe(true);
      expect(refs.handle.getAttribute("aria-disabled")).toBe("false");
      expect(refs.handle.getAttribute("tabindex")).toBe("0");
      expect(refs.icon.getAttribute("icon")).toBe("mdi:alert-circle-outline");
    });

    it("sets the blocked class from view.blocked and falls back to view.unavailable", () => {
      const { config, refs } = setup();
      updateView(refs, config, unavailableView(config));
      expect(refs.root.classList.contains("blocked")).toBe(true);
      updateView(refs, config, { ...unavailableView(config), blocked: false });
      expect(refs.root.classList.contains("unavailable")).toBe(true);
      expect(refs.root.classList.contains("blocked")).toBe(false);
      expect(refs.handle.getAttribute("aria-disabled")).toBe("false");
      updateView(refs, config, stateMode.view(config, modeState));
      expect(refs.root.classList.contains("blocked")).toBe(false);
    });

    it("adds no allow-actions class by default", () => {
      expect(setup().refs.root.classList.contains("allow-actions")).toBe(false);
    });
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

describe("switch states", () => {
  const states = [{ value: "auto", icon: "mdi:robot", color: "green", label: "Auto" }, { value: "off", color: "gray" }];
  const run = (state) => {
    const { config, refs } = setup({ switches: { end: { entity: "sensor.m", icon: "mdi:circle-outline", name: "Mode", states } } });
    updateSwitches(refs, config, createHass(state == null ? {} : { "sensor.m": makeState("sensor.m", state) }));
    const icon = refs.switches.end.querySelector("ha-icon");
    return { icon, button: refs.switches.end };
  };

  it("shows icon, color and label of the matching state", () => {
    const { icon, button } = run("auto");
    expect(icon.getAttribute("icon")).toBe("mdi:robot");
    expect(icon.style.color).toBe("green");
    expect(button.getAttribute("aria-label")).toBe("Auto");
  });

  it("keeps the default icon when a state has none", () => {
    const { icon } = run("off");
    expect(icon.getAttribute("icon")).toBe("mdi:circle-outline");
    expect(icon.style.color).toBe("gray");
  });

  it("falls back to the default icon without color for unknown, unavailable or missing states", () => {
    for (const state of ["nap", "unavailable", null]) {
      const { icon, button } = run(state);
      expect(icon.getAttribute("icon")).toBe("mdi:circle-outline");
      expect(icon.style.color).toBe("");
      expect(button.getAttribute("aria-label")).toBe("Mode");
    }
  });
});

describe("zoneOf", () => {
  it("splits the bar into thirds", () => {
    expect([0, 0.3, 1 / 3, 0.5, 2 / 3, 0.67, 1].map(zoneOf)).toEqual(["start", "start", "mid", "mid", "mid", "end", "end"]);
    expect(zoneOf(NaN)).toBe("start");
  });
});

describe("switch aria-label", () => {
  it("drops a state label that no longer matches when the switch has no name", () => {
    const { config, refs } = setup({ switches: { end: { entity: "sensor.m", states: [{ value: "auto", label: "Auto" }] } } });
    updateSwitches(refs, config, createHass({ "sensor.m": makeState("sensor.m", "auto") }));
    expect(refs.switches.end.getAttribute("aria-label")).toBe("Auto");
    updateSwitches(refs, config, createHass({ "sensor.m": makeState("sensor.m", "nap") }));
    expect(refs.switches.end.hasAttribute("aria-label")).toBe(false);
  });
});

describe("segmented bar", () => {
  const valueConfig = (segments, extra = {}) => ({
    entity: "sensor.x", mode: "value", min: 0, max: 100, bar: { segments }, ...extra,
  });
  const view = (fillPos) => ({ pos: fillPos, fillPos, icon: "mdi:x", text: "", positionText: "", ariaNow: 0 });
  const activeAt = (config, refs, fillPos) => {
    updateView(refs, config, view(fillPos));
    return refs.root.style.getPropertyValue("--slabton-seg-k");
  };

  it("adds one segment layer and the seg-on class only with bar.segments", () => {
    const { shadow, refs } = setup(valueConfig(10));
    expect(shadow.querySelectorAll(".bar > .segs")).toHaveLength(1);
    expect(shadow.querySelector(".segs").getAttribute("aria-hidden")).toBe("true");
    expect(shadow.querySelector(".segs").children).toHaveLength(0);
    expect(refs.root.classList.contains("seg-on")).toBe(true);
    const plain = setup({ entity: "sensor.x", mode: "value" });
    expect(plain.shadow.querySelector(".segs")).toBeNull();
    expect(plain.refs.root.classList.contains("seg-on")).toBe(false);
  });

  it("keeps the rest of the bar: fill layer, handle and scale stay", () => {
    const { shadow } = setup(valueConfig({ count: 6 }, { scale: true }));
    for (const selector of [".fill", ".handle", ".scale", ".rail"]) expect(shadow.querySelector(selector), selector).not.toBeNull();
  });

  it("rounds to whole segments at 0, 55 and 100 percent", () => {
    const { config, refs } = setup(valueConfig(10));
    expect(activeAt(config, refs, 0)).toBe("0");
    expect(activeAt(config, refs, 0.04)).toBe("0");
    expect(activeAt(config, refs, 0.06)).toBe("1");
    expect(activeAt(config, refs, 0.55)).toBe("6");
    expect(activeAt(config, refs, 1)).toBe("10");
  });

  it("follows the configured segment count", () => {
    const { config, refs } = setup(valueConfig({ count: 4 }));
    expect(activeAt(config, refs, 0.5)).toBe("2");
    expect(activeAt(config, refs, 0.6)).toBe("2");
    expect(activeAt(config, refs, 0.7)).toBe("3");
  });

  it("follows the drag position, like the fill", () => {
    const { config, refs } = setup(valueConfig(10));
    updateView(refs, config, view(0.2), { dragPos: 0.8 });
    expect(refs.root.style.getPropertyValue("--slabton-seg-k")).toBe("8");
    expect(refs.root.style.getPropertyValue("--slabton-p")).toBe("0.8");
  });

  it("never leaves 0 to count, whatever the position", () => {
    expect(segmentsActive(10, -1)).toBe(0);
    expect(segmentsActive(10, 2)).toBe(10);
    expect(segmentsActive(10, NaN)).toBe(0);
    expect(segmentsActive(10, undefined)).toBe(0);
  });

  it("sets no segment variable on a card without segments", () => {
    const { config, refs } = setup({ entity: "sensor.x", mode: "value" });
    updateView(refs, config, view(0.5));
    expect(refs.root.style.getPropertyValue("--slabton-seg-k")).toBe("");
  });

  it("keeps the classes of both orientations and of rtl next to seg-on", () => {
    const horizontal = setup(valueConfig(10)).refs.root.className;
    expect(horizontal).toContain("o-h");
    expect(horizontal).toContain("seg-on");
    const vertical = setup(valueConfig(10, { orientation: "vertical", direction: "rtl" })).refs.root.className;
    expect(vertical).toContain("o-v");
    expect(vertical).toContain("rev");
    expect(vertical).toContain("seg-on");
  });
});

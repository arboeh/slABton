import { describe, expect, it, vi } from "vitest";
import { SlabtonCardEditor, buildSchema, cleanConfig } from "../../src/ui/editor.js";

if (!customElements.get("slabton-card-editor")) customElements.define("slabton-card-editor", SlabtonCardEditor);

const names = (schema) => schema.flatMap((item) => (item.schema ? names(item.schema) : [item.name]));

describe("buildSchema", () => {
  it("always offers the common fields", () => {
    const n = names(buildSchema({ entity: "input_select.a" }));
    expect(n).toEqual(expect.arrayContaining(["entity", "mode", "name", "icon", "orientation", "handle_shape", "animation", "tap_action", "hold_action"]));
  });

  it("offers the header icon position", () => {
    expect(names(buildSchema({ entity: "input_select.a" }))).toContain("header_icon_position");
  });

  it("shows state fields for multi-state entities", () => {
    const n = names(buildSchema({ entity: "input_select.a" }));
    expect(n).toEqual(expect.arrayContaining(["drag", "hold_reverse"]));
    expect(n).not.toContain("swipe_threshold");
  });

  it("shows lock fields for locks and alarm panels", () => {
    expect(names(buildSchema({ entity: "lock.a" }))).toEqual(expect.arrayContaining(["swipe_threshold", "arm_service"]));
    expect(names(buildSchema({ entity: "alarm_control_panel.a" }))).toContain("swipe_threshold");
  });

  it("shows value fields for sensors and honors an explicit mode", () => {
    expect(names(buildSchema({ entity: "sensor.a" }))).toEqual(expect.arrayContaining(["preset", "min", "max", "unit", "decimals"]));
    expect(names(buildSchema({ entity: "sensor.a", mode: "lock" }))).toContain("swipe_threshold");
  });

  it("only offers fixed_position for the fixed handle position", () => {
    expect(names(buildSchema({ entity: "switch.a" }))).not.toContain("fixed_position");
    expect(names(buildSchema({ entity: "switch.a", handle_position: "fixed" }))).toContain("fixed_position");
  });

  it("works without an entity", () => {
    expect(names(buildSchema({}))).toContain("entity");
    expect(names(buildSchema())).toContain("entity");
  });

  it("shows counter, timer and clock blocks for their modes", () => {
    const counter = buildSchema({ entity: "counter.a" });
    expect(counter.find((item) => item.name === "counter").schema.map((f) => f.name)).toEqual(["min", "max"]);
    const timer = buildSchema({ entity: "timer.a" });
    expect(timer.find((item) => item.name === "timer").schema.map((f) => f.name)).toEqual(
      ["pulse", "pulse_seconds", "info", "time_zone", "span"],
    );
    const clock = buildSchema({ mode: "clock" });
    expect(clock.find((item) => item.name === "clock").schema.map((f) => f.name)).toEqual(
      ["display", "hour_format", "seconds", "time_zone"],
    );
    expect(names(counter)).not.toContain("pulse");
    expect(names(timer)).not.toContain("hour_format");
  });

  it("offers only the digital clock and does not require an entity for it", () => {
    const clock = buildSchema({ mode: "clock" });
    const display = clock.find((item) => item.name === "clock").schema.find((f) => f.name === "display");
    expect(display.selector.select.options.map((o) => o.value)).toEqual(["digital"]);
    expect(clock.find((item) => item.name === "entity").required).toBe(false);
    expect(buildSchema({ entity: "timer.a" }).find((item) => item.name === "entity").required).toBe(true);
  });

  it("offers bar_text and the bar block in every mode", () => {
    for (const config of [{ entity: "switch.a" }, { entity: "lock.a" }, { entity: "sensor.a" }]) {
      const schema = buildSchema(config);
      expect(names(schema)).toContain("bar_text");
      expect(schema.find((item) => item.name === "bar").schema.find((f) => f.name === "entity")).toBeDefined();
    }
  });

  it("translates section titles", () => {
    const titles = (lang) => buildSchema({ entity: "switch.a" }, lang).filter((i) => i.type === "expandable").map((i) => i.title);
    expect(titles("en")).toEqual(["Bar value", "Layout", "Colors", "Actions"]);
    expect(titles("de")).toEqual(["Balkenwert", "Layout", "Farben", "Aktionen"]);
  });
});

describe("cleanConfig", () => {
  it("drops cleared values but keeps false and 0", () => {
    expect(cleanConfig({ a: undefined, b: null, c: "", d: 0, e: false, f: "x" })).toEqual({ d: 0, e: false, f: "x" });
  });
});

describe("SlabtonCardEditor", () => {
  it("warns when the form component cannot be loaded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.loadCardHelpers = () => Promise.reject(new Error("no helpers"));
    const editor = document.createElement("slabton-card-editor");
    document.body.appendChild(editor);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no helpers/));
    delete window.loadCardHelpers;
    editor.remove();
    warn.mockRestore();
  });

  it("falls back to a YAML hint without ha-form", () => {
    const editor = document.createElement("slabton-card-editor");
    editor.setConfig({ entity: "switch.a" });
    expect(editor.shadowRoot.textContent).toMatch(/YAML/);
  });

  it("renders ha-form and emits config-changed", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const editor = document.createElement("slabton-card-editor");
    const hass = { states: {} };
    editor.hass = hass;
    editor.setConfig({ type: "custom:slabton-card", entity: "switch.a" });

    const form = editor.shadowRoot.querySelector("ha-form");
    expect(form).not.toBeNull();
    expect(form.hass).toBe(hass);
    expect(form.data).toEqual({ type: "custom:slabton-card", entity: "switch.a" });
    expect(form.schema.length).toBeGreaterThan(3);
    expect(form.computeLabel({ name: "handle_shape" })).toBe("Handle shape");
    expect(form.computeLabel({ name: "unknown", title: "Layout" })).toBe("Layout");

    const handler = vi.fn();
    editor.addEventListener("config-changed", handler);
    form.dispatchEvent(new CustomEvent("value-changed", {
      detail: { value: { type: "custom:slabton-card", entity: "lock.door", name: "" } },
    }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.config).toEqual({ type: "custom:slabton-card", entity: "lock.door" });
    expect(names(form.schema)).toContain("swipe_threshold");
  });

  it("labels fields in the language of the user", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const editor = document.createElement("slabton-card-editor");
    editor.hass = { states: {}, locale: { language: "de" } };
    editor.setConfig({ entity: "switch.a" });
    const form = editor.shadowRoot.querySelector("ha-form");
    expect(form.computeLabel({ name: "handle_shape" })).toBe("Griffform");
    expect(form.computeLabel({ name: "entity", labelKey: "editor.entity_bar" })).toBe("Entität für den Balkenwert (optional)");
    expect(form.computeLabel({ name: "unknown", title: "Titel" })).toBe("Titel");
    expect(form.computeLabel({ name: "", title: "Farben" })).toBe("Farben");
    expect(names(form.schema)).toContain("bar_text");
  });

  it("forwards hass updates to the form", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const editor = document.createElement("slabton-card-editor");
    editor.setConfig({ entity: "switch.a" });
    const next = { states: { a: 1 } };
    editor.hass = next;
    expect(editor.shadowRoot.querySelector("ha-form").hass).toBe(next);
    expect(editor.hass).toBe(next);
  });
});

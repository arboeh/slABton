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

  it("offers allow_unavailable_actions in state mode only", () => {
    expect(names(buildSchema({ entity: "input_select.a" }))).toContain("allow_unavailable_actions");
    for (const entity of ["lock.a", "sensor.a", "counter.a", "timer.a"]) {
      expect(names(buildSchema({ entity })), entity).not.toContain("allow_unavailable_actions");
    }
    expect(names(buildSchema({ mode: "clock" }))).not.toContain("allow_unavailable_actions");
  });

  it("shows lock fields for locks and alarm panels", () => {
    expect(names(buildSchema({ entity: "lock.a" }))).toEqual(expect.arrayContaining(["swipe_threshold", "arm_service"]));
    expect(names(buildSchema({ entity: "alarm_control_panel.a" }))).toContain("swipe_threshold");
  });

  it("shows value fields for sensors and honors an explicit mode", () => {
    expect(names(buildSchema({ entity: "sensor.a" }))).toEqual(expect.arrayContaining(["preset", "min", "max", "unit", "decimals"]));
    expect(names(buildSchema({ entity: "sensor.a", mode: "lock" }))).toContain("swipe_threshold");
  });

  it("offers step and the drag switch in value mode", () => {
    const schema = buildSchema({ entity: "input_number.a" });
    expect(names(schema)).toEqual(expect.arrayContaining(["drag", "step"]));
    expect(names(buildSchema({ entity: "sensor.a" }))).toEqual(expect.arrayContaining(["drag", "step"]));
    expect(names(buildSchema({ entity: "lock.a" }))).not.toContain("step");
    expect(names(buildSchema({ entity: "input_select.a" }))).not.toContain("step");
  });

  it("lets the step take decimals", () => {
    const flat = (items) => items.flatMap((item) => (item.schema ? flat(item.schema) : [item]));
    const step = flat(buildSchema({ entity: "input_number.a" })).find((f) => f.name === "step");
    expect(step.selector.number).toMatchObject({ min: 0, step: "any", mode: "box" });
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

  it("offers the digital and the analog display and does not require an entity for the clock", () => {
    const clock = buildSchema({ mode: "clock" });
    const display = clock.find((item) => item.name === "clock").schema.find((f) => f.name === "display");
    expect(display.selector.select.options.map((o) => o.value)).toEqual(["digital", "analog"]);
    expect(clock.find((item) => item.name === "entity").required).toBe(false);
    expect(buildSchema({ entity: "timer.a" }).find((item) => item.name === "entity").required).toBe(true);
  });

  describe("dial fields", () => {
    const clockSection = (config) => buildSchema(config).find((item) => item.name === "clock");
    const face = (config) => clockSection(config).schema.find((item) => item.name === "face");

    it("show only for the analog display", () => {
      expect(face({ mode: "clock" })).toBeUndefined();
      expect(face({ mode: "clock", clock: {} })).toBeUndefined();
      expect(face({ mode: "clock", clock: { display: "digital" } })).toBeUndefined();
      expect(face({ mode: "clock", clock: "analog" })).toBeUndefined();
      expect(face({ mode: "clock", clock: { display: "analog" } })).toBeDefined();
    });

    it("offer numbers and ticks in a nested section next to the other clock fields", () => {
      const section = clockSection({ mode: "clock", clock: { display: "analog" } });
      expect(section.schema.map((f) => f.name)).toEqual(["display", "face", "hour_format", "seconds", "time_zone"]);
      const fields = face({ mode: "clock", clock: { display: "analog" } });
      expect(fields.type).toBe("expandable");
      expect(fields.schema.map((f) => f.name)).toEqual(["numbers", "ticks"]);
      expect(fields.schema[0].selector.select.options.map((o) => o.value)).toEqual(["none", "quarters", "all"]);
      expect(fields.schema[1].selector).toEqual({ boolean: {} });
    });

    it("never show in the other modes", () => {
      const analogBlock = { clock: { display: "analog" } };
      for (const config of [{ entity: "switch.a", ...analogBlock }, { entity: "timer.a", ...analogBlock }]) {
        expect(names(buildSchema(config))).not.toContain("face");
      }
    });
  });

  it("offers the tick labels switch in the scale section", () => {
    const fields = buildSchema({ entity: "sensor.a" }).find((item) => item.name === "scale").schema;
    expect(fields.find((f) => f.name === "labels").selector).toEqual({ boolean: {} });
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
    expect(titles("en")).toEqual(["Bar value", "Layout", "Colors", "Scale", "Appearance", "Actions"]);
    expect(titles("de")).toEqual(["Balkenwert", "Layout", "Farben", "Skala", "Darstellung", "Aktionen"]);
  });

  it("offers the scale fields in every mode", () => {
    for (const config of [{ entity: "switch.a" }, { entity: "lock.a" }, { entity: "sensor.a" }, { entity: "timer.a" }, { mode: "clock" }]) {
      const scale = buildSchema(config).find((item) => item.name === "scale");
      expect(scale.type).toBe("expandable");
      expect(scale.schema.map((f) => f.name)).toEqual(["enabled", "ticks", "position", "size", "color", "labels"]);
    }
  });

  it("offers the on/off switch as a boolean", () => {
    const fields = buildSchema({ entity: "switch.a" }).find((item) => item.name === "scale").schema;
    expect(fields.find((f) => f.name === "enabled").selector).toEqual({ boolean: {} });
  });

  it("limits ticks and size like the config does", () => {
    const fields = buildSchema({ entity: "switch.a" }).find((item) => item.name === "scale").schema;
    expect(fields.find((f) => f.name === "ticks").selector.number).toMatchObject({ min: 1, max: 100 });
    expect(fields.find((f) => f.name === "size").selector.number).toMatchObject({ min: 2 });
  });

  it("limits the tick length to the bar thickness of the config", () => {
    const sizeMax = (config) => buildSchema(config).find((item) => item.name === "scale").schema
      .find((f) => f.name === "size").selector.number.max;
    expect(sizeMax({ entity: "switch.a" })).toBe(48);
    expect(sizeMax({ entity: "switch.a", thickness: 60 })).toBe(60);
    expect(sizeMax({ entity: "switch.a", thickness: "30" })).toBe(30);
    expect(sizeMax({ entity: "switch.a", thickness: 999 })).toBe(200);
    expect(sizeMax({ entity: "switch.a", thickness: 5 })).toBe(12);
    expect(sizeMax({ entity: "switch.a", thickness: "abc" })).toBe(48);
  });

  it("offers the positions that fit the orientation", () => {
    const options = (config) => buildSchema(config).find((item) => item.name === "scale").schema
      .find((f) => f.name === "position").selector.select.options.map((o) => o.value);
    expect(options({ entity: "switch.a" })).toEqual(["top", "bottom", "start", "center", "end"]);
    expect(options({ entity: "switch.a", orientation: "horizontal" })).toEqual(["top", "bottom", "start", "center", "end"]);
    expect(options({ entity: "switch.a", orientation: "vertical" })).toEqual(["left", "right", "start", "center", "end"]);
  });

  it("offers font size and color per text area, the icon color only in the header", () => {
    const appearance = buildSchema({ entity: "switch.a" }).find((item) => item.name === "text");
    expect(appearance.type).toBe("expandable");
    expect(appearance.schema.map((item) => item.name)).toEqual(["header", "bar", "info", "button", "scale"]);
    const fields = (area) => appearance.schema.find((item) => item.name === area).schema.map((f) => f.name);
    expect(fields("header")).toEqual(["font_size", "color", "icon_color"]);
    for (const area of ["bar", "info", "button", "scale"]) expect(fields(area)).toEqual(["font_size", "color"]);
  });

  it("limits the font size like the config does", () => {
    const appearance = buildSchema({ entity: "switch.a" }).find((item) => item.name === "text");
    const size = appearance.schema[0].schema.find((f) => f.name === "font_size");
    expect(size.selector.number).toMatchObject({ min: 8, max: 48 });
  });

  it("offers the appearance section in every mode", () => {
    for (const config of [{ entity: "lock.a" }, { entity: "sensor.a" }, { entity: "timer.a" }, { mode: "clock" }]) {
      expect(buildSchema(config).some((item) => item.name === "text")).toBe(true);
    }
  });
});

describe("cleanConfig", () => {
  it("drops cleared values but keeps false and 0", () => {
    expect(cleanConfig({ a: undefined, b: null, c: "", d: 0, e: false, f: "x" })).toEqual({ d: 0, e: false, f: "x" });
  });

  it("drops cleared text fields and the maps they leave empty", () => {
    expect(cleanConfig({
      entity: "switch.a",
      text: { header: { font_size: 16, color: "" }, bar: { font_size: undefined, color: null }, info: {}, button: { color: "red" } },
    })).toEqual({ entity: "switch.a", text: { header: { font_size: 16 }, button: { color: "red" } } });
    expect(cleanConfig({ entity: "switch.a", text: { header: { color: "" }, bar: {} } })).toEqual({ entity: "switch.a" });
  });

  it("drops cleared scale fields and an empty scale map", () => {
    expect(cleanConfig({ entity: "switch.a", scale: { ticks: 8, position: "", size: undefined, color: null } }))
      .toEqual({ entity: "switch.a", scale: { ticks: 8 } });
    expect(cleanConfig({ entity: "switch.a", scale: { ticks: "", position: "" } })).toEqual({ entity: "switch.a" });
  });

  it("drops cleared clock fields, the empty face and an empty clock map", () => {
    expect(cleanConfig({ mode: "clock", clock: { display: "analog", face: { numbers: "", ticks: undefined }, time_zone: "" } }))
      .toEqual({ mode: "clock", clock: { display: "analog" } });
    expect(cleanConfig({ mode: "clock", clock: { face: {} } })).toEqual({ mode: "clock" });
    expect(cleanConfig({ mode: "clock", clock: { display: "analog", face: { numbers: "all", ticks: false }, seconds: false } }))
      .toEqual({ mode: "clock", clock: { display: "analog", face: { numbers: "all", ticks: false }, seconds: false } });
  });

  it("leaves other nested values untouched", () => {
    const data = { tap_action: { action: "perform-action", data: {} }, styles: { x: "" } };
    expect(cleanConfig(data)).toEqual(data);
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

  it("labels the step in both languages", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const labelOf = (language) => {
      const editor = document.createElement("slabton-card-editor");
      editor.hass = { states: {}, locale: { language } };
      editor.setConfig({ entity: "input_number.a" });
      return editor.shadowRoot.querySelector("ha-form").computeLabel({ name: "step" });
    };
    expect(labelOf("en")).toMatch(/step/i);
    expect(labelOf("de")).toMatch(/Schritt/);
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

  it("labels the appearance sections and fields in both languages", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const labelsOf = (language) => {
      const editor = document.createElement("slabton-card-editor");
      editor.hass = { states: {}, locale: { language } };
      editor.setConfig({ entity: "timer.a" });
      const form = editor.shadowRoot.querySelector("ha-form");
      const appearance = form.schema.find((item) => item.name === "text");
      const areas = appearance.schema;
      return {
        section: form.computeLabel(appearance),
        areas: areas.map((item) => form.computeLabel(item)),
        fields: areas[0].schema.map((f) => form.computeLabel(f)),
      };
    };
    expect(labelsOf("en")).toEqual({
      section: "Appearance",
      areas: ["Header", "Bar text", "Timer info", "Handle text", "Scale labels"],
      fields: ["Font size in px", "Color", "Icon color"],
    });
    expect(labelsOf("de")).toEqual({
      section: "Darstellung",
      areas: ["Kopfzeile", "Balkentext", "Timer-Info", "Griff-Text", "Skala-Beschriftung"],
      fields: ["Schriftgröße in px", "Farbe", "Symbolfarbe"],
    });
  });

  it("labels the scale section and fields in both languages", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const labelsOf = (language) => {
      const editor = document.createElement("slabton-card-editor");
      editor.hass = { states: {}, locale: { language } };
      editor.setConfig({ entity: "switch.a" });
      const form = editor.shadowRoot.querySelector("ha-form");
      const scale = form.schema.find((item) => item.name === "scale");
      return { section: form.computeLabel(scale), fields: scale.schema.map((f) => form.computeLabel(f)) };
    };
    expect(labelsOf("en")).toEqual({
      section: "Scale",
      fields: [
        "Show scale", "Segments (ticks = segments + 1)", "Position across the bar", "Tick length in px", "Tick color",
        "Show labels at the ticks",
      ],
    });
    expect(labelsOf("de")).toEqual({
      section: "Skala",
      fields: [
        "Skala anzeigen", "Segmente (Striche = Segmente + 1)", "Position quer zum Balken", "Strichlänge in px", "Strichfarbe",
        "Beschriftung an den Strichen anzeigen",
      ],
    });
  });

  it("labels the dial section and fields in both languages", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const labelsOf = (language) => {
      const editor = document.createElement("slabton-card-editor");
      editor.hass = { states: {}, locale: { language } };
      editor.setConfig({ mode: "clock", clock: { display: "analog" } });
      const form = editor.shadowRoot.querySelector("ha-form");
      const face = form.schema.find((item) => item.name === "clock").schema.find((item) => item.name === "face");
      return { section: form.computeLabel(face), fields: face.schema.map((f) => form.computeLabel(f)) };
    };
    expect(labelsOf("en")).toEqual({ section: "Dial (analog)", fields: ["Numbers on the dial", "Tick marks on the dial"] });
    expect(labelsOf("de")).toEqual({
      section: "Zifferblatt (analog)", fields: ["Ziffern auf dem Zifferblatt", "Strichmarken auf dem Zifferblatt"],
    });
  });

  it("drops an empty dial section the form sends back", () => {
    const { send } = setup({ mode: "clock", clock: { display: "analog" } });
    expect(send({ mode: "clock", clock: { display: "analog", face: {} } })).toEqual({ mode: "clock", clock: { display: "analog" } });
  });

  it("drops the dial section when the display goes back to digital, and an emptied clock map", () => {
    const { send } = setup({ mode: "clock", clock: { display: "analog", face: { numbers: "all" } } });
    expect(send({ mode: "clock", clock: { display: "digital", face: { numbers: "all" }, seconds: true } }))
      .toEqual({ mode: "clock", clock: { display: "digital", seconds: true } });
    expect(send({ mode: "clock", clock: { face: { numbers: "all" } } })).toEqual({ mode: "clock" });
    expect(send({ mode: "clock", clock: { display: "analog", face: { numbers: "all" } } }))
      .toEqual({ mode: "clock", clock: { display: "analog", face: { numbers: "all" } } });
  });

  it("shows the dial tick marks as on in the form while the option is not set", () => {
    const { form, editor } = setup({ mode: "clock", clock: { display: "analog" } });
    expect(form.data.clock.face).toEqual({ ticks: true });
    editor.setConfig({ mode: "clock", clock: { display: "analog", face: { numbers: "all", ticks: false } } });
    expect(form.data.clock.face).toEqual({ numbers: "all", ticks: false });
    editor.setConfig({ mode: "clock", clock: { display: "digital" } });
    expect(form.data.clock).toEqual({ display: "digital" });
    expect(editor._config.clock).toEqual({ display: "digital" });
  });

  /** Editor with `config`, a spy on config-changed and a helper that sends form values. */
  const setup = (config) => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const editor = document.createElement("slabton-card-editor");
    editor.setConfig(config);
    const form = editor.shadowRoot.querySelector("ha-form");
    const handler = vi.fn();
    editor.addEventListener("config-changed", handler);
    const send = (value) => {
      form.dispatchEvent(new CustomEvent("value-changed", { detail: { value } }));
      return handler.mock.calls.at(-1)[0].detail.config;
    };
    return { editor, form, send };
  };

  it("shows scale: true and scale: {} as an enabled, empty section", () => {
    expect(setup({ entity: "switch.a", scale: true }).form.data).toEqual({ entity: "switch.a", scale: { enabled: true } });
    expect(setup({ entity: "switch.a", scale: {} }).form.data).toEqual({ entity: "switch.a", scale: { enabled: true } });
  });

  it("shows the fields of a scale map next to the enabled switch", () => {
    expect(setup({ entity: "switch.a", scale: { ticks: 5 } }).form.data)
      .toEqual({ entity: "switch.a", scale: { enabled: true, ticks: 5 } });
  });

  it("shows the enabled switch on even when the YAML scale map has its own enabled: false", () => {
    expect(setup({ entity: "switch.a", scale: { enabled: false, ticks: 5 } }).form.data)
      .toEqual({ entity: "switch.a", scale: { enabled: true, ticks: 5 } });
  });

  it("refreshes the form data after a change, without waiting for setConfig", () => {
    const { form, send } = setup({ entity: "switch.a" });
    send({ entity: "switch.a", scale: { enabled: true } });
    expect(form.data).toEqual({ entity: "switch.a", scale: { enabled: true } });
    send({ entity: "switch.a", scale: { enabled: true, ticks: 5 } });
    expect(form.data).toEqual({ entity: "switch.a", scale: { enabled: true, ticks: 5 } });
    send({ entity: "switch.a", scale: { enabled: false, ticks: 5 } });
    expect(form.data).toEqual({ entity: "switch.a" });
  });

  it("shows scale: false like a missing scale", () => {
    expect(setup({ entity: "switch.a", scale: false }).form.data).toEqual({ entity: "switch.a" });
  });

  it("keeps scale: true and scale: {} when another field changes", () => {
    const withTrue = setup({ entity: "switch.a", scale: true });
    expect(withTrue.send({ entity: "switch.a", name: "N", scale: { enabled: true } }))
      .toEqual({ entity: "switch.a", name: "N", scale: true });
    const withMap = setup({ entity: "switch.a", scale: {} });
    expect(withMap.send({ entity: "switch.a", name: "N", scale: { enabled: true } }))
      .toEqual({ entity: "switch.a", name: "N", scale: true });
  });

  it("keeps a plain scale when the form sends an empty scale section", () => {
    const { send } = setup({ entity: "switch.a", scale: true });
    expect(send({ entity: "switch.a", name: "N", scale: {} })).toEqual({ entity: "switch.a", name: "N", scale: true });
  });

  it("stores the fields without the enabled switch", () => {
    const { send } = setup({ entity: "switch.a", scale: true });
    expect(send({ entity: "switch.a", scale: { enabled: true, ticks: 5, position: "" } }))
      .toEqual({ entity: "switch.a", scale: { ticks: 5 } });
  });

  it("falls back to scale: true when the last scale field is cleared", () => {
    const { send } = setup({ entity: "switch.a", scale: { ticks: 5 } });
    expect(send({ entity: "switch.a", scale: { enabled: true, ticks: "" } })).toEqual({ entity: "switch.a", scale: true });
    expect(send({ entity: "switch.a", scale: { ticks: undefined } })).toEqual({ entity: "switch.a", scale: true });
  });

  it("turns the scale on with the switch and off again, dropping the fields", () => {
    const { send } = setup({ entity: "switch.a" });
    expect(send({ entity: "switch.a", scale: { enabled: true } })).toEqual({ entity: "switch.a", scale: true });
    expect(send({ entity: "switch.a", scale: { enabled: false, ticks: 5, color: "red" } })).toEqual({ entity: "switch.a" });
  });

  it("turns the scale on by setting a field while it is off", () => {
    const { send } = setup({ entity: "switch.a" });
    expect(send({ entity: "switch.a", scale: { ticks: 5 } })).toEqual({ entity: "switch.a", scale: { ticks: 5 } });
  });

  it("drops scale: false when another field changes", () => {
    const { send } = setup({ entity: "switch.a", scale: false });
    expect(send({ entity: "switch.a", name: "N" })).toEqual({ entity: "switch.a", name: "N" });
  });

  it("maps the scale position when the orientation changes", () => {
    const horizontal = setup({ entity: "switch.a", scale: { position: "top" } });
    expect(horizontal.send({ entity: "switch.a", orientation: "vertical", scale: { enabled: true, position: "top" } }))
      .toEqual({ entity: "switch.a", orientation: "vertical", scale: { position: "left" } });
    expect(horizontal.send({ entity: "switch.a", orientation: "horizontal", scale: { enabled: true, position: "left" } }))
      .toEqual({ entity: "switch.a", orientation: "horizontal", scale: { position: "top" } });

    const bottom = setup({ entity: "switch.a", scale: { position: "bottom" } });
    expect(bottom.send({ entity: "switch.a", orientation: "vertical", scale: { enabled: true, position: "bottom" } }).scale)
      .toEqual({ position: "right" });
    expect(bottom.send({ entity: "switch.a", orientation: "horizontal", scale: { enabled: true, position: "right" } }).scale)
      .toEqual({ position: "bottom" });
  });

  it("keeps start, center and end and unrelated positions when the orientation changes", () => {
    for (const position of ["start", "center", "end", "middle", "constructor"]) {
      const { send } = setup({ entity: "switch.a", scale: { position } });
      expect(send({ entity: "switch.a", orientation: "vertical", scale: { enabled: true, position } }).scale).toEqual({ position });
    }
  });

  it("leaves the position alone while the orientation stays", () => {
    const { send } = setup({ entity: "switch.a", orientation: "vertical", scale: { position: "left" } });
    expect(send({ entity: "switch.a", orientation: "vertical", name: "N", scale: { enabled: true, position: "left" } }).scale)
      .toEqual({ position: "left" });
  });

  it("does not turn the scale on by itself", () => {
    if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
    const editor = document.createElement("slabton-card-editor");
    editor.setConfig({ entity: "switch.a" });
    const form = editor.shadowRoot.querySelector("ha-form");
    expect(form.data).toEqual({ entity: "switch.a" });
    const handler = vi.fn();
    editor.addEventListener("config-changed", handler);
    form.dispatchEvent(new CustomEvent("value-changed", { detail: { value: { entity: "switch.a", name: "N", scale: {} } } }));
    expect(handler.mock.calls[0][0].detail.config).toEqual({ entity: "switch.a", name: "N" });
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

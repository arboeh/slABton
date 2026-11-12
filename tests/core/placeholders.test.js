import { describe, expect, it } from "vitest";
import { EMPTY_VALUE, PLACEHOLDERS, renderTemplate, unknownPlaceholders } from "../../src/core/placeholders.js";

describe("renderTemplate", () => {
  it("replaces allowed placeholders", () => {
    const values = { remaining_text: "3 Tage", name: "Fest" };
    expect(renderTemplate("noch {remaining_text} bis {name}", values, "timer")).toBe("noch 3 Tage bis Fest");
  });

  it("shows a dash for allowed placeholders without a value", () => {
    expect(renderTemplate("{target}", { target: null }, "timer")).toBe(EMPTY_VALUE);
    expect(renderTemplate("{target}", { target: "" }, "timer")).toBe(EMPTY_VALUE);
    expect(renderTemplate("{elapsed}", {}, "timer")).toBe(EMPTY_VALUE);
  });

  it("keeps zero", () => {
    expect(renderTemplate("{days}d", { days: 0 }, "timer")).toBe("0d");
  });

  it("leaves names that the mode does not allow", () => {
    expect(renderTemplate("{remaining}", { remaining: "1:00" }, "counter")).toBe("{remaining}");
    expect(renderTemplate("{time}", { time: "10:00" }, "timer")).toBe("{time}");
    expect(renderTemplate("{time}", { time: "10:00" }, "clock")).toBe("10:00");
  });

  it("leaves unknown names and Jinja-style text alone", () => {
    expect(renderTemplate("{foo}", { foo: "x" }, "timer")).toBe("{foo}");
    expect(renderTemplate("{{ states('sensor.a') }}", { name: "x" }, "timer")).toBe("{{ states('sensor.a') }}");
    expect(renderTemplate("{{name}}", { name: "x" }, "timer")).toBe("{{name}}");
    expect(renderTemplate("{% if x %}{name}{% endif %}", { name: "x" }, "timer")).toBe("{% if x %}x{% endif %}");
  });

  it("does not evaluate anything", () => {
    for (const text of ["{constructor}", "{__proto__}", "{toString}", "{hasOwnProperty}", "{name.length}", "{name + 1}"]) {
      expect(renderTemplate(text, { name: "abc" }, "timer")).toBe(text);
    }
    expect(renderTemplate("{name}", Object.create({ name: "inherited" }), "timer")).toBe(EMPTY_VALUE);
  });

  it("passes markup through as plain text and does not expand $ patterns", () => {
    const payload = '<img src=x onerror="alert(1)">';
    expect(renderTemplate("{name}", { name: payload }, "timer")).toBe(payload);
    expect(renderTemplate("{name}", { name: "$& $1 $$" }, "timer")).toBe("$& $1 $$");
    expect(renderTemplate('<img onerror="x">{name}', { name: "a" }, "timer")).toBe('<img onerror="x">a');
  });

  it("handles empty and invalid input", () => {
    expect(renderTemplate("", {}, "timer")).toBe("");
    expect(renderTemplate(undefined, {}, "timer")).toBe("");
    expect(renderTemplate("{name}", undefined, "timer")).toBe(EMPTY_VALUE);
    expect(renderTemplate("{name}", { name: "a" }, "no-such-mode")).toBe("a");
  });
});

describe("unknownPlaceholders", () => {
  it("lists each unknown name once", () => {
    expect(unknownPlaceholders("{a} {b} {a} {name}", "timer")).toEqual(["a", "b"]);
    expect(unknownPlaceholders("{remaining}", "value")).toEqual(["remaining"]);
    expect(unknownPlaceholders("{{a}} {name}", "timer")).toEqual([]);
    expect(unknownPlaceholders(undefined, "timer")).toEqual([]);
  });
});

describe("PLACEHOLDERS", () => {
  it("offers the shared names in every mode", () => {
    for (const names of Object.values(PLACEHOLDERS)) expect(names).toEqual(expect.arrayContaining(["name", "state", "value"]));
  });
});

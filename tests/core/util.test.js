import { afterEach, describe, expect, it, vi } from "vitest";
import {
  axisFraction, clamp, escapeHtml, formatValue, isPlainObject, isUnavailable, pickEnum,
  pointerToFraction, resolveHandlePosition, safeCss, safeUrl, str, toNumber,
} from "../../src/core/util.js";

afterEach(() => vi.restoreAllMocks());

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("returns an empty string for null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("toNumber", () => {
  it("clamps into range", () => {
    expect(toNumber(500, 10, 0, 100)).toBe(100);
    expect(toNumber(-5, 10, 0, 100)).toBe(0);
  });

  it("falls back for missing or invalid values", () => {
    expect(toNumber(undefined, 10, 0, 100)).toBe(10);
    expect(toNumber("", 10, 0, 100)).toBe(10);
    expect(toNumber("abc", 10, 0, 100)).toBe(10);
  });

  it("accepts numeric strings", () => {
    expect(toNumber("42", 10, 0, 100)).toBe(42);
  });
});

describe("safeCss", () => {
  it("accepts colors and variables", () => {
    expect(safeCss(" red ")).toBe("red");
    expect(safeCss("var(--primary-color)")).toBe("var(--primary-color)");
    expect(safeCss("#ff0000")).toBe("#ff0000");
  });

  it("rejects declaration breakouts and urls", () => {
    expect(safeCss("red; background: blue")).toBeNull();
    expect(safeCss("red}")).toBeNull();
    expect(safeCss("url(http://x)")).toBeNull();
    expect(safeCss("javascript:alert(1)")).toBeNull();
    expect(safeCss("expression(1)")).toBeNull();
  });

  it("rejects functions and strings that load remote resources", () => {
    expect(safeCss('image-set("https://x/p.png" 1x)')).toBeNull();
    expect(safeCss("-webkit-image-set(foo 1x)")).toBeNull();
    expect(safeCss("src(var(--x))")).toBeNull();
    expect(safeCss("image(red)")).toBeNull();
    expect(safeCss("element(#id)")).toBeNull();
    expect(safeCss("paint(x)")).toBeNull();
    expect(safeCss("cross-fade(a, b)")).toBeNull();
    expect(safeCss("https://evil.example/x")).toBeNull();
    expect(safeCss("red 'x'")).toBeNull();
  });

  it("still accepts gradients, color functions and calc", () => {
    expect(safeCss("linear-gradient(90deg, red, blue)")).toBe("linear-gradient(90deg, red, blue)");
    expect(safeCss("color-mix(in srgb, red 40%, blue)")).toBe("color-mix(in srgb, red 40%, blue)");
    expect(safeCss("calc(100% - 4px)")).toBe("calc(100% - 4px)");
    expect(safeCss("rgb(0 128 255 / 50%)")).toBe("rgb(0 128 255 / 50%)");
  });

  it("returns the fallback for non-strings", () => {
    expect(safeCss(5, "x")).toBe("x");
    expect(safeCss("", "x")).toBe("x");
  });
});

describe("safeUrl", () => {
  it("allows http and https", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });

  it("blocks other protocols and garbage", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(5)).toBeNull();
  });
});

describe("pickEnum", () => {
  it("returns value, fallback, or throws", () => {
    expect(pickEnum("a", ["a", "b"], "b", "k")).toBe("a");
    expect(pickEnum(undefined, ["a", "b"], "b", "k")).toBe("b");
    expect(() => pickEnum("z", ["a", "b"], "b", "k")).toThrow(/invalid k "z" \(allowed: a, b\)/);
  });
});

describe("small helpers", () => {
  it("str trims and rejects empty", () => {
    expect(str("  x ")).toBe("x");
    expect(str("   ")).toBeNull();
    expect(str(3)).toBeNull();
  });

  it("isPlainObject", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });

  it("clamp", () => {
    expect(clamp(5, 0, 1)).toBe(1);
  });

  it("isUnavailable", () => {
    expect(isUnavailable(undefined)).toBe(true);
    expect(isUnavailable({ state: "unavailable" })).toBe(true);
    expect(isUnavailable({ state: "unknown" })).toBe(true);
    expect(isUnavailable({ state: "on" })).toBe(false);
  });

  it("formatValue places the unit", () => {
    expect(formatValue(21.456, 1, "°C")).toBe("21.5°C");
    expect(formatValue(55, 0, "%")).toBe("55%");
    expect(formatValue(120, 0, "W")).toBe("120 W");
    expect(formatValue(3, 2, null)).toBe("3.00");
  });
});

describe("axisFraction", () => {
  it("horizontal grows to the right, rtl reverses", () => {
    expect(axisFraction(0.25, true, false)).toBe(0.25);
    expect(axisFraction(0.25, true, true)).toBe(0.75);
  });

  it("vertical grows upwards, rtl reverses", () => {
    expect(axisFraction(0.25, false, false)).toBe(0.75);
    expect(axisFraction(0.25, false, true)).toBe(0.25);
  });
});

describe("pointerToFraction", () => {
  const base = { start: 100, size: 200, handleLen: 40, horizontal: true, reversed: false };

  it("maps the pointer onto the travel range", () => {
    expect(pointerToFraction({ ...base, coord: 120 })).toBe(0);
    expect(pointerToFraction({ ...base, coord: 220 })).toBe(0.5);
    expect(pointerToFraction({ ...base, coord: 320 })).toBe(1);
  });

  it("clamps outside the range", () => {
    expect(pointerToFraction({ ...base, coord: 0 })).toBe(0);
    expect(pointerToFraction({ ...base, coord: 999 })).toBe(1);
  });

  it("respects rtl and vertical orientation", () => {
    expect(pointerToFraction({ ...base, coord: 120, reversed: true })).toBe(1);
    expect(pointerToFraction({ ...base, coord: 120, horizontal: false })).toBe(1);
  });

  it("returns 0 for an unmeasured rail", () => {
    expect(pointerToFraction({ ...base, size: 0, coord: 50 })).toBe(0);
  });
});

describe("resolveHandlePosition", () => {
  const cfg = (handle_position, fixed_position = 50) => ({ handle_position, fixed_position });

  it("follows the value for flex", () => {
    expect(resolveHandlePosition(cfg("flex"), 0.3, true)).toBe(0.3);
  });

  it("supports fixed, switch, start, mid and end", () => {
    expect(resolveHandlePosition(cfg("fixed", 25), 0.9, true)).toBe(0.25);
    expect(resolveHandlePosition(cfg("switch"), 0.1, true)).toBe(1);
    expect(resolveHandlePosition(cfg("switch"), 0.9, false)).toBe(0);
    expect(resolveHandlePosition(cfg("start"), 0.9, true)).toBe(0);
    expect(resolveHandlePosition(cfg("mid"), 0.9, true)).toBe(0.5);
    expect(resolveHandlePosition(cfg("end"), 0.1, true)).toBe(1);
  });
});

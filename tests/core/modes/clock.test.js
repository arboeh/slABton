import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { defaultActions, isDraggable, needsTick, view } from "../../../src/core/modes/clock.js";

const cfg = (extra = {}) => normalizeConfig({ mode: "clock", ...extra });
// 2026-01-01 12:00:00 UTC
const NOW = Date.UTC(2026, 0, 1, 12);
const ctx = (extra = {}) => ({ now: NOW, lang: "en", locale: "de", hassTimeZone: null, expired: false, ...extra });

describe("view", () => {
  it("shows the time in the configured zone", () => {
    const v = view(cfg({ clock: { time_zone: "UTC", hour_format: "24" } }), undefined, undefined, ctx());
    expect(v.text).toBe("12:00");
    expect(v.ariaText).toBe("12:00");
    expect(v.values).toMatchObject({ state: "12:00", value: "12:00", time: "12:00" });
  });

  it("uses the Home Assistant zone when none is configured", () => {
    const v = view(cfg({ clock: { hour_format: "24" } }), undefined, undefined, ctx({ hassTimeZone: "Europe/Berlin" }));
    expect(v.text).toBe("13:00");
  });

  it("ignores an unknown Home Assistant zone", () => {
    expect(() => view(cfg(), undefined, undefined, ctx({ hassTimeZone: "Nowhere/Land" }))).not.toThrow();
  });

  it("fills the bar with the progress of the day", () => {
    const v = view(cfg({ clock: { time_zone: "UTC" } }), undefined, undefined, ctx());
    expect(v.fillPos).toBe(0.5);
    expect(v.pos).toBe(0.5);
    expect(v.positionText).toBe("50");
    expect(v.ariaNow).toBe(50);
  });

  it("shows seconds on request and is never unavailable", () => {
    const v = view(cfg({ clock: { time_zone: "UTC", hour_format: "24", seconds: true } }), undefined, undefined, ctx({ now: NOW + 5000 }));
    expect(v.text).toBe("12:00:05");
    expect(v.unavailable).toBe(false);
    expect(v.ticking).toBe(true);
  });

  it("names the clock by language, icon by default", () => {
    expect(view(cfg(), undefined, undefined, ctx()).values.name).toBe("Clock");
    expect(view(cfg(), undefined, undefined, ctx({ lang: "de" })).values.name).toBe("Uhr");
    expect(view(cfg({ name: "Home" }), undefined, undefined, ctx()).values.name).toBe("Home");
    expect(view(cfg(), undefined, undefined, ctx()).icon).toBe("mdi:clock-outline");
  });
});

describe("behaviour", () => {
  it("has no default actions, always ticks and is read-only", () => {
    const actions = defaultActions();
    expect(Object.values(actions).every((a) => a.action === "none")).toBe(true);
    expect(needsTick()).toBe(true);
    expect(isDraggable()).toBe(false);
  });
});

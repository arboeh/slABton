import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { defaultActions, dialAngles, isDraggable, needsTick, view } from "../../../src/core/modes/clock.js";

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

describe("dial", () => {
  const analog = (clock = {}) => cfg({ clock: { display: "analog", time_zone: "UTC", ...clock } });
  const dialAt = (config, now) => view(config, undefined, undefined, ctx({ now })).dial;

  it("is null for the digital clock", () => {
    expect(view(cfg(), undefined, undefined, ctx()).dial).toBeNull();
  });

  it("points all hands up at midnight and at noon, without a seconds hand by default", () => {
    expect(dialAt(analog(), Date.UTC(2026, 0, 1, 0))).toEqual({ hour: 0, minute: 0, second: null });
    expect(dialAt(analog(), NOW)).toEqual({ hour: 0, minute: 0, second: null });
  });

  it("turns the hour hand 30 degrees per hour and 0.5 per minute", () => {
    expect(dialAt(analog(), Date.UTC(2026, 0, 1, 3)).hour).toBe(90);
    expect(dialAt(analog(), Date.UTC(2026, 0, 1, 6, 30)).hour).toBe(195);
    expect(dialAt(analog(), Date.UTC(2026, 0, 1, 23, 0)).hour).toBe(330);
  });

  it("turns the minute hand 6 degrees per minute and 0.1 per second", () => {
    expect(dialAt(analog(), Date.UTC(2026, 0, 1, 12, 15)).minute).toBe(90);
    expect(dialAt(analog({ seconds: true }), Date.UTC(2026, 0, 1, 12, 0, 30)).minute).toBeCloseTo(3, 10);
  });

  it("shows 15:30:45 with a seconds hand", () => {
    expect(dialAt(analog({ seconds: true }), Date.UTC(2026, 0, 1, 15, 30, 45))).toEqual({ hour: 105, minute: 184.5, second: 270 });
  });

  it("keeps the seconds hand off unless clock.seconds is set", () => {
    expect(dialAt(analog(), Date.UTC(2026, 0, 1, 15, 30, 45)).second).toBeNull();
    expect(dialAt(analog({ seconds: true }), Date.UTC(2026, 0, 1, 15, 30, 45)).second).toBe(270);
  });

  it("uses a 12 hour dial for every hour_format, the text stays digital", () => {
    for (const hour_format of ["auto", "12", "24"]) {
      const v = view(analog({ hour_format }), undefined, undefined, ctx({ now: Date.UTC(2026, 0, 1, 15) }));
      expect(v.dial.hour).toBe(90);
    }
    const v24 = view(analog({ hour_format: "24" }), undefined, undefined, ctx({ now: Date.UTC(2026, 0, 1, 15) }));
    expect(v24.text).toBe("15:00");
    expect(v24.ariaText).toBe("15:00");
  });

  it("follows the configured time zone and the Home Assistant zone", () => {
    expect(dialAt(analog({ time_zone: "Europe/Berlin" }), NOW).hour).toBe(30);
    const v = view(cfg({ clock: { display: "analog" } }), undefined, undefined, ctx({ hassTimeZone: "America/New_York" }));
    expect(v.dial.hour).toBe(210);
  });

  it("follows the wall clock over a daylight saving change", () => {
    const berlin = analog({ time_zone: "Europe/Berlin" });
    const before = dialAt(berlin, Date.UTC(2026, 2, 29, 0, 59, 59));
    const after = dialAt(berlin, Date.UTC(2026, 2, 29, 1, 0, 0));
    expect(before.hour).toBeCloseTo(59.5, 8);
    expect(after.hour).toBe(90);
  });

  it("keeps the text, the bar progress and the ticking", () => {
    const v = view(analog({ hour_format: "24" }), undefined, undefined, ctx());
    expect(v.text).toBe("12:00");
    expect(v.fillPos).toBe(0.5);
    expect(v.ticking).toBe(true);
  });

  it("exposes only numbers", () => {
    const dial = dialAt(analog({ seconds: true }), Date.UTC(2026, 0, 1, 15, 30, 45));
    for (const angle of Object.values(dial)) expect(typeof angle).toBe("number");
  });
});

describe("dialAngles", () => {
  it("returns the angles of an instant in a zone", () => {
    const angles = dialAngles(Date.UTC(2026, 0, 1, 9, 20, 10), "UTC", true);
    expect(angles.hour).toBeCloseTo(280, 8);
    expect(angles.minute).toBeCloseTo(121, 8);
    expect(angles.second).toBe(60);
  });

  it("leaves out the seconds hand on request", () => {
    expect(dialAngles(Date.UTC(2026, 0, 1, 9, 20, 10), "UTC", false).second).toBeNull();
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

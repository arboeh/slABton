import { describe, expect, it } from "vitest";
import {
  browserTimeZone, dayProgress, formatClock, formatRemaining, formatRemainingText, formatTarget, isTimeOnly,
  isValidTimeZone, parseDateTime, parseDuration, resolveTimeZone, splitDuration, targetEpoch, zoneOffsetMs,
  zonedParts, zonedTimeToEpoch,
} from "../../src/core/time.js";

const BERLIN = "Europe/Berlin";
const HOUR = 3600000;

describe("durations", () => {
  it("parses H:MM:SS", () => {
    expect(parseDuration("0:05:00")).toBe(300);
    expect(parseDuration("1:05:00")).toBe(3900);
    expect(parseDuration("00:00:30")).toBe(30);
    expect(parseDuration("100:00:00")).toBe(360000);
  });

  it("rejects everything else", () => {
    for (const value of ["bad", "1:60:00", "5", "", undefined, null, 300]) expect(parseDuration(value)).toBeNaN();
  });

  it("splits into components", () => {
    expect(splitDuration(90061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(splitDuration(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(splitDuration(59.9).seconds).toBe(59);
  });

  it("formats the remaining time", () => {
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(59)).toBe("0:59");
    expect(formatRemaining(300)).toBe("5:00");
    expect(formatRemaining(3900)).toBe("1:05:00");
    expect(formatRemaining(3 * 86400 + 5)).toBe("3 d");
  });

  it("localizes the day unit of the remaining time", () => {
    expect(formatRemaining(3 * 86400 + 5, "en")).toBe("3 d");
    expect(formatRemaining(3 * 86400 + 5, "de")).toBe("3 T");
  });

  it("formats the largest unit as text", () => {
    expect(formatRemainingText("en", 3 * 86400)).toBe("3 days");
    expect(formatRemainingText("en", 86400)).toBe("1 day");
    expect(formatRemainingText("en", 2 * 3600)).toBe("2 hours");
    expect(formatRemainingText("en", 90)).toBe("1 minute");
    expect(formatRemainingText("en", 30)).toBe("30 seconds");
    expect(formatRemainingText("de", 3 * 86400 + 100)).toBe("3 Tage");
    expect(formatRemainingText("de", 0)).toBe("0 Sekunden");
  });
});

describe("time zones", () => {
  it("validates IANA names", () => {
    expect(isValidTimeZone(BERLIN)).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    for (const value of ["Mars/Olympus", "", "  ", undefined, 5]) expect(isValidTimeZone(value)).toBe(false);
  });

  it("falls back to the browser zone", () => {
    expect(isValidTimeZone(browserTimeZone())).toBe(true);
    expect(resolveTimeZone("nope", BERLIN)).toBe(BERLIN);
    expect(resolveTimeZone(null, undefined)).toBe(browserTimeZone());
  });

  it("reads wall-clock parts", () => {
    expect(zonedParts(Date.UTC(2026, 10, 12, 17, 0, 0), BERLIN)).toEqual({
      year: 2026, month: 11, day: 12, hour: 18, minute: 0, second: 0,
    });
    expect(zonedParts(Date.UTC(2026, 10, 11, 23, 0, 0), BERLIN).hour).toBe(0);
  });

  it("knows winter and summer offsets", () => {
    expect(zoneOffsetMs(Date.UTC(2026, 0, 15, 12), BERLIN)).toBe(HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15, 12), BERLIN)).toBe(2 * HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15, 12), "UTC")).toBe(0);
  });

  it("converts wall-clock time to an instant", () => {
    const wall = (month, day, hour, minute = 0) => ({ year: 2026, month, day, hour, minute, second: 0 });
    expect(zonedTimeToEpoch(wall(11, 12, 18), BERLIN)).toBe(Date.UTC(2026, 10, 12, 17));
    expect(zonedTimeToEpoch(wall(7, 1, 12), BERLIN)).toBe(Date.UTC(2026, 6, 1, 10));
  });

  it("handles the spring-forward gap by shifting past it", () => {
    const epoch = zonedTimeToEpoch({ year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 }, BERLIN);
    expect(epoch).toBe(Date.UTC(2026, 2, 29, 1, 30));
    expect(zonedParts(epoch, BERLIN)).toMatchObject({ hour: 3, minute: 30 });
  });

  it("handles the autumn overlap with the later occurrence", () => {
    const epoch = zonedTimeToEpoch({ year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 }, BERLIN);
    expect(epoch).toBe(Date.UTC(2026, 9, 25, 1, 30));
  });
});

describe("date and time parsing", () => {
  it("parses dates and date-times", () => {
    expect(parseDateTime("2026-11-12 18:00:05")).toEqual({ year: 2026, month: 11, day: 12, hour: 18, minute: 0, second: 5 });
    expect(parseDateTime("2026-11-12T18:00")).toMatchObject({ hour: 18, minute: 0, second: 0 });
    expect(parseDateTime("2026-11-12")).toMatchObject({ hour: 0, minute: 0, second: 0 });
  });

  it("knows leap days", () => {
    expect(parseDateTime("2028-02-29")).not.toBeNull();
    expect(parseDateTime("2026-02-29")).toBeNull();
  });

  it("rejects invalid input", () => {
    for (const value of ["2026-13-01", "2026-00-10", "2026-11-31", "2026-11-12 24:00:00", "2026-11-12 10:60", "abc", "", null, 5]) {
      expect(parseDateTime(value)).toBeNull();
    }
  });

  it("recognizes a time without a date", () => {
    expect(isTimeOnly("18:00:00")).toBe(true);
    expect(isTimeOnly("18:00")).toBe(true);
    expect(isTimeOnly("2026-11-12 18:00:00")).toBe(false);
    expect(isTimeOnly(undefined)).toBe(false);
  });

  it("resolves a countdown target in the given zone", () => {
    expect(targetEpoch("2026-11-12 18:00:00", BERLIN)).toBe(Date.UTC(2026, 10, 12, 17));
    expect(targetEpoch("2026-07-01 12:00:00", BERLIN)).toBe(Date.UTC(2026, 6, 1, 10));
    expect(targetEpoch("2026-11-12", BERLIN)).toBe(Date.UTC(2026, 10, 11, 23));
    expect(targetEpoch("18:00:00", BERLIN)).toBeNull();
    expect(targetEpoch("unknown", BERLIN)).toBeNull();
  });
});

describe("clock", () => {
  it("measures the progress of the local day", () => {
    expect(dayProgress(Date.UTC(2026, 0, 1, 12), "UTC")).toBe(0.5);
    expect(dayProgress(Date.UTC(2026, 0, 1, 11), BERLIN)).toBe(0.5);
    expect(dayProgress(Date.UTC(2026, 0, 1, 0), "UTC")).toBe(0);
  });

  it("formats 24 and 12 hour clocks", () => {
    const at = Date.UTC(2026, 0, 1, 14, 30, 5);
    expect(formatClock(at, "UTC", { hourFormat: "24", locale: "de" })).toBe("14:30");
    expect(formatClock(at, "UTC", { hourFormat: "24", locale: "de", seconds: true })).toBe("14:30:05");
    expect(formatClock(at, "UTC", { hourFormat: "12", locale: "en" })).toMatch(/^2:30\sPM$/);
    expect(formatClock(at, BERLIN, { hourFormat: "24", locale: "en" })).toBe("15:30");
    expect(formatClock(Date.UTC(2026, 0, 1, 0, 5), "UTC", { hourFormat: "24", locale: "en" })).toBe("00:05");
  });

  it("formats the target date", () => {
    const at = Date.UTC(2026, 10, 12, 17);
    expect(formatTarget(at, BERLIN, "de")).toContain("18:00");
    expect(formatTarget(at, BERLIN, "de")).toContain("2026");
    expect(formatTarget(at, BERLIN, "de", false)).not.toContain("18:00");
  });
});

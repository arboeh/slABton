import { describe, expect, it } from "vitest";
import { Pulse } from "../../src/core/pulse.js";

const NOW = Date.UTC(2026, 0, 1, 12);
const OPTIONS = { pulse: true, pulse_seconds: 5 };
const FOREVER = { pulse: true, pulse_seconds: 0 };
const running = (endsIn) => ({ active: true, finishesAt: NOW + endsIn, upcoming: endsIn > 0 });
const idle = { active: false, finishesAt: null, upcoming: false };

/** Pulse that has seen a running timer ending in `endsIn` ms at NOW. */
function started(endsIn = 3000, options = OPTIONS) {
  const pulse = new Pulse();
  pulse.advance(running(endsIn), NOW, options);
  return pulse;
}

describe("Pulse expiry event", () => {
  const QUIET = { pulse: false, pulse_seconds: 5 };

  it("reports the end of a running timer once, with pulse on", () => {
    const pulse = started();
    expect(pulse.advance(running(3000), NOW + 1000, OPTIONS)).toBe(false);
    expect(pulse.advance(idle, NOW + 3000, OPTIONS)).toBe(true);
    expect(pulse.advance(idle, NOW + 4000, OPTIONS)).toBe(false);
    expect(pulse.firedFor).toBe(NOW + 3000);
  });

  it("reports the end with pulse off, without starting the pulse", () => {
    const pulse = started(3000, QUIET);
    expect(pulse.advance(idle, NOW + 3000, QUIET)).toBe(true);
    expect(pulse.active).toBe(false);
  });

  it("reports an end time once, even when it is reported late again", () => {
    const pulse = started(3000, QUIET);
    expect(pulse.advance(idle, NOW + 3000, QUIET)).toBe(true);
    expect(pulse.advance(running(3000), NOW + 9000, QUIET)).toBe(false);
    expect(pulse.advance(idle, NOW + 9000, QUIET)).toBe(false);
  });

  it("reports the end of the next run again", () => {
    const pulse = started(3000, QUIET);
    pulse.advance(idle, NOW + 3000, QUIET);
    pulse.advance(running(6000), NOW + 3000, QUIET);
    expect(pulse.advance(idle, NOW + 6000, QUIET)).toBe(true);
  });

  it("reports nothing for a cancelled timer, a stale state or a fresh pulse", () => {
    expect(started(600000).advance(idle, NOW + 1000, OPTIONS)).toBe(false);
    expect(new Pulse().advance(idle, NOW, OPTIONS)).toBe(false);
    expect(new Pulse().advance({ active: true, finishesAt: NOW - 1000, upcoming: false }, NOW, OPTIONS)).toBe(false);
    expect(new Pulse().firedFor).toBeNull();
  });

  it("forgets the reported end time on reset", () => {
    const pulse = started(3000, QUIET);
    pulse.advance(idle, NOW + 3000, QUIET);
    pulse.reset();
    expect(pulse.firedFor).toBeNull();
    pulse.advance(running(3000), NOW, QUIET);
    expect(pulse.advance(idle, NOW + 3000, QUIET)).toBe(true);
  });
});

describe("Pulse", () => {
  it("is inactive until a timer ran out", () => {
    const pulse = started();
    expect(pulse.active).toBe(false);
    expect(pulse.until).toBe(0);
  });

  it("starts when the running timer reaches its end and lasts pulse_seconds", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    expect(pulse.active).toBe(true);
    expect(pulse.until).toBe(NOW + 3000 + 5000);
  });

  it("ends by itself once pulse_seconds have passed", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    pulse.advance(idle, NOW + 8000, OPTIONS);
    expect(pulse.active).toBe(false);
  });

  it("pulses only once per end time", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    pulse.advance(idle, NOW + 9000, OPTIONS);
    pulse.advance(running(3000), NOW + 9000, OPTIONS);
    pulse.advance(idle, NOW + 9000, OPTIONS);
    expect(pulse.active).toBe(false);
  });

  it("pulses again for the next run", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    pulse.advance(running(6000), NOW + 3000, OPTIONS);
    expect(pulse.active).toBe(false);
    pulse.advance(idle, NOW + 6000, OPTIONS);
    expect(pulse.active).toBe(true);
  });

  it("stays on until dismissed when pulse_seconds is 0", () => {
    const pulse = started(3000, FOREVER);
    pulse.advance(idle, NOW + 3000, FOREVER);
    pulse.advance(idle, NOW + 3600000, FOREVER);
    expect(pulse.until).toBe(Infinity);
    expect(pulse.active).toBe(true);
  });

  it("does not start when pulse is off", () => {
    const off = { pulse: false, pulse_seconds: 5 };
    const pulse = started(3000, off);
    pulse.advance(idle, NOW + 3000, off);
    expect(pulse.active).toBe(false);
  });

  it("does not start for a cancelled timer", () => {
    const pulse = started(600000);
    pulse.advance(idle, NOW + 1000, OPTIONS);
    expect(pulse.active).toBe(false);
  });

  it("ends when the timer runs again", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    expect(pulse.active).toBe(true);
    pulse.advance(running(60000), NOW + 4000, OPTIONS);
    expect(pulse.active).toBe(false);
  });

  it("dismiss ends a running pulse and reports it", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    expect(pulse.dismiss()).toBe(true);
    expect(pulse.active).toBe(false);
  });

  it("dismiss without a pulse does nothing and reports false", () => {
    expect(started().dismiss()).toBe(false);
  });

  it("reset forgets the pulse and the end times that already fired", () => {
    const pulse = started();
    pulse.advance(idle, NOW + 3000, OPTIONS);
    pulse.reset();
    expect(pulse.active).toBe(false);
    pulse.advance(running(3000), NOW, OPTIONS);
    pulse.advance(idle, NOW + 3000, OPTIONS);
    expect(pulse.active).toBe(true);
  });
});

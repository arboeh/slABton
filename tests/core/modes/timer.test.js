import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import {
  EDGE, EXPIRY_TOLERANCE_MS, defaultActions, detectExpiry, edgeOf, isDraggable, needsTick, onRelease, timing, view,
} from "../../../src/core/modes/timer.js";
import { makeState } from "../../helpers/mock-hass.js";

// 2026-11-12 12:00:00 UTC
const NOW = Date.UTC(2026, 10, 12, 12);
const ctx = (extra = {}) => ({ now: NOW, lang: "en", locale: "en", hassTimeZone: "Europe/Berlin", expired: false, ...extra });
const cfg = (entity, extra = {}) => normalizeConfig({ entity, ...extra });
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

const SAUNA = "timer.sauna";
const active = (offsetMs, duration = "0:10:00") =>
  makeState(SAUNA, "active", { duration, remaining: duration, finishes_at: iso(offsetMs) });
const paused = (remaining) => makeState(SAUNA, "paused", { duration: "0:10:00", remaining });
const idle = () => makeState(SAUNA, "idle", { duration: "0:10:00", remaining: "0:10:00" });

describe("Home Assistant timer", () => {
  it("counts down from finishes_at", () => {
    const v = view(cfg(SAUNA), active(300000), undefined, ctx());
    expect(v.text).toBe("5:00");
    expect(v.fillPos).toBe(0.5);
    expect(v.pos).toBe(0.5);
    expect(v.ticking).toBe(true);
    expect(v.unavailable).toBe(false);
    expect(v.icon).toBe("mdi:timer-sand");
    expect(v.ariaText).toBe("Running, 5 minutes");
    expect(v.values).toMatchObject({
      state: "Running", value: "5:00", remaining: "5:00", remaining_text: "5 minutes",
      days: 0, hours: 0, minutes: 5, seconds: 0, elapsed: "5:00",
    });
    expect(v.values.target).toEqual(expect.any(String));
  });

  it("rounds a partial second up and stops at zero", () => {
    expect(view(cfg(SAUNA), active(1500), undefined, ctx()).text).toBe("0:02");
    const over = view(cfg(SAUNA), active(-5000), undefined, ctx());
    expect(over.text).toBe("0:00");
    expect(over.ticking).toBe(false);
  });

  it("falls back to the remaining attribute without finishes_at", () => {
    const state = makeState(SAUNA, "active", { duration: "0:10:00", remaining: "0:04:00" });
    const v = view(cfg(SAUNA), state, undefined, ctx());
    expect(v.text).toBe("4:00");
    expect(v.timing).toEqual({ active: true, finishesAt: null, upcoming: false });
  });

  it("shows a paused timer frozen", () => {
    const v = view(cfg(SAUNA), paused("0:02:30"), undefined, ctx());
    expect(v.text).toBe("2:30");
    expect(v.fillPos).toBe(0.25);
    expect(v.ticking).toBe(false);
    expect(v.icon).toBe("mdi:timer-pause-outline");
    expect(v.values.state).toBe("Paused");
    expect(v.values.target).toBeNull();
  });

  it("shows an idle timer as ready with the full duration", () => {
    const v = view(cfg(SAUNA), idle(), undefined, ctx());
    expect(v.text).toBe("10:00");
    expect(v.fillPos).toBe(1);
    expect(v.values.state).toBe("Ready");
    expect(v.values.elapsed).toBe("0:00");
    expect(v.timing).toEqual({ active: false, finishesAt: null, upcoming: false });
  });

  it("translates the state", () => {
    expect(view(cfg(SAUNA), idle(), undefined, ctx({ lang: "de" })).values.state).toBe("Bereit");
    expect(view(cfg(SAUNA), active(120000), undefined, ctx({ lang: "de" })).values.remaining_text).toBe("2 Minuten");
  });

  it("shows the expired state while the pulse runs", () => {
    const v = view(cfg(SAUNA), idle(), undefined, ctx({ expired: true }));
    expect(v.text).toBe("Expired");
    expect(v.icon).toBe("mdi:timer-alert-outline");
    expect(v.values.state).toBe("Expired");
  });

  it("keeps a configured icon and marks unavailable timers", () => {
    expect(view(cfg(SAUNA, { icon: "mdi:sauna" }), idle(), undefined, ctx()).icon).toBe("mdi:sauna");
    for (const state of [undefined, makeState(SAUNA, "unavailable")]) {
      const v = view(cfg(SAUNA), state, undefined, ctx());
      expect(v.unavailable).toBe(true);
      expect(v.text).toBe("–");
      expect(v.timing).toBeNull();
    }
  });

  it("handles a missing duration", () => {
    const v = view(cfg(SAUNA), makeState(SAUNA, "idle", {}), undefined, ctx());
    expect(v.text).toBe("Ready");
    expect(v.fillPos).toBe(0);
    expect(v.unavailable).toBe(false);
  });
});

describe("countdown target", () => {
  const TARGET = "input_datetime.fest";
  const fest = (state, attrs = { has_date: true, has_time: true }) => makeState(TARGET, state, attrs);

  it("counts down to a date and time in the Home Assistant zone", () => {
    // 2026-11-20 18:00 Berlin = 17:00 UTC: 8 days and 5 hours away.
    const v = view(cfg(TARGET, { mode: "timer" }), fest("2026-11-20 18:00:00"), undefined, ctx());
    expect(v.text).toBe("8 d");
    expect(v.values).toMatchObject({ remaining_text: "8 days", days: 8, hours: 5, state: "Running", elapsed: null });
    expect(v.fillPos).toBeCloseTo((8 * 86400 + 5 * 3600) / (30 * 86400), 5);
    expect(v.ticking).toBe(true);
    expect(v.timing).toEqual({ active: true, finishesAt: Date.UTC(2026, 10, 20, 17), upcoming: true });
    expect(v.values.target).toContain("2026");
    expect(v.values.target).toMatch(/6:00/);
  });

  it("uses timer.time_zone for the target", () => {
    const config = cfg(TARGET, { mode: "timer", timer: { time_zone: "UTC" } });
    const v = view(config, fest("2026-11-20 18:00:00"), undefined, ctx());
    expect(v.timing.finishesAt).toBe(Date.UTC(2026, 10, 20, 18));
  });

  it("fills the bar from timer.span days left", () => {
    const config = cfg(TARGET, { mode: "timer", timer: { span: 10 } });
    expect(view(config, fest("2026-11-17 13:00:00"), undefined, ctx()).fillPos).toBe(0.5);
    expect(view(config, fest("2027-01-01 00:00:00"), undefined, ctx()).fillPos).toBe(1);
  });

  it("is expired and quiet once the target has passed", () => {
    const v = view(cfg(TARGET, { mode: "timer" }), fest("2026-11-10 08:00:00"), undefined, ctx());
    expect(v.text).toBe("0:00");
    expect(v.values.state).toBe("Expired");
    expect(v.fillPos).toBe(0);
    expect(v.ticking).toBe(false);
    expect(v.timing).toEqual({ active: false, finishesAt: expect.any(Number), upcoming: false });
  });

  it("supports input_date as midnight of that day", () => {
    const state = makeState("input_date.fest", "2026-11-13", {});
    const v = view(cfg("input_date.fest", { mode: "timer" }), state, undefined, ctx());
    // 2026-11-13 00:00 Berlin = 2026-11-12 23:00 UTC, 11 hours from NOW.
    expect(v.timing.finishesAt).toBe(Date.UTC(2026, 10, 12, 23));
    expect(v.text).toBe("11:00:00");
    expect(v.values.target).not.toContain(":");
  });

  it("does not support a time without a date", () => {
    const v = view(cfg(TARGET, { mode: "timer" }), fest("18:00:00", { has_date: false, has_time: true }), undefined, ctx());
    expect(v.unavailable).toBe(true);
    expect(v.notice).toBe("time_only");
  });

  it("marks invalid values unavailable", () => {
    const v = view(cfg(TARGET, { mode: "timer" }), fest("not a date"), undefined, ctx());
    expect(v.unavailable).toBe(true);
    expect(v.notice).toBeNull();
  });

  it("rejects entities it cannot count down", () => {
    const v = view(cfg("sensor.x", { mode: "timer" }), makeState("sensor.x", "5"), undefined, ctx());
    expect(v.unavailable).toBe(true);
    expect(v.notice).toBe("unsupported_entity");
  });
});

describe("timing and expiry", () => {
  const config = cfg(SAUNA);

  it("samples the running state", () => {
    expect(timing(config, active(1000), ctx())).toEqual({ active: true, finishesAt: NOW + 1000, upcoming: true });
    expect(timing(config, active(-1000), ctx())).toEqual({ active: true, finishesAt: NOW - 1000, upcoming: false });
    expect(timing(config, idle(), ctx())).toEqual({ active: false, finishesAt: null, upcoming: false });
    expect(timing(config, undefined, ctx())).toBeNull();
  });

  it("detects a timer that ran out", () => {
    const running = { active: true, finishesAt: NOW, upcoming: true };
    const stopped = { active: false, finishesAt: null, upcoming: false };
    expect(detectExpiry(running, { active: true, finishesAt: NOW, upcoming: false }, NOW)).toBe(true);
    expect(detectExpiry(running, { active: true, finishesAt: NOW, upcoming: true }, NOW - 1)).toBe(false);
    expect(detectExpiry(running, stopped, NOW + 300)).toBe(true);
    expect(detectExpiry(running, stopped, NOW - EXPIRY_TOLERANCE_MS)).toBe(true);
  });

  it("does not treat a cancel or a changed target as expiry", () => {
    const running = { active: true, finishesAt: NOW, upcoming: true };
    const stopped = { active: false, finishesAt: null, upcoming: false };
    expect(detectExpiry(running, stopped, NOW - EXPIRY_TOLERANCE_MS - 1)).toBe(false);
    expect(detectExpiry(running, { active: true, finishesAt: NOW + 60000, upcoming: true }, NOW - 10)).toBe(false);
  });

  it("needs a timer that was seen counting down before anything can expire", () => {
    const stopped = { active: false, finishesAt: null, upcoming: false };
    expect(detectExpiry(null, { active: true, finishesAt: NOW, upcoming: false }, NOW + 1)).toBe(false);
    expect(detectExpiry(stopped, stopped, NOW)).toBe(false);
    expect(detectExpiry({ active: true, finishesAt: null, upcoming: false }, stopped, NOW)).toBe(false);
    expect(detectExpiry({ active: true, finishesAt: NOW - 5000, upcoming: false }, stopped, NOW)).toBe(false);
  });

  it("counts a vanished entity after the end as expiry", () => {
    expect(detectExpiry({ active: true, finishesAt: NOW, upcoming: true }, null, NOW + 1)).toBe(true);
  });
});

describe("start and end actions: edges and swipe", () => {
  const hook = { action: "perform-action", perform_action: "climate.turn_on", target: { entity_id: "climate.a" } };
  const hooked = (extra = {}) => cfg(SAUNA, { timer: { start_action: hook, end_action: hook }, ...extra });
  const perform = (name, entity = SAUNA) => ({ action: "perform-action", perform_action: name, target: { entity_id: entity } });

  it("sees timer.start of an idle timer as the start edge", () => {
    expect(edgeOf(cfg(SAUNA), idle(), perform("timer.start"))).toBe(EDGE.START);
  });

  it("does not count a resume from paused, a start while running or a start of another entity", () => {
    expect(edgeOf(cfg(SAUNA), paused("0:01:00"), perform("timer.start"))).toBeNull();
    expect(edgeOf(cfg(SAUNA), active(1000), perform("timer.start"))).toBeNull();
    expect(edgeOf(cfg(SAUNA), idle(), perform("timer.start", "timer.other"))).toBeNull();
    expect(edgeOf(cfg(SAUNA), idle(), { action: "perform-action", perform_action: "timer.start", target: { entity_id: [SAUNA] } })).toBe(EDGE.START);
    expect(edgeOf(cfg(SAUNA), idle(), { action: "perform-action", perform_action: "timer.start", target: { entity_id: [SAUNA, "timer.other"] } })).toBeNull();
  });

  it("sees timer.cancel of a running or paused timer as the cancel edge, not of an idle one", () => {
    expect(edgeOf(cfg(SAUNA), active(1000), perform("timer.cancel"))).toBe(EDGE.CANCEL);
    expect(edgeOf(cfg(SAUNA), paused("0:01:00"), perform("timer.cancel"))).toBe(EDGE.CANCEL);
    expect(edgeOf(cfg(SAUNA), idle(), perform("timer.cancel"))).toBeNull();
  });

  it("ignores pause, other actions and other sources", () => {
    expect(edgeOf(cfg(SAUNA), active(1000), perform("timer.pause"))).toBeNull();
    expect(edgeOf(cfg(SAUNA), idle(), { action: "more-info" })).toBeNull();
    expect(edgeOf(cfg(SAUNA), idle(), undefined)).toBeNull();
    const target = cfg("input_datetime.fest", { mode: "timer" });
    expect(edgeOf(target, makeState("input_datetime.fest", "2026-11-20 18:00:00"), perform("timer.start", "input_datetime.fest"))).toBeNull();
  });

  it("is draggable while ready, running or paused, with a duration, only with both a start and an end action", () => {
    expect(isDraggable(hooked(), idle())).toBe(true);
    expect(isDraggable(hooked(), active(1000))).toBe(true);
    expect(isDraggable(hooked(), paused("0:01:00"))).toBe(true);
    expect(isDraggable(cfg(SAUNA, { timer: { end_action: hook } }), idle())).toBe(false);
    expect(isDraggable(cfg(SAUNA, { timer: { start_action: hook } }), idle())).toBe(false);
    expect(isDraggable(cfg(SAUNA), idle())).toBe(false);
    expect(isDraggable(hooked(), makeState(SAUNA, "idle", {}))).toBe(false);
    expect(isDraggable(hooked(), undefined)).toBe(false);
  });

  it("is not draggable with drag off, a fixed handle or a countdown target", () => {
    expect(isDraggable(hooked({ drag: false }), idle())).toBe(false);
    expect(isDraggable(hooked({ handle_position: "start" }), idle())).toBe(false);
    expect(isDraggable(cfg("input_datetime.fest", { mode: "timer", timer: { start_action: hook, end_action: hook } }), makeState("input_datetime.fest", "2026-11-20 18:00:00"))).toBe(false);
  });

  const START = { action: "perform-action", perform_action: "timer.start", target: { entity_id: SAUNA } };
  const CANCEL = { action: "perform-action", perform_action: "timer.cancel", target: { entity_id: SAUNA } };

  it("starts a timer that is off when the handle is swiped past the middle towards the full end", () => {
    const result = onRelease({ frac: 0.8, startPos: 0, config: hooked(), stateObj: idle() });
    expect(result.action).toEqual(START);
    expect(result.pending).toBeUndefined();
  });

  it("springs back at or before the middle for a timer that is off, and when nothing can be dragged", () => {
    expect(onRelease({ frac: 0.49, startPos: 0, config: hooked(), stateObj: idle() })).toBeNull();
    expect(onRelease({ frac: 0.1, startPos: 0, config: hooked(), stateObj: idle() })).toBeNull();
    expect(onRelease({ frac: 0.9, startPos: 0, config: cfg(SAUNA), stateObj: idle() })).toBeNull();
  });

  it("restarts a running timer dragged into the full end and cancels it dragged into the start end", () => {
    expect(onRelease({ frac: 0.95, startPos: 0.4, config: hooked(), stateObj: active(1000) }).action).toEqual(START);
    expect(onRelease({ frac: 0.05, startPos: 0.4, config: hooked(), stateObj: active(1000) }).action).toEqual(CANCEL);
    expect(onRelease({ frac: 0.95, startPos: 0.4, config: hooked(), stateObj: paused("0:01:00") }).action).toEqual(START);
    expect(onRelease({ frac: 0.05, startPos: 0.4, config: hooked(), stateObj: paused("0:01:00") }).action).toEqual(CANCEL);
  });

  it("springs back a running timer that is dragged only part of the way or released where it started", () => {
    expect(onRelease({ frac: 0.6, startPos: 0.4, config: hooked(), stateObj: active(1000) })).toBeNull();
    expect(onRelease({ frac: 0.95, startPos: 0.95, config: hooked(), stateObj: active(1000) })).toBeNull();
    expect(onRelease({ frac: 0.05, startPos: 0.05, config: hooked(), stateObj: active(1000) })).toBeNull();
  });

  it("shows a timer that is off with the handle at the start and an empty bar, only with both actions", () => {
    const off = view(hooked(), idle(), undefined, ctx());
    expect([off.pos, off.fillPos]).toEqual([0, 0]);
    expect(view(cfg(SAUNA), idle(), undefined, ctx()).fillPos).toBe(1);
    expect(view(hooked(), active(600000), undefined, ctx()).fillPos).toBeGreaterThan(0);
  });
});

describe("behaviour", () => {
  it("starts, pauses and cancels a Home Assistant timer", () => {
    const config = cfg(SAUNA);
    const target = { entity_id: SAUNA };
    expect(defaultActions(config, idle()).tap_action).toEqual({ action: "perform-action", perform_action: "timer.start", target });
    expect(defaultActions(config, paused("0:01:00")).tap_action.perform_action).toBe("timer.start");
    expect(defaultActions(config, active(1000)).tap_action.perform_action).toBe("timer.pause");
    expect(defaultActions(config, idle()).hold_action.perform_action).toBe("timer.cancel");
    expect(defaultActions(config, idle()).double_tap_action).toEqual({ action: "none" });
  });

  it("opens more-info for a countdown target", () => {
    const actions = defaultActions(cfg("input_datetime.fest", { mode: "timer" }), undefined);
    expect(actions.tap_action).toEqual({ action: "more-info" });
  });

  it("ticks only while counting and is read-only", () => {
    expect(needsTick({ ticking: true })).toBe(true);
    expect(needsTick({ ticking: false })).toBe(false);
    expect(needsTick({})).toBe(false);
    expect(isDraggable()).toBe(false);
  });
});

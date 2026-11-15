import { describe, expect, it, vi } from "vitest";
import { normalizeConfig } from "../../../src/core/config.js";
import { defaultActions, isDraggable, isLocked, lockAction, onRelease, unlockAction, view } from "../../../src/core/modes/lock.js";
import { makeState } from "../../helpers/mock-hass.js";

const lock = (extra = {}) => normalizeConfig({ entity: "lock.front", ...extra });
const alarm = (extra = {}) => normalizeConfig({ entity: "alarm_control_panel.home", ...extra });

describe("isLocked", () => {
  it.each(["locked", "locking", "jammed", "armed_away", "armed_home", "arming", "triggered"])("%s is locked", (s) => {
    expect(isLocked(s)).toBe(true);
  });

  it.each(["unlocked", "unlocking", "open", "disarmed", "disarming"])("%s is unlocked", (s) => {
    expect(isLocked(s)).toBe(false);
  });
});

describe("view", () => {
  it("rests at the start while locked and at the end while unlocked", () => {
    expect(view(lock(), makeState("lock.front", "locked")).pos).toBe(0);
    expect(view(lock(), makeState("lock.front", "unlocked")).pos).toBe(1);
  });

  it("picks icons per domain and state", () => {
    expect(view(lock(), makeState("lock.front", "locked")).icon).toBe("mdi:lock");
    expect(view(lock(), makeState("lock.front", "unlocked")).icon).toBe("mdi:lock-open-variant");
    expect(view(alarm(), makeState("alarm_control_panel.home", "armed_away")).icon).toBe("mdi:shield-lock");
    expect(view(lock({ icon: "mdi:door" }), makeState("lock.front", "locked")).icon).toBe("mdi:door");
  });

  it("applies a pending override and flags unavailable", () => {
    expect(view(lock(), makeState("lock.front", "locked"), false).pos).toBe(1);
    expect(view(lock(), makeState("lock.front", "unavailable")).unavailable).toBe(true);
  });
});

describe("unavailable lock", () => {
  it("stays blocked even with allow_unavailable_actions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = lock({ allow_unavailable_actions: true });
    const stateObj = makeState("lock.front", "unavailable");
    expect(config.allow_unavailable_actions).toBe(false);
    expect(isDraggable(config, stateObj)).toBe(false);
    expect(onRelease({ frac: 1, startPos: 0, config, stateObj })).toBeNull();
    warn.mockRestore();
  });
});

describe("actions", () => {
  it("defaults per domain", () => {
    expect(unlockAction(lock()).perform_action).toBe("lock.unlock");
    expect(lockAction(lock()).perform_action).toBe("lock.lock");
    expect(unlockAction(alarm()).perform_action).toBe("alarm_control_panel.alarm_disarm");
    expect(lockAction(alarm()).perform_action).toBe("alarm_control_panel.alarm_arm_away");
    expect(lockAction(alarm({ arm_service: "alarm_arm_night" })).perform_action).toBe("alarm_control_panel.alarm_arm_night");
    expect(unlockAction(normalizeConfig({ entity: "switch.a", mode: "lock" })).perform_action).toBe("homeassistant.turn_on");
    expect(lockAction(normalizeConfig({ entity: "switch.a", mode: "lock" })).perform_action).toBe("homeassistant.turn_off");
  });

  it("uses configured actions", () => {
    const custom = { action: "perform-action", perform_action: "script.open_door" };
    expect(unlockAction(lock({ unlock_action: custom }))).toEqual({ ...custom, target: undefined, data: undefined });
  });

  it("defaults tap to more-info", () => {
    expect(defaultActions().tap_action.action).toBe("more-info");
  });
});

describe("onRelease", () => {
  const locked = makeState("lock.front", "locked");
  const unlocked = makeState("lock.front", "unlocked");

  it("unlocks when swiped past the threshold", () => {
    const r = onRelease({ frac: 0.9, startPos: 0, config: lock(), stateObj: locked });
    expect(r.action.perform_action).toBe("lock.unlock");
    expect(r.pending).toBe(false);
  });

  it("sends nothing while the lock is jammed", () => {
    const jammed = makeState("lock.front", "jammed");
    expect(onRelease({ frac: 0.9, startPos: 0, config: lock(), stateObj: jammed })).toBeNull();
  });

  it("still allows disarming a triggered alarm", () => {
    const triggered = makeState("alarm_control_panel.home", "triggered");
    const r = onRelease({ frac: 0.9, startPos: 0, config: alarm(), stateObj: triggered });
    expect(r.action.perform_action).toBe("alarm_control_panel.alarm_disarm");
  });

  it("springs back below the threshold", () => {
    expect(onRelease({ frac: 0.5, startPos: 0, config: lock(), stateObj: locked })).toBeNull();
  });

  it("locks when swiped back from the end", () => {
    const r = onRelease({ frac: 0.05, startPos: 1, config: lock(), stateObj: unlocked });
    expect(r.action.perform_action).toBe("lock.lock");
    expect(r.pending).toBe(true);
  });

  it("honors a custom threshold and ignores unavailable entities", () => {
    expect(onRelease({ frac: 0.5, startPos: 0, config: lock({ swipe_threshold: 50 }), stateObj: locked })).not.toBeNull();
    expect(onRelease({ frac: 1, startPos: 0, config: lock(), stateObj: makeState("lock.front", "unavailable") })).toBeNull();
  });

  it("is draggable unless unavailable or disabled", () => {
    expect(isDraggable(lock(), locked)).toBe(true);
    expect(isDraggable(lock(), undefined)).toBe(false);
    expect(isDraggable(lock({ drag: false }), locked)).toBe(false);
  });
});

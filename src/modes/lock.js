/*
 * Mode `lock`: swipe-to-unlock / swipe-to-lock. The handle rests at the
 * start while locked and at the end while unlocked; dragging it across the
 * threshold triggers the opposite action. This is a convenience gesture,
 * not a security boundary.
 */

import { ACTION, MODE, infoActions } from "../constants.js";
import { isUnavailable } from "../util.js";

export const id = MODE.LOCK;

const LOCKED_STATES = ["locked", "locking", "jammed", "pending", "arming", "triggered", "off"];
/** Fault states: shown as locked, but a swipe sends nothing (the lock needs attention first). */
const FAULT_STATES = ["jammed"];

function domainOf(config) {
  return config.entity.split(".")[0];
}

export function isLocked(state) {
  return LOCKED_STATES.includes(state) || String(state).startsWith("armed_");
}

export function view(config, stateObj, pending) {
  const unavailable = isUnavailable(stateObj);
  const locked = pending ?? isLocked(stateObj?.state);
  const alarm = domainOf(config) === "alarm_control_panel";
  const defaultIcon = alarm ? (locked ? "mdi:shield-lock" : "mdi:shield-off") : (locked ? "mdi:lock" : "mdi:lock-open-variant");
  const pos = locked ? 0 : 1;
  return {
    pos,
    fillPos: pos,
    icon: config.icon ?? defaultIcon,
    text: stateObj?.state ?? "",
    positionText: locked ? "1" : "2",
    color: null,
    unavailable,
    locked,
    ariaNow: pos * 100,
    ariaText: stateObj?.state ?? "",
  };
}

export const defaultActions = infoActions;

export function unlockAction(config) {
  if (config.unlock_action) return config.unlock_action;
  const target = { entity_id: config.entity };
  const domain = domainOf(config);
  if (domain === "lock") return { action: ACTION.PERFORM, perform_action: "lock.unlock", target };
  if (domain === "alarm_control_panel") return { action: ACTION.PERFORM, perform_action: "alarm_control_panel.alarm_disarm", target };
  return { action: ACTION.PERFORM, perform_action: "homeassistant.turn_on", target };
}

export function lockAction(config) {
  if (config.lock_action) return config.lock_action;
  const target = { entity_id: config.entity };
  const domain = domainOf(config);
  if (domain === "lock") return { action: ACTION.PERFORM, perform_action: "lock.lock", target };
  if (domain === "alarm_control_panel") return { action: ACTION.PERFORM, perform_action: `alarm_control_panel.${config.arm_service}`, target };
  return { action: ACTION.PERFORM, perform_action: "homeassistant.turn_off", target };
}

export function isDraggable(config, stateObj) {
  return config.drag && !isUnavailable(stateObj);
}

/**
 * Drag release. `startPos` is the logical position the drag started from
 * (0 = locked, 1 = unlocked). Returns the action once the swipe distance
 * reaches the threshold, else null (the handle springs back).
 */
export function onRelease({ frac, startPos, config, pending, stateObj }) {
  if (isUnavailable(stateObj) || FAULT_STATES.includes(stateObj.state)) return null;
  if (Math.abs(frac - startPos) * 100 < config.swipe_threshold) return null;
  const locked = pending ?? isLocked(stateObj?.state);
  return {
    action: locked ? unlockAction(config) : lockAction(config),
    pending: !locked,
  };
}

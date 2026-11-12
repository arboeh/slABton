import { vi } from "vitest";

/** Build a state object like Home Assistant's hass.states entries. */
export function makeState(entityId, state, attributes = {}) {
  return { entity_id: entityId, state, attributes };
}

/** Minimal hass mock with a callService spy. */
export function createHass(states = {}) {
  return {
    states: { ...states },
    callService: vi.fn(() => Promise.resolve()),
  };
}

/** Copy of `hass` with one entity replaced (new object identity, like HA). */
export function withState(hass, entityId, state, attributes) {
  const previous = hass.states[entityId];
  return {
    ...hass,
    states: {
      ...hass.states,
      [entityId]: makeState(entityId, state, attributes ?? previous?.attributes ?? {}),
    },
  };
}

/** Dispatch a synthetic pointer event (jsdom has no complete PointerEvent). */
export function pointer(target, type, init = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 0, clientY: 0, ...init });
  target.dispatchEvent(event);
  return event;
}

/** Give an element a fixed bounding rect. */
export function mockRect(el, { left = 0, top = 0, width = 0, height = 0 }) {
  el.getBoundingClientRect = () => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
  });
}

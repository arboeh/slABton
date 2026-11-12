/*
 * Pointer-event gesture handling for a handle (or switch) element:
 * tap, double tap, hold and drag along the bar axis, plus keyboard control.
 * The controller is mode-agnostic; it only reports gestures through callbacks.
 */

import { pointerToFraction } from "./util.js";

export const DRAG_THRESHOLD_PX = 8;
export const LONG_PRESS_MS = 500;
export const DOUBLE_TAP_MS = 300;

/**
 * @typedef {object} InteractionOptions
 * @property {HTMLElement} handle - element receiving the pointer events
 * @property {HTMLElement} [rail] - travel area used to convert pointer to position;
 *   required whenever `isDraggable()` can return true
 * @property {boolean} [horizontal] - bar orientation, default true
 * @property {boolean} [reversed] - rtl mapping
 * @property {number} [handleLength] - handle size along the axis in px
 * @property {() => boolean} [isDraggable]
 * @property {() => boolean} [hasDoubleTap] - a double tap action is configured
 * @property {() => boolean} [hasHold] - a hold action is configured
 * @property {() => void} [onTap] - single tap (delayed while a double tap is possible), Enter / Space
 * @property {() => void} [onDoubleTap]
 * @property {() => void} [onHold] - long press, fired once while the pointer is held
 * @property {() => void} [onDragStart]
 * @property {(frac: number) => void} [onDrag] - logical position 0..1 while dragging
 * @property {(frac: number) => void} [onDragEnd] - final position on release
 * @property {() => void} [onDragCancel] - pointercancel during a drag
 * @property {(step: 1 | -1) => void} [onStep] - arrow keys, direction already mapped
 */

/** Single tap with optional double-tap detection. */
function createTapDetector(opts) {
  let timer = null;
  return {
    tap() {
      if (!opts.hasDoubleTap?.()) {
        opts.onTap?.();
        return;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
        opts.onDoubleTap?.();
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        opts.onTap?.();
      }, DOUBLE_TAP_MS);
    },
    destroy() {
      clearTimeout(timer);
      timer = null;
    },
  };
}

/** Keyboard handler: Enter / Space tap, arrow keys step along the axis. */
function createKeyHandler(opts, horizontal) {
  const forward = horizontal ? "ArrowRight" : "ArrowUp";
  const backward = horizontal ? "ArrowLeft" : "ArrowDown";
  return (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      opts.onTap?.();
    } else if (event.key === forward || event.key === backward) {
      event.preventDefault();
      const step = event.key === forward ? 1 : -1;
      opts.onStep?.(opts.reversed ? -step : step);
    }
  };
}

/** Pointer gesture tracking: down / move / up / cancel with hold and drag detection. */
function createPointerTracker(opts, horizontal, tapDetector) {
  const { handle } = opts;
  let gesture = null;

  function toFraction(event) {
    const rect = opts.rail.getBoundingClientRect();
    return pointerToFraction({
      coord: horizontal ? event.clientX : event.clientY,
      start: horizontal ? rect.left : rect.top,
      size: horizontal ? rect.width : rect.height,
      handleLen: opts.handleLength ?? 0,
      horizontal,
      reversed: Boolean(opts.reversed),
    });
  }

  function finish() {
    if (!gesture) return null;
    const done = gesture;
    clearTimeout(done.holdTimer);
    try {
      handle.releasePointerCapture?.(done.id);
    } catch {
      /* capture already released */
    }
    gesture = null;
    return done;
  }

  function startHoldTimer() {
    const current = gesture;
    current.holdTimer = setTimeout(() => {
      if (gesture === current && !current.dragging && !current.cancelled) {
        current.held = true;
        opts.onHold?.();
      }
    }, LONG_PRESS_MS);
  }

  function onDown(event) {
    if (gesture || (event.button != null && event.button !== 0)) return;
    gesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      dragging: false, held: false, cancelled: false, frac: null, holdTimer: null,
    };
    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      /* synthetic pointer, no capture */
    }
    if (opts.hasHold?.()) startHoldTimer();
  }

  /** Decide whether the movement starts a drag, cancels the gesture or is still a tap. */
  function classifyMove(event) {
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const along = Math.abs(horizontal ? dx : dy);
    const cross = Math.abs(horizontal ? dy : dx);
    if (opts.isDraggable?.() && along > DRAG_THRESHOLD_PX && along >= cross) return "drag";
    return Math.max(along, cross) > DRAG_THRESHOLD_PX ? "cancel" : "tap";
  }

  function onMove(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    // A fired hold ends the gesture: moving afterwards must not start a drag on top of it.
    if (gesture.held) return;
    if (!gesture.dragging) {
      const kind = classifyMove(event);
      if (kind === "tap") return;
      clearTimeout(gesture.holdTimer);
      if (kind === "cancel") {
        gesture.cancelled = true;
        return;
      }
      gesture.dragging = true;
      opts.onDragStart?.();
    }
    if (event.cancelable) event.preventDefault();
    gesture.frac = toFraction(event);
    opts.onDrag?.(gesture.frac);
  }

  function onUp(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const done = finish();
    if (done.dragging) {
      opts.onDragEnd?.(done.frac ?? toFraction(event));
      return;
    }
    if (done.held || done.cancelled) return;
    tapDetector.tap();
  }

  function onCancel(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const done = finish();
    if (done.dragging) opts.onDragCancel?.();
  }

  return { onDown, onMove, onUp, onCancel, finish };
}

/**
 * Attach gesture handling to `opts.handle`.
 * @param {InteractionOptions} opts
 * @returns {{ destroy: () => void }}
 */
export function createInteraction(opts) {
  const { handle } = opts;
  const horizontal = opts.horizontal !== false;
  const tapDetector = createTapDetector(opts);
  const pointer = createPointerTracker(opts, horizontal, tapDetector);
  const onKey = createKeyHandler(opts, horizontal);
  const stopMenu = (event) => event.preventDefault();

  const listeners = [
    ["pointerdown", pointer.onDown],
    ["pointermove", pointer.onMove],
    ["pointerup", pointer.onUp],
    ["pointercancel", pointer.onCancel],
    ["keydown", onKey],
    ["contextmenu", stopMenu],
  ];
  for (const [type, listener] of listeners) handle.addEventListener(type, listener);

  return {
    destroy() {
      tapDetector.destroy();
      pointer.finish();
      for (const [type, listener] of listeners) handle.removeEventListener(type, listener);
    },
  };
}

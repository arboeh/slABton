import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOUBLE_TAP_MS, DRAG_THRESHOLD_PX, LONG_PRESS_MS, createInteraction } from "../../src/ui/interaction.js";
import { mockRect, pointer } from "../helpers/mock-hass.js";

let handle;
let rail;
let cb;
let interaction;

function setup(opts = {}) {
  cb = {
    onTap: vi.fn(), onDoubleTap: vi.fn(), onHold: vi.fn(),
    onDragStart: vi.fn(), onDrag: vi.fn(), onDragEnd: vi.fn(), onDragCancel: vi.fn(), onStep: vi.fn(),
  };
  interaction = createInteraction({
    handle, rail, horizontal: true, reversed: false, handleLength: 40,
    isDraggable: () => true, hasDoubleTap: () => false, hasHold: () => false,
    ...cb, ...opts,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  handle = document.createElement("div");
  rail = document.createElement("div");
  mockRect(rail, { left: 100, width: 200 });
});

afterEach(() => {
  interaction?.destroy();
  vi.useRealTimers();
});

const tap = (x = 0, y = 0) => {
  pointer(handle, "pointerdown", { clientX: x, clientY: y });
  pointer(handle, "pointerup", { clientX: x, clientY: y });
};

describe("tap", () => {
  it("fires immediately without a double tap action", () => {
    setup();
    tap();
    expect(cb.onTap).toHaveBeenCalledTimes(1);
  });

  it("waits for a possible second tap when double tap is configured", () => {
    setup({ hasDoubleTap: () => true });
    tap();
    expect(cb.onTap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DOUBLE_TAP_MS + 1);
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onDoubleTap).not.toHaveBeenCalled();
  });

  it("detects a double tap", () => {
    setup({ hasDoubleTap: () => true });
    tap();
    vi.advanceTimersByTime(DOUBLE_TAP_MS / 2);
    tap();
    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2);
    expect(cb.onDoubleTap).toHaveBeenCalledTimes(1);
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("ignores non-primary buttons", () => {
    setup();
    pointer(handle, "pointerdown", { button: 2 });
    pointer(handle, "pointerup", { button: 2 });
    expect(cb.onTap).not.toHaveBeenCalled();
  });
});

describe("hold", () => {
  it("fires after the long press time and suppresses the tap", () => {
    setup({ hasHold: () => true });
    pointer(handle, "pointerdown");
    vi.advanceTimersByTime(LONG_PRESS_MS + 1);
    expect(cb.onHold).toHaveBeenCalledTimes(1);
    pointer(handle, "pointerup");
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("does not fire when released early", () => {
    setup({ hasHold: () => true });
    pointer(handle, "pointerdown");
    vi.advanceTimersByTime(LONG_PRESS_MS - 100);
    pointer(handle, "pointerup");
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(cb.onHold).not.toHaveBeenCalled();
    expect(cb.onTap).toHaveBeenCalledTimes(1);
  });
});

describe("drag", () => {
  it("starts after the threshold and reports positions", () => {
    setup();
    pointer(handle, "pointerdown", { clientX: 120 });
    pointer(handle, "pointermove", { clientX: 120 + DRAG_THRESHOLD_PX + 2 });
    expect(cb.onDragStart).toHaveBeenCalledTimes(1);
    expect(cb.onDrag).toHaveBeenLastCalledWith(expect.any(Number));
    pointer(handle, "pointermove", { clientX: 220 });
    expect(cb.onDrag).toHaveBeenLastCalledWith(0.5);
    pointer(handle, "pointerup", { clientX: 220 });
    expect(cb.onDragEnd).toHaveBeenCalledWith(0.5);
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("stays a tap below the threshold", () => {
    setup();
    pointer(handle, "pointerdown", { clientX: 120 });
    pointer(handle, "pointermove", { clientX: 123 });
    pointer(handle, "pointerup", { clientX: 123 });
    expect(cb.onDragStart).not.toHaveBeenCalled();
    expect(cb.onTap).toHaveBeenCalledTimes(1);
  });

  it("treats mostly cross-axis movement as a scroll and cancels the tap", () => {
    setup();
    pointer(handle, "pointerdown", { clientX: 120, clientY: 0 });
    pointer(handle, "pointermove", { clientX: 122, clientY: 40 });
    pointer(handle, "pointerup", { clientX: 122, clientY: 40 });
    expect(cb.onDragStart).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("does not drag when not draggable", () => {
    setup({ isDraggable: () => false });
    pointer(handle, "pointerdown", { clientX: 120 });
    pointer(handle, "pointermove", { clientX: 200 });
    pointer(handle, "pointerup", { clientX: 200 });
    expect(cb.onDragStart).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("cancels a hold once dragging starts", () => {
    setup({ hasHold: () => true });
    pointer(handle, "pointerdown", { clientX: 120 });
    pointer(handle, "pointermove", { clientX: 160 });
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(cb.onHold).not.toHaveBeenCalled();
  });

  it("does not start a drag after a hold has fired", () => {
    setup({ hasHold: () => true });
    pointer(handle, "pointerdown", { clientX: 120 });
    vi.advanceTimersByTime(LONG_PRESS_MS + 1);
    expect(cb.onHold).toHaveBeenCalledTimes(1);
    pointer(handle, "pointermove", { clientX: 200 });
    pointer(handle, "pointerup", { clientX: 200 });
    expect(cb.onDragStart).not.toHaveBeenCalled();
    expect(cb.onDragEnd).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("reports pointercancel as a drag cancel", () => {
    setup();
    pointer(handle, "pointerdown", { clientX: 120 });
    pointer(handle, "pointermove", { clientX: 160 });
    pointer(handle, "pointercancel");
    expect(cb.onDragCancel).toHaveBeenCalledTimes(1);
    expect(cb.onDragEnd).not.toHaveBeenCalled();
  });

  it("maps vertical drags and rtl", () => {
    mockRect(rail, { top: 100, height: 200 });
    setup({ horizontal: false, reversed: false });
    pointer(handle, "pointerdown", { clientY: 280 });
    pointer(handle, "pointermove", { clientY: 120 });
    expect(cb.onDrag).toHaveBeenLastCalledWith(1);
    pointer(handle, "pointerup", { clientY: 120 });
  });

  it("calls preventDefault on drag moves", () => {
    setup();
    pointer(handle, "pointerdown", { clientX: 120 });
    const event = pointer(handle, "pointermove", { clientX: 160 });
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("keyboard", () => {
  const key = (k) => {
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    event.key = k;
    handle.dispatchEvent(event);
  };

  it("activates on Enter and Space", () => {
    setup();
    key("Enter");
    key(" ");
    expect(cb.onTap).toHaveBeenCalledTimes(2);
  });

  it("steps with arrows along the axis", () => {
    setup();
    key("ArrowRight");
    key("ArrowLeft");
    expect(cb.onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("ignores auto-repeat of a held arrow key", () => {
    setup();
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    event.key = "ArrowRight";
    event.repeat = true;
    handle.dispatchEvent(event);
    expect(cb.onStep).not.toHaveBeenCalled();
    key("ArrowRight");
    expect(cb.onStep).toHaveBeenCalledTimes(1);
  });

  it("reverses arrows for rtl and uses up/down when vertical", () => {
    setup({ reversed: true });
    key("ArrowRight");
    expect(cb.onStep).toHaveBeenLastCalledWith(-1);
    interaction.destroy();
    setup({ horizontal: false });
    key("ArrowUp");
    expect(cb.onStep).toHaveBeenLastCalledWith(1);
  });
});

describe("destroy", () => {
  it("removes listeners", () => {
    setup();
    interaction.destroy();
    tap();
    expect(cb.onTap).not.toHaveBeenCalled();
  });
});

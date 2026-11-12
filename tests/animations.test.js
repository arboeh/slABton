import { describe, expect, it } from "vitest";
import { ANIMATIONS, animationClass, animationCss, playsOnChange, restartAnimation } from "../src/animations.js";

describe("animations", () => {
  it("offers the predefined set", () => {
    expect(ANIMATIONS).toEqual(["none", "slide", "fade", "pulse", "shimmer"]);
  });

  it("maps names to classes and falls back to slide", () => {
    expect(animationClass("pulse")).toBe("anim-pulse");
    expect(animationClass("bogus")).toBe("anim-slide");
  });

  it("replays keyframes only for fade and pulse", () => {
    expect(playsOnChange("fade")).toBe(true);
    expect(playsOnChange("pulse")).toBe(true);
    expect(playsOnChange("slide")).toBe(false);
    expect(playsOnChange("none")).toBe(false);
  });

  it("restarts by re-adding the changed class", () => {
    const el = document.createElement("div");
    el.classList.add("changed");
    restartAnimation(el);
    expect(el.classList.contains("changed")).toBe(true);
  });

  it("disables motion for reduced-motion users", () => {
    expect(animationCss()).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
  });
});

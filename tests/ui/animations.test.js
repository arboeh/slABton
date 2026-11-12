import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "../../src/core/constants.js";
import { animationClass, animationCss, playsOnChange, restartAnimation } from "../../src/ui/animations.js";

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

  it("pulses the bar on expiry with opacity and box-shadow only, keeping a static highlight without motion", () => {
    const css = animationCss();
    const rule = /\.root\.expired \.bar \{([^}]*)\}/.exec(css)[1];
    expect(rule).toContain("box-shadow");
    expect(rule).toContain("animation: slabton-expire");
    const keyframes = /@keyframes slabton-expire \{([\s\S]*?)\n {4}\}/.exec(css)[1];
    expect(keyframes).toMatch(/opacity/);
    expect(keyframes).not.toMatch(/\b(width|height|top|left|margin|padding|font-size)\b/);
    // The reduced-motion rule removes the animation, the box-shadow in the rule above stays.
    expect(css.indexOf("@keyframes slabton-expire")).toBeLessThan(css.indexOf("prefers-reduced-motion"));
  });
});

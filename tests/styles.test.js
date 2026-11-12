import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../src/config.js";
import { applyVars, buildCss, buildVars, handleDimensions } from "../src/styles.js";

const cfg = (extra = {}) => normalizeConfig({ entity: "input_select.x", ...extra });

describe("handleDimensions", () => {
  it("round and square are as long as wide, oval is longer", () => {
    expect(handleDimensions(cfg({ handle_size: 40 }))).toEqual({ cross: 40, along: 40 });
    expect(handleDimensions(cfg({ handle_size: 40, handle_shape: "square" }))).toEqual({ cross: 40, along: 40 });
    expect(handleDimensions(cfg({ handle_size: 40, handle_shape: "oval" }))).toEqual({ cross: 40, along: 64 });
  });
});

describe("buildVars", () => {
  it("derives geometry from the config", () => {
    const v = buildVars(cfg({ thickness: 48, handle_size: 40 }));
    expect(v["--slabton-length"]).toBe("100%");
    expect(v["--slabton-thickness"]).toBe("48px");
    expect(v["--slabton-pad"]).toBe("4px");
    expect(v["--slabton-bar-radius"]).toBe("24px");
    expect(v["--slabton-handle-radius"]).toBe("999px");
  });

  it("subtracts the border from the padding", () => {
    expect(buildVars(cfg({ border_width: 2 }))["--slabton-pad"]).toBe("2px");
  });

  it("uses a fixed default length when vertical", () => {
    expect(buildVars(cfg({ orientation: "vertical" }))["--slabton-length"]).toBe("160px");
    expect(buildVars(cfg({ length: 300 }))["--slabton-length"]).toBe("300px");
  });

  it("uses square corners for the square shape", () => {
    const v = buildVars(cfg({ handle_shape: "square" }));
    expect(v["--slabton-handle-radius"]).toBe("8px");
    expect(v["--slabton-bar-radius"]).toBe("12px");
  });

  it("only sets colors that were configured and lets styles win", () => {
    const v = buildVars(cfg({ bar_color: "navy", styles: { "bar-color": "teal", "card-padding": "0px" } }));
    expect(v["--slabton-fill-color"]).toBeUndefined();
    expect(v["--slabton-bar-color"]).toBe("teal");
    expect(v["--slabton-card-padding"]).toBe("0px");
  });
});

describe("applyVars", () => {
  it("sets variables and removes stale ones", () => {
    const host = document.createElement("div");
    const keys = applyVars(host, cfg({ bar_color: "navy" }));
    expect(host.style.getPropertyValue("--slabton-bar-color")).toBe("navy");
    applyVars(host, cfg(), keys);
    expect(host.style.getPropertyValue("--slabton-bar-color")).toBe("");
    expect(host.style.getPropertyValue("--slabton-thickness")).toBe("48px");
  });
});

describe("buildCss", () => {
  it("contains theme fallbacks and motion handling", () => {
    const css = buildCss();
    expect(css).toContain("var(--slabton-bar-color, var(--secondary-background-color");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain(".o-v .carrier");
  });
});

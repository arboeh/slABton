import { describe, expect, it, vi } from "vitest";
import { normalizeConfig } from "../../src/core/config.js";
import { applyVars, buildCss, buildVars, handleDimensions, handleExtra } from "../../src/ui/styles.js";

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

  it("reserves room across and along the bar for a handle larger than the bar", () => {
    const v = buildVars(cfg({ thickness: 18, handle_size: 70 }));
    expect(v["--slabton-cross-extra"]).toBe("26px");
    expect(v["--slabton-overhang"]).toBe("26px");
  });

  it("reserves the same for every handle shape", () => {
    for (const handle_shape of ["round", "square", "oval"]) {
      const v = buildVars(cfg({ thickness: 18, handle_size: 70, handle_shape }));
      expect(v["--slabton-cross-extra"]).toBe("26px");
      expect(v["--slabton-overhang"]).toBe("26px");
    }
  });

  it("reserves nothing when the handle is not larger than the bar", () => {
    for (const handle_size of [40, 48]) {
      const v = buildVars(cfg({ thickness: 48, handle_size }));
      expect(v["--slabton-cross-extra"]).toBe("0px");
      expect(v["--slabton-overhang"]).toBe("0px");
    }
  });

  it("reserves nothing for a border around a handle that still fits in the bar", () => {
    const v = buildVars(cfg({ thickness: 48, handle_size: 40, border_width: 6 }));
    expect(v["--slabton-pad"]).toBe("-2px");
    expect(v["--slabton-cross-extra"]).toBe("0px");
    expect(v["--slabton-overhang"]).toBe("0px");
  });

  it("keeps the overhang reserve when it is larger than the excess", () => {
    expect(buildVars(cfg({ thickness: 48, handle_size: 40, handle_overhang: true }))["--slabton-overhang"]).toBe("20px");
    const big = buildVars(cfg({ thickness: 20, handle_size: 100, handle_overhang: true }));
    expect(big["--slabton-overhang"]).toBe("50px");
    expect(big["--slabton-cross-extra"]).toBe("40px");
  });

  it("uses the oval length for the overhang but the width for the excess", () => {
    const v = buildVars(cfg({ thickness: 48, handle_size: 40, handle_shape: "oval", handle_overhang: true }));
    expect(v["--slabton-overhang"]).toBe("32px");
    expect(v["--slabton-cross-extra"]).toBe("0px");
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

const TEXT_VAR_NAMES = [
  "--slabton-header-size", "--slabton-header-color", "--slabton-header-icon-color",
  "--slabton-bar-text-size", "--slabton-bar-text-color",
  "--slabton-info-size", "--slabton-info-color",
  "--slabton-button-size", "--slabton-button-color",
  "--slabton-scale-label-size", "--slabton-scale-label-color",
];

describe("buildVars text block", () => {
  it("sets none of the text variables without text:", () => {
    const v = buildVars(cfg());
    for (const name of TEXT_VAR_NAMES) expect(v[name], name).toBeUndefined();
  });

  it("maps every configured option to its variable, sizes in px", () => {
    const v = buildVars(cfg({
      text: {
        header: { font_size: 16, color: "#ff9800", icon_color: "#2196f3" },
        bar: { font_size: 12, color: "var(--secondary-text-color)" },
        info: { font_size: 11, color: "grey" },
        button: { font_size: 18, color: "white" },
        scale: { font_size: 9, color: "#888" },
      },
    }));
    expect(v).toMatchObject({
      "--slabton-scale-label-size": "9px",
      "--slabton-scale-label-color": "#888",
      "--slabton-header-size": "16px",
      "--slabton-header-color": "#ff9800",
      "--slabton-header-icon-color": "#2196f3",
      "--slabton-bar-text-size": "12px",
      "--slabton-bar-text-color": "var(--secondary-text-color)",
      "--slabton-info-size": "11px",
      "--slabton-info-color": "grey",
      "--slabton-button-size": "18px",
      "--slabton-button-color": "white",
    });
  });

  it("only sets what was configured", () => {
    const v = buildVars(cfg({ text: { bar: { font_size: 12 } } }));
    expect(v["--slabton-bar-text-size"]).toBe("12px");
    for (const name of TEXT_VAR_NAMES.filter((n) => n !== "--slabton-bar-text-size")) expect(v[name], name).toBeUndefined();
  });

  it("ranks text: above styles: above the default", () => {
    const styles = { "header-size": "20px", "info-color": "teal" };
    const both = buildVars(cfg({ styles, text: { header: { font_size: 16 } } }));
    expect(both["--slabton-header-size"]).toBe("16px");
    expect(both["--slabton-info-color"]).toBe("teal");
    expect(buildVars(cfg({ styles }))["--slabton-header-size"]).toBe("20px");
  });

  it("copes with a config without text", () => {
    const { text, ...rest } = cfg();
    expect(text).toBeDefined();
    expect(() => buildVars(rest)).not.toThrow();
  });
});

describe("buildVars scale", () => {
  it("sets no scale variable without scale: or without size and color", () => {
    for (const config of [cfg(), cfg({ scale: true }), cfg({ scale: { ticks: 4, position: "start" } })]) {
      const v = buildVars(config);
      expect(v["--slabton-scale-size"]).toBeUndefined();
      expect(v["--slabton-scale-color"]).toBeUndefined();
    }
  });

  it("maps size to px and passes the color through", () => {
    const v = buildVars(cfg({ scale: { size: 6, color: "var(--divider-color)" } }));
    expect(v["--slabton-scale-size"]).toBe("6px");
    expect(v["--slabton-scale-color"]).toBe("var(--divider-color)");
  });

  it("only sets what was configured", () => {
    const v = buildVars(cfg({ scale: { color: "red" } }));
    expect(v["--slabton-scale-color"]).toBe("red");
    expect(v["--slabton-scale-size"]).toBeUndefined();
  });

  it("lets styles: override the scale variables", () => {
    const v = buildVars(cfg({ scale: { size: 6 }, styles: { "scale-size": "12px", "scale-color": "teal" } }));
    expect(v["--slabton-scale-size"]).toBe("12px");
    expect(v["--slabton-scale-color"]).toBe("teal");
  });

  it("copes with a config without scale", () => {
    const { scale, ...rest } = cfg({ scale: true });
    expect(scale).not.toBeNull();
    expect(() => buildVars(rest)).not.toThrow();
  });

  it("removes the scale variables again when the option is dropped", () => {
    const host = document.createElement("div");
    const keys = applyVars(host, cfg({ scale: { size: 6, color: "red" } }));
    expect(host.style.getPropertyValue("--slabton-scale-size")).toBe("6px");
    applyVars(host, cfg(), keys);
    expect(host.style.getPropertyValue("--slabton-scale-size")).toBe("");
    expect(host.style.getPropertyValue("--slabton-scale-color")).toBe("");
  });
});

describe("dial variables from styles:", () => {
  it("sets and overrides the dial colors through styles:", () => {
    const v = buildVars(cfg({
      styles: { "dial-color": "teal", "hands-color": "var(--primary-text-color)", "second-hand-color": "#f44336" },
    }));
    expect(v["--slabton-dial-color"]).toBe("teal");
    expect(v["--slabton-hands-color"]).toBe("var(--primary-text-color)");
    expect(v["--slabton-second-hand-color"]).toBe("#f44336");
  });

  it("sets none of them by default", () => {
    const v = buildVars(cfg());
    for (const name of ["--slabton-dial-color", "--slabton-hands-color", "--slabton-second-hand-color"]) {
      expect(v[name], name).toBeUndefined();
    }
  });

  it("drops unsafe values (S5)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const v = buildVars(cfg({
      styles: { "dial-color": "red;}", "hands-color": "url(http://x/y.png)", "second-hand-color": "javascript:alert(1)" },
    }));
    for (const name of ["--slabton-dial-color", "--slabton-hands-color", "--slabton-second-hand-color"]) {
      expect(v[name], name).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("lets the text: scale colors win over styles:", () => {
    const v = buildVars(cfg({
      styles: { "scale-label-color": "teal", "scale-label-size": "20px" },
      text: { scale: { color: "red" } },
    }));
    expect(v["--slabton-scale-label-color"]).toBe("red");
    expect(v["--slabton-scale-label-size"]).toBe("20px");
  });
});

describe("applyVars", () => {
  it("sets text variables and removes them again when the option is dropped", () => {
    const host = document.createElement("div");
    const keys = applyVars(host, cfg({ text: { header: { font_size: 16, icon_color: "red" } } }));
    expect(host.style.getPropertyValue("--slabton-header-size")).toBe("16px");
    expect(host.style.getPropertyValue("--slabton-header-icon-color")).toBe("red");
    applyVars(host, cfg(), keys);
    expect(host.style.getPropertyValue("--slabton-header-size")).toBe("");
    expect(host.style.getPropertyValue("--slabton-header-icon-color")).toBe("");
  });

  it("sets variables and removes stale ones", () => {
    const host = document.createElement("div");
    const keys = applyVars(host, cfg({ bar_color: "navy" }));
    expect(host.style.getPropertyValue("--slabton-bar-color")).toBe("navy");
    applyVars(host, cfg(), keys);
    expect(host.style.getPropertyValue("--slabton-bar-color")).toBe("");
    expect(host.style.getPropertyValue("--slabton-thickness")).toBe("48px");
  });
});

describe("handleExtra", () => {
  it("is half the excess of the handle over the bar, never negative", () => {
    expect(handleExtra(cfg({ thickness: 18, handle_size: 70 }))).toBe(26);
    expect(handleExtra(cfg({ thickness: 48, handle_size: 48 }))).toBe(0);
    expect(handleExtra(cfg({ thickness: 48, handle_size: 40 }))).toBe(0);
  });
});

describe("buildCss", () => {
  it("pads the stage across and along the bar for both orientations", () => {
    const css = buildCss();
    expect(css).toContain(".o-h .stage { padding: var(--slabton-cross-extra, 0px) var(--slabton-overhang, 0px); }");
    expect(css).toContain(".o-v .stage { padding: var(--slabton-overhang, 0px) var(--slabton-cross-extra, 0px); }");
  });

  it("contains theme fallbacks and motion handling", () => {
    const css = buildCss();
    expect(css).toContain("var(--slabton-bar-color, var(--secondary-background-color");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain(".o-v .carrier");
  });

  it("styles bar text and info without letting them capture the pointer", () => {
    const css = buildCss();
    expect(css).toMatch(/\.bar-text, \.info \{[^}]*pointer-events: none/);
    expect(css).toContain(".o-v .stage.has-info");
    expect(css).toContain(".o-h .info.info-right");
  });

  it("keeps the shared layout of bar text and info after splitting the size and color rules", () => {
    const css = buildCss();
    expect(css).toMatch(/\.bar-text, \.info \{[^}]*overflow: hidden[^}]*text-overflow: ellipsis/);
    expect(css).toMatch(/\.bar-text, \.info \{[^}]*font-weight: 500/);
    expect(css).toContain(".o-v .bar-text { inset: 0; padding: calc(var(--slabton-hl) + 12px) 0; writing-mode: vertical-rl; }");
    expect(css).toContain(".o-v .info { position: static; max-width: 100%; }");
  });

  it("keeps today's sizes as defaults of the text variables", () => {
    const css = buildCss();
    expect(css).toMatch(/\.header \{[^}]*font-size: var\(--slabton-header-size, 14px\)/);
    expect(css).toMatch(/\.bar-text \{[^}]*font-size: var\(--slabton-bar-text-size, 13px\)/);
    expect(css).toMatch(/\.info \{[^}]*font-size: var\(--slabton-info-size, 13px\)/);
    expect(css).toMatch(/\.handle \{[^}]*font-size: var\(--slabton-button-size, 14px\)/);
  });

  it("falls back to the common text color for every area", () => {
    const css = buildCss();
    const fallback = "var(--slabton-text-color, var(--primary-text-color, #212121))";
    expect(css).toMatch(new RegExp(`\\.bar-text \\{[^}]*color: var\\(--slabton-bar-text-color, ${escapeRe(fallback)}\\)`));
    expect(css).toMatch(new RegExp(`\\.info \\{[^}]*color: var\\(--slabton-info-color, ${escapeRe(fallback)}\\)`));
    expect(css).toMatch(new RegExp(`\\.handle \\{[^}]*color: var\\(--slabton-button-color, ${escapeRe(fallback)}\\)`));
  });

  it("draws the scale behind the handle without capturing the pointer", () => {
    const css = buildCss();
    expect(css).toMatch(/\.rail, \.switches, \.scale \{[^}]*pointer-events: none/);
    expect(css).toMatch(/\.o-h \.switches, \.o-h \.scale \{[^}]*left: calc\(var\(--slabton-pad\) \+ var\(--slabton-hl\) \/ 2\)/);
    expect(css).toMatch(/\.o-v \.switches, \.o-v \.scale \{[^}]*top: calc\(var\(--slabton-pad\) \+ var\(--slabton-hl\) \/ 2\)/);
  });

  it("places the ticks per orientation and position from the tick fraction", () => {
    const css = buildCss();
    expect(css).toMatch(/\.o-h \.tick \{[^}]*left: calc\(var\(--slabton-tick-e, 0\) \* 100%\)/);
    expect(css).toMatch(/\.o-v \.tick \{[^}]*top: calc\(var\(--slabton-tick-e, 0\) \* 100%\)/);
    for (const rule of [
      ".o-h .sc-start .tick { top: 0; }", ".o-h .sc-end .tick { bottom: 0; }",
      ".o-v .sc-start .tick { left: 0; }", ".o-v .sc-end .tick { right: 0; }",
    ]) expect(css).toContain(rule);
    expect(css).toMatch(/\.o-h \.sc-center \.tick \{[^}]*top: 50%/);
    expect(css).toMatch(/\.o-v \.sc-center \.tick \{[^}]*left: 50%/);
  });

  it("sizes and colors the ticks from variables with theme fallbacks", () => {
    const css = buildCss();
    expect(css).toContain("var(--slabton-scale-size, 8px)");
    expect(css).toMatch(/\.tick \{[^}]*background: var\(--slabton-scale-color, color-mix\(in srgb, var\(--slabton-text-color, var\(--primary-text-color, #212121\)\) 45%, transparent\)\)/);
  });

  it("places the tick labels on the tick track, on the side of the bar's middle", () => {
    const css = buildCss();
    expect(css).toMatch(/\.tick-label \{[^}]*position: absolute[^}]*pointer-events: none/);
    expect(css).toMatch(/\.o-h \.tick-label \{[^}]*left: calc\(var\(--slabton-tick-e, 0\) \* 100%\)[^}]*translateX\(-50%\)/);
    expect(css).toMatch(/\.o-v \.tick-label \{[^}]*top: calc\(var\(--slabton-tick-e, 0\) \* 100%\)[^}]*translateY\(-50%\)/);
    const clear = "calc(var(--slabton-scale-size, 8px) + 3px)";
    expect(css).toContain(`.o-h .sc-start .tick-label { top: ${clear}; }`);
    expect(css).toContain(`.o-h .sc-end .tick-label { bottom: ${clear}; }`);
    expect(css).toContain(`.o-v .sc-start .tick-label { left: ${clear}; }`);
    expect(css).toContain(`.o-v .sc-end .tick-label { right: ${clear}; }`);
    expect(css).toMatch(/\.o-h \.sc-center \.tick-label \{[^}]*top: 2px/);
    expect(css).toMatch(/\.o-v \.sc-center \.tick-label \{[^}]*left: 3px/);
  });

  it("sizes and colors the tick labels from variables with theme fallbacks", () => {
    const css = buildCss();
    expect(css).toMatch(/\.tick-label \{[^}]*font-size: var\(--slabton-scale-label-size, 10px\)/);
    expect(css).toMatch(new RegExp(
      `\\.tick-label \\{[^}]*color: var\\(--slabton-scale-label-color, ${escapeRe("var(--slabton-text-color, var(--primary-text-color, #212121))")}\\)`,
    ));
  });

  it("sizes the dial to the handle's cross size", () => {
    expect(buildCss()).toMatch(/\.dial \{[^}]*width: var\(--slabton-hc\)[^}]*height: var\(--slabton-hc\)/);
  });

  it("colors the dial and the hands from variables with theme fallbacks", () => {
    const css = buildCss();
    expect(css).toMatch(/\.dial-tick \{[^}]*stroke: var\(--slabton-dial-color, currentColor\)/);
    expect(css).toMatch(/\.dial-num \{[^}]*fill: var\(--slabton-dial-color, currentColor\)/);
    expect(css).toMatch(/\.hand line \{[^}]*stroke: var\(--slabton-hands-color, currentColor\)/);
    expect(css).toMatch(/\.dial-hub \{[^}]*fill: var\(--slabton-hands-color, currentColor\)/);
    expect(css).toMatch(/\.hand-second line \{[^}]*stroke: var\(--slabton-second-hand-color, var\(--primary-color, #03a9f4\)\)/);
  });

  it("turns the hands through the transform attribute without a transition or layout animation", () => {
    const css = buildCss();
    const dial = css.slice(css.indexOf(".dial {"), css.indexOf(".dial-hub"));
    expect(dial).not.toMatch(/transition|animation|transform/);
  });

  it("colors the header title and icon independently", () => {
    const css = buildCss();
    expect(css).toMatch(/\.title \{[^}]*color: var\(--slabton-header-color, inherit\)/);
    expect(css).toMatch(/\.header ha-icon \{[^}]*color: var\(--slabton-header-icon-color, inherit\)/);
    // The title color must not sit on .header, or the icon would inherit it.
    expect(css).not.toMatch(/\.header \{[^}]*--slabton-header-color/);
  });
});

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

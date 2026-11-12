import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../../src/core/config.js";
import { applyVars, buildCss, buildVars, handleDimensions } from "../../src/ui/styles.js";

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

const TEXT_VAR_NAMES = [
  "--slabton-header-size", "--slabton-header-color", "--slabton-header-icon-color",
  "--slabton-bar-text-size", "--slabton-bar-text-color",
  "--slabton-info-size", "--slabton-info-color",
  "--slabton-button-size", "--slabton-button-color",
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
      },
    }));
    expect(v).toMatchObject({
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

describe("buildCss", () => {
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

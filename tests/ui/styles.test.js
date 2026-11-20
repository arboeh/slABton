import { describe, expect, it, vi } from "vitest";
import { normalizeConfig } from "../../src/core/config.js";
import {
  applyVars, buildCss, buildVars, cardHeightPx, handleDimensions, handleExtra, handleOverhang,
} from "../../src/ui/styles.js";

const cfg = (extra = {}) => normalizeConfig({ entity: "input_select.x", ...extra });

describe("cardHeightPx", () => {
  it("is the chrome plus the larger of bar and handle (horizontal)", () => {
    // Seen in the Home Assistant default theme (screenshot): 74, 68 and 96 px high. A theme with a different
    // card padding or border changes the chrome; these tests pin the formula, not the theme.
    expect(cardHeightPx(cfg({ thickness: 48, handle_size: 40 }))).toBe(74);
    expect(cardHeightPx(cfg({ thickness: 18, handle_size: 42 }))).toBe(68);
    expect(cardHeightPx(cfg({ thickness: 18, handle_size: 70 }))).toBe(96);
  });

  it("is the bar length plus the chrome plus the overhang at both ends (vertical)", () => {
    const vertical = { orientation: "vertical" };
    expect(cardHeightPx(cfg({ ...vertical, thickness: 48, handle_size: 40 }))).toBe(186);
    expect(cardHeightPx(cfg({ ...vertical, thickness: 32, handle_size: 40 }))).toBe(194);
    expect(cardHeightPx(cfg({ ...vertical, thickness: 48, handle_size: 40, handle_overhang: true }))).toBe(226);
    expect(cardHeightPx(cfg({ ...vertical, length: 200 }))).toBe(226);
  });
});

describe("cardHeightPx with scale labels outside", () => {
  const outside = (extra = {}, scale = {}) => cfg({
    entity: "sensor.x", mode: "value", min: 0, max: 100,
    scale: { ticks: 4, labels: true, labels_placement: "outside", ...scale }, ...extra,
  });

  it("adds the label font size plus the gap (horizontal)", () => {
    expect(cardHeightPx(outside({ thickness: 48, handle_size: 40 }))).toBe(87);
    expect(cardHeightPx(outside({ thickness: 14, handle_size: 20 }))).toBe(59);
    expect(cardHeightPx(outside({ thickness: 18, handle_size: 70 }))).toBe(109);
  });

  it("follows text.scale.font_size", () => {
    expect(cardHeightPx(outside({ text: { scale: { font_size: 14 } } }))).toBe(91);
  });

  it("adds nothing for labels inside, without labels or in a vertical bar", () => {
    const inside = cfg({ entity: "sensor.x", mode: "value", min: 0, max: 100, scale: { labels: true } });
    expect(cardHeightPx(inside)).toBe(74);
    expect(cardHeightPx(cfg({ entity: "sensor.x", mode: "value", scale: { ticks: 4 } }))).toBe(74);
    expect(cardHeightPx(outside({ orientation: "vertical" }))).toBe(186);
  });
});

describe("cardHeightPx with a styles: override of the scale sizes", () => {
  const scaleOut = (extra = {}, scale = {}) => cfg({
    entity: "sensor.x", mode: "value", min: 0, max: 100, thickness: 48, handle_size: 40,
    scale: { ticks: 4, labels: true, labels_placement: "outside", ...scale }, ...extra,
  });
  const ticksOut = (extra = {}, scale = {}) => scaleOut(extra, { ticks_placement: "outside", labels_placement: "inside", ...scale });

  it("counts a px label size from styles: like text.scale.font_size", () => {
    expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": "14px" } }))).toBe(91);
    expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": "14PX" } }))).toBe(91);
    expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": "0" } }))).toBe(26 + 48 + 3);
    expect(cardHeightPx(scaleOut({ styles: { "--slabton-scale-label-size": "14px" } }))).toBe(91);
    expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": "14px" } }))).toBe(cardHeightPx(scaleOut({ text: { scale: { font_size: 14 } } })));
  });

  it("ranks text.scale.font_size above styles:", () => {
    expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": "20px" }, text: { scale: { font_size: 14 } } }))).toBe(91);
  });

  it("falls back to the default for units the card cannot resolve", () => {
    for (const value of ["1.2em", "1rem", "50%", "var(--my-size)", "calc(10px + 2px)", "large", "px", "14", "14 px", "-5px", "1e2", "+5px"]) {
      expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": value } })), value).toBe(87);
    }
    expect(cardHeightPx(scaleOut({ styles: { "scale-label-size": 14 } })), "number 14").toBe(87);
  });

  it("counts a px tick length from styles: and lets it win over scale.size", () => {
    expect(cardHeightPx(ticksOut({ styles: { "scale-size": "12px" } }))).toBe(86);
    expect(cardHeightPx(ticksOut({ styles: { "scale-size": "12px" } }, { size: 6 }))).toBe(86);
    expect(cardHeightPx(ticksOut({}, { size: 6 }))).toBe(80);
  });

  it("falls back to scale.size or the default for a tick length in another unit", () => {
    expect(cardHeightPx(ticksOut({ styles: { "scale-size": "1em" } }))).toBe(82);
    expect(cardHeightPx(ticksOut({ styles: { "scale-size": "var(--x)" } }, { size: 6 }))).toBe(80);
  });

  it("counts both overrides when ticks and labels stand outside", () => {
    const both = scaleOut({ styles: { "scale-label-size": "14px", "scale-size": "12px" } }, { ticks_placement: "outside" });
    expect(cardHeightPx(both)).toBe(26 + 48 + 12 + 14 + 3);
  });

  it("ignores the overrides for labels and ticks inside and for a vertical bar", () => {
    const styles = { "scale-label-size": "14px", "scale-size": "12px" };
    expect(cardHeightPx(cfg({ entity: "sensor.x", mode: "value", scale: { ticks: 4, labels: true }, styles }))).toBe(74);
    expect(cardHeightPx(scaleOut({ orientation: "vertical", styles }, { ticks_placement: "outside" }))).toBe(186);
  });
});

describe("scale labels outside (css)", () => {
  const css = buildCss();

  it("keeps the gap to the bar at the handle's excess plus the label gap", () => {
    expect(css).toContain("calc(var(--slabton-cross-extra, 0px) + 3px)");
  });

  it("takes the handle-centre track as the margin of the label container in every mode", () => {
    expect(css).toContain(".o-h .scale-labels { margin-inline: calc(var(--slabton-border-width) + var(--slabton-pad) + var(--slabton-hl) / 2); }");
    expect(css).toContain(".o-v .scale-labels { margin-block: calc(var(--slabton-border-width) + var(--slabton-pad) + var(--slabton-hl) / 2); }");
    expect(css).not.toContain("scale-full");
  });

  it("frees the stage padding on the label side", () => {
    expect(css).toContain(".o-h .stage.lbl-start, .o-h .stage.tk-start { padding-top: 0; }");
    expect(css).toContain(".o-h .stage.lbl-end, .o-h .stage.tk-end { padding-bottom: 0; }");
    expect(css).toContain(".o-v .stage.lbl-start, .o-v .stage.tk-start { padding-left: 0; }");
    expect(css).toContain(".o-v .stage.lbl-end, .o-v .stage.tk-end { padding-right: 0; }");
  });
});

describe("cardHeightPx with scale ticks outside", () => {
  const ticksOut = (extra = {}, scale = {}) => cfg({
    entity: "sensor.x", mode: "value", min: 0, max: 100,
    scale: { ticks: 4, ticks_placement: "outside", ...scale }, ...extra,
  });

  it("adds the tick length (default 8, or scale.size) horizontally", () => {
    expect(cardHeightPx(ticksOut({ thickness: 48, handle_size: 40 }))).toBe(82);
    expect(cardHeightPx(ticksOut({ thickness: 14, handle_size: 20 }))).toBe(54);
    expect(cardHeightPx(ticksOut({ thickness: 48, handle_size: 40 }, { size: 6 }))).toBe(80);
  });

  it("adds ticks and labels when both stand outside", () => {
    expect(cardHeightPx(ticksOut({ thickness: 48, handle_size: 40 }, { labels: true, labels_placement: "outside" }))).toBe(95);
    expect(cardHeightPx(ticksOut({ thickness: 14, handle_size: 20 }, { labels: true, labels_placement: "outside" }))).toBe(67);
  });

  it("adds only the ticks for ticks outside with labels inside", () => {
    expect(cardHeightPx(ticksOut({ thickness: 48, handle_size: 40 }, { labels: true }))).toBe(82);
  });

  it("adds no tick length for none, only the labels outside", () => {
    const none = (scale) => cfg({
      entity: "sensor.x", mode: "value", min: 0, max: 100,
      scale: { ticks: 4, labels: true, ticks_placement: "none", ...scale },
    });
    expect(cardHeightPx(none({}))).toBe(74);
    expect(cardHeightPx(none({ labels_placement: "outside" }))).toBe(87);
  });

  it("adds nothing for ticks inside or in a vertical bar", () => {
    expect(cardHeightPx(cfg({ entity: "sensor.x", mode: "value", scale: { ticks: 4 } }))).toBe(74);
    expect(cardHeightPx(ticksOut({ orientation: "vertical" }))).toBe(186);
  });
});

describe("scale ticks outside (css)", () => {
  const css = buildCss();

  it("lays the stage out as a grid for ticks outside too", () => {
    expect(css).toContain(".stage.tk-out");
  });

  it("frees the stage padding on the tick side", () => {
    expect(css).toContain(".o-h .stage.lbl-start, .o-h .stage.tk-start { padding-top: 0; }");
    expect(css).toContain(".o-h .stage.lbl-end, .o-h .stage.tk-end { padding-bottom: 0; }");
    expect(css).toContain(".o-v .stage.lbl-start, .o-v .stage.tk-start { padding-left: 0; }");
    expect(css).toContain(".o-v .stage.lbl-end, .o-v .stage.tk-end { padding-right: 0; }");
  });

  it("takes the handle-centre track as the margin of the tick container and the tick length as its size", () => {
    expect(css).toContain(".o-h .scale-ticks { margin-inline: calc(var(--slabton-border-width) + var(--slabton-pad) + var(--slabton-hl) / 2);");
    expect(css).toContain(".o-v .scale-ticks { margin-block: calc(var(--slabton-border-width) + var(--slabton-pad) + var(--slabton-hl) / 2);");
    expect(css).not.toContain("scale-full");
    expect(css).toContain("height: var(--slabton-scale-size, 8px)");
    expect(css).toContain("width: var(--slabton-scale-size, 8px)");
  });

  it("keeps the gap from the bar to the ticks at the handle's excess", () => {
    expect(css).toContain(".o-h .scale-ticks.tk-start { margin-bottom: var(--slabton-cross-extra, 0px); }");
    expect(css).toContain(".o-h .scale-ticks.tk-end { margin-top: var(--slabton-cross-extra, 0px); }");
  });

  it("puts labels inside next to the edge when the ticks are outside", () => {
    expect(css).toContain(".o-h .scale.tk-out.sc-start .tick-label { top: 3px; }");
    expect(css).toContain(".o-h .scale.tk-out.sc-end .tick-label { bottom: 3px; }");
  });
});

describe("vertical info above scale outside the bar (css)", () => {
  const css = buildCss();

  it("keeps the info in its own row and puts ticks, labels and bar into the row below", () => {
    expect(css).toContain(".o-v .stage.has-info.lbl-out, .o-v .stage.has-info.tk-out { grid-template-rows: auto var(--slabton-length); gap: 0; row-gap: 6px; align-items: stretch; }");
    // `.o-v .stage.has-info` centres the items; the tick and label containers need the full row height, because
    // their percentage `top` resolves against it (centred, the ticks collapse into one).
    expect(css).toContain("> .info { grid-row: 1; grid-column: 1 / span 3; justify-self: center; }");
    expect(css).toContain("> :not(.info) { grid-row: 2; }");
  });
});

describe("handleOverhang", () => {
  it("is the larger of half the handle length (with handle_overhang) and its excess over the bar", () => {
    expect(handleOverhang(cfg({ thickness: 48, handle_size: 40 }))).toBe(0);
    expect(handleOverhang(cfg({ thickness: 18, handle_size: 70 }))).toBe(26);
    expect(handleOverhang(cfg({ thickness: 48, handle_size: 40, handle_overhang: true }))).toBe(20);
    expect(handleOverhang(cfg({ thickness: 18, handle_size: 70, handle_overhang: true }))).toBe(35);
  });

  it("uses the longer side of an oval handle for the overhang", () => {
    const oval = cfg({ thickness: 48, handle_size: 40, handle_shape: "oval", handle_overhang: true });
    expect(handleOverhang(oval)).toBe(handleDimensions(oval).along / 2);
    expect(handleOverhang(oval)).toBeGreaterThan(20);
  });
});

describe("switch size", () => {
  // jsdom does not compute min() / calc(): check the rule text and the variables it reads.
  const css = buildCss();

  it("is 28px but never larger than the inside of the bar", () => {
    expect(css).toContain(
      "--slabton-sw-d: var(--slabton-switch-size, max(10px, min(28px, calc(var(--slabton-thickness) - 2 * var(--slabton-border-width)))));",
    );
    expect(css).toContain("width: var(--slabton-sw-d); height: var(--slabton-sw-d);");
  });

  it("scales the icon with the switch, up to 16px", () => {
    expect(css).toContain("--mdc-icon-size: min(16px, calc(var(--slabton-sw-d) * 0.6))");
  });

  it("gets the thickness and the border width as variables to read", () => {
    const v = buildVars(cfg({ thickness: 14, border_width: 2 }));
    expect(v["--slabton-thickness"]).toBe("14px");
    expect(v["--slabton-border-width"]).toBe("2px");
  });
});

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

  it("clips the stage along the main axis only, so the shifted carrier box cannot widen the page", () => {
    const css = buildCss();
    expect(css).toMatch(/\.o-h \.stage \{ overflow-x: clip; overflow-clip-margin: 18px; \}/);
    expect(css).toMatch(/\.o-v \.stage \{ overflow-y: clip; overflow-clip-margin: 18px; \}/);
    expect(css).not.toMatch(/\.o-[hv] \.bar \{[^}]*overflow-[xy]: clip/);
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
    expect(css).toMatch(/\.handle \{[^}]*font-size: min\(var\(--slabton-button-size, 14px\), /);
  });

  it("shrinks the handle text and its padding with the handle width so thin bars do not cut the value", () => {
    const css = buildCss();
    // 45 % of the width: the default handle (40 px) keeps the 14 px text, a 20 px handle gets 9 px.
    expect(css).toMatch(/\.handle \{[^}]*font-size: min\(var\(--slabton-button-size, 14px\), calc\(var\(--slabton-hw\) \* 0\.45\)\)/);
    expect(css).toMatch(/\.h-text \{[^}]*padding: 0 min\(4px, calc\(var\(--slabton-hw\) \/ 10\)\)/);
    // The on-screen width is the length horizontally and the cross size vertically.
    expect(css).toContain(".o-h .handle { --slabton-hw: var(--slabton-hl); }");
    expect(css).toContain(".o-v .handle { --slabton-hw: var(--slabton-hc); }");
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

  it("keeps the scale and the switches on the handle-centre track in every mode (no full-bar scale)", () => {
    const css = buildCss();
    expect(css).not.toContain("scale-full");
    expect(css).toMatch(/\.o-h \.switches, \.o-h \.scale \{[^}]*width: calc\(100% - 2 \* var\(--slabton-pad\) - var\(--slabton-hl\)\)/);
    expect(css).toMatch(/\.o-v \.switches, \.o-v \.scale \{[^}]*height: calc\(100% - 2 \* var\(--slabton-pad\) - var\(--slabton-hl\)\)/);
  });

  it("centres every label on its tick, the first and the last one too (no edge alignment)", () => {
    const css = buildCss();
    expect(css).not.toContain("data-edge");
    expect(css).toContain(".o-h .tick-label { left: calc(var(--slabton-tick-e, 0) * 100%); transform: translateX(-50%); }");
    expect(css).toContain(".o-v .tick-label { top: calc(var(--slabton-tick-e, 0) * 100%); transform: translateY(-50%); }");
  });

  it("ends the fill under the handle centre: pad + hl/2 + p * handle travel", () => {
    const css = buildCss();
    const ext = "--slabton-ext: calc(var(--slabton-pad) + var(--slabton-hl) / 2 + var(--slabton-p, 0) * (100% - 2 * var(--slabton-pad) - var(--slabton-hl)));";
    expect(css).toContain(ext);
    expect(css).not.toContain("--slabton-ext: calc(var(--slabton-p, 0) * 100%)");
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

  it("dims an unavailable bar but keeps the handle tappable for more-info", () => {
    const css = buildCss();
    expect(css).toMatch(/\.unavailable \.bar \{[^}]*opacity: 0\.5/);
    expect(css).not.toMatch(/\.unavailable[^{]*\.handle \{[^}]*pointer-events: none/);
    expect(css).toMatch(/\.blocked:not\(\.allow-actions\) \.handle \{[^}]*cursor: pointer[^}]*touch-action: auto/);
    expect(css).not.toMatch(/\.unavailable:not\(\.allow-actions\)/);
  });

  it("colors the unavailable icon with a variable and a warning fallback", () => {
    expect(buildCss()).toMatch(/\.unavailable \.h-icon \{[^}]*color: var\(--slabton-unavailable-color, var\(--warning-color, #ffa600\)\)/);
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

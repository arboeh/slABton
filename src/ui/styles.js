/*
 * CSS generation. Layout sizes and configured colors travel as CSS custom
 * properties set on the host element, so themes, `styles:` overrides and
 * card-mod (set on ha-card) can override them without touching the DOM.
 */

import { animationCss } from "./animations.js";
import {
  CARD_CHROME_PX, CARD_SIDE_CHROME_PX, DEFAULT_SCALE_LABEL_SIZE, DEFAULT_SCALE_SIZE, DEFAULT_VERTICAL_LENGTH, GRID, GRID_COLUMN_GAP_PX,
  GRID_COLUMN_PX, GRID_MAX_COLUMNS, HANDLE_EDGE_GAP_PX, OVAL_RATIO, PILL_RADIUS, SCALE_LABEL_GAP_PX,
  SQUARE_BAR_RADIUS_RATIO, SQUARE_HANDLE_RADIUS_RATIO, TEXT_OPTIONS,
} from "../core/constants.js";

/** Handle size across and along the bar axis, in px. */
export function handleDimensions(config) {
  const cross = config.handle_size;
  const along = config.handle_shape === "oval" ? Math.round(cross * OVAL_RATIO) : cross;
  return { cross, along };
}

/**
 * How far the handle sticks out of the bar on each side across the bar axis, in px.
 * Derived from the sizes, not from `pad` (a border makes `pad` negative for a handle
 * that still fits inside the bar). Zero when the handle is not larger than the bar.
 */
export function handleExtra(config) {
  return Math.max(0, (config.handle_size - config.thickness) / 2);
}

/**
 * How far the handle sticks out of the stage along the bar, on each end, in px: half its length with
 * `handle_overhang` (the centre travels edge to edge), never less than its excess across the bar.
 */
export function handleOverhang(config) {
  const { along } = handleDimensions(config);
  return Math.max(config.handle_overhang === true ? along / 2 : 0, handleExtra(config));
}

/**
 * Air kept between a handle that sticks out of the stage and the card edge, along the bar, in px. Zero when the handle
 * does not stick out along the bar (the stage then ends at the bar).
 */
export function handleGapAlong(config) {
  return handleOverhang(config) > 0 ? HANDLE_EDGE_GAP_PX : 0;
}

/** The same across the bar: zero when the handle is not larger than the bar. */
export function handleGapCross(config) {
  return handleExtra(config) > 0 ? HANDLE_EDGE_GAP_PX : 0;
}

/**
 * Columns a vertical card needs in the sections view so that the handle fits across the card (handle or bar width,
 * the card padding and, when it sticks out, its edge gap). At least the default columns, at most `GRID_MAX_COLUMNS` (one section).
 */
export function gridColumns(config) {
  const needed = Math.max(config.thickness, config.handle_size) + 2 * (CARD_SIDE_CHROME_PX + handleGapCross(config));
  const columns = Math.ceil((needed + GRID_COLUMN_GAP_PX) / (GRID_COLUMN_PX + GRID_COLUMN_GAP_PX));
  return Math.min(GRID_MAX_COLUMNS, Math.max(GRID.vertical.columns, columns));
}

/** A length in `px` ("14px", "14.5px", ".5px", "14PX") or a bare "0"; nothing else. CSS rejects a unitless non-zero length. */
const PX_VALUE_RE = /^(?:(\d*\.?\d+)px|0)$/i;

/**
 * Value of a `styles:` override in px, or undefined when it is not set or not a px value (`em`, `rem`, `%`,
 * `var()`, `calc()`): the card cannot know what those resolve to, so they count as not set.
 */
function stylePx(config, name) {
  const match = PX_VALUE_RE.exec(String(config.styles?.[name] ?? "").trim());
  return match ? Number(match[1] ?? 0) : undefined;
}

/**
 * Height the scale labels outside the bar add to a horizontal card, in px: the label font size (one line,
 * `line-height: 1`) plus the gap. Zero without labels outside. The font size ranks `text.scale.font_size`, then a
 * `styles:` override in px, then the default.
 */
function outsideLabelsPx(config) {
  if (!config.scale?.labels || config.scale.labelsPlacement !== "outside") return 0;
  const size = config.text?.scale?.font_size ?? stylePx(config, "--slabton-scale-label-size") ?? DEFAULT_SCALE_LABEL_SIZE;
  return size + SCALE_LABEL_GAP_PX;
}

/**
 * Height the scale ticks outside the bar add to a horizontal card, in px: the tick length (`scale.size`, then a
 * `styles:` override in px, then the default; the same order as in `buildVars`). Zero for ticks inside.
 */
function outsideTicksPx(config) {
  if (config.scale?.ticksPlacement !== "outside") return 0;
  return stylePx(config, "--slabton-scale-size") ?? config.scale.size ?? DEFAULT_SCALE_SIZE;
}

/**
 * Height the card needs in px (without a header): horizontal, the chrome plus the larger of bar and handle
 * (plus the ticks and labels outside the bar); vertical, the bar length (or its default) plus the chrome plus the overhang
 * at both ends (labels outside widen the card, they do not make it higher).
 */
export function cardHeightPx(config) {
  if (config.orientation !== "vertical") {
    return CARD_CHROME_PX + 2 * handleGapCross(config) + Math.max(config.thickness, config.handle_size)
      + outsideTicksPx(config) + outsideLabelsPx(config);
  }
  const length = config.length > 0 ? config.length : DEFAULT_VERTICAL_LENGTH;
  return length + CARD_CHROME_PX + 2 * (handleOverhang(config) + handleGapAlong(config));
}

/** Variables for the configured `text:` options only; unset options keep the CSS default. */
function textVars(text) {
  const vars = {};
  for (const [area, options] of Object.entries(TEXT_OPTIONS)) {
    for (const [option, { css, unit }] of Object.entries(options)) {
      const value = text?.[area]?.[option];
      if (value == null) continue;
      vars[css] = unit ? `${value}${unit}` : value;
    }
  }
  return vars;
}

/** Variables of the stickshift layer: point size and opacity and the gate; colors only when configured. */
function stickshiftVars(sx) {
  if (!sx) return {};
  const vars = {
    "--slabton-sx-d": `${sx.point_size}px`,
    "--slabton-sx-opacity": String(sx.point_opacity),
    "--slabton-sx-gate-size": `${sx.gate.size}px`,
  };
  if (sx.gate.color) vars["--slabton-sx-gate-color"] = sx.gate.color;
  return vars;
}

/** CSS custom properties derived from the config (name -> value). */
export function buildVars(config) {
  const { cross, along } = handleDimensions(config);
  const vertical = config.orientation === "vertical";
  const square = config.handle_shape === "square";
  const barRadius = config.border_radius ?? (square ? Math.round(config.thickness * SQUARE_BAR_RADIUS_RATIO) : Math.round(config.thickness / 2));
  // Overhang: the handle centre travels from edge to edge, so it sticks out half its length at both ends.
  const overhang = config.handle_overhang === true;
  const pad = overhang ? -along / 2 : (config.thickness - cross) / 2 - config.border_width;
  const extra = handleExtra(config);

  const vars = {
    "--slabton-length": config.length > 0 ? `${config.length}px` : (vertical ? `${DEFAULT_VERTICAL_LENGTH}px` : "100%"),
    "--slabton-thickness": `${config.thickness}px`,
    "--slabton-hc": `${cross}px`,
    "--slabton-hl": `${along}px`,
    "--slabton-pad": `${pad}px`,
    // Room the stage keeps free for the handle: along the bar the larger of overhang and
    // the handle's excess over the bar, across the bar the excess only.
    "--slabton-overhang": `${handleOverhang(config)}px`,
    "--slabton-cross-extra": `${extra}px`,
    // Air between the handle and the card edge where it sticks out (the stage padding adds it; ticks keep using the two above).
    "--slabton-gap-along": `${handleGapAlong(config)}px`,
    "--slabton-gap-cross": `${handleGapCross(config)}px`,
    "--slabton-bar-radius": `${barRadius}px`,
    "--slabton-handle-radius": square ? `${Math.round(cross * SQUARE_HANDLE_RADIUS_RATIO)}px` : PILL_RADIUS,
    "--slabton-border-width": `${config.border_width}px`,
  };
  if (config.bar_color) vars["--slabton-bar-color"] = config.bar_color;
  if (config.fill_color) vars["--slabton-fill-color"] = config.fill_color;
  if (config.handle_color) vars["--slabton-handle-color"] = config.handle_color;
  if (config.text_color) vars["--slabton-text-color"] = config.text_color;
  if (config.border_color) vars["--slabton-border-color"] = config.border_color;
  Object.assign(vars, stickshiftVars(config.stickshift));
  if (config.scale?.size != null) vars["--slabton-scale-size"] = `${config.scale.size}px`;
  if (config.scale?.color) vars["--slabton-scale-color"] = config.scale.color;
  // `text:` comes after `styles:` so that it wins: text option > styles > default.
  return { ...vars, ...config.styles, ...textVars(config.text) };
}

/**
 * Apply the variables to `host`, removing ones set by a previous config.
 * @returns {string[]} the keys now set (pass back as `previousKeys`)
 */
export function applyVars(host, config, previousKeys = []) {
  for (const key of previousKeys) host.style.removeProperty(key);
  const vars = buildVars(config);
  for (const [key, value] of Object.entries(vars)) host.style.setProperty(key, value);
  return Object.keys(vars);
}

/**
 * Labels at the scale ticks (`scale.labels`): on the track of the ticks, next to the tick on the side
 * that faces the middle of the bar (centred scales: at the start edge).
 */
function scaleLabelCss() {
  const clear = `calc(var(--slabton-scale-size, ${DEFAULT_SCALE_SIZE}px) + ${SCALE_LABEL_GAP_PX}px)`;
  return `
    .tick-label {
      position: absolute; line-height: 1; white-space: nowrap; pointer-events: none;
      font-size: var(--slabton-scale-label-size, ${DEFAULT_SCALE_LABEL_SIZE}px);
      color: var(--slabton-scale-label-color, var(--slabton-text-color, var(--primary-text-color, #212121)));
    }
    .o-h .tick-label { left: calc(var(--slabton-tick-e, 0) * 100%); transform: translateX(-50%); }
    .o-v .tick-label { top: calc(var(--slabton-tick-e, 0) * 100%); transform: translateY(-50%); }
    .o-h .sc-start .tick-label { top: ${clear}; }
    .o-h .sc-end .tick-label { bottom: ${clear}; }
    .o-h .sc-center .tick-label { top: 2px; }
    .o-v .sc-start .tick-label { left: ${clear}; }
    .o-v .sc-end .tick-label { right: ${clear}; }
    .o-v .sc-center .tick-label { left: 3px; }
    .o-h .scale.tk-out.sc-start .tick-label { top: ${SCALE_LABEL_GAP_PX}px; }
    .o-h .scale.tk-out.sc-end .tick-label { bottom: ${SCALE_LABEL_GAP_PX}px; }
    .o-v .scale.tk-out.sc-start .tick-label { left: ${SCALE_LABEL_GAP_PX}px; }
    .o-v .scale.tk-out.sc-end .tick-label { right: ${SCALE_LABEL_GAP_PX}px; }
    ${outsideLabelCss()}
    ${outsideTickCss()}`;
}

/**
 * Margin along the bar of the containers outside the bar: border, handle padding and half the handle length,
 * the handle-centre track (all modes: marks and labels stand over the handle positions, like the fill edge).
 */
const OUTSIDE_TRACK = "calc(var(--slabton-border-width) + var(--slabton-pad) + var(--slabton-hl) / 2)";

/**
 * Labels outside the bar (`scale.labels_placement: outside`). The stage becomes a grid with the labels and the
 * bar in flow, so the card grows by itself. The label container leaves the tick track as margin, so every label
 * stands exactly over its tick. The gap to the bar is the handle's reach out of the bar plus a little air; the
 * stage padding on the label side (and on the tick side, see `outsideTickCss`) is dropped.
 */
function outsideLabelCss() {
  const gap = `calc(var(--slabton-cross-extra, 0px) + ${SCALE_LABEL_GAP_PX}px)`;
  return `
    .stage.lbl-out, .stage.tk-out { display: grid; justify-content: center; }
    .o-h .stage.lbl-out, .o-h .stage.tk-out { grid-template-columns: var(--slabton-length); }
    .o-v .stage.lbl-out, .o-v .stage.tk-out { grid-template-rows: var(--slabton-length); grid-auto-flow: column; }
    .o-h .stage.lbl-start, .o-h .stage.tk-start { padding-top: 0; }
    .o-h .stage.lbl-end, .o-h .stage.tk-end { padding-bottom: 0; }
    .o-v .stage.lbl-start, .o-v .stage.tk-start { padding-left: 0; }
    .o-v .stage.lbl-end, .o-v .stage.tk-end { padding-right: 0; }
    .o-h .scale-labels.lbl-start { margin-bottom: ${gap}; }
    .o-h .scale-labels.lbl-end { margin-top: ${gap}; }
    .o-v .scale-labels.lbl-start { margin-right: ${gap}; }
    .o-v .scale-labels.lbl-end { margin-left: ${gap}; }
    .o-h .stage.tk-out .scale-labels.lbl-start { margin-bottom: ${SCALE_LABEL_GAP_PX}px; }
    .o-h .stage.tk-out .scale-labels.lbl-end { margin-top: ${SCALE_LABEL_GAP_PX}px; }
    .o-v .stage.tk-out .scale-labels.lbl-start { margin-right: ${SCALE_LABEL_GAP_PX}px; }
    .o-v .stage.tk-out .scale-labels.lbl-end { margin-left: ${SCALE_LABEL_GAP_PX}px; }
    .scale-labels { display: grid; pointer-events: none; }
    .o-h .scale-labels { margin-inline: ${OUTSIDE_TRACK}; }
    .o-v .scale-labels { margin-block: ${OUTSIDE_TRACK}; }
    .scale-labels .tick-label { position: relative; grid-area: 1 / 1; }
    .o-h .scale-labels .tick-label { justify-self: start; }
    .o-v .scale-labels .tick-label { align-self: start; }
    .o-v .scale-labels.lbl-start .tick-label { justify-self: end; }
    .o-v .scale-labels.lbl-end .tick-label { justify-self: start; }
    /* Vertical timer with info: the info keeps its own row above the bar, ticks and labels (they share row 2). */
    .o-v .stage.has-info.lbl-out, .o-v .stage.has-info.tk-out { grid-template-rows: auto var(--slabton-length); gap: 0; row-gap: 6px; align-items: stretch; }
    .o-v .stage.has-info.lbl-out > .info, .o-v .stage.has-info.tk-out > .info { grid-row: 1; grid-column: 1 / span 3; justify-self: center; }
    .o-v .stage.has-info.lbl-out > :not(.info), .o-v .stage.has-info.tk-out > :not(.info) { grid-row: 2; }`;
}

/**
 * Ticks outside the bar (`scale.ticks_placement: outside`): a container between bar and labels on the same grid.
 * Its margin along the bar is the tick track (as for the labels), its size across the bar the tick length; the
 * gap to the bar is the handle's reach out of it (the stage padding on the tick side is dropped in `outsideLabelCss`).
 */
function outsideTickCss() {
  const extra = "var(--slabton-cross-extra, 0px)";
  const size = `var(--slabton-scale-size, ${DEFAULT_SCALE_SIZE}px)`;
  return `
    .scale-ticks { position: relative; pointer-events: none; }
    .o-h .scale-ticks { margin-inline: ${OUTSIDE_TRACK}; height: ${size}; }
    .o-v .scale-ticks { margin-block: ${OUTSIDE_TRACK}; width: ${size}; }
    .o-h .scale-ticks .tick { top: 0; }
    .o-v .scale-ticks .tick { left: 0; }
    .o-h .scale-ticks.tk-start { margin-bottom: ${extra}; }
    .o-h .scale-ticks.tk-end { margin-top: ${extra}; }
    .o-v .scale-ticks.tk-start { margin-right: ${extra}; }
    .o-v .scale-ticks.tk-end { margin-left: ${extra}; }`;
}

/**
 * Dial of the analog clock (inline SVG in the handle). Colors come from variables with theme fallbacks:
 * `--slabton-dial-color` (ticks, numbers), `--slabton-hands-color`, `--slabton-second-hand-color`.
 * The hands turn through their `transform` attribute; there is no transition (they jump once per second).
 */
function dialCss() {
  return `
    .dial { display: block; flex: none; width: var(--slabton-hc); height: var(--slabton-hc); }
    .dial-tick { stroke: var(--slabton-dial-color, currentColor); stroke-width: 1.4; stroke-linecap: round; }
    .dial-tick.quarter { stroke-width: 2.4; }
    .dial-num { fill: var(--slabton-dial-color, currentColor); font-size: 11px; font-weight: 600; text-anchor: middle; dominant-baseline: central; }
    .hand line { stroke: var(--slabton-hands-color, currentColor); stroke-linecap: round; }
    .hand-hour line { stroke-width: 3.4; }
    .hand-minute line { stroke-width: 2.4; }
    .hand-second line { stroke: var(--slabton-second-hand-color, var(--primary-color, #03a9f4)); stroke-width: 1.2; }
    .dial-hub { fill: var(--slabton-hands-color, currentColor); }`;
}

/**
 * Stickshift layer (`.sx`, on the handle-centre track like the switches): the gate (thin line) and one button per state. The points stay below the handle (DOM order). Sizes, opacity and
 * colors come from `--slabton-sx-*`.
 */
function stickshiftCss() {
  const d = "var(--slabton-sx-d, 32px)";
  const gate = "var(--slabton-sx-gate-size, 4px)";
  const ink = "var(--slabton-text-color, var(--primary-text-color, #212121))";
  return `
    .sx { --slabton-sx-pl: ${d}; }
    .sxs-oval { --slabton-sx-pl: calc(${d} * ${OVAL_RATIO}); }
    /* Gate: one segment per pair of neighbours, from the edge of one point to the edge of the next (a and b are the
       track fractions of the two point centres, a < b; half a point length is taken off each end). */
    .sx-seg { position: absolute; pointer-events: none; border-radius: 999px; background: var(--slabton-sx-gate-color, color-mix(in srgb, ${ink} 25%, transparent)); }
    .o-h .sx-seg { top: 50%; height: ${gate}; margin-top: calc(${gate} / -2); left: calc(var(--slabton-sx-a, 0) * 100% + var(--slabton-sx-pl) / 2); width: max(0px, calc((var(--slabton-sx-b, 1) - var(--slabton-sx-a, 0)) * 100% - var(--slabton-sx-pl))); }
    .o-v .sx-seg { left: 50%; width: ${gate}; margin-left: calc(${gate} / -2); top: calc(var(--slabton-sx-a, 0) * 100% + var(--slabton-sx-pl) / 2); height: max(0px, calc((var(--slabton-sx-b, 1) - var(--slabton-sx-a, 0)) * 100% - var(--slabton-sx-pl))); }
    .sx-pt {
      position: absolute; pointer-events: auto; box-sizing: border-box; padding: 0; margin: 0; overflow: hidden;
      width: ${d}; height: ${d}; display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2)); border-radius: 999px;
      background: var(--card-background-color, #fff); color: ${ink};
      font: inherit; font-weight: 600; font-size: min(var(--slabton-button-size, 14px), calc(${d} * 0.45));
      opacity: var(--slabton-sx-opacity, 0.35); cursor: pointer; transform: translate(-50%, -50%);
      transition: opacity 150ms ease, transform 150ms ease;
    }
    .o-h .sx-pt { top: 50%; left: calc(var(--slabton-sx-e, 0) * 100%); }
    .o-v .sx-pt { left: 50%; top: calc(var(--slabton-sx-e, 0) * 100%); }
    .sxs-square .sx-pt { border-radius: calc(${d} * ${SQUARE_HANDLE_RADIUS_RATIO}); }
    .o-h .sxs-oval .sx-pt { width: calc(${d} * ${OVAL_RATIO}); }
    .o-v .sxs-oval .sx-pt { height: calc(${d} * ${OVAL_RATIO}); }
    .sx-pt ha-icon { --mdc-icon-size: calc(${d} * 0.55); }
    .sx-pt .sx-text { padding: 0 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sx-pt:hover { opacity: min(1, calc(var(--slabton-sx-opacity, 0.35) + 0.35)); }
    .sx-pt:active { transform: translate(-50%, -50%) scale(0.94); }
    .sx-pt:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      .sx-pt { transition: none; }
      .sx-pt:active { transform: translate(-50%, -50%); }
    }`;
}

/** Room kept beyond the stage edge along the bar: the expired glow reaches 14 px blur + 4 px spread. */
const CLIP_MARGIN_PX = 18;

export function buildCss() {
  return `
    :host { display: block; }
    ha-card { padding: var(--slabton-card-padding, 12px); box-sizing: border-box; }
    .root {
      display: flex; flex-direction: column; gap: 8px; align-items: stretch;
      color: var(--slabton-text-color, var(--primary-text-color, #212121));
      /* Fill edge: on the handle-centre track (pad + hl/2 + p * travel), so the fill ends under the handle centre
         and a tick of that value; with handle_overhang the track is the whole bar. 100% is the bar's padding box,
         like for .rail and .scale. */
      --slabton-ext: calc(var(--slabton-pad) + var(--slabton-hl) / 2 + var(--slabton-p, 0) * (100% - 2 * var(--slabton-pad) - var(--slabton-hl)));
    }
    .header { display: flex; align-items: center; gap: 8px; font-size: var(--slabton-header-size, 14px); font-weight: var(--slabton-header-weight, 500); opacity: var(--slabton-header-opacity, 1); }
    .header ha-icon { --mdc-icon-size: var(--slabton-header-icon-size, 20px); flex: none; color: var(--slabton-header-icon-color, inherit); }
    .header.icon-right { flex-direction: row-reverse; }
    .header.icon-right .title { flex: 1; min-width: 0; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--slabton-header-color, inherit); }
    .stage { display: flex; justify-content: center; }
    .o-h .stage { padding: calc(var(--slabton-cross-extra, 0px) + var(--slabton-gap-cross, 0px)) calc(var(--slabton-overhang, 0px) + var(--slabton-gap-along, 0px)); }
    .o-v .stage { padding: calc(var(--slabton-overhang, 0px) + var(--slabton-gap-along, 0px)) calc(var(--slabton-cross-extra, 0px) + var(--slabton-gap-cross, 0px)); }
    /* The carrier is shifted by its own size times e, so its empty box reaches past the bar and widens the page on
       narrow screens. Clip along the main axis only: the stage padding keeps the handle overhang, the cross axis stays visible.
       The clip margin leaves room for the expired glow (14 px blur + 4 px spread, animations.js) at the bar ends. */
    .o-h .stage { overflow-x: clip; overflow-clip-margin: ${CLIP_MARGIN_PX}px; }
    .o-v .stage { overflow-y: clip; overflow-clip-margin: ${CLIP_MARGIN_PX}px; }
    .bar {
      position: relative; box-sizing: border-box; flex: none;
      background: var(--slabton-bar-color, var(--secondary-background-color, #e0e0e0));
      border: var(--slabton-border-width) solid var(--slabton-border-color, var(--divider-color, transparent));
      border-radius: var(--slabton-bar-radius);
    }
    /* bar_state_color: the whole bar in the color of the current state (none: bar_color or the default). */
    .bar-state .bar { background: var(--slabton-active-color, var(--slabton-bar-color, var(--secondary-background-color, #e0e0e0))); }
    /* Stickshift: the bar itself is gone (no background, border or fill); the points, the gate and the handle stay on its track. */
    .root.sx-on .bar { background: none; border-color: transparent; }
    .root.sx-on .fill-clip { display: none; }
    .o-h .bar { width: var(--slabton-length); height: var(--slabton-thickness); }
    .o-v .bar { height: var(--slabton-length); width: var(--slabton-thickness); }
    .fill-clip { position: absolute; inset: 0; overflow: hidden; border-radius: calc(var(--slabton-bar-radius) - var(--slabton-border-width)); pointer-events: none; }
    .fill {
      position: absolute; inset: 0;
      background: var(--slabton-active-color, var(--slabton-fill-color, var(--primary-color, #03a9f4)));
      opacity: 0.85;
    }
    .o-h:not(.rev) .fill { clip-path: inset(0 calc(100% - var(--slabton-ext)) 0 0); }
    .o-h.rev .fill { clip-path: inset(0 0 0 calc(100% - var(--slabton-ext))); }
    .o-v:not(.rev) .fill { clip-path: inset(calc(100% - var(--slabton-ext)) 0 0 0); }
    .o-v.rev .fill { clip-path: inset(0 0 calc(100% - var(--slabton-ext)) 0); }

    /* Text in the bar (bar_text) and the timer's extra info; plain text only. */
    .bar-text, .info {
      position: absolute; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis; pointer-events: none;
      font-weight: 500;
    }
    .bar-text {
      font-size: var(--slabton-bar-text-size, 13px);
      color: var(--slabton-bar-text-color, var(--slabton-text-color, var(--primary-text-color, #212121)));
    }
    .info {
      font-size: var(--slabton-info-size, 13px);
      color: var(--slabton-info-color, var(--slabton-text-color, var(--primary-text-color, #212121)));
    }
    .bar-text[hidden], .info[hidden] { display: none; }
    .o-h .bar-text { inset: 0; padding: 0 calc(var(--slabton-hl) + 12px); }
    .o-v .bar-text { inset: 0; padding: calc(var(--slabton-hl) + 12px) 0; writing-mode: vertical-rl; }
    .o-h .info { top: 0; bottom: 0; left: 0; max-width: 40%; padding: 0 12px; }
    .o-h .info.info-right { left: auto; right: 0; }
    .o-v .stage.has-info { flex-direction: column; align-items: center; gap: 6px; }
    .o-v .info { position: static; max-width: 100%; }

    .rail, .switches, .scale, .sx { position: absolute; pointer-events: none; }
    .o-h .rail { left: var(--slabton-pad); top: 0; height: 100%; width: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    .o-v .rail { top: var(--slabton-pad); left: 0; width: 100%; height: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    /* Switches, stickshift points (and ticks in state and lock) sit on the handle-centre track, so a mark is exactly under the handle at its value. */
    .o-h .switches, .o-h .scale, .o-h .sx { left: calc(var(--slabton-pad) + var(--slabton-hl) / 2); top: 0; height: 100%; width: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    .o-v .switches, .o-v .scale, .o-v .sx { top: calc(var(--slabton-pad) + var(--slabton-hl) / 2); left: 0; width: 100%; height: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }

    /* Scale ticks (scale:): across the bar at the start, centre or end edge. */
    .tick { position: absolute; background: var(--slabton-scale-color, color-mix(in srgb, var(--slabton-text-color, var(--primary-text-color, #212121)) 45%, transparent)); }
    .o-h .tick { left: calc(var(--slabton-tick-e, 0) * 100%); width: 2px; margin-left: -1px; height: var(--slabton-scale-size, ${DEFAULT_SCALE_SIZE}px); }
    .o-v .tick { top: calc(var(--slabton-tick-e, 0) * 100%); height: 2px; margin-top: -1px; width: var(--slabton-scale-size, ${DEFAULT_SCALE_SIZE}px); }
    .o-h .sc-start .tick { top: 0; }
    .o-h .sc-end .tick { bottom: 0; }
    .o-h .sc-center .tick { top: 50%; margin-top: calc(var(--slabton-scale-size, ${DEFAULT_SCALE_SIZE}px) / -2); }
    .o-v .sc-start .tick { left: 0; }
    .o-v .sc-end .tick { right: 0; }
    .o-v .sc-center .tick { left: 50%; margin-left: calc(var(--slabton-scale-size, ${DEFAULT_SCALE_SIZE}px) / -2); }
    ${scaleLabelCss()}
    .carrier { position: absolute; inset: 0; }
    .o-h .carrier { transform: translateX(calc(var(--slabton-e, 0) * 100%)); }
    .o-v .carrier { transform: translateY(calc(var(--slabton-e, 0) * 100%)); }

    .handle {
      position: absolute; pointer-events: auto; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
      background: var(--slabton-handle-color, var(--card-background-color, #fff));
      color: var(--slabton-button-color, var(--slabton-text-color, var(--primary-text-color, #212121)));
      border-radius: var(--slabton-handle-radius);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      cursor: grab; user-select: none; -webkit-user-select: none; font-weight: 600;
      /* Text width of the handle is its width on screen (--slabton-hw); a small handle gets a smaller text (45 %: the 40 px default keeps 14 px). */
      font-size: min(var(--slabton-button-size, 14px), calc(var(--slabton-hw) * 0.45));
    }
    .o-h .handle { --slabton-hw: var(--slabton-hl); }
    .o-v .handle { --slabton-hw: var(--slabton-hc); }
    .o-h .handle { left: 0; top: 50%; margin-top: calc(var(--slabton-hc) / -2); width: var(--slabton-hl); height: var(--slabton-hc); touch-action: pan-y; }
    .o-v .handle { top: 0; left: 50%; margin-left: calc(var(--slabton-hc) / -2); height: var(--slabton-hl); width: var(--slabton-hc); touch-action: pan-x; }
    .nodrag .handle { cursor: pointer; touch-action: auto; }
    .dragging .handle { cursor: grabbing; }
    .content { display: flex; align-items: center; justify-content: center; max-width: 100%; }
    .content[hidden], .h-icon[hidden], .h-text[hidden] { display: none; }
    .h-icon { --mdc-icon-size: calc(var(--slabton-hc) * 0.55); }
    .h-text { padding: 0 min(4px, calc(var(--slabton-hw) / 10)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    ${dialCss()}
    .handle:focus-visible, .sw:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }

    .sw {
      position: absolute; pointer-events: auto; box-sizing: border-box; padding: 0;
      /* 28 px, but never larger than the inside of the bar (a thin bar would otherwise be overlapped). */
      --slabton-sw-d: var(--slabton-switch-size, max(10px, min(28px, calc(var(--slabton-thickness) - 2 * var(--slabton-border-width)))));
      width: var(--slabton-sw-d); height: var(--slabton-sw-d);
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2)); border-radius: 999px;
      background: var(--card-background-color, #fff); color: var(--secondary-text-color, #727272);
      cursor: pointer; transform: translate(-50%, -50%);
    }
    .o-h .sw { top: 50%; left: calc(var(--slabton-sw-e) * 100%); }
    .o-v .sw { left: 50%; top: calc(var(--slabton-sw-e) * 100%); }
    .sw ha-icon { --mdc-icon-size: min(16px, calc(var(--slabton-sw-d) * 0.6)); }
    .sw.active { color: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); }

    ${stickshiftCss()}

    .unavailable .bar { opacity: 0.5; }
    /* The lock lives in the card (it blocks every gesture but a tap); the handle stays tappable for more-info. */
    .blocked:not(.allow-actions) .handle { cursor: pointer; touch-action: auto; }
    .unavailable .h-icon { color: var(--slabton-unavailable-color, var(--warning-color, #ffa600)); }
    ${animationCss()}
  `;
}

/*
 * CSS generation. Layout sizes and configured colors travel as CSS custom
 * properties set on the host element, so themes, `styles:` overrides and
 * card-mod (set on ha-card) can override them without touching the DOM.
 */

import { animationCss } from "./animations.js";
import {
  DEFAULT_VERTICAL_LENGTH, OVAL_RATIO, PILL_RADIUS, SQUARE_BAR_RADIUS_RATIO, SQUARE_HANDLE_RADIUS_RATIO,
} from "./constants.js";

/** Handle size across and along the bar axis, in px. */
export function handleDimensions(config) {
  const cross = config.handle_size;
  const along = config.handle_shape === "oval" ? Math.round(cross * OVAL_RATIO) : cross;
  return { cross, along };
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

  const vars = {
    "--slabton-length": config.length > 0 ? `${config.length}px` : (vertical ? `${DEFAULT_VERTICAL_LENGTH}px` : "100%"),
    "--slabton-thickness": `${config.thickness}px`,
    "--slabton-hc": `${cross}px`,
    "--slabton-hl": `${along}px`,
    "--slabton-pad": `${pad}px`,
    "--slabton-overhang": overhang ? `${along / 2}px` : "0px",
    "--slabton-bar-radius": `${barRadius}px`,
    "--slabton-handle-radius": square ? `${Math.round(cross * SQUARE_HANDLE_RADIUS_RATIO)}px` : PILL_RADIUS,
    "--slabton-border-width": `${config.border_width}px`,
  };
  if (config.bar_color) vars["--slabton-bar-color"] = config.bar_color;
  if (config.fill_color) vars["--slabton-fill-color"] = config.fill_color;
  if (config.handle_color) vars["--slabton-handle-color"] = config.handle_color;
  if (config.text_color) vars["--slabton-text-color"] = config.text_color;
  if (config.border_color) vars["--slabton-border-color"] = config.border_color;
  return { ...vars, ...config.styles };
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

export function buildCss() {
  return `
    :host { display: block; }
    ha-card { padding: var(--slabton-card-padding, 12px); box-sizing: border-box; }
    .root {
      display: flex; flex-direction: column; gap: 8px; align-items: stretch;
      color: var(--slabton-text-color, var(--primary-text-color, #212121));
      /* Fill edge: empty at 0, complete at 1, and always at the handle centre in between
         (centre = pad + hl/2 + p * travel, so the edge reduces to p * 100%). */
      --slabton-ext: calc(var(--slabton-p, 0) * 100%);
    }
    .header { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
    .header ha-icon { --mdc-icon-size: 20px; flex: none; }
    .header.icon-right { flex-direction: row-reverse; }
    .header.icon-right .title { flex: 1; min-width: 0; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stage { display: flex; justify-content: center; }
    .o-h .stage { padding: 0 var(--slabton-overhang, 0px); }
    .o-v .stage { padding: var(--slabton-overhang, 0px) 0; }
    .bar {
      position: relative; box-sizing: border-box; flex: none;
      background: var(--slabton-bar-color, var(--secondary-background-color, #e0e0e0));
      border: var(--slabton-border-width) solid var(--slabton-border-color, var(--divider-color, transparent));
      border-radius: var(--slabton-bar-radius);
    }
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

    .rail, .switches { position: absolute; pointer-events: none; }
    .o-h .rail { left: var(--slabton-pad); top: 0; height: 100%; width: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    .o-v .rail { top: var(--slabton-pad); left: 0; width: 100%; height: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    .o-h .switches { left: calc(var(--slabton-pad) + var(--slabton-hl) / 2); top: 0; height: 100%; width: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    .o-v .switches { top: calc(var(--slabton-pad) + var(--slabton-hl) / 2); left: 0; width: 100%; height: calc(100% - 2 * var(--slabton-pad) - var(--slabton-hl)); }
    .carrier { position: absolute; inset: 0; }
    .o-h .carrier { transform: translateX(calc(var(--slabton-e, 0) * 100%)); }
    .o-v .carrier { transform: translateY(calc(var(--slabton-e, 0) * 100%)); }

    .handle {
      position: absolute; pointer-events: auto; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
      background: var(--slabton-handle-color, var(--card-background-color, #fff));
      color: var(--slabton-text-color, var(--primary-text-color, #212121));
      border-radius: var(--slabton-handle-radius);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      cursor: grab; user-select: none; -webkit-user-select: none; font-size: 14px; font-weight: 600;
    }
    .o-h .handle { left: 0; top: 50%; margin-top: calc(var(--slabton-hc) / -2); width: var(--slabton-hl); height: var(--slabton-hc); touch-action: pan-y; }
    .o-v .handle { top: 0; left: 50%; margin-left: calc(var(--slabton-hc) / -2); height: var(--slabton-hl); width: var(--slabton-hc); touch-action: pan-x; }
    .nodrag .handle { cursor: pointer; touch-action: auto; }
    .dragging .handle { cursor: grabbing; }
    .content { display: flex; align-items: center; justify-content: center; max-width: 100%; }
    .content[hidden], .h-icon[hidden], .h-text[hidden] { display: none; }
    .h-icon { --mdc-icon-size: calc(var(--slabton-hc) * 0.55); }
    .h-text { padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .handle:focus-visible, .sw:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }

    .sw {
      position: absolute; pointer-events: auto; box-sizing: border-box; padding: 0;
      width: var(--slabton-switch-size, 28px); height: var(--slabton-switch-size, 28px);
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2)); border-radius: 999px;
      background: var(--card-background-color, #fff); color: var(--secondary-text-color, #727272);
      cursor: pointer; transform: translate(-50%, -50%);
    }
    .o-h .sw { top: 50%; left: calc(var(--slabton-sw-e) * 100%); }
    .o-v .sw { left: 50%; top: calc(var(--slabton-sw-e) * 100%); }
    .sw ha-icon { --mdc-icon-size: 16px; }
    .sw.active { color: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); }

    .unavailable .bar { opacity: 0.5; }
    .unavailable .handle { pointer-events: none; }
    ${animationCss()}
  `;
}

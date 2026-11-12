/*
 * DOM construction and view updates. The structure is built once per config;
 * afterwards only CSS variables, attributes and text content change, so the
 * handle element (and its pointer capture) survives every state update.
 */

import { animationClass, playsOnChange, restartAnimation } from "./animations.js";
import { SWITCH_SLOTS } from "./config.js";
import { MODE } from "./constants.js";
import { axisFraction, escapeHtml } from "./util.js";

const SWITCH_POS = { start: 0, mid: 0.5, end: 1 };
const ON_STATES = ["on", "open", "unlocked", "home"];

function headerHtml(config) {
  if (config.header_position === "none" || (!config.name && !config.icon)) return "";
  const icon = config.icon ? '<ha-icon class="header-icon"></ha-icon>' : "";
  const title = config.name ? `<span class="title">${escapeHtml(config.name)}</span>` : "";
  const side = config.header_icon_position === "right" ? " icon-right" : "";
  return `<div class="header${side}">${icon}${title}</div>`;
}

function switchesHtml(config) {
  const slots = SWITCH_SLOTS.filter((slot) => config.switches[slot]);
  if (!slots.length) return "";
  const buttons = slots
    .map((slot) => `<button type="button" class="sw sw-${slot}" data-slot="${slot}"><ha-icon></ha-icon></button>`)
    .join("");
  return `<div class="switches">${buttons}</div>`;
}

export function rootClasses(config) {
  const horizontal = config.orientation === "horizontal";
  const classes = [
    "root",
    horizontal ? "o-h" : "o-v",
    `dir-${config.direction}`,
    `shape-${config.handle_shape}`,
    animationClass(config.animation),
  ];
  if (config.direction === "rtl") classes.push("rev");
  if (!config.drag || config.mode === MODE.VALUE) classes.push("nodrag");
  return classes.join(" ");
}

/** Build the card DOM inside `shadow` and return element references. */
export function renderCard(shadow, config, css) {
  const header = headerHtml(config);
  const top = config.header_position !== "bottom" ? header : "";
  const bottom = config.header_position === "bottom" ? header : "";
  shadow.innerHTML = `
    <style>${css}</style>
    <ha-card>
      <div class="${rootClasses(config)}">
        ${top}
        <div class="stage">
          <div class="bar">
            <div class="fill-clip"><div class="fill"></div></div>
            ${switchesHtml(config)}
            <div class="rail"><div class="carrier">
              <div class="handle" tabindex="0">
                <div class="content"><ha-icon class="h-icon"></ha-icon><span class="h-text" hidden></span></div>
              </div>
            </div></div>
          </div>
        </div>
        ${bottom}
      </div>
    </ha-card>`;

  const q = (selector) => shadow.querySelector(selector);
  const switches = {};
  for (const button of shadow.querySelectorAll(".sw")) {
    const slot = button.dataset.slot;
    switches[slot] = button;
    const horizontal = config.orientation === "horizontal";
    button.style.setProperty(
      "--slabton-sw-e",
      String(axisFraction(SWITCH_POS[slot], horizontal, config.direction === "rtl")),
    );
    button.querySelector("ha-icon").setAttribute("icon", config.switches[slot].icon);
    if (config.switches[slot].name) button.setAttribute("aria-label", config.switches[slot].name);
  }
  const headerIcon = q(".header-icon");
  if (headerIcon && config.icon) headerIcon.setAttribute("icon", config.icon);

  return {
    root: q(".root"),
    rail: q(".rail"),
    handle: q(".handle"),
    content: q(".content"),
    icon: q(".h-icon"),
    text: q(".h-text"),
    switches,
    signature: null,
  };
}

function setRole(handle, config, view) {
  if (config.mode === MODE.LOCK) {
    handle.setAttribute("role", "switch");
    handle.setAttribute("aria-checked", String(!view.locked));
  } else {
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    handle.setAttribute("aria-valuenow", String(view.ariaNow));
    handle.setAttribute("aria-orientation", config.orientation);
  }
  if (view.ariaText != null) handle.setAttribute("aria-valuetext", String(view.ariaText));
  handle.setAttribute("aria-label", config.name ?? config.entity);
  handle.setAttribute("aria-disabled", String(view.unavailable));
  handle.setAttribute("tabindex", view.unavailable ? "-1" : "0");
}

function setContent(refs, config, view) {
  const { icon, text } = refs;
  const kind = config.handle_content;
  const showIcon = kind === "icon" && Boolean(view.icon);
  const label = kind === "position" ? view.positionText : kind === "text" ? view.text : "";
  icon.hidden = !showIcon;
  if (showIcon) icon.setAttribute("icon", view.icon);
  text.hidden = label === "" || label == null;
  text.textContent = label ?? "";
}

/**
 * Apply a view model to the DOM.
 * @param {object} refs - result of renderCard
 * @param {object} config - resolved config
 * @param {import("./modes/state.js").ModeView} view - mode view model
 * @param {{dragPos?: number|null}} [options] - live drag position override
 */
export function updateView(refs, config, view, options = {}) {
  const { root, handle, content } = refs;
  const horizontal = config.orientation === "horizontal";
  const reversed = config.direction === "rtl";
  const dragging = options.dragPos != null;
  const handlePos = dragging ? options.dragPos : view.pos;
  const fillPos = dragging ? options.dragPos : view.fillPos;

  root.style.setProperty("--slabton-p", String(fillPos));
  root.style.setProperty("--slabton-e", String(axisFraction(handlePos, horizontal, reversed)));
  if (view.color) root.style.setProperty("--slabton-active-color", view.color);
  else root.style.removeProperty("--slabton-active-color");
  root.classList.toggle("unavailable", Boolean(view.unavailable));

  setRole(handle, config, view);

  const signature = `${view.icon}|${view.text}|${view.positionText}`;
  const changed = refs.signature !== null && refs.signature !== signature;
  setContent(refs, config, view);
  refs.signature = signature;
  if (changed && playsOnChange(config.animation)) {
    restartAnimation(config.animation === "fade" ? content : handle);
  }
}

export function updateSwitches(refs, config, hass) {
  for (const slot of Object.keys(refs.switches)) {
    const entity = config.switches[slot].entity;
    const stateObj = entity ? hass?.states?.[entity] : null;
    refs.switches[slot].classList.toggle("active", Boolean(stateObj && ON_STATES.includes(stateObj.state)));
  }
}

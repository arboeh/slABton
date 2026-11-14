/*
 * DOM construction and view updates. The structure is built once per config;
 * afterwards only CSS variables, attributes and text content change, so the
 * handle element (and its pointer capture) survives every state update.
 */

import { animationClass, playsOnChange, restartAnimation } from "./animations.js";
import { SWITCH_SLOTS } from "../core/config.js";
import { MODE, READ_ONLY_MODES } from "../core/constants.js";
import { axisFraction, escapeHtml } from "../core/util.js";

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

/** Tick container of the `scale:` block; the tick positions are set after rendering (see `placeTicks`). */
function scaleHtml(config) {
  if (!config.scale) return "";
  const ticks = '<span class="tick"></span>'.repeat(config.scale.ticks + 1);
  return `<div class="scale sc-${config.scale.position}" aria-hidden="true">${ticks}</div>`;
}

/** Tick positions are rounded to four decimals: far below a pixel on any bar. */
const TICK_PRECISION = 1e4;

/** Position (0..1 along the handle-centre travel) of tick `index`, mirrored like the handle itself. */
function tickEdge(config, index) {
  const horizontal = config.orientation === "horizontal";
  const edge = axisFraction(index / config.scale.ticks, horizontal, config.direction === "rtl");
  return String(Math.round(edge * TICK_PRECISION) / TICK_PRECISION);
}

/** Put every tick at its share of the handle-centre travel, mirrored like the handle itself. */
function placeTicks(shadow, config) {
  if (!config.scale) return;
  shadow.querySelectorAll(".scale .tick").forEach((tick, i) => {
    tick.style.setProperty("--slabton-tick-e", tickEdge(config, i));
  });
}

/** Add the tick labels (`scale.labels`): plain text, on the same track as the ticks. */
function placeLabels(shadow, config) {
  const scale = shadow.querySelector(".scale");
  const labels = config.scale?.labels;
  if (!scale || !labels?.length) return;
  for (const { index, text } of labels) {
    const label = shadow.ownerDocument.createElement("span");
    label.className = "tick-label";
    label.textContent = text;
    label.style.setProperty("--slabton-tick-e", tickEdge(config, index));
    scale.appendChild(label);
  }
}

// --- analog dial ------------------------------------------------------------
// The SVG is built from constants and loop numbers only; no config string reaches the markup.

const DIAL_HOURS = 12;
const DEGREES_PER_HOUR = 30;
const DIAL_NUMBER_HOURS = Object.freeze({ quarters: [12, 3, 6, 9], all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
/** Radius of the numbers with and without tick marks, in viewBox units (the dial spans -50..50). */
const DIAL_NUMBERS_RADIUS = Object.freeze({ withTicks: 30, withoutTicks: 37 });
const DIAL_PRECISION = 100;

const isAnalog = (config) => config.clock.display === "analog";
const roundDial = (n) => Math.round(n * DIAL_PRECISION) / DIAL_PRECISION;

function dialTicksSvg() {
  return Array.from({ length: DIAL_HOURS }, (_, hour) => {
    const quarter = hour % 3 === 0;
    return `<line class="dial-tick${quarter ? " quarter" : ""}" y1="-47" y2="${quarter ? -39 : -43}" transform="rotate(${hour * DEGREES_PER_HOUR})"/>`;
  }).join("");
}

function dialNumbersSvg(numbers, radius) {
  return (DIAL_NUMBER_HOURS[numbers] ?? []).map((hour) => {
    const angle = ((hour % DIAL_HOURS) * DEGREES_PER_HOUR * Math.PI) / 180;
    return `<text class="dial-num" x="${roundDial(radius * Math.sin(angle))}" y="${roundDial(-radius * Math.cos(angle))}">${hour}</text>`;
  }).join("");
}

/** Dial of the analog clock: ticks, numbers, three hands (rotated by `updateDial`) and the hub. */
function dialHtml(config) {
  const { face, seconds } = config.clock;
  const radius = face.ticks ? DIAL_NUMBERS_RADIUS.withTicks : DIAL_NUMBERS_RADIUS.withoutTicks;
  const secondHand = seconds ? '<g class="hand hand-second"><line y1="9" y2="-38"/></g>' : "";
  return '<svg class="dial" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">'
    + `${face.ticks ? dialTicksSvg() : ""}${dialNumbersSvg(face.numbers, radius)}`
    + '<g class="hand hand-hour"><line y1="4" y2="-24"/></g><g class="hand hand-minute"><line y1="4" y2="-35"/></g>'
    + `${secondHand}<circle class="dial-hub" r="2.6"/></svg>`;
}

/** The hand elements of the dial (the seconds hand only exists with `clock.seconds`), or null for a digital clock. */
function dialRefs(q, config) {
  if (!isAnalog(config)) return null;
  return { hour: q(".hand-hour"), minute: q(".hand-minute"), second: q(".hand-second") };
}

function rotateHand(hand, degrees) {
  if (!hand || !Number.isFinite(degrees)) return;
  hand.setAttribute("transform", `rotate(${roundDial(degrees)})`);
}

/** Turn the hands to the view's angles: only `transform` attributes change, never the structure. */
function updateDial(dial, angles) {
  if (!dial || !angles) return;
  rotateHand(dial.hour, angles.hour);
  rotateHand(dial.minute, angles.minute);
  rotateHand(dial.second, angles.second);
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
  if (!config.drag || READ_ONLY_MODES.includes(config.mode)) classes.push("nodrag");
  return classes.join(" ");
}

/** Text elements are filled with textContent only, never with markup. */
function setText(el, text) {
  const value = text ?? "";
  el.hidden = value === "";
  el.textContent = value;
}

/** Build the card DOM inside `shadow` and return element references. */
export function renderCard(shadow, config, css) {
  const header = headerHtml(config);
  const top = config.header_position !== "bottom" ? header : "";
  const bottom = config.header_position === "bottom" ? header : "";
  const horizontal = config.orientation === "horizontal";
  const hasInfo = config.mode === MODE.TIMER && Boolean(config.timer.info);
  const info = hasInfo ? '<div class="info" hidden></div>' : "";
  const barText = config.bar_text ? '<div class="bar-text" hidden></div>' : "";
  shadow.innerHTML = `
    <style>${css}</style>
    <ha-card>
      <div class="${rootClasses(config)}">
        ${top}
        <div class="stage${hasInfo ? " has-info" : ""}">
          ${horizontal ? "" : info}
          <div class="bar">
            <div class="fill-clip"><div class="fill"></div></div>
            ${scaleHtml(config)}
            ${barText}
            ${horizontal ? info : ""}
            ${switchesHtml(config)}
            <div class="rail"><div class="carrier">
              <div class="handle" tabindex="0">
                <div class="content"><ha-icon class="h-icon"></ha-icon><span class="h-text" hidden></span>${isAnalog(config) ? dialHtml(config) : ""}</div>
              </div>
            </div></div>
          </div>
        </div>
        ${bottom}
      </div>
    </ha-card>`;

  const q = (selector) => shadow.querySelector(selector);
  placeTicks(shadow, config);
  placeLabels(shadow, config);
  const switches = {};
  for (const button of shadow.querySelectorAll(".sw")) {
    const slot = button.dataset.slot;
    switches[slot] = button;
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
    dial: dialRefs(q, config),
    barText: q(".bar-text"),
    info: q(".info"),
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
  handle.setAttribute("aria-label", config.name ?? config.entity ?? "slABton");
  handle.setAttribute("aria-disabled", String(view.unavailable));
  handle.setAttribute("tabindex", view.unavailable ? "-1" : "0");
}

function setContent(refs, config, view) {
  const { icon, text } = refs;
  const kind = config.handle_content;
  const showIcon = kind === "icon" && Boolean(view.icon);
  // The dial replaces the text of the handle.
  const label = refs.dial ? "" : kind === "position" ? view.positionText : kind === "text" ? view.text : "";
  icon.hidden = !showIcon;
  if (showIcon) icon.setAttribute("icon", view.icon);
  text.hidden = label === "" || label == null;
  text.textContent = label ?? "";
}

/**
 * Apply a view model to the DOM.
 * @param {object} refs - result of renderCard
 * @param {object} config - resolved config
 * @param {import("../core/modes/state.js").ModeView} view - mode view model
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
  const edge = axisFraction(handlePos, horizontal, reversed);
  root.style.setProperty("--slabton-e", String(edge));
  if (view.color) root.style.setProperty("--slabton-active-color", view.color);
  else root.style.removeProperty("--slabton-active-color");
  root.classList.toggle("unavailable", Boolean(view.unavailable));
  root.classList.toggle("expired", Boolean(view.expired));

  if (refs.barText) setText(refs.barText, view.barText);
  if (refs.info) {
    setText(refs.info, view.info);
    refs.info.classList.toggle("info-right", edge < 0.5);
  }

  setRole(handle, config, view);

  // Timer and clock text changes every second; only the icon (state) change replays an animation.
  const ticks = config.mode === MODE.TIMER || config.mode === MODE.CLOCK;
  const signature = ticks ? `${view.icon}` : `${view.icon}|${view.text}|${view.positionText}`;
  const changed = refs.signature !== null && refs.signature !== signature;
  setContent(refs, config, view);
  updateDial(refs.dial, view.dial);
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

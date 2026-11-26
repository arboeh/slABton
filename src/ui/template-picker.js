/*
 * Quick start picker of the visual editor: tiles for the templates of the catalog (core/templates.js), each with a
 * live preview (a real, inert slabton-card fed with a fixed example), and for a template that needs an entity one
 * `ha-form` question (an entity selector filtered by the catalog). The picker only reports what the user chose:
 *  - `template-apply` with `detail.config`, the expanded card config (without `type`)
 *  - `template-dismiss` for the tile "none"
 * It writes no config itself. Every text comes from the dictionaries (`t()`), nothing from entity values goes into
 * markup: names are set with `textContent`, the catalog is static.
 * Design: Material 3 (tonal surfaces, state layers 8 % / 10 %, focus ring), only Home Assistant CSS variables.
 */

import { DEFAULT_LANGUAGE, resolveLanguage, t } from "../core/i18n.js";
import { NONE_TEMPLATE_ID, TEMPLATES, entityFilter, findTemplate, isEntityFor } from "../core/templates.js";
import { warn } from "../core/util.js";

export const PICKER_TAG = "slabton-template-picker";
const CARD_TAG = "slabton-card";
const CARD_TYPE = `custom:${CARD_TAG}`;

const STYLE = `
:host { display: block; margin-bottom: 16px; --st-radius: 12px; --st-gap: 8px; --st-motion: 200ms cubic-bezier(0.2, 0, 0, 1); }
.title { margin: 0 0 4px; font-size: 16px; font-weight: 500; line-height: 24px; color: var(--primary-text-color); }
.hint { margin: 0 0 12px; font-size: 12px; line-height: 16px; color: var(--secondary-text-color); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--st-gap); }
.tile {
  position: relative; display: flex; flex-direction: column; gap: 4px; padding: 8px; min-width: 0; text-align: start;
  font: inherit; color: var(--primary-text-color); cursor: pointer; overflow: hidden;
  border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3)); border-radius: var(--st-radius);
  background: color-mix(in srgb, var(--primary-color) 5%, var(--card-background-color, transparent));
  transition: background-color var(--st-motion), border-color var(--st-motion);
}
.tile::before { content: ""; position: absolute; inset: 0; background: var(--primary-text-color); opacity: 0; pointer-events: none; transition: opacity var(--st-motion); }
.tile:hover::before { opacity: 0.08; }
.tile:focus-visible::before, .tile:active::before { opacity: 0.1; }
.tile:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
.preview {
  display: flex; align-items: center; justify-content: center; min-height: 72px; overflow: hidden; pointer-events: none;
  border-radius: 8px; background: color-mix(in srgb, var(--primary-color) 10%, var(--card-background-color, transparent));
  color: var(--secondary-text-color);
}
.preview > slabton-card { width: 100%; }
.name { font-size: 14px; font-weight: 500; line-height: 20px; }
.desc { font-size: 12px; line-height: 16px; color: var(--secondary-text-color); }
.question { display: flex; flex-direction: column; gap: 12px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.button {
  min-height: 40px; padding: 0 16px; font: inherit; font-weight: 500; cursor: pointer; border-radius: 20px;
  border: 1px solid var(--outline-color, var(--divider-color, currentColor)); background: transparent; color: var(--primary-color);
}
.button.filled { border-color: transparent; background: var(--primary-color); color: var(--text-primary-color, #fff); }
.button:disabled { cursor: default; opacity: 0.38; }
.button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .tile, .tile::before { transition: none; } }
`;

/** Static example `hass` of a template's preview: one fake entity, the language of the user, no services. */
function sampleHass(template, lang) {
  const { sample } = template;
  const states = sample?.entity
    ? { [sample.entity]: { entity_id: sample.entity, state: sample.state, attributes: { ...sample.attributes } } }
    : {};
  return { states, language: lang, locale: { language: lang }, callService: () => Promise.resolve() };
}

const button = (className, label, onClick) => {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
};

export class SlabtonTemplatePicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    // Preview element per template id; null remembers a preview that could not be built (icon fallback).
    this._previews = new Map();
    this._pending = null;
    this._entity = "";
    this._applyButton = null;
    // The `ha-form` of the entity question while it is shown: it follows `hass` like the editor's own form.
    this._form = null;
  }

  connectedCallback() {
    this._render();
  }

  set hass(hass) {
    const changed = resolveLanguage(hass) !== resolveLanguage(this._hass) || Boolean(hass) !== Boolean(this._hass);
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    if (changed && this.isConnected) {
      // A language change rebuilds the previews (their texts follow the language).
      this._previews.clear();
      this._render();
    }
  }

  get hass() {
    return this._hass;
  }

  _lang() {
    return this._hass ? resolveLanguage(this._hass) : DEFAULT_LANGUAGE;
  }

  /** `focusSelector`: what gets the focus afterwards (after a click that replaced the view); none keeps it as it is. */
  _render(focusSelector = null) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    this._form = null;
    this._applyButton = null;
    this.shadowRoot.replaceChildren(style, this._pending ? this._renderQuestion(this._pending) : this._renderGrid());
    if (focusSelector) this.shadowRoot.querySelector(focusSelector)?.focus();
  }

  // --- tiles ----------------------------------------------------------------

  _renderGrid() {
    const lang = this._lang();
    const wrap = document.createElement("section");
    wrap.setAttribute("aria-labelledby", "st-title");
    const title = document.createElement("h3");
    title.className = "title";
    title.id = "st-title";
    title.textContent = t(lang, "editor.template.title");
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t(lang, "editor.template.hint");
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.append(...TEMPLATES.map((template) => this._renderTile(template, lang)));
    wrap.append(title, hint, grid);
    return wrap;
  }

  _renderTile(template, lang) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.template = template.id;
    const preview = document.createElement("span");
    preview.className = "preview";
    preview.setAttribute("aria-hidden", "true");
    // The preview is only a picture: not focusable, no pointer events (CSS), invisible to assistive technology.
    preview.setAttribute("inert", "");
    preview.append(this._previewOf(template, lang));
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t(lang, template.labelKey);
    const description = document.createElement("span");
    description.className = "desc";
    description.textContent = t(lang, template.descriptionKey);
    tile.append(preview, name, description);
    tile.addEventListener("click", () => this._choose(template));
    return tile;
  }

  /**
   * The preview card of a template, built once; the icon of the template when there is none. A preview that was not
   * possible yet (no `hass`, card not defined) is tried again at the next render; one that failed stays the icon.
   */
  _previewOf(template, lang) {
    if (!this._previews.has(template.id)) {
      const preview = this._buildPreview(template, lang);
      if (preview === undefined) return this._fallbackIcon(template);
      this._previews.set(template.id, preview);
    }
    return this._previews.get(template.id) ?? this._fallbackIcon(template);
  }

  /** @returns {HTMLElement|null|undefined} the card, `null` when it failed for good, `undefined` when it is not possible yet */
  _buildPreview(template, lang) {
    if (!template.build || !template.sample) return null;
    if (!this._hass || !customElements.get(CARD_TAG)) return undefined;
    try {
      const card = document.createElement(CARD_TAG);
      card.setAttribute("inert", "");
      card.setConfig({ type: CARD_TYPE, ...template.build(template.sample.entity) });
      card.hass = sampleHass(template, lang);
      return card;
    } catch (error) {
      warn(`quick start: preview of "${template.id}" skipped: ${error?.message ?? error}`);
      return null;
    }
  }

  _fallbackIcon(template) {
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", template.icon);
    return icon;
  }

  _choose(template) {
    if (template.id === NONE_TEMPLATE_ID) {
      this.dispatchEvent(new CustomEvent("template-dismiss"));
      return;
    }
    if (!template.entity) {
      this._emitApply(template, null);
      return;
    }
    this._pending = template;
    this._entity = "";
    this._render(".title");
  }

  // --- entity question ------------------------------------------------------------

  _renderQuestion(template) {
    const lang = this._lang();
    const wrap = document.createElement("section");
    wrap.className = "question";
    wrap.setAttribute("aria-labelledby", "st-title");
    const title = document.createElement("h3");
    title.className = "title";
    title.id = "st-title";
    // Focus target after the view changed: not in the tab order, a screen reader reads the heading.
    title.tabIndex = -1;
    title.textContent = t(lang, template.labelKey);
    const prompt = document.createElement("p");
    prompt.className = "hint";
    prompt.textContent = t(lang, "editor.template.entity_prompt");

    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = { entity: this._entity };
    form.schema = [{ name: "entity", required: true, selector: { entity: { filter: entityFilter(template.entity) } } }];
    form.computeLabel = () => t(lang, "editor.entity");
    this._form = form;
    form.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this._entity = event.detail?.value?.entity ?? "";
      if (this._applyButton) this._applyButton.disabled = !isEntityFor(template, this._entity);
    });

    const back = button("button", t(lang, "editor.template.back"), () => {
      this._pending = null;
      this._render(`.tile[data-template="${template.id}"]`);
    });
    const apply = button("button filled", t(lang, "editor.template.apply"), () => this._emitApply(template, this._entity));
    apply.disabled = !isEntityFor(template, this._entity);
    this._applyButton = apply;
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(back, apply);
    wrap.append(title, prompt, form, actions);
    return wrap;
  }

  _emitApply(template, entityId) {
    const known = findTemplate(template.id);
    if (!known?.build || (known.entity && !isEntityFor(known, entityId))) return;
    this._pending = null;
    this.dispatchEvent(new CustomEvent("template-apply", { detail: { config: known.build(entityId) } }));
  }
}

if (!customElements.get(PICKER_TAG)) customElements.define(PICKER_TAG, SlabtonTemplatePicker);

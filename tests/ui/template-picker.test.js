import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHass } from "../helpers/mock-hass.js";
import { findTemplate } from "../../src/core/templates.js";
import "../../src/ui/slabton-card.js";
import { PICKER_TAG } from "../../src/ui/template-picker.js";

// jsdom has no ha-form: a plain element takes its data, schema and events.
beforeAll(() => {
  if (!customElements.get("ha-form")) customElements.define("ha-form", class extends HTMLElement {});
});

const hass = (language = "en") => createHass({}, { language });

function mount(hassValue = hass()) {
  const picker = document.createElement(PICKER_TAG);
  picker.hass = hassValue;
  document.body.append(picker);
  const applied = [];
  const dismissed = vi.fn();
  picker.addEventListener("template-apply", (event) => applied.push(event.detail.config));
  picker.addEventListener("template-dismiss", dismissed);
  return { picker, applied, dismissed };
}

const root = (picker) => picker.shadowRoot;
const tile = (picker, id) => root(picker).querySelector(`.tile[data-template="${id}"]`);

describe("tiles", () => {
  it("shows one button tile per template with name and description", () => {
    const { picker } = mount();
    const tiles = [...root(picker).querySelectorAll(".tile")];
    expect(tiles.map((el) => el.dataset.template)).toEqual([
      "none", "clock", "timer", "lock", "thermometer", "thermostat", "shutter", "battery",
    ]);
    for (const el of tiles) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.type).toBe("button");
      expect(el.hasAttribute("disabled")).toBe(false);
      expect(el.getAttribute("tabindex")).toBeNull();
      expect(el.querySelector(".name").textContent.trim()).not.toBe("");
      expect(el.querySelector(".desc").textContent.trim()).not.toBe("");
    }
    expect(tile(picker, "clock").querySelector(".name").textContent).toBe("Clock");
  });

  it("follows the language of Home Assistant", () => {
    const { picker } = mount(hass("de"));
    expect(root(picker).querySelector(".title").textContent).toBe("Schnellstart");
    expect(tile(picker, "lock").querySelector(".name").textContent).toBe("Schloss");
  });

  it("re-renders in the new language", () => {
    const { picker } = mount(hass("en"));
    picker.hass = hass("de");
    expect(root(picker).querySelector(".title").textContent).toBe("Schnellstart");
  });

  it("puts a live preview card with the example state into every tile except none", () => {
    const { picker } = mount();
    const modes = {
      clock: "clock", timer: "timer", lock: "lock", thermometer: "value", thermostat: "state", shutter: "value", battery: "value",
    };
    for (const [id, mode] of Object.entries(modes)) {
      const preview = tile(picker, id).querySelector(".preview");
      const card = preview.querySelector("slabton-card");
      expect(card, id).not.toBeNull();
      expect(card.hass.states).toBeDefined();
      expect(card._config.mode).toBe(mode);
    }
    const timerCard = tile(picker, "timer").querySelector("slabton-card");
    expect(Object.keys(timerCard.hass.states)).toEqual(["timer.sample"]);
  });

  it("shows the example value in the previews of the phase B templates", () => {
    const { picker } = mount();
    const card = (id) => tile(picker, id).querySelector("slabton-card");
    const rootOf = (id) => card(id).shadowRoot.querySelector(".root");
    expect(Object.keys(card("thermostat").hass.states)).toEqual(["climate.sample"]);
    expect(card("thermostat").shadowRoot.querySelector(".bar-text").textContent).toContain("21.5");
    // Shutter at 60 %: six of ten slats are open (blue).
    expect(rootOf("shutter").style.getPropertyValue("--slabton-p")).toBe("0.6");
    expect(rootOf("shutter").style.getPropertyValue("--slabton-seg-k")).toBe("6");
    expect(rootOf("shutter").classList.contains("seg-on")).toBe(true);
    expect(card("shutter").shadowRoot.querySelector(".h-text").textContent).toBe("60%");
    expect(card("battery").shadowRoot.querySelector(".h-text").textContent).toBe("73%");
  });

  it("keeps the previews out of reach: inert, hidden from assistive technology, no services", () => {
    const { picker } = mount();
    const preview = tile(picker, "lock").querySelector(".preview");
    expect(preview.hasAttribute("inert")).toBe(true);
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    const card = preview.querySelector("slabton-card");
    expect(card.hasAttribute("inert")).toBe(true);
    card.hass.callService("lock", "unlock", {});
    expect(card.hass.states["lock.sample"].state).toBe("locked");
  });

  it("builds a preview once and reuses it", () => {
    const { picker } = mount();
    const first = tile(picker, "timer").querySelector("slabton-card");
    picker._render();
    expect(tile(picker, "timer").querySelector("slabton-card")).toBe(first);
  });

  it("tries a preview again when it was not possible yet, but not one that failed", () => {
    const picker = document.createElement(PICKER_TAG);
    document.body.append(picker);
    const timer = findTemplate("timer");
    expect(tile(picker, "timer").querySelector("slabton-card")).toBeNull();
    picker._hass = hass();
    picker._render();
    expect(tile(picker, "timer").querySelector("slabton-card")).not.toBeNull();
    expect(picker._previewOf(timer, "en").tagName).toBe("SLABTON-CARD");
  });

  it("does not build a failed preview again at every render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = vi.spyOn(customElements.get("slabton-card").prototype, "setConfig").mockImplementation(() => {
      throw new Error("boom");
    });
    const { picker } = mount();
    const calls = spy.mock.calls.length;
    picker._render();
    picker._render();
    expect(spy.mock.calls.length).toBe(calls);
    spy.mockRestore();
    warn.mockRestore();
  });

  it("shows the icon instead of a preview for none", () => {
    const { picker } = mount();
    const icon = tile(picker, "none").querySelector(".preview ha-icon");
    expect(icon.getAttribute("icon")).toBe("mdi:tune-variant");
    expect(tile(picker, "none").querySelector("slabton-card")).toBeNull();
  });

  it("falls back to the icon without hass", () => {
    const picker = document.createElement(PICKER_TAG);
    document.body.append(picker);
    const el = tile(picker, "timer");
    expect(el.querySelector("slabton-card")).toBeNull();
    expect(el.querySelector("ha-icon").getAttribute("icon")).toBe("mdi:timer-outline");
    expect(el.querySelector(".name").textContent).toBe("Timer");
  });

  it("falls back to the icon when the card rejects the config, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const timer = findTemplate("timer");
    const original = timer.build;
    // Catalog entries are frozen: stub the card's setConfig instead.
    const spy = vi.spyOn(customElements.get("slabton-card").prototype, "setConfig").mockImplementation(() => {
      throw new Error("boom");
    });
    const { picker } = mount();
    expect(tile(picker, "timer").querySelector("slabton-card")).toBeNull();
    expect(tile(picker, "timer").querySelector("ha-icon")).not.toBeNull();
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
    warn.mockRestore();
    expect(timer.build).toBe(original);
  });

  it("never turns text of the example entity into markup", () => {
    const { picker } = mount();
    expect(root(picker).querySelectorAll("script, img, iframe")).toHaveLength(0);
    expect(root(picker).querySelector(".tile").innerHTML).not.toContain("<b>");
  });
});

describe("keyboard focus and hass of the entity question", () => {
  it("puts the focus on the heading when a tile opens the question", () => {
    const { picker } = mount();
    tile(picker, "timer").click();
    const title = root(picker).querySelector(".title");
    expect(title.tabIndex).toBe(-1);
    expect(root(picker).activeElement).toBe(title);
  });

  it("puts the focus back on the chosen tile after Back", () => {
    const { picker } = mount();
    tile(picker, "lock").click();
    root(picker).querySelector(".button:not(.filled)").click();
    expect(root(picker).activeElement).toBe(tile(picker, "lock"));
  });

  it("does not move the focus when only the language changes", () => {
    const { picker } = mount(hass("en"));
    picker.hass = hass("de");
    expect(root(picker).activeElement).toBeNull();
  });

  it("hands a new hass to the open entity question", () => {
    const { picker } = mount();
    tile(picker, "timer").click();
    const form = root(picker).querySelector("ha-form");
    const next = hass();
    picker.hass = next;
    expect(form.hass).toBe(next);
    expect(root(picker).querySelector("ha-form")).toBe(form);
  });

  it("forgets the form after Back, so a later hass does not reach a removed form", () => {
    const { picker } = mount();
    tile(picker, "timer").click();
    const form = root(picker).querySelector("ha-form");
    root(picker).querySelector(".button:not(.filled)").click();
    const next = hass();
    picker.hass = next;
    expect(form.hass).not.toBe(next);
  });
});

describe("in the editor", () => {
  function editor(config) {
    const el = document.createElement("slabton-card-editor");
    el.hass = hass();
    document.body.append(el);
    const events = [];
    el.addEventListener("config-changed", (event) => events.push(event.detail.config));
    el.setConfig(config);
    return { el, events, picker: () => el.shadowRoot.querySelector(PICKER_TAG) };
  }

  it("shows the picker above the form for an untouched card", () => {
    for (const config of [{ type: "custom:slabton-card", entity: "" }, { type: "custom:slabton-card", entity: "switch.a", name: "A" }]) {
      const { el, picker } = editor(config);
      expect(picker()).not.toBeNull();
      expect(el.shadowRoot.firstElementChild).toBe(picker());
    }
  });

  it("hides the picker once an option is set", () => {
    const { picker } = editor({ type: "custom:slabton-card", entity: "switch.a", thickness: 40 });
    expect(picker()).toBeNull();
  });

  it("hides the picker when the form changes the card", () => {
    const { el, picker } = editor({ type: "custom:slabton-card", entity: "switch.a" });
    expect(picker()).not.toBeNull();
    el._onChanged({ stopPropagation() {}, detail: { value: { type: "custom:slabton-card", entity: "switch.a", thickness: 40 } } });
    expect(picker()).toBeNull();
  });

  it("applies the clock: config-changed with type and mode, HA keys kept, old options gone", () => {
    const { el, events, picker } = editor({
      type: "custom:slabton-card", entity: "switch.a", name: "Old",
      grid_options: { columns: 6 }, visibility: [{ condition: "user" }],
    });
    picker().shadowRoot.querySelector('.tile[data-template="clock"]').click();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "custom:slabton-card", mode: "clock", grid_options: { columns: 6 }, visibility: [{ condition: "user" }],
    });
    expect(el._form.data.mode).toBe("clock");
    expect(picker()).toBeNull();
  });

  it("applies a template with an entity after the question", () => {
    const { events, picker } = editor({ type: "custom:slabton-card", entity: "" });
    picker().shadowRoot.querySelector('.tile[data-template="timer"]').click();
    const form = picker().shadowRoot.querySelector("ha-form");
    form.dispatchEvent(new CustomEvent("value-changed", { detail: { value: { entity: "timer.kitchen" } } }));
    picker().shadowRoot.querySelector(".button.filled").click();
    expect(events.at(-1)).toEqual({ type: "custom:slabton-card", entity: "timer.kitchen", mode: "timer" });
  });

  it("closes on none without a config-changed and does not come back", () => {
    const { el, events, picker } = editor({ type: "custom:slabton-card", entity: "switch.a" });
    picker().shadowRoot.querySelector('.tile[data-template="none"]').click();
    expect(picker()).toBeNull();
    expect(events).toEqual([]);
    expect(el._config).toEqual({ type: "custom:slabton-card", entity: "switch.a" });
    el.setConfig({ type: "custom:slabton-card", entity: "switch.a" });
    expect(picker()).toBeNull();
  });

  it("hands the language of the user to the picker", () => {
    const { el, picker } = editor({ type: "custom:slabton-card", entity: "" });
    el.hass = hass("de");
    expect(picker().shadowRoot.querySelector(".title").textContent).toBe("Schnellstart");
  });

  it("keeps the config in the stub shape for getStubConfig", () => {
    const stub = customElements.get("slabton-card").getStubConfig({ states: { "light.a": {} } });
    expect(stub).toEqual({ type: "custom:slabton-card", entity: "light.a" });
    expect(editor(stub).picker()).not.toBeNull();
  });
});

describe("choosing", () => {
  it("applies the clock at once with its config and no entity question", () => {
    const { picker, applied } = mount();
    tile(picker, "clock").click();
    expect(applied).toEqual([{ mode: "clock" }]);
    expect(root(picker).querySelector("ha-form")).toBeNull();
  });

  it("dismisses on none and changes nothing", () => {
    const { picker, applied, dismissed } = mount();
    tile(picker, "none").click();
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(applied).toEqual([]);
  });

  it("asks for the entity first, filtered by the catalog", () => {
    const { picker, applied } = mount();
    tile(picker, "thermometer").click();
    const form = root(picker).querySelector("ha-form");
    expect(form.schema).toEqual([{
      name: "entity", required: true,
      selector: { entity: { filter: [{ domain: ["sensor"], device_class: ["temperature"] }] } },
    }]);
    // The old entity is not offered again: nothing is taken over without a choice.
    expect(form.data).toEqual({ entity: "" });
    expect(root(picker).querySelector(".tile")).toBeNull();
    expect(applied).toEqual([]);
  });

  it("applies the template once an entity of the right domain is chosen", () => {
    const { picker, applied } = mount();
    tile(picker, "lock").click();
    const apply = root(picker).querySelector(".button.filled");
    expect(apply.disabled).toBe(true);
    const form = root(picker).querySelector("ha-form");
    const change = (entity) => {
      const event = new CustomEvent("value-changed", { detail: { value: { entity } }, bubbles: true });
      form.dispatchEvent(event);
    };
    change("switch.door");
    expect(apply.disabled).toBe(true);
    change("lock.door");
    expect(apply.disabled).toBe(false);
    apply.click();
    expect(applied).toEqual([{ entity: "lock.door", mode: "lock" }]);
  });

  it("does not apply a wrong entity even when the button is forced", () => {
    const { picker, applied } = mount();
    tile(picker, "timer").click();
    picker._entity = "light.x";
    root(picker).querySelector(".button.filled").disabled = false;
    root(picker).querySelector(".button.filled").click();
    expect(applied).toEqual([]);
  });

  it("stops the value-changed event of its question", () => {
    const { picker } = mount();
    const seen = vi.fn();
    document.addEventListener("value-changed", seen);
    tile(picker, "timer").click();
    root(picker).querySelector("ha-form").dispatchEvent(
      new CustomEvent("value-changed", { detail: { value: { entity: "timer.a" } }, bubbles: true, composed: true }),
    );
    document.removeEventListener("value-changed", seen);
    expect(seen).not.toHaveBeenCalled();
  });

  it("goes back to the tiles", () => {
    const { picker } = mount();
    tile(picker, "timer").click();
    root(picker).querySelector(".button:not(.filled)").click();
    expect(root(picker).querySelectorAll(".tile")).toHaveLength(8);
  });

  it.each([
    ["thermostat", "climate.living_room", [{ domain: ["climate"] }], {
      entity: "climate.living_room", bar: { attribute: "current_temperature", unit: "°C" }, bar_text: "{value}",
    }],
    ["shutter", "cover.living_room", [{ domain: ["cover"] }], null],
    ["battery", "sensor.battery", [{ domain: ["sensor"], device_class: ["battery"] }], {
      entity: "sensor.battery", mode: "value", preset: "soc",
    }],
  ])("asks for the entity of %s and applies the expanded config", (id, entity, filter, expected) => {
    const { picker, applied } = mount();
    tile(picker, id).click();
    const form = root(picker).querySelector("ha-form");
    expect(form.schema[0].selector.entity.filter).toEqual(filter);
    form.dispatchEvent(new CustomEvent("value-changed", { detail: { value: { entity } }, bubbles: true }));
    root(picker).querySelector(".button.filled").click();
    expect(applied).toHaveLength(1);
    expect(applied[0].entity).toBe(entity);
    if (expected) expect(applied[0]).toEqual(expected);
    else expect(applied[0]).toMatchObject({ mode: "value", orientation: "vertical" });
  });
});

describe("buttons of the entity question", () => {
  const css = () => {
    const { picker } = mount();
    return root(picker).querySelector("style").textContent;
  };

  it("have a Material 3 state layer: 8 % on hover, 10 % on focus and press, none while disabled", () => {
    const style = css();
    expect(style).toContain(".button::before");
    expect(style).toMatch(/\.button:not\(:disabled\):hover::before \{ opacity: 0\.08; \}/);
    expect(style).toMatch(/\.button:not\(:disabled\):focus-visible::before, \.button:not\(:disabled\):active::before \{ opacity: 0\.1; \}/);
  });

  it("do not animate the state layer with reduced motion", () => {
    expect(css()).toMatch(/prefers-reduced-motion: reduce\)[^}]*\.button::before/);
  });
});

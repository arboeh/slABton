// Minimal Home Assistant stand-in for the docs demo: ha-card, ha-icon and a hass object.
(function () {
  // A failed fetch leaves the icon map empty: icons stay blank instead of an unhandled rejection.
  const ICONS = fetch("icons.json")
    .then((r) => {
      if (!r.ok) throw new Error(`icons.json: HTTP ${r.status}`);
      return r.json();
    })
    .catch((error) => {
      console.warn("slABton demo: icons unavailable", error);
      return {};
    });

  if (!customElements.get("ha-card")) {
    customElements.define("ha-card", class extends HTMLElement {});
  }

  if (!customElements.get("ha-icon")) {
    customElements.define("ha-icon", class extends HTMLElement {
      static get observedAttributes() { return ["icon"]; }
      attributeChangedCallback() { this.render(); }
      connectedCallback() { this.render(); }
      set icon(value) { this.setAttribute("icon", value); }
      get icon() { return this.getAttribute("icon"); }
      async render() {
        const paths = await ICONS;
        const d = paths[this.getAttribute("icon")];
        this.innerHTML = d
          ? `<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);display:block" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`
          : "";
      }
    });
  }

  const minutes = (n) => new Date(Date.now() + n * 60000).toISOString();
  const entity = (id, state, attributes = {}) => ({ entity_id: id, state, attributes });

  const states = {
    "input_select.heating_mode": entity("input_select.heating_mode", "Auto", { options: ["Off", "Auto", "On", "Idle"] }),
    "lock.front_door": entity("lock.front_door", "locked"),
    "sensor.living_room_temperature": entity("sensor.living_room_temperature", "21.4"),
    "sensor.battery_soc": entity("sensor.battery_soc", "64"),
    "input_number.target_temperature": entity("input_number.target_temperature", "21", { min: 15, max: 25, step: 0.5 }),
    "counter.guests": entity("counter.guests", "3", { minimum: 0, maximum: 10 }),
    "timer.sauna": entity("timer.sauna", "active", { duration: "0:10:00", remaining: "0:10:00", finishes_at: minutes(5) }),
    "timer.tea": entity("timer.tea", "paused", { duration: "0:10:00", remaining: "0:03:20" }),
    "input_datetime.festival": entity(
      "input_datetime.festival",
      new Date(Date.now() + 3 * 86400000 + 3600000).toISOString().slice(0, 19).replace("T", " "),
      { has_date: true, has_time: true },
    ),
  };

  const toSeconds = (hms) => hms.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
  const toHms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((n, i) => (i ? String(n).padStart(2, "0") : String(n))).join(":");

  const base = {
    config: { time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    locale: { language: window.SLABTON_I18N?.language ?? navigator.language ?? "en" },
    callService,
  };
  // Like real HA, every state change yields a new hass object (the card compares old and new).
  let hass = { ...base, states: { ...states } };
  const timers = new Map();

  function publish(id, next) {
    states[id] = next;
    hass = { ...base, states: { ...states } };
    // Deferred: the card may still be inside its own action handler.
    setTimeout(() => document.dispatchEvent(new CustomEvent("mock-hass-changed")), 0);
  }

  function clampCounter(current, delta) {
    const { minimum, maximum } = current.attributes;
    const value = Number(current.state) + delta;
    const lower = minimum ?? -Infinity;
    const upper = maximum ?? Infinity;
    return Math.min(upper, Math.max(lower, value));
  }

  function endTimer(id) {
    const current = states[id];
    const attrs = { ...current.attributes, remaining: current.attributes.duration };
    delete attrs.finishes_at;
    publish(id, { ...current, state: "idle", attributes: attrs });
  }

  function scheduleTimerEnd(id) {
    clearTimeout(timers.get(id));
    const left = Date.parse(states[id].attributes.finishes_at) - Date.now();
    timers.set(id, setTimeout(() => endTimer(id), Math.max(0, left)));
  }

  function timerService(id, service, current) {
    const attrs = { ...current.attributes };
    if (service === "start") {
      attrs.finishes_at = new Date(Date.now() + toSeconds(attrs.duration) * 1000).toISOString();
      attrs.remaining = attrs.duration;
      return { next: { ...current, state: "active", attributes: attrs }, schedule: true };
    }
    if (service === "pause") {
      if (!attrs.finishes_at) return { next: current };
      const left = Math.max(0, Math.round((Date.parse(attrs.finishes_at) - Date.now()) / 1000));
      clearTimeout(timers.get(id));
      attrs.remaining = toHms(left);
      delete attrs.finishes_at;
      return { next: { ...current, state: "paused", attributes: attrs } };
    }
    if (service === "cancel") {
      clearTimeout(timers.get(id));
      attrs.remaining = attrs.duration;
      delete attrs.finishes_at;
      return { next: { ...current, state: "idle", attributes: attrs } };
    }
    return { next: current };
  }

  function callService(domain, service, data, target) {
    document.dispatchEvent(new CustomEvent("mock-service-call", { detail: { domain, service, data, target } }));
    const id = target?.entity_id ?? data?.entity_id;
    const current = id && states[id];
    if (!current) return Promise.resolve();
    let next = current;
    if (domain === "counter") {
      const delta = service === "increment" ? 1 : service === "decrement" ? -1 : 0;
      next = { ...current, state: String(clampCounter(current, delta)) };
    } else if (domain === "timer") {
      const result = timerService(id, service, current);
      next = result.next;
      publish(id, next);
      if (result.schedule) scheduleTimerEnd(id);
      return Promise.resolve();
    } else if (service === "select_option") {
      next = { ...current, state: data.option };
    } else if (service === "set_value") {
      next = { ...current, state: String(data.value) };
    } else if (["lock", "unlock"].includes(service)) {
      next = { ...current, state: service === "lock" ? "locked" : "unlocked" };
    }
    publish(id, next);
    return Promise.resolve();
  }

  scheduleTimerEnd("timer.sauna");
  window.SLABTON_MOCK = { get hass() { return hass; } };
})();

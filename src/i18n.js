/*
 * Minimal translation helper. Two dictionaries (en, de); the language comes
 * from Home Assistant (`hass.locale.language`, then `hass.language`) and falls
 * back to English. A missing key falls back to English, then to the key.
 * Config errors and console warnings stay English on purpose (developer texts).
 */

export const DEFAULT_LANGUAGE = "en";

/** Plural forms are stored as `key.one` / `key.other`. */
export const DICTIONARIES = Object.freeze({
  en: {
    "timer.idle": "Ready",
    "timer.active": "Running",
    "timer.paused": "Paused",
    "timer.expired": "Expired",
    "unit.day.one": "{count} day",
    "unit.day.other": "{count} days",
    "unit.day.short": "{count} d",
    "unit.hour.one": "{count} hour",
    "unit.hour.other": "{count} hours",
    "unit.minute.one": "{count} minute",
    "unit.minute.other": "{count} minutes",
    "unit.second.one": "{count} second",
    "unit.second.other": "{count} seconds",
    "aria.timer": "{state}, {remaining}",
    "clock.name": "Clock",
    "editor.entity": "Entity",
    "editor.mode": "Mode",
    "editor.name": "Header text",
    "editor.icon": "Icon",
    "editor.header_position": "Header position",
    "editor.header_icon_position": "Header icon position",
    "editor.orientation": "Orientation",
    "editor.direction": "Direction (ltr / rtl)",
    "editor.length": "Bar length in px (0 = auto)",
    "editor.thickness": "Bar thickness in px",
    "editor.handle_size": "Handle size in px",
    "editor.handle_shape": "Handle shape",
    "editor.handle_position": "Handle position",
    "editor.fixed_position": "Fixed position in %",
    "editor.handle_overhang": "Handle sticks out at both ends",
    "editor.handle_content": "Handle content",
    "editor.animation": "Animation",
    "editor.bar_color": "Bar color",
    "editor.fill_color": "Fill color",
    "editor.handle_color": "Handle color",
    "editor.text_color": "Text color",
    "editor.border_color": "Border color",
    "editor.border_width": "Border width in px",
    "editor.border_radius": "Bar corner radius in px",
    "editor.drag": "Allow dragging",
    "editor.hold_reverse": "Hold goes to previous state",
    "editor.swipe_threshold": "Swipe threshold in %",
    "editor.arm_service": "Arm service (alarm)",
    "editor.preset": "Preset",
    "editor.min": "Minimum",
    "editor.max": "Maximum",
    "editor.unit": "Unit",
    "editor.decimals": "Decimals",
    "editor.tap_action": "Tap action",
    "editor.double_tap_action": "Double tap action",
    "editor.hold_action": "Hold action",
    "editor.bar_text": "Text in the bar (placeholders like {remaining})",
    "editor.entity_bar": "Entity for the bar value (optional)",
    "editor.pulse": "Pulse when expired",
    "editor.pulse_seconds": "Pulse duration in seconds (0 = until tap)",
    "editor.info": "Extra info text (placeholders)",
    "editor.time_zone": "Time zone (e.g. Europe/Berlin)",
    "editor.span": "Bar is full from this many days left",
    "editor.display": "Display",
    "editor.hour_format": "Hour format",
    "editor.seconds": "Show seconds",
    "editor.section.layout": "Layout",
    "editor.section.colors": "Colors",
    "editor.section.actions": "Actions",
    "editor.section.bar": "Bar value",
    "editor.section.counter": "Counter",
    "editor.section.timer": "Timer",
    "editor.section.clock": "Clock",
    "editor.no_form": "The visual editor needs Home Assistant's form component. Use the YAML editor instead.",
  },
  de: {
    "timer.idle": "Bereit",
    "timer.active": "Läuft",
    "timer.paused": "Pausiert",
    "timer.expired": "Abgelaufen",
    "unit.day.one": "{count} Tag",
    "unit.day.other": "{count} Tage",
    "unit.day.short": "{count} T",
    "unit.hour.one": "{count} Stunde",
    "unit.hour.other": "{count} Stunden",
    "unit.minute.one": "{count} Minute",
    "unit.minute.other": "{count} Minuten",
    "unit.second.one": "{count} Sekunde",
    "unit.second.other": "{count} Sekunden",
    "aria.timer": "{state}, {remaining}",
    "clock.name": "Uhr",
    "editor.entity": "Entität",
    "editor.mode": "Modus",
    "editor.name": "Kopfzeilentext",
    "editor.icon": "Symbol",
    "editor.header_position": "Position der Kopfzeile",
    "editor.header_icon_position": "Position des Kopfzeilen-Symbols",
    "editor.orientation": "Ausrichtung",
    "editor.direction": "Richtung (ltr / rtl)",
    "editor.length": "Balkenlänge in px (0 = automatisch)",
    "editor.thickness": "Balkendicke in px",
    "editor.handle_size": "Griffgröße in px",
    "editor.handle_shape": "Griffform",
    "editor.handle_position": "Griffposition",
    "editor.fixed_position": "Feste Position in %",
    "editor.handle_overhang": "Griff ragt an beiden Enden heraus",
    "editor.handle_content": "Griffinhalt",
    "editor.animation": "Animation",
    "editor.bar_color": "Balkenfarbe",
    "editor.fill_color": "Füllfarbe",
    "editor.handle_color": "Griff-Farbe",
    "editor.text_color": "Textfarbe",
    "editor.border_color": "Rahmenfarbe",
    "editor.border_width": "Rahmenbreite in px",
    "editor.border_radius": "Eckenradius des Balkens in px",
    "editor.drag": "Ziehen erlauben",
    "editor.hold_reverse": "Halten springt zum vorigen Zustand",
    "editor.swipe_threshold": "Wischschwelle in %",
    "editor.arm_service": "Scharfschalt-Dienst (Alarm)",
    "editor.preset": "Vorlage",
    "editor.min": "Minimum",
    "editor.max": "Maximum",
    "editor.unit": "Einheit",
    "editor.decimals": "Nachkommastellen",
    "editor.tap_action": "Aktion beim Tippen",
    "editor.double_tap_action": "Aktion beim Doppeltippen",
    "editor.hold_action": "Aktion beim Halten",
    "editor.bar_text": "Text im Balken (Platzhalter wie {remaining})",
    "editor.entity_bar": "Entität für den Balkenwert (optional)",
    "editor.pulse": "Bei Ablauf pulsieren",
    "editor.pulse_seconds": "Pulsdauer in Sekunden (0 = bis Tippen)",
    "editor.info": "Zusatzinfo-Text (Platzhalter)",
    "editor.time_zone": "Zeitzone (z. B. Europe/Berlin)",
    "editor.span": "Balken ist voll ab so vielen Tagen Restzeit",
    "editor.display": "Anzeige",
    "editor.hour_format": "Stundenformat",
    "editor.seconds": "Sekunden anzeigen",
    "editor.section.layout": "Layout",
    "editor.section.colors": "Farben",
    "editor.section.actions": "Aktionen",
    "editor.section.bar": "Balkenwert",
    "editor.section.counter": "Zähler",
    "editor.section.timer": "Timer",
    "editor.section.clock": "Uhr",
    "editor.no_form": "Der visuelle Editor braucht die Formular-Komponente von Home Assistant. Nutze stattdessen den YAML-Editor.",
  },
});

export const LANGUAGES = Object.freeze(Object.keys(DICTIONARIES));

/** Base language of a locale tag ("de-DE" -> "de"), or null when unsupported. */
function supported(tag) {
  if (typeof tag !== "string") return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.includes(base) ? base : null;
}

/** Supported language for `hass` (locale.language, then language, then English). */
export function resolveLanguage(hass) {
  return supported(hass?.locale?.language) ?? supported(hass?.language) ?? DEFAULT_LANGUAGE;
}

/** BCP 47 tag for Intl formatting ("de", "en-GB"); the supported language when the tag is unusable. */
export function resolveLocale(hass) {
  const tag = String(hass?.locale?.language ?? hass?.language ?? "").replace("_", "-");
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag])[0] ?? resolveLanguage(hass);
  } catch {
    return resolveLanguage(hass);
  }
}

/** True when `key` exists in the dictionary of `lang` or in English. */
export function hasTranslation(lang, key) {
  return Object.hasOwn(DICTIONARIES[lang] ?? {}, key) || Object.hasOwn(DICTIONARIES[DEFAULT_LANGUAGE], key);
}

/**
 * Translate `key`. `{name}` tokens are replaced from `params` (own properties
 * only, values are stringified; unknown tokens stay as they are).
 */
export function t(lang, key, params = {}) {
  const own = DICTIONARIES[lang] ?? {};
  const template = Object.hasOwn(own, key) ? own[key] : DICTIONARIES[DEFAULT_LANGUAGE][key];
  if (typeof template !== "string") return key;
  return template.replace(/\{(\w+)\}/g, (token, name) => (Object.hasOwn(params, name) ? String(params[name]) : token));
}

/** Translate a counted noun: `unit.day` + 3 -> "3 days" / "3 Tage". */
export function tPlural(lang, key, count) {
  const rule = new Intl.PluralRules(lang).select(count);
  return t(lang, `${key}.${rule === "one" ? "one" : "other"}`, { count });
}

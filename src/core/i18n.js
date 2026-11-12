/*
 * Minimal translation helper. Two dictionaries (en, de; JSON files in
 * `locales/`); the language comes from Home Assistant (`hass.locale.language`,
 * then `hass.language`) and falls back to English. A missing key falls back to English, then to the key.
 * Config errors and console warnings stay English on purpose (developer texts).
 */

import de from "./locales/de.json";
import en from "./locales/en.json";

export const DEFAULT_LANGUAGE = "en";

/**
 * Plural forms are stored as `key.one` / `key.other`. One flat JSON file per
 * language in `locales/`; a new language needs its file plus one line below.
 */
export const DICTIONARIES = Object.freeze({ en, de });

export const LANGUAGES = Object.freeze(Object.keys(DICTIONARIES));

/** Base language of a locale tag ("de-DE" -> "de"), or null when unsupported. */
function supportedLanguage(tag) {
  if (typeof tag !== "string") return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.includes(base) ? base : null;
}

/** Supported language for `hass` (locale.language, then language, then English). */
export function resolveLanguage(hass) {
  return supportedLanguage(hass?.locale?.language) ?? supportedLanguage(hass?.language) ?? DEFAULT_LANGUAGE;
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

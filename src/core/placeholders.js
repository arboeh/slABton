/*
 * Text placeholders for `bar_text` and `timer.info`. Deliberately not a
 * template language: a fixed list of names in single curly braces, replaced
 * by plain strings. No expressions, no Jinja, no HTML. Callers must put the
 * result into the DOM with `textContent` only.
 */

import { MODE } from "./constants.js";

const BASE = ["name", "state", "value"];
const TIMER = [...BASE, "remaining", "remaining_text", "days", "hours", "minutes", "seconds", "elapsed", "target"];

/** Placeholder names allowed per mode. */
export const PLACEHOLDERS = Object.freeze({
  [MODE.STATE]: BASE,
  [MODE.LOCK]: BASE,
  [MODE.VALUE]: BASE,
  [MODE.COUNTER]: BASE,
  [MODE.TIMER]: TIMER,
  [MODE.CLOCK]: [...BASE, "time"],
});

/** Text shown for an allowed placeholder without a value. */
export const EMPTY_VALUE = "–";

/** `{name}` but not `{{name}}` (a Jinja-style token stays literal text). */
const TOKEN_RE = /(?<!\{)\{([A-Za-z_][A-Za-z0-9_]*)\}(?!\})/g;

const allowedFor = (mode) => PLACEHOLDERS[mode] ?? BASE;

/** Names used in `text` that are not allowed in `mode` (duplicates removed). */
export function unknownPlaceholders(text, mode) {
  if (typeof text !== "string") return [];
  const allowed = allowedFor(mode);
  const unknown = new Set();
  for (const match of text.matchAll(TOKEN_RE)) {
    if (!allowed.includes(match[1])) unknown.add(match[1]);
  }
  return [...unknown];
}

/**
 * Replace allowed placeholders with `values[name]` (`null`/`undefined` ->
 * "–"). Names outside the mode's list stay in the text unchanged.
 */
export function renderTemplate(text, values, mode) {
  if (typeof text !== "string" || text === "") return "";
  const allowed = allowedFor(mode);
  return text.replace(TOKEN_RE, (token, name) => {
    if (!allowed.includes(name)) return token;
    const value = Object.hasOwn(values ?? {}, name) ? values[name] : null;
    return value == null || value === "" ? EMPTY_VALUE : String(value);
  });
}

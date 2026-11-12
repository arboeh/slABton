/*
 * Time helpers: durations, time zones (Intl only, no library) and the
 * countdown target of input_datetime / input_date entities. All functions are
 * pure; the current time is always passed in.
 */

import { t, tPlural } from "./i18n.js";

const SECOND = 1000;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

const DURATION_RE = /^(\d+):([0-5]?\d):([0-5]?\d)(?:\.\d+)?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const TIME_ONLY_RE = /^\d{2}:\d{2}(?::\d{2})?$/;

/** Parse "H:MM:SS" (HA timer attributes) into seconds; NaN when invalid. */
export function parseDuration(value) {
  const match = DURATION_RE.exec(typeof value === "string" ? value.trim() : "");
  if (!match) return NaN;
  return Number(match[1]) * HOUR + Number(match[2]) * MINUTE + Number(match[3]);
}

/** Split whole seconds into day / hour / minute / second components. */
export function splitDuration(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(total / DAY),
    hours: Math.floor((total % DAY) / HOUR),
    minutes: Math.floor((total % HOUR) / MINUTE),
    seconds: total % MINUTE,
  };
}

const pad2 = (n) => String(n).padStart(2, "0");

/** "3 d" from one day on, else "1:05:00" or "4:59". */
export function formatRemaining(totalSeconds, lang = "en") {
  const { days, hours, minutes, seconds } = splitDuration(totalSeconds);
  if (days > 0) return t(lang, "unit.day.short", { count: days });
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}

/** Largest unit, localized: "3 days", "2 Stunden", "30 Sekunden". */
export function formatRemainingText(lang, totalSeconds) {
  const { days, hours, minutes, seconds } = splitDuration(totalSeconds);
  if (days > 0) return tPlural(lang, "unit.day", days);
  if (hours > 0) return tPlural(lang, "unit.hour", hours);
  if (minutes > 0) return tPlural(lang, "unit.minute", minutes);
  return tPlural(lang, "unit.second", seconds);
}

/** True when `timeZone` is an IANA name this browser knows. */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Browser time zone, or "UTC" when it cannot be determined. */
export function browserTimeZone() {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** First valid IANA name of `candidates`, else the browser time zone. */
export function resolveTimeZone(...candidates) {
  return candidates.find(isValidTimeZone) ?? browserTimeZone();
}

/** Wall-clock parts of an instant in `timeZone`. */
export function zonedParts(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  // Some engines print midnight as hour 24 even with h23.
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `timeZone` from UTC at the instant `epochMs`, in ms. */
export function zoneOffsetMs(epochMs, timeZone) {
  const p = zonedParts(epochMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(epochMs / SECOND) * SECOND;
}

/**
 * Instant of a wall-clock time in `timeZone`. A time that does not exist
 * (spring-forward gap) resolves to the instant after the gap (shifted by the
 * gap length); an ambiguous time (autumn overlap) resolves to the later of its
 * two occurrences.
 */
export function zonedTimeToEpoch(parts, timeZone) {
  const guessUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetAtGuess = guessUtc - zoneOffsetMs(guessUtc, timeZone);
  const refined = guessUtc - zoneOffsetMs(offsetAtGuess, timeZone);
  return refined;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validParts({ year, month, day, hour, minute, second }) {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

/** Parse "YYYY-MM-DD" or "YYYY-MM-DD HH:MM[:SS]" into parts; null when invalid. */
export function parseDateTime(value) {
  const text = typeof value === "string" ? value.trim() : "";
  let parts = null;
  const dateOnly = DATE_RE.exec(text);
  const dateTime = DATE_TIME_RE.exec(text);
  if (dateOnly) {
    parts = { year: +dateOnly[1], month: +dateOnly[2], day: +dateOnly[3], hour: 0, minute: 0, second: 0 };
  } else if (dateTime) {
    parts = {
      year: +dateTime[1], month: +dateTime[2], day: +dateTime[3],
      hour: +dateTime[4], minute: +dateTime[5], second: dateTime[6] == null ? 0 : +dateTime[6],
    };
  }
  return parts && validParts(parts) ? parts : null;
}

/** True for a time without a date ("18:00:00"): not supported as a countdown target. */
export function isTimeOnly(value) {
  return typeof value === "string" && TIME_ONLY_RE.test(value.trim());
}

/** Target instant of an input_datetime / input_date state in `timeZone`; null when unusable. */
export function targetEpoch(state, timeZone) {
  const parts = parseDateTime(state);
  return parts ? zonedTimeToEpoch(parts, timeZone) : null;
}

/** Fraction of the local day that has passed at `epochMs` (0 at 0:00, 1 at 24:00). */
export function dayProgress(epochMs, timeZone) {
  const p = zonedParts(epochMs, timeZone);
  return (p.hour * HOUR + p.minute * MINUTE + p.second) / DAY;
}

/**
 * Format the time of day. `hourFormat`: "auto" (locale default), "12" or "24".
 * @returns {string}
 */
export function formatClock(epochMs, timeZone, { hourFormat = "auto", seconds = false, locale = "en" } = {}) {
  const options = { timeZone, hour: "2-digit", minute: "2-digit" };
  if (seconds) options.second = "2-digit";
  if (hourFormat === "12") {
    options.hourCycle = "h12";
    options.hour = "numeric";
  } else if (hourFormat === "24") {
    options.hourCycle = "h23";
  }
  return new Intl.DateTimeFormat(locale, options).format(new Date(epochMs));
}

/** Medium date plus time, localized ("12 Nov 2026, 18:00"), for `{target}`. */
export function formatTarget(epochMs, timeZone, locale = "en", withTime = true) {
  const options = { timeZone, dateStyle: "medium" };
  if (withTime) options.timeStyle = "short";
  return new Intl.DateTimeFormat(locale, options).format(new Date(epochMs));
}

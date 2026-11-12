/*
 * Pure, dependency-free helpers. Everything that comes from the card config
 * passes through here before it reaches the DOM, CSS or a service call.
 */

const PREFIX = "slabton-card";

/** Log a prefixed warning. */
export function warn(message) {
  console.warn(`${PREFIX}: ${message}`);
}

/** Escape text for safe use in HTML text and attribute values. */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Trimmed non-empty string or null. */
export function str(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Coerce to a finite number within [min, max]; `fallback` when missing or invalid. */
export function toNumber(value, fallback, min, max) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

/** CSS functions that can load a resource; colors and gradients never need them. */
const CSS_RESOURCE_RE = /javascript:|expression|@import|\b(?:-webkit-)?(?:url|image-set|image|src|element|paint|cross-fade)\s*\(/i;

/**
 * Validate a CSS value. Rejects characters that could break out of a
 * declaration, quotes and "://" (no remote strings), and every CSS function
 * that can load a resource (url, image-set, src, ...).
 */
export function safeCss(value, fallback = null) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
  if (/[;{}<>`\\"']/.test(trimmed) || trimmed.includes("://")) return fallback;
  if (CSS_RESOURCE_RE.test(trimmed)) return fallback;
  return trimmed;
}

/** Only http(s) URLs may be opened. Returns the URL or null. */
export function safeUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url.trim();
    warn(`blocked url with protocol '${parsed.protocol}'`);
  } catch {
    warn("invalid url_path provided");
  }
  return null;
}

/** Return `value` when allowed, `fallback` when missing, throw otherwise. */
export function pickEnum(value, allowed, fallback, key) {
  if (value == null || value === "") return fallback;
  if (!allowed.includes(value)) {
    throw new Error(`${PREFIX}: invalid ${key} "${String(value)}" (allowed: ${allowed.join(", ")})`);
  }
  return value;
}

/**
 * Map a logical position (0 = start of the value range, 1 = end) to the
 * fraction measured from the left (horizontal) or top (vertical) edge.
 * Horizontal ltr grows to the right, vertical grows upwards; rtl reverses.
 * The mapping is its own inverse.
 */
export function axisFraction(pos, horizontal, reversed) {
  if (horizontal) return reversed ? 1 - pos : pos;
  return reversed ? pos : 1 - pos;
}

/** Convert a pointer coordinate to a logical position (0..1). */
export function pointerToFraction({ coord, start, size, handleLen, horizontal, reversed }) {
  if (!(size > 0)) return 0;
  const edge = clamp((coord - start - handleLen / 2) / size, 0, 1);
  return axisFraction(edge, horizontal, reversed);
}

/** Resolve the handle position (0..1) for the configured placement. */
export function resolveHandlePosition(config, valuePos, isOn) {
  switch (config.handle_position) {
    case "fixed": return clamp(config.fixed_position / 100, 0, 1);
    case "switch": return isOn ? 1 : 0;
    case "start": return 0;
    case "mid": return 0.5;
    case "end": return 1;
    default: return valuePos;
  }
}

/** Format a number with decimals and optional unit. */
export function formatValue(value, decimals, unit) {
  const text = value.toFixed(decimals);
  if (!unit) return text;
  return /^[°%]/.test(unit) ? `${text}${unit}` : `${text} ${unit}`;
}

/** Numeric state of an entity; NaN for a missing, empty or non-numeric state. */
export function parseNumericState(stateObj) {
  const raw = stateObj?.state;
  if (typeof raw !== "string" || raw.trim() === "") return NaN;
  return Number(raw);
}

export function isUnavailable(stateObj) {
  return !stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown";
}

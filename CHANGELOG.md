# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed

- License changed from MIT to MPL 2.0 (`LICENSE`, `package.json`, READMEs).

## [0.2.0] - 2026-11-12

### Added

- Mode `counter` for `counter.*`: bar between `minimum` / `maximum` (override with `counter.min` / `counter.max`),
  tap `counter.increment`, double tap `counter.decrement`.
- Mode `timer` for Home Assistant `timer.*` (tap start / pause, hold cancel) and for a countdown to an
  `input_datetime` (with date) or `input_date` (`timer.span`, `timer.time_zone`).
- Pulse when a timer runs out or the target is reached (`timer.pulse`, `timer.pulse_seconds`); a tap ends it;
  static highlight with reduced motion.
- Mode `clock`: digital clock without an entity, time zone, 12 / 24 h, seconds, bar = progress of the day.
  `clock.display: analog` is reserved.
- `bar:` block: bar value from a separate numeric entity with its own `min`, `max`, `unit`, `decimals`, `preset`.
  The flat options stay as an alias; `bar:` wins on conflict (warning).
- `bar_text` and `timer.info` with fixed placeholders (`{name}`, `{state}`, `{value}`, `{remaining}`, `{remaining_text}`,
  `{days}`, `{hours}`, `{minutes}`, `{seconds}`, `{elapsed}`, `{target}`, `{time}`). No templates, shown as plain text.
- Translations (English, German) for the editor and new texts; language from `hass.locale`.
- Local one-second tick for timer and clock, only while the card is connected and the tab is visible.
- Reserved names `thresholds`, `scale`, `shape`, `control`: warned about and ignored.
- Editor fields for the new modes, `bar:` and `bar_text`.

### Changed

- `counter.*` and `timer.*` entities now default to the modes `counter` and `timer` (they used to fall into `state`).
  Set `mode: state` to keep the old behavior.
- Handle content defaults to `text` in the modes `counter`, `timer` and `clock` (as in `value`).

### Fixed

- `package.json` had a syntax error and duplicate `jsdom` / `vitest` entries after a Dependabot merge;
  versions now match `package-lock.json` (`jsdom` ^31, `vitest` ^5).

## [0.1.0]

### Added

- Card `custom:slabton-card`: bar with a movable handle button, horizontal and vertical, `ltr` and `rtl`.
- Handle shapes `round` (default), `oval`, `square`; configurable sizes, border, corner radius.
- Handle positions `flex`, `fixed`, `switch`, `start`, `mid`, `end`.
- Mode `state`: multi-state switch by sequential click, drag-to-snap, optional reverse on hold
  (`select`, `input_select`, `climate`, on/off domains).
- Mode `lock`: swipe to unlock / swipe to lock for `lock` and `alarm_control_panel` (threshold, spring-back).
- Mode `value`: read-only bar with value in the handle; presets `thermometer`, `energy`, `soc`.
- Actions `tap_action`, `double_tap_action`, `hold_action` (plus `cycle` / `cycle_back`).
- Handle content: icon per state, position number, state text or value.
- Optional separate switches at `start`, `mid`, `end`.
- Header text and header icon, with `header_icon_position` (`left` like the Tile card, default, or `right`).
- Option `handle_overhang`: the handle sticks out at both ends of the bar. Without it the fill is empty at the first state and full at the last, too.
- Animations `none`, `slide` (default), `fade`, `pulse`, `shimmer`; honors `prefers-reduced-motion`.
- Styling: HA theme variables, color options, `styles:` override of CSS variables.
- Visual editor (`ha-form`) with mode-dependent fields.
- Keyboard operation and ARIA roles.
- Vitest + jsdom test suite, ESLint, esbuild bundle `dist/slabton.js`, version check.
- GitHub / HACS structure (CI, release, HACS validation, Dependabot, issue / PR templates).

### Security

- Config colors and `styles:` values reject quotes, `://` and every CSS function that loads a resource
  (`url`, `image-set`, `src`, ...), so a config cannot trigger remote requests.
- Lock mode ignores arrow keys: a stray key press cannot lock or unlock. `jammed` locks send no action.
- `SECURITY.md` states that the card configuration is trusted and swipe is not a security boundary.

### Notes

- `call-service` is accepted as a deprecated alias of `perform-action`.
- Actions of the HA action picker that the card does not implement (`default`, `assist`, `fire-dom-event`) are ignored with a warning.
- Alarm panels that require a code are not supported; do not store codes in the card config.

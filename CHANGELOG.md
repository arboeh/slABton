# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

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

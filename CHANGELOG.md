# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed

- Scale in the modes value, counter, timer and clock spans the whole bar: tick 0 at the start, the last tick at the
  end, every tick on the fill edge of its value. The first and last label are flush with the bar ends. State and lock
  keep the handle track, so labels and ticks stay under the handle positions.

### Fixed

- Scale ticks in value, counter, timer and clock sat half a handle inside the bar and missed the fill edge, except with
  `handle_overhang`.

## [0.4.1] - 2026-11-16

### Added

- Option `bar_state_color` (default `false`): `true` colors the whole bar in the color of the current state
  (`states[].color`), not only the fill. A state without a color keeps `bar_color` or the theme default. With the option
  on, bar and fill share the color, so only the handle shows the position.
- Visual editor switch for `bar_state_color`; English and German texts.

### Changed

- Internal cleanup of the outside scale code (shared tick track margin, grouped padding rules, one helper for tick
  markup). No visible change.
- Visual editor shows `inside` in the scale placement fields while the scale is on; the value is still not stored.

### Fixed

- Thin bars (small `handle_size` or `thickness`): the handle value was cut with `...`. Its text size and side padding
  now shrink with the handle width (45 % of it; the 40 px default handle keeps 14 px). Very short values on very small
  handles can still be cut.
- Outside scale, horizontal card: a label size or tick length set in `styles:` (`--slabton-scale-label-size`,
  `--slabton-scale-size`, in `px`) now counts in the card height. Before, only `text.scale.font_size` and `scale.size`
  counted.

## [0.4.0] - 2026-11-16

### Added

- Unavailable or unknown entity: the handle shows a warning icon (`mdi:alert-circle-outline`, color
  `--slabton-unavailable-color`). The reason (entity not found, unavailable, unknown state, no usable value) is in the
  card tooltip and in `aria-valuetext`; English and German texts.
- Option `allow_unavailable_actions` (default `false`): in mode `state`, tap, hold, double tap, drag and arrow keys keep
  working while the entity is unavailable. Other modes ignore it with a warning; lock stays blocked on purpose.
- Visual editor switch for `allow_unavailable_actions` in state mode.
- `scale.labels_placement`: `inside` (default) or `outside`. Outside, the labels stand next to the bar on the side
  `scale.position` points to and need no minimum bar thickness.
- `scale.ticks_placement`: `inside` (default), `outside` (ticks between bar and labels) or `none` (labels only, needs
  `labels: true`).
- Visual editor fields for both options; English and German texts.
- Docs site and preview: examples with labels and ticks outside the bar.

### Changed

- Unavailable card: tap opens more-info of the entity instead of doing nothing. The handle stays focusable (Enter /
  Space opens more-info). Hold, double tap, drag and arrow keys stay blocked.
- Select, input select and climate entities without their option list (`options` / `hvac_modes`) offer no states
  instead of `off` / `on`.
- Visual editor shows hint lines under the form for values the card ignores or clamps: color values it rejects,
  `step` of 0 or below `1e-9`, `scale.size` above the bar thickness or below 2. Typed values stay as entered; a
  `scale.size` above the bar is set to the new thickness when `thickness` is lowered.
- Sections and masonry layouts reserve rows and card size from the card's real height need (bar, handle and, vertically,
  the handle overhang along the bar), not from the handle's rounded-up excess. Cards with a thin bar and a handle slightly
  larger than the bar can get one row less; masonry cards with a large handle on a thin bar can get smaller.
- Horizontal cards reserve height for scale labels and ticks outside the bar (label font size plus 3 px, tick length for
  outside ticks). Vertical cards do not reserve width for them yet.

### Fixed

- Unavailable select, input select or climate entity no longer gets `select_option` / `set_hvac_mode` calls with
  invented `off` / `on` values.
- A drag that ends after the entity became unavailable no longer sends a service call.
- Visual editor no longer writes the default `clock.face.ticks: true` into the configuration after a change; `ticks: false`
  is kept.
- Scale labels with their own `bar.entity` and no `min` / `max` show that entity's range instead of 0 to 100. The labels
  keep their last text while the entity is unavailable. Labels also appear when the main entity is `input_number` and the
  bar entity is a sensor.
- Value mode: a tiny `step` (e.g. `1e-101`) or tiny `min` no longer throws a `RangeError` that freezes the handle. Steps
  below `1e-9` are ignored with a warning.
- `styles:` values `NaN` and `Infinity` are dropped with a warning.
- Switches on a bar thinner than 28 px no longer stick out of the bar; they follow the bar height. Default size unchanged.
- Value mode: a handle that cannot be dragged no longer blocks touch scrolling.
- Visual editor: the `drag` switch is hidden for sensors and for entities with their own `bar.entity`; `step` no longer
  accepts 0.
- Sections: a handle slightly larger than a thin bar (e.g. `thickness: 18`, `handle_size: 42`) no longer takes one row
  too many.
- Vertical card with `handle_overhang`: the overhang along the bar counts for the rows and the masonry size now; before,
  a large handle could run out of the space the card reserved.
- Docs site, live demo: the card shows the new state after a tap, drag or hold (it no longer stays on the old value);
  counter examples stop at their minimum and maximum; on narrow screens the card sits above the YAML editor.
- Docs site, installation (EN, DE): the German page had two `# Installation` headings; the resource snippet is a code
  block with a copy button now. The HACS section says that dashboards in YAML mode need the resource by hand
  (`/hacsfiles/slABton/slabton.js`).
- Docs site footer: the slABton logo was far too large (the theme ignored its `height` attribute); it is 36 px high now.

## [0.3.0] - 2026-11-14

### Added

- `text:` block for the card texts: font size and color per area `header`, `bar` (bar text), `info` (timer
  extra text) and `button` (handle text); `header` also has `icon_color` for the header icon. Defaults unchanged
  (14 / 13 / 13 / 14 px). Sizes from 8 to 48 px, invalid values are ignored with a console warning.
- Visual editor section "Appearance" / "Darstellung" for the `text:` block.
- CSS variables `--slabton-header-size`, `--slabton-header-color`, `--slabton-header-icon-color`,
  `--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
  `--slabton-button-size`, `--slabton-button-color`.
- English and German texts for the new editor fields.
- Mode `value` on `input_number` / `number` is draggable: drag the handle or press the arrow keys to set the value.
  `<domain>.set_value` is called on release, and only when the value changes. Range from `min` / `max`, else the
  entity's `min` / `max` attributes. Step from the new `step` option (also `bar.step`), else the entity's `step`
  attribute, else stepless. `drag: false` turns it off. Sensors stay read-only.
- Visual editor: `drag` switch and `step` field in value mode.
- `scale:` block: tick marks across the bar, under the handle. Options `ticks` (segments, 1 to 100), `position`
  (`top` / `bottom` or `left` / `right`; `start` / `center` / `end` also work), `size` (tick length in px, up to the bar
  thickness) and `color`. `scale: true` takes the defaults. Clock mode gets one tick per hour (24, or 12 with
  `clock.hour_format: "12"`).
- Visual editor section "Scale" / "Skala" with a "Show scale" switch; English and German texts.
- CSS variables `--slabton-scale-size` and `--slabton-scale-color`.
- `clock.display: analog`: analog dial in the handle with hour and minute hands; `clock.seconds` adds the second hand.
  Needs `handle_content: text` and `handle_size` of at least 32 px, otherwise the clock stays digital with a warning.
- `clock.face` (analog only): `numbers` (`none` default, `quarters`, `all`) and `ticks` (`true` default). Numbers need
  `handle_size` of at least 48 px (`quarters`) or 72 px (`all`); a smaller handle steps down one level with a warning.
- `scale.labels: true`: labels at the scale ticks. Clock: hours 0, 6, 12, 18, 24. Value and counter: minimum and maximum
  (needs a fixed range). State: names of the configured `states` (at least two). Needs a bar thickness of 28 px.
- `text:` area `scale` (`font_size`, `color`) for the scale labels; CSS variables `--slabton-scale-label-size` and
  `--slabton-scale-label-color`.
- CSS variables `--slabton-dial-color`, `--slabton-hands-color`, `--slabton-second-hand-color` for the analog dial.
- Visual editor: `analog` in the clock display, section "Dial" / "Zifferblatt (analog)", switch for scale labels.

### Changed

- `clock.display: analog` is no longer reserved; it renders the dial (see Added).
- License changed from MIT to MPL 2.0 (`LICENSE`, `package.json`, READMEs).
- Source split into `src/core` (no DOM: config, constants, time, placeholders, i18n, pulse, modes) and
  `src/ui` (card, render, styles, interaction, editor, animations). No visible change.
- Translations moved to `src/core/locales/en.json` and `de.json`, one file per language.
- Timer pulse logic moved to `src/core/pulse.js`; `timer.sample()` split into smaller functions;
  constants for timer status, source and notices; small clean-ups (time zone guess, clock display list,
  numeric state parsing).
- Mode `value` is read-only only for `sensor`; `input_number` and `number` can be set (see Added).
- Held arrow keys no longer repeat: one key press is one step, in all modes.
- `scale` is no longer a reserved name (reserved now: `thresholds`, `shape`, `control`). A `scale` value that is neither
  `true`, `false` nor a map is a configuration error; it used to be ignored with a warning.

### Fixed

- Handle larger than the bar (`handle_size` above `thickness`): the card reserves room for the handle on both sides,
  across and along the bar, in all modes. Sections and masonry layouts get extra rows or size for it. Handles that
  fit the bar keep the old layout.

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

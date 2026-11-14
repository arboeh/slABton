# slABton

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![License: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider button bar card for Home Assistant: a bar with a movable handle button.
Switch through several states, swipe to lock / unlock, or show a value.

[Deutsche Version](README.de.md)

> Status: pre-release, private repository (no HACS release yet).

## Features

- Handle shapes: round (default), oval, square
- Handle position: `flex` (follows value), `fixed`, `switch`, `start`, `mid`, `end`
- Horizontal and vertical, `ltr` and `rtl`
- Modes: `state`, `lock`, `value` (presets thermometer, energy, soc), `counter`, `timer`, `clock`
- Analog clock: dial with hour, minute and second hand in the handle (`clock.display: analog`)
- Timer: Home Assistant `timer.*` or countdown to an `input_datetime` / `input_date`, pulse on expiry, time zones
- Text in the bar (`bar_text`) with simple placeholders, no templates
- Bar value from a separate entity (`bar:`)
- Tick scale in the bar (`scale:`): ticks, position, size, color, labels; hourly ticks in clock mode
- Value mode on `input_number` / `number`: drag or arrow keys set the value (`step`, `drag: false`)
- Font size and color of the texts (`text:`)
- English and German texts, language follows Home Assistant
- Tap, double tap and hold actions
- Icon per state, position number or text in the handle
- Optional separate switches at start, mid, end
- Header and header icon
- Animations: `none`, `slide`, `fade`, `pulse`, `shimmer` (respects reduced motion)
- Theme aware, colors and CSS variables overridable
- Visual editor

## Installation

### HACS (custom repository)

1. HACS, three-dot menu, **Custom repositories**.
2. Add `https://github.com/arboeh/slABton`, type **Dashboard**.
3. Install **slABton**, reload the browser.

### Manual

1. Copy `dist/slabton.js` to `/config/www/slabton.js`.
2. Add a dashboard resource: URL `/local/slabton.js`, type **JavaScript module**.

## Configuration

Minimal:

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
```

The mode is derived from the entity domain: `lock` / `alarm_control_panel` give `lock`,
`sensor` / `number` / `input_number` give `value`, `counter` gives `counter`, `timer` gives `timer`,
everything else gives `state`. `input_datetime` / `input_date` and `clock` need an explicit `mode:`.

> Changed in this release: `counter.*` and `timer.*` entities used to fall into `state` mode.
> Set `mode: state` to keep the old behavior.

### General options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required (not for `clock`) | Entity id |
| `mode` | by domain | `state`, `lock`, `value`, `counter`, `timer`, `clock` |
| `bar` | none | Bar value separate from the button, see [Bar value](#bar-value) |
| `bar_text` | none | Text in the bar with [placeholders](#placeholders) |
| `name` | none | Header text |
| `icon` | by mode | Header and handle icon |
| `header_position` | `top` | `top`, `bottom`, `none` |
| `header_icon_position` | `left` | `left` (like the Tile card), `right` |
| `orientation` | `horizontal` | `horizontal`, `vertical` |
| `direction` | `ltr` | `ltr`, `rtl` |
| `length` | 0 | Bar length in px (0 = full width; vertical default 160) |
| `thickness` | 48 | Bar thickness in px (12 to 200) |
| `handle_size` | 40 | Handle size in px |
| `handle_shape` | `round` | `round`, `oval`, `square` |
| `handle_position` | `flex` | `flex`, `fixed`, `switch`, `start`, `mid`, `end` |
| `fixed_position` | 50 | Position in % for `fixed` |
| `handle_overhang` | `false` | Handle centre travels edge to edge and sticks out at both ends; fill is empty at 0 and full at 100 |
| `handle_content` | `icon` (`text` in `value`, `counter`, `timer`, `clock`) | `icon`, `position`, `text`, `none` |
| `border_width` | 0 | Bar border in px |
| `border_radius` | auto | Bar corner radius in px |
| `animation` | `slide` | `none`, `slide`, `fade`, `pulse`, `shimmer` |
| `bar_color`, `fill_color`, `handle_color`, `text_color`, `border_color` | theme | CSS colors |
| `styles` | none | Map of CSS variables, see [Styling](#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | by mode | HA actions plus `cycle`, `cycle_back` |
| `switches` | none | `start`, `mid`, `end`, each with `entity`, `icon`, `name`, actions |
| `text` | defaults | Font size and color per text area, see [Text appearance](#text-appearance) |
| `scale` | none | Tick marks in the bar, see [Scale](#scale) |

`call-service` (with `service` / `service_data`) is accepted as a deprecated alias of `perform-action` and may be removed in a later version.

### Mode `state`

Click cycles through the states. Dragging snaps to the nearest state.
States come from `states:`, else from the entity (`options`, `hvac_modes`), else `off` / `on`.

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
name: Heating
states:
  - { value: "Off", icon: mdi:power }
  - { value: "Auto", icon: mdi:calendar-clock }
  - { value: "On", icon: mdi:fire }
  - { value: "Idle", icon: mdi:sleep }
hold_reverse: true
```

Handle sticking out at both ends (fill is empty at the first state, full at the last):

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
handle_overhang: true
```

| Option | Default | Description |
| --- | --- | --- |
| `states` | from entity | List of `value`, `label`, `icon`, `text`, `color` |
| `hold_reverse` | `false` | Hold steps backwards |
| `drag` | `true` | Allow dragging (only with `handle_position: flex`) |

### Mode `lock`

Swipe the handle across the bar to unlock or lock.

```yaml
type: custom:slabton-card
entity: alarm_control_panel.house
mode: lock
arm_service: alarm_arm_home
swipe_threshold: 85
```

| Option | Default | Description |
| --- | --- | --- |
| `swipe_threshold` | 85 | Swipe distance in % (30 to 100) |
| `unlock_action`, `lock_action` | by domain | Override the called action |
| `arm_service` | `alarm_arm_away` | Arm service for alarm panels |

Alarm panels that require a code to arm or disarm are not supported: the swipe sends no
code and the service call fails (see the browser console). Codes must not be stored in the card config.

Arrow keys do not lock or unlock in this mode, so a stray key press cannot open a door.

Swipe to lock / unlock is a convenience gesture, **not a security boundary**.
Do not store alarm codes in the config. See [SECURITY.md](SECURITY.md).

### Mode `value`

The bar fills by value, the value shows in the handle. For `input_number` and `number` the handle can be dragged or moved with the arrow keys; the card calls `<domain>.set_value` on release, not while dragging. `sensor` stays read-only.

```yaml
type: custom:slabton-card
entity: sensor.living_room_temperature
mode: value
preset: thermometer
```

| Option | Default | Description |
| --- | --- | --- |
| `preset` | `none` | `thermometer` (-10 to 40, °C), `energy` (0 to 5000, W), `soc` (0 to 100, %) |
| `min`, `max` | preset or 0 / 100 | Value range. Without them, `input_number` / `number` use the entity's `min` / `max` attributes |
| `unit` | preset | Unit text |
| `decimals` | preset or 1 | Decimal places |
| `step` | entity `step` attribute | Step size (also `bar.step`); without any step the value is only rounded to `decimals` |
| `drag` | `true` | Dragging and arrow keys for `input_number` / `number`. `false` turns them off. No dragging with `handle_position` other than `flex`, with a separate `bar.entity`, or when max is not greater than min |

Arrow keys move the value one step (without a step: 1 % of the range). A range with max not greater than min leaves the bar empty, logs a console warning and disables dragging.

### Mode `counter`

Shows a `counter.*` entity. The bar fills between the minimum and maximum.
Tap adds one, double tap subtracts one (`counter.increment` / `counter.decrement`).
There is no default reset; add `hold_action: {action: perform-action, perform_action: counter.reset, target: {entity_id: counter.guests}}` if you want one.

```yaml
type: custom:slabton-card
entity: counter.guests
name: Guests
bar_text: "{value} of 10"
counter:
  max: 10
```

| Option | Default | Description |
| --- | --- | --- |
| `counter.min`, `counter.max` | see below | Range of the bar |

Range priority: `counter.min/max`, then `bar.min/max` (or flat `min` / `max`), then the entity
attributes `minimum` / `maximum`, then 0 / 100. Dragging the handle to set a value is not supported yet.

### Mode `timer`

Two sources:

- **`timer.*`** (Home Assistant timer, shared by all devices). The bar drains from the full duration to zero.
  Tap starts, or pauses a running timer. Hold cancels.
- **`input_datetime.*` with a date, or `input_date.*`** (set `mode: timer`): countdown to that point in time.
  The bar is full from `timer.span` days left and drains to the target. Tap opens more-info.
  An `input_datetime` with time only is not supported (shown as `–` with a console warning).

```yaml
type: custom:slabton-card
entity: timer.sauna
name: Sauna
bar_text: "{remaining_text} left"
timer:
  info: "ends {target}"
```

Countdown to a date:

```yaml
type: custom:slabton-card
entity: input_datetime.shooting_festival
mode: timer
name: Shooting festival
bar_text: "{remaining_text} to go"
timer:
  time_zone: Europe/Berlin
  span: 60
```

| Option | Default | Description |
| --- | --- | --- |
| `timer.pulse` | `true` | Pulse the bar when the timer runs out or the target is reached |
| `timer.pulse_seconds` | 10 | How long it pulses; `0` = until you tap the card |
| `timer.info` | none | Extra text with [placeholders](#placeholders): beside the handle (horizontal), above the bar (vertical) |
| `timer.time_zone` | Home Assistant | Zone used to read `input_datetime` / `input_date` (IANA name) |
| `timer.span` | 30 | Countdown to a date: days left at which the bar is full |

The pulse only starts when the card sees the timer run out (or Home Assistant report its end).
Cancelling a timer early and opening the dashboard after the end do not pulse. A tap while it pulses only
ends the pulse. With reduced motion the bar gets a static highlight instead of the animation.
The display ticks once per second in the browser, only while the card is on screen and the tab is visible;
the tick never calls a service. Timer end times come from the server clock: if the browser clock differs,
the display can be off by that difference.

Daylight saving time: a date and time that does not exist (spring forward) is shifted past the gap, one
that exists twice (autumn) means the later time. Unknown time zone names are a configuration error.

### Mode `clock`

Clock, no entity needed. The handle shows the time (digital) or a dial (analog), the bar fills with the progress of the day.

```yaml
type: custom:slabton-card
mode: clock
name: Berlin
clock:
  time_zone: Europe/Berlin
  hour_format: 24
  seconds: true
```

| Option | Default | Description |
| --- | --- | --- |
| `clock.display` | `digital` | `digital` (text) or `analog` (dial in the handle, see below). `analog` needs `handle_content: text` and `handle_size` of at least 32; otherwise `digital` with a warning |
| `clock.time_zone` | Home Assistant | IANA name, e.g. `America/New_York` |
| `clock.hour_format` | `auto` | `auto` (language default), `12`, `24` |
| `clock.seconds` | `false` | Show seconds; with `analog` also the second hand |
| `clock.face.numbers` | `none` | `none`, `quarters` (12, 3, 6, 9) or `all` (1 to 12). Analog only. Needs `handle_size` 48 (`quarters`) or 72 (`all`); a smaller handle steps down one level with a warning |
| `clock.face.ticks` | `true` | Tick marks at the edge of the dial. Analog only |

Analog dial: the handle shows a dial with hour and minute hands; `clock.seconds` adds a second hand. The hands
jump once per second (only the `transform` changes, no animation). Colors: see [Styling](#styling).

```yaml
type: custom:slabton-card
mode: clock
thickness: 56
handle_size: 64
clock:
  display: analog
  seconds: true
  face:
    numbers: quarters
```

### Bar value

By default the bar shows the same entity as the button. The `bar:` block separates them: the bar
shows a numeric entity, the handle stays with `entity`.

```yaml
type: custom:slabton-card
entity: timer.sauna
bar:
  entity: sensor.sauna_temperature
  min: 20
  max: 100
  unit: "°C"
  decimals: 0
bar_text: "{value}"
```

`bar` accepts `entity`, `min`, `max`, `unit`, `decimals`, `preset`, `step`. The flat options (`min`, `max`, `unit`,
`decimals`, `preset` at the top level) stay as an alias of `bar.*`; if both are set, `bar:` wins and a
warning is logged. Without `bar.entity` the bar follows `entity` as before. `{value}` is then the bar value.

### Placeholders

`bar_text` and `timer.info` take text with placeholders in single curly braces. This is **not** a template
language: no Jinja, no expressions, no HTML. Text is always shown as plain text. A name the mode does
not offer stays as written and logs a warning; an offered name without a value shows `–`.

| Placeholder | Modes | Meaning |
| --- | --- | --- |
| `{name}` | all | `name`, else the entity's friendly name |
| `{state}` | all | Entity state; for timers a translated status (Ready, Running, Paused, Expired) |
| `{value}` | all | Shown value (counter value, bar value, remaining time, time) |
| `{remaining}` | timer | `4:59`, `1:05:00`, or `3 d` from one day on |
| `{remaining_text}` | timer | Largest unit, translated: `3 days`, `2 hours`, `5 minutes` |
| `{days}`, `{hours}`, `{minutes}`, `{seconds}` | timer | Components of the remaining time (not totals) |
| `{elapsed}` | timer | HA timer: elapsed time |
| `{target}` | timer | End time, localized date (and time) |
| `{time}` | clock | Time of day |

Texts are limited to 200 characters.

### Text appearance

The `text:` block sets font size and color of five areas. Without it nothing changes.

```yaml
type: custom:slabton-card
entity: timer.sauna
name: Sauna
bar_text: "{remaining_text} left"
timer:
  info: "ends {target}"
text:
  header: { font_size: 16, color: "#ff9800", icon_color: "#2196f3" }
  bar:    { font_size: 12, color: var(--secondary-text-color) }
  info:   { font_size: 11, color: grey }
  button: { font_size: 18, color: white }
```

| Area | Option | Default | Applies to |
| --- | --- | --- | --- |
| `header` | `font_size` | 14 px | Header text (title) |
| `header` | `color` | text color | Header text only; the icon is not affected |
| `header` | `icon_color` | text color | Header icon only |
| `bar` | `font_size` | 13 px | `bar_text` |
| `bar` | `color` | text color | `bar_text` |
| `info` | `font_size` | 13 px | `timer.info` (timer extra text) |
| `info` | `color` | text color | `timer.info` |
| `button` | `font_size` | 14 px | Handle text (`handle_content: text`, `position`) |
| `button` | `color` | text color | Whole handle content, including the handle icon |
| `scale` | `font_size` | 10 px | Labels at the scale ticks (`scale.labels`) |
| `scale` | `color` | text color | Labels at the scale ticks (`scale.labels`) |

- `font_size`: number from 8 to 48 (px), or decimal text such as `"12"`. Other values are ignored with a console warning.
- `color`: any CSS color accepted by `styles:`. Unsafe values are ignored with a console warning.
- `icon_color` exists only in `header`. Other unknown keys are ignored with a warning.
- Priority: `text:` beats `styles:`, `styles:` beats the default. Invalid values do not stop the card; the other values still apply.
- `button.font_size` sets only the handle text; the handle icon follows `handle_size`. `button.color` also colors the icon.
- Large sizes are cut off: bar text, timer info and handle text have `overflow: hidden`. Check the result on the dashboard.

### Scale

Tick marks across the bar, drawn under the handle. Without `scale:` nothing is drawn.

```yaml
type: custom:slabton-card
entity: sensor.battery_soc
preset: soc
scale:
  ticks: 5
  position: top
  size: 10
  color: "#888"
```

| Option | Default | Description |
| --- | --- | --- |
| `ticks` | 10 (clock: 24) | Segments, 1 to 100. The scale draws one tick more than segments, one at each end |
| `position` | `bottom` (vertical: `right`) | Edge across the bar: `top` / `bottom` (horizontal) or `left` / `right` (vertical). `start`, `center`, `end` also work: `start` is top or left, `end` bottom or right |
| `size` | 8 px | Tick length in px, 2 up to the bar `thickness` |
| `color` | text color at 45 % | Any CSS color that `styles:` accepts |
| `labels` | `false` | Labels at the ticks. Clock: hours 0, 6, 12, 18, 24. Value and counter: minimum and maximum, only with a fixed range (`min` and `max`, or `counter`). State: names of the configured `states` (at least two). Needs a bar thickness of 28 px; otherwise no labels, with a warning |

- `scale: true` takes all defaults. `scale: false` or a missing block means off.
- Ticks sit on the handle's travel: the tick for value i/ticks is exactly under the handle at that value. `direction: rtl` mirrors them.
- Clock: one tick per hour (24). With `clock.hour_format: "12"` there are 12 ticks, two hours apart. `auto` gives 24 ticks even in a 12-hour locale. An explicit `ticks` wins over both.
- Invalid values are ignored with a console warning and the default applies. Unknown keys are warned about and ignored.
- The key `enabled` exists only as the editor switch. In YAML it is warned about and ignored.
- Not drawn yet: hour / minute hands on the scale. Planned for later releases. The analog clock's hands sit in the handle (`clock.display: analog`).
- Known limits of `scale.labels`: with a separate `bar.entity` the labels of value mode use the configured `min` and `max` (or 0 and 100), not the range of the bar entity; set `min` and `max` yourself. State names need `states` in the config (options of the entity are not used). Long names or a large `scale.size` can overlap on thin bars.
- Visual editor, analog clock: once any field is changed the editor stores `clock.face.ticks: true` (the default value).
- Visual editor: section "Scale" with a "Show scale" switch. Switching it off removes all scale options; switching it on again starts with the defaults.

## Languages

Texts (editor labels, timer status, units) are English or German, taken from the Home Assistant
language of the user. Other languages fall back to English. Config errors and console warnings stay English.

## Reserved names

`thresholds`, `shape` and `control` are reserved for later releases. They are accepted, ignored
and logged with a warning. Several bars or buttons in one card (`bars:`) are not part of the schema.

## Styling

Layout and colors use CSS variables on the card. Set them with `styles:` (keys without
`--slabton-` prefix get it added) or with card-mod.

```yaml
styles:
  bar-color: "#263238"
  fill-color: "#ff9800"
  switch-size: 32px
```

Values are checked; unsafe values are ignored with a console warning.

The [`text:` block](#text-appearance) sets these variables. `styles:` can set them too, but a `text:` value wins over `styles:`:
`--slabton-header-size`, `--slabton-header-color`, `--slabton-header-icon-color`,
`--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
`--slabton-button-size`, `--slabton-button-color`. Size defaults: header 14 px, bar 13 px, info 13 px, button 14 px.

Scale: `--slabton-scale-size` and `--slabton-scale-color` are set by `scale.size` and `scale.color`; `styles:` can override them.
Scale labels: `--slabton-scale-label-size` and `--slabton-scale-label-color` (set by `text.scale`).
Analog dial: `--slabton-dial-color` (ticks and numbers), `--slabton-hands-color` (hour and minute hand, hub) and
`--slabton-second-hand-color` (default: primary color).

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` is the only release file. `npm run check-version` compares
`package.json` and `src/version.js`.

Source layout: `src/core/` has no DOM access (config, constants, time, placeholders, i18n, pulse and the
modes in `modes/`). `src/ui/` holds the card, render, styles, interaction, editor and animations.
`core` never imports from `ui`. Tests mirror this layout in `tests/core` and `tests/ui`.

Texts live in `src/core/locales/<language>.json`. To add a language, copy `en.json`, translate the values,
keep keys and `{placeholders}`, and register the file in `src/core/i18n.js`. `tests/core/locales.test.js`
checks that every language has the same keys and placeholders as English.

## Roadmap

Planned as separate follow-ups: setting a counter by dragging; thresholds with color change;
card lock; circle and 3/4 circle; multiple bars and handles; select dropdown; hour and minute hands on the scale; other calendars.

## License

[Mozilla Public License 2.0](LICENSE) (MPL-2.0)

# slABton

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
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
- Timer: Home Assistant `timer.*` or countdown to an `input_datetime` / `input_date`, pulse on expiry, time zones
- Text in the bar (`bar_text`) with simple placeholders, no templates
- Bar value from a separate entity (`bar:`)
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

Read-only. The bar fills by value, the value shows in the handle.

```yaml
type: custom:slabton-card
entity: sensor.living_room_temperature
mode: value
preset: thermometer
```

| Option | Default | Description |
| --- | --- | --- |
| `preset` | `none` | `thermometer` (-10 to 40, °C), `energy` (0 to 5000, W), `soc` (0 to 100, %) |
| `min`, `max` | preset or 0 / 100 | Value range |
| `unit` | preset | Unit text |
| `decimals` | preset or 1 | Decimal places |

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

Digital clock, no entity needed. The handle shows the time, the bar fills with the progress of the day.

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
| `clock.display` | `digital` | `analog` is reserved for a later release and shown as `digital` with a warning |
| `clock.time_zone` | Home Assistant | IANA name, e.g. `America/New_York` |
| `clock.hour_format` | `auto` | `auto` (language default), `12`, `24` |
| `clock.seconds` | `false` | Show seconds |

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

`bar` accepts `entity`, `min`, `max`, `unit`, `decimals`, `preset`. The flat options (`min`, `max`, `unit`,
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

## Languages

Texts (editor labels, timer status, units) are English or German, taken from the Home Assistant
language of the user. Other languages fall back to English. Config errors and console warnings stay English.

## Reserved names

`thresholds`, `scale`, `shape` and `control` are reserved for later releases. They are accepted, ignored
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

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` is the only release file. `npm run check-version` compares
`package.json` and `src/version.js`.

## Roadmap

Planned as separate follow-ups: setting a counter by dragging; thresholds with color change;
card lock; circle and 3/4 circle; multiple bars and handles; select dropdown; analog clock; other calendars.

## License

MIT

# slABton

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider button bar card for Home Assistant: a bar with a movable handle button.
Switch through several states, swipe to lock / unlock, or show a value.

[Deutsche Version](README.de.md)

> Status: 0.1.0, not yet published. The repository has no remote yet.

## Features

- Handle shapes: round (default), oval, square
- Handle position: `flex` (follows value), `fixed`, `switch`, `start`, `mid`, `end`
- Horizontal and vertical, `ltr` and `rtl`
- Modes: `state`, `lock`, `value` (presets thermometer, energy, soc)
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
`sensor` / `number` / `input_number` give `value`, everything else gives `state`.

### General options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Entity id |
| `mode` | by domain | `state`, `lock`, `value` |
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
| `handle_content` | `icon` (`text` in value mode) | `icon`, `position`, `text`, `none` |
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

Planned as separate follow-ups: modes `counter`, `timer`, `clock`; thresholds with color change;
card lock; circle and 3/4 circle; multiple bars and handles; analog and digital designs.

## License

MIT

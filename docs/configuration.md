# Configuration

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

## Quick start in the visual editor

A card that is not set up yet (only `type`, `entity` and `name`) shows a **Quick start** above the form in the visual
editor: tiles with a live preview, each with a short text. Pick one and the editor fills in the options for you:

| Tile | Question | Result |
| --- | --- | --- |
| None | none | Closes the quick start, the config stays as it is |
| Clock | none | `mode: clock` |
| Timer | a `timer.*` entity | `entity`, `mode: timer` |
| Lock | a `lock.*` or `alarm_control_panel.*` entity | `entity`, `mode: lock` |
| Thermometer | a temperature `sensor.*` | `entity`, `mode: value`, `preset: thermometer` |
| Thermostat | a `climate.*` entity | `entity`, `bar.attribute: current_temperature`, `bar.unit: "°C"`, `bar_text: "{value}"`; the mode stays `state` |
| Shutter | a `cover.*` entity | `entity`, `mode: value`, `orientation: vertical`, `thickness: 64`, `bar.segments` (10 slats, grey closed, blue open) |
| Battery | a battery `sensor.*` (`device_class: battery`) | `entity`, `mode: value`, `preset: soc` |

- The result is a normal config: every option stays editable in the form and in the code editor, nothing refers back to the tile.
- A tile **replaces** the options of the card (Home Assistant's own keys such as `grid_options` and `visibility` stay). Home Assistant has no undo in the editor, so pick "None" if the card is already what you want.
- The quick start is only in the visual editor, not in YAML. It is not the same as `preset:`, which only sets range defaults for the `value` mode (shown as "Value profile" in the visual editor).
- Once the card has any other option, the quick start no longer shows.
- **Thermostat** only reads the measured temperature (read-only bar, the handle keeps its normal actions). The range comes from `min_temp` / `max_temp` of the entity.
- **Shutter** lists every `cover.*`, not only shutters: a garage door or gate shows up too, and a tap switches it without asking. Choose the entity with care.
- **Battery** lists only sensors with `device_class: battery`. A home battery that does not report it is missing from the list: pick "None" and set `preset: soc` yourself. The tile shows the level only; there is no charging animation yet.

## General options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required (not for `clock`) | Entity id |
| `mode` | by domain | `state`, `lock`, `value`, `counter`, `timer`, `clock` |
| `bar` | none | Bar value separate from the button, also from an attribute (`bar.attribute`), see [Bar value](appearance.md#bar-value); `bar.segments` cuts the bar into segments, see [Segmented bar](appearance.md#segmented-bar) |
| `bar_text` | none | Text in the bar with [placeholders](appearance.md#placeholders) |
| `name` | none | Header text |
| `icon` | by mode | Header and handle icon |
| `header_position` | `top` | `top`, `bottom`, `none` |
| `header_icon_position` | `left` | `left` (like the Tile card), `right`, `none` (no icon in the header, the name stays) |
| `header_align` | `start` | `start`, `center`, `end`: where icon and name sit in the header line |
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
| `bar_state_color` | `false` | `true` colors the whole bar in the color of the current state (`states[].color`), see [State color](appearance.md#state-color) |
| `styles` | none | Map of CSS variables, see [Styling](appearance.md#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | by mode | HA actions plus `cycle`, `cycle_back` |
| `switches` | none | `start`, `mid`, `end`, each with `entity`, `icon`, `name`, `states`, actions, see [Switch states](#switch-states-and-handle-zones) |
| `handle_zones` | none | `start`, `mid`, `end`, each with own actions, `entity`, `icon`, `states` for the handle |
| `text` | defaults | Font size and color per text area, see [Text appearance](appearance.md#text-appearance) |
| `scale` | none | Tick marks and labels, each inside or outside the bar, see [Scale](appearance.md#scale) |

A `cover` entity runs in the `value` mode without further options: drag sets the position, tap toggles, hold stops, see [Covers](modes.md#covers).

`call-service` (with `service` / `service_data`) is accepted as a deprecated alias of `perform-action` and may be removed in a later version.

## Switch states and handle zones

`switches.<slot>` (`start`, `mid`, `end`) can show the state of its own entity. Each entry in `states` has a `value` (the entity state), an `icon`, a `color` for the icon (CSS color or `var(--…)`) and an optional `label` that replaces `name` as the accessible label. Without a match (also `unavailable` / `unknown`) the switch keeps its `icon` and has no color.

```yaml
type: custom:slabton-card
entity: cover.living_room
name: Living room shutter
switches:
  end:
    entity: sensor.cover_living_room_mode
    icon: mdi:calendar-clock
    name: Auto / Stop
    tap_action:
      action: perform-action
      perform_action: script.cover_living_room_toggle_auto
    states:
      - { value: auto, icon: mdi:calendar-clock, color: green }
      - { value: heat_protection, icon: mdi:weather-sunny, color: orange }
      - { value: nap, icon: mdi:sleep, color: blue }
      - { value: "off", icon: mdi:power, color: grey, label: Auto off }
```

`handle_zones` splits the handle position into thirds: `start` below a third, `mid` up to two thirds, `end` above. This is the same in every mode. The position is the logical one, so with `direction: rtl` `start` is visually on the right. Each zone can have `tap_action`, `double_tap_action` and `hold_action` of its own (without an entry the card action or the mode default applies), plus `entity`, `icon` and `states` for the handle icon. A zone action runs on the zone `entity` if there is one. The zone `icon` and `states` need `handle_content: icon`; the icon color is not used for the warning icon.

```yaml
handle_content: icon
handle_zones:
  start:
    entity: sensor.cover_living_room_mode
    hold_action:
      action: perform-action
      perform_action: script.cover_living_room_pause_auto
    states:
      - { value: auto, icon: mdi:calendar-clock, color: green }
      - { value: "off", icon: mdi:power, color: grey }
```

## Unavailable entities

While the entity is `unavailable` or `unknown`, the handle shows a warning icon. The reason is in the tooltip and for
screen readers. The card is locked: a tap opens more-info, gestures and arrow keys do nothing.

- `allow_unavailable_actions: true` (mode `state` only, default `false`) keeps tap, hold, double tap, drag and arrow
  keys active. Lock mode stays locked on purpose; other modes ignore the option with a warning.
- The lock covers `cycle`, `cycle_back` and `toggle` on the main entity. A `perform-action` you configure yourself is
  not blocked, even when it targets the main entity.
- With the option on, a tap on a toggle entity (`switch`, `light`, ...) in an unknown state sends `off` first (the
  first state of the cycle). A `select` without its option list sends nothing.
- The handle stays focusable while locked (`aria-disabled="true"`) so Enter / Space can open more-info.
- Template entities: keep `availability` independent of optional helper entities. A missing helper locks the card.

## Size in sections view

The card takes 6 columns horizontal (3 vertical; a vertical card with a wider handle takes more, for example 4 for `handle_size: 120`) and sets no fixed number of rows: the height follows the content
(`rows: "auto"`). Older dashboards may still fix the height and must drop it:

- `card_mod` with a fixed height, for example `ha-card { height: 122px; }`: remove it. A fixed height cuts off
  content that grows (labels, ticks, a larger handle).
- `grid_options: rows: <number>` in the card config: remove it for the same reason.
- `grid_options: columns: ...` (and the other keys) still override the card's defaults, key by key. Use it to widen the
  card, for example `columns: 12` for the full width.

## Stickshift actions

With [`stickshift:`](modes.md#stickshift) every entry of `states` can have its own `tap_action`, `double_tap_action` and
`hold_action`. They use the same action syntax as the card, and an action can name its own `entity`, independent of the main entity
(the same way as for the handle zones above):

```yaml
type: custom:slabton-card
entity: input_select.charge_mode
stickshift: true
states:
  - { value: "Stop", icon: mdi:stop }
  - value: "Auto"
    icon: mdi:flash-auto
    tap_action: { action: toggle, entity: switch.charger }
  - value: "Boost"
    icon: mdi:flash
    hold_action: { action: more-info, entity: sensor.charger_power }
```

The `tap_action` of a point runs after the state change that lands on it (tap on the point, drag, arrow key). A tap on the active
point runs only its action; double tap and hold only work on the active point and never change the state. Without
`stickshift:` these keys of a state are ignored.

A point can also show the state of an entity of its own, like a handle zone: give the state an `entity` and a `states` list
(`value`, `icon`, `color`, `text`). Icon, color and text of the matching entry replace those of the point, and the handle
shows them while the point is active. The `entity` of a state only feeds this display: an action acts on the main entity unless it names
its own `entity`. The `hold_action` below toggles a flag, the point shows whether it is on:

```yaml
states:
  - value: "Auto"
    icon: mdi:solar-power
    entity: select.charge_min
    states:
      - { value: "pv", icon: mdi:solar-power, color: green }
      - { value: "min", icon: mdi:solar-power-variant-outline, color: orange }
    hold_action: { action: perform-action, perform_action: script.toggle_charge_min }
```

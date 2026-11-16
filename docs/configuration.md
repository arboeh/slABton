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


## General options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required (not for `clock`) | Entity id |
| `mode` | by domain | `state`, `lock`, `value`, `counter`, `timer`, `clock` |
| `bar` | none | Bar value separate from the button, see [Bar value](appearance.md#bar-value) |
| `bar_text` | none | Text in the bar with [placeholders](appearance.md#placeholders) |
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
| `bar_state_color` | `false` | `true` colors the whole bar in the color of the current state (`states[].color`), see [State color](appearance.md#state-color) |
| `styles` | none | Map of CSS variables, see [Styling](appearance.md#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | by mode | HA actions plus `cycle`, `cycle_back` |
| `switches` | none | `start`, `mid`, `end`, each with `entity`, `icon`, `name`, actions |
| `text` | defaults | Font size and color per text area, see [Text appearance](appearance.md#text-appearance) |
| `scale` | none | Tick marks and labels, each inside or outside the bar, see [Scale](appearance.md#scale) |

`call-service` (with `service` / `service_data`) is accepted as a deprecated alias of `perform-action` and may be removed in a later version.

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

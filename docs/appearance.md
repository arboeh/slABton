# Appearance

## Bar value

![bar from another entity](assets/shots/bar-entity-light.png#only-light)
![bar from another entity](assets/shots/bar-entity-dark.png#only-dark)

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

### Bar value from an attribute

`bar.attribute` makes the bar show an attribute of an entity instead of its state, for example the position of
a cover or the measured temperature of a thermostat:

```yaml
type: custom:slabton-card
entity: climate.living_room
bar:
  attribute: current_temperature
  unit: "°C"
bar_text: "{value}"
```

- The attribute belongs to `bar.entity`; without `bar.entity` it belongs to `entity`. The attribute name uses
  letters, digits and `_` (at most 64 characters), anything else is ignored with a warning.
- The bar is read-only with an attribute. `drag` has no effect, the handle keeps its normal actions. In the default
  `state` mode the handle sits on the measured value and cannot be dragged. Tap and keys still work.
- The scale and the fill edge follow the handle track like in every mode: the tick of a value stands under the handle
  centre at that value, and the fill ends there.
- Unit: `bar.unit` first, else the `unit_of_measurement` of the entity. Climate and cover entities have none, so
  set `bar.unit` (for example `"°C"` or `"%"`).
- Range: `bar.min` / `bar.max` first, else the attributes `min_temp` / `max_temp`, else `min` / `max` of the
  entity, else 0 to 100. Climate entities bring `min_temp` / `max_temp`, covers use 0 to 100. A sensor with an
  extra attribute has no range of its own, so set `bar.min` and `bar.max`.
- Scale `labels` show this range. The labels follow the entity range at runtime.
- A missing attribute, a value that is not a number or an unavailable entity shows the warning icon with the
  reason ("Attribute missing or not a number") and an empty bar. This does not block the actions of the card.
  Only an unavailable main `entity` blocks them.
- A text value counts as a number like the entity state does, so `"1e5"` and `"0x10"` are numbers.
- Keep the default `mode` for climate and cover. With `mode: value` the handle and the lock follow the state of
  the entity, and a climate entity has no numeric state.

## Segmented bar

`bar.segments` cuts the bar into equal segments across the bar, like the slats of a blind or the blocks of a level meter. The quick start tile "Shutter" uses it.

```yaml
type: custom:slabton-card
entity: cover.living_room
orientation: vertical
thickness: 64
bar:
  segments:
    count: 10
    gap: 3
    on_color: "#2196f3"
    off_color: "#757575"
```

| Option | Default | Description |
| --- | --- | --- |
| `count` | 10 | Number of segments, a whole number from 2 to 50 |
| `gap` | 3 | Gap between segments in px, 0 to 20 |
| `on_color` | fill color | CSS color of the active segments (the state color with `bar_state_color`) |
| `off_color` | track color | CSS color of the inactive segments |

- Short form: `segments: 10` sets the count, `segments: true` takes all defaults. `segments: false` or a missing option means off, and the bar looks as before.
- Whole segments: the number of active segments is the position times `count`, rounded to the nearest whole segment (55 % of 10 gives 6, 4 % gives 0). The segments grow from the start of the bar: left, with `direction: rtl` right; vertical from the bottom, with `rtl` from the top. A cover at 60 % open therefore shows 6 blue segments at the bottom and 4 grey ones above.
- Horizontal cover: a cover with `segments` and `orientation: horizontal` runs reversed unless `direction` is set. The grey (closed) segments then start at the left and grow to the right, like the grey of the vertical shutter grows down from the top, and 100 % open is at the left. Set `direction: ltr` to keep the normal direction.
- The segments replace only the look of track and fill. Value, handle, drag and tap, scale, texts, actions and `bar.attribute` work as before. The segments jump to the next whole segment, there is no slide animation.
- Variables on the card (`styles:` can override them): `--slabton-seg-n` (count), `--slabton-seg-gap`, `--slabton-seg-on-color`, `--slabton-seg-off-color`.
- Not combinable with `stickshift`, which has no bar: the option is ignored with a warning. Invalid values are ignored with a console warning and the default applies; unknown keys are warned about.
- Visual editor: no fields for it yet, the code editor shows the block.

## Placeholders

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

## Text appearance

![custom text sizes and colors](assets/shots/text-appearance-light.png#only-light)
![custom text sizes and colors](assets/shots/text-appearance-dark.png#only-dark)

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
| `header` | `font_weight` | 500 | Header text only (title) |
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
- `font_weight` exists only in `header`: a number from 1 to 1000 (`700`), a keyword (`normal`, `bold`, `lighter`, `bolder`) or a CSS variable such as `var(--font-weight-l)`. Other values are ignored with a console warning.
- `icon_color` exists only in `header`. Other unknown keys are ignored with a warning.
- Priority: `text:` beats `styles:`, `styles:` beats the default. Invalid values do not stop the card; the other values still apply.
- `button.font_size` sets only the handle text; the handle icon follows `handle_size`. `button.color` also colors the icon.
- Large sizes are cut off: bar text, timer info and handle text have `overflow: hidden`. Check the result on the dashboard.

## Scale

![scale with labels](assets/shots/value-scale-light.png#only-light)
![scale with labels](assets/shots/value-scale-dark.png#only-dark)

Tick marks and labels, drawn under the handle. Ticks and labels each sit inside the bar or outside it, independent of each other. Without `scale:` nothing is drawn.

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
| `ticks_placement` | `inside` | `inside`: ticks in the bar. `outside`: ticks between the bar and the labels, on the side `position` points to; length `size`. `none`: no ticks, only labels, on the track the ticks would have had. `none` needs `labels: true`, otherwise ignored with a warning |
| `labels` | `false` | Labels at the ticks. Clock: hours 0, 6, 12, 18, 24. Value and counter: minimum and maximum, only with a fixed range (`min` and `max`, or `counter`) or with a separate `bar.entity` of the domain `input_number` / `number` (its `min` / `max` attributes). State: names of the configured `states` (at least two). Inside the bar: needs a bar thickness of 28 px, otherwise no labels, with a warning |
| `labels_placement` | `inside` | `inside`: labels in the bar next to the ticks. `outside`: labels next to the bar, on the side `position` points to (top or left for `start` and `center`, bottom or right for `end`); no minimum thickness. Needs `labels: true`, otherwise ignored with a warning |

- `scale: true` takes all defaults. `scale: false` or a missing block means off.
- All modes: the ticks sit on the handle's travel (from the handle centre at the start to the handle centre at the end). The tick for value i/ticks stands exactly under the handle centre at that value, and the fill ends there. In state and lock each tick is exactly under the handle at its state. `direction: rtl` mirrors them. Without `handle_overhang` the travel is inset by half the handle at each end; with it, the travel covers the whole bar.
- Clock: one tick per hour (24). With `clock.hour_format: "12"` there are 12 ticks, two hours apart. `auto` gives 24 ticks even in a 12-hour locale. An explicit `ticks` wins over both.
- Invalid values are ignored with a console warning and the default applies. Unknown keys are warned about and ignored.
- The key `enabled` exists only as the editor switch. In YAML it is warned about and ignored.
- Not drawn yet: hour / minute hands on the scale. Planned for later releases. The analog clock's hands sit in the handle (`clock.display: analog`).
- With a separate `bar.entity` the labels follow that entity, not the main entity: an `input_number` / `number` without `min` and `max` in the config shows its attribute range and updates when the attributes change; while the entity is unavailable the labels keep their last text. Any other bar entity uses the configured `min` and `max` (or 0 and 100).
- Order from the bar outwards: bar, ticks, labels. With ticks outside and labels inside, the labels sit in the bar on the side of the ticks, without tick marks in the bar.
- `position: center` puts outside ticks and labels on the start side (top or left), because the middle of the bar has no outside.
- The gap between the bar and outside labels follows the handle overhang, plus 3 px. Horizontal cards reserve height for the label font size (plus 3 px) and, for outside ticks, `size`. Vertical cards reserve no width: the dashboard column decides it. With ticks and labels outside, a vertical bar with the default `thickness` needs about 105 to 110 px plus the width of the longest label (an estimate). The default of 3 columns in a sections view (desktop) showed no cut-off in a check; narrower sections (2 columns, phone width) and long `states` names were not measured. If the card is cut off there, give it more columns in the layout (`grid_options.columns`) or use a thinner bar.
- A handle that sticks out of the bar (`handle_size` larger than `thickness`, or `handle_overhang`) keeps 4 px of air to the card edge on top of the card padding, on the axes where it sticks out, and the card height counts it (such cards are 8 px higher). A vertical card whose handle plus padding is wider than 3 columns asks the sections view for more columns (`columns` and `min_columns`; `handle_size: 120` gets 4). The column width is estimated from a desktop section (34 px plus an 8 px gap); narrow sections such as a phone were not measured, and `border_width` is not counted. If the handle still pokes out of the card, set `grid_options.columns` yourself: your `grid_options` win.
- All modes: labels are centred on their tick, the first and the last one too. The outer labels can run past the ends of the bar into the card padding. The card clips them 18 px beyond the bar ends (plus the handle overhang); a label that reaches further is cut off. The label size is counted in the card height from `text.scale.font_size`, else from a `styles:` override (`--slabton-scale-label-size`), else 10 px; the tick length from a `styles:` override (`--slabton-scale-size`), else `size`, else 8 px. Only values in `px` ("14px") and `0` count, as CSS does not accept a bare number other than 0 as a size: "14", `em`, `rem`, `%`, `var()` and `calc()` are not counted, the default applies to the height. `text.scale.font_size` wins over `styles:` for the label size. The label itself still shows in the size you set.
- Known limits of `scale.labels`: State names need `states` in the config (options of the entity are not used). With labels inside, long names or a large `scale.size` can overlap on thin bars; labels outside avoid that.
- Visual editor: fields `ticks_placement` and `labels_placement` show `inside` while the scale is on, but `inside` is not stored.
- Visual editor: default values are not stored (for the analog clock, `clock.face.ticks: true` stays out; `ticks: false` is kept). Under the form, hint lines name values the card ignores or clamps: colors it rejects, a `step` below `1e-9`, a `scale.size` above the bar thickness or below 2. A `scale.size` above the bar is set to the new thickness when `thickness` is lowered.
- Visual editor: section "Scale" with a "Show scale" switch. Switching it off removes all scale options; switching it on again starts with the defaults.


## State color

![whole bar in the state color](assets/shots/state-color-light.png#only-light)
![whole bar in the state color](assets/shots/state-color-dark.png#only-dark)

`states[].color` colors the fill. In mode `state` the fill is empty at the first state, so there the color shows only on the handle. With `bar_state_color: true` the whole bar takes the color of the current state.

```yaml
type: custom:slabton-card
entity: input_select.charge_mode
bar_state_color: true
states:
  - { value: "Off", color: blue }
  - { value: "PV", color: green }
  - { value: "Min", color: yellow }
  - { value: "Fast", color: red }
```

- Only the boolean `true` turns it on. Default `false`: the card looks as before.
- A state without `color`, another mode, or an unavailable entity leaves the bar in `bar_color` (or the theme default).
- Bar and fill then share the color, so the fill level is no longer visible; only the handle shows the position.
- Visual editor: switch "Whole bar in the state color" in the Layout section.

## Header

`header_position` (`top`, `bottom`, `none`) and `header_icon_position` (`left`, `right`, `none`) and `header_align` (`start`, `center`, `end`) place the header. `text.header` sets size, color and icon color (see [Text appearance](#text-appearance)).

![header icon on the right](assets/shots/header-icon-right-light.png#only-light)
![header icon on the right](assets/shots/header-icon-right-dark.png#only-dark)

![header below the bar](assets/shots/header-bottom-light.png#only-light)
![header below the bar](assets/shots/header-bottom-dark.png#only-dark)

![header with custom font size and colors](assets/shots/header-text-light.png#only-light)
![header with custom font size and colors](assets/shots/header-text-dark.png#only-dark)

## Styling

![custom bar, fill and handle colors](assets/shots/colors-light.png#only-light)
![custom bar, fill and handle colors](assets/shots/colors-dark.png#only-dark)

![warm colors with a square handle](assets/shots/colors-warm-light.png#only-light)
![warm colors with a square handle](assets/shots/colors-warm-dark.png#only-dark)

Layout and colors use CSS variables on the card. Set them with `styles:` (keys without
`--slabton-` prefix get it added) or with card-mod.

```yaml
styles:
  bar-color: "#263238"
  fill-color: "#ff9800"
  switch-size: 32px
```

Values are checked; unsafe values are ignored with a console warning.

The [`text:` block](appearance.md#text-appearance) sets these variables. `styles:` can set them too, but a `text:` value wins over `styles:`:
`--slabton-header-size`, `--slabton-header-color`, `--slabton-header-weight`, `--slabton-header-icon-color`,
`--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
`--slabton-button-size`, `--slabton-button-color`. Size defaults: header 14 px, bar 13 px, info 13 px, button 14 px.

Header only as `styles:` variables (no `text:` option): `--slabton-header-opacity` (default 1) and `--slabton-header-icon-size` (default 20px).

Scale: `--slabton-scale-size` and `--slabton-scale-color` are set by `scale.size` and `scale.color`; `styles:` can override them.
Scale labels: `--slabton-scale-label-size` and `--slabton-scale-label-color` (set by `text.scale`).
Analog dial: `--slabton-dial-color` (ticks and numbers), `--slabton-hands-color` (hour and minute hand, hub) and
`--slabton-second-hand-color` (default: error color).

### Material 3 look

Bar and handle follow Material 3 in every mode; set colors win over these defaults:

- **Track:** a tonal surface (text color at 12 % over the card color). `bar_color` replaces it.
- **Fill:** the state color (primary color without one) at full strength. `fill_color` replaces the color; the
  variable `--slabton-fill-opacity` (default `1`) sets the strength, `0.85` is the former look and keeps `bar_text` readable on a dark fill.
- **Handle:** filled with the state color (primary color without one); icon and text turn white or a dark tint of the fill's hue by its
  lightness (the switch is at about Material 3's tone 60). `button_color` overrides that pick; `text_color` does not reach the filled handle unless `handle_color` is set (then it colors the handle's text and the clock dial, not the icon).
  Next to a fill of the same color a 2 px ring in the card color (not with a stickshift) and the level 1 shadow keep the handle apart.
  While the entity is unavailable the handle stays on the card color, so the warning icon keeps its contrast.
  `handle_color` fills the handle with that color and the icon keeps the state color, e.g. `handle_color: white` with a `button_color` for the former look.
- **State layers:** handle, switches and stickshift points show hover as an 8 % and focus and press as a 10 % overlay in the content color.
  Hover shows only on devices that can hover, so a tap on a phone leaves no shade.
  The keyboard focus keeps its outline. With `prefers-reduced-motion` the overlays do not animate.
- **Handle text:** a long value or time shrinks with its length to fit the handle (down to 8 px, estimated at 0.7 em per
  character), then it is cut with an ellipsis. `text.button.font_size` stays the upper limit.
- **Bar text and timer info:** where `bar_text` or the timer `info` lie on the fill, they take the fill's on-color (white or a dark tint,
  chosen like the handle's); on the track they keep the theme's text color. With `bar_state_color` the whole bar counts as fill.
  `text_color`, `bar_text_color` and `info_color` override this. A vertical `info` stands outside the bar and is not changed.
- **Switches:** they take the shape of `handle_shape` (`round`, `oval`, `square`). An oval switch is never longer than the handle.

Browsers without relative colors (before Chrome 119, Safari 16.4, Firefox 128) always use the theme's text color on
primary for the handle icon, which can be hard to read on a light fill, so set `button_color` there; `bar_text` and `info` keep
the theme's text color. Without `color-mix` (before Chrome 111, Safari 16.2, Firefox 113) the track keeps the theme's secondary background.

## Stickshift

Looks of the [stickshift](modes.md#stickshift) points and gate. The options set these variables, `styles:` can override them:

| Variable | Set by | Default |
| --- | --- | --- |
| `--slabton-sx-d` | `point_size` | 80 % of `handle_size` |
| `--slabton-sx-opacity` | `point_opacity` | `0.55` |
| `--slabton-sx-gate-size` | `gate.size` | `4px` |
| `--slabton-sx-gate-color` | `gate.color` | text color at 50 % |

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
stickshift:
  shape: square
  active_color: white
  gate: { size: 3, color: grey }
states:
  - { value: "Off", icon: mdi:power, color: blue }
  - { value: "Auto", icon: mdi:calendar-clock, color: green }
  - { value: "On", icon: mdi:fire, color: red }
```

The gate runs only between the points (from edge to edge, not behind them) and has a fixed style: no state color and no progress fill (`bar_state_color` colors the bar, not the gate). The
handle on the active point is filled with `active_color`, else the `color` of the state, else the primary color; its icon
and text turn white or a dark tint of the fill's hue by its lightness (the switch is at about Material 3's tone 60;
`button_color` overrides this, `text_color` does not reach the filled handle unless `handle_color` is set; browsers without relative colors
(before Chrome 119, Safari 16.4, Firefox 128) always use the theme's text color on primary, which can be hard to read on
a light fill, so set `button_color` there). A `--slabton-handle-color` set through `styles:` fills the handle like
`handle_color`, but the icon then keeps its own color only with `handle_color`. While the entity is unavailable the
handle stays on the card color, so the warning icon keeps its contrast. Inactive points are a tonal
surface with a soft outline, hover is an 8 % and focus and press a 10 % overlay (Material 3 state layers). With
`prefers-reduced-motion` the points do not animate.

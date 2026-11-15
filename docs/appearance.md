# Appearance

## Bar value

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

## Scale

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

The [`text:` block](appearance.md#text-appearance) sets these variables. `styles:` can set them too, but a `text:` value wins over `styles:`:
`--slabton-header-size`, `--slabton-header-color`, `--slabton-header-icon-color`,
`--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
`--slabton-button-size`, `--slabton-button-color`. Size defaults: header 14 px, bar 13 px, info 13 px, button 14 px.

Scale: `--slabton-scale-size` and `--slabton-scale-color` are set by `scale.size` and `scale.color`; `styles:` can override them.
Scale labels: `--slabton-scale-label-size` and `--slabton-scale-label-color` (set by `text.scale`).
Analog dial: `--slabton-dial-color` (ticks and numbers), `--slabton-hands-color` (hour and minute hand, hub) and
`--slabton-second-hand-color` (default: primary color).

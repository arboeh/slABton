# Reference

## Languages

Texts (editor labels, timer status, units) are English or German, taken from the Home Assistant
language of the user. Other languages fall back to English. Config errors and console warnings stay English.

## Reserved names

`thresholds`, `shape` and `control` are reserved for later releases. They are accepted, ignored
and logged with a warning. Several bars or buttons in one card (`bars:`) are not part of the schema.


## Bar attribute

Details of `bar.attribute` (see [Bar value](appearance.md#bar-value-from-an-attribute)):

- Name: letters, digits, `_`, 1 to 64 characters. Invalid names are ignored with a console warning. Without any
  entity (clock) the attribute is ignored with a warning.
- Value: a number, or text that reads as a number like the state (`"1e5"` counts). Everything else is invalid.
- `scale.ticks` counts sections: `ticks: 7` draws 8 marks.
- The bar is read-only. The gesture lock only follows the main entity; a broken attribute shows the hint and keeps
  taps, double taps and hold working.
- `mode: value` with an attribute follows the state of the main entity for handle and lock. For climate keep
  the default mode; for a cover see [Covers](#covers).
- In the `state` mode the handle sits on the measured value (not draggable) when the bar measures the main entity; with
  a separate `bar.entity` it stays on the state. In `timer`, `counter` and `lock` the handle keeps following the mode
  and only fill and scale show the attribute.

## Covers

Details of the cover support (see [Mode value](modes.md#covers)):

- A cover without `mode:` runs in the `value` mode. Before this release it ran in the `state` mode. A cover config with `states`, `bar.entity` or `bar.attribute` and no `mode:` keeps the `state` mode, and so does an explicit `mode: state`.
- The handle can be set when `supported_features` has bit 4 (set position) and `current_position` is a number. Without it the cover shows its state, no dragging.
- Tilt, switches at the ends and cover groups are not supported.
- `animation: pulse` also makes the handle pop on every step while dragging, in every mode, not only for covers (it plays whenever the shown value changes). Use `slide` to avoid it.
- Known limit: the dragged position is kept until the cover reports a movement. If the cover entity gets a new state object before it starts moving (for example an attribute update), the handle can briefly return to the reported position.

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

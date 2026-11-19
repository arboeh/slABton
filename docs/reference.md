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
- `mode: value` with an attribute follows the state of the main entity for handle and lock. For climate and cover
  keep the default mode.
- In the `state` mode the handle sits on the measured value (not draggable) when the bar measures the main entity; with
  a separate `bar.entity` it stays on the state. In `timer`, `counter` and `lock` the handle keeps following the mode
  and only fill and scale show the attribute.

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

<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/heading-dark.svg">
    <img alt="slABton" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/heading-light.svg" height="40">
  </picture>
</h1>

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![CodeQL](https://github.com/arboeh/slABton/actions/workflows/dynamic/github-code-scanning/codeql/badge.svg)](https://github.com/arboeh/slABton/security/code-scanning)
[![codecov](https://codecov.io/gh/arboeh/slABton/graph/badge.svg)](https://codecov.io/gh/arboeh/slABton)
[![Docs](https://github.com/arboeh/slABton/actions/workflows/docs.yml/badge.svg)](https://slabton.de)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![Release](https://img.shields.io/github/v/release/arboeh/slABton)](https://github.com/arboeh/slABton/releases)
[![License: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](LICENSE)

Slider button bar card for Home Assistant: a bar with a movable handle button.
Switch through several states, swipe to lock / unlock, or show a value.

**[Documentation](https://slabton.de)** · **[Live demo](https://slabton.de/demo/)** · [Deutsche Version](README.de.md)

**Install:** search for **slABton** in HACS ([details](#installation)).

![slABton promo video](https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/promo/slabton-promo.gif)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/state-dark.png">
  <img alt="State mode" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/state-light.png" width="480">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/clock-analog-dark.png">
  <img alt="Analog clock" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/clock-analog-light.png" width="480">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/value-scale-dark.png">
  <img alt="Value with scale" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/value-scale-light.png" width="480">
</picture>

## Features

- Modes: `state`, `lock`, `value`, `counter`, `timer`, `clock` (digital and analog)
- Handle shapes, positions and overhang; horizontal and vertical, `ltr` and `rtl`
- Drag, tap, double tap and hold actions; arrow keys for `input_number` / `number` / `cover`
- Text in the bar with simple placeholders (no templates), tick scale with labels, inside or outside the bar
- Covers (`cover.*`): drag sets the position, tap opens or closes, hold stops, travel is shown live
- Bar value from an entity attribute (`bar.attribute`), for example cover position or climate temperature
- Colors, font sizes and CSS variables; theme aware; respects reduced motion
- English and German texts, visual editor

## Installation

### HACS

[![Open this repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=arboeh&repository=slABton&category=plugin)

1. Open HACS and search for **slABton**.
2. Download **slABton**, reload the browser.

Fallback if the search does not find it: HACS, three-dot menu, **Custom repositories**, add
`https://github.com/arboeh/slABton`, type **Dashboard**, then install as above.

### Manual

1. Copy `dist/slabton.js` to `/config/www/slabton.js`.
2. Add a dashboard resource: URL `/local/slabton.js`, type **JavaScript module**.

## Quick start

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
```

The mode follows the entity domain: `lock` / `alarm_control_panel` give `lock`, `sensor` / `number` /
`input_number` give `value`, `counter` gives `counter`, `timer` gives `timer`, everything else gives `state`.
`input_datetime` / `input_date` and `clock` need an explicit `mode:`.

All options, examples and screenshots are on the website:

- [Configuration](https://slabton.de/configuration/): general options
- [Modes](https://slabton.de/modes/): state, lock, value, counter, timer, clock
- [Appearance](https://slabton.de/appearance/): bar value, placeholders, text, scale, header, styling
- [Reference](https://slabton.de/reference/): languages, reserved names, development, roadmap

Swipe to lock / unlock is a convenience gesture, **not a security boundary**. See [SECURITY.md](SECURITY.md).

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` is the only release file. The website sources are in `docs/` and `docs-de/` (Zensical);
see the [reference](https://slabton.de/reference/) for the source layout and how to add a language.

## License

[Mozilla Public License 2.0](LICENSE) (MPL-2.0)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/logo-dark.svg">
  <img alt="AB logo" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/logo-light.svg" height="64">
</picture>

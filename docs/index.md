# slABton

[![License: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](https://github.com/arboeh/slABton/blob/main/LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider button bar card for Home Assistant: a bar with a movable handle button.
Switch through several states, swipe to lock / unlock, or show a value.

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

# Modes

## Mode `state`

![state mode](assets/shots/state-light.png#only-light)
![state mode](assets/shots/state-dark.png#only-dark)

![state mode with handle overhang](assets/shots/state-overhang-light.png#only-light)
![state mode with handle overhang](assets/shots/state-overhang-dark.png#only-dark)

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

![state mode, vertical](assets/shots/state-vertical-light.png#only-light)
![state mode, vertical](assets/shots/state-vertical-dark.png#only-dark)

![separate switches at start, mid and end](assets/shots/switches-light.png#only-light)
![separate switches at start, mid and end](assets/shots/switches-dark.png#only-dark)

## Mode `lock`

![lock mode](assets/shots/lock-light.png#only-light)
![lock mode](assets/shots/lock-dark.png#only-dark)

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
Do not store alarm codes in the config. See [SECURITY.md](https://github.com/arboeh/slABton/blob/main/SECURITY.md).

## Mode `value`

![value mode, thermometer](assets/shots/value-light.png#only-light)
![value mode, thermometer](assets/shots/value-dark.png#only-dark)

The bar fills by value, the value shows in the handle. For `input_number` and `number` the handle can be dragged or moved with the arrow keys; the card calls `<domain>.set_value` on release, not while dragging. `sensor` stays read-only.

```yaml
type: custom:slabton-card
entity: sensor.living_room_temperature
mode: value
preset: thermometer
```

| Option | Default | Description |
| --- | --- | --- |
| `preset` | `none` | `thermometer` (-10 to 40, °C), `energy` (0 to 5000, W), `soc` (0 to 100, %) |
| `min`, `max` | preset or 0 / 100 | Value range. Without them, `input_number` / `number` use the entity's `min` / `max` attributes |
| `unit` | preset | Unit text |
| `decimals` | preset or 1 | Decimal places |
| `step` | entity `step` attribute | Step size (also `bar.step`); without any step the value is only rounded to `decimals` |
| `drag` | `true` | Dragging and arrow keys for `input_number` / `number`. `false` turns them off. No dragging with `handle_position` other than `flex`, with a separate `bar.entity`, or when max is not greater than min |

Arrow keys move the value one step (without a step: 1 % of the range). A range with max not greater than min leaves the bar empty, logs a console warning and disables dragging.

## Mode `counter`

![counter mode](assets/shots/counter-light.png#only-light)
![counter mode](assets/shots/counter-dark.png#only-dark)

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

## Mode `timer`

![timer mode](assets/shots/timer-light.png#only-light)
![timer mode](assets/shots/timer-dark.png#only-dark)

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
| `timer.info` | none | Extra text with [placeholders](appearance.md#placeholders): beside the handle (horizontal), above the bar (vertical) |
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

![paused timer](assets/shots/timer-paused-light.png#only-light)
![paused timer](assets/shots/timer-paused-dark.png#only-dark)

![countdown to a date](assets/shots/timer-date-light.png#only-light)
![countdown to a date](assets/shots/timer-date-dark.png#only-dark)

![vertical timer](assets/shots/timer-vertical-light.png#only-light)
![vertical timer](assets/shots/timer-vertical-dark.png#only-dark)

## Mode `clock`

![digital clock](assets/shots/clock-digital-light.png#only-light)
![digital clock](assets/shots/clock-digital-dark.png#only-dark)

![analog clock](assets/shots/clock-analog-light.png#only-light)
![analog clock](assets/shots/clock-analog-dark.png#only-dark)

Clock, no entity needed. The handle shows the time (digital) or a dial (analog), the bar fills with the progress of the day.

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
| `clock.display` | `digital` | `digital` (text) or `analog` (dial in the handle, see below). `analog` needs `handle_content: text` and `handle_size` of at least 32; otherwise `digital` with a warning |
| `clock.time_zone` | Home Assistant | IANA name, e.g. `America/New_York` |
| `clock.hour_format` | `auto` | `auto` (language default), `12`, `24` |
| `clock.seconds` | `false` | Show seconds; with `analog` also the second hand |
| `clock.face.numbers` | `none` | `none`, `quarters` (12, 3, 6, 9) or `all` (1 to 12). Analog only. Needs `handle_size` 48 (`quarters`) or 72 (`all`); a smaller handle steps down one level with a warning |
| `clock.face.ticks` | `true` | Tick marks at the edge of the dial. Analog only |

Analog dial: the handle shows a dial with hour and minute hands; `clock.seconds` adds a second hand. The hands
jump once per second (only the `transform` changes, no animation). Colors: see [Styling](appearance.md#styling).

```yaml
type: custom:slabton-card
mode: clock
thickness: 56
handle_size: 64
clock:
  display: analog
  seconds: true
  face:
    numbers: quarters
```

![analog clock larger than the bar](assets/shots/clock-large-light.png#only-light)
![analog clock larger than the bar](assets/shots/clock-large-dark.png#only-dark)

![analog clock with custom colors](assets/shots/clock-colors-light.png#only-light)
![analog clock with custom colors](assets/shots/clock-colors-dark.png#only-dark)


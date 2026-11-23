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

Color the whole bar in the color of the current state with `bar_state_color: true`, see [State color](appearance.md#state-color).

| Option | Default | Description |
| --- | --- | --- |
| `states` | from entity | List of `value`, `label`, `icon`, `text`, `color` |
| `hold_reverse` | `false` | Hold steps backwards |
| `drag` | `true` | Allow dragging (only with `handle_position: flex`) |

![state mode, vertical](assets/shots/state-vertical-light.png#only-light)
![state mode, vertical](assets/shots/state-vertical-dark.png#only-dark)

![separate switches at start, mid and end](assets/shots/switches-light.png#only-light)
![separate switches at start, mid and end](assets/shots/switches-dark.png#only-dark)

Switches can show the state of their entity with `states`, the handle can have actions and an icon per zone with `handle_zones`: see [Switch states and handle zones](configuration.md#switch-states-and-handle-zones).

### Stickshift

`stickshift:` replaces the bar with a fixed gate (the bar itself, its fill and border are not drawn) with one directly clickable point per state (like the gear gate of
an automatic stickshift): `O---O---O---O`. The points sit evenly spread behind the handle, the handle rests on the
point of the active state. Tap any point to jump straight to its state (0 to 3 without passing 1 and 2); dragging
the handle snaps to a point as before. Every state can also run an action of its own, independent of the main entity.

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
name: Heating
stickshift: true
states:
  - { value: "Off", icon: mdi:power }
  - { value: "Auto", icon: mdi:calendar-clock }
  - value: "On"
    icon: mdi:fire
    tap_action:
      action: perform-action
      perform_action: script.turn_on
      target: { entity_id: script.boost }
  - { value: "Idle", icon: mdi:sleep }
```

`stickshift: true` uses the defaults; a map turns it on by its presence (`enabled: false` switches it off again).
Only the `state` mode supports it; anywhere else it is ignored with a console warning, as it is with
`bar.attribute` on the main entity, with a single configured state, and `handle_position` other than `flex` is
set back to `flex`. The visual editor offers the choice **Display style: standard / stickshift** and the options below;
the actions per state stay YAML-only.

| Option | Default | Description |
| --- | --- | --- |
| `shape` | `round` | Shape of the points: `round`, `oval`, `square` |
| `point_size` | 80 % of `handle_size` | Point size in px (8 up to `handle_size`, never larger than the handle) |
| `point_opacity` | `0.35` | Opacity of the points (0 to 1), clearly weaker than the handle; hover and focus raise it |
| `active_color` | state `color` | Icon color of the handle on the active point (CSS color) |
| `gate` | thin line | Drawn only between the points, from one point edge to the next. `false` hides it, or a map: `visible` (`true`), `size` in px (`4`, 1 to 40), `color`. Fixed style: no state color, no progress fill |

Inactive points show what the handle shows at that state: the `icon`, else `text`, `label` or the `value`,
in the state's `color`. Points are real buttons with the `label` (else the `value`) as accessible name; the active
one carries `aria-current`.

Actions per state (`tap_action`, `double_tap_action`, `hold_action`, each with an optional own `entity` like
the [handle zones](configuration.md#switch-states-and-handle-zones)):

- Tap on an inactive point: state change first, then the `tap_action` of that point. Dragging the handle onto a
  point or an arrow key that lands on it does the same.
- Tap on the active point (the handle): only its `tap_action`, no state change. Without one the card action
  or the mode default (cycle) applies.
- Double tap and hold run the `double_tap_action` / `hold_action` of the active point only (the handle), without changing the state.
  On an inactive point a long press is just a tap: it selects the state.
- Arrow keys step as before; Enter and Space select the focused point.

With many states the points can overlap on a short bar; the card warns when `length` is too small for the points
(`states` listed in the config). Colors and CSS variables: [Appearance](appearance.md#stickshift).

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
| `step` | entity `step` attribute | Step size (also `bar.step`), at least `1e-9` (a smaller value is ignored with a warning); without any step the value is only rounded to `decimals` |
| `drag` | `true` | Dragging and arrow keys for `input_number` / `number`. `false` turns them off. No dragging with `handle_position` other than `flex`, with a separate `bar.entity`, or when max is not greater than min |

Arrow keys move the value one step (without a step: 1 % of the range). A range with max not greater than min leaves the bar empty, logs a console warning and disables dragging.

### Covers

A `cover` entity needs no `mode`: `entity: cover.living_room` runs in the value mode and shows the position
(`current_position`). 0 is closed, 100 is open; the fill shows how far the cover is open. Unit `%`, no decimals, range 0 to 100 (`min` / `max` are possible).

```yaml
type: custom:slabton-card
entity: cover.living_room
```

| Gesture | Action | Needs |
| --- | --- | --- |
| Release the handle, arrow keys (1 % per press) | `cover.set_cover_position` | `current_position` and `supported_features` bit 4 (set position) |
| Tap | `cover.toggle`; `open_cover` or `close_cover` if the entity supports only one; more-info if neither | bits 1 (open), 2 (close) |
| Hold | `cover.stop_cover` | bit 8 (stop) |

Your own `tap_action` / `hold_action` win. A service the entity does not support is never called.

- **Travel:** while the state is `opening` or `closing` the handle follows the reported position. With `animation: pulse` the frame of the bar pulses. After your own drag the handle stays on the target until the cover has arrived; if the cover does not report a movement within 10 s, or stops, the handle returns to the reported position.
- **Without `current_position`** the card shows the state (`open`, `closed`, `opening`, `closing`); a tap toggles, no dragging.
- **Existing configs:** a cover with `states`, `bar.entity` or `bar.attribute` and no `mode:` stays in the `state` mode, see [Reference](reference.md#covers).
- **Garage doors and gates:** the tap toggles without confirmation. Set your own `tap_action` with `confirmation` there.

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
| `timer.start_action` | none | Action when the card starts a `timer.*` timer, see [Start and end action](#timer-start-and-end-action) |
| `timer.end_action` | none | Action when the timer ends (runs out, or the card cancels it), see below |

The pulse only starts when the card sees the timer run out (or Home Assistant report its end).
Cancelling a timer early and opening the dashboard after the end do not pulse. A tap while it pulses only
ends the pulse. With reduced motion the bar gets a static highlight instead of the animation.
The display ticks once per second in the browser, only while the card is on screen and the tab is visible;
the tick never calls a service. Timer end times come from the server clock: if the browser clock differs,
the display can be off by that difference.

Daylight saving time: a date and time that does not exist (spring forward) is shifted past the gap, one
that exists twice (autumn) means the later time. Unknown time zone names are a configuration error.

### Timer: start and end action

With a `timer.*` entity the card can switch a device together with the timer, without a script or an
automation: `timer.start_action` runs when you start the timer, `timer.end_action` when it ends. Both take
a `perform-action` (see below). The run time is the `duration` of the timer helper.

```yaml
type: custom:slabton-card
entity: timer.climate_20min
name: Air conditioning
timer:
  start_action:
    action: perform-action
    perform_action: climate.turn_on
    target: { entity_id: climate.living_room }
  end_action:
    action: perform-action
    perform_action: climate.turn_off
    target: { entity_id: climate.living_room }
```

- **Start:** a tap, or a swipe of the handle from the start of the bar past the middle. The start action runs
  first, then `timer.start`. Resuming a paused timer does not run it again. A start from outside the card
  (automation, another card) does not run it.
- **End:** when the timer runs out, the end action runs once per run, also with `timer.pulse: false`.
  A hold (`timer.cancel`) runs it too, so the device does not stay on. Pause does not.
- **Swipe (switch layout):** with both `start_action` and `end_action` set, the handle sits at the start of the bar
  while the timer is off and the bar is empty; a running timer drains from the full end back to it. Dragging the
  handle from off past the middle starts the timer. While it runs or is paused, dragging the handle into the full end
  starts it again (resumes a paused one; the start action does not run again), and dragging it back into the start
  end stops it (`timer.cancel`, then the end action). A drag that stops short springs back. `drag: false` turns the
  swipe off. Without both actions the card behaves as before (full bar when ready, no swipe).
- Both actions must be a `perform-action`: they run unattended, so `toggle`, `more-info`, `navigate` and `url`
  are ignored with a console warning (a toggle would flip the device back when two cards run it).
- The end action also runs when you come back to a card that was hidden (other view, background tab) while the
  timer ran out; it never runs if the card never saw the timer run. It is lost when the timer entity goes
  `unavailable` during a run (Home Assistant restart). Two cards for the same timer run it twice, so pick idempotent
  actions (`climate.turn_off`, not a toggle).
- A running timer whose handle already sits within 10 % of the full end cannot be restarted by dragging, and one
  within 10 % of the start cannot be stopped by dragging: use a tap or a hold there.
- If `timer.start` fails after the start action ran, the device stays on without a timer; the error is in the browser console.
- Not for `input_datetime` / `input_date` countdown targets: there is no start or end the card could know; the
  actions are ignored with a console warning.

**The end action only runs while a dashboard with the card is open.** The card runs it in the browser. If no such
dashboard is open when the timer ends, nothing happens and the device stays on. With several open dashboards (phone,
tablet) every one of them runs the end action: choose an action that is safe to repeat, like `climate.turn_off`,
not `toggle`. For a guaranteed end, add an automation on the `timer.finished` event of the helper. Keep the
`end_action` on the card too (the swipe needs both actions): with a dashboard open both run, which is harmless
for a repeatable action:

```yaml
automation:
  - alias: Air conditioning off after the timer
    triggers:
      - trigger: event
        event_type: timer.finished
        event_data:
          entity_id: timer.climate_20min
    actions:
      - action: climate.turn_off
        target:
          entity_id: climate.living_room
```

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


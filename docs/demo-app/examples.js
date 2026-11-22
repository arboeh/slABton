// Demo presets. Entity ids refer to the mock entities in mock-hass.js.
window.SLABTON_EXAMPLES = [
  {
    id: "state",
    label: "State (select)",
    yaml: `type: custom:slabton-card
entity: input_select.heating_mode
name: Heating
icon: mdi:radiator
states:
  - { value: "Off", icon: mdi:power }
  - { value: "Auto", icon: mdi:calendar-clock }
  - { value: "On", icon: mdi:fire }
  - { value: "Idle", icon: mdi:sleep }
`,
  },
  {
    id: "stickshift",
    label: "State, stickshift",
    yaml: `type: custom:slabton-card
entity: input_select.heating_mode
name: Stickshift
stickshift: true
states:
  - { value: "Off", icon: mdi:power, color: blue }
  - { value: "Auto", icon: mdi:calendar-clock, color: green }
  - { value: "On", icon: mdi:fire, color: red }
  - { value: "Idle", icon: mdi:sleep, color: orange }
`,
  },
  {
    id: "overhang",
    label: "State, handle overhang",
    yaml: `type: custom:slabton-card
entity: input_select.heating_mode
name: Overhang
handle_overhang: true
handle_shape: oval
`,
  },
  {
    id: "state-color",
    label: "State, whole bar in the state color",
    yaml: `type: custom:slabton-card
entity: input_select.heating_mode
name: State color
bar_state_color: true
states:
  - { value: "Off", icon: mdi:power, color: blue }
  - { value: "Auto", icon: mdi:calendar-clock, color: green }
  - { value: "On", icon: mdi:fire, color: red }
  - { value: "Idle", icon: mdi:sleep, color: orange }
`,
  },
  {
    id: "vertical",
    label: "State, vertical",
    yaml: `type: custom:slabton-card
entity: input_select.heating_mode
name: Vertical
orientation: vertical
length: 200
`,
  },
  {
    id: "lock",
    label: "Lock (swipe)",
    yaml: `type: custom:slabton-card
entity: lock.front_door
name: Front door
mode: lock
swipe_threshold: 85
`,
  },
  {
    id: "value",
    label: "Value (sensor)",
    yaml: `type: custom:slabton-card
entity: sensor.living_room_temperature
mode: value
preset: thermometer
name: Living room
scale:
  ticks: 5
  labels: true
`,
  },
  {
    id: "labels-outside",
    label: "Value, labels outside",
    yaml: `type: custom:slabton-card
entity: sensor.living_room_temperature
mode: value
preset: thermometer
name: Labels outside
thickness: 20
scale:
  ticks: 5
  position: start
  labels: true
  labels_placement: outside
`,
  },
  {
    id: "ticks-outside",
    label: "Value, ticks and labels outside",
    yaml: `type: custom:slabton-card
entity: sensor.living_room_temperature
mode: value
preset: thermometer
name: Ticks outside
thickness: 20
scale:
  ticks: 5
  position: end
  ticks_placement: outside
  labels: true
  labels_placement: outside
`,
  },
  {
    id: "draggable",
    label: "Value (draggable number)",
    yaml: `type: custom:slabton-card
entity: input_number.target_temperature
mode: value
name: Target temperature
min: 15
max: 25
step: 0.5
unit: "°C"
`,
  },
  {
    id: "cover",
    label: "Cover (position)",
    yaml: `type: custom:slabton-card
entity: cover.living_room
name: Living room shutter
scale:
  ticks: 4
  labels: true
`,
  },
  {
    id: "cover-auto",
    label: "Cover with auto mode",
    yaml: `type: custom:slabton-card
entity: cover.living_room
name: Living room shutter
handle_content: icon
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
      - { value: "off", icon: mdi:power, color: grey }
handle_zones:
  start:
    entity: sensor.cover_living_room_mode
    states:
      - { value: auto, icon: mdi:calendar-clock, color: green }
      - { value: "off", icon: mdi:power, color: grey }
`,
  },
  {
    id: "cover-simple",
    label: "Cover (no position)",
    yaml: `type: custom:slabton-card
entity: cover.garage_door
name: Garage door
`,
  },
  {
    id: "counter",
    label: "Counter",
    yaml: `type: custom:slabton-card
entity: counter.guests
name: Guests
bar_text: "{value} of 10"
counter:
  max: 10
`,
  },
  {
    id: "timer",
    label: "Timer",
    yaml: `type: custom:slabton-card
entity: timer.sauna
name: Sauna
timer:
  info: "{state}"
`,
  },
  {
    id: "clock",
    label: "Clock (digital)",
    yaml: `type: custom:slabton-card
mode: clock
name: Berlin
clock:
  time_zone: Europe/Berlin
  hour_format: 24
  seconds: true
scale:
  labels: true
`,
  },
  {
    id: "analog",
    label: "Clock (analog)",
    yaml: `type: custom:slabton-card
mode: clock
name: New York
thickness: 56
handle_size: 64
clock:
  display: analog
  time_zone: America/New_York
  hour_format: 12
  seconds: true
  face:
    numbers: quarters
`,
  },
  {
    id: "bar-attribute",
    label: "Value from an attribute",
    yaml: `type: custom:slabton-card
entity: sensor.living_room_temperature
name: Humidity
icon: mdi:water-percent
bar:
  attribute: humidity
  min: 0
  max: 100
  unit: "%"
  decimals: 0
scale:
  ticks: 10
  labels: true
`,
  },
  {
    id: "styled",
    label: "Colors and text",
    yaml: `type: custom:slabton-card
entity: sensor.battery_soc
mode: value
preset: soc
name: Battery
fill_color: "#4caf50"
handle_shape: square
scale:
  ticks: 10
text:
  header: { font_size: 16, color: "#4caf50" }
`,
  },
];

// Translated example names (fallback: the English `label` above).
window.SLABTON_EXAMPLE_LABELS = {
  de: {
    state: "Zustand (Select)", overhang: "Zustand, Griff-Überstand", vertical: "Zustand, vertikal",
    lock: "Sperre (Swipe)", value: "Wert (Sensor)", "labels-outside": "Wert, Beschriftung außen", "ticks-outside": "Wert, Striche und Beschriftung außen", draggable: "Wert (ziehbare Zahl)", cover: "Rollladen (Position)", "cover-simple": "Rollladen (ohne Position)", "cover-auto": "Rollladen mit Auto-Modus", counter: "Zähler",
    timer: "Timer", clock: "Uhr (digital)", analog: "Uhr (analog)", "bar-attribute": "Wert aus Attribut", styled: "Farben und Text",
  },
};

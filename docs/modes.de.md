# Modi

## Modus `state`

![Modus state](assets/shots/state-light.png#only-light)
![Modus state](assets/shots/state-dark.png#only-dark)

![Modus state mit Griff-Überstand](assets/shots/state-overhang-light.png#only-light)
![Modus state mit Griff-Überstand](assets/shots/state-overhang-dark.png#only-dark)

Klick schaltet durch die Zustände. Ziehen rastet auf den nächsten Zustand ein.
Zustände kommen aus `states:`, sonst aus der Entity (`options`, `hvac_modes`), sonst `off` / `on`.

```yaml
type: custom:slabton-card
entity: input_select.heizung_modus
name: Heizung
states:
  - { value: "Aus", icon: mdi:power }
  - { value: "Auto", icon: mdi:calendar-clock }
  - { value: "An", icon: mdi:fire }
  - { value: "Idle", icon: mdi:sleep }
hold_reverse: true
```

Handle ragt an beiden Enden heraus (Füllung am ersten Zustand leer, am letzten voll):

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
handle_overhang: true
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `states` | aus Entity | Liste mit `value`, `label`, `icon`, `text`, `color` |
| `hold_reverse` | `false` | Halten schaltet rückwärts |
| `drag` | `true` | Ziehen erlauben (nur mit `handle_position: flex`) |

![Modus state, vertikal](assets/shots/state-vertical-light.png#only-light)
![Modus state, vertikal](assets/shots/state-vertical-dark.png#only-dark)

![Separate Schalter bei Start, Mitte und Ende](assets/shots/switches-light.png#only-light)
![Separate Schalter bei Start, Mitte und Ende](assets/shots/switches-dark.png#only-dark)

## Modus `lock`

![Modus lock](assets/shots/lock-light.png#only-light)
![Modus lock](assets/shots/lock-dark.png#only-dark)

Den Griff über die Bar wischen, um zu entsperren oder zu sperren.

```yaml
type: custom:slabton-card
entity: alarm_control_panel.haus
mode: lock
arm_service: alarm_arm_home
swipe_threshold: 85
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `swipe_threshold` | 85 | Wischstrecke in % (30 bis 100) |
| `unlock_action`, `lock_action` | nach Domain | Aufgerufene Aktion überschreiben |
| `arm_service` | `alarm_arm_away` | Scharfschalt-Service für Alarmzentralen |

Alarm-Panels, die zum Scharf- oder Unscharfschalten einen Code verlangen, werden nicht unterstützt:
der Swipe sendet keinen Code, der Service-Aufruf scheitert (siehe Browser-Konsole). Codes gehören nicht in die Karten-Konfiguration.

Die Pfeiltasten sperren oder entsperren in diesem Modus nicht, ein versehentlicher Tastendruck öffnet also keine Tür.

Swipe to lock / unlock ist eine Komfortgeste, **keine Sicherheitsgrenze**.
Keine Alarmcodes in der Config ablegen. Siehe [SECURITY.md](https://github.com/arboeh/slABton/blob/main/SECURITY.md).

## Modus `value`

![Modus value, Thermometer](assets/shots/value-light.png#only-light)
![Modus value, Thermometer](assets/shots/value-dark.png#only-dark)

Die Bar füllt sich nach Wert, der Wert steht im Griff. Bei `input_number` und `number` lässt sich der Griff ziehen oder mit den Pfeiltasten verschieben; die Karte ruft beim Loslassen `<domain>.set_value` auf, nicht während des Ziehens. `sensor` bleibt reine Anzeige.

```yaml
type: custom:slabton-card
entity: sensor.wohnzimmer_temperatur
mode: value
preset: thermometer
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `preset` | `none` | `thermometer` (-10 bis 40, °C), `energy` (0 bis 5000, W), `soc` (0 bis 100, %) |
| `min`, `max` | Preset oder 0 / 100 | Wertebereich. Ohne diese Werte nehmen `input_number` / `number` die Attribute `min` / `max` der Entity |
| `unit` | Preset | Einheit |
| `decimals` | Preset oder 1 | Nachkommastellen |
| `step` | Attribut `step` der Entity | Schrittweite (auch `bar.step`), mindestens `1e-9` (ein kleinerer Wert wird mit Warnung ignoriert); ohne Schrittweite wird der Wert nur auf `decimals` gerundet |
| `drag` | `true` | Ziehen und Pfeiltasten bei `input_number` / `number`. `false` schaltet sie ab. Kein Ziehen bei `handle_position` außer `flex`, bei eigener `bar.entity` oder wenn max nicht größer als min ist |

Pfeiltasten verschieben den Wert um einen Schritt (ohne Schrittweite: 1 % des Bereichs). Ein Bereich mit max nicht größer als min lässt die Bar leer, meldet eine Konsolenwarnung und deaktiviert das Ziehen.

## Modus `counter`

![Modus counter](assets/shots/counter-light.png#only-light)
![Modus counter](assets/shots/counter-dark.png#only-dark)

Zeigt eine `counter.*`-Entity. Die Bar füllt sich zwischen Minimum und Maximum.
Tippen zählt um eins hoch, Doppeltippen um eins runter (`counter.increment` / `counter.decrement`).
Ein Zurücksetzen gibt es nicht als Standard; wer es will, setzt
`hold_action: {action: perform-action, perform_action: counter.reset, target: {entity_id: counter.gaeste}}`.

```yaml
type: custom:slabton-card
entity: counter.gaeste
name: Gäste
bar_text: "{value} von 10"
counter:
  max: 10
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `counter.min`, `counter.max` | siehe unten | Bereich der Bar |

Reihenfolge des Bereichs: `counter.min/max`, dann `bar.min/max` (oder flaches `min` / `max`), dann die
Entity-Attribute `minimum` / `maximum`, dann 0 / 100. Den Zähler durch Ziehen zu setzen wird noch nicht unterstützt.

## Modus `timer`

![Modus timer](assets/shots/timer-light.png#only-light)
![Modus timer](assets/shots/timer-dark.png#only-dark)

Zwei Quellen:

- **`timer.*`** (Home-Assistant-Timer, gilt geräteübergreifend). Die Bar leert sich von der vollen Dauer bis null.
  Tippen startet oder pausiert einen laufenden Timer. Halten bricht ab.
- **`input_datetime.*` mit Datum oder `input_date.*`** (`mode: timer` setzen): Countdown auf diesen Zeitpunkt.
  Die Bar ist ab `timer.span` Tagen Restzeit voll und leert sich bis zum Ziel. Tippen öffnet More-Info.
  Ein `input_datetime` nur mit Uhrzeit wird nicht unterstützt (Anzeige `–`, Warnung in der Konsole).

```yaml
type: custom:slabton-card
entity: timer.sauna
name: Sauna
bar_text: "noch {remaining_text}"
timer:
  info: "Ende {target}"
```

Countdown auf ein Datum:

```yaml
type: custom:slabton-card
entity: input_datetime.schuetzenfest
mode: timer
name: Schützenfest
bar_text: "noch {remaining_text} bis Schützenfest"
timer:
  time_zone: Europe/Berlin
  span: 60
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `timer.pulse` | `true` | Bar pulsiert, wenn der Timer abläuft oder das Ziel erreicht ist |
| `timer.pulse_seconds` | 10 | Wie lange es pulsiert; `0` = bis zum Tippen auf die Karte |
| `timer.info` | keiner | Zusatztext mit [Platzhaltern](appearance.md#platzhalter): neben dem Griff (horizontal), über der Bar (vertikal) |
| `timer.time_zone` | Home Assistant | Zeitzone, in der `input_datetime` / `input_date` gelesen wird (IANA-Name) |
| `timer.span` | 30 | Countdown auf ein Datum: Tage Restzeit, ab denen die Bar voll ist |

Das Pulsieren startet nur, wenn die Karte den Ablauf mitbekommt (oder Home Assistant das Ende meldet).
Ein vorzeitig abgebrochener Timer und das Öffnen des Dashboards nach dem Ende pulsieren nicht. Ein Tippen
während des Pulsierens beendet nur das Pulsieren. Bei reduzierter Bewegung gibt es statt der Animation eine
feste Hervorhebung.
Die Anzeige tickt einmal pro Sekunde im Browser, nur solange die Karte sichtbar und der Tab im Vordergrund ist;
der Tick ruft keinen Service auf. Endzeiten von Timern stammen von der Serveruhr: weicht die Browseruhr ab,
weicht die Anzeige um diese Differenz ab.

Sommerzeit: Eine Uhrzeit, die es nicht gibt (Umstellung im Frühjahr), wird hinter die Lücke geschoben; eine,
die es zweimal gibt (Herbst), meint die spätere. Ein unbekannter Zeitzonenname ist ein Konfigurationsfehler.

![Pausierter Timer](assets/shots/timer-paused-light.png#only-light)
![Pausierter Timer](assets/shots/timer-paused-dark.png#only-dark)

![Countdown auf ein Datum](assets/shots/timer-date-light.png#only-light)
![Countdown auf ein Datum](assets/shots/timer-date-dark.png#only-dark)

![Vertikaler Timer](assets/shots/timer-vertical-light.png#only-light)
![Vertikaler Timer](assets/shots/timer-vertical-dark.png#only-dark)

## Modus `clock`

![Digitaluhr](assets/shots/clock-digital-light.png#only-light)
![Digitaluhr](assets/shots/clock-digital-dark.png#only-dark)

![Analoguhr](assets/shots/clock-analog-light.png#only-light)
![Analoguhr](assets/shots/clock-analog-dark.png#only-dark)

Uhr, keine Entity nötig. Der Griff zeigt die Uhrzeit digital oder als Zifferblatt (analog), die Bar füllt sich mit dem Tagesfortschritt.

```yaml
type: custom:slabton-card
mode: clock
name: Berlin
clock:
  time_zone: Europe/Berlin
  hour_format: 24
  seconds: true
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `clock.display` | `digital` | `digital` (Text) oder `analog` (Zifferblatt im Griff, siehe unten). `analog` braucht `handle_content: text` und `handle_size` von mindestens 32; sonst `digital` mit Warnung |
| `clock.time_zone` | Home Assistant | IANA-Name, z. B. `America/New_York` |
| `clock.hour_format` | `auto` | `auto` (Standard der Sprache), `12`, `24` |
| `clock.seconds` | `false` | Sekunden anzeigen; bei `analog` auch der Sekundenzeiger |
| `clock.face.numbers` | `none` | `none`, `quarters` (12, 3, 6, 9) oder `all` (1 bis 12). Nur analog. Braucht `handle_size` 48 (`quarters`) bzw. 72 (`all`); ein kleinerer Griff fällt eine Stufe zurück, mit Warnung |
| `clock.face.ticks` | `true` | Strichmarken am Rand des Zifferblatts. Nur analog |

Analoguhr (`clock.display: analog`): der Griff zeigt ein Zifferblatt mit Stunden- und Minutenzeiger; `clock.seconds`
fügt einen Sekundenzeiger hinzu. Die Zeiger springen einmal pro Sekunde (nur Änderung des `transform`, ohne Animation).
Farben: siehe [Styling](appearance.md#styling).

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

![Analoguhr größer als die Bar](assets/shots/clock-large-light.png#only-light)
![Analoguhr größer als die Bar](assets/shots/clock-large-dark.png#only-dark)

![Analoguhr mit eigenen Farben](assets/shots/clock-colors-light.png#only-light)
![Analoguhr mit eigenen Farben](assets/shots/clock-colors-dark.png#only-dark)


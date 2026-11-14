# slABton

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![Lizenz: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider-Button-Bar-Karte für Home Assistant: eine Bar mit verschiebbarem Griff-Button.
Mehrere Zustände schalten, per Swipe sperren / entsperren oder einen Wert anzeigen.

[English version](README.md)

> Stand: Vorabversion, privates Repository (noch kein HACS-Release).

## Funktionen

- Griffformen: rund (Standard), oval, eckig
- Griffposition: `flex` (folgt dem Wert), `fixed`, `switch`, `start`, `mid`, `end`
- Horizontal und vertikal, `ltr` und `rtl`
- Modi: `state`, `lock`, `value` (Presets Thermometer, Energy, SoC), `counter`, `timer`, `clock`
- Analoguhr: Zifferblatt mit Stunden-, Minuten- und Sekundenzeiger im Griff (`clock.display: analog`)
- Timer: Home-Assistant-`timer.*` oder Countdown auf ein `input_datetime` / `input_date`, Pulsieren bei Ablauf, Zeitzonen
- Text in der Bar (`bar_text`) mit einfachen Platzhaltern, ohne Templates
- Bar-Wert aus einer eigenen Entity (`bar:`)
- Skala in der Bar (`scale:`): Striche, Position, Größe, Farbe, Beschriftung; stündliche Striche im Modus Uhr
- Modus `value` bei `input_number` / `number`: Ziehen oder Pfeiltasten setzen den Wert (`step`, `drag: false`)
- Schriftgröße und Farbe der Texte (`text:`)
- Texte auf Deutsch und Englisch, Sprache folgt Home Assistant
- Aktionen Klick, Doppelklick, Halten
- Icon je Zustand, Positionszahl oder Text im Griff
- Optionale separate Schalter bei Start, Mitte, Ende
- Header und Header-Icon
- Animationen: `none`, `slide`, `fade`, `pulse`, `shimmer` (beachtet reduzierte Bewegung)
- Theme-fähig, Farben und CSS-Variablen überschreibbar
- Visueller Editor

## Installation

### HACS (benutzerdefiniertes Repository)

1. HACS, Dreipunktmenü, **Benutzerdefinierte Repositories**.
2. `https://github.com/arboeh/slABton` hinzufügen, Typ **Dashboard**.
3. **slABton** installieren, Browser neu laden.

### Manuell

1. `dist/slabton.js` nach `/config/www/slabton.js` kopieren.
2. Dashboard-Ressource anlegen: URL `/local/slabton.js`, Typ **JavaScript-Modul**.

## Konfiguration

Minimal:

```yaml
type: custom:slabton-card
entity: input_select.heizung_modus
```

Der Modus folgt der Entity-Domain: `lock` / `alarm_control_panel` ergeben `lock`,
`sensor` / `number` / `input_number` ergeben `value`, `counter` ergibt `counter`, `timer` ergibt `timer`,
alles andere `state`. `input_datetime` / `input_date` und `clock` brauchen ein ausdrückliches `mode:`.

> Geändert in diesem Release: `counter.*`- und `timer.*`-Entities liefen bisher im Modus `state`.
> Mit `mode: state` bleibt das alte Verhalten.

### Allgemeine Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `entity` | Pflicht (nicht bei `clock`) | Entity-ID |
| `mode` | nach Domain | `state`, `lock`, `value`, `counter`, `timer`, `clock` |
| `bar` | keiner | Bar-Wert getrennt vom Button, siehe [Bar-Wert](#bar-wert) |
| `bar_text` | keiner | Text in der Bar mit [Platzhaltern](#platzhalter) |
| `name` | keiner | Header-Text |
| `icon` | nach Modus | Header- und Griff-Icon |
| `header_position` | `top` | `top`, `bottom`, `none` |
| `header_icon_position` | `left` | `left` (wie bei der Tile-Karte), `right` |
| `orientation` | `horizontal` | `horizontal`, `vertical` |
| `direction` | `ltr` | `ltr`, `rtl` |
| `length` | 0 | Bar-Länge in px (0 = volle Breite; vertikal Standard 160) |
| `thickness` | 48 | Bar-Dicke in px (12 bis 200) |
| `handle_size` | 40 | Griffgröße in px |
| `handle_shape` | `round` | `round`, `oval`, `square` |
| `handle_position` | `flex` | `flex`, `fixed`, `switch`, `start`, `mid`, `end` |
| `fixed_position` | 50 | Position in % bei `fixed` |
| `handle_overhang` | `false` | Handle-Mitte läuft von Rand zu Rand und ragt an beiden Enden heraus; Füllung ist bei 0 leer und bei 100 voll |
| `handle_content` | `icon` (`text` bei `value`, `counter`, `timer`, `clock`) | `icon`, `position`, `text`, `none` |
| `border_width` | 0 | Rand der Bar in px |
| `border_radius` | automatisch | Eckenradius der Bar in px |
| `animation` | `slide` | `none`, `slide`, `fade`, `pulse`, `shimmer` |
| `bar_color`, `fill_color`, `handle_color`, `text_color`, `border_color` | Theme | CSS-Farben |
| `styles` | keine | Map mit CSS-Variablen, siehe [Styling](#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | nach Modus | HA-Aktionen plus `cycle`, `cycle_back` |
| `switches` | keine | `start`, `mid`, `end`, je mit `entity`, `icon`, `name`, Aktionen |
| `text` | Standardwerte | Schriftgröße und Farbe je Textbereich, siehe [Textdarstellung](#textdarstellung) |
| `scale` | keine | Striche in der Bar, siehe [Skala](#skala) |

`call-service` (mit `service` / `service_data`) wird als veralteter Alias von `perform-action` akzeptiert und kann in einer späteren Version entfallen.

### Modus `state`

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

### Modus `lock`

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
Keine Alarmcodes in der Config ablegen. Siehe [SECURITY.md](SECURITY.md).

### Modus `value`

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
| `step` | Attribut `step` der Entity | Schrittweite (auch `bar.step`); ohne Schrittweite wird der Wert nur auf `decimals` gerundet |
| `drag` | `true` | Ziehen und Pfeiltasten bei `input_number` / `number`. `false` schaltet sie ab. Kein Ziehen bei `handle_position` außer `flex`, bei eigener `bar.entity` oder wenn max nicht größer als min ist |

Pfeiltasten verschieben den Wert um einen Schritt (ohne Schrittweite: 1 % des Bereichs). Ein Bereich mit max nicht größer als min lässt die Bar leer, meldet eine Konsolenwarnung und deaktiviert das Ziehen.

### Modus `counter`

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

### Modus `timer`

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
| `timer.info` | keiner | Zusatztext mit [Platzhaltern](#platzhalter): neben dem Griff (horizontal), über der Bar (vertikal) |
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

### Modus `clock`

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
Farben: siehe [Styling](#styling).

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

### Bar-Wert

Standardmäßig zeigt die Bar dieselbe Entity wie der Button. Der Block `bar:` trennt beides: die Bar zeigt
eine numerische Entity, der Griff bleibt bei `entity`.

```yaml
type: custom:slabton-card
entity: timer.sauna
bar:
  entity: sensor.sauna_temperatur
  min: 20
  max: 100
  unit: "°C"
  decimals: 0
bar_text: "{value}"
```

`bar` kennt `entity`, `min`, `max`, `unit`, `decimals`, `preset`, `step`. Die flachen Optionen (`min`, `max`, `unit`,
`decimals`, `preset` auf oberster Ebene) bleiben Alias für `bar.*`; sind beide gesetzt, gewinnt `bar:` und
es gibt eine Warnung. Ohne `bar.entity` folgt die Bar wie bisher `entity`. `{value}` ist dann der Bar-Wert.

### Platzhalter

`bar_text` und `timer.info` nehmen Text mit Platzhaltern in einfachen geschweiften Klammern. Das ist **keine**
Template-Sprache: kein Jinja, keine Ausdrücke, kein HTML. Der Text erscheint immer als reiner Text. Ein Name,
den der Modus nicht anbietet, bleibt stehen und erzeugt eine Warnung; ein angebotener Name ohne Wert zeigt `–`.

| Platzhalter | Modi | Bedeutung |
| --- | --- | --- |
| `{name}` | alle | `name`, sonst der Anzeigename der Entity |
| `{state}` | alle | Zustand der Entity; bei Timern ein übersetzter Status (Bereit, Läuft, Pausiert, Abgelaufen) |
| `{value}` | alle | Angezeigter Wert (Zählerstand, Bar-Wert, Restzeit, Uhrzeit) |
| `{remaining}` | timer | `4:59`, `1:05:00`, ab einem Tag `3 d` |
| `{remaining_text}` | timer | Größte Einheit, übersetzt: `3 Tage`, `2 Stunden`, `5 Minuten` |
| `{days}`, `{hours}`, `{minutes}`, `{seconds}` | timer | Bestandteile der Restzeit (keine Summen) |
| `{elapsed}` | timer | HA-Timer: verstrichene Zeit |
| `{target}` | timer | Endzeit, lokalisiertes Datum (und Uhrzeit) |
| `{time}` | clock | Uhrzeit |

Texte sind auf 200 Zeichen begrenzt.

### Textdarstellung

Der Block `text:` setzt Schriftgröße und Farbe von fünf Bereichen. Ohne ihn ändert sich nichts.

```yaml
type: custom:slabton-card
entity: timer.sauna
name: Sauna
bar_text: "noch {remaining_text}"
timer:
  info: "Ende {target}"
text:
  header: { font_size: 16, color: "#ff9800", icon_color: "#2196f3" }
  bar:    { font_size: 12, color: var(--secondary-text-color) }
  info:   { font_size: 11, color: grey }
  button: { font_size: 18, color: white }
```

| Bereich | Option | Standard | Wirkt auf |
| --- | --- | --- | --- |
| `header` | `font_size` | 14 px | Header-Text (Titel) |
| `header` | `color` | Textfarbe | Nur der Header-Text; das Icon bleibt unverändert |
| `header` | `icon_color` | Textfarbe | Nur das Header-Icon |
| `bar` | `font_size` | 13 px | `bar_text` |
| `bar` | `color` | Textfarbe | `bar_text` |
| `info` | `font_size` | 13 px | `timer.info` (Zusatztext des Timers) |
| `info` | `color` | Textfarbe | `timer.info` |
| `button` | `font_size` | 14 px | Griff-Text (`handle_content: text`, `position`) |
| `button` | `color` | Textfarbe | Gesamter Griffinhalt, auch das Griff-Icon |
| `scale` | `font_size` | 10 px | Beschriftung an den Skala-Strichen (`scale.labels`) |
| `scale` | `color` | Textfarbe | Beschriftung an den Skala-Strichen (`scale.labels`) |

- `font_size`: Zahl von 8 bis 48 (px) oder Dezimaltext wie `"12"`. Andere Werte werden mit Konsolenwarnung ignoriert.
- `color`: jede CSS-Farbe, die `styles:` akzeptiert. Unsichere Werte werden mit Konsolenwarnung ignoriert.
- `icon_color` gibt es nur im Bereich `header`. Andere unbekannte Schlüssel werden mit Warnung ignoriert.
- Rangfolge: `text:` schlägt `styles:`, `styles:` schlägt den Standardwert. Ungültige Werte stoppen die Karte nicht; die übrigen Werte gelten weiter.
- `button.font_size` setzt nur den Griff-Text; das Griff-Icon folgt `handle_size`. `button.color` färbt auch das Icon.
- Große Schrift wird abgeschnitten: Bar-Text, Timer-Info und Griff-Text haben `overflow: hidden`. Das Ergebnis im Dashboard prüfen.

### Skala

Striche entlang der Bar, unter dem Griff gezeichnet. Ohne `scale:` wird nichts gezeichnet.

```yaml
type: custom:slabton-card
entity: sensor.akku_soc
preset: soc
scale:
  ticks: 5
  position: top
  size: 10
  color: "#888"
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `ticks` | 10 (Uhr: 24) | Segmente, 1 bis 100. Die Skala zeichnet ein Strich mehr als Segmente, je einen am Anfang und am Ende |
| `position` | `bottom` (vertikal: `right`) | Rand quer zur Bar: `top` / `bottom` (horizontal) oder `left` / `right` (vertikal). `start`, `center`, `end` gehen auch: `start` ist oben bzw. links, `end` unten bzw. rechts |
| `size` | 8 px | Strichlänge in px, 2 bis zur Bar-Dicke `thickness` |
| `color` | Textfarbe mit 45 % | Jede CSS-Farbe, die `styles:` akzeptiert |
| `labels` | `false` | Beschriftung an den Strichen. Uhr: Stunden 0, 6, 12, 18, 24. Wert und Zähler: Minimum und Maximum, nur bei festem Bereich (`min` und `max`, bzw. `counter`). Zustand: Namen der konfigurierten `states` (mindestens zwei). Mindestens 28 px Bar-Dicke; sonst keine Beschriftung, mit Warnung |

- `scale: true` übernimmt alle Standardwerte. `scale: false` oder fehlender Block: aus.
- Die Striche liegen auf dem Laufweg des Griffs: der Strich für Wert i/ticks steht genau unter dem Griff bei diesem Wert. `direction: rtl` spiegelt sie.
- Uhr: ein Strich je Stunde (24). Mit `clock.hour_format: "12"` gibt es 12 Striche, je zwei Stunden. `auto` ergibt 24 Striche, auch bei 12-Stunden-Sprache. Ein ausdrückliches `ticks` gewinnt.
- Ungültige Werte werden mit Konsolenwarnung ignoriert, es gilt der Standard. Unbekannte Schlüssel werden gewarnt und ignoriert.
- Der Schlüssel `enabled` existiert nur als Schalter im Editor. In YAML wird er gewarnt und ignoriert.
- Noch nicht enthalten: Stunden- und Minutenzeiger auf der Skala. Folgen in späteren Versionen. Die Zeiger der Analoguhr liegen im Griff (`clock.display: analog`).
- Bekannte Grenzen von `scale.labels`: Mit eigenem `bar.entity` nutzen die Labels im Wertmodus die konfigurierten `min` und `max` (oder 0 und 100), nicht den Bereich des Bar-Entities; `min` und `max` selbst setzen. Zustandsnamen brauchen `states` in der Konfiguration (Optionen des Entities werden nicht genutzt). Lange Namen oder ein großes `scale.size` können sich auf dünnen Bars überlappen.
- Visueller Editor, Analoguhr: Sobald ein Feld geändert wird, speichert der Editor `clock.face.ticks: true` (den Standardwert).
- Visueller Editor: Abschnitt „Skala“ mit Schalter „Skala anzeigen“. Ausschalten entfernt alle Skala-Optionen; Einschalten startet mit den Standardwerten.

## Sprachen

Texte (Editor-Beschriftungen, Timer-Status, Einheiten) erscheinen auf Deutsch oder Englisch, nach der
Home-Assistant-Sprache des Benutzers. Andere Sprachen fallen auf Englisch zurück. Konfigurationsfehler
und Konsolenwarnungen bleiben Englisch.

## Reservierte Namen

`thresholds`, `shape` und `control` sind für spätere Versionen reserviert. Sie werden akzeptiert,
ignoriert und mit Warnung protokolliert. Mehrere Bars oder Buttons in einer Karte (`bars:`) sind nicht Teil des Schemas.

## Styling

Layout und Farben laufen über CSS-Variablen an der Karte. Setzen per `styles:` (Schlüssel ohne
Präfix `--slabton-` bekommen es automatisch) oder per card-mod.

```yaml
styles:
  bar-color: "#263238"
  fill-color: "#ff9800"
  switch-size: 32px
```

Werte werden geprüft; unsichere Werte werden mit Konsolenwarnung ignoriert.

Der Block [`text:`](#textdarstellung) setzt diese Variablen. `styles:` kann sie ebenfalls setzen, ein Wert aus `text:` gewinnt aber gegen `styles:`:
`--slabton-header-size`, `--slabton-header-color`, `--slabton-header-icon-color`,
`--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
`--slabton-button-size`, `--slabton-button-color`. Standardgrößen: Header 14 px, Bar 13 px, Info 13 px, Griff 14 px.

Skala: `--slabton-scale-size` und `--slabton-scale-color` setzen `scale.size` und `scale.color`; `styles:` kann sie überschreiben.
Skala-Beschriftung: `--slabton-scale-label-size` und `--slabton-scale-label-color` (gesetzt durch `text.scale`).
Analoguhr: `--slabton-dial-color` (Striche und Ziffern), `--slabton-hands-color` (Stunden- und Minutenzeiger, Nabe)
und `--slabton-second-hand-color` (Standard: Primärfarbe).

## Entwicklung

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` ist die einzige Release-Datei. `npm run check-version` vergleicht
`package.json` und `src/version.js`.

Aufbau: `src/core/` greift nicht auf das DOM zu (Konfiguration, Konstanten, Zeit, Platzhalter, i18n, Puls
und die Modi in `modes/`). `src/ui/` enthält Karte, Render, Styles, Interaktion, Editor und Animationen.
`core` importiert nie aus `ui`. Die Tests spiegeln den Aufbau in `tests/core` und `tests/ui`.

Die Texte liegen in `src/core/locales/<Sprache>.json`. Neue Sprache: `en.json` kopieren, die Werte übersetzen,
Schlüssel und `{Platzhalter}` behalten und die Datei in `src/core/i18n.js` eintragen.
`tests/core/locales.test.js` prüft, dass jede Sprache dieselben Schlüssel und Platzhalter wie Englisch hat.

## Roadmap

Geplant als eigene Folgevorgänge: Zähler durch Ziehen setzen; Thresholds mit Farbwechsel;
Lock der ganzen Karte; Kreis und 3/4-Kreis; mehrere Bars und Griffe; Select-Dropdown; Stunden- und Minutenzeiger auf der Skala; andere Kalender.

## Lizenz

[Mozilla Public License 2.0](LICENSE) (MPL-2.0)

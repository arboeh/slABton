# slABton

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![Lizenz: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider-Button-Bar-Karte für Home Assistant: eine Bar mit verschiebbarem Griff-Button.
Mehrere Zustände schalten, per Swipe sperren / entsperren oder einen Wert anzeigen.

[English version](README.md)

> Stand: 0.1.0, noch nicht veröffentlicht. Das Repository hat noch keinen Remote.

## Funktionen

- Griffformen: rund (Standard), oval, eckig
- Griffposition: `flex` (folgt dem Wert), `fixed`, `switch`, `start`, `mid`, `end`
- Horizontal und vertikal, `ltr` und `rtl`
- Modi: `state`, `lock`, `value` (Presets Thermometer, Energy, SoC)
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
`sensor` / `number` / `input_number` ergeben `value`, alles andere `state`.

### Allgemeine Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `entity` | Pflicht | Entity-ID |
| `mode` | nach Domain | `state`, `lock`, `value` |
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
| `handle_content` | `icon` (`text` im Wertmodus) | `icon`, `position`, `text`, `none` |
| `border_width` | 0 | Rand der Bar in px |
| `border_radius` | automatisch | Eckenradius der Bar in px |
| `animation` | `slide` | `none`, `slide`, `fade`, `pulse`, `shimmer` |
| `bar_color`, `fill_color`, `handle_color`, `text_color`, `border_color` | Theme | CSS-Farben |
| `styles` | keine | Map mit CSS-Variablen, siehe [Styling](#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | nach Modus | HA-Aktionen plus `cycle`, `cycle_back` |
| `switches` | keine | `start`, `mid`, `end`, je mit `entity`, `icon`, `name`, Aktionen |

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

Nur Anzeige. Die Bar füllt sich nach Wert, der Wert steht im Griff.

```yaml
type: custom:slabton-card
entity: sensor.wohnzimmer_temperatur
mode: value
preset: thermometer
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `preset` | `none` | `thermometer` (-10 bis 40, °C), `energy` (0 bis 5000, W), `soc` (0 bis 100, %) |
| `min`, `max` | Preset oder 0 / 100 | Wertebereich |
| `unit` | Preset | Einheit |
| `decimals` | Preset oder 1 | Nachkommastellen |

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

## Entwicklung

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` ist die einzige Release-Datei. `npm run check-version` vergleicht
`package.json` und `src/version.js`.

## Roadmap

Geplant als eigene Folgevorgänge: Modi `counter`, `timer`, `clock`; Thresholds mit Farbwechsel;
Lock der ganzen Karte; Kreis und 3/4-Kreis; mehrere Bars und Griffe; Designs Analog und Digital.

## Lizenz

MIT

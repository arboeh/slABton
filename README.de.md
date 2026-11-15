# slABton

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![Lizenz: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider-Button-Bar-Karte für Home Assistant: eine Bar mit verschiebbarem Griff-Button.
Mehrere Zustände schalten, per Swipe sperren / entsperren oder einen Wert anzeigen.

**[Dokumentation](https://slabton.de)** (englisch) · **[Live-Demo](https://slabton.de/demo/)** · [English version](README.md)

<img alt="Modus state" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/state-light.png" width="480">
<img alt="Analoguhr" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/clock-analog-light.png" width="480">
<img alt="Wert mit Skala" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/value-scale-light.png" width="480">

## Funktionen

- Modi: `state`, `lock`, `value`, `counter`, `timer`, `clock` (digital und analog)
- Griffformen, Griffpositionen und Überstand; horizontal und vertikal, `ltr` und `rtl`
- Aktionen Klick, Doppelklick, Halten und Ziehen; Pfeiltasten bei `input_number` / `number`
- Text in der Bar mit einfachen Platzhaltern (ohne Templates), Skala mit Beschriftung
- Farben, Schriftgrößen und CSS-Variablen; Theme-fähig; beachtet reduzierte Bewegung
- Texte auf Deutsch und Englisch, visueller Editor

## Installation

### HACS (benutzerdefiniertes Repository)

1. HACS, Dreipunktmenü, **Benutzerdefinierte Repositories**.
2. `https://github.com/arboeh/slABton` hinzufügen, Typ **Dashboard**.
3. **slABton** installieren, Browser neu laden.

### Manuell

1. `dist/slabton.js` nach `/config/www/slabton.js` kopieren.
2. Dashboard-Ressource anlegen: URL `/local/slabton.js`, Typ **JavaScript-Modul**.

## Schnellstart

```yaml
type: custom:slabton-card
entity: input_select.heating_mode
```

Der Modus folgt der Domain der Entity: `lock` / `alarm_control_panel` ergeben `lock`, `sensor` / `number` /
`input_number` ergeben `value`, `counter` ergibt `counter`, `timer` ergibt `timer`, alles andere `state`.
`input_datetime` / `input_date` und `clock` brauchen ein ausdrückliches `mode:`.

Alle Optionen, Beispiele und Screenshots stehen auf der Website (englisch):

- [Configuration](https://slabton.de/configuration/): allgemeine Optionen
- [Modes](https://slabton.de/modes/): state, lock, value, counter, timer, clock
- [Appearance](https://slabton.de/appearance/): Bar-Wert, Platzhalter, Text, Skala, Header, Styling
- [Reference](https://slabton.de/reference/): Sprachen, reservierte Namen, Entwicklung, Roadmap

Swipe zum Sperren / Entsperren ist eine Komfortgeste, **keine Sicherheitsgrenze**. Siehe [SECURITY.md](SECURITY.md).

## Entwicklung

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` ist die einzige Release-Datei. Die Quellen der Website liegen in `docs/` (MkDocs);
Quellcode-Aufbau und das Hinzufügen einer Sprache stehen in der [Referenz](https://slabton.de/reference/).

## Lizenz

[Mozilla Public License 2.0](LICENSE) (MPL-2.0)

<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/heading-dark.svg">
    <img alt="slABton" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/heading-light.svg" height="40">
  </picture>
</h1>

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![CodeQL](https://github.com/arboeh/slABton/actions/workflows/dynamic/github-code-scanning/codeql/badge.svg)](https://github.com/arboeh/slABton/security/code-scanning)
[![Docs](https://github.com/arboeh/slABton/actions/workflows/docs.yml/badge.svg)](https://slabton.de/de/)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![Lizenz: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider-Button-Bar-Karte für Home Assistant: eine Bar mit verschiebbarem Griff-Button.
Mehrere Zustände schalten, per Swipe sperren / entsperren oder einen Wert anzeigen.

**[Dokumentation](https://slabton.de/de/)** · **[Live-Demo](https://slabton.de/de/demo/)** · [English version](README.md)

**Installation:** HACS, benutzerdefiniertes Repository `arboeh/slABton`, Typ **Dashboard** ([Details](#installation)).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/state-dark.png">
  <img alt="Modus state" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/state-light.png" width="480">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/clock-analog-dark.png">
  <img alt="Analoguhr" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/clock-analog-light.png" width="480">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/value-scale-dark.png">
  <img alt="Wert mit Skala" src="https://raw.githubusercontent.com/arboeh/slABton/main/docs/assets/shots/value-scale-light.png" width="480">
</picture>

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

Alle Optionen, Beispiele und Screenshots stehen auf der Website:

- [Konfiguration](https://slabton.de/de/configuration/): allgemeine Optionen
- [Modi](https://slabton.de/de/modes/): state, lock, value, counter, timer, clock
- [Darstellung](https://slabton.de/de/appearance/): Bar-Wert, Platzhalter, Text, Skala, Header, Styling
- [Referenz](https://slabton.de/de/reference/): Sprachen, reservierte Namen, Entwicklung, Roadmap

Swipe zum Sperren / Entsperren ist eine Komfortgeste, **keine Sicherheitsgrenze**. Siehe [SECURITY.md](SECURITY.md).

## Entwicklung

```bash
npm install
npm run lint
npm test
npm run build
```

`dist/slabton.js` ist die einzige Release-Datei. Die Quellen der Website liegen in `docs/` (MkDocs);
Quellcode-Aufbau und das Hinzufügen einer Sprache stehen in der [Referenz](https://slabton.de/de/reference/).

## Lizenz

[Mozilla Public License 2.0](LICENSE) (MPL-2.0)

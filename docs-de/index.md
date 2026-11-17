---
title: slABton
---

# ![slABton](/assets/heading-light.svg#only-light)![slABton](/assets/heading-dark.svg#only-dark)

[![CI](https://github.com/arboeh/slABton/actions/workflows/ci.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/ci.yml)
[![CodeQL](https://github.com/arboeh/slABton/actions/workflows/dynamic/github-code-scanning/codeql/badge.svg)](https://github.com/arboeh/slABton/security/code-scanning)
[![codecov](https://codecov.io/gh/arboeh/slABton/graph/badge.svg)](https://codecov.io/gh/arboeh/slABton)
[![HACS](https://github.com/arboeh/slABton/actions/workflows/hacs.yml/badge.svg)](https://github.com/arboeh/slABton/actions/workflows/hacs.yml)
[![Release](https://img.shields.io/github/v/release/arboeh/slABton)](https://github.com/arboeh/slABton/releases)
[![Lizenz: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](https://github.com/arboeh/slABton/blob/main/LICENSE)

Slider-Button-Bar-Karte für Home Assistant: eine Bar mit verschiebbarem Griff-Button.
Mehrere Zustände schalten, per Swipe sperren / entsperren oder einen Wert anzeigen.

<video autoplay loop muted playsinline poster="/assets/promo/slabton-promo-poster.png" style="width: 100%; border-radius: 8px; margin: 1.5rem 0;">
  <source src="/assets/promo/slabton-promo.webm" type="video/webm">
  <source src="/assets/promo/slabton-promo.mp4" type="video/mp4">
</video>

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

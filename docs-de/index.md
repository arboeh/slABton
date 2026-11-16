# slABton

[![Lizenz: MPL 2.0](https://img.shields.io/badge/license-MPL%202.0-blue.svg)](https://github.com/arboeh/slABton/blob/main/LICENSE)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)

Slider-Button-Bar-Karte für Home Assistant: eine Bar mit verschiebbarem Griff-Button.
Mehrere Zustände schalten, per Swipe sperren / entsperren oder einen Wert anzeigen.

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

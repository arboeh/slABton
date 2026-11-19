# Referenz

## Sprachen

Texte (Editor-Beschriftungen, Timer-Status, Einheiten) erscheinen auf Deutsch oder Englisch, nach der
Home-Assistant-Sprache des Benutzers. Andere Sprachen fallen auf Englisch zurück. Konfigurationsfehler
und Konsolenwarnungen bleiben Englisch.

## Reservierte Namen

`thresholds`, `shape` und `control` sind für spätere Versionen reserviert. Sie werden akzeptiert,
ignoriert und mit Warnung protokolliert. Mehrere Bars oder Buttons in einer Karte (`bars:`) sind nicht Teil des Schemas.


## Bar-Attribut

Details zu `bar.attribute` (siehe [Bar-Wert](appearance.md#bar-wert-aus-einem-attribut)):

- Name: Buchstaben, Ziffern, `_`, 1 bis 64 Zeichen. Ungültige Namen werden mit Konsolenwarnung ignoriert. Ohne
  Entity (Uhr) wird das Attribut mit Warnung ignoriert.
- Wert: eine Zahl oder ein Text, der wie der Zustand als Zahl lesbar ist (`"1e5"` zählt). Alles andere ist ungültig.
- `scale.ticks` zählt Abschnitte: `ticks: 7` zeichnet 8 Striche.
- Die Bar ist nur lesend. Die Gestensperre folgt nur dem Haupt-Entity; ein kaputtes Attribut zeigt den Hinweis und
  lässt Tippen, Doppeltippen und Halten weiter zu.
- `mode: value` mit Attribut folgt für Griff und Sperre dem Zustand des Haupt-Entities. Für Climate den
  Standard-Modus lassen; bei Cover siehe [Covers](#covers).
- Im Modus `state` sitzt der Griff auf dem gemessenen Wert (nicht ziehbar), wenn die Bar das Haupt-Entity misst; mit
  eigener `bar.entity` bleibt er auf dem Zustand. In `timer`, `counter` und `lock` folgt der Griff weiter dem Modus,
  nur Füllung und Skala zeigen das Attribut.

## Covers

Details zur Cover-Unterstützung (siehe [Modus value](modes.md#covers)):

- Ein Cover ohne `mode:` läuft im Modus `value`. Vor diesem Release lief es im Modus `state`. Eine Cover-Konfiguration mit `states`, `bar.entity` oder `bar.attribute` und ohne `mode:` behält den Modus `state`, ebenso ein ausdrückliches `mode: state`.
- Der Griff lässt sich setzen, wenn `supported_features` Bit 4 (Position setzen) hat und `current_position` eine Zahl ist. Sonst zeigt das Cover seinen Zustand, kein Ziehen.
- Lamellen (Tilt), Schalter an den Enden und Cover-Gruppen werden nicht unterstützt.
- `animation: pulse` lässt den Griff beim Ziehen bei jedem Schritt aufploppen, in jedem Modus, nicht nur bei Covers (es läuft bei jeder Änderung des gezeigten Werts). Mit `slide` entfällt das.
- Bekannte Grenze: Die gezogene Position bleibt, bis das Cover eine Bewegung meldet. Bekommt das Cover vor dem Losfahren ein neues State-Objekt (zum Beispiel ein Attribut-Update), kann der Griff kurz auf die gemeldete Position zurückspringen.

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

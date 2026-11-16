# Referenz

## Sprachen

Texte (Editor-Beschriftungen, Timer-Status, Einheiten) erscheinen auf Deutsch oder Englisch, nach der
Home-Assistant-Sprache des Benutzers. Andere Sprachen fallen auf Englisch zurück. Konfigurationsfehler
und Konsolenwarnungen bleiben Englisch.

## Reservierte Namen

`thresholds`, `shape` und `control` sind für spätere Versionen reserviert. Sie werden akzeptiert,
ignoriert und mit Warnung protokolliert. Mehrere Bars oder Buttons in einer Karte (`bars:`) sind nicht Teil des Schemas.


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

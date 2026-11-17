# Darstellung

## Bar-Wert

![Bar-Wert aus einer anderen Entity](/assets/shots/bar-entity-light.png#only-light)
![Bar-Wert aus einer anderen Entity](/assets/shots/bar-entity-dark.png#only-dark)

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

## Platzhalter

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

## Textdarstellung

![Eigene Schriftgrößen und Farben](/assets/shots/text-appearance-light.png#only-light)
![Eigene Schriftgrößen und Farben](/assets/shots/text-appearance-dark.png#only-dark)

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

## Skala

![Skala mit Beschriftung](/assets/shots/value-scale-light.png#only-light)
![Skala mit Beschriftung](/assets/shots/value-scale-dark.png#only-dark)

Striche und Beschriftung, unter dem Griff gezeichnet. Striche und Beschriftung können jeweils innen oder außerhalb der Bar stehen, unabhängig voneinander. Ohne `scale:` wird nichts gezeichnet.

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
| `ticks_placement` | `inside` | `inside`: Striche in der Bar. `outside`: Striche zwischen Bar und Beschriftung, auf der Seite, auf die `position` zeigt; Länge `size`. `none`: keine Striche, nur die Beschriftung, auf der Spur, die die Striche gehabt hätten. `none` braucht `labels: true`, sonst wird es mit Warnung ignoriert |
| `labels` | `false` | Beschriftung an den Strichen. Uhr: Stunden 0, 6, 12, 18, 24. Wert und Zähler: Minimum und Maximum, nur bei festem Bereich (`min` und `max`, bzw. `counter`) oder bei eigenem `bar.entity` der Domain `input_number` / `number` (dessen Attribute `min` / `max`). Zustand: Namen der konfigurierten `states` (mindestens zwei). Innen in der Bar: mindestens 28 px Bar-Dicke, sonst keine Beschriftung, mit Warnung |
| `labels_placement` | `inside` | `inside`: Beschriftung in der Bar neben den Strichen. `outside`: Beschriftung neben der Bar, auf der Seite, auf die `position` zeigt (oben bzw. links bei `start` und `center`, unten bzw. rechts bei `end`); ohne Mindestdicke. Braucht `labels: true`, sonst wird es mit Warnung ignoriert |

- `scale: true` übernimmt alle Standardwerte. `scale: false` oder fehlender Block: aus.
- Wert, Zähler, Timer und Uhr: die Striche füllen die ganze Bar, der Strich für Wert i/ticks steht genau auf der Füllkante bei diesem Wert (Strich 0 am Anfang, letzter Strich am Ende), auch ohne `handle_overhang`; die Griffmitte trifft sie nur in der Mitte. Zustand und Schloss: die Striche liegen auf dem Laufweg des Griffs, jeder Strich steht genau unter dem Griff bei seinem Zustand. `direction: rtl` spiegelt sie.
- Uhr: ein Strich je Stunde (24). Mit `clock.hour_format: "12"` gibt es 12 Striche, je zwei Stunden. `auto` ergibt 24 Striche, auch bei 12-Stunden-Sprache. Ein ausdrückliches `ticks` gewinnt.
- Ungültige Werte werden mit Konsolenwarnung ignoriert, es gilt der Standard. Unbekannte Schlüssel werden gewarnt und ignoriert.
- Der Schlüssel `enabled` existiert nur als Schalter im Editor. In YAML wird er gewarnt und ignoriert.
- Noch nicht enthalten: Stunden- und Minutenzeiger auf der Skala. Folgen in späteren Versionen. Die Zeiger der Analoguhr liegen im Griff (`clock.display: analog`).
- Mit eigenem `bar.entity` folgen die Labels diesem Entity, nicht dem Haupt-Entity: Ein `input_number` / `number` ohne `min` und `max` in der Konfiguration zeigt seinen Attributbereich und aktualisiert sich bei Änderungen der Attribute; solange das Entity nicht verfügbar ist, behalten die Labels ihren letzten Text. Jedes andere Bar-Entity nutzt die konfigurierten `min` und `max` (oder 0 und 100).
- Reihenfolge von der Bar nach außen: Bar, Striche, Beschriftung. Sind Striche außen und die Beschriftung innen, steht die Beschriftung in der Bar auf der Seite der Striche, ohne Striche in der Bar.
- `position: center` setzt außen liegende Striche und Beschriftung auf die Startseite (oben bzw. links), da die Mitte der Bar keine Außenseite hat.
- Der Abstand zwischen Bar und außen liegender Beschriftung folgt dem Griff-Überstand, plus 3 px. Waagerechte Karten reservieren dafür Höhe (Schriftgröße der Beschriftung plus 3 px, bei außen liegenden Strichen zusätzlich `size`). Senkrechte Karten reservieren keine Breite: die Dashboard-Spalte bestimmt sie. Mit Strichen und Beschriftung außen braucht eine senkrechte Bar mit der Standard-Dicke `thickness` etwa 105 bis 110 px plus die Breite der längsten Beschriftung (Schätzung). Die Standardbreite von 3 Spalten in einer Sections-Ansicht (Desktop) zeigte in einer Prüfung keine Abschneidung; schmalere Sections (2 Spalten, Handy-Breite) und lange `states`-Namen wurden nicht gemessen. Wird die Karte dort abgeschnitten, ihr im Layout mehr Spalten geben (`grid_options.columns`) oder eine dünnere Bar nehmen.
- Zustand und Schloss: die Beschriftung am ersten und letzten Strich ist darauf zentriert und kann über den Kartenrand ragen. Wert, Zähler, Timer und Uhr: die erste Beschriftung schließt bündig mit dem Anfang der Bar ab, die letzte mit deren Ende. Die Beschriftungsgröße zählt in die Kartenhöhe aus `text.scale.font_size`, sonst aus einer `styles:`-Überschreibung (`--slabton-scale-label-size`), sonst 10 px; die Strichlänge aus einer `styles:`-Überschreibung (`--slabton-scale-size`), sonst `size`, sonst 8 px. Nur Werte in `px` ("14px") und `0` zählen, da CSS eine bloße Zahl ungleich 0 nicht als Größe akzeptiert: "14", `em`, `rem`, `%`, `var()` und `calc()` zählen nicht, für die Höhe gilt dann der Standard. `text.scale.font_size` gewinnt bei der Beschriftungsgröße gegen `styles:`. Die Beschriftung selbst erscheint weiter in der eingestellten Größe.
- Bekannte Grenzen von `scale.labels`: Zustandsnamen brauchen `states` in der Konfiguration (Optionen des Entities werden nicht genutzt). Innen in der Bar können lange Namen oder ein großes `scale.size` auf dünnen Bars überlappen; außen liegende Beschriftung vermeidet das.
- Visueller Editor: Felder `ticks_placement` und `labels_placement` zeigen bei eingeschalteter Skala `inside`, `inside` wird aber nicht gespeichert.
- Visueller Editor: Standardwerte werden nicht gespeichert (bei der Analoguhr bleibt `clock.face.ticks: true` draußen; `ticks: false` bleibt erhalten). Unter dem Formular nennen Hinweiszeilen Werte, die die Karte ignoriert oder begrenzt: abgelehnte Farben, ein `step` unter `1e-9`, ein `scale.size` über der Bar-Dicke oder unter 2. Ein `scale.size` über der Bar wird auf die neue Dicke gesetzt, wenn `thickness` verkleinert wird.
- Visueller Editor: Abschnitt „Skala“ mit Schalter „Skala anzeigen“. Ausschalten entfernt alle Skala-Optionen; Einschalten startet mit den Standardwerten.


## Zustandsfarbe

![Ganze Bar in der Zustandsfarbe](/assets/shots/state-color-light.png#only-light)
![Ganze Bar in der Zustandsfarbe](/assets/shots/state-color-dark.png#only-dark)

`states[].color` färbt die Füllung. Im Modus `state` ist die Füllung beim ersten Zustand leer, die Farbe zeigt sich dort nur am Griff. Mit `bar_state_color: true` nimmt die ganze Bar die Farbe des aktuellen Zustands an.

```yaml
type: custom:slabton-card
entity: input_select.lademodus
bar_state_color: true
states:
  - { value: "Aus", color: blue }
  - { value: "PV", color: green }
  - { value: "Min", color: yellow }
  - { value: "Schnell", color: red }
```

- Nur der boolesche Wert `true` schaltet ein. Standard `false`: die Karte sieht aus wie vorher.
- Ein Zustand ohne `color`, ein anderer Modus oder ein nicht verfügbares Entity lässt die Bar bei `bar_color` (oder der Theme-Standardfarbe).
- Bar und Füllung haben dann dieselbe Farbe, der Füllstand ist nicht mehr erkennbar; nur der Griff zeigt die Position.
- Visueller Editor: Schalter „Ganze Bar in der Zustandsfarbe“ im Abschnitt „Layout“.

## Header

`header_position` (`top`, `bottom`, `none`) und `header_icon_position` (`left`, `right`) platzieren den Header. `text.header` setzt Größe, Farbe und Icon-Farbe (siehe [Textdarstellung](#textdarstellung)).

![Header-Icon rechts](/assets/shots/header-icon-right-light.png#only-light)
![Header-Icon rechts](/assets/shots/header-icon-right-dark.png#only-dark)

![Header unter der Bar](/assets/shots/header-bottom-light.png#only-light)
![Header unter der Bar](/assets/shots/header-bottom-dark.png#only-dark)

![Header mit eigener Schriftgröße und Farben](/assets/shots/header-text-light.png#only-light)
![Header mit eigener Schriftgröße und Farben](/assets/shots/header-text-dark.png#only-dark)

## Styling

![Eigene Farben für Bar, Füllung und Griff](/assets/shots/colors-light.png#only-light)
![Eigene Farben für Bar, Füllung und Griff](/assets/shots/colors-dark.png#only-dark)

![Warme Farben mit eckigem Griff](/assets/shots/colors-warm-light.png#only-light)
![Warme Farben mit eckigem Griff](/assets/shots/colors-warm-dark.png#only-dark)

Layout und Farben laufen über CSS-Variablen an der Karte. Setzen per `styles:` (Schlüssel ohne
Präfix `--slabton-` bekommen es automatisch) oder per card-mod.

```yaml
styles:
  bar-color: "#263238"
  fill-color: "#ff9800"
  switch-size: 32px
```

Werte werden geprüft; unsichere Werte werden mit Konsolenwarnung ignoriert.

Der Block [`text:`](appearance.md#textdarstellung) setzt diese Variablen. `styles:` kann sie ebenfalls setzen, ein Wert aus `text:` gewinnt aber gegen `styles:`:
`--slabton-header-size`, `--slabton-header-color`, `--slabton-header-icon-color`,
`--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
`--slabton-button-size`, `--slabton-button-color`. Standardgrößen: Header 14 px, Bar 13 px, Info 13 px, Griff 14 px.

Skala: `--slabton-scale-size` und `--slabton-scale-color` setzen `scale.size` und `scale.color`; `styles:` kann sie überschreiben.
Skala-Beschriftung: `--slabton-scale-label-size` und `--slabton-scale-label-color` (gesetzt durch `text.scale`).
Analoguhr: `--slabton-dial-color` (Striche und Ziffern), `--slabton-hands-color` (Stunden- und Minutenzeiger, Nabe)
und `--slabton-second-hand-color` (Standard: Primärfarbe).

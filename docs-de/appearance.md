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

### Bar-Wert aus einem Attribut

`bar.attribute` lässt die Bar ein Attribut eines Entities statt seines Zustands anzeigen, zum Beispiel die Position
eines Covers oder die gemessene Temperatur eines Thermostats:

```yaml
type: custom:slabton-card
entity: climate.wohnzimmer
bar:
  attribute: current_temperature
  unit: "°C"
bar_text: "{value}"
```

- Das Attribut gehört zu `bar.entity`; ohne `bar.entity` gehört es zu `entity`. Der Attributname besteht aus
  Buchstaben, Ziffern und `_` (höchstens 64 Zeichen), alles andere wird mit Warnung ignoriert.
- Mit Attribut ist die Bar nur lesend. `drag` hat keine Wirkung, der Griff behält seine normalen Aktionen. Im
  Standardmodus `state` sitzt der Griff auf dem gemessenen Wert und lässt sich nicht ziehen. Tippen und Tasten
  funktionieren weiter.
- Skala und Füllkante laufen wie in jedem Modus auf der Griffspur: der Strich eines Wertes steht bei diesem Wert
  unter der Griffmitte, und die Füllung endet dort.
- Einheit: zuerst `bar.unit`, sonst die `unit_of_measurement` des Entities. Climate und Cover haben keine,
  setze `bar.unit` (zum Beispiel `"°C"` oder `"%"`).
- Bereich: zuerst `bar.min` / `bar.max`, sonst die Attribute `min_temp` / `max_temp`, sonst `min` / `max` des
  Entities, sonst 0 bis 100. Climate bringt `min_temp` / `max_temp` mit, Cover nutzt 0 bis 100. Ein Sensor mit
  Zusatzattribut hat keinen eigenen Bereich, setze dort `bar.min` und `bar.max`.
- Die Skala-`labels` zeigen diesen Bereich. Die Labels folgen dem Entity-Bereich zur Laufzeit.
- Fehlendes Attribut, kein Zahlenwert oder ein nicht verfügbares Entity zeigen das Warn-Icon mit dem Grund
  ("Attribut fehlt oder ist keine Zahl") und eine leere Bar. Die Aktionen der Karte bleiben frei. Nur ein
  nicht verfügbares Haupt-`entity` sperrt sie.
- Ein Text zählt wie beim Entity-Zustand als Zahl, also sind `"1e5"` und `"0x10"` Zahlen.
- Für Climate und Cover den Standard-`mode` lassen. Mit `mode: value` folgen Griff und Sperre dem Zustand des
  Entities, und ein Climate hat keinen numerischen Zustand.

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
| `header` | `font_weight` | 500 | Nur der Header-Text (Titel) |
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
- `font_weight` gibt es nur im Bereich `header`: eine Zahl von 1 bis 1000 (`700`), ein Schlüsselwort (`normal`, `bold`, `lighter`, `bolder`) oder eine CSS-Variable wie `var(--font-weight-l)`. Andere Werte werden mit Konsolenwarnung ignoriert.
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
- Alle Modi: die Striche liegen auf dem Laufweg des Griffs (von der Griffmitte am Anfang bis zur Griffmitte am Ende). Der Strich für Wert i/ticks steht genau unter der Griffmitte bei diesem Wert, und die Füllung endet dort. Bei Zustand und Schloss steht jeder Strich genau unter dem Griff bei seinem Zustand. `direction: rtl` spiegelt sie. Ohne `handle_overhang` ist der Laufweg an jedem Ende um eine halbe Griffbreite eingerückt; mit ihm deckt der Laufweg die ganze Bar.
- Uhr: ein Strich je Stunde (24). Mit `clock.hour_format: "12"` gibt es 12 Striche, je zwei Stunden. `auto` ergibt 24 Striche, auch bei 12-Stunden-Sprache. Ein ausdrückliches `ticks` gewinnt.
- Ungültige Werte werden mit Konsolenwarnung ignoriert, es gilt der Standard. Unbekannte Schlüssel werden gewarnt und ignoriert.
- Der Schlüssel `enabled` existiert nur als Schalter im Editor. In YAML wird er gewarnt und ignoriert.
- Noch nicht enthalten: Stunden- und Minutenzeiger auf der Skala. Folgen in späteren Versionen. Die Zeiger der Analoguhr liegen im Griff (`clock.display: analog`).
- Mit eigenem `bar.entity` folgen die Labels diesem Entity, nicht dem Haupt-Entity: Ein `input_number` / `number` ohne `min` und `max` in der Konfiguration zeigt seinen Attributbereich und aktualisiert sich bei Änderungen der Attribute; solange das Entity nicht verfügbar ist, behalten die Labels ihren letzten Text. Jedes andere Bar-Entity nutzt die konfigurierten `min` und `max` (oder 0 und 100).
- Reihenfolge von der Bar nach außen: Bar, Striche, Beschriftung. Sind Striche außen und die Beschriftung innen, steht die Beschriftung in der Bar auf der Seite der Striche, ohne Striche in der Bar.
- `position: center` setzt außen liegende Striche und Beschriftung auf die Startseite (oben bzw. links), da die Mitte der Bar keine Außenseite hat.
- Der Abstand zwischen Bar und außen liegender Beschriftung folgt dem Griff-Überstand, plus 3 px. Waagerechte Karten reservieren dafür Höhe (Schriftgröße der Beschriftung plus 3 px, bei außen liegenden Strichen zusätzlich `size`). Senkrechte Karten reservieren keine Breite: die Dashboard-Spalte bestimmt sie. Mit Strichen und Beschriftung außen braucht eine senkrechte Bar mit der Standard-Dicke `thickness` etwa 105 bis 110 px plus die Breite der längsten Beschriftung (Schätzung). Die Standardbreite von 3 Spalten in einer Sections-Ansicht (Desktop) zeigte in einer Prüfung keine Abschneidung; schmalere Sections (2 Spalten, Handy-Breite) und lange `states`-Namen wurden nicht gemessen. Wird die Karte dort abgeschnitten, ihr im Layout mehr Spalten geben (`grid_options.columns`) oder eine dünnere Bar nehmen.
- Ein Griff, der über die Bar hinausragt (`handle_size` größer als `thickness`, oder `handle_overhang`), hält 4 px Luft zum Kartenrand, zusätzlich zum Karten-Padding und auf den Achsen, in denen er übersteht; die Kartenhöhe zählt das mit (solche Karten sind 8 px höher). Eine senkrechte Karte, deren Griff samt Padding breiter ist als 3 Spalten, verlangt von der Sections-Ansicht mehr Spalten (`columns` und `min_columns`; `handle_size: 120` bekommt 4). Die Spaltenbreite ist von einer Desktop-Section geschätzt (34 px plus 8 px Abstand); schmale Sections wie auf dem Handy wurden nicht gemessen, und `border_width` zählt nicht mit. Ragt der Griff trotzdem aus der Karte, `grid_options.columns` selbst setzen: Ihre `grid_options` gewinnen.
- Alle Modi: Beschriftungen sind auf ihren Strich zentriert, die erste und die letzte auch. Die äußeren Beschriftungen können über die Enden der Bar in den Kartenabstand ragen. Die Karte schneidet sie 18 px hinter den Bar-Enden (plus Griff-Überstand) ab; eine Beschriftung, die weiter reicht, wird abgeschnitten. Die Beschriftungsgröße zählt in die Kartenhöhe aus `text.scale.font_size`, sonst aus einer `styles:`-Überschreibung (`--slabton-scale-label-size`), sonst 10 px; die Strichlänge aus einer `styles:`-Überschreibung (`--slabton-scale-size`), sonst `size`, sonst 8 px. Nur Werte in `px` ("14px") und `0` zählen, da CSS eine bloße Zahl ungleich 0 nicht als Größe akzeptiert: "14", `em`, `rem`, `%`, `var()` und `calc()` zählen nicht, für die Höhe gilt dann der Standard. `text.scale.font_size` gewinnt bei der Beschriftungsgröße gegen `styles:`. Die Beschriftung selbst erscheint weiter in der eingestellten Größe.
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
`--slabton-header-size`, `--slabton-header-color`, `--slabton-header-weight`, `--slabton-header-icon-color`,
`--slabton-bar-text-size`, `--slabton-bar-text-color`, `--slabton-info-size`, `--slabton-info-color`,
`--slabton-button-size`, `--slabton-button-color`. Standardgrößen: Header 14 px, Bar 13 px, Info 13 px, Griff 14 px.

Nur Header, nur als `styles:`-Variablen (keine `text:`-Option): `--slabton-header-opacity` (Standard 1) und `--slabton-header-icon-size` (Standard 20px).

Skala: `--slabton-scale-size` und `--slabton-scale-color` setzen `scale.size` und `scale.color`; `styles:` kann sie überschreiben.
Skala-Beschriftung: `--slabton-scale-label-size` und `--slabton-scale-label-color` (gesetzt durch `text.scale`).
Analoguhr: `--slabton-dial-color` (Striche und Ziffern), `--slabton-hands-color` (Stunden- und Minutenzeiger, Nabe)
und `--slabton-second-hand-color` (Standard: Fehlerfarbe).

### Material-3-Optik

Bar und Griff folgen in jedem Modus Material 3; gesetzte Farben gewinnen gegen diese Standards:

- **Track:** tonale Fläche (Textfarbe mit 12 % über der Kartenfarbe). `bar_color` ersetzt sie.
- **Füllung:** Zustandsfarbe (ohne Zustandsfarbe die Primärfarbe) in voller Stärke. `fill_color` ersetzt die Farbe; die
  Variable `--slabton-fill-opacity` (Standard `1`) setzt die Stärke, `0.85` ist die frühere Optik und hält `bar_text` auf dunkler Füllung lesbar.
- **Griff:** in der Zustandsfarbe gefüllt (ohne Zustandsfarbe die Primärfarbe); Icon und Text werden je nach Helligkeit der Füllung weiß
  oder ein dunkler Ton der Füllfarbe (Umschaltpunkt etwa bei Ton 60 von Material 3). `button_color` überschreibt diese Wahl; `text_color` erreicht den gefüllten Griff nicht, außer `handle_color` ist gesetzt (dann färbt es Text und Zifferblatt des Griffs, nicht das Icon).
  Neben einer Füllung in gleicher Farbe halten ein 2 px Ring in der Kartenfarbe (nicht beim Stickshift) und der Schatten der Stufe 1 den Griff getrennt.
  Solange die Entität nicht verfügbar ist, bleibt der Griff in der Kartenfarbe, damit das Warn-Icon Kontrast behält.
  `handle_color` füllt den Griff mit dieser Farbe, das Icon behält die Zustandsfarbe, z. B. `handle_color: white` mit einer `button_color` für die frühere Optik.
- **State Layer:** Griff, Schalter und Stickshift-Punkte zeigen Hover als 8 %, Fokus und Drücken als 10 % Überlagerung in der Inhaltsfarbe.
  Hover zeigt sich nur auf Geräten mit Hover, ein Tipp am Handy hinterlässt keine Tönung.
  Der Tastaturfokus behält seinen Rahmen. Mit `prefers-reduced-motion` werden die Überlagerungen nicht animiert.
- **Griff-Text:** Ein langer Wert oder eine lange Zeit schrumpft mit der Länge, bis er in den Griff passt (bis 8 px herunter,
  geschätzt mit 0,7 em je Zeichen), danach wird er mit Auslassungspunkten gekürzt. `text.button.font_size` bleibt die Obergrenze.
- **Balkentext und Timer-Info:** Wo `bar_text` oder die Timer-`info` auf der Füllung liegen, nehmen sie deren Kontrastfarbe (weiß oder ein dunkler Ton,
  gewählt wie beim Griff); auf dem Track bleiben sie in der Textfarbe des Themes. Mit `bar_state_color` gilt der ganze Balken als Füllung.
  `text_color`, `bar_text_color` und `info_color` überschreiben das. Eine vertikale `info` steht außerhalb des Balkens und bleibt unverändert.
- **Schalter:** Sie übernehmen die Form von `handle_shape` (`round`, `oval`, `square`). Ein ovaler Schalter ist nie länger als der Griff.

Browser ohne Relative Colors (vor Chrome 119, Safari 16.4, Firefox 128) nehmen für das Griff-Icon immer die Textfarbe des Themes auf Primär,
die auf heller Füllung schlecht lesbar sein kann; dort `button_color` setzen. `bar_text` und `info` behalten die Textfarbe des Themes.
Ohne `color-mix` (vor Chrome 111, Safari 16.2, Firefox 113) behält der Track den sekundären Hintergrund des Themes.

## Stickshift

Aussehen der Punkte, und der Kulisse des [Stickshift](modes.md#stickshift). Die Optionen setzen diese Variablen, `styles:` kann sie überschreiben:

| Variable | Gesetzt durch | Standard |
| --- | --- | --- |
| `--slabton-sx-d` | `point_size` | 80 % von `handle_size` |
| `--slabton-sx-opacity` | `point_opacity` | `0.55` |
| `--slabton-sx-gate-size` | `gate.size` | `4px` |
| `--slabton-sx-gate-color` | `gate.color` | Textfarbe mit 50 % |

```yaml
type: custom:slabton-card
entity: input_select.heizung_modus
stickshift:
  shape: square
  active_color: white
  gate: { size: 3, color: grey }
states:
  - { value: "Aus", icon: mdi:power, color: blue }
  - { value: "Auto", icon: mdi:calendar-clock, color: green }
  - { value: "An", icon: mdi:fire, color: red }
```

Die Kulisse läuft nur zwischen den Punkten (von Rand zu Rand, nicht dahinter) und hat einen festen Stil: keine Zustandsfarbe und keine Fortschrittsfüllung (`bar_state_color` färbt die Bar,
nicht die Kulisse). Der Griff am aktiven Punkt ist mit `active_color` gefüllt, sonst mit der `color` des Zustands, sonst
mit der Primärfarbe; Icon und Text werden nach der Helligkeit der Füllung weiß oder ein dunkler Ton der Füllfarbe (Umschaltung etwa bei
Tone 60 von Material 3; `button_color` überschreibt das, `text_color` erreicht den gefüllten Griff nicht, außer `handle_color` ist gesetzt; Browser ohne relative Farben
(vor Chrome 119, Safari 16.4, Firefox 128) nehmen immer die Theme-Textfarbe auf Primär, was auf heller Füllung schlecht
lesbar sein kann, dort `button_color` setzen). Ein `--slabton-handle-color` aus `styles:` füllt den Griff wie
`handle_color`, die Icon-Farbe bleibt aber nur bei `handle_color` erhalten. Ist die
Entity nicht verfügbar, bleibt der Griff in der Kartenfarbe, damit das Warn-Icon lesbar bleibt. Inaktive Punkte sind eine getönte Fläche mit weichem Rand, Hover ist eine 8-%-, Fokus und Drücken eine
10-%-Überlagerung (Material-3-State-Layer). Bei `prefers-reduced-motion` animieren die Punkte nicht.

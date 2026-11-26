# Konfiguration

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

## Schnellstart im visuellen Editor

Eine Karte, die noch nicht eingerichtet ist (nur `type`, `entity` und `name`), zeigt im visuellen Editor über dem
Formular einen **Schnellstart**: Kacheln mit Live-Vorschau und Kurztext. Eine Kachel wählen, und der Editor trägt die
Optionen ein:

| Kachel | Frage | Ergebnis |
| --- | --- | --- |
| Keine | keine | Schließt den Schnellstart, die Config bleibt wie sie ist |
| Uhr | keine | `mode: clock` |
| Timer | eine `timer.*`-Entity | `entity`, `mode: timer` |
| Schloss | eine `lock.*`- oder `alarm_control_panel.*`-Entity | `entity`, `mode: lock` |
| Thermometer | ein Temperatur-`sensor.*` | `entity`, `mode: value`, `preset: thermometer` |

- Das Ergebnis ist eine normale Config: jede Option bleibt im Formular und im Code-Editor änderbar, nichts verweist auf die Kachel zurück.
- Eine Kachel **ersetzt** die Optionen der Karte (Schlüssel, die Home Assistant selbst verwaltet, etwa `grid_options` und `visibility`, bleiben). Der Editor von Home Assistant hat kein Rückgängig; wähle "Keine", wenn die Karte schon passt.
- Den Schnellstart gibt es nur im visuellen Editor, nicht in YAML. Er ist nicht dasselbe wie `preset:`, das nur Bereichs-Vorgaben für den Modus `value` setzt.
- Sobald die Karte eine weitere Option hat, erscheint der Schnellstart nicht mehr.

## Allgemeine Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `entity` | Pflicht (nicht bei `clock`) | Entity-ID |
| `mode` | nach Domain | `state`, `lock`, `value`, `counter`, `timer`, `clock` |
| `bar` | keiner | Bar-Wert getrennt vom Button, auch aus einem Attribut (`bar.attribute`), siehe [Bar-Wert](appearance.md#bar-wert) |
| `bar_text` | keiner | Text in der Bar mit [Platzhaltern](appearance.md#platzhalter) |
| `name` | keiner | Header-Text |
| `icon` | nach Modus | Header- und Griff-Icon |
| `header_position` | `top` | `top`, `bottom`, `none` |
| `header_icon_position` | `left` | `left` (wie bei der Tile-Karte), `right`, `none` (kein Icon im Header, der Name bleibt) |
| `header_align` | `start` | `start`, `center`, `end`: Lage von Icon und Name in der Header-Zeile |
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
| `bar_state_color` | `false` | `true` färbt die ganze Bar in der Farbe des aktuellen Zustands (`states[].color`), siehe [Zustandsfarbe](appearance.md#zustandsfarbe) |
| `styles` | keine | Map mit CSS-Variablen, siehe [Styling](appearance.md#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | nach Modus | HA-Aktionen plus `cycle`, `cycle_back` |
| `switches` | keine | `start`, `mid`, `end`, je mit `entity`, `icon`, `name`, `states`, Aktionen, siehe [Switch-Zustände](#switch-zustande-und-griff-zonen) |
| `handle_zones` | keine | `start`, `mid`, `end`, je mit eigenen Aktionen, `entity`, `icon`, `states` für den Griff |
| `text` | Standardwerte | Schriftgröße und Farbe je Textbereich, siehe [Textdarstellung](appearance.md#textdarstellung) |
| `scale` | keine | Striche und Beschriftung, je innen oder außerhalb der Bar, siehe [Skala](appearance.md#skala) |

Ein `cover`-Entity läuft ohne weitere Optionen im Modus `value`: Ziehen setzt die Position, Tippen schaltet um, Halten stoppt, siehe [Covers](modes.md#covers).

`call-service` (mit `service` / `service_data`) wird als veralteter Alias von `perform-action` akzeptiert und kann in einer späteren Version entfallen.

## Switch-Zustände und Griff-Zonen

`switches.<slot>` (`start`, `mid`, `end`) kann den Zustand einer eigenen Entity zeigen. Jeder Eintrag in `states` hat einen `value` (Zustand der Entity), ein `icon`, eine `color` für das Icon (CSS-Farbe oder `var(--…)`) und optional ein `label`, das als zugänglicher Name `name` ersetzt. Ohne Treffer (auch `unavailable` / `unknown`) behält der Switch sein `icon` und hat keine Farbe.

```yaml
type: custom:slabton-card
entity: cover.wohnzimmer
name: Rollladen Wohnzimmer
switches:
  end:
    entity: sensor.cover_living_room_mode
    icon: mdi:calendar-clock
    name: Auto / Stopp
    tap_action:
      action: perform-action
      perform_action: script.cover_living_room_toggle_auto
    states:
      - { value: auto, icon: mdi:calendar-clock, color: green }
      - { value: heat_protection, icon: mdi:weather-sunny, color: orange }
      - { value: nap, icon: mdi:sleep, color: blue }
      - { value: "off", icon: mdi:power, color: grey, label: Auto aus }
```

`handle_zones` teilt die Griff-Position in Drittel: `start` unter einem Drittel, `mid` bis zwei Drittel, `end` darüber. Das gilt in jedem Modus. Die Position ist die logische, bei `direction: rtl` liegt `start` also optisch rechts. Jede Zone kann eigene `tap_action`, `double_tap_action` und `hold_action` haben (ohne Eintrag gilt die Karten-Aktion oder der Modus-Standard) sowie `entity`, `icon` und `states` für das Griff-Icon. Eine Zonen-Aktion läuft auf der `entity` der Zone, wenn es eine gibt. `icon` und `states` der Zone brauchen `handle_content: icon`; die Icon-Farbe entfällt beim Warn-Icon.

```yaml
handle_content: icon
handle_zones:
  start:
    entity: sensor.cover_living_room_mode
    hold_action:
      action: perform-action
      perform_action: script.cover_living_room_pause_auto
    states:
      - { value: auto, icon: mdi:calendar-clock, color: green }
      - { value: "off", icon: mdi:power, color: grey }
```

## Nicht verfügbare Entitäten

Ist die Entität `unavailable` oder `unknown`, zeigt der Griff ein Warn-Icon. Der Grund steht im Tooltip und für
Screenreader. Die Karte ist gesperrt: Ein Tippen öffnet more-info, Gesten und Pfeiltasten tun nichts.

- `allow_unavailable_actions: true` (nur Modus `state`, Standard `false`) hält Tippen, Halten, Doppeltippen, Ziehen und
  Pfeiltasten aktiv. Der Modus `lock` bleibt bewusst gesperrt; andere Modi ignorieren die Option mit einer Warnung.
- Die Sperre gilt für `cycle`, `cycle_back` und `toggle` auf der Hauptentität. Eine selbst konfigurierte
  `perform-action` ist nicht gesperrt, auch wenn sie die Hauptentität anspricht.
- Bei aktiver Option sendet ein Tippen auf eine Toggle-Entität (`switch`, `light`, ...) in unbekanntem Zustand zuerst
  `off` (der erste Zustand des Zyklus). Ein `select` ohne Optionsliste sendet nichts.
- Der Griff bleibt im gesperrten Zustand fokussierbar (`aria-disabled="true"`), damit Enter / Leertaste more-info
  öffnen kann.
- Template-Entitäten: `availability` unabhängig von optionalen Hilfsentitäten halten. Fehlt eine Hilfsentität, ist die
  Karte gesperrt.

## Größe in der Sections-Ansicht

Die Karte belegt 6 Spalten waagerecht (3 senkrecht; eine senkrechte Karte mit breiterem Griff belegt mehr, zum Beispiel 4 bei `handle_size: 120`) und legt keine feste Zeilenzahl fest: Die Höhe folgt dem Inhalt
(`rows: "auto"`). Ältere Dashboards können die Höhe noch fest vorgeben und sollten das entfernen:

- `card_mod` mit fester Höhe, zum Beispiel `ha-card { height: 122px; }`: entfernen. Eine feste Höhe schneidet Inhalt
  ab, der wächst (Beschriftungen, Striche, ein größerer Griff).
- `grid_options: rows: <Zahl>` in der Kartenconfig: aus demselben Grund entfernen.
- `grid_options: columns: ...` (und die übrigen Schlüssel) überschreiben die Standardwerte der Karte weiterhin, je
  Schlüssel. Damit wird die Karte breiter, zum Beispiel `columns: 12` für die volle Breite.

## Stickshift-Aktionen

Mit [`stickshift:`](modes.md#stickshift) kann jeder Eintrag von `states` eine eigene `tap_action`, `double_tap_action`
und `hold_action` haben. Sie nutzen dieselbe Aktions-Syntax wie die Karte, und eine Aktion kann eine eigene `entity` nennen,
unabhängig von der Haupt-Entity (wie bei den Griff-Zonen oben):

```yaml
type: custom:slabton-card
entity: input_select.lade_modus
stickshift: true
states:
  - { value: "Stopp", icon: mdi:stop }
  - value: "Auto"
    icon: mdi:flash-auto
    tap_action: { action: toggle, entity: switch.ladegeraet }
  - value: "Boost"
    icon: mdi:flash
    hold_action: { action: more-info, entity: sensor.ladegeraet_leistung }
```

Die `tap_action` eines Punkts läuft nach dem Zustandswechsel, der auf ihm landet (Tipp auf den Punkt, Ziehen, Pfeiltaste).
Ein Tipp auf den aktiven Punkt führt nur dessen Aktion aus; Doppeltipp und Halten wirken nur auf dem aktiven Punkt und
ändern den Zustand nie. Ohne `stickshift:` werden diese Schlüssel eines Zustands ignoriert.

Ein Punkt kann außerdem den Zustand einer eigenen Entity anzeigen, wie eine Griff-Zone: dem Zustand eine `entity` und eine
`states`-Liste (`value`, `icon`, `color`, `text`) geben. Icon, Farbe und Text des passenden Eintrags ersetzen die des
Punkts, und der Griff zeigt sie, solange der Punkt aktiv ist. Die `entity` eines Zustands speist nur diese Anzeige: eine
Aktion wirkt auf die Haupt-Entity, sofern sie nicht eine eigene `entity` nennt. Die `hold_action` unten schaltet um, der Punkt
zeigt, welcher Wert gilt:

```yaml
states:
  - value: "Auto"
    icon: mdi:solar-power
    entity: select.lade_min
    states:
      - { value: "pv", icon: mdi:solar-power, color: green }
      - { value: "min", icon: mdi:solar-power-variant-outline, color: orange }
    hold_action: { action: perform-action, perform_action: script.toggle_lade_min }
```

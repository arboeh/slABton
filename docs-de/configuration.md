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


## Allgemeine Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `entity` | Pflicht (nicht bei `clock`) | Entity-ID |
| `mode` | nach Domain | `state`, `lock`, `value`, `counter`, `timer`, `clock` |
| `bar` | keiner | Bar-Wert getrennt vom Button, siehe [Bar-Wert](appearance.md#bar-wert) |
| `bar_text` | keiner | Text in der Bar mit [Platzhaltern](appearance.md#platzhalter) |
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
| `handle_content` | `icon` (`text` bei `value`, `counter`, `timer`, `clock`) | `icon`, `position`, `text`, `none` |
| `border_width` | 0 | Rand der Bar in px |
| `border_radius` | automatisch | Eckenradius der Bar in px |
| `animation` | `slide` | `none`, `slide`, `fade`, `pulse`, `shimmer` |
| `bar_color`, `fill_color`, `handle_color`, `text_color`, `border_color` | Theme | CSS-Farben |
| `styles` | keine | Map mit CSS-Variablen, siehe [Styling](appearance.md#styling) |
| `tap_action`, `double_tap_action`, `hold_action` | nach Modus | HA-Aktionen plus `cycle`, `cycle_back` |
| `switches` | keine | `start`, `mid`, `end`, je mit `entity`, `icon`, `name`, Aktionen |
| `text` | Standardwerte | Schriftgröße und Farbe je Textbereich, siehe [Textdarstellung](appearance.md#textdarstellung) |
| `scale` | keine | Striche und Beschriftung, je innen oder außerhalb der Bar, siehe [Skala](appearance.md#skala) |

`call-service` (mit `service` / `service_data`) wird als veralteter Alias von `perform-action` akzeptiert und kann in einer späteren Version entfallen.

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

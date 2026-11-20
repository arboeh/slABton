# Installation

## HACS

<p style="margin: 1.5rem 0;"><a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=arboeh&repository=slABton&category=plugin"><img alt="Dieses Repository in HACS öffnen" src="https://my.home-assistant.io/badges/hacs_repository.svg"></a></p>

1. HACS öffnen und nach **slABton** suchen.
2. **slABton** herunterladen, Browser neu laden.

Rückfall, falls die Suche es nicht findet: HACS, Dreipunktmenü, **Benutzerdefinierte Repositories**,
`https://github.com/arboeh/slABton` hinzufügen, Typ **Dashboard**, danach wie oben installieren.

HACS legt die Dashboard-Ressource selbst an. Nur Dashboards im YAML-Modus brauchen sie von Hand:

```yaml
resources:
  - url: /hacsfiles/slABton/slabton.js
    type: module
```

## Manuell

1. `dist/slabton.js` nach `/config/www/slabton.js` kopieren.
2. Dashboard-Ressource vom Typ **JavaScript-Modul** anlegen:

    ```yaml
    url: /local/slabton.js
    type: module
    ```

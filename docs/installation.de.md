# Installation

## HACS (benutzerdefiniertes Repository)

1. HACS, Dreipunktmenü, **Benutzerdefinierte Repositories**.
2. `https://github.com/arboeh/slABton` hinzufügen, Typ **Dashboard**.
3. **slABton** installieren, Browser neu laden.

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

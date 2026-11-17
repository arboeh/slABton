# Installation

## HACS (custom repository)

<p style="margin: 1.5rem 0;"><a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=arboeh&repository=slABton&category=plugin"><img alt="Open this repository in HACS" src="https://my.home-assistant.io/badges/hacs_repository.svg"></a></p>

1. HACS, three-dot menu, **Custom repositories**.
2. Add `https://github.com/arboeh/slABton`, type **Dashboard**.
3. Install **slABton**, reload the browser.

HACS adds the dashboard resource itself. Only dashboards in YAML mode need it by hand:

```yaml
resources:
  - url: /hacsfiles/slABton/slabton.js
    type: module
```

## Manual

1. Copy `dist/slabton.js` to `/config/www/slabton.js`.
2. Add a dashboard resource of type **JavaScript module**:

    ```yaml
    url: /local/slabton.js
    type: module
    ```

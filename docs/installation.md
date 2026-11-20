# Installation

## HACS

<p style="margin: 1.5rem 0;"><a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=arboeh&repository=slABton&category=plugin"><img alt="Open this repository in HACS" src="https://my.home-assistant.io/badges/hacs_repository.svg"></a></p>

1. Open HACS and search for **slABton**.
2. Download **slABton**, reload the browser.

Fallback if the search does not find it: HACS, three-dot menu, **Custom repositories**, add
`https://github.com/arboeh/slABton`, type **Dashboard**, then install as above.

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

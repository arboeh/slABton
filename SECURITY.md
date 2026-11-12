# Security Policy

## Supported versions

Only the latest released version receives fixes.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting ("Security" tab of the repository, "Report a vulnerability").
Include the card version, Home Assistant version and a minimal config that reproduces the problem.

## Scope notes

- Swipe to lock / unlock is a **convenience gesture, not a security boundary**.
  Anyone with access to the dashboard can call the same services. Do not rely on the
  card to protect an alarm panel or a door lock.
- Arrow keys do not lock or unlock: in lock mode only the swipe (or an explicitly
  configured action) changes the state, so a stray key press cannot open a door.
- The card configuration is trusted. Everyone who can edit a dashboard can make a
  card call any Home Assistant service (`perform-action` with `target` and `data`),
  as with every other card. Do not let untrusted users edit dashboards.
- Do not put alarm codes or other secrets in the card configuration. Dashboard
  configs are readable by every user who can open the dashboard.
- Config values are validated before they reach the DOM, CSS or a service call.
  `url` actions accept only `http:` and `https:` links.

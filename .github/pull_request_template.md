## Description

<!-- Brief description of what this PR changes -->

## Related Issue

<!-- Link to issue, e.g. Closes #123 -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Maintenance / refactoring

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes and `dist/slabton.js` is rebuilt
- [ ] CHANGELOG.md updated if version changed
- [ ] `package.json` version matches `src/version.js` (`npm run check-version`)
- [ ] Config keys use `snake_case` (e.g., `tap_action`, `handle_shape`)
- [ ] All user-supplied config values are validated/escaped before DOM, CSS or service use
- [ ] `safeUrl` is used for any URL action (only `http:`/`https:` allowed)

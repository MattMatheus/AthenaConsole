# Deployment Smoke Checks

Use this guide to validate static route integrity and internal links before handoff or deployment.

## Commands

1. Build static output:
   - `npm run build`
2. Run smoke checks against `dist/`:
   - `npm run check:static`
3. One-shot combined validation:
   - `npm run validate:deploy`

## Smoke-Check Contract (v1)

Required routes that must resolve in static output:

- `/`
- `/blog`
- `/docs`
- `/blog/introducing-team-orchestrator`
- `/docs/getting-started`

The checker also scans generated HTML pages for internal anchor links and fails if target paths do not resolve in `dist/`.

## Scope and Behavior

- Checks only internal links (same-origin paths).
- Ignores external URLs and non-page protocols:
  - `http(s)` external origins
  - `mailto:`
  - `tel:`
  - hash-only anchors (`#section`)
- Runs deterministically against local static output.

## CI Guidance

- Prefer running `npm run validate:deploy` in CI after dependency install.
- Keep the required-route contract intentionally small to avoid noisy failures.
- Update this document and `scripts/smoke-check-static-output.mjs` together when route policy changes.

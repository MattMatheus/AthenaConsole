# Competitive Demo Smoke Checklist

Use this checklist from a clean browser session before claiming the competitive demo path is ready.

## Setup

- Start the API and console with a fresh profile or private browser window.
- Use an Admin identity (`console`) and a valid API token.
- Ensure at least one bundled software-team pack is loaded.
- For model-backed steps, configure one OpenAI-compatible provider with a `local-file` secret under `/run/secrets/athena`.

## Script

1. Open the console and confirm the readiness panel separates required failures from optional provider/server warnings.
2. Open Start Work and choose a repository-backed capability.
3. Confirm preflight shows repository, provider, permissions, memory, and policy readiness before execution.
4. Run a read-only repository summary task.
5. Open the run detail and inspect timeline events, agent sidecar events, provider metadata, and artifact links.
6. Open the primary markdown artifact and confirm it renders without raw provider secrets.
7. Open governance audit and confirm RBAC/policy/secret-read events are discoverable for the demo actor.
8. Create or review a durable-memory proposal from the run and approve/reject it as an Admin.
9. Open capability authoring docs or pack manifest detail and identify where the same workflow would be packaged.

## Expected Gaps

- Guided preflight is available at task run-readiness level, but a shared Start Work component is still tracked by `PRODUCT-001`.
- Audit search currently covers policy/RBAC categories and secret-read events exist in the event stream; full audit search/export expansion remains `ENTERPRISE-004`.
- Evidence bundle export remains `OBS-001`; run detail has evidence primitives but not a portable bundle.

<!-- AUDIENCE: Public/Internal -->

# Team Orchestrator Documentation

This is the canonical documentation map for the repo. Start here when deciding which docs are current and which are historical.

## New Local Operator

Use these when you want to install Team Orchestrator, start the console, connect a provider, connect a repo, run work, and inspect results.

1. [Getting Started](../GETTING_STARTED.md)
2. [Copy The Model Provider Smoke Agent](../packages/core/docs/user/10-copy-sample-agent.md)
3. [Fresh Server Real-Work Walkthrough](developer/product-dev-guides/fresh-server-real-work-walkthrough.md)

## Local Server Admin

Use these when you want a durable trusted-LAN install with persistent state, plugin paths, repo storage, and secrets.

1. [Local Server Deployment](developer/product-dev-guides/local-server-deployment.md)
2. [Fresh Server Real-Work Walkthrough](developer/product-dev-guides/fresh-server-real-work-walkthrough.md)
3. [State Ownership Map](product/architecture/state-ownership-map.md)

## Agent Author

Use these when you want to create or adapt a plugin-backed agent.

1. [Build Your First Agent](../packages/core/docs/user/07-pdk-guide.md)
2. [Copy The Model Provider Smoke Agent](../packages/core/docs/user/10-copy-sample-agent.md)
3. [Agent Developer Kit Package](../packages/pdk/README.md)
4. Sample plugins:
   - `sample-plugins/first-run-demo/`
   - `sample-plugins/model-provider-smoke/`
   - `sample-plugins/local-user-test/`
   - `sample-plugins/repo-summary/`
   - `sample-plugins/generic-research/`

## Contributor

Use these when you want to change the product or understand the current implementation direction.

1. [Developer Guides](developer/product-dev-guides/README.md)
2. [Current Product Direction](product/direction/current-direction.md)
3. [Architecture Decisions](product/architecture/decisions/README.md)
4. [Roadmap Flight Path](product/roadmap/flight-path.md)
5. [Repository Cleanup Audit](product/audits/2026-05-30-repo-cleanup-audit.md)

## Internal Workflow

Workflow state does not live in `docs/`. Use the Flywheel harness for active queues, handoffs, QA gates, observer records, and cycle closure:

- `flywheel.yaml`
- `flywheel/README.md`
- `flywheel/backlog/`
- `flywheel/artifacts/`

## Historical Context

Archived and completed planning records remain useful for rationale, but they are not the current user path:

- `docs/product/archive/`
- `docs/product/history/`
- `docs/product/research/`

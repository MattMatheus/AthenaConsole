<!-- AUDIENCE: Public/Internal -->

# Team Orchestrator Documentation

This is the canonical documentation map for the repo. Start here when deciding which docs are current and which are historical.

## New Local Operator

Use these when you want to install Team Orchestrator, start the console, connect a provider, connect a repo, run work, and inspect results.

1. [Team Orchestrator User Guide](user-guide/README.md)
2. [Getting Started](../GETTING_STARTED.md)
3. [Copy The Model Provider Smoke Agent](../packages/core/docs/user/10-copy-sample-agent.md)
4. [Fresh Server Real-Work Walkthrough](developer/product-dev-guides/fresh-server-real-work-walkthrough.md)

## Local Server Or Enterprise Admin

Use these when you want a durable trusted-LAN install, or when you are evaluating the enterprise path around workspace scope, RBAC, cost governance, and Postgres readiness.

1. [Local Server Deployment](developer/product-dev-guides/local-server-deployment.md)
2. [Deployment Automation](developer/product-dev-guides/deployment-automation.md)
3. [Fresh Server Real-Work Walkthrough](developer/product-dev-guides/fresh-server-real-work-walkthrough.md)
4. [State Ownership Map](product/architecture/state-ownership-map.md)
5. [Enterprise Direction ADR](product/architecture/decisions/0027-enterprise-multi-user-direction.md)
6. [Security Gap Sweep](product/security/security-critical-gap-sweep-2026-06-13.md)

## Agent Author

Use these when you want to create or adapt a plugin-backed agent.

1. [Team Orchestrator User Guide](user-guide/README.md#create-a-plugin-backed-agent)
2. [Build Your First Agent](../packages/core/docs/user/07-pdk-guide.md)
3. [Copy The Model Provider Smoke Agent](../packages/core/docs/user/10-copy-sample-agent.md)
4. [Capability Pack Authoring](developer/product-dev-guides/capability-pack-authoring.md)
5. [Agent Developer Kit Package](../packages/pdk/README.md)
6. Sample plugins:
   - `sample-plugins/first-run-demo/`
   - `sample-plugins/model-provider-smoke/`
   - `sample-plugins/local-user-test/`
   - `sample-plugins/repo-summary/`
   - `sample-plugins/generic-research/`
   - `sample-plugins/code-review/`

## Contributor

Use these when you want to change the product or understand the current implementation direction.

1. [Developer Guides](developer/product-dev-guides/README.md)
2. [Current Product Direction](product/direction/current-direction.md)
3. [Architecture Decisions](product/architecture/decisions/README.md)
4. [Roadmap Flight Path](product/roadmap/flight-path.md)
5. [Enterprise Direction ADR](product/architecture/decisions/0027-enterprise-multi-user-direction.md)
6. [Release Readiness](product/release/README.md)

## Internal Workflow

Workflow state does not live in `docs/`. Use the Flywheel harness for active queues, handoffs, QA gates, observer records, and cycle closure:

- `flywheel.yaml`
- `flywheel/README.md`
- `flywheel/backlog/`
- `flywheel/artifacts/`

Completed Flywheel stories and point-in-time planning/observer records are archived under `flywheel/archive/`.

## Historical Context

Completed planning and research records remain useful for rationale, but they are not the current user path:

- `docs/product/epics/completed/`
- `docs/product/research/`
- `plans/archive/completed-001-019/`
- `flywheel/archive/`

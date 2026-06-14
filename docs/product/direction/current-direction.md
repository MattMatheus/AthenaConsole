<!-- AUDIENCE: Internal/Technical -->

# Current Product Direction

Team Orchestrator is a local-first, enterprise-capable agent work control plane.

The 2026.1 release established the local baseline: a console and API for plugin-backed agents, task and mission work, workflow-template DAG runs, provider setup, repository context, run inspection, artifacts, approvals, and safety limits. Current main now extends that baseline toward multi-user enterprise operation.

The accepted enterprise direction is [ADR 0027: Enterprise And Multi-User Direction](../architecture/decisions/0027-enterprise-multi-user-direction.md).

## Product Center

The product center is:

- manifest-backed agents packaged in plugins and first-party capability packs,
- outcome-led Start Work flows backed by tasks, missions, and workflow templates,
- durable app-state with SQLite as the local default and Postgres-readiness as the server direction,
- inspectable runs, events, artifacts, memory, costs, approvals, and histories,
- workspace, RBAC, usage, and budget controls for enterprise operation,
- a console that lets operators create, run, inspect, govern, and schedule work.

## Directional Posture

Use this posture in new work:

- Local-first remains the easiest default path and the supported development loop.
- Trusted-server and multi-user operation are in scope, but must be gated by server-bound identity, workspace membership, authorization, cost governance, and durable app-state boundaries.
- Enterprise capability should strengthen the agent work model, not replace it with a generic infrastructure dashboard.
- Historical single-user/local-only statements are release-history context, not current product direction.

## Canonical Decisions

Current product direction starts from the accepted reset ADRs and the enterprise direction ADR:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
- `docs/product/architecture/decisions/0008-plugin-package-format.md`
- `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
- `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- `docs/product/architecture/decisions/0011-runtime-backend-interface.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
- `docs/product/architecture/decisions/0014-scheduling-model.md`
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`
- `docs/product/architecture/decisions/0017-repo-wiring-operating-model.md`
- `docs/product/architecture/decisions/0018-real-work-enablement-operating-model.md`
- `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
- `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`
- `docs/product/architecture/decisions/0021-durable-memory-namespace-and-provenance-model.md`
- `docs/product/architecture/decisions/0022-durable-memory-local-cache-boundary.md`
- `docs/product/architecture/decisions/0023-durable-memory-remote-backend-recommendation.md`
- `docs/product/architecture/decisions/0024-semantic-memory-retrieval-and-sync-strategy.md`
- `docs/product/architecture/decisions/0025-product-intuition-and-start-work-ia.md`
- `docs/product/architecture/decisions/0026-formal-agent-manifest-convention.md`
- `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`
- `docs/product/architecture/decisions/0028-workspace-lifecycle-and-scoped-rbac.md` (Proposed)
- `docs/product/architecture/decisions/0029-cost-governance-budgets-and-alerts.md` (Proposed)

ADRs are retained as canonical history. Completed epics remain reference material under `docs/product/epics/completed/`. Completed Flywheel stories and point-in-time observer/planning artifacts are archived under `flywheel/archive/`.

## Delivered Baseline

The delivered baseline includes:

- SQLite app-state repositories for plugins, agents, tasks, missions, runs, events, artifacts, schedules, workflow templates, workflow DAG runs, directives, harness profiles, run templates, provider config, repository context, durable memory, usage, and workspace-scoped records.
- Plugin and agent manifest validation, indexing, first-party packs, sample plugins, and authoring docs.
- Task, mission, workflow-template, schedule, and run-inspection APIs and console surfaces.
- Workflow-template DAG parsing, execution, recovery, schedule execution, and visual status inspection.
- Runtime safety defaults, policy packs, approvals, loop/tool-call limits, proposed-change modes, and provider readiness checks.
- Durable memory provider contracts, remote-capable memory service work, governance review, semantic retrieval, and sync backend foundations.
- Connector platform foundations plus first-party software-team and GitHub connector packs.
- Start Work, resources, capabilities, work history, review, and advanced/admin console information architecture.

## Current Roadmap

The current roadmap has three layers:

1. **Local baseline**: shipped as 2026.1 and preserved as the default developer/operator path.
2. **Capability baseline**: durable memory, first-party packs, connector foundations, GitHub, and deferred knowledge-work connectors.
3. **Enterprise readiness**: workspace lifecycle and scoped RBAC, cost governance, Postgres-readiness, and multi-user alpha security gates.

Roadmap details live in:

- `docs/product/roadmap/flight-path.md`
- `docs/product/roadmap/future-horizon.md`
- `plans/README.md`

## Active Planning Boundary

The live plan set is `plans/021-023`:

- `021-workspace-entity-design-spike.md`
- `022-cost-governance-design.md`
- `023-postgres-readiness-spike.md`

Plans 001-019 are complete and archived under `plans/archive/completed-001-019/`. Plan 020 is superseded by ADR 0027 and archived under `plans/archive/superseded-020-enterprise-direction-adr/`.

Do not start enterprise implementation work until the relevant design plans and ADRs are reviewed. In particular, multi-user exposure must not precede workspace lifecycle, server-derived workspace membership, authorization enforcement, and cost-governance decisions.

## Promotion Rule

A story should not become active unless it has:

- a Flywheel item in `flywheel/backlog/engineering/active/` or `flywheel/backlog/architecture/active/`,
- a source epic, ADR, or accepted plan in the current Team Orchestrator direction,
- acceptance criteria and validation expectations,
- an entry in the relevant active lane README,
- valid Flywheel metadata/frontmatter.

Old or candidate material can inspire stories, but it must be rewritten into this structure before execution.

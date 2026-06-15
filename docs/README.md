<!-- AUDIENCE: Public/Internal -->

# Team Orchestrator Documentation

Canonical documentation map. Start here to find current, authoritative docs.

Writing conventions for all docs: [conventions.md](conventions.md).

---

## Operators — Run Work

Use these when you want to connect a provider or repository, run agent work, inspect results, manage workspaces, and govern your team's usage.

1. [User Guide](user-guide/README.md) — install, deploy, configure, run work, inspect history, manage workspaces and governance
2. [Getting Started](../GETTING_STARTED.md) — shortest startup path for a new local install

---

## Admins / Enterprise — Deploy and Govern Teams

Use these when you are deploying a shared server, configuring workspace membership and RBAC, enforcing cost controls, or evaluating security readiness.

1. [User Guide — Operations and Admin](user-guide/README.md) — workspace lifecycle, roles, cost governance, retention, and admin operations
2. [Security Gap Sweep](product/security/security-critical-gap-sweep-2026-06-13.md) — known gaps and mitigations for shared deployments
3. [Enterprise Direction ADR](product/architecture/decisions/0027-enterprise-multi-user-direction.md) — accepted architectural decisions for multi-user operation

---

## Engineers / Integrators — SDK and API

Use these when you want to author plugin-backed agents, call the HTTP control-plane API, or integrate with Team Orchestrator programmatically.

1. [SDK and Integration Guide](sdk/README.md) — Agent Developer Kit (PDK) and HTTP control-plane API reference

---

## Contributors — Change the Product

Use these when you want to understand the current implementation direction or contribute to the codebase.

1. [Developer Guides](developer/product-dev-guides/README.md)
2. [Current Product Direction](product/direction/current-direction.md)
3. [Architecture Decisions](product/architecture/decisions/README.md)
4. [Roadmap Flight Path](product/roadmap/flight-path.md)

---

## Internal Workflow

Workflow state does not live in `docs/`. Use the Flywheel harness for active queues, handoffs, QA gates, observer records, and cycle closure:

- `flywheel.yaml`
- `flywheel/README.md`
- `flywheel/backlog/`
- `flywheel/artifacts/`

Completed Flywheel stories and point-in-time planning/observer records are archived under `flywheel/archive/`.

---

## Historical Context

ADRs are the canonical decision history and do not expire. Completed epics, plans, and Flywheel artifacts are retained in git history.

- `docs/product/architecture/decisions/` — Architecture Decision Records
- `docs/product/research/` — point-in-time research and evaluations
- `plans/archive/completed-001-019/` — completed implementation plans
- `flywheel/archive/` — completed Flywheel stories and observer records

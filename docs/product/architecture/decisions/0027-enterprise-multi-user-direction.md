<!-- AUDIENCE: Internal/Technical -->

# ADR 0027: Enterprise And Multi-User Direction

## Status

Accepted.

## Context

Team Orchestrator started as a local-first console for a single operator running inspectable agent work. That posture produced the 2026.1 release candidate and remains the supported default startup path.

The codebase has since moved beyond that identity. Current main includes:

- RBAC roles and authorization modes for viewer/operator/admin enforcement.
- Workspace-scoped records and a seeded `default` workspace.
- Usage and cost ledger records keyed by user and workspace.
- Distributed locking and worker heartbeat primitives.
- Postgres migration design work for a non-SQLite app-state backend.
- Security review framed around multi-user alpha readiness.

Those investments are not incidental cleanup. They introduce enterprise concerns: workspace lifecycle, identity binding, authorization, cost governance, multi-node durability, and auditable control-plane operations.

The prior docs made enterprise and hosted multi-user operation sound out of scope. That is now misleading. The product needs one coherent direction so future code, docs, and plans do not fight the actual architecture.

## Decision

Team Orchestrator is now a local-first, enterprise-capable agent work control plane.

The default operator experience remains local or trusted-server operation: a console, API, plugin-backed agents, workflow templates, durable app state, run inspection, artifacts, approvals, and safety limits. Enterprise capability is no longer a non-goal. It is the current post-2026.1 direction.

The enterprise direction means:

- Workspaces become a first-class product and tenancy boundary.
- RBAC must be server-derived and enforceable, not a client-selected filter.
- Cost observability must mature into budgets, caps, alerts, and audit-ready reporting.
- SQLite remains the default local store, but app-state repositories must be ready for a Postgres-backed server profile.
- Multi-user alpha is gated by security, isolation, and operational readiness, not just by UI availability.
- Docs should describe local-first as the default deployment posture, not as a single-user-only product identity.

## Non-Goals

- Do not turn Team Orchestrator into a generic Kubernetes fleet dashboard.
- Do not make hosted SaaS the only or default way to use the product.
- Do not expose multi-user operation before workspace membership, authorization, and data isolation are server-bound.
- Do not bypass plugin manifests, workflow templates, run records, artifacts, approvals, or audit trails for enterprise features.

## Consequences

Plans 021, 022, and 023 are now aligned with the accepted direction:

- Workspace lifecycle and scoped RBAC are required before multi-user exposure.
- Cost governance is required before enterprise pilots can rely on usage reporting.
- Postgres-readiness work is required before a multi-node server profile can be treated as durable.

The 2026.1 release notes remain historically accurate as a local-first release candidate. Current product direction, roadmap, and agent instructions should no longer describe enterprise or multi-user operation as out of scope.

## Documentation Rule

Use this wording in new docs:

- **Preferred**: local-first by default, enterprise-capable by design.
- **Avoid**: single-user-only, local-only, not enterprise, hosted operation is out of scope.

When a feature is not ready for multi-user alpha, describe the missing readiness gate directly instead of reverting to old product identity.

<!-- AUDIENCE: Internal/Technical -->

# Future Horizon Roadmap

This roadmap captures post-`2026.1` product direction for Team Orchestrator.

Team Orchestrator is a work control plane for teams and operators — the primary direction is enterprise/multiplayer team operation. Local execution is a supported mode and the easiest way to start. The future horizon adds durable continuity, useful first-party capabilities, safe connectors, and enterprise governance.

## Product Thesis

Team Orchestrator should combine:

- local execution where the operator can inspect what agents do,
- remote continuity where memory and app-state can survive across machines,
- first-party capability packs that make the product useful immediately,
- connector packs that integrate external services safely,
- workflow templates that compose agents into repeatable higher-order flows,
- enterprise controls for workspace isolation, RBAC, cost governance, audit, and server durability.

## Arc 1: Durable Memory System

Status: Foundation complete.

Product principle:

- Local execution, remote continuity.

Agents may run on a laptop, local server, or remote host, but durable memory should be scoped to the operator, workspace, project, repository, team, agent, task, run, and artifact in a way that can travel across those environments.

Source epics:

- `docs/product/epics/completed/2026.34.00-epic-durable-memory-service-architecture.md`
- `docs/product/epics/completed/2026.35.00-epic-remote-memory-mvp.md`
- `docs/product/epics/completed/2026.36.00-epic-memory-governance-agent-integration.md`
- `docs/product/epics/completed/2026.37.00-epic-semantic-memory-and-sync-backends.md`

## Arc 2: Built-In Capability And Connector Packs

Status: Capability, software-team, connector-platform, GitHub, and product-intuition arcs complete. Knowledge-work connectors deferred.

Product principle:

- Useful out of the box, extensible by example.

Built-in packs should be ordinary plugins that use the same manifest, runtime, safety, provider, memory, artifact, workflow, connector, approval, and budget systems available to user-authored plugins.

Source epics:

- `docs/product/epics/completed/2026.38.00-epic-capability-pack-foundation.md`
- `docs/product/epics/completed/2026.39.00-epic-built-in-software-team-agent-pack.md`
- `docs/product/epics/completed/2026.40.00-epic-connector-pack-platform.md`
- `docs/product/epics/completed/2026.41.00-epic-github-connector-pack.md`
- `docs/product/epics/completed/2026.42.00-epic-product-intuition-and-start-work-flow.md`
- `docs/product/epics/active/2026.43.00-epic-knowledge-work-connector-pack.md`

## Arc 3: Enterprise Readiness

Status: Accepted direction; design and validation pending.

Product principle:

- Enterprise/multiplayer primary; local deployment is one supported mode.

The enterprise arc makes the existing RBAC, workspace, usage ledger, distributed coordination, and Postgres design work coherent. The product should support a trusted-server/multi-user path only after the safety boundaries are server-bound and testable.

Source decision:

- `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`

Planned design and validation: see [`plans/README.md`](../../../plans/README.md).

Required outcomes:

- Workspace lifecycle, membership, and per-workspace role assignment.
- Server-derived workspace scope replacing client-asserted scope headers for enforcement.
- Query-level scoping and referential integrity for workspace-owned records.
- Budget, quota, cap, alert, and usage-reporting model.
- App-state repository contract tests that reveal SQLite-only assumptions.
- A server profile that can graduate from SQLite to Postgres without changing product semantics.

## Sequencing Guidance

Recommended sequence:

1. Keep the local single-operator path (`2026.1` baseline) stable as one supported deployment mode.
2. Review the enterprise plans against ADR 0027.
3. Design workspace lifecycle and server-bound RBAC before exposing multi-user operation.
4. Design cost governance before enterprise pilots depend on usage reporting.
5. Add Postgres-readiness contract tests before implementing a Postgres backend.
6. Resume knowledge-work connectors after workspace/RBAC/cost boundaries are clear.

## Non-Goals

- Do not make hosted SaaS the only way to use the product.
- Do not expose multi-user operation while workspace scope is client-asserted.
- Do not make SQLite the durable product source of truth for multi-node/server profiles.
- Do not bypass the plugin model for first-party agents or connectors.
- Do not add connector write actions without explicit permission, scope, audit, approval, and budget design.
- Do not make natural-language autonomous planning the default path for these arcs.

## Open Planning Questions

- What is the minimum safe multi-user alpha profile?
- Which identity provider model should the trusted-server profile support first?
- Should workspace membership be global-role-plus-workspace-scope, per-workspace role only, or both?
- Which cost controls are hard caps versus alert-only in the first pass?
- What is the first Postgres-backed deployment profile and migration path?
- Which knowledge-work connector should follow once enterprise boundaries are in place?

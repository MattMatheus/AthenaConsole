<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Flight Path

This roadmap describes the current product sequence. Team Orchestrator is a work control plane for teams and operators — the primary direction is enterprise/multiplayer team operation with workspace-scoped RBAC, cost governance, and server-ready persistence. Local single-operator deployment is a supported mode and the easiest way to start.

The current product center is manifest-backed agents, outcome-led work creation, workflow-template DAG runs, durable app-state, inspectable events and artifacts, runtime safety controls, memory, connector packs, workspaces, RBAC, cost governance, and a console for operators and admins.

## Completed Product Arcs

The foundation baseline shipped as `2026.1`. Completed arcs are summarized in `docs/product/epics/completed/`. Use those epics and ADRs for historical rationale, not the archived Flywheel story files.

Major completed arcs:

1. **2026.17 Workflow DAG Engine** - durable canonical workflow DAG runs, recovery, scheduled DAG execution, and graph/status inspection.
2. **2026.22 State Ownership And SQLite Migration** - explicit state ownership and migration of control-plane resources into app-state repositories.
3. **2026.23 Operator Readiness And First-Run Experience** - readiness checks, sample workflow, onboarding, and quickstart alignment.
4. **2026.24 Console Product Surface Polish** - Team Orchestrator branding, clearer navigation, and containment of advanced surfaces.
5. **2026.25 Operator Workflow Clarity And Repo Wiring** - repo wiring guidance and first-run-to-real-work bridge.
6. **2026.26-2026.30 Real Work Enablement** - repo connection, provider setup, SDK/examples, safe run modes, and local-server deployment.
7. **2026.31 Productization, Documentation, And Agent Developer Kit** - docs information architecture, PDK hardening, scaffold command, and smoke suite.
8. **2026.32 Comprehensive User Documentation** - operator and author documentation.
9. **2026.33 First Real Work Confidence** - repo input contract, clearer advanced empty states, demo artifacts, workflow output bridge, and readiness clarity.
10. **2026.34-2026.37 Durable Memory** - memory architecture, remote provider path, governance, semantic retrieval, and sync backends.
11. **2026.38-2026.42 Capability And Connector Foundation** - capability-pack foundation, software-team pack, connector platform, GitHub pack, and product-intuition repair.

## Current Arc: Enterprise Readiness

Status: Accepted direction; design and validation pending.

Goal: make Team Orchestrator safe and coherent for team/server operation. Local single-operator deployment remains a supported mode throughout.

Why now:

- The codebase already includes RBAC, workspace-scoped records, usage/cost ledger records, distributed coordination, and Postgres migration design.
- The old docs still described enterprise and multi-user operation as out of scope, which made future work ambiguous.
- Multi-user exposure creates correctness obligations around identity, authorization, tenancy, cost controls, and durability.

Target outcome:

- A local operator can keep using the product as a local workbench.
- A team admin can configure a trusted-server profile with workspace membership, enforceable RBAC, usage/cost controls, and audit-ready run history.
- App-state repository contracts are validated so a Postgres-backed server profile can be introduced without changing product behavior.

Source decision:

- `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`

Active plan set: see [`plans/README.md`](../../../plans/README.md).

### 2026.44 Workspace Lifecycle And Scoped RBAC

Design workspace lifecycle, server-derived workspace membership, per-workspace roles, and query-level scoping. Close the client-asserted workspace-scope gap before any multi-user alpha.

Planned source:

- `plans/021-workspace-entity-design-spike.md`

### 2026.45 Cost Governance

Extend cost observability into budgets, caps, alerts, and admin/operator reporting. Keep model/provider spend auditable by workspace, user, run, agent, and provider.

Planned source:

- `plans/022-cost-governance-design.md`

### 2026.46 Postgres Readiness

Add app-state repository contract coverage and identify SQLite-only assumptions before implementing a Postgres backend. Treat multi-node durability as an enterprise-readiness gate.

Planned source:

- `plans/023-postgres-readiness-spike.md`

### 2026.47 Agent Certification Eval Runner

Promote deterministic golden evals from test-only proof into an operator-triggered
certification surface. Record eval runs/results in app-state, expose eval APIs,
and extend the agent catalog so first-party certification can become reachable in
live instances.

Planned source:

- `docs/product/architecture/decisions/0030-agent-certification-and-eval-runner.md`

## Deferred Arc: Knowledge Work Connectors

The 2026.43 knowledge-work connector pack remains deferred until enterprise readiness gates are clearer. Knowledge-work connectors add external SaaS auth, privacy, data retention, and write-action risk, so they should enter a product shell with workspace/RBAC/cost boundaries already defined.

Source epic:

- `docs/product/epics/active/2026.43.00-epic-knowledge-work-connector-pack.md`

## Archive Rule

Keep live planning surfaces small:

- ADRs stay in `docs/product/architecture/decisions/`.
- Completed epics stay in `docs/product/epics/completed/`.
- Active plans stay at the top of `plans/`.
- Completed plans move under `plans/archive/`.
- Completed Flywheel stories and point-in-time observer/planning artifacts move under `flywheel/archive/`.

If work is not in an active Flywheel lane or an active plan file, it is context, not queue state.

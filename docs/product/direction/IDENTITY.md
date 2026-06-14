<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Product Identity

## Core Essence

Team Orchestrator is a web-first control plane for teams that need agent work to be runnable, inspectable, governable, and repeatable.

The first experience is still intentionally local: one operator can start the console, run useful work, and inspect what happened without a hosted service. The product direction is now enterprise-capable: the same model must grow into workspace-scoped, multi-user operation with RBAC, cost governance, auditable runs, and server-ready persistence.

## Product Promise

Team Orchestrator helps operators and platform owners:

- choose approved agent capabilities
- connect repositories, providers, memory, and external services
- run tasks, missions, and workflow templates
- inspect events, logs, artifacts, costs, and outcomes
- keep risky actions bounded by permissions, approvals, and limits
- govern work by workspace, identity, role, provider, and budget

## Positioning

The product is an agent work control plane, not a generic prompt runner and not a generic infrastructure fleet dashboard.

Existing systems such as Airflow, Flyte, Kestra, LangGraph, and internal platform consoles are useful reference points, but Team Orchestrator's core product model is agent-native: plugins, formal agents, capabilities, tasks, missions, workflow runs, events, artifacts, memory, approvals, workspaces, and cost governance.

The product should feel local-first by default and enterprise-capable by design. A developer can run it on a laptop. A team should be able to run it on a trusted server with workspace boundaries, policy, usage controls, and audit trails.

## Naming

- Product name: Team Orchestrator
- Domain: `teamorchestrator.com`
- Athena: legacy/internal name that may remain as a default planning agent or orchestrator role, but should not be the dominant product abstraction.

The repository, packages, environment variables, and some integration names still use `Athena` or `AthenaConsole`. Treat those as implementation history unless a file is specifically documenting code-level names.

## Voice

Use practical operator and platform language:

- tasks, missions, runs
- agents and plugins
- capabilities and workflow templates
- workspaces, members, roles
- budgets, usage, cost, quotas
- local process, container, API, module, DAG
- events, artifacts, logs, evidence
- approvals, limits, schedules

Avoid lore-heavy terms such as pilots, hangars, flight directors, swarms, or vague enterprise theater. If the product needs governance, name the concrete control: workspace membership, RBAC, audit, approval, budget, retention, or policy.

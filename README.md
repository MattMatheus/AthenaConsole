# Team Orchestrator

Team Orchestrator is a work control plane for teams and operators. Deploy it as a local workbench for one operator, or as a trusted server for a team with workspace membership, RBAC, cost governance, and audit-ready run history.

The product is built around a simple idea: agent systems should be inspectable and governable while they run. Operators and platform owners should be able to see which agent is doing what, which workspace owns the work, what state was persisted, what cost was incurred, what artifacts were produced, and why a run succeeded, failed, paused, or required approval.

Deployment modes range from a single-operator local stack to a shared trusted-server profile. The default local path uses manifest-backed agents, plugins, SQLite app state, workflow templates, runtime safety policies, and a console-first operator experience. The enterprise/team path adds workspaces, RBAC, cost governance, distributed coordination, and Postgres-ready app-state boundaries.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

## What It Does

Team Orchestrator provides:

- A web console for creating, running, and inspecting agent work.
- A local API server for agents, tasks, missions, runs, schedules, workflow templates, readiness, events, artifacts, diagnostics, and safety controls.
- Manifest-backed plugins and agents.
- Durable app-state for operator-facing control-plane records, with SQLite as the default local store.
- File-backed artifact payloads for transcripts, run evidence, agent reports, and other inspectable outputs.
- Workflow-template DAG execution with restart-safe run state and status inspection.
- Runtime safety defaults, loop limits, approval hooks, and pluggable execution backends.
- Workspace, RBAC, usage/cost, and server-readiness foundations for enterprise operation.
- A checked-in first-run sample plugin at `sample-plugins/first-run-demo`.

## Current Status

This repository is an active product build. The shipped `2026.1` release candidate is the local-first baseline documented in [Release Readiness](docs/product/release/README.md). Current `main` is now moving into the enterprise/multi-user direction accepted in [ADR 0027](docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md).

The current foundation includes:

- SQLite-backed local app state for plugins, agents, tasks, missions, runs, events, artifact metadata, schedules, workflow templates, workflow DAG runs, directives, harness profiles, and run templates.
- A React console for the main operator workflows and first-run onboarding.
- A Node/TypeScript API and core orchestration package.
- Local, local-server, and production-like Docker Compose workflows.
- Product direction and architecture records under `docs/product/`, including enterprise direction, workspace/RBAC planning, cost governance planning, and Postgres readiness planning.

The project intentionally does not maintain legacy compatibility shims for deprecated file-backed control-plane state. When state ownership changes, the project moves forward and updates the canonical runtime path.

## Quickstart

The recommended path is to evaluate locally first, then deploy for your team.

**Step 1 — Evaluate locally:**

- [GETTING_STARTED.md](GETTING_STARTED.md) — local stack, first-run demo, real repo work
- [Team Orchestrator User Guide](docs/user-guide/README.md) — full operator and admin guide

The local evaluation path:

1. Start the API and console with `docker-compose.local.yml`.
2. Check health and readiness at `/api/v1/health` and `/api/v1/readiness`.
3. Open the console at `http://127.0.0.1:5173`.
4. Instantiate and execute the checked-in first-run demo workflow.
5. Inspect workflow status, step outputs, and sample artifact metadata.

The first-run demo uses the local sample plugin in `sample-plugins/first-run-demo` and the default mock provider, so no OpenAI or Azure setup is required for the initial validation loop.

After the demo, use the repo wiring path in [GETTING_STARTED.md](GETTING_STARTED.md#6-move-from-demo-to-real-repo-work) to expose a local target repo, confirm plugin-backed agents, and start a real task or workflow with repo context.

**Step 2 — Deploy for your team:**

See [Team Orchestrator User Guide](docs/user-guide/README.md) for the trusted-server deployment path, workspace setup, and admin configuration.

## Local Development

Run the API and console directly during development:

```bash
./dev.sh
```

Or run the two processes yourself:

```bash
npm --workspace @athena/api run dev
npm --workspace @athena/console run dev
```

The `dev.sh` script is macOS-compatible, starts both processes, uses `ATHENA_WORKSPACE_ROOT` for local config/state resolution, and stops both servers when you press `Ctrl+C`.

Common validation commands:

```bash
npm run typecheck
npm run test
npm --workspace @athena/core run validate:manifests
```

Focused package checks:

```bash
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run test:unit
npm --workspace @athena/console run typecheck
npm --workspace @athena/console run test
```

## Repository Layout

```text
apps/
  api/          API server entry point
  console/      React operator console

packages/
  core/         Core orchestration, API contracts, state, runtime, CLI
  pdk/          Plugin-backed agent development kit

docs/product/  Product direction, architecture decisions, audits, roadmap
sample-plugins/ Example plugin-backed agent assets
```

## Architecture At A Glance

Team Orchestrator separates durable control-plane state from inspectable payload files.

SQLite owns local operator-facing app state such as tasks, missions, runs, schedules, workflow DAG state, directives, harness profiles, run templates, and artifact metadata. Server profiles must preserve the repository boundaries that let this state move to Postgres without changing product behavior.

The filesystem remains the right owner for large or human-inspectable payloads such as transcripts, run evidence files, agent reports, logs, plugin source files, and workflow template source manifests.

The current state ownership map lives in:

- [docs/product/architecture/state-ownership-map.md](docs/product/architecture/state-ownership-map.md)

The current product and enterprise direction lives in:

- [docs/product/direction/current-direction.md](docs/product/direction/current-direction.md)
- [docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md](docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md)

## Documentation

- [Documentation Map](docs/README.md) — full index of all docs
- [User Guide](docs/user-guide/README.md) — operator and admin guide, including trusted-server deployment
- [SDK Guide](docs/sdk/README.md) — plugin and agent authoring
- [Getting Started](GETTING_STARTED.md) — local evaluation path and first-run demo
- [Product Direction](docs/product/direction/current-direction.md)
- [Roadmap Flight Path](docs/product/roadmap/flight-path.md)
- [Developer Guides](docs/developer/product-dev-guides/README.md)

Architecture decision records are under:

- [docs/product/architecture/decisions/](docs/product/architecture/decisions/)

For production-like local validation, use the `docker-compose.prod.yml` workflow documented in [GETTING_STARTED.md](GETTING_STARTED.md).

For a durable trusted-LAN server install, use `docker-compose.server.yml` with the path and secret model documented in [Local Server Deployment](docs/developer/product-dev-guides/local-server-deployment.md).

For an end-to-end local-server proof, follow [Fresh Server Real-Work Walkthrough](docs/developer/product-dev-guides/fresh-server-real-work-walkthrough.md).

## Project Notes

The package names still use `athena` in several places while the product direction has moved to Team Orchestrator. Treat `athena` package names and CLI names as implementation history for now.

This project is enterprise-first by narrative and supports local deployment as one profile. Production-grade multi-user operation is gated by workspace lifecycle, server-bound RBAC, cost governance, and Postgres-readiness work — see the preview banner above and [docs/conventions.md](docs/conventions.md) for what is and is not yet enforced.

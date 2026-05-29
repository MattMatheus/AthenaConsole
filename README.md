# Team Orchestrator

Team Orchestrator is a local-first agent orchestration workbench for running, inspecting, and coordinating agent work from a web console.

The project is being built around a simple idea: agent systems should be inspectable while they run. Operators should be able to see which agent is doing what, what state was persisted, what artifacts were produced, and why a run succeeded, failed, paused, or required approval.

Team Orchestrator currently focuses on local development and local operations. It uses manifest-backed agents and plugins, durable SQLite app state, workflow templates, task and mission runs, runtime safety policies, and a console-first operator experience. It also ships with a deterministic first-run demo plugin, so you can validate the product without external model credentials.

## What It Does

Team Orchestrator provides:

- A web console for creating, running, and inspecting agent work.
- A local API server for agents, tasks, missions, runs, schedules, workflow templates, readiness, events, artifacts, diagnostics, and safety controls.
- Manifest-backed plugins and agents.
- Durable SQLite app-state for operator-facing control-plane records.
- File-backed artifact payloads for transcripts, run evidence, specialist reports, and other inspectable outputs.
- Workflow-template DAG execution with restart-safe run state and status inspection.
- Runtime safety defaults, loop limits, approval hooks, and pluggable execution backends.
- A checked-in first-run sample plugin at `sample-plugins/first-run-demo`.

## Current Status

This repository is an active product build, not a polished stable release.

The current foundation includes:

- SQLite-backed app state for plugins, agents, tasks, missions, runs, events, artifact metadata, schedules, workflow templates, workflow DAG runs, directives, harness profiles, and run templates.
- A React console for the main operator workflows and first-run onboarding.
- A Node/TypeScript API and core orchestration package.
- Local, local-server, and production-like Docker Compose workflows.
- Product direction and architecture records under `docs/product/`.

The project intentionally does not maintain legacy compatibility shims for deprecated file-backed control-plane state. When state ownership changes, the project moves forward and updates the canonical runtime path.

## Quickstart

Start here:

- [GETTING_STARTED.md](GETTING_STARTED.md)

The quickstart covers one supported local path:

1. Start the API and console with `docker-compose.local.yml`.
2. Check health and readiness at `/api/v1/health` and `/api/v1/readiness`.
3. Open the console at `http://127.0.0.1:5173`.
4. Instantiate and execute the checked-in first-run demo workflow.
5. Inspect workflow status, step outputs, and sample artifact metadata.

The first-run demo uses the local sample plugin in `sample-plugins/first-run-demo` and the default mock provider, so no OpenAI or Azure setup is required for the initial validation loop.

After the demo, use the repo wiring path in [GETTING_STARTED.md](GETTING_STARTED.md#6-move-from-demo-to-real-repo-work) to expose a local target repo, confirm plugin-backed agents, and start a real task or workflow with repo context.

## Local Development

Run the API and console directly during development:

```bash
npm --workspace @athena/api run dev
npm --workspace @athena/console run dev
```

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
  marketing/    Public documentation and marketing site

packages/
  core/         Core orchestration, API contracts, state, runtime, CLI
  pdk/          Persona/plugin development contracts

docs/product/  Product direction, architecture decisions, audits, roadmap
sample-plugins/ First-run and local sample plugin assets
specialists/   Example specialist manifests and local agent assets
```

## Architecture At A Glance

Team Orchestrator separates durable control-plane state from inspectable payload files.

SQLite owns operator-facing app state such as tasks, missions, runs, schedules, workflow DAG state, directives, harness profiles, run templates, and artifact metadata.

The filesystem remains the right owner for large or human-inspectable payloads such as transcripts, run evidence files, specialist reports, logs, plugin source files, and workflow template source manifests.

The current state ownership map lives in:

- [docs/product/architecture/state-ownership-map.md](docs/product/architecture/state-ownership-map.md)

The current product direction lives in:

- [docs/product/direction/current-direction.md](docs/product/direction/current-direction.md)

## Documentation

Key docs:

- [Getting Started](GETTING_STARTED.md)
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

This project is designed for local-first development. Production deployment, cloud persistence, and hosted multi-tenant operation are outside the current core scope unless explicitly introduced by future architecture decisions.

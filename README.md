# Team Orchestrator

Team Orchestrator is a local-first agent orchestration workbench for running, inspecting, and coordinating agent work from a web console.

The project is being built around a simple idea: agent systems should be inspectable while they run. Operators should be able to see which agent is doing what, what state was persisted, what artifacts were produced, and why a run succeeded, failed, paused, or required approval.

Team Orchestrator currently focuses on local development and local operations. It uses manifest-backed agents and plugins, durable SQLite app state, workflow templates, task and mission runs, runtime safety policies, and a console-first operator experience.

## What It Does

Team Orchestrator provides:

- A web console for creating, running, and inspecting agent work.
- A local API server for tasks, missions, runs, schedules, workflow templates, events, artifacts, diagnostics, and safety controls.
- Manifest-backed plugins and agents.
- Durable SQLite app-state for operator-facing control-plane records.
- File-backed artifact payloads for transcripts, run evidence, specialist reports, and other inspectable outputs.
- Workflow-template DAG execution with restart-safe run state and status inspection.
- Runtime safety defaults, loop limits, approval hooks, and pluggable execution backends.
- A Flywheel delivery harness for keeping planning, engineering, QA, observer reports, and cycle commits reviewable.

## Current Status

This repository is an active product build, not a polished stable release.

The current foundation includes:

- SQLite-backed app state for plugins, agents, tasks, missions, runs, events, artifact metadata, schedules, workflow templates, workflow DAG runs, directives, harness profiles, and run templates.
- A React console for the main operator workflows.
- A Node/TypeScript API and core orchestration package.
- Local and production-like Docker Compose workflows.
- Product direction and architecture records under `docs/product/`.

The project intentionally does not maintain legacy compatibility shims for deprecated file-backed control-plane state. When state ownership changes, the project moves forward and updates the canonical runtime path.

## Quickstart

Prerequisites:

- Node.js 20+
- npm 11+
- Podman or Docker with Compose support

Install dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp packages/core/.env.example .env
```

At minimum, configure either an OpenAI-compatible key or Azure AI Foundry settings in `.env`.

Start the local container stack:

```bash
podman compose -f docker-compose.local.yml up --build
```

Production-like local validation is also available:

```bash
podman compose -f docker-compose.prod.yml up --build
```

Useful health checks:

```bash
curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:5173/api/v1/health
```

For a more detailed setup walkthrough, see [GETTING_STARTED.md](GETTING_STARTED.md).

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
flywheel/      Local staged delivery harness and backlog
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

## Delivery Workflow

This repository uses Flywheel as its local human-and-agent delivery harness. Flywheel keeps the backlog, stage handoffs, QA verdicts, observer reports, and cycle commits visible in the repo.

Start with:

- [flywheel/DEVELOPMENT_CYCLE.md](flywheel/DEVELOPMENT_CYCLE.md)
- [flywheel/backlog/README.md](flywheel/backlog/README.md)

Useful Flywheel commands:

```bash
./flywheel/tools/launch_stage.sh engineering --format json
./flywheel/tools/validate_workflow_state.sh
./flywheel/tools/run_observer_cycle.sh --cycle-id <cycle-id>
```

## Documentation

Key docs:

- [GETTING_STARTED.md](GETTING_STARTED.md)
- [docs/product/direction/current-direction.md](docs/product/direction/current-direction.md)
- [docs/product/architecture/state-ownership-map.md](docs/product/architecture/state-ownership-map.md)
- [docs/product/roadmap/flight-path.md](docs/product/roadmap/flight-path.md)

Architecture decision records are under:

- [docs/product/architecture/decisions/](docs/product/architecture/decisions/)

## Project Notes

The package names still use `athena` in several places while the product direction has moved to Team Orchestrator. Treat `athena` package names and CLI names as implementation history for now.

This project is designed for local-first development. Production deployment, cloud persistence, and hosted multi-tenant operation are outside the current core scope unless explicitly introduced by future architecture decisions.

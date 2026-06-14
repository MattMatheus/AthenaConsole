# Team Orchestrator Core Source (`src/`)

This directory contains the core implementation of Team Orchestrator.

## Architecture Overview

Team Orchestrator is a local-first, enterprise-capable agent work control plane with a web console, API, durable app-state repositories, plugin-backed agents, tasks, missions, workflow DAG runs, events, artifacts, memory, workspace/RBAC foundations, usage/cost tracking, and safety controls.

- `cli/`: Command-line interface logic (acts as an API client).
- `control-plane/`: Centralized services, API contracts, and schema definitions.
- `runtime/`: Core execution logic for agent sessions and turns.
- `work/`: Per-session work queue management and persistence.
- `memory/`: Session history and retrievable (RAG) memory systems.
- `context/`: Context compilation, budgeting, and overflow handling.
- `providers/`: Abstraction layer for LLM model providers.
- `agents/`: Plugin-backed agent scaffolding and runtime helpers.
- `schedule/`: System-level task scheduling and logging.
- `shared/`: Canonical DTO contracts and common utilities.
- `tools/`: Built-in capabilities available to agents.

## Recommended Reading Order

1. `control-plane/app-state/`: local SQLite-backed operator state and repository boundaries for server-ready persistence.
2. `control-plane/manifests/` and `control-plane/plugins/`: plugin and agent loading.
3. `control-plane/services/task-workbench.ts`: task creation and task runs.
4. `control-plane/services/mission-workbench.ts`: mission grouping and mission runs.
5. `control-plane/services/workflow-*`: workflow template, DAG run, and status services.
6. `shared/contracts/`: API DTO contracts.

Start from the repo-level docs map at `docs/README.md` for current user and contributor guidance.

<!-- AUDIENCE: Internal/Technical -->

# Agent Onboarding & Project State

Welcome to Team Orchestrator. This document is the primary entry point for agents to understand the project's mission, current state, and engineering standards.

## 1. Mission & Scope

Team Orchestrator is a work control plane for teams and operators. Deploy it as a local workbench for one operator, or as a trusted server for a team with workspace membership, RBAC, cost governance, and audit-ready run history.

**Core Focus:** Formal manifest-backed agents, outcome-led work creation, tasks, missions, workflow runs, plugins, pluggable execution backends, artifacts, events, memory, workspace scope, RBAC, cost governance, and operator safety.
**Deferred:** Exposing multi-user operation before workspace lifecycle, server-bound RBAC, cost controls, and server persistence are ready. Natural-language task planning is not the primary workflow.

## 2. Current Status & Roadmap

The project completed the 2026 platform reset and has accepted an enterprise/multi-user direction (ADR 0027).

### Accepted Baseline

- Product name and direction: Team Orchestrator.
- Primary surface: web console.
- Primary users: local operator, agent author, team/platform admin.
- Agent model: formal agents with manifests and lifecycle contracts.
- Work model: tasks are primary; missions collect tasks; runs execute tasks or missions.
- Runtime model: local process default, containers first-class, API/server backends in scope.
- State model: SQLite is the local default; Postgres-readiness is the server direction.
- Enterprise model: workspace membership, server-bound RBAC, cost governance, and durable server state are active planning concerns.

Canonical decision record:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`

Active implementation work lives in the Flywheel harness.

## 3. Engineering Conventions

- **Contracts First:** `src/shared/contracts.ts` is the canonical source for DTOs.
- **API Schemas:** Always run `npm run generate:schemas` after contract changes.
- **Persistence:** Use atomic, lock-guarded, and append-safe patterns for state.
- **Boundaries:** Keep business logic in control-plane services; keep providers behind clean interfaces.
- **Local Stack Maintenance:** Keep root `docker-compose.local.yml` aligned with `packages/core/infrastructure/docker-compose.yml` when service contracts, ports, or startup env vars change.
- **Container Runtime:** Use Podman Compose for local orchestration:
  - `podman compose -f docker-compose.local.yml up --build`
  - `podman compose -f docker-compose.local.yml down --remove-orphans`
- **Validation:** Run the narrowest meaningful validation for the changed surface; core backend work usually starts with `npm --workspace @athena/core run typecheck`, `npm --workspace @athena/core run test:unit`, and `npm --workspace @athena/core run validate:manifests`.
- **Mandatory Cycle Handoff:** Every implementation cycle must move work through Flywheel lanes, validate workflow state, write an observer report, and create one cycle commit.

## 4. Progressive Disclosure (Context Management)

To keep your context window efficient, follow these pointers to more detailed information:

- **Need planning structure orientation first?** Start with:
  - `flywheel/README.md` (workflow harness)
  - `flywheel/backlog/engineering/active/README.md` (execution queue)
  - `docs/product/roadmap/flight-path.md` (delivery history and current arc)
  - `docs/product/roadmap/flight-path.md` (future plan)
  - `flywheel/prompts/engineering.md` (current directive)
  - `flywheel/archive/` (archived cycle closure reports and completed stories)
- **Need Architecture Details?** See `docs/developer/product-dev-guides/01-architecture.md`.
- **Need Current Product Direction?** See `docs/product/direction/current-direction.md` and `docs/product/architecture/decisions/0027-enterprise-multi-user-direction.md`.
- **Need CLI Command Reference?** See `docs/developer/product-dev-guides/06-cli-reference.md`.
- **Looking for the Roadmap?** See `docs/product/roadmap/flight-path.md`.
- **Deep Dive on ADRs?** See `docs/product/architecture/decisions/`.

*If you find a directory without a README, or a complex file without clear intent, your task is to add the necessary hints to help the next agent.*

---

*Use `./flywheel/tools/launch_stage.sh <stage> --format json` for specific cycle task and context.*

<!-- AUDIENCE: Internal/Technical -->

# Agent Onboarding & Project State

Welcome to Team Orchestrator. This document is the primary entry point for agents to understand the project's mission, current state, and engineering standards.

## 1. Mission & Scope

Team Orchestrator is a web-first, local-first agent orchestrator for solo developers and product operators.

**Core Focus:** Formal manifest-backed agents, tasks, missions, inspectable runs, plugins, pluggable execution backends, artifacts, events, and operator safety.
**Deferred:** Enterprise fleet governance, cloud-first deployment, and natural-language task planning as the primary workflow.

## 2. Current Status & Roadmap

The project is in a **2026 product-direction reset**.

### Accepted Baseline

- Product name and direction: Team Orchestrator.
- Primary surface: web console.
- Primary user: solo developer first, then product operator, then shared/team use.
- Agent model: formal agents with manifests and lifecycle contracts.
- Work model: tasks are primary; missions collect tasks; runs execute tasks or missions.
- Runtime model: local process default, containers first-class, API/cloud backends later.
- State model: move toward database-backed app state, likely SQLite first.

Canonical decision record:

- `planning/architecture/0006-team-orchestrator-direction-and-agent-model.md`

The active implementation backlog is intentionally empty until the roadmap is rebuilt.

## 3. Engineering Conventions

- **Contracts First:** `src/shared/contracts.ts` is the canonical source for DTOs.
- **API Schemas:** Always run `npm run generate:schemas` after contract changes.
- **Persistence:** Use atomic, lock-guarded, and append-safe patterns for state.
- **Boundaries:** Keep business logic in control-plane services; keep providers behind clean interfaces.
- **Local Stack Maintenance:** Keep root `docker-compose.local.yml` aligned with `packages/core/infrastructure/docker-compose.yml` when service contracts, ports, or startup env vars change.
- **Container Runtime:** Use Podman Compose for local orchestration:
  - `podman compose -f docker-compose.local.yml up --build`
  - `podman compose -f docker-compose.local.yml down --remove-orphans`
- **Validation:** Every cycle must pass `check:schemas`, `typecheck`, `test`, and `build`.
- **Mandatory Cycle Handoff:** Every implementation cycle must update `planning/vision/handoff.md`, move completed stories from `planning/backlog/active/` to `planning/backlog/completed/`, update `planning/backlog/active/README.md`, and refresh `planning/prompts/active/next-agent-seed-prompt.md` for the next cycle.

## 4. Progressive Disclosure (Context Management)

To keep your context window efficient, follow these pointers to more detailed information:

- **Need planning structure orientation first?** Start with:
  - `planning/backlog/active/README.md` (execution queue)
  - `planning/backlog/completed/README.md` (delivery history)
  - `planning/backlog/roadmap/roadmap.md` (future plan)
  - `planning/prompts/active/next-agent-seed-prompt.md` (current directive)
  - `planning/vision/handoff.md` (latest cycle output)
- **Need Architecture Details?** See `planning/developer/01-architecture.md`.
- **Need Current Product Direction?** See `planning/architecture/0006-team-orchestrator-direction-and-agent-model.md`.
- **Need CLI Command Reference?** See `planning/developer/06-cli-reference.md`.
- **Need specific Persona docs?** See `docs/personas/`.
- **Looking for the Roadmap?** See `planning/backlog/roadmap/roadmap.md`.
- **Deep Dive on ADRs?** See `planning/architecture/`.

*If you find a directory without a README, or a complex file without clear intent, your task is to add the necessary hints to help the next agent.*

---

*Refer to `planning/prompts/active/` for your specific cycle's task and context.*

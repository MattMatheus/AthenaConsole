<!-- AUDIENCE: Internal/Technical -->

# Agent Onboarding & Project State

Welcome to Project Athena. This document is the primary entry point for agents to understand the project's mission, current state, and engineering standards.

## 1. Mission & Scope

Project Athena is a standalone, CLI-first agent runtime that re-implements core orchestration logic (runtime, work, memory, context, providers, schedule).

**Core Focus:** Reliable, durable, and observable agent workflows.
**Explicitly Out of Scope:** UI components, chat/messaging adapters (Slack, etc.), and third-party channel integrations.

## 2. Current Status & Roadmap

The project is currently in **Stage 8: Operational Maturity & Controls**.

### Completed Milestones:
- **Stages 0-7:** Foundation, CLI runtime, Provider abstraction, Work management, Memory system, Context management, Scheduling, and Reliability hardening.
- **Stage 8 (In Progress):** Control-plane unification, API-first architecture, telemetry/event retention, and fleet metrics.

### Active Track:
The current focus is on hardening the control plane, implementing Kyverno policy integration, and ensuring API/CLI parity.

*For a detailed breakdown of completed stages and upcoming tasks, see the [Implementation Plan](../archive/implementation-plan.md) (Archived) and the [Active Backlog](../backlog/active/README.md).*

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
- **Mandatory Cycle Handoff:** Every cycle must update `planning/vision/handoff.md`, move completed stories from `planning/backlog/active/` to `planning/backlog/completed/`, update `planning/backlog/active/README.md`, and refresh `planning/prompts/active/next-agent-seed-prompt.md` for the next cycle.

## 4. Progressive Disclosure (Context Management)

To keep your context window efficient, follow these pointers to more detailed information:

- **Need planning structure orientation first?** Start with:
  - `planning/backlog/active/README.md` (execution queue)
  - `planning/backlog/completed/README.md` (delivery history)
  - `planning/backlog/roadmap/roadmap.md` (future plan)
  - `planning/prompts/active/next-agent-seed-prompt.md` (current directive)
  - `planning/vision/handoff.md` (latest cycle output)
- **Need Architecture Details?** See `planning/developer/01-architecture.md`.
- **Need CLI Command Reference?** See `planning/developer/06-cli-reference.md`.
- **Need specific Persona docs?** See `docs/personas/`.
- **Looking for the Roadmap?** See `planning/backlog/roadmap/roadmap.md`.
- **Deep Dive on ADRs?** See `planning/architecture/`.

*If you find a directory without a README, or a complex file without clear intent, your task is to add the necessary hints to help the next agent.*

---

*Refer to `planning/prompts/active/` for your specific cycle's task and context.*

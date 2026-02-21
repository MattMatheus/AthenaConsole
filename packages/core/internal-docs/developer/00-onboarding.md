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
- **Validation:** Every cycle must pass `check:schemas`, `typecheck`, `test`, and `build`.
- **Mandatory Cycle Handoff:** Every cycle must update `internal-docs/archive/handoff.md`, move completed stories from `internal-docs/backlog/active/` to `internal-docs/backlog/completed/`, and refresh `internal-docs/prompts/active/next-agent-seed-prompt.md` for the next cycle.

## 4. Progressive Disclosure (Context Management)

To keep your context window efficient, follow these pointers to more detailed information:

- **Need Architecture Details?** See `internal-docs/developer/01-architecture.md`.
- **Need CLI Command Reference?** See `internal-docs/developer/06-cli-reference.md`.
- **Need specific Persona docs?** See `docs/personas/`.
- **Looking for the Roadmap?** See `internal-docs/backlog/roadmap/roadmap.md`.
- **Deep Dive on ADRs?** See `internal-docs/architecture/`.

*If you find a directory without a README, or a complex file without clear intent, your task is to add the necessary hints to help the next agent.*

---

*Refer to `internal-docs/prompts/active/` for your specific cycle's task and context.*

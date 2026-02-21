# Agent Onboarding & Project State

Welcome to TeamOrchestrator.com. This is the public website repository for Team Orchestrator.

## 1. Mission & Scope

Build and maintain a production-ready website for:
- Product narrative and marketing
- Blog publishing
- Documentation hosting

## 2. Current Status

- Astro foundation is implemented.
- Blog and docs collection workflows are enabled.
- Team Orchestrator product stage is Stage 8 (in progress).

Primary references for cycle execution:
1. `internal-docs/backlog/active/README.md`
2. `internal-docs/archive/handoff.md`
3. `internal-docs/archive/implementation-plan.md`
4. `TODO.md`
5. `internal-docs/developer/docs-as-code-workflow.md`
6. `internal-docs/developer/cycle-checklist.md`

## 3. Engineering Conventions

- Keep content changes in markdown collections when possible.
- Preserve stable URLs and avoid breaking existing route paths.
- Keep design and copy changes consistent with Team Orchestrator brand language.
- Keep changes small, testable, and documented.

## 4. Docs-As-Code Baseline

- Use lifecycle states for all docs/blog content: **Draft -> In Review -> Published -> Archived**.
- Follow section ownership and reviewer expectations in `internal-docs/developer/docs-as-code-workflow.md`.
- Run the cycle checklist in `internal-docs/developer/cycle-checklist.md` before handoff.

## 5. Mandatory End-Of-Cycle Handoff

Before ending a cycle, always:
1. Update `internal-docs/archive/handoff.md` with a new top snapshot.
2. Move completed stories from `internal-docs/backlog/active/` to `internal-docs/backlog/completed/`.
3. Update `internal-docs/backlog/active/README.md` with next priorities.
4. Refresh `internal-docs/prompts/active/next-agent-seed-prompt.md` for the next cycle.

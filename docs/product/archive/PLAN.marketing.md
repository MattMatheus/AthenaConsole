<!-- AUDIENCE: Public/Marketing -->

# TeamOrchestrator.com Cycle Plan

## Current Cycle Objective

Establish a repeatable development cycle for the Team Orchestrator website, aligned to the `projectathena` operating model.

## In-Scope This Cycle

1. Seed cycle control documents (`PLAN`, `handoff`, onboarding, active backlog, seed prompt, TODO pointer).
2. Define an executable active backlog for website infrastructure and content operations.
3. Expand roadmap with website-specific maturity enhancements.

## Operating Rules

- `planning/backlog/active/` is the source of truth for current work.
- Every completed slice must:
  1. Update `planning/archive/handoff.md`
  2. Move finished stories to `planning/backlog/completed/`
  3. Refresh `planning/backlog/active/README.md`
  4. Refresh `planning/prompts/active/next-agent-seed-prompt.md`
- Prefer additive, backward-compatible documentation changes.
- Keep roadmap and implementation plan synchronized when priorities shift.

## Validation Checklist

1. `npm run build`
2. Validate key routes (`/`, `/blog`, `/docs`) in local preview.
3. Confirm all seeded docs are present and linked from index docs.

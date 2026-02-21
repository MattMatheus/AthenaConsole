# Next Agent Seed Prompt

You are beginning a new development cycle in TeamOrchestrator.com.

## Read First

1. `internal-docs/developer/00-onboarding.md`
2. `internal-docs/backlog/active/README.md`
3. `internal-docs/archive/handoff.md`
4. `TODO.md`

## Current Context

Stories 01.03, 01.04, 01.05, 02.02, 02.03, 02.04, 03.01, 03.02, 03.03, and 03.04 are complete: Mission Control UI baseline is in place, docs sync/search infrastructure is in place, terminal layout stability is fixed, SEO/social metadata baselines are established, analytics event taxonomy/instrumentation is in place, and deployment smoke checks now guard core routes/internal links. The next cycle should focus on operational resilience with an explicit backup and rollback workflow.

## Task: Story 03.05 — Define Content Backup and Rollback Process

Define a practical backup and rollback process for website content regressions.

1. Document rollback triggers and recovery decision points for content/metadata regressions.
2. Define backup expectations for key content and documentation surfaces.
3. Add an operator runbook with rollback and post-rollback verification commands.
4. Keep the process aligned with existing git-based workflow and static validation steps.
5. Validate static output and ensure no URL/path regressions.

**Reference:** `internal-docs/backlog/active/03.05-define-content-backup-and-rollback-process.md`

## Constraints

- Keep URLs stable.
- Keep changes additive and easy to review.
- Preserve the existing Team Orchestrator voice and product framing.

## Validation Required Before Handoff

1. `npm run build`
2. Summarize changed files, risks, and follow-up items.

## Mandatory Handoff Operation (Every Work Cycle)

Before ending the cycle, always:
1. Update `internal-docs/archive/handoff.md` with a new top snapshot.
2. Move completed stories from `internal-docs/backlog/active/` to `internal-docs/backlog/completed/`.
3. Update `internal-docs/backlog/active/README.md` for the next story ordering.
4. Refresh this seed prompt for the next cycle.

# Next SDET Seed Prompt

You are beginning a new SDET and quality cycle in ProjectAthena.

## Read First

1. `internal-docs/developer/00-onboarding.md`
2. `internal-docs/archive/handoff.md`
3. `TODO.md`
4. `internal-docs/developer/05-standards.md`
5. `internal-docs/backlog/testing/README.md`

## Current Context

ProjectAthena is in Stage 8 (operational maturity and controls). Development work is active on runtime controls, control-plane hardening, and API-first foundations.

SDET objective for this cycle:
- operate alongside development agents to enforce correctness, reliability, and testability
- define acceptance criteria before implementation for non-trivial changes
- ensure negative, boundary, and failure-path coverage is not deferred
- keep schema/contract/test regressions visible and blocking

## Cycle Detection (Authoritative)

Determine the active SDET phase from git worktree state:

1. Run `git status --porcelain`.
2. If output is empty, run **Preflight**.
3. If output is non-empty (tracked or untracked edits), run **Implementation Review**.

Interpretation rule:
- no open edits => prep/preflight
- open edits => in-progress implementation review

If phase signals conflict with notes/docs, the worktree rule above is authoritative.

## SDET Operating Cycle

1. **Preflight (clean worktree)**
   - Extract acceptance criteria for the active story in `Given/When/Then`.
   - Identify ambiguities and missing failure-mode requirements.
   - Define required test matrix (unit/integration/contract/e2e).
   - Record explicit risk areas and required observability assertions.
2. **Implementation Review (open edits present)**
   - Review changed files first for correctness, reliability, and testability.
   - Verify acceptance criteria coverage against actual code/tests.
   - Prioritize negative/boundary/failure-path gaps.
   - Report findings by severity with concrete file references.
3. **Final Gate (merge readiness)**
   - Ensure required validations are green or exceptions are documented with residual risk.
   - Confirm schema/contract alignment for DTO/API surface changes.
   - Confirm cleanup guarantees for stateful/locking flows.

## Task: Run the SDET Parallel Workflow

1. Review active development story and extract verifiable acceptance criteria in `Given/When/Then` form.
2. Identify requirement ambiguities and missing failure-mode definitions before code review.
3. Produce or update a test matrix spanning unit, integration, contract, and e2e coverage.
4. Add or request negative and boundary tests for malformed input, timeout/abort, lock contention, and persistence recovery paths.
5. Validate observability signals required for triage (error code, ids, lifecycle status, timing/counters).
6. Record residual risks and explicit follow-up tests when scope constraints prevent full coverage.
7. Update `internal-docs/prompts/active/next-agent-seed-prompt.md` so the next development cycle onboarding references the latest SDET preflight artifact and current quality expectations.

## SDET Constraints

- Do not redesign runtime architecture unless needed for testability.
- Prefer smallest viable testability hooks over broad refactors.
- Keep all assertions deterministic where practical (bounded timeouts, fixed fixtures, controlled fakes).
- For shared DTO changes, enforce schema generation/check workflow and contract tests.

## Quality Gates

Before handoff, validate:

1. Acceptance criteria are mapped to tests.
2. Negative and boundary coverage is explicitly present or explicitly waived with risk.
3. Structured error classification remains stable for affected flows.
4. State cleanup/lock cleanup guarantees are validated for any stateful flow changes.

## Validation Required Before Handoff

1. `npm run check:schemas`
2. `npm run typecheck`
3. `npm test` (full suite required; if targeted only, include rationale and residual risk)
4. `npm run build`
5. Summarize findings in this order:
   - defects/risks (highest severity first)
   - test coverage added/updated
   - residual risk and follow-up items

---
kind: story
id: STORY-20260530-repo-cleanup-audit
status: done
owner_role: Technical Writer
source: planning
success_metric: Repo cleanup inventory identifies every stale/generated/historical surface with an explicit keep/archive/delete recommendation.
release_scope: required
ready: false
---

# Story: Repository Cleanup Audit

## Metadata
- `id`: STORY-20260530-repo-cleanup-audit
- `owner_role`: Technical Writer
- `status`: done
- `source`: planning
- `decision_refs`: [0006, 0015, 0016]
- `success_metric`: Repo cleanup inventory identifies every stale/generated/historical surface with an explicit keep/archive/delete recommendation.
- `release_scope`: required

## Problem Statement

Team Orchestrator has made fast progress after the product realignment, but the repo still contains old planning files, Athena-era docs, generated outputs, archived strategy, marketing content, specialists/personas, and duplicate documentation trees. Contributors need a clear cleanup map before files are removed or promoted.

## Scope
- In: tracked source/docs inventory, ignored local artifact guidance, stale naming scan, archive classification, cleanup recommendations, risk notes.
- Out: large deletion moves, package renames, behavioral runtime changes.

## Assumptions
- Some Athena naming remains legitimate implementation history and should be classified rather than blindly renamed.
- Generated/local artifacts may be present in developer working trees even when ignored by git.

## Acceptance Criteria
1. A cleanup audit document lists canonical, historical, generated, deprecated, and unknown areas.
2. Each stale area has a recommended action: keep, refresh, archive, delete, or defer.
3. The audit calls out risky areas that need architecture approval before removal.
4. The audit identifies quick cleanup tasks that are safe to implement immediately.
5. The root README or docs index links to the audit or its resulting cleanup plan.

## Validation
- Required checks: `git ls-files` inventory review, `rg` naming/stale scan, `git diff --check`.
- Additional checks: Flywheel workflow validation.

## Dependencies
- None.

## Risks
- Removing historical planning context too early could erase useful rationale.
- Treating ignored local state as tracked repo debt could lead to unnecessary churn.

## Open Questions
- Should `apps/marketing/` be refreshed as the public docs surface or archived until the product is ready?
- Should the package name remain `@athena/pdk` for now while the docs call it the Agent Developer Kit?

## Next Step
- Activate this story first in the productization arc.

## Engineering Handoff

- `change_summary`: Added `docs/product/audits/2026-05-30-repo-cleanup-audit.md` with tracked file inventory, stale naming scan notes, current/canonical areas, archived/historical areas, stale user-facing docs, marketing app decision point, ADK/specialist classification, ignored local artifact guidance, quick cleanup candidates, and approval-required cleanup areas. Linked the audit from `docs/product/README.md`.
- `validation_evidence`: Ran `git ls-files` inventory review; ran stale naming scan with `rg` for ProjectAthena/Athena/fleet/persona-era terms outside archives and build outputs; reviewed ignored working-tree artifacts with `git status --ignored --short`; ran `./flywheel/tools/validate_workflow_state.sh --format json`; ran `git diff --check`.
- `qa_focus`: Confirm the audit clearly separates canonical, historical/archive, generated/local, stale current-facing, and approval-required areas; confirm each stale area has a keep/refresh/archive/delete/defer recommendation; confirm the docs index link is visible.
- `open_risks`: This story intentionally did not delete files or rename packages; removal of marketing, specialists/personas, package names, fleet APIs, or lock-file consolidation still needs explicit follow-up decisions.

## Transition History
- `2026-05-30T03:34:42Z`: `intake` -> `active`; start productization cleanup audit
- `2026-05-30T03:36:26Z`: `active` -> `qa`; cleanup audit completed

## QA Verdict

- `verdict`: accepted
- `evidence_quality`: Operator reviewed the audit and used it to make the marketing app removal decision; workflow validation and diff checks passed.
- `defects`: none blocking
- `state_transition`: move to `done`
- `2026-05-30T03:45:57Z`: `qa` -> `done`; operator accepted cleanup audit

---
kind: story
id: STORY-20260530-remove-stale-marketing-app
status: done
owner_role: Technical Writer
source: direct
success_metric: The stale marketing app is removed from the public repo surface without breaking workspace install/build flows.
release_scope: required
ready: true
---

# Story: Remove Stale Marketing App

## Metadata
- `id`: STORY-20260530-remove-stale-marketing-app
- `owner_role`: Technical Writer
- `status`: done
- `source`: direct
- `decision_refs`: [0006]
- `success_metric`: The stale marketing app is removed from the public repo surface without breaking workspace install/build flows.
- `release_scope`: required

## Problem Statement

The `apps/marketing/` site predates the current Team Orchestrator direction. It builds a public-facing site that still projects Athena-era messaging, stale docs, and broken deployment validation. In a public repo, that surface makes the project look less mature than the current product actually is.

## Scope
- In: remove `apps/marketing/`, remove workspace lockfile entries, remove Docker package-copy references, update cleanup audit and productization epic to record the decision.
- Out: building a replacement product site, package renames, public docs redesign.

## Assumptions
- Archived marketing records under `docs/product/archive/` remain as history.
- Future product site work can start fresh once the product/docs IA matures.

## Acceptance Criteria
1. `apps/marketing/` is no longer tracked in the repo.
2. Workspace package lock no longer includes `@athena/marketing` or `apps/marketing`.
3. Dockerfiles no longer copy removed marketing package manifests.
4. Product cleanup docs record that the marketing app was removed by decision.
5. Workspace validation passes.

## Validation
- Required checks: `npm install --package-lock-only`, `npm run typecheck`, `git diff --check`, Flywheel workflow validation.
- Additional checks: search for remaining non-archive `apps/marketing` references.

## Dependencies
- Explicit operator approval to remove the stale marketing app.

## Risks
- Removing the app also removes its old public docs/blog prototype; archived records preserve the history.

## Open Questions
- None.

## Next Step
- Remove the app and update repo references.

## Engineering Handoff

- `change_summary`: Removed the stale `apps/marketing/` Astro site and its package lock, removed root lockfile workspace entries for `@athena/marketing`, removed Dockerfile package-copy references to the deleted app, removed the marketing app from the root repository layout, and updated the cleanup audit/productization epic to record the removal decision.
- `validation_evidence`: `npm install --package-lock-only`; `npm run typecheck`; `npm run build`; `rg` confirmed no active package/Docker references to `apps/marketing` or `@athena/marketing`; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`.
- `qa_focus`: Confirm `apps/marketing/` is gone from tracked files, root workspace commands scope only API/console/core/PDK, Dockerfiles no longer reference removed paths, and the audit captures the decision instead of leaving the marketing app as an open question.
- `open_risks`: Historical marketing records remain under `docs/product/archive/`; future public site work should start from current product docs and messaging rather than reviving the removed app.

## Transition History
- `2026-05-30T03:45:57Z`: `active` -> `qa`; stale marketing app removed

## QA Verdict

- `verdict`: accepted
- `evidence_quality`: Operator explicitly approved removing the stale marketing app; workspace typecheck/build and Flywheel validation passed after removal.
- `defects`: none blocking
- `state_transition`: move to `done`
- `2026-05-30T03:49:06Z`: `qa` -> `done`; operator accepted stale marketing app removal

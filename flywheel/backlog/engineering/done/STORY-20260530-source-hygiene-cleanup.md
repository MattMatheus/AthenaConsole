---
kind: story
id: STORY-20260530-source-hygiene-cleanup
status: done
owner_role: Senior Engineer
source: direct
success_metric: Inert tracked artifacts and stale source-adjacent status files are removed without changing runtime behavior.
release_scope: required
ready: true
---

# Story: Source Hygiene Cleanup

## Metadata
- `id`: STORY-20260530-source-hygiene-cleanup
- `owner_role`: Senior Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0010, 0015]
- `success_metric`: Inert tracked artifacts and stale source-adjacent status files are removed without changing runtime behavior.
- `release_scope`: required

## Problem Statement

The code retirement audit found tracked files that are inert or actively misleading after the Team Orchestrator pivot: an orphan gitlink, tracked Terraform plan binaries, nested inactive GitHub workflow files, and stale package-level status docs that point to deleted planning paths.

## Scope
- In: remove `target-clean`, tracked Terraform plan binaries, nested inactive workflow files, `packages/core/TODO.md`, and `packages/core/IMPLEMENT.MD`.
- Out: package renames, runtime API changes, current local/server Docker Compose flows, Terraform source modules, Kubernetes runtime backend source, or console UI behavior.

## Assumptions
- Root `.gitignore` and package `.gitignore` already cover the removed generated/local artifact types.
- The nested workflow files are not active GitHub Actions because they are under `packages/core/.github/workflows/` instead of root `.github/workflows/`.
- Historical rationale remains available through product archives and the new code retirement audit.

## Acceptance Criteria
1. The orphan `target-clean` gitlink is no longer tracked.
2. Terraform binary plan files are no longer tracked.
3. Nested inactive workflow files are no longer tracked.
4. Stale package-level status docs no longer point contributors at deleted planning paths.
5. Validation confirms no whitespace issues and the workflow state remains consistent.

## Validation
- Required checks: `git status --short`, `git diff --check`, `./flywheel/tools/validate_workflow_state.sh --format json`.
- Additional checks: targeted file inventory with `git ls-files` for removed paths.

## Dependencies
- `docs/product/audits/2026-05-30-code-retirement-and-rename-audit.md`

## Risks
- Removing nested workflow files could surprise someone using them as reference material, but their current path makes them look executable when they are not.
- Terraform plans are binary generated artifacts and should not be treated as source of truth.

## Open Questions
- None.

## Next Step
- Remove the inert tracked files, validate, and hand off to QA.

## Engineering Handoff
- `change_summary`: Removed the orphan tracked `target-clean` gitlink, tracked Terraform plan binaries, nested inactive GitHub workflow files under `packages/core/.github/workflows/`, and stale package status docs `packages/core/TODO.md` and `packages/core/IMPLEMENT.MD`. Added the code retirement/rename audit and seeded four follow-up intake stories from it.
- `validation_evidence`: Confirmed `git ls-files` no longer returns the removed paths; ran `git diff --check`; ran `git diff --cached --check`; ran `./flywheel/tools/validate_workflow_state.sh --format json` and it passed.
- `qa_focus`: Verify the deleted paths are truly non-runtime source, confirm no root GitHub workflow was removed, confirm Terraform source files remain, and confirm new Flywheel story summaries are synchronized.
- `open_risks`: No runtime tests were run because this story deletes inert source-adjacent artifacts and generated binaries only. The nested workflow deletion intentionally removes reference material that was not executable from its checked-in path.

## QA Verdict
- `verdict`: accepted
- `evidence_quality`: Strong for a deletion-only hygiene story. `git ls-files` returned no entries for the removed gitlink, Terraform plan binaries, nested workflow files, or stale package status docs; retained Terraform/Docker source files were still tracked; `git diff --check`, `git diff --cached --check`, and workflow validation passed.
- `defects`: none
- `state_transition`: move to `done`

## Transition History
- `2026-05-30T23:46:57Z`: `active` -> `qa`; engineering handoff ready
- `2026-05-30T23:47:38Z`: `qa` -> `done`; QA accepted source hygiene cleanup

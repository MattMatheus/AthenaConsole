---
kind: story
id: STORY-20260529-safe-run-modes-and-proposed-changes
status: ready
owner_role: Software Engineer
source: epic
success_metric: Repo-affecting work defaults to read-only or proposed-change artifacts before any file mutation is applied.
release_scope: next
ready: true
---

# Story: Safe Run Modes And Proposed Changes

## Metadata
- `id`: STORY-20260529-safe-run-modes-and-proposed-changes
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0013, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Repo-affecting work defaults to read-only or proposed-change artifacts before any file mutation is applied.
- `release_scope`: next

## Problem Statement

The product should be able to do useful repo work without surprising operators with file edits or remote mutations.

## Initial Scope

- In: run mode input conventions, `read-only` default, `propose-changes` artifact convention, diff artifact rendering, blocked `approved-write` placeholder if approval support is not complete.
- Out: remote push, automatic commit, complex multi-user approvals.

## Acceptance Criteria

1. Task/workflow inputs can carry `runMode` with `read-only` as the default.
2. Proposed file changes are represented as artifacts, not applied automatically.
3. Console can render proposed diff/change artifacts clearly.
4. Write/apply actions are blocked or explicitly marked unavailable until approval implementation exists.
5. No remote push behavior is introduced.

## Validation

- Core tests for run mode defaults/conventions where implemented.
- Console tests/browser QA for proposed change artifact display.
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This creates the safe UX contract before write-capable agents are promoted.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story

---
kind: story
id: STORY-20260529-repo-app-state-inspection
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators and APIs can persist, list, and inspect connected repository metadata without relying on environment variables.
release_scope: next
ready: true
---

# Story: Repo App-State And Inspection

## Metadata
- `id`: STORY-20260529-repo-app-state-inspection
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0017, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md
- `success_metric`: Operators and APIs can persist, list, and inspect connected repository metadata without relying on environment variables.
- `release_scope`: next

## Problem Statement

Real work needs a durable repository resource. Today repo context is guidance plus environment variables, so the console cannot list, inspect, or select repositories.

## Initial Scope

- In: SQLite repository metadata table/repository, migrations, domain service, API contracts/routes for create/list/get/delete/inspect, Git status inspection for local paths, redacted/clear errors.
- Out: clone flow, Git auth, remote push, console UI.

## Acceptance Criteria

1. App-state includes repository connection records aligned with ADR-0018 fields.
2. API can create `existing-path` repository records and list/get/delete them.
3. API can inspect a repository path for existence, Git status, current branch, head commit, dirty state, and readiness status.
4. Repository records distinguish `workspacePath` and optional `hostPath`.
5. Errors do not expose secrets or unsafe host details beyond the configured path values operators supplied.
6. Existing app-state migrations and exports remain backward compatible for current data.

## Validation

- `npm --workspace @athena/core run typecheck`
- Core tests for repository app-state and inspection service.
- API contract/schema validation if generated artifacts change.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Implement before clone and console stories. Keep the first version local-only and read-only.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story

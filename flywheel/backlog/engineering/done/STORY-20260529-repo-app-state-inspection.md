---
kind: story
id: STORY-20260529-repo-app-state-inspection
status: done
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
- `status`: done
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

## Engineering Handoff
- `change_summary`: Added connected repository contracts, SQLite migration v12, app-state repository, local repository service, API routes, request parsers, API contracts/schemas, and tests. The API now supports creating/listing/getting/deleting `existing-path` repository records, inspecting arbitrary local paths, and refreshing stored repository inspection metadata from Git.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.domain-repositories.test.ts tests/api.connected-repositories.test.ts tests/api.route-registration.test.ts tests/api.schemas.test.ts`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `qa_focus`: Verify repository records preserve `workspacePath` and optional `hostPath`, existing-path creation is local-only, Git inspection reports missing/invalid/ready states plus branch/head/dirty state, and clone/auth/push behavior is not introduced.
- `open_risks`: Git inspection depends on the local `git` binary. API schemas are hand-maintained for the new route family because generated contract schemas do not yet cover these new response components.

## QA Verdict
- `verdict`: Pass. Connected repository app-state, API routes, and Git inspection satisfy the acceptance criteria without introducing clone, auth, or push behavior.
- `evidence_quality`: Strong. QA reran core typecheck, focused repository/API/schema tests, API schema check, manifest validation, Flywheel validation, diff whitespace check, and scoped source search for deferred clone/auth/push/secret behavior.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T03:14:46Z`: `ready` -> `active`; Engineering starts repo app-state and inspection
- `2026-05-29T03:22:12Z`: engineering completed; ready for QA
- `2026-05-29T03:22:30Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T03:23:08Z`: QA passed with no defects
- `2026-05-29T03:22:33Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T03:23:21Z`: `qa` -> `done`; QA passed for repo app-state and inspection

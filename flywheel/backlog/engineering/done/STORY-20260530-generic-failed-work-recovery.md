---
kind: story
id: STORY-20260530-generic-failed-work-recovery
status: done
owner_role: Product Engineer
source: direct
success_metric: Useful DLQ/retry behavior is brought forward as generic failed-work recovery and A2A-specific surfaces are removed.
release_scope: optional
ready: false
---

# Story: Generic Failed Work Recovery

## Metadata
- `id`: STORY-20260530-generic-failed-work-recovery
- `owner_role`: Product Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0008, 0012]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Useful DLQ/retry behavior is brought forward as generic failed-work recovery and A2A-specific surfaces are removed.
- `release_scope`: optional

## Problem Statement

Dead-letter queue behavior may still be useful for recovery and debugging, but A2A-specific terminology belongs to the old product model. Operators need failed-work recovery if it maps to tasks, missions, workflow runs, or scheduled runs.

## Scope
- In: classify A2A DLQ APIs and UI; move useful retry/discard/review behavior to a generic failed-work or failed-run recovery surface; remove A2A-specific docs/routes/pages after current recovery exists.
- Out: preserving A2A concepts for compatibility.

## Acceptance Criteria
1. A current failed-work recovery model exists or the old DLQ behavior is explicitly removed.
2. Any retained recovery UI uses task/run/workflow language, not A2A language.
3. A2A-specific routes, services, docs, and navigation are removed if no longer current.
4. Tests cover retry/discard/recovery behavior or confirm removal.
5. Documentation reflects the final decision.

## Validation
- Required checks: core typecheck, focused API tests, console typecheck/tests if UI changes, `git diff --check`.
- Additional checks: `rg "A2A|a2a|DLQ|dlq"` review outside archives.

## Dependencies
- Useful feature migration epic.

## Risks
- Removing DLQ too early could erase a useful failure-recovery primitive; extract the generic behavior first if it is still valuable.

## Engineering Handoff
- `change_summary`: Brought the old retry/discard review behavior forward as generic failed-work recovery. Added `/api/v1/failed-work`, `/api/v1/failed-work/:id/retry`, and `/api/v1/failed-work/:id/discard`; removed the old A2A DLQ route module from API registration; renamed the control-plane recovery service surface to `failedWorkService`; updated console navigation/page/client code to `/failed-work`; updated docs and API schema generation.
- `validation_evidence`: `npm --workspace @athena/core exec vitest run tests/api.server.test.ts tests/api.route-registration.test.ts tests/api.request-parsers.test.ts tests/api.schemas.test.ts tests/control-plane.authorization.test.ts tests/control-plane.events-dlq.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run build`; `git diff --check`.
- `qa_focus`: Verify `/failed-work` console copy/actions, API retry/discard envelopes and audit events, old `/api/v1/a2a/dlq*` routes returning 404, and failed-work events still contributing to work observability traces.
- `open_risks`: Broader work-flow observability internals still use A2A-prefixed service and parser names; this story kept those because they back the current `/work/observability` and `/work/flows` routes and should be handled in a dedicated observability rename story.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Focused API, schema, service authorization, failed-work service, core typecheck, console typecheck/build, and whitespace checks all passed. Browser tooling was not available in this turn, so console verification is build/typecheck-based.
- `defects`: None found.
- `state_transition`: Ready for `active` -> `done`.

## Transition History
- `2026-05-31T00:51:02Z`: `intake` -> `active`
- `2026-05-31T01:08:30Z`: `active` -> `done`

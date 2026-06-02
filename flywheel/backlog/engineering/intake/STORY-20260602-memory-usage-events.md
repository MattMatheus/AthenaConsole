---
kind: story
id: STORY-20260602-memory-usage-events
status: intake
owner_role: Software Engineer
source: epic
success_metric: Runs emit inspectable durable-memory usage events for search, selection, injection, proposal, review, and write transitions.
release_scope: post-release
ready: false
---

# Story: Memory Usage Events

## Metadata
- `id`: STORY-20260602-memory-usage-events
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0012, ADR-0019, ADR-0020, ADR-0021]
- `epic`: docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md
- `success_metric`: Runs emit inspectable durable-memory usage events for search, selection, injection, proposal, review, and write transitions.
- `release_scope`: post-release

## Problem Statement

Operators cannot trust memory-influenced runs if memory search and injection are invisible. Durable memory needs an audit trail that records what was searched, what was selected, and which proposals or writes resulted from a run without leaking raw memory bodies or secrets into event payloads.

## Initial Scope

- In: durable-memory run event types for search, selected, injected, proposal-created, proposal-approved, proposal-rejected, record-written, archive/delete, and snapshot-related memory outcomes.
- In: event payload validation that includes identifiers, namespace, sensitivity, source, and reason while excluding memory bodies, raw event payloads, transcripts, and credentials.
- In: event emission from runtime memory context and durable-memory proposal/review/write service paths.
- Out: console run detail rendering and semantic retrieval metrics.

## Acceptance Criteria

1. Memory search, selection, injection, proposal, review, and write transitions produce stable run/event payloads.
2. Event payloads include memory record/proposal/snapshot IDs, namespace, sensitivity, operator status, and provenance summary where applicable.
3. Event payload validation rejects raw memory bodies, transcripts, secrets, credentials, and raw artifact payloads.
4. Events correlate to run/task/workflow IDs when a run initiated the memory action.
5. Existing audit/event list APIs can return these events without schema regressions.

## Validation

- Event contract tests.
- Runtime/service event emission tests.
- API/event list tests proving memory events are returned and redacted.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/core run check:schemas` if event schemas are touched.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-memory-runtime-context`

## Transition History
- `2026-06-02T18:20:00Z`: PM refinement created engineering intake story from 2026.36 epic.

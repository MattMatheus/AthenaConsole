---
kind: story
id: STORY-20260602-memory-aware-run-detail
status: intake
owner_role: Software Engineer
source: epic
success_metric: Run detail surfaces show memory used, memory proposed, memory approved/written, and memory-related warnings for each run.
release_scope: post-release
ready: false
---

# Story: Memory-Aware Run Detail

## Metadata
- `id`: STORY-20260602-memory-aware-run-detail
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0012, ADR-0019, ADR-0020, ADR-0021]
- `epic`: docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md
- `success_metric`: Run detail surfaces show memory used, memory proposed, memory approved/written, and memory-related warnings for each run.
- `release_scope`: post-release

## Problem Statement

Even with governance and proposal flows, operators need run inspection to explain how memory affected an agent. Memory influence should be visible beside artifacts, events, readiness, and model/provider metadata.

## Initial Scope

- In: task/run detail memory section that summarizes searched namespaces, selected/injected records, proposals created, proposals reviewed, records written, and memory warnings.
- In: links from run detail to durable-memory inspector filtered to relevant namespace/record/proposal IDs where practical.
- In: display of operator-visible statuses such as remote-current, cache-stale, queued-intent, conflict-review-required, local-dev-only, and diagnostic-only.
- In: clear separation between durable memory and legacy diagnostic memory.
- Out: semantic explanation/ranking UI and connector-specific memory views.

## Acceptance Criteria

1. Run detail shows durable-memory records that influenced the run without rendering raw event payloads or secrets.
2. Run detail shows proposed/approved/rejected/written memory outcomes from the run.
3. Memory statuses and warnings are visible beside run evidence and do not require reading raw event JSON.
4. Links or filters let operators continue from run detail to relevant durable-memory inspector context.
5. Console tests and browser QA cover no-memory, memory-used, stale/cache warning, proposal-created, and memory-written cases.

## Validation

- Console model/component tests for memory event summarization.
- API parser tests for memory-related run events.
- Browser QA across desktop/mobile for task/run detail.
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run lint`
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-memory-usage-events`
- `STORY-20260602-memory-proposed-review`
- `STORY-20260602-memory-artifact-promotion`

## Transition History
- `2026-06-02T18:20:00Z`: PM refinement created engineering intake story from 2026.36 epic.

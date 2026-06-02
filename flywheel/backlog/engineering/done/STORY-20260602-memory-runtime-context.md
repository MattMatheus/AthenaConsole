---
kind: story
id: STORY-20260602-memory-runtime-context
status: done
owner_role: Software Engineer
source: epic
success_metric: Agent runtimes can access durable memory through an inspected, permission-gated execution envelope.
release_scope: post-release
ready: false
---

# Story: Runtime Memory Context

## Metadata
- `id`: STORY-20260602-memory-runtime-context
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0019, ADR-0020, ADR-0021, ADR-0022]
- `epic`: docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md
- `success_metric`: Agent runtimes can access durable memory through an inspected, permission-gated execution envelope.
- `release_scope`: post-release

## Problem Statement

Memory-aware agents need durable context, but runtime access must follow the same inspectable safety posture as tools, artifacts, repositories, and provider settings. Memory should be injected or requested through explicit run wiring, not ambient process state.

## Initial Scope

- In: runtime memory context contract for search/get and proposed-write requests.
- In: enforcement that manifest memory permissions gate runtime memory access.
- In: run readiness or runtime diagnostics showing memory access denied, unavailable, or permitted.
- In: local process/container/http-api runtime integration points where memory context belongs in the execution envelope.
- Out: console proposal review flow, semantic ranking, connector ingestion, and automatic approved writes.

## Acceptance Criteria

1. Runtimes receive memory access only when the selected agent declares compatible memory permissions.
2. Denied memory access fails visibly with a stable error/result shape and does not call the durable-memory provider.
3. Allowed search/get requests use durable-memory APIs with run-linked namespace/provenance input.
4. Proposed-write requests create reviewable durable-memory proposals rather than silently writing records.
5. Runtime diagnostics distinguish unavailable durable memory from denied manifest access.

## Validation

- Runtime service tests for denied and allowed memory access.
- Tests proving denied access does not call the durable-memory provider.
- Tests for proposal creation through runtime memory context.
- `npm --workspace @athena/core run typecheck`
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-memory-manifest-permissions`
- `STORY-20260602-durable-memory-api-routes`

## Transition History
- `2026-06-02T18:20:00Z`: PM refinement created engineering intake story from 2026.36 epic.
- `2026-06-02T20:37:05Z`: `intake` -> `ready`; PM refinement: ready after manifest permissions
- `2026-06-02T20:41:09Z`: `ready` -> `active`; Activate next dependency after manifest permissions passed QA

## Engineering Handoff

- `change_summary`: Added a durable-memory runtime context to task-run envelopes for local-process/container-command and HTTP/API backends, including unavailable/denied/permitted diagnostics, sanitized declared operations, and gated runtime `memoryRequests` for search, get, and proposal creation. Runtime memory requests now fail visibly before provider calls when access is unavailable or undeclared, and permitted proposal requests create durable-memory proposals with task/run/agent provenance. The production control-plane factory now injects the authorized durable-memory service into task workbench runs.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.task-workbench.test.ts`; `npm --workspace @athena/core run typecheck`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh --format json`.
- `qa_focus`: Confirm denied memory requests fail with `phase: memory` and do not call the durable-memory service, permitted search/proposal requests call the service with namespace and run provenance, and memory diagnostics distinguish unavailable provider from denied manifest access.
- `open_risks`: Runtime memory reads are request/response side effects recorded as run events; semantic retrieval/ranking, console proposal review, and approved direct writes remain follow-on stories.
- `2026-06-02T20:46:50Z`: `active` -> `qa`; Engineering handoff ready for runtime memory context

## QA Verdict

- `verdict`: pass
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- control-plane.task-workbench.test.ts`; `npm --workspace @athena/core run typecheck`; `git diff --check`.
- `evidence_quality`: Focused runtime tests cover unavailable context, denied access without provider calls, permitted search calls, proposal creation, and run-linked provenance.
- `state_transition`: Move to `done`; acceptance criteria passed for runtime envelope, permission gating, provider calls, proposal creation, and diagnostics.
- `notes`: Browser QA is not required for this backend/runtime story; console proposal review and run-detail rendering are separate dependent stories.
- `2026-06-02T20:47:28Z`: `qa` -> `done`; QA passed runtime memory context

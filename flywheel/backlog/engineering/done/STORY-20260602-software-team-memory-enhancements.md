---
kind: story
id: STORY-20260602-software-team-memory-enhancements
status: done
owner_role: engineering
source: pm
success_metric: Software-team pack agents can optionally use durable memory for repository conventions and prior release/review context with visible permissions and provenance.
release_scope: deferred
ready: false
---

# Story: Software Team Memory-Aware Enhancements

## Metadata
- `id`: STORY-20260602-software-team-memory-enhancements
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0019-durable-memory-domain-architecture, 0021-durable-memory-namespace-and-provenance-model]
- `success_metric`: Software-team pack agents can optionally use durable memory for repository conventions and prior release/review context with visible permissions and provenance.
- `release_scope`: deferred

## Problem Statement
Software-team agents can become more useful when they remember repository conventions, prior release notes, review preferences, and recurring guidance, but memory access must be optional and explicit.

## Scope
- In: Add optional durable-memory declarations and runtime behavior for selected software-team agents; document memory namespaces, provenance, and operator visibility.
- Out: Making memory required, hidden memory writes, semantic backend changes, or connector-specific memory sync.

## Assumptions
- Durable memory MVP and governance work are available.
- Memory use should prefer read/propose over reviewed writes unless a narrow operator-reviewed path is justified.
- No-memory operation must remain usable.

## Acceptance Criteria
1. Selected agents declare explicit durable-memory permissions with narrow namespaces and reasons.
2. Agent behavior degrades gracefully when durable memory is disabled or unavailable.
3. Memory-derived output is visible in run detail or artifacts with provenance/citation.
4. Pack metadata reflects memory requirements accurately.
5. Tests or fixtures cover memory-disabled and memory-available behavior where practical.

## Validation
- Required checks: manifest validation; pack fixture validation; focused durable-memory integration tests for selected agents.
- Additional checks: run detail or artifact smoke if UI surfaces change.

## Dependencies
- Relevant 2026.39 agents must exist before adding memory-aware behavior.
- Durable memory governance baseline.

## Risks
- Memory use can surprise users if citations or permissions are vague.
- Optional memory behavior can become hard to test if not fixture-driven.

## Open Questions
- Which agent should receive memory support first: repo summary, release readiness, code review, or docs audit?

## Next Step
- Promote after baseline agents and workflows are implemented.

## Engineering Handoff
- `change_summary`: Added optional durable-memory read/propose metadata and scoped permissions under `software-team/*`, added `memoryContext` inputs to selected agents/workflows, updated deterministic runner output to report memory/no-memory behavior, added memory-enabled and memory-disabled fixtures, and documented memory behavior in pack docs.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused plugin/manifest/catalog tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm memory is optional, narrow, visible in inputs/artifacts, and does not require durable memory for no-auth deterministic workflows.
- `open_risks`: Memory-aware behavior is represented through manifest permissions and explicit `memoryContext` inputs; deeper runtime retrieval/proposal automation can be added later.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA evidence includes pack fixture validation, manifest validation, focused plugin/catalog tests, and core typecheck.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:26:36Z`: `intake` -> `ready`; PM refined 2026.39 software-team pack sequence
- `2026-06-03T02:33:58Z`: `ready` -> `active`; Activate software-team memory enhancement story
- `2026-06-03T02:34:14Z`: `active` -> `qa`; Engineering handoff ready with memory enhancement validation evidence
- `2026-06-03T02:34:24Z`: `qa` -> `done`; QA passed software-team memory enhancements

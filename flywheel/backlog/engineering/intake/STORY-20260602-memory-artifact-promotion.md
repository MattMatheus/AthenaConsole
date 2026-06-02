---
kind: story
id: STORY-20260602-memory-artifact-promotion
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators can promote selected run outputs and artifacts into durable memory with explicit namespace, sensitivity, reason, and provenance.
release_scope: post-release
ready: false
---

# Story: Artifact Promotion Into Memory

## Metadata
- `id`: STORY-20260602-memory-artifact-promotion
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0012, ADR-0019, ADR-0020, ADR-0021]
- `epic`: docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md
- `success_metric`: Operators can promote selected run outputs and artifacts into durable memory with explicit namespace, sensitivity, reason, and provenance.
- `release_scope`: post-release

## Problem Statement

Useful run outputs often become future context, but copying them manually loses provenance and safety metadata. Operators need an explicit promotion path from run output/artifact inspection into durable memory.

## Initial Scope

- In: promote-to-memory action from task/run/artifact detail surfaces for text-like outputs and supported artifacts.
- In: namespace, memory type, sensitivity, summary/body preview, and reason capture before promotion.
- In: durable-memory write/proposal creation with artifact/run provenance and safety defaults.
- In: event emission for promotion attempts and outcomes.
- Out: binary artifact ingestion, semantic chunking, connector ingestion, and automatic promotion.

## Acceptance Criteria

1. Supported run outputs/artifacts expose a promote-to-memory action in the console.
2. Promotion requires namespace, memory type, sensitivity, and reason before creating a durable-memory record or proposal.
3. Promotion provenance includes run ID and artifact ID where applicable.
4. Sensitive or secret-adjacent content defaults to reviewed proposal rather than direct durable write.
5. Unsupported/binary artifacts clearly explain why they cannot be promoted.

## Validation

- Console component/model tests for promotion affordances and form state.
- Core service/API tests for artifact/run provenance promotion requests.
- Browser QA for task/run artifact promotion flow.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run lint`
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-memory-runtime-context`
- `STORY-20260602-memory-usage-events`
- `STORY-20260602-memory-proposed-review`

## Transition History
- `2026-06-02T18:20:00Z`: PM refinement created engineering intake story from 2026.36 epic.

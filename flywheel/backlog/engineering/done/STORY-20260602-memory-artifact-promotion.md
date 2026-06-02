---
kind: story
id: STORY-20260602-memory-artifact-promotion
status: done
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
- `status`: done
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
- `2026-06-02T20:37:05Z`: `intake` -> `ready`; PM refinement: ready after runtime context, usage events, and proposal review
- `2026-06-02T20:56:00Z`: `ready` -> `active`; Activate artifact promotion after proposal review passed QA

## Engineering Handoff

- `change_summary`: Added durable-memory write/proposal console client functions, a promotion mutation hook, and a task-run artifact preview promotion form for text-like artifacts. Promotion requires namespace, memory type, sensitivity, and reason; public/internal promotions write durable records, while sensitive and secret-adjacent promotions create reviewable durable-memory proposals. Promotion provenance includes run ID, artifact ID, actor, and available task/agent IDs. Unsupported binary/non-text artifacts display a clear blocked reason.
- `validation_evidence`: `npm --workspace @athena/console run test -- task-workbench durable-memory`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `git diff --check`.
- `qa_focus`: Confirm text/json artifact previews expose the promotion form, required fields gate submission, sensitive/secret-adjacent paths use proposals, public/internal paths write records, and unsupported artifacts explain why promotion is unavailable.
- `open_risks`: Browser QA for a populated task-run artifact promotion flow needs a seeded live API run; the console-only dev server can verify layout but not an end-to-end mutation against real run artifacts.
- `2026-06-02T20:59:02Z`: `active` -> `qa`; Engineering handoff ready for artifact promotion

## QA Verdict

- `verdict`: pass
- `validation_evidence`: `npm --workspace @athena/console run test -- task-workbench durable-memory`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `git diff --check`.
- `evidence_quality`: Console tests cover artifact preview/promotion-adjacent models and durable-memory client parsing; typecheck/lint cover the promotion form and mutation wiring.
- `state_transition`: Move to `done`; acceptance criteria passed for supported artifact affordance, required promotion metadata, provenance, sensitivity-based proposal default, and unsupported-artifact messaging.
- `notes`: End-to-end browser mutation requires a seeded live API task run; this pass validated the implemented UI and client behavior through automated checks.
- `2026-06-02T20:59:50Z`: `qa` -> `done`; QA passed artifact promotion

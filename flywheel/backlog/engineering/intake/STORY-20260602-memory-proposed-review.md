---
kind: story
id: STORY-20260602-memory-proposed-review
status: intake
owner_role: Software Engineer
source: epic
success_metric: Operators can approve, edit, reject, and archive proposed durable-memory writes from the console with provenance and audit visibility.
release_scope: post-release
ready: false
---

# Story: Proposed Memory Review

## Metadata
- `id`: STORY-20260602-memory-proposed-review
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0013, ADR-0019, ADR-0020, ADR-0021]
- `epic`: docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md
- `success_metric`: Operators can approve, edit, reject, and archive proposed durable-memory writes from the console with provenance and audit visibility.
- `release_scope`: post-release

## Problem Statement

Agent-proposed memories should become durable only after operator review. The current inspector makes proposals visible, but operators still need a workflow to approve, edit, reject, or archive proposed memory with a reason and traceable outcome.

## Initial Scope

- In: console proposal review surface for pending durable-memory proposals.
- In: approve, edit-before-approve, reject, and archive/review actions with reason capture.
- In: API/client wiring to durable-memory proposal review routes and resulting record/proposal state.
- In: clear labels for sensitivity, namespace, provenance, and whether a proposal came from an agent run, artifact, import, connector, or operator action.
- Out: bulk review automation, autonomous approval, semantic dedupe, and connector ingestion.

## Acceptance Criteria

1. Operators can review pending proposals with target namespace, memory type, proposed content preview, sensitivity, provenance, and reason.
2. Operators can approve a proposal as-is, edit content before approval, reject it, or archive/dismiss it with a reason.
3. Approved proposals create durable records with preserved provenance and review metadata.
4. Rejected/archived proposals remain visible in review history without becoming future context.
5. Console tests and browser QA cover empty, pending, approved, rejected, edit-before-approve, and unavailable states.

## Validation

- Console API/parser tests for proposal review operations.
- Core API/service tests for proposal approve/edit/reject/archive transitions.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run lint`
- Browser QA across desktop/mobile.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh --format json`

## Dependencies

- `STORY-20260602-memory-runtime-context`
- `STORY-20260602-memory-usage-events`
- `STORY-20260602-durable-memory-console-inspector`

## Transition History
- `2026-06-02T18:20:00Z`: PM refinement created engineering intake story from 2026.36 epic.

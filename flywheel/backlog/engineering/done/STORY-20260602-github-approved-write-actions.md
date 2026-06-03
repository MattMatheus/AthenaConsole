---
kind: story
id: STORY-20260602-github-approved-write-actions
status: done
owner_role: engineering
source: pm
success_metric: Optional GitHub write actions remain blocked until explicit approval and record non-secret audit evidence.
release_scope: deferred
ready: false
---

# Story: GitHub Approved Write Actions

## Metadata
- `id`: STORY-20260602-github-approved-write-actions
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0013-safety-approval-and-loop-limit-model]
- `success_metric`: Optional GitHub write actions remain blocked until explicit approval and record non-secret audit evidence.
- `release_scope`: deferred

## Problem Statement
GitHub writes such as comments, labels, and release-note drafts are useful, but they must never happen silently or without a clear operator approval trail.

## Scope
- In: Add manifest declarations and fixture-backed behavior for tightly scoped optional writes such as draft comments, label suggestions, or release-note draft creation behind explicit approval evidence.
- Out: Unapproved writes, broad repository administration, destructive actions, project-board updates, and live public posting as a CI requirement.

## Assumptions
- Write operations should fail closed without approval evidence.
- Suggested writes should be reviewable artifacts before any approved remote action.
- Audit context should avoid token values and sensitive private-repo payloads.

## Acceptance Criteria
1. GitHub write operations are declared as external writes and require explicit approval.
2. Fixtures cover blocked write and approved write behavior.
3. Audit evidence records operation, target class, run context, and approval decision without secret values.
4. Read-only workflows remain runnable without write scopes.

## Validation
- Required checks: external write approval tests; pack fixture validation; manifest validation.
- Additional checks: optional live smoke only with an explicit test repository and approval.

## Dependencies
- STORY-20260602-github-read-connector.
- STORY-20260602-github-issue-pr-agents.
- STORY-20260602-github-release-notes-agent.

## Risks
- UI or artifact language could make a suggested comment look posted.
- Private repository data can leak if audit context is too verbose.

## Open Questions
- Which write action should be first: comment draft creation, label application, or draft release-note creation?
- Should approved write execution be implemented now or limited to fixture-backed proposed writes?

## Next Step
- PM refined: first write behavior is fixture-backed proposed comment/label/release-draft handling; no live GitHub write execution is added in this epic.

## Engineering Handoff
- `change_summary`: Added GitHub external-write operation declarations for comment drafts, label suggestions, and release draft creation; added approved-write fixture agent and blocked/approved fixture scenarios with no published GitHub writes.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused core tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm external writes are declared approval-required; confirm blocked and approved write fixtures remain non-live and non-secret; confirm read-only workflows still avoid write scopes.
- `open_risks`: Live approved-write execution remains deferred and will require explicit test-repository smoke before release.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed external-write manifest declarations, approved-write fixture agent behavior, blocked/approved fixture scenarios, and non-live/non-secret docs.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T03:01:40Z`: `intake` -> `ready`; PM refined GitHub connector pack story sequence
- `2026-06-03T03:05:53Z`: `ready` -> `active`; Activate GitHub approved write actions story
- `2026-06-03T03:05:53Z`: `active` -> `qa`; Engineering handoff ready with GitHub approved write fixture evidence
- `2026-06-03T03:06:04Z`: `qa` -> `done`; QA passed GitHub approved write fixture actions

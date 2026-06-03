---
kind: story
id: STORY-20260602-software-team-release-agents
status: done
owner_role: engineering
source: pm
success_metric: The bundled software-team pack provides changelog, release-note, and release-readiness agents that can produce reviewable no-auth outputs from local evidence.
release_scope: deferred
ready: false
---

# Story: Software Team Release Agents

## Metadata
- `id`: STORY-20260602-software-team-release-agents
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: The bundled software-team pack provides changelog, release-note, and release-readiness agents that can produce reviewable no-auth outputs from local evidence.
- `release_scope`: deferred

## Problem Statement
Operators preparing releases need built-in help drafting changelog/release-note material and checking readiness from local repository and run evidence.

## Scope
- In: Add changelog/release-note drafting and release readiness review agents; define local evidence inputs; produce markdown artifacts; include fixtures and docs.
- Out: Publishing releases, external tracker/GitHub integration, or automatic approval of release readiness.

## Assumptions
- The existing release-readiness demo can be hardened or expanded.
- Agents should cite local inputs such as commit summaries, release scope, test evidence, docs status, and known risks.
- Provider-backed mode can improve language but should not be required for no-auth operation.

## Acceptance Criteria
1. The pack includes changelog/release-note and release-readiness agents or clearly scoped equivalents.
2. Agents produce reviewable markdown artifacts with local evidence sections.
3. Deterministic fixtures cover a release-note draft and readiness review.
4. Safety posture remains read-only or review-required with no external writes.
5. Validation and focused deterministic tests pass.

## Validation
- Required checks: manifest validation; pack fixture validation; focused release-agent tests.
- Additional checks: workflow-template validation if release workflows are added in this story.

## Dependencies
- `STORY-20260602-software-team-pack-skeleton`.

## Risks
- Release outputs can become generic if fixtures do not include enough evidence.
- Readiness reviews can be mistaken for approval unless language stays operator-reviewed.

## Open Questions
- Should changelog and release notes be one agent with modes or two separate agents?

## Next Step
- Promote after skeleton and base pack docs are stable.

## Engineering Handoff
- `change_summary`: Added bundled changelog drafting and release readiness review agents with deterministic local runner modes, release evidence fixtures, reviewable markdown output, optional memory context, and release-readiness workflow composition.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused plugin/manifest/catalog tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm release outputs remain operator-reviewed drafts; verify no publishing, external tracker, or external write behavior is declared.
- `open_risks`: Release drafts depend on supplied local evidence and can be generic without richer provider-backed context.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA evidence includes pack fixture validation, manifest validation, focused plugin/catalog tests, and core typecheck.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:26:36Z`: `intake` -> `ready`; PM refined 2026.39 software-team pack sequence
- `2026-06-03T02:33:05Z`: `ready` -> `active`; Activate release agent story
- `2026-06-03T02:33:22Z`: `active` -> `qa`; Engineering handoff ready with release agent validation evidence
- `2026-06-03T02:33:36Z`: `qa` -> `done`; QA passed release bundled agents

---
kind: story
id: STORY-20260602-software-team-review-failure-agents
status: done
owner_role: engineering
source: pm
success_metric: The bundled software-team pack provides code review support and test failure explanation agents with deterministic evidence and provider-backed enhancement hooks.
release_scope: deferred
ready: false
---

# Story: Software Team Review And Failure Agents

## Metadata
- `id`: STORY-20260602-software-team-review-failure-agents
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: The bundled software-team pack provides code review support and test failure explanation agents with deterministic evidence and provider-backed enhancement hooks.
- `release_scope`: deferred

## Problem Statement
The software-team pack should help operators inspect code changes and failed tests, two common local workflows that do not require service connectors.

## Scope
- In: Add code review support and test failure explanation agents; define inputs for diff/test logs; produce reviewable artifacts; include deterministic fixtures and provider-ready modes.
- Out: Applying patches, posting PR comments, running external CI APIs, or modifying repositories.

## Assumptions
- Code review support can operate on local diff text, file paths, or provided evidence.
- Test failure explanation can operate on supplied logs or local fixture output.
- Provider-backed behavior improves narrative quality but does not change task/workflow contracts.

## Acceptance Criteria
1. The pack includes code review and test failure explanation agents with bundled manifests.
2. Agents produce structured or markdown artifacts with cited local evidence.
3. Deterministic fixtures cover at least one diff review and one test failure explanation.
4. Provider requirements, if declared, remain optional or clearly visible.
5. Validation and focused runner tests pass.

## Validation
- Required checks: manifest validation; pack fixture validation; focused tests for deterministic runner behavior.
- Additional checks: console catalog smoke if metadata or labels change.

## Dependencies
- `STORY-20260602-software-team-pack-skeleton`.
- May reuse conventions from `STORY-20260602-software-team-repo-docs-agents`.

## Risks
- Review output can imply stronger correctness than deterministic evidence supports.
- Test explanation can become brittle if fixtures assert exact prose.

## Open Questions
- Should review support consume raw diff text, repository paths, or both in the first pass?

## Next Step
- Promote after skeleton and base fixture conventions are stable.

## Engineering Handoff
- `change_summary`: Added bundled code review and test failure explanation agents with deterministic local runner modes, diff/log fixtures, review-support and CI-failure workflow coverage, scoped read-only permissions, and optional memory context for review guidance.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused plugin/manifest/catalog tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm review and failure outputs are review-support artifacts only; verify fixtures avoid external CI/GitHub dependencies and no external writes are declared.
- `open_risks`: Deterministic review output cannot replace human review or provider-backed reasoning.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA evidence includes pack fixture validation, manifest validation, focused plugin/catalog tests, and core typecheck.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:26:36Z`: `intake` -> `ready`; PM refined 2026.39 software-team pack sequence
- `2026-06-03T02:32:44Z`: `ready` -> `active`; Activate review and failure agent story
- `2026-06-03T02:32:55Z`: `active` -> `qa`; Engineering handoff ready with review/failure agent validation evidence
- `2026-06-03T02:33:05Z`: `qa` -> `done`; QA passed review and failure bundled agents

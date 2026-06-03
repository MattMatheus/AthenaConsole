---
kind: story
id: STORY-20260602-github-issue-pr-agents
status: done
owner_role: engineering
source: pm
success_metric: GitHub issue triage, PR summary, and PR review-support agents can produce useful fixture-backed outputs from read-only GitHub context.
release_scope: deferred
ready: false
---

# Story: GitHub Issue And PR Agents

## Metadata
- `id`: STORY-20260602-github-issue-pr-agents
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0012-event-artifact-observability-model]
- `success_metric`: GitHub issue triage, PR summary, and PR review-support agents can produce useful fixture-backed outputs from read-only GitHub context.
- `release_scope`: deferred

## Problem Statement
Operators need practical GitHub agents for issue triage and PR review work that combine remote GitHub metadata with local-first inspection patterns without requiring write permissions.

## Scope
- In: Add issue triage, PR summary, and PR review-support agent manifests, deterministic runners, artifacts, and fixtures.
- Out: Posting comments, applying labels, assigning users, project-board updates, and live GitHub API execution as a required CI path.

## Assumptions
- The agents can start as deterministic fixture-backed local runners.
- Provider-backed summarization can be documented as a future enhancement if the pack remains useful without it.
- PR review support should produce findings and suggested comment drafts, not publish comments.

## Acceptance Criteria
1. The GitHub pack includes agents for issue triage, PR summary, and PR review support.
2. Each agent has deterministic fixtures and produces inspectable markdown or JSON artifacts.
3. PR review support clearly separates suggested comments from approved external writes.
4. The agents consume read-only connector context and do not require write scopes.

## Validation
- Required checks: pack fixture validation; manifest validation; focused runner/fixture tests if runners are testable directly.
- Additional checks: catalog tests if agent metadata or pack grouping changes.

## Dependencies
- STORY-20260602-github-read-connector.

## Risks
- Agent output can look like an action was taken if drafts are not labeled carefully.
- Issue and PR fixture shapes can become too narrow for real repositories.

## Open Questions
- Should issue triage output labels as suggestions only, or include priority/routing fields too?
- Should PR review support include local diff context in this story or defer local composition to workflow stories?

## Next Step
- PM refined: issue triage outputs priority/routing/label suggestions only; PR review support outputs findings and suggested comment drafts that are clearly not posted.

## Engineering Handoff
- `change_summary`: Added GitHub issue triage, PR summary, and PR review-support agent manifests with deterministic runner modes, fixture-backed outputs, and inspectable markdown artifacts.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused core tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm agents consume read-only connector operations; confirm review support labels suggested comments as drafts and does not imply posting.
- `open_risks`: Fixture issue/PR shapes are representative but not exhaustive for all GitHub repository patterns.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed agent manifests, deterministic runner modes, issue/PR fixtures, and validation output.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T03:01:33Z`: `intake` -> `ready`; PM refined GitHub connector pack story sequence
- `2026-06-03T03:05:17Z`: `ready` -> `active`; Activate GitHub issue and PR agents story
- `2026-06-03T03:05:17Z`: `active` -> `qa`; Engineering handoff ready with GitHub issue and PR agent evidence
- `2026-06-03T03:05:28Z`: `qa` -> `done`; QA passed GitHub issue and PR agents

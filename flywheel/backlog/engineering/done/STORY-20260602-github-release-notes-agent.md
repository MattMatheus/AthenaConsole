---
kind: story
id: STORY-20260602-github-release-notes-agent
status: done
owner_role: engineering
source: pm
success_metric: A GitHub release notes agent can draft release notes from selected PRs, issues, commits, and local release context without publishing them.
release_scope: deferred
ready: false
---

# Story: GitHub Release Notes Agent

## Metadata
- `id`: STORY-20260602-github-release-notes-agent
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0012-event-artifact-observability-model]
- `success_metric`: A GitHub release notes agent can draft release notes from selected PRs, issues, commits, and local release context without publishing them.
- `release_scope`: deferred

## Problem Statement
Release prep is a high-value GitHub workflow, but release-note drafting must stay separate from publishing so operators can inspect and approve the output.

## Scope
- In: Add a release notes drafting agent, fixture inputs for PRs/issues/commits, artifact output, and docs describing read-only draft behavior.
- Out: Creating GitHub releases, publishing release notes, uploading assets, and organization-wide changelog automation.

## Assumptions
- The agent can consume selected fixture-backed GitHub records and local release context.
- Draft output should be artifact-first and reviewable.
- Publishing belongs to the approved write action story.

## Acceptance Criteria
1. The GitHub pack includes a release notes draft agent.
2. Fixtures cover selected commits, PRs, issues, and release scope metadata.
3. Output is a draft artifact, not a published release or remote write.
4. Docs explain how the release notes agent differs from approved write actions.

## Validation
- Required checks: pack fixture validation; manifest validation; focused runner/fixture tests if runners are testable directly.
- Additional checks: docs review for release/write separation.

## Dependencies
- STORY-20260602-github-read-connector.

## Risks
- Users may expect draft release notes to be published automatically.
- Commit/PR/issue selection needs clear fixture and input boundaries.

## Open Questions
- Should the draft format target GitHub Releases markdown, a changelog section, or both?
- Should local repo context be required or optional?

## Next Step
- PM refined: draft output targets GitHub Releases-style markdown; local release context is optional but supported.

## Engineering Handoff
- `change_summary`: Added GitHub release notes draft agent with fixture-backed PR, issue, commit, release, and local context inputs; output is a draft artifact and not a published release.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused core tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm output is labeled as draft-only; confirm no release publishing operation is performed by read-only release prep.
- `open_risks`: Future live publishing should remain separated behind approved write behavior.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the release notes agent manifest, runner output semantics, release fixture, and docs separating draft output from publishing.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T03:01:33Z`: `intake` -> `ready`; PM refined GitHub connector pack story sequence
- `2026-06-03T03:05:28Z`: `ready` -> `active`; Activate GitHub release notes story
- `2026-06-03T03:05:28Z`: `active` -> `qa`; Engineering handoff ready with GitHub release notes evidence
- `2026-06-03T03:05:41Z`: `qa` -> `done`; QA passed GitHub release notes draft agent

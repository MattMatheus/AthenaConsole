---
kind: story
id: STORY-20260602-github-workflow-templates
status: done
owner_role: engineering
source: pm
success_metric: GitHub connector workflows compose remote GitHub context with software-team pack agents for PR review, issue triage, release prep, and repo onboarding.
release_scope: deferred
ready: false
---

# Story: GitHub Workflow Templates

## Metadata
- `id`: STORY-20260602-github-workflow-templates
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0015-canonical-orchestration-state-model]
- `success_metric`: GitHub connector workflows compose remote GitHub context with software-team pack agents for PR review, issue triage, release prep, and repo onboarding.
- `release_scope`: deferred

## Problem Statement
The GitHub pack should prove that connector data can compose with local software-team capabilities into practical repeatable workflows, not just standalone agents.

## Scope
- In: Add workflow templates for PR review brief, issue triage round, release prep, and repo onboarding; add deterministic fixtures; document composition with the software-team pack where relevant.
- Out: Background scheduling, GitHub Actions runner management, project-board automation, and automatic remote writes.

## Assumptions
- Workflow templates can use GitHub agents and software-team pack agents as ordinary manifest-backed steps.
- Fixture validation is enough for CI; live smoke remains optional.
- Workflows should keep write actions as proposed outputs unless the approved write story adds an explicit approved path.

## Acceptance Criteria
1. The GitHub pack includes PR review brief, issue triage round, release prep, and repo onboarding workflow templates.
2. Each workflow has at least one deterministic fixture.
3. Workflow docs identify which steps use GitHub context and which use local repo/software-team context.
4. Workflows do not perform unapproved external writes.

## Validation
- Required checks: pack fixture validation; manifest validation; workflow DAG validation.
- Additional checks: workflow catalog tests if composition metadata changes.

## Dependencies
- STORY-20260602-github-read-connector.
- STORY-20260602-github-issue-pr-agents.
- STORY-20260602-github-release-notes-agent.

## Risks
- Cross-pack composition can be brittle if referenced agent IDs change.
- Workflow fixtures can pass while real repo context remains under-specified.

## Open Questions
- Should workflows reference software-team pack agents directly or duplicate minimal local analysis in the GitHub pack?
- Which workflow should be the primary first-run recommendation after GitHub is connected?

## Next Step
- PM refined: workflows may reference software-team pack agents directly for local repo composition; PR review brief is the primary recommended first workflow after GitHub is connected.

## Engineering Handoff
- `change_summary`: Added GitHub PR review brief, issue triage round, release prep, and repo onboarding workflow templates with deterministic fixtures and cross-pack repo onboarding composition.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused core tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm workflow DAGs validate; confirm each workflow has a fixture; confirm no workflow performs unapproved external writes.
- `open_risks`: Cross-pack workflow references depend on bundled software-team agent IDs remaining stable.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed all four workflow templates, deterministic fixtures, workflow DAG validation through manifest package validation, and cross-pack repo onboarding composition.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T03:01:33Z`: `intake` -> `ready`; PM refined GitHub connector pack story sequence
- `2026-06-03T03:05:41Z`: `ready` -> `active`; Activate GitHub workflow templates story
- `2026-06-03T03:05:42Z`: `active` -> `qa`; Engineering handoff ready with GitHub workflow evidence
- `2026-06-03T03:05:53Z`: `qa` -> `done`; QA passed GitHub workflow templates

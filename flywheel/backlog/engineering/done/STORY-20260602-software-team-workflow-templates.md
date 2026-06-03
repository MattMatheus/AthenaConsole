---
kind: story
id: STORY-20260602-software-team-workflow-templates
status: done
owner_role: engineering
source: pm
success_metric: The bundled software-team pack exposes useful workflow templates for repo onboarding, PR review support, release prep, docs health, and CI failure triage.
release_scope: deferred
ready: false
---

# Story: Software Team Workflow Templates

## Metadata
- `id`: STORY-20260602-software-team-workflow-templates
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: The bundled software-team pack exposes useful workflow templates for repo onboarding, PR review support, release prep, docs health, and CI failure triage.
- `release_scope`: deferred

## Problem Statement
Individual agents are useful, but new operators need repeatable built-in workflows that compose software-team capabilities into higher-value local work.

## Scope
- In: Add workflow templates for repo onboarding, PR review support, release prep, docs health check, and CI failure triage where supporting agents exist; include fixtures and docs.
- Out: Connector-backed PR/issue workflows, external CI API calls, and autonomous code modification.

## Assumptions
- Workflow templates can be added incrementally if every candidate agent is not yet present.
- Templates should instantiate with clear inputs and no-auth fixtures where practical.
- Workflows should expose readiness and provider needs through existing catalog surfaces.

## Acceptance Criteria
1. Candidate workflow templates are implemented or explicitly deferred with rationale in pack docs.
2. Implemented workflows reference bundled agents by stable IDs and validate as DAG-safe templates.
3. At least one no-auth workflow can be smoke-validated from fixtures.
4. Workflow docs explain when provider or memory enhancements improve results.
5. Pack fixture validation covers workflow references and inputs.

## Validation
- Required checks: manifest validation; pack fixture validation; workflow catalog or DAG tests.
- Additional checks: console workflow template smoke if UI labels or readiness behavior change.

## Dependencies
- `STORY-20260602-software-team-repo-docs-agents`.
- `STORY-20260602-software-team-review-failure-agents`.
- `STORY-20260602-software-team-release-agents`.

## Risks
- Workflows can overpromise if underlying agents are still shallow.
- Too many templates can crowd the catalog without clear categories.

## Open Questions
- Should workflow templates ship all at once or only when their supporting agents are complete?

## Next Step
- Promote after at least the relevant supporting agents are complete.

## Engineering Handoff
- `change_summary`: Added software-team workflow templates for repo onboarding, docs health check, PR review support, CI failure triage, and release readiness/release prep, each referencing bundled agents by stable IDs and covered by deterministic fixtures where practical.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused plugin/manifest/catalog tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm templates are DAG-safe, reference bundled agents by stable IDs, and do not imply connector-backed PR/CI integration or external writes.
- `open_risks`: Workflows depend on deterministic local inputs until provider-backed enhancements are added.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA evidence includes pack fixture validation, manifest validation, focused plugin/catalog tests, and core typecheck.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:26:36Z`: `intake` -> `ready`; PM refined 2026.39 software-team pack sequence
- `2026-06-03T02:33:36Z`: `ready` -> `active`; Activate software-team workflow template story
- `2026-06-03T02:33:47Z`: `active` -> `qa`; Engineering handoff ready with workflow template validation evidence
- `2026-06-03T02:33:58Z`: `qa` -> `done`; QA passed software-team workflow templates

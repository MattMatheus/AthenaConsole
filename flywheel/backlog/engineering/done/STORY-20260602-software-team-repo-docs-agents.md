---
kind: story
id: STORY-20260602-software-team-repo-docs-agents
status: done
owner_role: engineering
source: pm
success_metric: The bundled software-team pack provides useful no-auth repository summary and docs audit agents with fixtures and provider-ready extension points.
release_scope: deferred
ready: false
---

# Story: Software Team Repo And Docs Agents

## Metadata
- `id`: STORY-20260602-software-team-repo-docs-agents
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: []
- `success_metric`: The bundled software-team pack provides useful no-auth repository summary and docs audit agents with fixtures and provider-ready extension points.
- `release_scope`: deferred

## Problem Statement
New users should get immediate value from repository inspection and documentation health checks without needing to copy sample plugins or configure third-party credentials first.

## Scope
- In: Promote or harden repo summary behavior; add docs audit behavior; provide deterministic local runners, manifests, fixtures, and docs for bundled use.
- Out: GitHub API integration, autonomous edits, external writes, and broad repo mutation.

## Assumptions
- Existing sample plugins such as repo-summary can inform implementation but should not be duplicated blindly.
- Agents should run in no-auth deterministic mode and optionally declare provider-backed enhancement paths where appropriate.
- Repository context comes from task/workflow inputs, not hidden global state.

## Acceptance Criteria
1. The pack includes `software.repo.summary` and `software.docs.audit` style agents or equivalent bundled IDs.
2. Both agents declare clear inputs, outputs, permissions, limits, and capabilities.
3. Both agents can run deterministic no-auth fixture paths.
4. Fixtures cover a small local repository and docs-audit scenario.
5. Pack validation and relevant sample/agent tests pass.

## Validation
- Required checks: `npm --workspace @athena/core run validate:manifests`; `npm --workspace @athena/core run validate:pack-fixtures`; focused pack or sample tests.
- Additional checks: no-auth runner smoke if available; `npm --workspace @athena/core run typecheck`.

## Dependencies
- `STORY-20260602-software-team-pack-skeleton`.

## Risks
- Deterministic summaries can feel too shallow if they only count files.
- Docs audits can become noisy without clear evidence and scoped recommendations.

## Open Questions
- Should these agents reuse PDK helpers or remain simple local runners for bundled-pack stability?

## Next Step
- Promote after pack skeleton is complete.

## Engineering Handoff
- `change_summary`: Added bundled repository summary and docs audit agents with deterministic local runner modes, scoped permissions, optional memory context, docs, fixtures, and repo onboarding/docs health workflow coverage.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed; `npm --workspace @athena/core run validate:manifests` passed; focused plugin/manifest/catalog tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Verify repo/docs agents declare clear inputs, outputs, permissions, and capabilities; confirm fixtures exercise no-auth local behavior and optional memory context remains non-required.
- `open_risks`: Deterministic repo and docs outputs are evidence summaries, not deep model-backed analysis.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA evidence includes pack fixture validation, manifest validation, focused plugin/catalog tests, and core typecheck.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T02:26:36Z`: `intake` -> `ready`; PM refined 2026.39 software-team pack sequence
- `2026-06-03T02:32:20Z`: `ready` -> `active`; Activate repo and docs agent story
- `2026-06-03T02:32:32Z`: `active` -> `qa`; Engineering handoff ready with repo/docs agent validation evidence
- `2026-06-03T02:32:44Z`: `qa` -> `done`; QA passed repo and docs bundled agents

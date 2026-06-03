---
kind: story
id: STORY-20260602-github-read-connector
status: done
owner_role: engineering
source: pm
success_metric: GitHub connector packs can read repository, issue, pull request, commit, and release data through fixture-backed connector primitives without write scopes.
release_scope: deferred
ready: false
---

# Story: GitHub Read Connector

## Metadata
- `id`: STORY-20260602-github-read-connector
- `owner_role`: engineering
- `status`: done
- `source`: pm
- `decision_refs`: [0008-plugin-package-format, 0013-safety-approval-and-loop-limit-model]
- `success_metric`: GitHub connector packs can read repository, issue, pull request, commit, and release data through fixture-backed connector primitives without write scopes.
- `release_scope`: deferred

## Problem Statement
The GitHub pack needs a read-only connector foundation before issue, PR, release, or onboarding agents can safely depend on remote GitHub context.

## Scope
- In: Define GitHub connector manifest metadata, auth binding expectations, read scopes, rate-limit posture, fixture-backed read client behavior, and readiness output for missing credentials/scopes.
- Out: GitHub write actions, full OAuth app setup, GitHub Actions management, project-board automation, and live-service requirements in CI.

## Assumptions
- Personal access token or app-token references are enough for the first pack posture.
- Read-only workflows should run with read scopes only.
- Fixture-backed tests are required; live smoke is optional and must be clearly separated.

## Acceptance Criteria
1. A bundled GitHub connector pack can declare service identity, auth binding, read scopes, rate limits, and read operations.
2. Read fixtures cover repository, issue, pull request, commit, and release data shapes without live network calls.
3. Missing credentials and missing scopes are visible through connector readiness.
4. The pack does not require write scopes for read-only workflows.

## Validation
- Required checks: `npm --workspace @athena/core run validate:pack-fixtures`; focused connector/readiness tests; `npm --workspace @athena/core run typecheck`.
- Additional checks: manifest validation and docs review for scope language.

## Dependencies
- Epic 2026.40 Connector Pack Platform.

## Risks
- GitHub scope naming and token types can confuse operators if docs are vague.
- Rate-limit fixtures can overfit before live behavior is tested.

## Open Questions
- Should the first credential posture prefer fine-grained PATs, GitHub App tokens, or both as documented options?
- Which minimum read scopes should be canonical for private repositories?

## Next Step
- PM refined: use fine-grained PAT or GitHub App token references; required read scopes are `contents:read`, `issues:read`, `pull_requests:read`, and `metadata:read`; CI remains fixture-backed with no live network calls.

## Engineering Handoff
- `change_summary`: Added bundled `github` connector pack with GitHub service metadata, credential binding instructions, read scopes, rate-limit posture, read operations, and fixtures covering repository, issue, PR, commit, and release data shapes.
- `validation_evidence`: `npm --workspace @athena/core run validate:pack-fixtures` passed and reported `ok github`; `npm --workspace @athena/core run validate:manifests` passed; focused core tests passed; `npm --workspace @athena/core run typecheck` passed.
- `qa_focus`: Confirm required read scopes are declared; confirm read workflows do not require write scopes; confirm fixtures declare `liveNetwork: false`.
- `open_risks`: Live GitHub API behavior and exact token guidance still need optional smoke validation before broader release.

## QA Verdict
- `verdict`: Pass. Acceptance criteria are met.
- `evidence_quality`: Strong. QA reviewed the GitHub pack manifest, read-scope declarations, fixtures, and validation output.
- `defects`: None.
- `state_transition`: Move to `done`.

## Transition History
- `2026-06-03T03:01:33Z`: `intake` -> `ready`; PM refined GitHub connector pack story sequence
- `2026-06-03T03:01:40Z`: `ready` -> `active`; Activate GitHub read connector dependency
- `2026-06-03T03:04:58Z`: `active` -> `qa`; Engineering handoff ready with GitHub read connector validation evidence
- `2026-06-03T03:05:17Z`: `qa` -> `done`; QA passed GitHub read connector

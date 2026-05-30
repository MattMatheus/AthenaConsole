---
kind: story
id: STORY-20260530-product-readiness-smoke-suite
status: done
owner_role: SDET
source: planning
success_metric: One documented smoke path verifies startup, catalog, provider readiness, task run, and artifact inspection before external review.
release_scope: required
ready: true
---

# Story: Product Readiness Smoke Suite

## Metadata
- `id`: STORY-20260530-product-readiness-smoke-suite
- `owner_role`: SDET
- `status`: done
- `source`: planning
- `decision_refs`: [0012, 0013, 0018]
- `success_metric`: One documented smoke path verifies startup, catalog, provider readiness, task run, and artifact inspection before external review.
- `release_scope`: required

## Problem Statement

The product can run useful work, but readiness is currently proven through ad hoc manual checks. Before sharing with more users, the repo needs a repeatable product smoke path.

## Scope
- In: root product smoke command/checklist for running local API, readiness endpoint, sample catalog visibility, credential-free first-run workflow execution, task-run artifact metadata inspection, optional provider-backed/manual console checks, docs links.
- Out: full e2e browser automation suite, load testing, hosted deployment certification.

## Assumptions
- The first smoke suite can combine scripted API checks with a small manual console checklist.
- Model-backed smoke may need a configured provider, while mock smoke should remain credential-free.

## Acceptance Criteria
1. A single documented command or checklist verifies the current local product path.
2. The smoke path supports both credential-free demo and provider-backed optional checks.
3. Failures point to likely setup causes.
4. The smoke path is linked from `README.md` or `GETTING_STARTED.md`.
5. Validation evidence is captured in the story handoff.

## Validation
- Required checks: run smoke path locally, `npm run typecheck`, focused package tests where applicable, `git diff --check`.
- Additional checks: manual browser QA on console task/run/artifact path.

## Dependencies
- Documentation information architecture recommended.

## Risks
- Browser automation availability may vary, so the first suite should not depend entirely on UI tooling.

## Open Questions
- Should future smoke output become a saved artifact under `.athena/` after the terminal-only path is proven?

## Next Step
- Activate for engineering. Implement the smoke command, docs entry point, and focused validation.

## PM Refinement
- `what_changed`: Bounded the first product readiness smoke suite to a root command against a running local API plus a documented manual console/provider checklist.
- `why_it_matters`: A new operator or reviewer needs one repeatable path that proves the current local product works without external credentials, while still showing where provider-backed checks fit.
- `acceptance_criteria`: Command verifies health/readiness, sample catalog visibility, first-run workflow execution, workflow status, and task-run artifact metadata; docs link the smoke path from first-run setup; optional provider/manual console checks are documented; failures include likely setup causes.
- `risks_and_assumptions`: The command assumes the local stack/API is already running; browser automation and provider-backed model calls remain optional.
- `next_state_recommendation`: Move to engineering active.

## Engineering Handoff
- `change_summary`: Added root `npm run smoke:product` command backed by `scripts/product-readiness-smoke.mjs`. The smoke script checks a running local API for health, readiness, first-run demo agent catalog visibility, first-run workflow template availability, workflow instantiation/execution/status, and linked task-run artifact metadata. Documented the smoke path in `GETTING_STARTED.md`, including optional provider-backed/manual console checks and `--api-base-url` usage.
- `validation_evidence`: `node --check scripts/product-readiness-smoke.mjs`; `npm run typecheck`; `npm --workspace @athena/core run test:unit -- control-plane.readiness`; local API smoke run on `http://127.0.0.1:18787` with `npm run smoke:product -- --api-base-url http://127.0.0.1:18787 --run-id qa-smoke2`; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`.
- `qa_focus`: Confirm the smoke command reports actionable failures, remains credential-free for the first-run demo path, tolerates readiness `degraded` when required checks pass, and inspects workflow-linked task-run artifact metadata.
- `open_risks`: Browser console artifact preview remains a documented manual check rather than automated browser QA in this slice.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Required checks passed in QA: `node --check scripts/product-readiness-smoke.mjs`, `npm run typecheck`, `npm --workspace @athena/core run test:unit -- control-plane.readiness`, `npm run smoke:product -- --api-base-url http://127.0.0.1:18788 --run-id qa-smoke-final` against a local API, `./flywheel/tools/validate_workflow_state.sh --format json`, and `git diff --check`.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-30T22:47:33Z`: `intake` -> `active`; PM refined and activated product readiness smoke suite
- `2026-05-30T22:50:51Z`: `active` -> `qa`; product readiness smoke suite engineering handoff ready
- `2026-05-30T22:52:54Z`: `qa` -> `done`; QA passed product readiness smoke suite

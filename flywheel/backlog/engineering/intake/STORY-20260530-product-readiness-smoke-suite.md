---
kind: story
id: STORY-20260530-product-readiness-smoke-suite
status: intake
owner_role: SDET
source: planning
success_metric: One documented smoke path verifies startup, catalog, provider readiness, task run, and artifact inspection before external review.
release_scope: required
ready: false
---

# Story: Product Readiness Smoke Suite

## Metadata
- `id`: STORY-20260530-product-readiness-smoke-suite
- `owner_role`: SDET
- `status`: intake
- `source`: planning
- `decision_refs`: [0012, 0013, 0018]
- `success_metric`: One documented smoke path verifies startup, catalog, provider readiness, task run, and artifact inspection before external review.
- `release_scope`: required

## Problem Statement

The product can run useful work, but readiness is currently proven through ad hoc manual checks. Before sharing with more users, the repo needs a repeatable product smoke path.

## Scope
- In: smoke checklist or script for dev startup, readiness endpoint, catalog visibility, provider config, task creation/run, run detail, artifact preview, docs links.
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
- Should smoke output become a saved artifact under `.athena/` or stay terminal-only for now?

## Next Step
- Refine after the cleanup audit and docs map define the release-readiness entry point.

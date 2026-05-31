---
kind: story
id: STORY-20260530-persona-specialist-compatibility-plan
status: done
owner_role: Software Architect
source: direct
success_metric: Persona/specialist code is explicitly classified as compatibility, migrated to plugin agents, or retired.
release_scope: required
ready: false
---

# Story: Persona And Specialist Compatibility Plan

## Metadata
- `id`: STORY-20260530-persona-specialist-compatibility-plan
- `owner_role`: Software Architect
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0007, 0008, 0009]
- `success_metric`: Persona/specialist code is explicitly classified as compatibility, migrated to plugin agents, or retired.
- `release_scope`: required

## Problem Statement

Persona and specialist concepts remain wired into CLI, API, PDK compatibility exports, artifact directories, and checked-in `specialists/` assets. Some of this may still be useful, but it conflicts with the current product model centered on manifest-backed plugin agents.

## Scope
- In: decide support status for `/api/v1/personas/run`, `/api/v1/specialists/run`, `athena persona`, `athena specialist`, `packages/core/src/personas`, `packages/core/src/specialists`, PDK persona helpers, and checked-in `specialists/` assets.
- Out: immediate deletion without migration/deprecation notes, package renames, or changing task/mission runtime semantics.

## Assumptions
- `specialists/code-review` may be worth migrating into a plugin-backed sample agent.
- `specialists/athena-prime` references deleted planning paths and should not remain active guidance.

## Acceptance Criteria
1. A compatibility decision is recorded for each persona/specialist API, CLI, PDK, source, and asset surface.
2. Deprecated surfaces have a migration path toward plugin-backed agents.
3. Any retained compatibility layer is named and documented as such.
4. Follow-up implementation stories are created for migration or removal.

## Validation
- Required checks: documentation review, `rg "persona|specialist"` classification table, `git diff --check`.
- Additional checks: manifest validation if sample plugins are introduced.

## Dependencies
- Code retirement audit.

## Risks
- Removing this too fast could break compatibility tests and old local workflows.

## Open Questions
- Should code review remain a first-class example agent?

## Next Step
- Architecture/PM should classify each surface before engineering removes behavior.

## Engineering Handoff
- `change_summary`: Added `docs/product/audits/2026-05-30-persona-specialist-compatibility-plan.md` with an explicit compatibility/migrate/deprecate/retire classification for persona/specialist APIs, CLI aliases, runtime source folders, PDK helpers, artifact paths, and checked-in specialist assets. Added story-ready follow-up proposals for code-review plugin migration, persona alias deprecation, Athena Prime retirement, and PDK compatibility docs. Updated package docs to label persona/specialist/A2A paths as compatibility workflows and linked the plan from `docs/README.md`.
- `validation_evidence`: `rg -n "persona|specialist" docs/product/audits/2026-05-30-persona-specialist-compatibility-plan.md packages/core/docs/user/00-quickstart.md packages/core/docs/user/03-basic-usage.md packages/core/docs/user/04-api-server.md packages/core/docs/user/05-advanced-usage.md packages/core/docs/personas/README.md` confirms the classification table and compatibility labels; `git diff --check` passed; `./flywheel/tools/validate_workflow_state.sh --format json` passed.
- `qa_focus`: Confirm every requested surface has a compatibility decision, retained compatibility layers are labeled, and the follow-up proposals are specific enough to become implementation stories without creating immediate deletion risk.
- `open_risks`: The plan intentionally defers code deletion, CLI warnings, and asset migration to follow-up stories because removing compatibility behavior in this same change would be high blast radius.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Classification table covers the requested API, CLI, PDK, source, artifact, and asset surfaces; package docs now label compatibility paths; whitespace and workflow validation passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-31T00:05:22Z`: `intake` -> `active`
- `2026-05-31T00:07:54Z`: `active` -> `qa`
- `2026-05-31T00:08:19Z`: `qa` -> `done`

---
kind: story
id: STORY-20260530-remove-persona-specialist-runtime
status: done
owner_role: Senior Engineer
source: direct
success_metric: Persona/specialist runtime, CLI, API, docs, and stale assets are removed after useful behavior moves to plugin agents.
release_scope: required
ready: true
---

# Story: Remove Persona Specialist Runtime

## Metadata
- `id`: STORY-20260530-remove-persona-specialist-runtime
- `owner_role`: Senior Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0007, 0008, 0009]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Persona/specialist runtime, CLI, API, docs, and stale assets are removed after useful behavior moves to plugin agents.
- `release_scope`: required

## Problem Statement

Compatibility is not required. Once code-review is migrated to a plugin-backed agent, the persona/specialist runtime becomes a parallel old abstraction that increases maintenance cost and confuses the product model.

## Scope
- In: remove `/api/v1/personas*` and `/api/v1/specialists*`; remove `athena persona` and `athena specialist`; remove `packages/core/src/personas/*` and `packages/core/src/specialists/*`; remove or archive `specialists/athena-prime`; remove stale persona docs; update PDK exports/docs so current agent APIs lead.
- Out: removing plugin-backed agents, task/mission/workflow execution, current run artifacts, or the migrated code-review sample.

## Acceptance Criteria
1. No current API route exposes persona or specialist execution.
2. No CLI command exposes persona or specialist execution.
3. `specialists/athena-prime` is removed or archived outside active guidance.
4. `specialists/code-review` is gone from active source after migration.
5. PDK/docs no longer present persona helpers as current APIs; obsolete helpers are removed if no tests need them.
6. Tests and generated schemas no longer require persona/specialist runtime code.

## Validation
- Required checks: core typecheck, schema check, core tests impacted by API/CLI/schema changes, PDK tests, `rg "persona|specialist|athena-prime" packages/core/src packages/pdk/src apps/console/src packages/core/docs docs/user-guide --glob '!**/dist/**'`, `git diff --check`.

## Dependencies
- `STORY-20260530-code-review-plugin-agent-migration`

## Risks
- This is intentionally high blast radius; execute after the code-review plugin path exists and tests identify all old dependencies.

## Engineering Handoff
- `change_summary`: Removed the retired persona/specialist execution surface from the API route registry, API contracts/schemas, CLI command dispatch, CLI usage, direct API client helpers, control-plane service graph, PDK exports, runtime source directories, active package docs, and active specialist assets. Renamed remaining useful policy/session/RBAC/operations metadata to agent-oriented fields (`agentId`, `agentName`, `agents`) so the current product model stays coherent without compatibility aliases.
- `validation_evidence`: `npm --workspace @athena/core exec vitest run tests/api.server.test.ts tests/api.route-registration.test.ts tests/control-plane.api-contracts.test.ts tests/api.request-parsers.test.ts tests/api.auth-middleware.test.ts tests/control-plane.authorization.test.ts tests/control-plane.state-ownership.test.ts tests/tools.symbolic-navigation.test.ts tests/observability.application-insights.test.ts tests/control-plane.events-dlq.test.ts tests/control-plane.operations-cost-summary.test.ts tests/providers.mock.test.ts`; `npm --workspace @athena/core exec vitest run tests/cli.test.ts tests/cli.parity.test.ts tests/cli.memory.test.ts tests/cli.schedule.test.ts tests/cli.work.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/pdk run typecheck`; `npm --workspace @athena/pdk test`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run build`; `rg -n "persona|specialist|athena-prime" packages/core/src packages/pdk/src apps/console/src packages/core/docs docs/user-guide -g '!**/dist/**'` returned no matches; `git diff --check`.
- `qa_focus`: Verify removed routes return unknown route responses, current agent catalog/task/mission/session/RBAC flows still speak agent terminology, generated component schemas expose agent-oriented fields, and PDK package entrypoint remains focused on plugin-backed agent helpers.
- `open_risks`: This intentionally removes compatibility for direct persona/specialist imports, route clients, and historical run artifact readers. Existing local state under retired run directories is no longer surfaced through session artifacts.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: High. Covered route registration/contracts, API server behavior, request parsers, auth/RBAC scope handling, operations/event payloads, CLI command surface, generated schemas, PDK package tests, console typecheck/build, retired-term grep, and whitespace validation.
- `defects`: None found in the validated surface.
- `state_transition`: Ready for `engineering/done`.

## Transition History
- `2026-05-31T01:18:19Z`: `intake` -> `active`
- `2026-05-31T01:31:20Z`: `active` -> `done`

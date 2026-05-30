---
kind: story
id: STORY-20260530-agent-id-collision-diagnostics
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: Operators can see duplicate plugin or agent identifiers and understand which manifest must change.
release_scope: next
ready: false
---

# Story: Plugin And Agent Id Collision Diagnostics

## Metadata
- `id`: STORY-20260530-agent-id-collision-diagnostics
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0007, ADR-0008]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: Operators can see duplicate plugin or agent identifiers and understand which manifest must change.
- `release_scope`: next

## Problem Statement

When an operator copies a sample plugin without changing plugin or agent ids, the catalog outcome is ambiguous. The copied agent may not appear as expected, and the UI does not clearly explain that ids collided.

## Initial Scope

- In: duplicate plugin id and agent id detection during plugin indexing, API/catalog issue payloads, console surfacing on Agents and agent detail where practical.
- Out: automatic id rewriting, plugin scaffolding wizard, remote marketplace semantics.

## Acceptance Criteria

1. The plugin index records duplicate plugin id and duplicate agent id issues with file paths.
2. Catalog APIs expose collision issues without crashing or hiding all valid agents.
3. The Agents console shows collision diagnostics with enough detail to identify the copied manifest.
4. Valid non-colliding plugins remain available when another plugin collides.
5. Tests cover duplicate plugin id and duplicate agent id cases.

## Validation

- `npm --workspace @athena/core run typecheck`
- Focused plugin index/catalog tests.
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `npm --workspace @athena/core run validate:manifests`
- `git diff --check`

## Refinement Notes

Use the local-user-test copy flow as the main QA fixture: copy a plugin, intentionally leave one duplicate id, and verify the UI tells the operator exactly what to change.

## Engineering Handoff

- `completed_at`: 2026-05-30T02:42:00Z
- `change_summary`: Added plugin-index collision detection for duplicate plugin id/version and agent id/version values. Duplicate plugin copies keep the first discovered package valid and persist later copies as invalid synthetic plugin records with file-path diagnostics. Duplicate agent ids mark each colliding package invalid so catalog validation surfaces both manifest paths instead of silently overwriting agents. The Agents page now shows a duplicate-id warning band and includes file paths in plugin validation messages.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.plugin-loader.test.ts tests/control-plane.agent-catalog.test.ts`; `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `npm --workspace @athena/console run test`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`.
- `qa_focus`: Create a temporary copied plugin with an unchanged plugin id or agent id, refresh the catalog, and confirm the Agents page shows the duplicate-id warning and file paths while valid non-colliding agents remain available.
- `open_risks`: Duplicate plugin records use a synthetic invalid id to avoid overwriting the first valid package; stale synthetic records from older duplicate experiments may need a future cleanup story if operators frequently create/remove bad copies.

## Transition History
- `2026-05-30T02:38:30Z`: `intake` -> `active`; operator validated duplicate-id gap; start engineering
- `2026-05-30T02:42:20Z`: `active` -> `qa`; engineering handoff ready

## QA Verdict

- `verdict`: accepted
- `evidence_quality`: Automated core and console validation passed; operator confirmed copied-agent behavior after API restart and duplicate-id diagnosis.
- `defects`: none blocking
- `state_transition`: move to `done`
- `2026-05-30T03:28:15Z`: `qa` -> `done`; operator accepted duplicate-id diagnostics

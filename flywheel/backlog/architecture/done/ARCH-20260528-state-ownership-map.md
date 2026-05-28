---
kind: architecture
id: ARCH-20260528-state-ownership-map
status: done
owner_role: Architect
source: epic
success_metric: Every durable state domain has a documented owner and migration classification.
release_scope: follow-up
ready: false
---

# Architecture: Map State Ownership Domains

## Metadata
- `id`: ARCH-20260528-state-ownership-map
- `owner_role`: Architect
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0012, ADR-0015, ADR-0016]
- `epic`: docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md
- `success_metric`: Every durable state domain has a documented owner and migration classification.
- `release_scope`: follow-up

## Problem Statement

Team Orchestrator now has strong SQLite app-state coverage, but several service domains still use file-backed stores. PM and engineering need a durable ownership map before migrating more state.

## Scope

- In: inventory service/domain state owners, classify each domain, define migration/removal candidates and order, document intentional file-backed artifact domains.
- Out: implementing migrations, changing API behavior.

## Acceptance Criteria

1. Every current state domain is classified as SQLite app-state, intentional file artifact, deprecated file-backed state to remove, or migration candidate.
2. Migration order is explicit and references the engineering stories in this epic.
3. Intentional file-backed artifacts are separated from control-plane resources that should migrate.
4. Product direction links to the ownership map.
5. Architecture handoff identifies validation expectations for each migration story.

## Validation

- Required checks: docs link consistency by inspection, `./flywheel/tools/validate_workflow_state.sh`.

## Dependencies

- Recommended before all state migration engineering stories.

## Risks

- Over-classifying artifact payloads as database state could create unnecessary migrations.
- Under-classifying deprecated file-backed state could leave future stories with ambiguous ownership.

## Next Step

Architecture refinement should create the ownership map and confirm migration order.

## Architecture Handoff
- `decision_summary`: SQLite is the canonical local app-state store for operator-facing control-plane records. Filesystem storage remains valid for source manifests, transcripts, logs, and artifact payloads. Deprecated file-backed control-plane state should be migrated forward or removed without read bridges, file-store fallbacks, or long-term compatibility shims.
- `state_map_artifacts`: `docs/product/architecture/state-ownership-map.md`
- `migration_order`: diagnostics; harness profiles; directives; run templates; session/transcript/evidence/artifact classification; deprecated legacy workflow file-state removal.
- `alternatives_considered`: Keep file-backed control-plane domains with compatibility labels; rejected because the product no longer needs shims and split ownership would keep future engineering ambiguous. Move artifact payloads into SQLite; rejected because large transcript/evidence/artifact bytes are better kept inspectable on disk while metadata/indexes stay queryable.
- `operational_impact`: Operators and maintainers get one durable map for active stores, intentional artifact roots, deprecated roots, and migration order. Diagnostics stories should surface paths without exposing secrets or payload contents.
- `follow_on_work`: Activate `STORY-20260528-state-store-startup-diagnostics` first, then migrate harness profiles, directives, and run templates to SQLite in order before removing deprecated legacy workflow file state.
- `validation_evidence`: docs link consistency reviewed by inspection; `./flywheel/tools/validate_workflow_state.sh` passed; `git diff --check` passed.
- `open_risks`: diagnostics must avoid leaking payload or secret contents; removing deprecated workflow file paths should wait until canonical workflow DAG route coverage is confirmed.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Ownership map covers SQLite app-state, intentional file artifacts/support state, migration candidates, and deprecated file-backed state to remove. Direction and epic docs link to the map.
- `defects`: None found.
- `state_transition`: Move to architecture done.

## Transition History
- `2026-05-28T20:28:54Z`: `intake` -> `active`; activate prerequisite state ownership map before engineering stories
- `2026-05-28T20:30:24Z`: `active` -> `qa`; architecture handoff ready for state ownership map
- `2026-05-28T20:31:07Z`: `qa` -> `done`; QA passed for state ownership map

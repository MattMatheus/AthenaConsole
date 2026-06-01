---
kind: story
id: STORY-20260601-future-roadmap-arcs
status: done
owner_role: PM
source: direct
success_metric: Post-2026.1 roadmap has two discoverable future arcs with sequenced epics for durable memory and built-in capability/connector packs.
release_scope: post-release
ready: true
---

# Story: Future Roadmap Arcs

## Metadata
- `id`: STORY-20260601-future-roadmap-arcs
- `owner_role`: PM
- `status`: done
- `source`: direct
- `decision_refs`: []
- `success_metric`: Post-2026.1 roadmap has two discoverable future arcs with sequenced epics for durable memory and built-in capability/connector packs.
- `release_scope`: post-release

## Problem Statement

After the first `2026.1` release candidate, Team Orchestrator should focus less on broad product surface area and more on built-in usefulness. Two future roadmap arcs need durable planning artifacts: a remote-capable memory system and first-party agent/connector capability packs.

## Scope

- In: future-horizon roadmap overview, multiple refinement epics for durable memory, multiple refinement epics for built-in capability/connector packs, and docs index updates.
- Out: implementation stories, active feature work before `2026.1`, service/backend selection finalization, and connector code.

## Acceptance Criteria

1. Product docs include a future-horizon roadmap that defines the two arcs and sequencing guidance.
2. Durable memory is planned as remote-capable product memory, with SQLite positioned as local cache/dev/test rather than the cross-machine source of truth.
3. Built-in capability and connector packs are planned as first-party plugin-backed agents and workflows.
4. Multiple refinement epics exist for each arc.
5. Current direction and roadmap indexes link to the future-horizon plan without making it active Flywheel work.

## Validation

- `./flywheel/tools/validate_workflow_state.sh --format json`
- `git diff --check`
- Manual docs link/path review.

## Engineering Handoff
- `change_summary`: Added the post-`2026.1` future-horizon roadmap with two arcs: durable remote-capable memory and built-in capability/connector packs. Added nine future refinement epics covering memory architecture, remote memory MVP, memory governance, semantic/sync backends, capability pack foundation, software-team agents, connector platform, GitHub connector, and knowledge-work connectors. Updated product direction and roadmap indexes so the plan is discoverable but remains post-release.
- `validation_evidence`: `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`; scripted docs path check for future-horizon references returned `future roadmap doc links ok`.
- `qa_focus`: Verify that the docs clearly position these epics as future-horizon work, not active release scope, and that the memory arc reflects the remote durability concern.
- `open_risks`: The remote memory backend choice remains intentionally open for architecture refinement.

## QA Verdict
- `verdict`: accept
- `evidence_quality`: Good. The roadmap is docs-only, linked from the existing product direction and roadmap indexes, and explicitly scoped as post-release future-horizon work.
- `defects`: None found.
- `state_transition`: move to done

## Transition History
- `2026-06-01T14:50:49Z`: `active` -> `qa`
- `2026-06-01T14:51:15Z`: `qa` -> `done`

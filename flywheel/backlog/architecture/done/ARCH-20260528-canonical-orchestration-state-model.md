---
kind: architecture_story
id: ARCH-20260528-canonical-orchestration-state-model
status: done
owner_role: Software Architect
source: planning
decision_owner: Software Architect
success_metric: Workflow templates, missions, tasks, schedules, runs, and workflow DAG status have one documented canonical state ownership model.
ready: true
---

# Architecture Story: Canonical Orchestration State Model

## Metadata
- `id`: ARCH-20260528-canonical-orchestration-state-model
- `owner_role`: Software Architect
- `status`: done
- `source`: planning
- `decision_refs`: [ADR-0009, ADR-0010, ADR-0012, ADR-0014, ADR-0015]
- `decision_owner`: Software Architect
- `success_metric`: Workflow templates, missions, tasks, schedules, runs, and workflow DAG status have one documented canonical state ownership model.

## Decision Scope
Choose and document the canonical orchestration state path across workflow-template instantiation, mission/task execution, scheduling, run history, artifacts/events, and workflow DAG status.

## Problem Statement
The product direction says SQLite app state is the v1 durable store, but live orchestration has multiple partially true models: file-backed legacy workflow state, SQLite mission/task/run state, schedule history, and a workflow DAG state service that is durable but not wired into ordinary workflow-template execution.

## Inputs
- Existing decisions: ADR-0009, ADR-0010, ADR-0012, ADR-0014
- Existing architecture artifacts: `docs/product/direction/current-direction.md`, workflow DAG epic docs, code audit H-1 and H-3
- Constraints: avoid feature expansion that deepens parallel state ownership; preserve migration paths for existing local state where needed.

## Outputs Required
- Decision updates: ADR or architecture note naming the canonical state model, migration posture, and first implementation sequence.
- Architecture artifacts: state ownership map for workflow templates, missions, tasks, schedules, runs, events, artifacts, directives, harness profiles, run templates, and legacy workflows.
- Risks and tradeoffs: compatibility, migration, restart recovery, console API shape, and schedule behavior.

## Alternatives Considered
- Keep workflow DAG runs separate from mission/task execution.
- Make mission/task runs the canonical execution state and treat DAG as visualization only.
- Make workflow DAG run state canonical and attach task/mission run records as execution details.
- Preserve file-backed workflow execution as legacy-only with explicit labeling.

## Operational Impact
The decision will set the target for follow-on implementation stories, including DAG run creation during template instantiation, run recovery, schedule run history, and console graph/status surfaces.

## Acceptance Criteria
1. A canonical state model is documented with ownership per domain.
2. Workflow-template instantiation and schedule execution have an explicit target model.
3. Legacy file-backed state is either migration-targeted or explicitly labeled as legacy.
4. Follow-on engineering stories are listed in priority order.
5. `STORY-20260528-stale-run-recovery` has clear status/recovery semantics to implement.

## Review Focus
Confirm the decision removes ambiguity rather than adding another parallel abstraction.

## Next Step
Engineering should use ADR 0015 while implementing `STORY-20260528-stale-run-recovery`, then refine the workflow-template DAG run envelope follow-up.

## Intake Promotion Checklist
- [x] Decision scope is explicit and bounded.
- [x] Problem statement explains why the decision is needed now.
- [x] Inputs are listed and available.
- [x] Outputs are concrete and reviewable.
- [x] Alternatives and operational impact are explicit.
- [x] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`: Accepted ADR 0015, which names SQLite app state as canonical orchestration state; workflow DAG runs as the canonical workflow-template execution envelope; task/mission runs as canonical direct execution attempts and workflow execution details; and file-backed workflow state as legacy or support state unless explicitly filesystem-owned payload state.
- `alternatives_considered`: Kept DAG runs separate from task/mission execution; made mission/task runs canonical with DAG visualization only; made workflow DAG runs canonical and attached mission/task run details; preserved file-backed workflow execution as another first-class path. The accepted path is the workflow DAG run envelope with attached task/mission execution details.
- `operational_impact`: Workflow-template instantiation should create a workflow DAG run and expose its id; workflow-template schedules should record `workflowDagRunId`; stale task/mission recovery should fail startup-stale runs with `STALE_RUNNING_RUN` metadata and visible events; legacy file-backed orchestration paths should be labeled compatibility or migration-targeted.
- `follow_on_work`: `flywheel/backlog/engineering/active/STORY-20260528-stale-run-recovery.md` now consumes ADR 0015 recovery semantics. `flywheel/backlog/engineering/intake/STORY-20260528-workflow-template-dag-run-envelope.md` was added for DAG run creation during workflow-template instantiation and scheduled workflow-template execution.

## Architecture Review
- `verdict`: Pass.
- `evidence_quality`: ADR 0015 documents the canonical state model, state ownership map, workflow-template and schedule target model, migration posture, alternatives, operational risks, and first implementation sequence.
- `defects`: None found.
- `state_transition`: Ready for architecture done.

## Transition History
- `2026-05-28T16:23:43Z`: `intake` -> `active` by `Codex`; PM refined and queued first for architecture
- `2026-05-28T16:50:55Z`: `active` -> `qa` by `Codex`; Architecture handoff complete for ADR 0015
- `2026-05-28T16:51:20Z`: `qa` -> `done` by `Codex`; Architecture review passed

---
kind: architecture_story
id: ARCH-20260528-canonical-orchestration-state-model
status: intake
owner_role: Software Architect
source: planning
decision_owner: Software Architect
success_metric: Workflow templates, missions, tasks, schedules, runs, and workflow DAG status have one documented canonical state ownership model.
ready: false
---

# Architecture Story: Canonical Orchestration State Model

## Metadata
- `id`: ARCH-20260528-canonical-orchestration-state-model
- `owner_role`: Software Architect
- `status`: intake
- `source`: planning
- `decision_refs`: [ADR-0009, ADR-0010, ADR-0012, ADR-0014]
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
- Decision updates: ADR or architecture note naming the canonical state model and migration posture.
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

## Review Focus
Confirm the decision removes ambiguity rather than adding another parallel abstraction.

## Next Step
Architect should refine this before workflow DAG or state migration implementation continues.

## Intake Promotion Checklist
- [ ] Decision scope is explicit and bounded.
- [ ] Problem statement explains why the decision is needed now.
- [ ] Inputs are listed and available.
- [ ] Outputs are concrete and reviewable.
- [ ] Alternatives and operational impact are explicit.
- [ ] Follow-on implementation work is split out when needed.

## Architecture Handoff
- `decision_summary`:
- `alternatives_considered`:
- `operational_impact`:
- `follow_on_work`:

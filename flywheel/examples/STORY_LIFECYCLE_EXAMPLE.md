# Story Lifecycle Example

This is documentation-only. Do not place this file in a live backlog lane.

## 1. Intake Story

```markdown
---
kind: story
id: STORY-20260524-example
status: intake
owner_role: Software Architect.md
source: planning
success_metric: one clear behavior is validated
release_scope: n/a
ready: false
---

# Story: Example local workflow slice

## Metadata
- `id`: STORY-20260524-example
- `owner_role`: Software Architect.md
- `status`: intake
- `source`: planning
- `decision_refs`: []
- `success_metric`: one clear behavior is validated
- `release_scope`: n/a

## Problem Statement
- Demonstrate the expected shape of a Flywheel story.

## Scope
- In: one small implementation change
- Out: unrelated refactors

## Assumptions
- The story is intentionally tiny.

## Acceptance Criteria
1. The behavior is implemented.
2. Validation evidence is recorded.
3. QA can make an explicit verdict.

## Validation
- Required checks: targeted test or documented manual check
- Additional checks: none

## Dependencies
- none

## Risks
- none known

## Open Questions
- none

## Next Step
- promote to active when ready

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
```

## 2. Move Through State

```bash
./flywheel/tools/flywheel_state.sh move STORY-20260524-example intake active --reason "selected for implementation"
./flywheel/tools/flywheel_state.sh move STORY-20260524-example active qa --reason "engineering handoff ready"
./flywheel/tools/flywheel_state.sh move STORY-20260524-example qa done --reason "QA passed"
```

Before moving to `qa`, fill `## Engineering Handoff`. Before moving to `done`, fill `## QA Verdict`.

## 3. Close The Cycle

```bash
./flywheel/tools/validate_workflow_state.sh
./flywheel/tools/run_observer_cycle.sh --cycle-id STORY-20260524-example --story flywheel/backlog/engineering/done/STORY-20260524-example.md
```

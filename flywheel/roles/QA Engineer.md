# Persona Template

## Role
QA Engineer

## Mission
Determine whether work satisfies its acceptance criteria and quality gates before it moves forward.

## Scope
- In: verification, pass/fail decision, defect discovery, state transition recommendation.
- Out: reprioritization and implementation.

## Inputs Required
- story under review
- acceptance criteria
- validation evidence
- handoff artifacts

## Outputs Required
- explicit verdict
- defect list with severity
- evidence summary
- next state recommendation

## Workflow Template
1. Verify acceptance criteria coverage.
2. Review validation evidence.
3. Identify regressions and missing quality signals.
4. File defects when required.
5. Recommend `done` or return to `active`.

## Quality Checklist
- verdict is explicit
- findings are evidence-based
- defect severity is justified
- next state is unambiguous

## Handoff Template
- `Verdict`:
- `Evidence summary`:
- `Defects`:
- `Required fixes`:
- `Next state recommendation`:

## Constraints
- no silent failures
- no reprioritization in QA

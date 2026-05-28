# Stage Contracts

Machine-readable stage launch contracts live in `flywheel/stage_contracts.yaml`. This document explains the human workflow contract.

## Planning
- produce planning notes or intake artifacts
- make scope, constraints, assumptions, risks, and next-state recommendation explicit
- recommend the next stage
- do not implement changes

## Architect
- produce architecture decisions or updates
- make the decision, alternatives, tradeoffs, and operational impact explicit
- identify follow-on implementation work
- move work to architecture QA

## Engineering
- implement the selected story
- update validation evidence
- prepare handoff with explicit QA focus areas and open risks
- move work to engineering QA, preferably with `flywheel/tools/flywheel_state.sh move ...`

## QA
- produce explicit verdict with evidence quality call
- file bugs when required
- move work to `done` or back to `active`, preferably with `flywheel/tools/flywheel_state.sh move ...`
- close the cycle

## PM
- refine intake
- maintain active queue order with bounded and testable work items
- keep work bounded and testable

## Cycle
- alternate engineering and QA until the active queue is empty

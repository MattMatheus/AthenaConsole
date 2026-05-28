# Stage Exit Gates

## Planning Exit
- intake artifacts are created or updated
- scope, constraints, assumptions, and risks are explicit
- next-stage recommendation is explicit
- if optional artifact workflow is enabled, a durable handoff manifest is created when useful

## Architect Exit
- decision output is concrete and reviewable
- alternatives, tradeoffs, and operational impact are explicit
- follow-on implementation paths are explicit when needed
- story moves to architecture QA

## Engineering Exit
- acceptance criteria implementation is complete
- required validation has run
- handoff includes validation evidence, open risks, and QA focus areas
- engineering handoff fields are filled before movement to QA
- story moves to engineering QA with file location, metadata status, and transition history synchronized

## QA Exit
- verdict is explicit
- QA verdict fields are filled before movement to done
- missing evidence is treated as a blocking QA issue
- bugs are filed when needed
- story moves to `done` or back to `active` with file location, metadata status, and transition history synchronized

## Cycle Closure
- local workflow state validation passes or documented blockers explain why it cannot pass
- observer markdown report and JSON trace are written
- observer report records validation, risks, and action/approval context
- queue state is synchronized
- one cycle commit is created
- if optional artifact workflow is enabled, a cycle-closure manifest is created when useful

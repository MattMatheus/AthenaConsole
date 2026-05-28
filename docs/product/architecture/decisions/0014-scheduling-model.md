<!-- AUDIENCE: Internal/Technical -->

# ADR 0014: Scheduling Model

## Status

Accepted.

## Context

Scheduling is important for repeatable local workflows such as news aggregation, podcast processing, recurring research, report generation, and software maintenance tasks. It does not need to be the first implementation layer, but the task/mission/workflow model should make scheduling straightforward.

## Decision

Schedules trigger tasks, missions, or workflow templates.

Scheduling is near-term but follows the clean agent/task/plugin/runtime foundation.

The first scheduler is local and only runs while the app/API service is running. This is acceptable for v1. Hosted infrastructure scheduling should be revisited later so schedules do not depend on a laptop being online.

## Schedule Targets

A schedule may target:

- a task
- a mission
- a workflow template with bound inputs

For repeatable workflows, prefer scheduling a workflow template with input bindings rather than cloning ad hoc tasks manually.

Implementation order:

1. task schedules
2. workflow template schedules
3. mission schedules

## Schedule Model

Schedule fields should include:

- `id`
- `name`
- `targetType`
- `targetId`
- input bindings
- recurrence or one-shot trigger
- timezone
- enabled/paused status
- created/updated metadata
- last run
- next run
- failure policy

Use RRULE internally for recurrence. The UI may expose simple daily, weekly, monthly, or custom controls that compile to RRULE.

Every schedule must have a timezone. Default to the local timezone.

Schedule statuses:

- `active`
- `paused`
- `disabled`
- `error`

## Execution Semantics

When a schedule fires, Team Orchestrator creates a run from the target and records schedule provenance on that run.

Scheduled runs must record `scheduleId`.

Schedules should respect:

- agent compatibility
- runtime availability
- risk approvals
- loop limits
- concurrency limits

If the app/API service was not running when a schedule should have fired, v1 skips the missed run and records a missed-run event/status. Catch-up policies can be added later.

If the previous scheduled run is still running, the default overlap policy is `skip-if-running`. Future policies may include `queue`, `cancel-and-replace`, or `allow-overlap`.

If a scheduled run encounters a risky action, it waits for operator approval. No auto-approval is granted unless a future scoped approval model explicitly allows it.

## First Implementation

The first scheduling implementation can be simple:

- manual creation in console
- one-shot and recurring schedules
- local scheduler process
- schedule history
- pause/resume/delete

The schedule UI should wait until task creation and task run inspection are usable.

Hosted/distributed scheduling can wait.

## Consequences

Scheduling becomes a natural extension of tasks and workflow templates rather than a separate automation system.

The product can support useful operator workflows without becoming an enterprise job scheduler.

## Open Questions

- What is the exact missed-run event shape?
- What hosted scheduling architecture should replace the local-only scheduler later?
- Which recurrence UI presets should be included first?

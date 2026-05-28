<!-- AUDIENCE: Internal/Technical -->

# ADR 0009: Task, Mission, and Run Domain Model

## Status

Accepted.

## Context

The product needs a durable model for human-directed agent work. The user should be able to create tasks manually, assign compatible agents, run them, inspect results, and later compose them into missions or schedules.

The model must support software work as an initial use case while remaining generic enough for news aggregation, podcast processing, research, content workflows, and other programmable tasks.

## Decision

Tasks are the primary unit of work. Missions organize tasks. Runs execute tasks or missions.

A task can be useful on its own. Missions should not become mandatory for the first product loop.

## Entities

### Task

A task is a user-visible unit of work assigned to one compatible agent.

Fields should include:

- `id`
- `title`
- `description`
- `status`
- `capabilityRequirements`
- `assignedAgentId`
- `inputs`
- `createdBy`
- `createdAt`
- `updatedAt`
- optional `missionId`
- optional `sourceRunId` for agent-created follow-ups

Task statuses:

- `draft`
- `proposed`
- `ready`
- `running`
- `blocked`
- `completed`
- `failed`
- `cancelled`
- `archived`

A task may be unassigned while it is `draft` or `proposed`. A task must have an `assignedAgentId` before it can become `ready`.

Tasks store both `capabilityRequirements` and `assignedAgentId`. Capability requirements support agent suggestions and compatibility checks. The assigned agent records the operator's actual choice.

One task has one assigned agent in the first version. Multi-agent work should be represented as a mission with multiple tasks.

Task inputs are stored as JSON and validated against the assigned agent manifest.

### Mission

A mission is a collection of related tasks with shared goal and context.

Fields should include:

- `id`
- `title`
- `goal`
- `context`
- `status`
- ordered task references
- optional dependency edges
- created/updated metadata

### Run

A run is one execution attempt of a task or mission.

Fields should include:

- `id`
- `targetType`: `task` or `mission`
- `targetId`
- `status`
- `backend`
- `agentId` for task runs
- start/end timestamps
- event stream reference
- artifact references
- output summary
- failure/cancellation details
- safety stop details

Run statuses:

- `queued`
- `validating`
- `running`
- `waiting-for-approval`
- `completed`
- `failed`
- `cancelled`
- `stopped-by-limit`

Manual task runs remain first-class. A mission run may create child task runs for mission tasks, but the first console experience should still let users run individual tasks explicitly.

## Follow-Up Tasks

Agents may propose follow-up tasks. These tasks start as `proposed` and must capture:

- source run
- source agent
- reason
- suggested inputs
- suggested capability or agent

They should not automatically run unless a future policy explicitly allows that behavior.

## Sequential-First, DAG-Capable

The first product experience should be sequential and human-directed. The data model should still support task dependencies so future mission runs can execute DAG-style workflows.

Dependencies use simple `dependsOn: string[]` references in the first version.

## Retention

Completed tasks and runs are retained locally until the operator archives or deletes them. Automated retention policies can be added later.

## Consequences

The console can center on Tasks and Missions rather than sessions, personas, or fleet dashboards.

Existing run/session concepts can be mapped forward where useful but should not dominate the product vocabulary.

## Open Questions

- What task fields are required for the first console create-task form?
- Should a task retain a snapshot of the assigned agent manifest at run time?
- What delete behavior should apply when a mission contains archived or deleted tasks?

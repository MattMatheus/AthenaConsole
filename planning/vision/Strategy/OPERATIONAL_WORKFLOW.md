<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Operational Workflow

## Manual Task Flow

1. Operator creates a task in the console.
2. Operator selects a compatible agent.
3. Console validates task inputs against the agent manifest.
4. Operator chooses or accepts the runtime backend.
5. Team Orchestrator starts a run.
6. Run emits structured events, logs, artifacts, and outputs.
7. Operator reviews the result and decides whether to accept, retry, cancel, or create follow-up tasks.

## Mission Flow

A mission is a collection of related tasks with shared goal and context.

The first mission experience should be ordered and human-directed:

1. Create mission.
2. Add tasks.
3. Assign agents.
4. Run tasks one at a time or as an ordered sequence.
5. Inspect each task run.
6. Promote agent-created follow-ups into proposed tasks.

The data model should allow dependencies so later versions can run DAG-style missions without redefining tasks and runs.

## Follow-Up Tasks

Agents may create follow-up tasks. Follow-ups should include:

- source run
- source agent
- reason
- suggested task title
- suggested inputs
- recommended compatible agent or capability

Follow-ups should enter as proposed or pending work. They should not silently trigger unbounded autonomous loops.

## Runtime Backends

Execution is pluggable:

- local process by default
- container command as first-class backend
- HTTP/API agent backend
- JS/TS module
- Python module
- LangGraph wrapper
- native Team Orchestrator DAG

Hosted/cloud execution can be added later through the same backend model.

## Safety Controls

Approvals are required for risky actions.

Runs must enforce loop and tool-call limits so stuck agents stop with inspectable evidence instead of burning tokens indefinitely.

<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Product Reset Notes

## Agreed Direction

Team Orchestrator is an agent orchestrator.

The product should be web-first and local-first. It starts with a solo developer, expands to a product operator, and may later support shared/team instances.

The main shift is away from prose-based personas and toward formal agents similar in spirit to LangGraph-style or framework-backed units: manifest-defined, structured, executable, inspectable, and testable.

## Product Model

- Plugins contain agents, workflow templates, docs, tests, schemas, fixtures, and optional UI metadata.
- Agents are formal executable units with manifests and a consistent lifecycle.
- Tasks are the primary unit of work and are normally assigned to compatible agents.
- Missions collect tasks under a shared goal/context.
- Runs execute tasks or missions.
- Artifacts and events make runs inspectable.
- Schedules trigger tasks, missions, or workflow templates later or recurringly.

## User Experience

Manual task creation comes first.

Natural-language task planning and proposal-based systems can come later, but should not be required for the first useful product loop.

The console should make it obvious what is running, which agent is responsible, which backend is used, what happened internally when hooks are available, what artifacts were produced, and why a run stopped.

## Runtime Direction

Execution is pluggable:

- local process default
- containers first-class
- HTTP/API agents
- JS/TS modules
- Python modules
- LangGraph wrappers
- native Team Orchestrator DAG

CrewAI is excluded from the initial target set.

## State Direction

Move toward database-backed runtime app state, likely SQLite first.

Plugin manifests remain filesystem-backed and are indexed into app state.

## Orchestration Direction

Sequential-first for v1.

Keep the data model DAG-capable so graph execution can be introduced later for repeatable workflows such as news aggregation, podcast processing, research, media processing, and software delivery.

Agents may create follow-up tasks. Follow-ups should carry provenance and enter as proposed/pending work, not silent autonomous execution.

## Safety Direction

Approvals are for risky actions.

Loop and tool-call limits are core product safety controls.

Scheduling is important and near-term, but follows the clean agent/task/plugin foundation.

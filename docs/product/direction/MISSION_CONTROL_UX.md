<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Console UX Direction

## Primary Surface

The web console is the product's primary surface. CLI and API paths remain useful, but the console should define the main user experience.

The first console experience should make it easy to:

- create a manual task
- select a compatible agent
- configure runtime inputs
- run locally
- inspect status, logs, events, artifacts, and outputs
- accept, retry, cancel, or create follow-up tasks

## Core Views

### Tasks

The default workbench for the solo operator. It should show task status, assigned agent, inputs, outputs, run history, follow-up suggestions, and artifacts.

### Missions

A mission groups related tasks around a shared goal. The first version can be sequential-first while preserving dependency fields for later DAG execution.

### Agents

The local catalog of base agents and installed plugin agents. Agent detail pages should show manifest metadata, capabilities, required inputs, supported runtimes, permissions, and test/demo actions.

### Plugins

Installed local plugin bundles. A plugin may provide agents, workflow templates, schemas, fixtures, docs, and optional UI metadata.

### Runs

Inspectable execution history. A run should expose timeline events, logs, tool calls where available, artifacts, outputs, cancellation status, loop-limit stops, and error details.

### Schedules

Near-term surface for recurring or delayed execution of tasks, missions, or workflow templates.

## UX Principles

- Manual-first: the operator chooses tasks and agents before proposal-based automation becomes primary.
- Inspectable: black-box agents still expose outer status, logs, artifacts, and outputs; inspectable agents expose internal steps/tool calls when hooks exist.
- Local-first: the default runtime should feel immediate and understandable on the user's machine.
- Safety-visible: approvals, permissions, runtime boundaries, loop limits, and cancellation should be visible from the run surface.
- Dense but calm: prioritize operational clarity over marketing composition.

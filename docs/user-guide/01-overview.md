<!-- AUDIENCE: Operator -->

# Overview

Team Orchestrator is a work control plane for teams and operators. Deploy it as a local workbench for one operator, or as a trusted server for a team with workspace membership, RBAC, cost governance, and audit-ready run history.

Team Orchestrator gives you a web console and API for:

- choosing outcome-oriented capabilities from Start Work,
- connecting repositories, providers, and other resources,
- reviewing preflight before execution,
- running work through local, container, or API backends,
- inspecting run status, events, outputs, and artifacts,
- browsing the backing agents, tasks, missions, workflow templates, and run templates when needed,
- keeping risky actions bounded by permissions, approvals, and limits,
- preparing workspaces, RBAC, usage, cost, and persistence boundaries for enterprise operation.

---

## Operator Surfaces

The primary console surfaces are organized around the path a user takes:

- **Start Work**: choose what you want done, such as running the demo, summarizing a repo, reviewing code, checking release readiness, or explaining a test failure.
- **Work History**: inspect runs, outputs, artifacts, and status after work starts.
- **Capabilities**: browse plugin-backed agents and templates that power Start Work.
- **Resources**: connect or inspect repository context and other inputs work can use.
- **Review**: inspect memory-oriented state and other proposal surfaces as they mature.

Lower-level surfaces remain available under **Advanced Work**:

- **Tasks** for one agent and one unit of work.
- **Workflow Templates** for repeatable multi-step recipes.
- **Missions** for grouped work.
- **Schedules** for repeated work.
- **Run Templates** for advanced presets.

Admin and diagnostic surfaces are under **Admin**.

---

## Start With An Outcome

Use **Start Work** when you want Team Orchestrator to do something useful without first deciding whether the underlying primitive is a task, workflow, mission, or run template.

When you choose a capability, the console shows:

- the selected outcome,
- the backing agent or workflow,
- repository context,
- provider readiness,
- safety mode,
- required inputs.

This preflight is the point where you confirm what will run before saving, instantiating, or executing work.

---

## Product Model Reference

You do not need these nouns before your first run, but they explain what Start Work is using underneath.

### Plugins

A plugin is a folder on disk that packages product resources. A plugin can contain agents, workflow templates, schemas, docs, fixtures, and tests.

The plugin manifest is `plugin.yaml`. It gives the plugin an id, version, display name, compatibility information, permissions, and pointers to the agents or workflows inside it.

Plugins are discovered from configured local paths. In the default local setup, checked-in sample plugins and bundled packs are available immediately. Generated agents usually land under `.athena/plugins/`, which is already in the default local plugin search path.

### Agents

An agent is a formal executable unit. Its manifest declares:

- id, name, version, and description,
- capabilities,
- inputs and outputs,
- runtime implementation,
- permissions,
- execution limits,
- provider requirements when a model is needed.

The console presents agents as capabilities for operators, but agents are authored as plugin files. That is intentional: the console is for operating and inspecting work, while plugin files remain the source of truth for agent behavior.

### Tasks

A task is one unit of work assigned to one compatible agent. A task has structured inputs that should match the agent manifest. When you run a task, Team Orchestrator creates a task run.

Start Work can create task-backed work for you. Use the direct Tasks surface when you already know the specific agent and objective you want to run.

### Missions

A mission groups related tasks under a shared goal. Missions are useful when one piece of work has multiple steps or multiple agents.

Workflow templates usually create missions for you. The direct Missions surface is mainly for inspection and advanced operation.

### Workflow Templates

A workflow template is a reusable plan supplied by a plugin. It can instantiate a mission and a workflow DAG run. The workflow run tracks dependency-aware steps, progress, status, and linked task runs.

Start Work can choose workflow-backed capabilities for you. Use the direct Workflow Templates surface when you want to browse or instantiate a known recipe.

### Runs

A run is execution history. Runs tell you whether work is ready, running, completed, failed, cancelled, or stopped by a limit.

Runs are the heart of inspectability. A useful run should tell you:

- which agent ran,
- which backend was used,
- what inputs were provided,
- what events happened,
- what output was returned,
- what artifacts were produced,
- why the run stopped.

### Events

Events are structured records emitted during work. They make execution reviewable even when an agent is a black box internally.

Events help answer questions like:

- Did the task start?
- Which policy or backend was resolved?
- Did a provider requirement block the run?
- Did a workflow step complete or fail?
- Did a safety limit stop execution?

### Artifacts

Artifacts are outputs worth inspecting. Examples include markdown reports, model responses, run evidence, transcripts, and proposed changes.

SQLite stores artifact metadata. Large or human-readable payloads remain file-backed or externally referenced so they stay inspectable outside the database.

### Providers

A provider is a configured model or API backend, such as an OpenAI-compatible endpoint or Azure AI Foundry deployment.

The first-run demo does not need provider credentials. Model-backed sample agents do. The console Settings surface helps you create provider records, and readiness checks explain missing or invalid provider setup.

### Repositories

Repository context tells agents what source tree or workspace they should operate on. Local work can use managed clones, existing local paths, or configured container paths depending on how you run the stack.

Team Orchestrator separates repository records and run inputs from plugin files. A plugin defines what an agent can do; repo context tells the run where to do it.

### Safety Controls

Safety controls keep automation bounded. Current controls include:

- permissions declared in manifests,
- runtime policy packs,
- max runtime and retry limits,
- max tool-call and repeated-action limits,
- approval records for risky actions,
- read-only and proposed-change modes for repo-affecting work,
- RBAC and workspace-scope foundations,
- usage and cost ledger foundations.

The product favors explicit operator control over silent autonomous loops.

---

## Next Steps

- [Install and Deploy](02-install-and-deploy.md) — get the server running
- [Running Work](05-running-work.md) — first-run demo and smoke, then real work
- [SDK and Integration Guide](../sdk/README.md) — agent authoring and API reference

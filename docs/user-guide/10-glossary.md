<!-- AUDIENCE: Operator -->

# Glossary

Canonical definitions for Team Orchestrator product vocabulary. Use these terms consistently in documentation, issue reports, and operator communication.

---

**Agent**: A manifest-backed executable unit supplied by a plugin. An agent declares its id, version, capabilities, inputs, outputs, runtime implementation, permissions, and execution limits. Agents are not just prompts — they are versioned contracts between operators and executable code.

**Agent Developer Kit (PDK)**: The `@athena/pdk` package that helps agent runners parse run envelopes, validate inputs, and serialize outputs. See the [SDK and Integration Guide](../sdk/README.md) for the current helper API.

**Approval**: An explicit operator decision required before a risky action proceeds. Approval records are part of the safety control layer.

**Artifact**: An inspectable output or evidence record from a run. Examples include markdown reports, model responses, run evidence, transcripts, and proposed changes. Artifact metadata is stored in SQLite; large payloads may be file-backed or externally referenced.

**Backend**: The execution mechanism for an agent, such as local-process, container-command, Docker, Kubernetes pod, or HTTP/API. The `preferredBackend` field in the agent manifest declares which backend the agent expects.

**Budget**: See **Cost Governance**.

**Capability**: The set of operations or outcomes an agent or capability pack provides. In Start Work, capabilities are presented as choosable outcomes. Under the hood, a capability is backed by an agent or workflow template from a plugin.

**Capability Pack**: A plugin that packages a cohesive set of agents, workflow templates, and related resources for a specific domain (for example, a software team agent pack or a connector pack for an external service).

**Connector Pack**: A capability pack that integrates Team Orchestrator with an external service such as GitHub, Jira, or Linear.

**Cost Governance**: The system for tracking and (eventually) limiting provider usage costs. Today, usage is recorded in the usage ledger and `costBudgetDailyUsd` is stored in policy but not enforced. See [Cost Governance](07-cost-governance.md).

**Directive**: A reusable prompt/input payload that can be combined with a harness profile to create a run. Part of the decoupled execution model in advanced usage.

**Event**: A structured record of something that happened during execution. Events make agent runs reviewable even when the agent is internally opaque. Common event types include task start, policy resolution, workflow step completion, safety limit hit, and provider resolution.

**Evidence**: A structured output record produced by a run as part of a verification policy. Evidence records prove that a run produced a required kind of output before the run is marked passing.

**Failed Work**: A recoverable failure record created when a task or workflow fails in a way that the operator should inspect. Failed work items can be retried or discarded with an audit note.

**Harness Profile**: A reusable execution configuration that specifies provider, model, tools, runtime policies, and optional verification policies. Combined with a directive to create a run.

**Health**: The API liveness signal. `GET /api/v1/health` returns `ok: true` when the process is running. Use for container liveness probes.

**Identity**: The authenticated user or service identity making a request. Role assignment is associated with the identity.

**Mission**: A group of related tasks under a shared goal. Missions are useful when work has multiple steps or multiple agents. Workflow templates usually create missions automatically.

**Operator**: (1) A person who runs work through Team Orchestrator — the primary audience for this manual. (2) A role in the RBAC system; see [Roles and RBAC](04-roles-and-rbac.md).

**Plugin**: A local package on disk that provides product resources. A plugin can contain agents, workflow templates, schemas, docs, fixtures, and tests. The plugin manifest is `plugin.yaml`.

**Policy**: The runtime configuration that governs how work executes. Includes concurrency limits, retry policies, timeout policies, and cost budgets. Policy is managed by Admins via `PUT /api/v1/policy`.

**Provider**: A configured model or API backend (for example, an OpenAI-compatible endpoint or Azure AI Foundry deployment). Providers are registered in Settings and referenced by agents that require model calls.

**Readiness**: API diagnostics that explain whether required local systems are usable. `GET /api/v1/readiness` returns per-check status and `nextStep` guidance. May be `ready` or `degraded`.

**Repository**: A source code tree or workspace that agents operate on. Repository records store path and metadata; task or workflow inputs specify which repo to use at runtime.

**RBAC**: Role-based access control. Three roles are defined: Viewer, Operator, Admin. See [Roles and RBAC](04-roles-and-rbac.md).

**Run**: A specific execution attempt for a task, mission, or workflow. Runs record which agent ran, which backend was used, what inputs were provided, what events happened, what output was returned, what artifacts were produced, and why the run stopped.

**Run Template**: An advanced preset that bundles a directive, harness profile, and other run configuration into a reusable template.

**Safety Controls**: The set of mechanisms that keep agent automation bounded: manifest permissions, runtime policy packs, concurrency limits, max runtime and retry limits, approval records, and read-only or proposed-change modes.

**Schedule**: A recurring work definition driven by a cron expression. Schedules run a specified agent or workflow at the configured cadence.

**Scope**: The set of workspaces a request is authorized to access. As of this build, scope is client-asserted via the `x-athena-scope-workspaces` header. See [Workspaces and Multiplayer](03-workspaces-and-multiplayer.md) for the preview status of server-derived scope.

**Session**: A unit of conversational or directed work context. Sessions group related runs and their transcripts.

**Task**: A unit of work assigned to one compatible agent. A task has structured inputs that must match the agent manifest. Running a task creates a task run.

**Task Run**: The execution record for a specific task execution. Includes status, events, output, artifacts, and the resolved backend.

**Team Orchestrator**: The product name. `Athena`, `AthenaConsole`, and `@athena/*` are implementation names acceptable in code references, CLI commands, environment variable names, and package names — not the lead abstraction in prose.

**Usage Ledger**: The record of provider usage across runs. Stores provider, model, token counts, and estimated cost. Currently for visibility only — enforcement is in preview.

**Verification Policy**: A policy in a harness profile that requires a run to produce specific evidence before it is marked as passing. Current kind: `require-evidence`.

**Viewer**: A read-only role in the RBAC system. Viewers can inspect sessions, runs, artifacts, and events but cannot create or cancel work. See [Roles and RBAC](04-roles-and-rbac.md).

**Workspace**: A named container for team resources: agents, runs, providers, and usage records. Workspace CRUD and Admin RBAC are built; per-workspace isolation is in preview. See [Workspaces and Multiplayer](03-workspaces-and-multiplayer.md).

**Workflow Run**: The execution record for a workflow DAG run. Tracks step readiness, progress, dependency status, and linked task run ids.

**Workflow Template**: A reusable plugin-provided plan that can instantiate a mission and workflow run. Workflow templates define the DAG of steps, dependencies, and agent assignments.

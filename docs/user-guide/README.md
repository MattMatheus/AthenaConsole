<!-- AUDIENCE: Public/Internal -->

# Team Orchestrator User Guide

Team Orchestrator is a local-first console for running agent work from clear outcomes and then inspecting what happened. Use it when you want more durability and reviewability than a chat transcript: you choose a capability, review preflight, run the work, and inspect history, events, outputs, and artifacts later.

This guide is written for motivated users who want to learn the system without reading source code. It starts with the operator path, then explains the product model underneath it.

## Who This Is For

Use this guide if you are:

- a local operator who wants to run agent work against a repository,
- an agent author who wants to create a plugin-backed agent,
- a local-server admin who wants a durable trusted-LAN instance,
- a reviewer who wants to understand what the product can do today.

If you only want the shortest startup path, use [Getting Started](../../GETTING_STARTED.md). Come back here when you want to understand what each step means.

## What Team Orchestrator Does

Team Orchestrator gives you a web console and local API for:

- choosing outcome-oriented capabilities from Start Work,
- connecting repositories, providers, and other resources,
- reviewing preflight before execution,
- running work through local, container, or API backends,
- inspecting run status, events, outputs, and artifacts,
- browsing the backing agents, tasks, missions, workflow templates, and run templates when needed,
- keeping risky actions bounded by permissions, approvals, and limits.

The product is local-first. The default path runs on your machine or a trusted local server. Hosted, multi-tenant cloud operation is outside the current core scope.

## Operator Surfaces

The primary console surfaces are organized around the path a user takes:

- **Start Work**: choose what you want done, such as running the demo, summarizing a repo, reviewing code, checking release readiness, or explaining a test failure.
- **Work History**: inspect runs, outputs, artifacts, and status after work starts.
- **Capabilities**: browse plugin-backed agents and templates that power Start Work.
- **Resources**: connect or inspect repository context and other inputs work can use.
- **Review**: inspect memory/review-oriented state and other proposal surfaces as they mature.

Lower-level surfaces remain available under **Advanced Work**:

- **Tasks** for one agent and one unit of work.
- **Workflow Templates** for repeatable multi-step recipes.
- **Missions** for grouped work.
- **Schedules** for repeated work.
- **Run Templates** for advanced presets.

Admin and diagnostic surfaces remain under **Admin**.

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

## Product Model Reference

You do not need these nouns before your first run, but they explain what Start Work is using underneath.

### Plugins

A plugin is a folder on disk that packages product resources. A plugin can contain agents, workflow templates, schemas, docs, fixtures, and tests.

The plugin manifest is `plugin.yaml`. It gives the plugin an id, version, display name, compatibility information, permissions, and pointers to the agents or workflows inside it.

Plugins are discovered from configured local paths. In the default local setup, checked-in sample plugins and bundled packs are available immediately. Generated agents usually land under `.athena/plugins/`, which is already in the default local plugin search path.

### Agents

An agent is a formal executable unit. It is not just a prompt. Its manifest declares:

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

Safety controls keep local automation bounded. Current controls include:

- permissions declared in manifests,
- runtime policy packs,
- max runtime and retry limits,
- max tool-call and repeated-action limits,
- approval records for risky actions,
- read-only and proposed-change modes for repo-affecting work.

The product favors explicit operator control over silent autonomous loops.

## Start Locally

Install prerequisites:

- Node.js 20+
- Podman or Docker with Compose support
- Git

Clone, install, and start the local stack:

```bash
git clone <your-repo-url>
cd AthenaConsole
npm install
podman compose -f docker-compose.local.yml up --build
```

Docker Compose works too:

```bash
docker compose -f docker-compose.local.yml up --build
```

Default local URLs:

- API: `http://127.0.0.1:8787`
- Console: `http://127.0.0.1:5173`

Check the API:

```bash
curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:8787/api/v1/readiness
```

Healthy output includes `ok: true`. Readiness can be `ready` or `degraded`. A degraded status is not always fatal; read each check's `nextStep`. Optional provider checks may be degraded until you configure credentials.

## Run The First-Run Demo

The first-run demo proves the system without external model credentials. It uses `sample-plugins/first-run-demo` and the default mock provider.

In the console:

1. Open **Start Work**.
2. Choose **Run the first-run demo**.
3. Review preflight.
4. Instantiate and run the workflow.
5. Open the workflow run or Work History to inspect status, outputs, and artifacts.

The demo teaches the implementation loop too:

1. Find a workflow template from a plugin.
2. Instantiate it into a mission and workflow run.
3. Execute the workflow run.
4. Inspect workflow status.
5. Follow task-run ids to artifact metadata.

Confirm the template exists:

```bash
curl "http://127.0.0.1:8787/api/v1/workflow-templates?pluginId=team-orchestrator.samples.first-run"
```

Expected data includes:

```json
{
  "id": "first-run.demo.workflow",
  "available": true,
  "taskCount": 2
}
```

Instantiate the workflow:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/workflow-templates/first-run.demo.workflow/instantiate \
  -H "content-type: application/json" \
  -d '{"missionId":"mission-first-run-demo","taskIdPrefix":"first-run-demo","inputs":{"demoName":"First-Run Demo"}}'
```

Expected data includes a workflow DAG run id:

```json
{
  "workflowDagRun": {
    "id": "workflow-run-mission-first-run-demo"
  }
}
```

Execute it:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/execute
```

Expected data:

```json
{
  "runId": "workflow-run-mission-first-run-demo",
  "status": "completed",
  "executedStepIds": ["prepare", "verify"]
}
```

Inspect status:

```bash
curl http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/status
```

Look for:

- `run.status` equal to `completed`,
- `progress.percentComplete` equal to `100`,
- two completed nodes: `prepare` and `verify`,
- `output.taskRunId` values on completed steps.

Inspect a linked task run:

```bash
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>
```

The sample artifact uses a `memory://first-run-demo/...` storage URI. It proves artifact metadata and run inspection without writing secrets or requiring model calls.

## Use The Console

Open:

```text
http://127.0.0.1:5173
```

Useful pages:

- `/` shows readiness-oriented onboarding and next actions.
- `/agents` shows loaded agents, plugin provenance, readiness, and agent detail links.
- `/tasks` creates and runs one-agent tasks.
- `/missions` groups task work under a shared goal.
- `/workflows` instantiates plugin-provided workflow templates.
- `/workflows/runs/<run-id>` inspects workflow graph status.
- `/runs` and task detail surfaces expose run history, events, outputs, and artifacts.
- `/resources` helps explain repository wiring.
- `/settings` configures providers and related local settings.

When something does not appear, check readiness first, then check plugin validation diagnostics in the Capabilities page.

## Run The Product Smoke

After the API is running, use the product smoke when you want one pass/fail check:

```bash
npm run smoke:product
```

The smoke checks:

- API health and readiness,
- first-run demo agent catalog visibility,
- first-run workflow template availability,
- workflow instantiation and execution,
- workflow status,
- linked task-run artifact metadata.

If your API runs on a different port:

```bash
npm run smoke:product -- --api-base-url http://127.0.0.1:<port>
```

Use this before handing the product to a reviewer. It catches common setup breaks faster than clicking through the console manually.

## Move From Demo To Real Repo Work

The first-run demo proves the control plane. Real work adds repository context and often a model provider.

The normal path is:

1. Choose the local repository you want agents to inspect or operate on.
2. Make the repo visible to Team Orchestrator.
3. Load a plugin that provides a useful agent or workflow.
4. Confirm the agent appears in `/agents`.
5. Create a task or instantiate a workflow.
6. Inspect outputs and artifacts.

For Docker/Podman local compose, expose a target repo with environment variables:

```env
ATHENA_REPO_HOST_PATH=/absolute/path/to/your/repo
ATHENA_REPO_CONTAINER_PATH=/workspace/target-repo
```

Then use `/workspace/target-repo` in task or workflow inputs. This keeps host paths and container paths explicit.

For direct local development, start the API from the repository root:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

Then open the console and use:

- `/resources` to review repo wiring guidance,
- `/agents` to confirm useful agents are loaded,
- `/tasks` to create one-agent work,
- `/workflows` to use a plugin-provided repeatable workflow.

## Configure A Model Provider

The demo does not need credentials. Model-backed agents do.

You can configure providers in the console Settings page, or use environment-backed secrets. For OpenAI-compatible providers:

```env
ATHENA_DEFAULT_PROVIDER=openai
ATHENA_OPENAI_API_KEY=your_api_key_here
```

For Azure AI Foundry:

```env
ATHENA_DEFAULT_PROVIDER=foundry
ATHENA_FOUNDRY_ENABLED=true
ATHENA_FOUNDRY_PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com
ATHENA_FOUNDRY_DEPLOYMENT=<your-deployment-name>
ATHENA_FOUNDRY_API_VERSION=2024-05-01-preview
ATHENA_FOUNDRY_USE_ENTRA_ID=true
```

Run `az login` before starting the API when using Foundry with Entra ID locally.

Provider readiness appears in health/readiness responses and in agent/workflow create paths. If a model-backed agent is blocked, the product should tell you what provider is missing or invalid before you start a run.

## Create A Plugin-Backed Agent

Use the scaffold command when you want a known-good local agent package:

```bash
npm --workspace @athena/core run build
npm --workspace @athena/core run athena -- agent scaffold --name "Research Planner"
```

By default, the scaffold writes under `.athena/plugins/`. The generated plugin includes:

- `plugin.yaml`,
- `agents/scaffold.agent.yaml`,
- `agents/scaffold-runner.mjs`,
- `docs/README.md`.

Use explicit ids or placement when needed:

```bash
npm --workspace @athena/core run athena -- agent scaffold \
  --name "Research Planner" \
  --plugins-dir plugins \
  --plugin-id local.research-planner \
  --agent-id local.research-planner.agent
```

Validate manifests:

```bash
npm --workspace @athena/core run validate:manifests
```

Restart the API after adding or changing plugin files:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

Then open `/agents` and confirm the new agent appears.

For a deeper file-by-file tutorial, use [Build Your First Agent](../../packages/core/docs/user/07-pdk-guide.md). For a model-backed copy path, use [Copy The Model Provider Smoke Agent](../../packages/core/docs/user/10-copy-sample-agent.md).

## Understand Agent Manifests

An agent manifest is the contract between an operator task and executable agent code. A minimal local-command agent declares:

```yaml
schemaVersion: 1
agent:
  id: local.research.plan
  name: Research Planner
  version: 0.1.0
  description: Produces a small research plan artifact from a topic.
  inputs:
    topic:
      type: string
      required: true
      label: Topic
  outputs:
    mode: flexible
    artifacts:
      - key: plan
        label: Research Plan
        kind: primary
        format: markdown
  implementation:
    type: local-command
    command: node
    args:
      - agents/research-runner.mjs
  runtime:
    preferredBackend: local-process
```

Important parts:

- `id` and `version` must match the plugin manifest entry.
- `inputs` drive validation and console forms.
- `outputs.artifacts` tells operators what kind of result to expect.
- `implementation` tells the runtime how to execute the agent.
- `runtime` and permissions keep execution bounded.

The runner reads a task/run envelope from stdin and writes serialized output to stdout. The Agent Developer Kit helps with parsing and output formatting:

```js
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";
```

Use [Agent Developer Kit Package](../../packages/pdk/README.md) for the current helper API.

## Inspect Results

After a task or workflow runs, inspect at three levels:

1. Workflow status, if the work came from a workflow template.
2. Task run detail for each linked task run.
3. Artifact metadata and previews for produced outputs.

Workflow status:

```bash
curl http://127.0.0.1:8787/api/v1/workflow-runs/<workflow-run-id>/status
```

Task run detail:

```bash
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>
```

Artifact payload, when available through the API:

```bash
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>/artifacts/<artifact-id>
```

In the console, prefer clicking from the run/workflow surface. The console preserves context better than raw API calls.

## Troubleshooting

### API Will Not Start

Check:

- Node.js is version 20 or newer.
- Dependencies were installed with `npm install`.
- Another process is not already using the API port.
- `ATHENA_WORKSPACE_ROOT` points at the repo root when running the API directly.

Useful command:

```bash
npm --workspace @athena/api run dev
```

### Console Cannot Reach API

Check:

- API is running at `http://127.0.0.1:8787`.
- Compose started both API and console containers.
- The console dev server proxies `/api/*` to the API container in the local stack.

Run:

```bash
curl http://127.0.0.1:8787/api/v1/health
```

### Readiness Is Degraded

Open:

```bash
curl http://127.0.0.1:8787/api/v1/readiness
```

Read each check's `nextStep`. Common causes:

- no plugin path is configured,
- sample demo plugin is missing,
- app-state path is not writable,
- a model provider required by an agent is not configured,
- an optional provider check is unavailable.

### Agent Does Not Appear

Check:

- `plugin.yaml` points at the agent manifest path.
- `plugin.agents[].id` matches `agent.id`.
- Plugin id/version is unique.
- Agent id/version is unique.
- The API was restarted after changing files.
- `ATHENA_PLUGIN_PATHS` includes the plugin parent directory.

Validate manifests:

```bash
npm --workspace @athena/core run validate:manifests
```

### Provider-Backed Agent Is Blocked

Check:

- provider exists in Settings,
- provider kind matches the agent requirement,
- secret name is correct,
- environment variable is available to the API process,
- Azure Foundry users ran `az login` when using Entra ID.

Readiness and create-work surfaces should explain missing provider requirements before execution.

### Workflow Template Is Missing

Check:

- plugin package loaded successfully,
- workflow template file exists in the plugin,
- plugin validation has no blocking errors,
- requested `pluginId` and workflow id are correct.

Use:

```bash
curl "http://127.0.0.1:8787/api/v1/workflow-templates"
```

### Run Fails

Open the run detail and inspect:

- terminal status,
- error message,
- events,
- resolved backend,
- safety limits,
- artifact metadata,
- agent output.

Common causes include invalid inputs, missing provider configuration, plugin runner errors, exceeded runtime limits, or unsupported artifact payload access.

### Artifact Metadata Exists But Preview Fails

Artifact metadata and artifact payloads are separate. Metadata can exist even when the payload is in memory, file-backed, unsupported, or intentionally unavailable through the API.

Check:

- artifact `storageUri`,
- artifact format,
- whether the route supports that storage type,
- whether the payload path is inside an allowed artifact root.

## Glossary

Agent: A manifest-backed executable unit supplied by a plugin.

Agent Developer Kit: The `@athena/pdk` package that helps agent runners parse envelopes, validate inputs, and serialize outputs.

Artifact: An inspectable output or evidence record from a run.

Backend: The execution mechanism for an agent, such as local process, container command, or HTTP/API.

Event: A structured record of something that happened during execution.

Mission: A group of tasks under a shared goal.

Plugin: A local package that provides agents, workflows, schemas, docs, and related resources.

Provider: A configured model/API provider used by model-backed agents.

Readiness: API diagnostics that explain whether required local systems are usable.

Run: A specific execution attempt for a task, mission, or workflow.

Task: A unit of work assigned to one compatible agent.

Workflow template: A reusable plugin-provided plan that can instantiate executable work.

## Where To Go Next

For the shortest supported path:

- [Getting Started](../../GETTING_STARTED.md)

For agent authoring:

- [Build Your First Agent](../../packages/core/docs/user/07-pdk-guide.md)
- [Agent Developer Kit Package](../../packages/pdk/README.md)

For local server operation:

- [Local Server Deployment](../developer/product-dev-guides/local-server-deployment.md)
- [Fresh Server Real-Work Walkthrough](../developer/product-dev-guides/fresh-server-real-work-walkthrough.md)

For contributors:

- [Developer Guides](../developer/product-dev-guides/README.md)
- [Current Product Direction](../product/direction/current-direction.md)
- [Architecture Decisions](../product/architecture/decisions/README.md)

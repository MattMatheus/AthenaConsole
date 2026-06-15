<!-- AUDIENCE: Operator -->

# Running Work

This page covers the end-to-end path from starting your first run to inspecting results: the first-run demo, the product smoke suite, moving from demo to real repo work, and direct task and workflow operations.

---

## Start With An Outcome

Open the console at `http://127.0.0.1:5173` and use **Start Work** to choose what you want done. Start Work presents capabilities from loaded plugins and workflow templates. You do not need to know whether the underlying primitive is a task, workflow, mission, or run template — Start Work figures that out.

When you choose a capability, preflight shows:

- the selected outcome,
- the backing agent or workflow,
- repository context,
- provider readiness,
- safety mode,
- required inputs.

Review preflight and confirm before executing.

---

## Run The First-Run Demo

The first-run demo proves the control plane without external model credentials. It uses `sample-plugins/first-run-demo` and the default mock provider.

### Console Path

1. Open **Start Work**.
2. Choose **Run the first-run demo**.
3. Review preflight.
4. Instantiate and run the workflow.
5. Open the workflow run or **Work History** to inspect status, outputs, and artifacts.

### API Path

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

Execute:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/execute
```

Expected:

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

---

## Run The Product Smoke

After the API is running, use the product smoke for a single pass/fail check:

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

Run this before handing the product to a reviewer. It catches common setup breaks faster than clicking through the console manually.

---

## Move From Demo To Real Repo Work

The first-run demo proves the control plane. Real work adds repository context and often a model provider.

### Step 1: Expose the Repository

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

### Step 2: Load a Plugin

Confirm an agent that can do useful work appears in the console under `/agents`. If you need to load a custom agent, see [Create A Plugin-Backed Agent](#create-a-plugin-backed-agent) below.

### Step 3: Create and Run Work

Open `/tasks` to create one-agent work, or `/workflows` to instantiate a plugin-provided repeatable workflow. Use `/resources` to review repository wiring guidance.

---

## Use The Console

Useful console pages:

- `/` — readiness-oriented onboarding and next actions
- `/agents` — loaded agents, plugin provenance, readiness, agent detail links
- `/tasks` — create and run one-agent tasks
- `/missions` — group task work under a shared goal
- `/workflows` — instantiate plugin-provided workflow templates
- `/workflows/runs/<run-id>` — inspect workflow graph status
- `/runs` — run history, events, outputs, artifacts
- `/resources` — repository wiring guidance
- `/settings` — provider configuration and related local settings

When something does not appear, check readiness first, then check plugin validation diagnostics in the Capabilities page.

---

## Direct Task and Workflow Operations

### Tasks

Create and run a task directly:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{
    "id": "task-001",
    "title": "Review current branch",
    "status": "ready",
    "capabilityRequirements": ["code.review"],
    "assignedAgentId": "code.review.local",
    "assignedAgentVersion": "0.1.0",
    "inputs": {"repo": {"path": "."}, "baseRef": "main", "headRef": "HEAD"}
  }'

curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-001/run \
  -H "content-type: application/json" \
  -d '{}'
```

### Workflows

List available workflow templates:

```bash
curl "http://127.0.0.1:8787/api/v1/workflow-templates"
```

Instantiate and execute:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/workflow-templates/<template-id>/instantiate \
  -H "content-type: application/json" \
  -d '{"missionId":"mission-001","taskIdPrefix":"run-001","inputs":{...}}'

curl -X POST http://127.0.0.1:8787/api/v1/workflow-runs/<run-id>/execute
```

For full endpoint schemas, see the [SDK and Integration Guide](../sdk/README.md).

---

## Create A Plugin-Backed Agent

Use the scaffold command when you want a known-good local agent package:

```bash
npm --workspace @athena/core run build
npm --workspace @athena/core run athena -- agent scaffold --name "Research Planner"
```

By default, the scaffold writes under `.athena/plugins/`. The generated plugin includes `plugin.yaml`, the agent manifest, a runner, and a README.

Validate manifests:

```bash
npm --workspace @athena/core run validate:manifests
```

Restart the API after adding or changing plugin files:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

Then open `/agents` and confirm the new agent appears.

For a full file-by-file tutorial, see the [Agent Developer Kit guide](../sdk/agent-developer-kit.md). For a model-backed copy path, see [Starting from a sample](../sdk/agent-developer-kit.md#starting-from-a-sample).

---

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

Artifact payload (when available through the API):

```bash
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>/artifacts/<artifact-id>
```

In the console, prefer clicking from the run or workflow surface. The console preserves context better than raw API calls.

---

## Next Steps

- [Providers, Memory, and Repositories](06-providers-memory-repos.md) — configure model providers and repo context
- [Operations and Admin](08-operations-and-admin.md) — failed work recovery, schedules, diagnostics
- [Troubleshooting](09-troubleshooting.md) — when runs fail or agents don't appear

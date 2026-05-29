# Getting Started

Use this guide to start Team Orchestrator locally, check readiness, run the built-in demo workflow, and inspect the result.

## Prerequisites

Install:

- Node.js 20+
- Podman or Docker with Compose support
- Git

The first-run demo does not require OpenAI, Azure, or other external model credentials. It uses the checked-in sample plugin and the default mock provider.

## 1. Clone And Install

```bash
git clone <your-repo-url>
cd AthenaConsole
npm install
```

## 2. Start The Local Stack

```bash
podman compose -f docker-compose.local.yml up --build
```

Docker Compose is also supported:

```bash
docker compose -f docker-compose.local.yml up --build
```

When the stack is ready:

- API: `http://127.0.0.1:8787`
- Console: `http://127.0.0.1:5173`

The console proxies `/api/*` requests to the API container.

## 3. Check Health And Readiness

In a second terminal:

```bash
curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:8787/api/v1/readiness
```

Expected health shape:

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "now": "2026-05-28T00:00:00.000Z"
  }
}
```

Expected readiness shape:

```json
{
  "ok": true,
  "data": {
    "status": "ready",
    "summary": {
      "ready": true,
      "requiredFailed": 0,
      "degraded": 0,
      "optionalUnavailable": 0
    },
    "checks": [
      { "id": "api", "status": "ok" },
      { "id": "app-state", "status": "ok" },
      { "id": "plugins", "status": "ok" },
      { "id": "runtime", "status": "ok" },
      { "id": "sample-demo", "status": "ok" }
    ]
  }
}
```

`generatedAt`, paths, and detailed messages vary by machine. If readiness is `degraded`, read each check's `nextStep` field first.

## 4. Open The Console

Open:

```text
http://127.0.0.1:5173
```

Useful first-run pages:

- `http://127.0.0.1:5173/` for readiness-oriented onboarding.
- `http://127.0.0.1:5173/agents` to confirm the sample plugin and demo agent are indexed.
- `http://127.0.0.1:5173/workflows` to instantiate and run the first-run demo workflow.
- `http://127.0.0.1:5173/missions` to inspect the created mission.
- `http://127.0.0.1:5173/workflows/runs/workflow-run-mission-first-run-demo` after the API demo commands below.

## 5. Run The First-Run Demo Workflow

The local stack includes a sample plugin at `sample-plugins/first-run-demo`.

Confirm the workflow template is indexed:

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

Instantiate the demo workflow:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/workflow-templates/first-run.demo.workflow/instantiate \
  -H "content-type: application/json" \
  -d '{"missionId":"mission-first-run-demo","taskIdPrefix":"first-run-demo","inputs":{"demoName":"First-Run Demo"}}'
```

Expected data includes:

```json
{
  "workflowDagRun": {
    "id": "workflow-run-mission-first-run-demo"
  }
}
```

Execute the workflow run:

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

Inspect workflow status:

```bash
curl http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/status
```

Expected data includes:

```json
{
  "run": {
    "id": "workflow-run-mission-first-run-demo",
    "status": "completed"
  },
  "progress": {
    "completedSteps": 2,
    "percentComplete": 100
  },
  "nodes": [
    { "id": "prepare", "status": "completed" },
    { "id": "verify", "status": "completed" }
  ]
}
```

The step output includes deterministic local evidence such as:

```json
{
  "message": "First-Run Demo: prepare completed locally."
}
```

Task-run artifact metadata is exposed from each step's `output.taskRunId` through:

```bash
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>
```

The sample artifact uses `memory://first-run-demo/...` storage metadata and does not contain external credentials.

## 6. Move From Demo To Real Repo Work

The first-run demo proves that plugins, agents, workflow templates, task runs, events, and artifact metadata are working locally. Real repository work follows the same operator loop, but uses your repo as run context and plugin-backed agents that know how to operate on that repo.

Use this path:

1. Choose the local repository you want Team Orchestrator to operate on.
2. If you use `docker-compose.local.yml`, expose that repo with `ATHENA_REPO_HOST_PATH` and use `ATHENA_REPO_CONTAINER_PATH` or `/workspace/target-repo` inside task or workflow inputs.
3. Add plugin packages that provide the agents or workflow templates you need through `ATHENA_PLUGIN_PATHS` or `ATHENA_SYSTEM_PLUGIN_PATHS`.
4. Open `http://127.0.0.1:5173/resources` for repo wiring guidance and `http://127.0.0.1:5173/agents` to confirm agents are loaded.
5. Start real work from `http://127.0.0.1:5173/tasks` for one agent and one objective, or `http://127.0.0.1:5173/workflows` for a plugin-provided workflow template.

Team Orchestrator does not save repository records or create agents in the console today. The workspace owns app state and plugin discovery; the target repo is supplied through configuration or run inputs when work starts.

## 7. Stop The Local Stack

```bash
podman compose -f docker-compose.local.yml down
```

Or, if you used Docker Compose:

```bash
docker compose -f docker-compose.local.yml down
```

## Optional Provider Credentials

The first-run demo uses the default mock provider. Configure a provider only when you want non-demo persona or model-backed work.

Copy the example environment file:

```bash
cp packages/core/.env.example .env
```

OpenAI-compatible setup:

```env
ATHENA_DEFAULT_PROVIDER=openai
ATHENA_OPENAI_API_KEY=your_api_key_here
```

Azure AI Foundry setup:

```env
ATHENA_DEFAULT_PROVIDER=foundry
ATHENA_FOUNDRY_ENABLED=true
ATHENA_FOUNDRY_PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com
ATHENA_FOUNDRY_DEPLOYMENT=<your-deployment-name>
ATHENA_FOUNDRY_API_VERSION=2024-05-01-preview
ATHENA_FOUNDRY_USE_ENTRA_ID=true
```

For Foundry with Entra ID auth in local development, run `az login` before starting Team Orchestrator.

If sandboxed work needs access to a specific local source tree, set:

```env
ATHENA_SANDBOX_WORKSPACE_HOST_PATH=/absolute/path/to/source
```

## Local Server Deployment

Use `docker-compose.server.yml` when you want Team Orchestrator to keep running on a trusted local server with explicit durable paths for state, artifacts, managed repos, plugins, and local secret files.

```bash
cp server.env.example server.env
# Edit server.env before starting.
docker compose --env-file server.env -f docker-compose.server.yml up --build -d
```

The server profile binds ports to `127.0.0.1` by default. Set `ATHENA_SERVER_BIND_ADDRESS=0.0.0.0` only for a protected LAN. See [Local Server Deployment](docs/developer/product-dev-guides/local-server-deployment.md) for path ownership and secret-file conventions.

## Production-Like Local Validation

`docker-compose.prod.yml` builds compiled API artifacts and serves static console assets through Nginx with `/api/*` proxied to the API container. It requires explicit auth settings.

```bash
export ATHENA_AUTH_API_TOKEN="<at-least-16-characters>"
export ATHENA_CONSOLE_PASSWORD="<local-console-password>"
podman compose -f docker-compose.prod.yml up --build
```

Useful checks:

```bash
curl -H "authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: healthcheck" \
  http://127.0.0.1:8787/api/v1/health

curl -H "authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: healthcheck" \
  http://127.0.0.1:8787/api/v1/readiness
```

To stop and remove containers:

```bash
podman compose -f docker-compose.prod.yml down
```

## Container Build Context Hygiene

Root `.dockerignore` excludes high-churn and heavy directories such as `.git`, `node_modules`, `dist`, `.turbo`, `.athena`, `planning`, and related artifacts.

Measured local context payload on February 21, 2026:

- Baseline file payload without ignore filtering: `825,900,457` bytes
- Filtered payload with `.dockerignore` patterns: `277,442,309` bytes
- Reduction: `548,458,148` bytes, or `66.4%`

Measurement method:

```bash
find . -type f -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s}'
find . \( -name .git -o -name node_modules -o -name .turbo -o -name .cache -o -name dist -o -name coverage -o -name .nyc_output -o -name .athena -o -name planning \) -prune -o -type f ! -name '.DS_Store' ! -name '*.log' ! -name '.env' ! -name '.env.*' -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s}'
```

## Scope Note

Terraform and Azure infrastructure setup are for production deployments only and are not required for local development.

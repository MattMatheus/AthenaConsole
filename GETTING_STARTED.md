# Getting Started

Team Orchestrator is a work control plane for teams and operators. This guide covers the **local evaluation path**: start the stack on your machine, run the first-run demo, then move to real repository work. For trusted-server team deployment with workspace membership and multi-user governance, see the [Team Orchestrator User Guide](docs/user-guide/README.md).

For a fuller explanation of the product model, operator workflows, agent authoring, troubleshooting, and examples, read the [Team Orchestrator User Guide](docs/user-guide/README.md).

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

## 4. Open The Console And Start Work

Open:

```text
http://127.0.0.1:5173
```

Useful first-run pages:

- `http://127.0.0.1:5173/` for readiness-oriented onboarding.
- `http://127.0.0.1:5173/start` to choose an outcome such as the first-run demo, repo summary, code review, release readiness, or test-failure explanation.
- `http://127.0.0.1:5173/runs` to inspect work history after a task or workflow runs.
- `http://127.0.0.1:5173/resources` to connect repository context for real repo work.
- `http://127.0.0.1:5173/agents` to browse capabilities and inspect backing plugin-provided agents.
- `http://127.0.0.1:5173/workflows/runs/workflow-run-mission-first-run-demo` after the API demo commands below.

## 5. Run The First-Run Demo Outcome

The local stack includes a sample plugin at `sample-plugins/first-run-demo`.

In the console, open `http://127.0.0.1:5173/start`, choose **Run the first-run demo**, review the preflight, instantiate the workflow, run it, and then inspect the workflow run. The console still shows the backing workflow template before execution, but you do not need to choose that primitive first.

The API path below is useful for repeatable scripted validation.

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

## Product Readiness Smoke

After the local stack is running, use the repeatable smoke command when you want one pass/fail check before sharing the product or handing it to another reviewer:

```bash
npm run smoke:product
```

The smoke command checks:

- API health and readiness.
- First-run demo agents in the catalog.
- First-run workflow template availability.
- Workflow instantiation and execution.
- Workflow status and linked task-run artifact metadata.

If your API is not at `http://127.0.0.1:8787`, pass:

```bash
npm run smoke:product -- --api-base-url http://127.0.0.1:<port>
```

For a provider-backed manual smoke, configure a provider in Settings, run a model-backed agent task, then inspect the task run detail and artifact preview in the console. The scripted smoke path remains credential-free.

## 6. Move From Demo To Real Repo Work

The first-run demo proves that the local work loop is functioning. Real repository work follows the same operator path: pick an outcome, select or connect repository context, review preflight, run the work, then inspect history and artifacts.

Use this path:

1. Choose the local repository you want Team Orchestrator to operate on.
2. If you use `docker-compose.local.yml`, expose that repo with `ATHENA_REPO_HOST_PATH` and use `ATHENA_REPO_CONTAINER_PATH` or `/workspace/target-repo` inside task or workflow inputs.
3. Open `http://127.0.0.1:5173/resources` to register or inspect repository context.
4. Open `http://127.0.0.1:5173/start` and choose a capability such as **Summarize a repository**, **Review code changes**, **Check release readiness**, or **Explain a test failure**.
5. Review the selected backing agent or workflow, repository context, provider state, safety mode, and required inputs in preflight.
6. Save/run the work, then open `http://127.0.0.1:5173/runs` to inspect results.

Advanced users and authors can still open direct primitive surfaces:

- `http://127.0.0.1:5173/tasks`
- `http://127.0.0.1:5173/workflows`
- `http://127.0.0.1:5173/missions`
- `http://127.0.0.1:5173/run-templates`

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

## Team Deployment (Multi-User)

After validating locally, deploy Team Orchestrator for your team using a trusted-server profile with workspace membership, RBAC, cost governance, and durable persistence. See the [Team Orchestrator User Guide](docs/user-guide/README.md) for the full team deployment guide, including workspace setup and admin configuration.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

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

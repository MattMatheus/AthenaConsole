<!-- AUDIENCE: Engineer/SDK -->

# Workflows and Workflow Templates

**Route families**: `workflows`, `workflow-templates`

Workflows are DAG-based execution graphs defined by workflow templates. A workflow template describes the graph structure; instantiation creates a mission + tasks from it.

---

## Workflow Templates

### `GET /api/v1/workflow-templates`

List available workflow templates.

**Required role**: no role check enforced in the current build (no `AuthorizedWorkflowTemplateCatalogService`)  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 50, max 500) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "first-run.demo.workflow",
        "displayName": "First-Run Demo",
        "version": "1.0.0"
      }
    ]
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workflow-templates
```

---

### `POST /api/v1/workflow-templates/:id/instantiate`

Instantiate a workflow template. Creates a mission and its constituent tasks from the template graph.

**Required role**: no role check enforced in the current build  
**Path params**: `id` — workflow template ID  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `missionId` | string | no | ID for the created mission |
| `taskIdPrefix` | string | no | Prefix for generated task IDs |
| `inputs` | object | no | Input bindings for template parameters |

**Response** (`200`): Instantiation result with created mission and tasks.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"missionId": "mission-first-run-demo", "taskIdPrefix": "first-run-demo", "inputs": {"demoName": "First-Run Demo"}}' \
  http://127.0.0.1:8787/api/v1/workflow-templates/first-run.demo.workflow/instantiate
```

---

## Workflow Runs

### `GET /api/v1/workflow-queue/status`

Get the current workflow queue status.

**Required role**: `Operator` or `Admin` (authorization.ts `workflowQueue.status` operation)  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `at` | string | ISO timestamp for staleness calculation |
| `staleAfterMs` | integer | Items older than this (ms) are flagged stale |
| `limit` | integer | Maximum items to return |

**Response** (`200`): Workflow queue snapshot.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workflow-queue/status
```

---

### `GET /api/v1/workflow-runs/:runId/status`

Get the execution graph status for a workflow run.

**Required role**: `Operator` or `Admin` (authorization.ts `workflowRun.status` operation)  
**Path params**: `runId` — workflow run ID

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "run": {
      "id": "workflow-run-mission-first-run-demo",
      "status": "running",
      "workflowTemplate": {
        "id": "first-run.demo.workflow"
      }
    },
    "nodes": [],
    "progress": {
      "totalSteps": 2,
      "completedSteps": 1,
      "runningSteps": 1,
      "failedSteps": 0,
      "pendingSteps": 0,
      "percentComplete": 50
    },
    "recovery": {
      "resumable": false,
      "failedStepIds": [],
      "staleRecoveredStepIds": []
    }
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-001/status
```

---

### `POST /api/v1/workflow-runs/:runId/execute`

Advance a workflow run by executing all pending nodes whose dependencies are satisfied.

**Required role**: no role check enforced in the current build (no authorizer for `workflowDagExecutorService`)  
**Path params**: `runId` — workflow run ID  
**Request body**: empty `{}`

**Response** (`200`): Execution result with executed step IDs and current graph snapshot.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-001/execute
```

<!-- AUDIENCE: Engineer/SDK -->

# Tasks and Task Runs

**Route family**: `tasks`

Tasks are the primary work primitive. A task describes what to do, which agent to assign it to, and what inputs it needs. Running a task creates a task run.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

---

## Task Status Values

`draft` | `proposed` | `ready` | `running` | `blocked` | `completed` | `failed` | `cancelled` | `archived`

**Reference**: `packages/core/src/shared/contracts/task-workbench.ts:19`

---

## Endpoints

### `GET /api/v1/tasks/metadata`

Return server-side task metadata: available statuses, default status, supported run modes.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "statuses": ["draft", "proposed", "ready", "running", "blocked", "completed", "failed", "cancelled", "archived"],
    "defaultStatus": "draft",
    "runModes": ["read-only", "propose-changes", "approved-write"],
    "defaultRunMode": "read-only"
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/tasks/metadata
```

---

### `GET /api/v1/tasks`

> ⚠️ **Preview**: workspace filtering via `workspaceId` or `x-athena-scope-workspaces` is client-asserted only.

List tasks. Results are filtered by workspace scope header when present.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `status` | string | Filter by task status |
| `missionId` | string | Filter by mission |
| `workspaceId` | string | Filter by workspace ID |
| `includeArchived` | boolean | Include archived tasks (default: false) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "tasks": [
      {
        "id": "task-001",
        "title": "Summarize CI failures",
        "status": "ready",
        "assignedAgentId": "my-plugin/my-agent",
        "workspaceId": "ws-default",
        "createdAt": "2026-06-15T10:00:00.000Z",
        "updatedAt": "2026-06-15T10:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  "http://127.0.0.1:8787/api/v1/tasks?status=ready"
```

---

### `POST /api/v1/tasks`

Create a task.

**Required role**: `Operator` or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | yes | Task title |
| `id` | string | no | Client-supplied ID (server-generated if omitted) |
| `description` | string | no | Task description |
| `status` | string | no | Initial status (default: `draft`) |
| `assignedAgentId` | string | no | Agent to run this task |
| `assignedAgentVersion` | string | no | Pinned agent version |
| `capabilityRequirements` | string[] | no | Required capabilities |
| `inputs` | object | no | Input values for the agent |
| `dependsOn` | string[] | no | Task IDs this depends on |
| `missionId` | string | no | Parent mission ID |
| `workspaceId` | string | no | Workspace to create in |

**Response** (`200`): Full task object.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"title": "Summarize CI failures", "assignedAgentId": "my-plugin/my-agent", "status": "ready"}' \
  http://127.0.0.1:8787/api/v1/tasks
```

---

### `GET /api/v1/tasks/:id`

Get a single task by ID.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `id` — task ID

**Response** (`200`): Full task object.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/tasks/task-001
```

---

### `PUT /api/v1/tasks/:id`

Update a task (partial update — only provided fields are changed).

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — task ID  
**Request body**: Same optional fields as `POST /api/v1/tasks` (except `id`)

**Response** (`200`): Updated task object.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"status": "ready", "description": "Updated description"}' \
  http://127.0.0.1:8787/api/v1/tasks/task-001
```

---

### `GET /api/v1/tasks/:id/run-readiness`

Check whether a task is ready to run. Returns readiness status and any blocking issues.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `id` — task ID

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "ready": true,
    "issues": []
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/tasks/task-001/run-readiness
```

---

### `POST /api/v1/tasks/:id/run`

Trigger a run of the task. The task must be in `ready` status and have an assigned agent.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — task ID  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `runId` | string | no | Client-supplied run ID |

**Response** (`200`): Run summary including `runId`, `status`, `sessionId`.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/tasks/task-001/run
```

---

### `GET /api/v1/task-runs/:runId`

Get a task run by ID.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `runId` — task run ID

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "run": {
      "id": "run-001",
      "taskId": "task-001",
      "status": "completed",
      "workspaceId": "ws-default",
      "createdAt": "2026-06-15T10:01:00.000Z",
      "updatedAt": "2026-06-15T10:02:00.000Z"
    }
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/task-runs/run-001
```

---

### `GET /api/v1/task-runs/:runId/evidence-bundle`

Export the complete evidence bundle for a task run. Returns a JSON object with the run record,
transcript, artifacts, and verification results.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `runId` — task run ID

**Response** (`200`): Evidence bundle JSON.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/task-runs/run-001/evidence-bundle
```

---

### `GET /api/v1/task-runs/:runId/artifacts/:artifactId`

Get a single artifact from a task run.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `runId` — task run ID, `artifactId` — artifact ID

**Response** (`200`): Artifact record including content.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/task-runs/run-001/artifacts/artifact-001
```

---

### `POST /api/v1/task-runs/:runId/cancel`

Cancel an in-progress task run.

**Required role**: `Operator` or `Admin`  
**Path params**: `runId` — task run ID  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `reason` | string | no | Cancellation reason for audit log |

**Response** (`200`): Updated run summary.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"reason": "operator cancel"}' \
  http://127.0.0.1:8787/api/v1/task-runs/run-001/cancel
```

<!-- AUDIENCE: Engineer/SDK -->

# Missions

**Route family**: `missions`

A mission is a container for a group of related tasks. Missions allow you to organize multi-step work and track progress across all constituent tasks.

---

## Endpoints

### `GET /api/v1/missions`

List missions.

**Required role**: `Viewer`, `Operator`, or `Admin`
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
        "id": "mission-001",
        "name": "Onboarding Automation",
        "status": "active",
        "createdAt": "2026-06-15T10:00:00.000Z",
        "updatedAt": "2026-06-15T10:00:00.000Z"
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
  http://127.0.0.1:8787/api/v1/missions
```

---

### `POST /api/v1/missions`

Create a mission.

**Required role**: `Operator` or `Admin`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Mission name |
| `description` | string | no | Mission description |

**Response** (`200`): Full mission object.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Onboarding Automation", "description": "Automate the new-hire onboarding checklist"}' \
  http://127.0.0.1:8787/api/v1/missions
```

---

### `GET /api/v1/missions/:id`

Get a single mission.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Path params**: `id` — mission ID

**Response** (`200`): Full mission object.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/missions/mission-001
```

---

### `PUT /api/v1/missions/:id`

Update a mission.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — mission ID
**Request body**: Same optional fields as `POST /api/v1/missions`

**Response** (`200`): Updated mission object.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}' \
  http://127.0.0.1:8787/api/v1/missions/mission-001
```

---

### `POST /api/v1/missions/:id/run`

Run a mission (trigger execution of all ready tasks).

**Required role**: `Operator` or `Admin`
**Path params**: `id` — mission ID
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `provider` | string | no | Override model provider |
| `model` | string | no | Override model |

**Response** (`200`): Mission run summary.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/missions/mission-001/run
```

---

### `GET /api/v1/missions/:id/runs`

List all runs for a mission.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Path params**: `id` — mission ID

**Response** (`200`): `{ items: [...] }`

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/missions/mission-001/runs
```

---

### `GET /api/v1/missions/:id/tasks`

List tasks belonging to a mission.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Path params**: `id` — mission ID

**Response** (`200`): Task list.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/missions/mission-001/tasks
```

---

### `POST /api/v1/missions/:id/tasks`

Create a new task and add it to the mission.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — mission ID
**Request body**: Same as `POST /api/v1/tasks` (the `missionId` is set automatically).

**Response** (`200`): Created task object.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"title": "Draft onboarding email", "assignedAgentId": "my-plugin/email-agent"}' \
  http://127.0.0.1:8787/api/v1/missions/mission-001/tasks
```

---

### `POST /api/v1/missions/:id/tasks/attach`

Attach an existing task to a mission.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — mission ID
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `taskId` | string | yes | ID of the task to attach |

**Response** (`200`): Updated task.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-001"}' \
  http://127.0.0.1:8787/api/v1/missions/mission-001/tasks/attach
```

---

### `GET /api/v1/mission-runs/:runId`

Get a mission run by ID.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Path params**: `runId` — mission run ID

**Response** (`200`): Mission run detail.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/mission-runs/mrun-001
```

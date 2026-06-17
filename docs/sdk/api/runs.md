<!-- AUDIENCE: Engineer/SDK -->

# Runs (Low-Level)

**Route family**: `runs`

The low-level runs API creates and cancels agent runs directly (without a task). For most use cases prefer `POST /api/v1/tasks/:id/run` (task-scoped) or run templates. Use this API for direct session-level control or when integrating with a custom harness.

---

## Endpoints

### `POST /api/v1/runs`

Create and immediately start a run.

**Required role**: `Viewer`, `Operator`, or `Admin` (scoped by agent and session)
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `sessionId` | string | no | Session to attach to (creates a new session if omitted) |
| `input` | string | no | Natural language input |
| `provider` | string | no | Model provider ID |
| `model` | string | no | Model name |
| `directiveId` | string | no | Directive to use instead of `input` |
| `harnessProfileId` | string | no | Harness profile to use |
| `metadata` | object | no | Metadata (e.g. `{ agentName, agentId }`) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "sessionId": "s1",
    "runId": "run_2026_001",
    "provider": "mock",
    "model": "default",
    "directiveId": "dir_triage",
    "harnessProfileId": "hp_ops_v1",
    "evidenceCount": 1,
    "verificationStatus": "passed",
    "createdAt": "2026-06-15T12:00:00.000Z"
  }
}
```

**curl** — minimal:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "s1", "input": "Summarize latest build failures", "provider": "mock", "model": "default"}' \
  http://127.0.0.1:8787/api/v1/runs
```

**curl** — with directive and harness profile:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "s1", "directiveId": "dir_triage", "harnessProfileId": "hp_ops_v1"}' \
  http://127.0.0.1:8787/api/v1/runs
```

---

### `GET /api/v1/runs/active`

List currently active (in-progress) runs.

**Required role**: none; diagnostic read endpoint
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 50, max 500) |
| `sessionId` | string | Filter by session |
| `runId` | string | Filter by run ID |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "sessionId": "s1",
        "pid": 12345,
        "startedAt": "2026-06-15T12:00:00.000Z",
        "runId": "run_2026_001",
        "traceId": "trace_123"
      }
    ],
    "nextCursor": "eyJraW5kIjoiYWN0aXZlIn0"
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/runs/active
```

---

### `GET /api/v1/runs/cancel-requests`

List pending cancellation requests.

**Required role**: none; diagnostic read endpoint
**Query params**: same as `GET /api/v1/runs/active`

**Response** (`200`): `{ items: [...], nextCursor? }`

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/runs/cancel-requests
```

---

### `POST /api/v1/run-control/by-run/:runId/cancel`

Cancel a run by its run ID. **Preferred cancellation path.**

**Required role**: `Operator` or `Admin`
**Path params**: `runId`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `reason` | string | no | Cancellation reason |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "runId": "run_2026_001",
    "status": "cancelled",
    "sessionId": "s1"
  }
}
```

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"reason": "operator cancel"}' \
  http://127.0.0.1:8787/api/v1/run-control/by-run/run_2026_001/cancel
```

---

### `POST /api/v1/runs/:sessionId/cancel`

Cancel a run by session ID. Legacy compatibility path — prefer `POST /api/v1/run-control/by-run/:runId/cancel`.

**Required role**: `Operator` or `Admin`
**Path params**: `sessionId`
**Request body**: `{ "reason": "..." }` (optional)

**Response** (`200`): Same shape as above.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"reason": "operator cancel"}' \
  http://127.0.0.1:8787/api/v1/runs/s1/cancel
```

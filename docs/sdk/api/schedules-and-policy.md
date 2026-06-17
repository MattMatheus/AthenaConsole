<!-- AUDIENCE: Engineer/SDK -->

# Schedules and Policy

**Route families**: `schedules`, `operations-events-policy` (policy endpoints)

Schedules allow recurring or time-delayed execution of sessions or task workflows. Policy controls system-wide concurrency, timeout, and cost limits.

---

## Schedules

### `GET /api/v1/schedules`

List all schedules (paginated).

**Required role**: none; schedule read endpoint
**Query params**: `cursor`, `limit` (standard pagination)

**Response** (`200`): Paginated schedule items with `nextCursor`.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/schedules
```

---

### `POST /api/v1/schedules`

Create a schedule.

**Required role**: `Operator` or `Admin`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Client-supplied schedule ID |
| `name` | string | yes | Display name |
| `targetType` | string | no | Target type (`session` or `task`) |
| `targetId` | string | no | Target resource ID |
| `inputBindings` | object | no | Input key-value bindings |
| `rrule` | string | no | RFC 5545 recurrence rule |
| `runAt` | string | no | One-shot ISO timestamp |
| `timezone` | string | no | IANA timezone for rrule |
| `status` | string | no | `active` or `paused` |
| `failurePolicy` | string | no | Failure handling policy |
| `enabled` | boolean | no | Whether schedule is active (default: true) |

**Response** (`200`): Created schedule.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"id": "sched-daily-ci", "name": "Daily CI Review", "rrule": "FREQ=DAILY;BYHOUR=9;BYMINUTE=0", "timezone": "America/New_York", "targetType": "task", "targetId": "task-001", "status": "active"}' \
  http://127.0.0.1:8787/api/v1/schedules
```

---

### `GET /api/v1/schedules/:id`

Get a schedule by ID.

**Required role**: none; schedule read endpoint
**Path params**: `id` — schedule ID

**Response** (`200`): Schedule object (or `null` if not found).

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci
```

---

### `PUT /api/v1/schedules/:id`

Update a schedule (upsert semantics).

**Required role**: `Operator` or `Admin`
**Path params**: `id` — schedule ID
**Request body**: Same fields as `POST /api/v1/schedules` (except `id`)

**Response** (`200`): Updated schedule.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Daily CI Review", "status": "paused", "rrule": "FREQ=DAILY;BYHOUR=9;BYMINUTE=0"}' \
  http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci
```

---

### `DELETE /api/v1/schedules/:id`

Delete a schedule.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — schedule ID

**Response** (`200`): `{ id: "...", removed: true }`

**curl**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci
```

---

### `POST /api/v1/schedules/:id/run`

Immediately trigger a schedule run (one-shot, outside the normal timer).

**Required role**: `Operator` or `Admin` (via `schedules.upsert` check)
**Path params**: `id` — schedule ID
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `provider` | string | no | Override model provider |
| `model` | string | no | Override model |

**Response** (`200`): Run result with `sessionId`, `status`.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci/run
```

---

### `POST /api/v1/schedules/:id/enable`

Enable a paused schedule.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — schedule ID
**Request body**: `{}`

**Response** (`200`): `{ id: "...", updated: true, schedule: {...} }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci/enable
```

---

### `POST /api/v1/schedules/:id/disable`

Disable (pause) a schedule.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — schedule ID
**Request body**: `{}`

**Response** (`200`): `{ id: "...", updated: true, schedule: {...} }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci/disable
```

---

### `GET /api/v1/schedules/:id/logs`

Get the execution log for a schedule.

**Required role**: none; schedule log read endpoint
**Path params**: `id` — schedule ID
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `limit` | integer | Max log entries (default 50, max 500) |

**Response** (`200`): `{ items: [log entries] }`

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  "http://127.0.0.1:8787/api/v1/schedules/sched-daily-ci/logs?limit=20"
```

---

### `POST /api/v1/schedules/tick`

Trigger execution of all schedules due at the specified time. Used by the internal scheduler daemon.

**Required role**: `Operator` or `Admin` (via `schedules.upsert`)
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `at` | string | yes | ISO timestamp to evaluate "due" schedules against |
| `provider` | string | no | Override provider |
| `model` | string | no | Override model |

**Response** (`200`): `{ at: "...", run: [...], skipped: N }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"at": "2026-06-15T09:00:00.000Z"}' \
  http://127.0.0.1:8787/api/v1/schedules/tick
```

---

## Policy

### `GET /api/v1/policy`

Get the current system policy.

**Required role**: none; policy read endpoint
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "schemaVersion": 1,
    "maxConcurrentRuns": 2,
    "defaultRunTimeoutMs": 10000,
    "defaultScheduleTimeoutMs": 20000,
    "retryBudgetPerRun": 3,
    "costBudgetDailyUsd": 25.5,
    "updatedAt": "2026-06-15T10:00:00.000Z"
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/policy
```

---

### `PUT /api/v1/policy`

Replace the system policy.

**Required role**: `Admin`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `policy` | object | yes | Full policy document |
| `auditComment` | string | no | Reason for change (recorded in event log) |

Policy document fields:

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | integer | Policy schema version (currently `1`) |
| `maxConcurrentRuns` | integer | Max simultaneous agent runs |
| `defaultRunTimeoutMs` | integer | Default per-run timeout in ms |
| `defaultScheduleTimeoutMs` | integer | Default per-schedule timeout in ms |
| `retryBudgetPerRun` | integer | Max retries per run |
| `costBudgetDailyUsd` | number | Daily cost cap in USD |

Note: `updatedAt` is server-set — do not include in requests.

**Response** (`200`): Updated policy.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {
      "schemaVersion": 1,
      "maxConcurrentRuns": 2,
      "defaultRunTimeoutMs": 10000,
      "defaultScheduleTimeoutMs": 20000,
      "retryBudgetPerRun": 3,
      "costBudgetDailyUsd": 25.5
    },
    "auditComment": "Reduce concurrency for off-hours"
  }' \
  http://127.0.0.1:8787/api/v1/policy
```

---

### `GET /api/v1/policy/rejections`

List concurrency rejections (flattened event list).

**Required role**: none; policy diagnostics endpoint
**Query params**: `cursor`, `limit`, `sessionId`, `after`

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "rej_1",
        "createdAt": "2026-06-15T15:02:00.000Z",
        "sessionId": "s1",
        "activeRuns": 2,
        "maxConcurrentRuns": 2,
        "reason": "max-concurrent-runs-exceeded"
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
  http://127.0.0.1:8787/api/v1/policy/rejections
```

---

### `GET /api/v1/rejections`

Legacy alias for `GET /api/v1/policy/rejections`. Prefer the `/api/v1/policy/rejections` path.

**Required role**: none; policy diagnostics endpoint
**Query params**: same as `/policy/rejections`

<!-- AUDIENCE: Engineer/SDK -->

# Failed Work

**Route family**: `failed-work`

Failed work records capture work items that encountered unrecoverable errors during execution. Operators can inspect them, trigger retries, or discard them.

---

## Endpoints

### `GET /api/v1/failed-work`

List failed work items.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 50, max 500) |
| `status` | string | Filter by status (e.g. `pending`, `retried`, `discarded`) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "work_failure_001",
        "status": "pending",
        "reason": "Timeout connecting to code review task runner",
        "payload": {
          "repo": "athena",
          "head": "feat-new-api"
        },
        "createdAt": "2026-06-15T16:00:00.000Z",
        "updatedAt": "2026-06-15T16:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/failed-work
```

---

### `POST /api/v1/failed-work/:id/retry`

Retry a failed work item. Sets its status to `retried` and re-queues it.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — failed work item ID  
**Request body**: `{}` (empty)

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "updated": true,
    "item": {
      "id": "work_failure_001",
      "status": "retried"
    }
  }
}
```

Returns `404` if the item is not found.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/failed-work/work_failure_001/retry
```

---

### `POST /api/v1/failed-work/:id/discard`

Discard a failed work item. Marks it as discarded without re-queuing.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — failed work item ID  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `auditNote` | string | no | Reason for discard (recorded in event log) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "updated": true,
    "item": {
      "id": "work_failure_001",
      "status": "discarded"
    }
  }
}
```

Returns `404` if the item is not found.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"auditNote": "Stale PR — superseded by newer run"}' \
  http://127.0.0.1:8787/api/v1/failed-work/work_failure_001/discard
```

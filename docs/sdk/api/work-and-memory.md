<!-- AUDIENCE: Engineer/SDK -->

# Work Queue, A2A Observability, and Memory

**Route families**: `work`, `memory`

These APIs expose runtime internals: the work queue (used by the agent harness), agent-to-agent (A2A) flow observability, and in-process memory search.

---

## Work Queue

### `POST /api/v1/work/enqueue`

Enqueue a work item for a session. Used by the agent harness for follow-up and collect-mode work items.

**Required role**: `Operator` or `Admin` (scoped by session)  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `sessionId` | string | yes | Session to enqueue work for |
| `input` | string | yes | Work item content |
| `kind` | string | yes | Work kind (`followup` or `collect`) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "sessionId": "s1",
    "items": [
      { "id": "work-001", "kind": "followup", "input": "Run linting" }
    ]
  }
}
```

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "s1", "input": "Run linting", "kind": "followup"}' \
  http://127.0.0.1:8787/api/v1/work/enqueue
```

---

### `POST /api/v1/work/:sessionId/drain`

Drain (consume) pending work items from a session's queue.

**Required role**: `Operator` or `Admin` (scoped by session)  
**Path params**: `sessionId`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | no | Max items to drain |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "status": "drained",
    "drainedItems": 2,
    "queueDepthBefore": 2,
    "queueDepthAfter": 0
  }
}
```

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/work/s1/drain
```

---

## A2A Observability

### `GET /api/v1/work/observability`

Get the current agent-to-agent observability snapshot (stall detection, concurrency metrics).

**Required role**: `Operator` or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `at` | string | ISO timestamp for snapshot |
| `staleAfterMs` | integer | Stale threshold in ms |

**Response** (`200`): Observability snapshot.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/work/observability
```

---

### `GET /api/v1/work/observability/alerts`

List A2A stall alert history.

**Required role**: `Operator` or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size |
| `createdAfter` | string | ISO timestamp filter |
| `createdBefore` | string | ISO timestamp filter |

**Response** (`200`): Paginated alert records.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/work/observability/alerts
```

---

### `GET /api/v1/work/observability/alerts/export.csv`

Export A2A stall alert history as CSV.

**Required role**: `Operator` or `Admin`  
**Query params**: Same as `/alerts`  
**Response**: `text/csv` attachment (`a2a-stall-alerts-<from>-<to>.csv`)

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -o alerts.csv \
  http://127.0.0.1:8787/api/v1/work/observability/alerts/export.csv
```

---

### `GET /api/v1/work/flows/:traceId`

Get the A2A flow graph for a trace ID.

**Required role**: `Operator` or `Admin`  
**Path params**: `traceId`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `depth` | integer | Max depth to traverse |

**Response** (`200`): Flow graph with nodes and edges.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/work/flows/trace_123
```

---

## Memory

### `GET /api/v1/memory/search`

Search indexed local memory/context files (when memory backend is enabled).

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `q` | string | Search query |
| `limit` | integer | Max results |

**Response** (`200`): Ranked memory results.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  "http://127.0.0.1:8787/api/v1/memory/search?q=deployment+checklist"
```

---

### `POST /api/v1/memory/get`

Read bounded memory/context excerpts by workspace-relative path.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | string | yes | Workspace-relative file path |
| `limit` | integer | no | Max characters to return |

**Response** (`200`): File content excerpt.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"path": "planning/archive/handoff.md"}' \
  http://127.0.0.1:8787/api/v1/memory/get
```

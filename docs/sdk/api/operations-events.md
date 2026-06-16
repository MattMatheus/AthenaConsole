<!-- AUDIENCE: Engineer/SDK -->

# Operations, Events, and Cost

**Route family**: `operations-events-policy` (operations and events endpoints)

The operations and events APIs provide cost summaries, per-provider cost settings, CSV cost exports, and the system event log.

---

## Operations

### `GET /api/v1/operations/summary`

Get the operations summary: token usage, cost, and run counts.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**: none

**Response** (`200`): Operations summary object.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/operations/summary
```

Legacy alias: `GET /api/operations/summary` (same handler, unversioned path).

---

### `GET /api/v1/operations/cost/settings`

Get per-provider cost settings (token prices, per-model overrides).

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**: none

**Response** (`200`): Provider cost settings map.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/operations/cost/settings
```

Legacy alias: `GET /api/operations/cost/settings`

---

### `PUT /api/v1/operations/cost/settings`

Update per-provider cost settings.

**Required role**: `Operator` or `Admin`  
**Request body**: Provider cost settings map.

**Response** (`200`): Updated cost settings.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"providers": {"mock": {"inputCostPer1kTokens": 0, "outputCostPer1kTokens": 0}}}' \
  http://127.0.0.1:8787/api/v1/operations/cost/settings
```

Legacy alias: `PUT /api/operations/cost/settings`

---

### `GET /api/v1/operations/cost/report.csv`

Download the monthly cost report as CSV.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `month` | string | Month in `YYYY-MM` format (defaults to current month) |

**Response**: `text/csv` attachment (`operations-cost-report-<month>.csv`)

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -o "cost-report.csv" \
  "http://127.0.0.1:8787/api/v1/operations/cost/report.csv?month=2026-06"
```

Legacy alias: `GET /api/operations/cost/report.csv`

---

## Events

### `GET /api/v1/events`

List system events (paginated).

**Required role**: `Viewer`, `Operator`, or `Admin` (scoped by `sessionId` when provided)  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Max events (default 50, max 500) |
| `sessionId` | string | Filter by session |
| `type` | string | Filter by event type |
| `after` | string | Return events after this event ID |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "events": [
      {
        "id": "evt_1",
        "traceId": "trace_1",
        "type": "run.created",
        "sessionId": "s1",
        "createdAt": "2026-06-15T12:00:00.000Z",
        "payload": {}
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
  http://127.0.0.1:8787/api/v1/events
```

Legacy alias: `GET /api/events`

---

### `GET /api/v1/events/stream`

Stream system events as Server-Sent Events. Polls every 1 second, sends heartbeats every 15 seconds.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `after` | string | Start streaming after this event ID |
| `limit` | integer | Batch fetch limit per poll |

Also accepts `Last-Event-ID` request header.

**Response**: `text/event-stream`

Each event:

```
id: evt_1
event: run.created
data: {...event JSON...}
```

**curl**:

```bash
curl -N \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Accept: text/event-stream" \
  http://127.0.0.1:8787/api/v1/events/stream
```

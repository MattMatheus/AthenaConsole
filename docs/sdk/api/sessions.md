<!-- AUDIENCE: Engineer/SDK -->

# Sessions

**Route family**: `sessions`

Sessions track the lifetime of a run. They contain the transcript (the back-and-forth between the LLM and tools) and artifacts produced by each run. Use the sessions API to inspect run history, retrieve transcripts, and stream live transcript entries.

---

## Endpoints

### `GET /api/v1/sessions`

List sessions (run history), sorted by `updatedAt` descending.

**Required role**: `Viewer`, `Operator`, or `Admin` (scoped: token holders can restrict to specific session IDs via `x-athena-scope-sessions`)  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Opaque pagination cursor from `nextCursor` |
| `limit` | integer | Page size (default 50, max 500) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "s1",
        "updatedAt": "2026-06-15T12:00:00.000Z",
        "createdAt": "2026-06-15T11:00:00.000Z"
      }
    ],
    "nextCursor": "eyJraW5kIjoic2Vzc2lvbnMiLCJ1cGRhdGVkQXQiOiIyMDI2LTA2LTE1VDEyOjAwOjAwLjAwMFoiLCJpZCI6InMxIn0"
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/sessions
```

---

### `GET /api/v1/sessions/search`

Search sessions by query terms.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `q` | string | Search query |
| `limit` | integer | Max results |

**Response** (`200`): `{ items: [...], total: N }`

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  "http://127.0.0.1:8787/api/v1/sessions/search?q=ci+failures"
```

---

### `GET /api/v1/sessions/:sessionId/transcript`

Get the transcript for a session. Returns all entries or a windowed subset.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `sessionId`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `after` | string | Cursor — return entries after this entry ID |
| `limit` | integer | Max entries (default 50, max 500) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "entry-001",
        "role": "assistant",
        "content": "Analyzing CI log...",
        "createdAt": "2026-06-15T11:01:00.000Z"
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
  http://127.0.0.1:8787/api/v1/sessions/s1/transcript
```

---

### `GET /api/v1/sessions/:sessionId/transcript/stream`

Stream transcript entries as Server-Sent Events. Sends `transcript.entry` events and heartbeats every 15 seconds.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `sessionId`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `after` | string | Start streaming after this entry ID |
| `limit` | integer | Initial fetch limit |

Also accepts `Last-Event-ID` request header (standard SSE resumption).

**Response**: `text/event-stream`

Each event:

```
id: entry-001
event: transcript.entry
data: {"ok":true,"data":{...entry...}}
```

**curl**:

```bash
curl -N \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Accept: text/event-stream" \
  http://127.0.0.1:8787/api/v1/sessions/s1/transcript/stream
```

---

### `GET /api/v1/sessions/:sessionId/artifacts`

List artifacts produced across all runs of this session.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `sessionId`

**Response** (`200`): `{ items: [artifact summary, ...] }`

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/sessions/s1/artifacts
```

---

### `GET /api/v1/sessions/:sessionId/artifacts/:runId/:artifactId`

Get a specific artifact.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `sessionId`, `runId`, `artifactId`

**Response** (`200`): Full artifact record including content.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/sessions/s1/artifacts/run-001/artifact-001
```

---

### `GET /api/v1/sessions/:sessionId/work-queue`

Get the work queue status for a session. Used for diagnosing stuck or compatibility runs.

**Required role**: `Operator` or `Admin` (delegates to `work.status` operation)  
**Path params**: `sessionId`

**Response** (`200`): Work queue status snapshot for the session.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/sessions/s1/work-queue
```

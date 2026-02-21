# API v1 Request/Response Examples

This page documents example request and success response payloads for the full `/api/v1` surface.

## Envelope Conventions

Success envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "CONFIG_ERROR",
    "message": "Human-readable message",
    "retryable": false,
    "traceId": "optional-trace-id"
  }
}
```

## Routes

### 1. `GET /api/v1/capabilities`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "executionBackend": "local",
    "stateStore": "file",
    "supportsPods": false,
    "supportsCpuMemMetrics": false,
    "supportsA2ABus": false
  }
}
```

### 2. `GET /api/v1/admin/health`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "now": "2026-02-16T15:00:00.000Z"
  }
}
```

### 3. `POST /api/v1/runs`

Request:

```json
{
  "sessionId": "s1",
  "input": "hello",
  "provider": "mock",
  "model": "default"
}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "sessionId": "s1",
    "output": "Echo: user: hello",
    "provider": "mock",
    "model": "default",
    "createdAt": "2026-02-16T15:00:00.000Z"
  }
}
```

### 4. `GET /api/v1/runs/active?cursor=<cursor>&limit=<n>&sessionId=<id>&runId=<id>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "sessionId": "s1",
        "pid": 12345,
        "startedAt": "2026-02-16T15:00:00.000Z",
        "runId": "run_123",
        "traceId": "trace_123"
      }
    ],
    "nextCursor": "eyJraW5kIjoiYWN0aXZlIn0"
  }
}
```

### 5. `GET /api/v1/runs/cancel-requests?cursor=<cursor>&limit=<n>&sessionId=<id>&runId=<id>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "sessionId": "s1",
        "requestedAt": "2026-02-16T15:01:00.000Z",
        "reason": "operator cancel",
        "runId": "run_123",
        "traceId": "trace_123",
        "startedAt": "2026-02-16T15:00:00.000Z"
      }
    ],
    "nextCursor": "eyJraW5kIjoiY2FuY2VsIn0"
  }
}
```

### 6. `POST /api/v1/runs/:sessionId/cancel`

Request:

```json
{
  "reason": "operator cancel"
}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "sessionId": "s1",
    "status": "not-running"
  }
}
```

### 7. `GET /api/v1/sessions?cursor=<cursor>&limit=<n>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "s1",
        "transcriptPath": ".athena/transcripts/s1.jsonl",
        "provider": "mock",
        "model": "default",
        "createdAt": "2026-02-16T15:00:00.000Z",
        "updatedAt": "2026-02-16T15:00:01.000Z"
      }
    ],
    "nextCursor": "MQ"
  }
}
```

### 6. `GET /api/v1/sessions/:id/transcript?after=<cursor>&limit=<n>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "entry-1",
        "role": "user",
        "content": "hello",
        "createdAt": "2026-02-16T15:00:00.000Z"
      }
    ]
  }
}
```

### 7. `GET /api/v1/sessions/:id/work-queue`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "schemaVersion": 1,
    "sessionId": "s1",
    "items": [],
    "draining": false,
    "updatedAt": "2026-02-16T15:00:00.000Z"
  }
}
```

### 8. `GET /api/v1/memory/search?query=<text>&maxResults=<n>&minScore=<n>`

Response (`200`):

```json
{
  "ok": true,
  "data": [
    {
      "id": "MEMORY.md:1",
      "sourcePath": "MEMORY.md",
      "snippet": "athena context",
      "score": 1,
      "lineStart": 1,
      "lineEnd": 1,
      "citation": "MEMORY.md#L1"
    }
  ]
}
```

### 9. `POST /api/v1/memory/get`

Request:

```json
{
  "path": "memory/notes.md",
  "from": 1,
  "lines": 20
}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "path": "memory/notes.md",
    "text": "line 1\nline 2",
    "lineStart": 1,
    "lineEnd": 2
  }
}
```

### 10. `POST /api/v1/work/enqueue`

Request:

```json
{
  "sessionId": "s1",
  "payload": "follow-up task",
  "mode": "followup"
}
```

Response (`200`): `WorkQueueState` envelope.

### 11. `POST /api/v1/work/:sessionId/drain`

Request:

```json
{
  "provider": "mock",
  "model": "default"
}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "drainedItems": 1,
    "queueDepthBefore": 1,
    "queueDepthAfter": 0
  }
}
```

### 12. `GET /api/v1/schedules?cursor=<cursor>&limit=<n>`

Response (`200`): paged `ScheduledTask[]` envelope (`items`, optional `nextCursor`).

### 13. `POST /api/v1/schedules`

Request:

```json
{
  "id": "job1",
  "sessionId": "s1",
  "input": "scheduled input",
  "everyMinutes": 5,
  "enabled": true,
  "startNow": false
}
```

Response (`200`): `ScheduledTask` envelope.

### 14. `PUT /api/v1/schedules/:id`

Request:

```json
{
  "sessionId": "s1",
  "input": "updated scheduled input",
  "everyMinutes": 10,
  "enabled": true,
  "startNow": false
}
```

Response (`200`): `ScheduledTask` envelope.

### 15. `DELETE /api/v1/schedules/:id`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "id": "job1",
    "removed": true
  }
}
```

### 16. `POST /api/v1/schedules/:id/run`

Request:

```json
{
  "provider": "mock",
  "model": "default"
}
```

Response (`200`): `ScheduleRunResult` envelope.

### 17. `POST /api/v1/schedules/tick`

Request:

```json
{
  "at": "2026-02-16T15:00:00.000Z",
  "provider": "mock",
  "model": "default"
}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "at": "2026-02-16T15:00:00.000Z",
    "run": [],
    "skipped": 0
  }
}
```

### 18. `POST /api/v1/schedules/:id/enable`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "id": "job1",
    "updated": true
  }
}
```

### 19. `POST /api/v1/schedules/:id/disable`

Response (`200`): same shape as enable.

### 20. `GET /api/v1/schedules/:id/logs?after=<cursor>&limit=<n>`

Response (`200`): `ScheduleRunLog[]` envelope.

### 21. `GET /api/v1/fleet/summary`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "total": 8,
    "running": 2,
    "pending": 1,
    "succeeded": 5,
    "failed": 0,
    "capabilities": {
      "supportsPodStatus": false,
      "supportsCpuMemMetrics": false
    }
  }
}
```

### 22. `GET /api/v1/events?cursor=<cursor>&limit=<n>&sessionId=<id>&types=<csv>&createdAfter=<iso>&createdBefore=<iso>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "events": [
      {
        "id": "evt_1",
        "traceId": "trace_1",
        "type": "run.created",
        "createdAt": "2026-02-16T15:00:00.000Z",
        "sessionId": "s1",
        "payload": {
          "provider": "mock",
          "model": "default"
        }
      }
    ],
    "nextCursor": "MQ"
  }
}
```

### 23. `GET /api/v1/events/stream`

Streaming response (`200`, `text/event-stream`), event frame example:

```text
id: evt_1
event: run.created
data: {"ok":true,"data":{"id":"evt_1","type":"run.created","traceId":"...","createdAt":"2026-02-16T15:00:00.000Z","payload":{"provider":"mock","model":"default"}}}
```

### 24. `GET /api/v1/policy`

Response (`200`):

```json
{
  "ok": true,
  "data": null
}
```

### 25. `GET /api/v1/policy/rejections?cursor=<cursor>&limit=<n>&sessionId=<id>&createdAfter=<iso>&createdBefore=<iso>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "rej_1",
        "createdAt": "2026-02-16T15:00:00.000Z",
        "sessionId": "s1",
        "activeRuns": 2,
        "maxConcurrentRuns": 2,
        "reason": "max-concurrent-runs-exceeded"
      }
    ],
    "nextCursor": "MQ"
  }
}
```

### 26. `PUT /api/v1/policy`

Request:

```json
{
  "schemaVersion": 1,
  "maxConcurrentRuns": 2,
  "defaultRunTimeoutMs": 10000,
  "defaultScheduleTimeoutMs": 20000,
  "retryBudgetPerRun": 3,
  "costBudgetDailyUsd": 25.5
}
```

Notes:
- `updatedAt` is server-authored on write.
- Client-provided `updatedAt` is accepted for backward compatibility but ignored.

Response (`200`): `PolicyDocument` envelope with server-authored `updatedAt`.

### 27. `POST /api/v1/personas/run`

Request:

```json
{
  "name": "code-review",
  "repoPath": ".",
  "headRef": "feature",
  "baseRef": "main",
  "stdout": "summary"
}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "result": {
      "schemaVersion": 1,
      "status": "ok",
      "personaName": "code-review",
      "runId": "persona-code-review-...",
      "sessionId": "session-code-review-..."
    },
    "stdout": "..."
  }
}
```

### 28. `GET /api/v1/a2a/dlq?cursor=<cursor>&limit=<n>&status=<pending|requeued|discarded>`

Response (`200`): `A2aDlqListResult` envelope.

### 29. `POST /api/v1/a2a/dlq/:id/requeue`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "updated": true,
    "item": {
      "id": "msg-1",
      "status": "requeued",
      "createdAt": "2026-02-16T15:00:00.000Z",
      "updatedAt": "2026-02-16T15:01:00.000Z",
      "payload": {}
    }
  }
}
```

### 30. `POST /api/v1/a2a/dlq/:id/discard`

Response (`200`): same shape as requeue with `status: "discarded"`.

### 31. `GET /api/v1/runs/active?cursor=<cursor>&limit=<n>&sessionId=<id>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "sessionId": "s1",
        "pid": 12345,
        "startedAt": "2026-02-17T12:00:00.000Z"
      }
    ],
    "nextCursor": "MQ"
  }
}
```

### 32. `GET /api/v1/runs/cancel-requests?cursor=<cursor>&limit=<n>&sessionId=<id>`

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "sessionId": "s1",
        "requestedAt": "2026-02-17T12:00:02.000Z",
        "reason": "operator cancel"
      }
    ],
    "nextCursor": "MQ"
  }
}
```

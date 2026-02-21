# API v1 Request/Response Examples

This page provides practical examples for the `/api/v1` API surface.

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

## 1. `POST /api/v1/runs`

Request:

```json
{
  "sessionId": "s1",
  "input": "Summarize latest build failures",
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
    "output": "Summary...",
    "provider": "mock",
    "model": "default",
    "runId": "run_2026_001",
    "evidenceCount": 1,
    "verificationStatus": "passed",
    "createdAt": "2026-02-20T15:00:00.000Z"
  }
}
```

Example with directive + harness profile:

```json
{
  "sessionId": "s1",
  "directiveId": "dir_triage",
  "harnessProfileId": "hp_ops_v1"
}
```

## 2. `GET /api/v1/runs/active?cursor=<cursor>&limit=<n>&sessionId=<id>&runId=<id>`

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "sessionId": "s1",
        "pid": 12345,
        "startedAt": "2026-02-20T15:00:00.000Z",
        "runId": "run_2026_001",
        "traceId": "trace_123"
      }
    ],
    "nextCursor": "eyJraW5kIjoiYWN0aXZlIn0"
  }
}
```

## 3. `POST /api/v1/run-control/by-run/:runId/cancel`

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
    "runId": "run_2026_001",
    "status": "cancelled",
    "sessionId": "s1"
  }
}
```

## 4. `GET /api/v1/directives`

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "dir_triage",
        "input": "Collect failures from latest CI run",
        "contextRefs": ["planning/archive/handoff.md"],
        "metadata": {
          "owner": "platform"
        },
        "createdAt": "2026-02-20T14:00:00.000Z"
      }
    ]
  }
}
```

## 5. `POST /api/v1/directives`

```json
{
  "input": "Create remediation plan",
  "contextRefs": ["TODO.md"],
  "metadata": {
    "priority": "high"
  }
}
```

## 6. `GET /api/v1/harness-profiles`

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "hp_ops_v1",
        "displayName": "Ops Profile",
        "version": "v1",
        "config": {
          "provider": "mock",
          "model": "default",
          "tools": ["shell", "memory"]
        },
        "policies": {
          "timeoutMs": 60000,
          "retryLimit": 2,
          "budgetUsd": 0
        },
        "verificationPolicies": [
          {
            "id": "require-text-evidence",
            "kind": "require-evidence",
            "label": "Require text evidence",
            "evidenceType": "text"
          }
        ],
        "createdAt": "2026-02-20T14:00:00.000Z"
      }
    ]
  }
}
```

## 7. `POST /api/v1/harness-profiles`

```json
{
  "displayName": "Ops Profile",
  "version": "v1",
  "config": {
    "provider": "mock",
    "model": "default",
    "tools": ["shell", "memory"]
  },
  "policies": {
    "timeoutMs": 60000,
    "retryLimit": 2,
    "budgetUsd": 0
  },
  "verificationPolicies": [
    {
      "id": "require-text-evidence",
      "kind": "require-evidence",
      "label": "Require text evidence",
      "evidenceType": "text"
    }
  ]
}
```

## 8. `POST /api/v1/workflows`

```json
{
  "definition": {
    "steps": [
      {
        "id": "collect",
        "directiveId": "dir_triage",
        "harnessProfileId": "hp_ops_v1"
      },
      {
        "id": "remediate",
        "directiveId": "dir_remediate",
        "harnessProfileId": "hp_ops_v1"
      }
    ],
    "dependencies": [
      {
        "from": "collect",
        "to": "remediate"
      }
    ]
  }
}
```

## 9. `GET /api/v1/workflows/run/:id`

```json
{
  "ok": true,
  "data": {
    "workflow": {
      "id": "wf_release_ops",
      "definition": {
        "steps": [],
        "dependencies": []
      },
      "createdAt": "2026-02-20T14:00:00.000Z"
    },
    "run": {
      "schemaVersion": 1,
      "id": "wf_run_001",
      "workflowId": "wf_release_ops",
      "status": "running",
      "stepOrder": ["collect", "remediate"],
      "stepStates": {},
      "executionLog": [],
      "createdAt": "2026-02-20T14:01:00.000Z",
      "updatedAt": "2026-02-20T14:01:05.000Z"
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
    "artifactRefs": [],
    "eta": {
      "computedAt": "2026-02-20T14:01:05.000Z",
      "source": "historical-average",
      "historicalSampleSize": 5,
      "estimatedRemainingMs": 10000
    }
  }
}
```

## 10. `POST /api/v1/workflows/run/:id/resume`

```json
{}
```

Response (`200`): `WorkflowRun` envelope.

## 11. `GET /api/v1/schedules`

Response (`200`): paginated `ScheduledTask` items (`items`, optional `nextCursor`).

## 12. `PUT /api/v1/policy`

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

- `updatedAt` is server-authored and ignored when provided by clients.

## 13. `GET /api/v1/policy/rejections`

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "rej_1",
        "createdAt": "2026-02-20T15:02:00.000Z",
        "sessionId": "s1",
        "activeRuns": 2,
        "maxConcurrentRuns": 2,
        "reason": "max-concurrent-runs-exceeded"
      }
    ]
  }
}
```

## 14. `GET /api/v1/events`

```json
{
  "ok": true,
  "data": {
    "events": [
      {
        "id": "evt_1",
        "traceId": "trace_1",
        "type": "sandbox.lifecycle",
        "runId": "run_2026_001",
        "createdAt": "2026-02-20T15:00:00.000Z",
        "payload": {},
        "sandbox": {
          "schemaVersion": 1,
          "backend": "agent-sandbox",
          "phase": "ready"
        }
      }
    ]
  }
}
```

## 15. `GET /api/v1/capabilities`

```json
{
  "ok": true,
  "data": {
    "executionBackend": "local",
    "stateStore": "file",
    "supportsPods": false,
    "supportsCpuMemMetrics": false,
    "supportsSandbox": false,
    "supportsA2ABus": true
  }
}
```

## 16. `GET /api/v1/a2a/dlq`

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "dlq_msg_001",
        "sourcePersona": "software-architect",
        "targetPersona": "code-review",
        "payload": {
          "repo": "athena",
          "head": "feat-new-api"
        },
        "error": "Timeout connecting to code-review runner",
        "retryCount": 2,
        "createdAt": "2026-02-20T16:00:00.000Z"
      }
    ]
  }
}
```

## 17. `POST /api/v1/a2a/dlq/:id/requeue`

```json
{}
```

Response (`200`):

```json
{
  "ok": true,
  "data": {
    "id": "dlq_msg_001",
    "status": "requeued"
  }
}
```


# Workflow Queue Recovery

Use the workflow queue when a run is not making progress or a worker heartbeat is stale.

## Signals

- `pending`: a workflow step is ready to run.
- `running`: a step has an active task run and a live worker heartbeat.
- `retryable`: a failed step still has retry attempts allowed by its retry policy.
- `stuck`: a running step has no live worker heartbeat, no running task run, or an expired heartbeat.

## Recovery Path

1. Open Console -> Queue and identify stuck records.
2. Open the linked task run when present and inspect recent run events.
3. If the worker process is gone, restart the worker or runtime host.
4. If the task run is still active but abandoned, cancel it from the task run detail or API.
5. Retry only records marked retryable, or resume the workflow run after the failed/stale step is recovered.

Stuck detection is based on durable worker heartbeat expiry, so recovery should preserve run evidence rather than deleting rows.

## API Checks

```bash
curl http://127.0.0.1:8787/api/v1/workflow-queue/status
curl http://127.0.0.1:8787/api/v1/workflow-runs/<run-id>/status
curl -X POST http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>/cancel \\
  -H 'content-type: application/json' \\
  -d '{"reason":"stale worker recovery"}'
```

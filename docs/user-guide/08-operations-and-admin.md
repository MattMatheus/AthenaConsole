<!-- AUDIENCE: Admin/Enterprise -->

# Operations and Admin

This page covers day-to-day platform administration: health and readiness monitoring, plugin management, events, artifacts, evidence, approvals, limits, backup/restore, and workflow queue recovery.

---

## Health and Readiness

### Health Check

```bash
curl http://127.0.0.1:8787/api/v1/health
```

Returns `ok: true` when the API process is running. Use this for container liveness probes.

### Readiness Check

```bash
curl http://127.0.0.1:8787/api/v1/readiness
```

Returns a status of `ready` or `degraded` with per-check details. Each check includes a `nextStep` field when degraded.

Common readiness checks:

| Check | Description |
|-------|-------------|
| `plugin-path` | Plugin discovery path is configured and accessible |
| `first-run-demo` | First-run demo plugin is discoverable |
| `app-state` | App-state directory is writable |
| `provider` | Required model providers are configured and reachable |

A degraded status is not always fatal — read each check's `nextStep` before treating it as a blocking error.

---

## Plugin Management

Plugins are discovered automatically from configured plugin paths on startup. There is no runtime hot-reload; restart the API after adding or changing plugin files.

### Validate Manifests

Before restarting the API, validate all plugin and agent manifests:

```bash
npm --workspace @athena/core run validate:manifests
```

Fix all reported errors before restarting to avoid partial-load surprises.

### Plugin Diagnostics in the Console

Open **Capabilities** in the console to see plugin load status, validation diagnostics, and agent readiness. If an agent does not appear in Start Work, the Capabilities page usually explains why.

---

## Events

Events are structured records emitted during execution. They support after-the-fact inspection and audit.

List recent events:

```bash
curl http://127.0.0.1:8787/api/v1/events
```

Events are retained according to:

| Variable | Default |
|----------|---------|
| `ATHENA_EVENTS_MAX_RECORDS` | 10,000 |
| `ATHENA_EVENT_RETENTION_DAYS` | 30 |
| `ATHENA_EVENT_MAX_BYTES` | 5MB |

When the ledger exceeds these limits, older events are pruned.

---

## Artifacts

Artifacts are outputs worth inspecting: markdown reports, model responses, evidence records, transcripts, and proposed changes.

### Artifact Metadata vs. Payload

SQLite stores artifact metadata. Payloads may be:

- in-memory (only accessible during the run),
- file-backed (accessible by path),
- externally referenced (storage URI points outside the server).

Not all storage URI types are accessible through the artifact payload endpoint. Check the `storageUri` field to understand where the payload lives.

### Artifact APIs

```bash
# List task run artifacts
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>

# Fetch artifact payload (when available)
curl http://127.0.0.1:8787/api/v1/task-runs/<task-run-id>/artifacts/<artifact-id>
```

---

## Evidence and Verification

Runs that use `verificationPolicies` in their harness profile produce verification status and evidence records.

Current supported policy kind: `require-evidence` — requires at least one non-empty evidence record of a target type (`text`, `json`, or `binary`).

Run result fields:

- `evidenceCount` — number of evidence records produced
- `verificationStatus` — `passed` or `verification-failed`
- `verificationFailures` — policy-level diagnostics explaining why verification failed

---

## Approvals and Safety Limits

Safety controls keep automation bounded. Current controls in the runtime:

- **Permissions declared in manifests** — agent manifests declare what the agent is allowed to do.
- **Runtime policy packs** — policy applied at execution time (configured by Admin).
- **Max runtime and retry limits** — runs are stopped if they exceed time or retry counts.
- **Max tool-call and repeated-action limits** — bounded agent loops.
- **Approval records** — some actions require explicit approval before proceeding.
- **Read-only and proposed-change modes** — repo-affecting work can be gated to propose-only.

Update runtime policy (Admin only):

```bash
curl -X PUT http://127.0.0.1:8787/api/v1/policy \
  -H "content-type: application/json" \
  -d '{"maxConcurrentRuns": 4}'
```

View current policy:

```bash
curl http://127.0.0.1:8787/api/v1/policy
```

View concurrency rejections:

```bash
curl http://127.0.0.1:8787/api/v1/policy/rejections
```

---

## Failed Work Recovery

When a task or workflow fails in a recoverable way, Team Orchestrator records it as a failed work item so operators can inspect, retry, or discard it.

```bash
# List failed work items
curl http://127.0.0.1:8787/api/v1/failed-work

# Retry a failed item
curl -X POST http://127.0.0.1:8787/api/v1/failed-work/<id>/retry

# Discard a failed item (with audit note)
curl -X POST http://127.0.0.1:8787/api/v1/failed-work/<id>/discard \
  -H "content-type: application/json" \
  -d '{"note": "Discarding stale failure from interrupted deployment"}'
```

Failed work is also visible and manageable from the console under **Advanced Work**.

---

## Backup and Restore

See [Backup Restore Smoke](../developer/product-dev-guides/backup-restore-smoke.md) for the backup and restore procedure and smoke test.

---

## Workflow Queue Recovery

If workflow DAG runs are left in a partial or stalled state after an API restart, see [Workflow Queue Recovery](../developer/product-dev-guides/workflow-queue-recovery.md) for the recovery procedure.

---

## Schedules

Create a recurring schedule (Operator or Admin):

```bash
curl -X POST http://127.0.0.1:8787/api/v1/schedules \
  -H "content-type: application/json" \
  -d '{
    "id": "daily-review",
    "cronExpression": "0 8 * * *",
    "agentId": "code.review.local",
    "inputs": {"repo": {"path": "."}, "baseRef": "main", "headRef": "HEAD"}
  }'
```

Schedules run as the configured system identity. Ensure the schedule's agent and provider are configured before enabling.

---

## Product Smoke Suite

Use the smoke suite for a fast pass/fail check before handing the product to a reviewer:

```bash
npm run smoke:product
```

See [Running Work](05-running-work.md) for the full smoke walkthrough.

---

## Next Steps

- [Troubleshooting](09-troubleshooting.md) — common failures and how to diagnose them
- [Roles and RBAC](04-roles-and-rbac.md) — gating admin operations
- [Cost Governance](07-cost-governance.md) — monitoring provider usage

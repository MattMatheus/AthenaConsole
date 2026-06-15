<!-- AUDIENCE: Operator -->

# Troubleshooting

Common failures and how to diagnose them.

---

## API Will Not Start

Check:

- Node.js is version 20 or newer.
- Dependencies were installed with `npm install`.
- Another process is not already using the API port.
- `ATHENA_WORKSPACE_ROOT` points at the repo root when running the API directly.

Start the API directly:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

---

## Console Cannot Reach API

Check:

- API is running at `http://127.0.0.1:8787`.
- Compose started both API and console containers.
- The console dev server proxies `/api/*` to the API container in the local stack.

Verify the API is responding:

```bash
curl http://127.0.0.1:8787/api/v1/health
```

---

## Readiness Is Degraded

```bash
curl http://127.0.0.1:8787/api/v1/readiness
```

Read each check's `nextStep`. Common causes:

- no plugin path is configured,
- sample demo plugin is missing,
- app-state path is not writable,
- a model provider required by an agent is not configured,
- an optional provider check is unavailable.

A degraded status is not always fatal. Optional checks (such as a provider that is not needed for the first-run demo) can be degraded without blocking the demo workflow.

---

## Agent Does Not Appear

Check:

- `plugin.yaml` points at the agent manifest path.
- `plugin.agents[].id` matches `agent.id`.
- Plugin id/version is unique.
- Agent id/version is unique.
- The API was restarted after changing files.
- `ATHENA_PLUGIN_PATHS` includes the plugin parent directory.

Validate manifests:

```bash
npm --workspace @athena/core run validate:manifests
```

Check plugin diagnostics in the console Capabilities page. Validation errors appear there before they become silent load failures.

---

## Provider-Backed Agent Is Blocked

Check:

- Provider exists in Settings.
- Provider kind matches the agent requirement.
- Secret name is correct.
- Environment variable is available to the API process.
- Azure Foundry users ran `az login` when using Entra ID.

Readiness and create-work surfaces explain missing provider requirements before execution. A blocked agent should show a provider requirement diagnostic rather than failing silently.

---

## Workflow Template Is Missing

Check:

- Plugin package loaded successfully (check Capabilities page for errors).
- Workflow template file exists in the plugin.
- Plugin validation has no blocking errors.
- Requested `pluginId` and workflow id are correct.

List all available templates:

```bash
curl "http://127.0.0.1:8787/api/v1/workflow-templates"
```

---

## Run Fails

Open the run detail and inspect:

- terminal status,
- error message,
- events,
- resolved backend,
- safety limits,
- artifact metadata,
- agent output.

Common causes include invalid inputs, missing provider configuration, plugin runner errors, exceeded runtime limits, or unsupported artifact payload access.

---

## Artifact Metadata Exists But Preview Fails

Artifact metadata and artifact payloads are separate. Metadata can exist even when the payload is in memory, file-backed, unsupported, or intentionally unavailable through the API.

Check:

- `storageUri` field on the artifact record,
- artifact format,
- whether the route supports that storage type,
- whether the payload path is inside an allowed artifact root.

Memory-backed artifacts (storage URIs starting with `memory://`) are only accessible during the run. They will not be available after the API restarts.

---

## Concurrency Rejection

If runs are rejected with a concurrency error:

```bash
curl http://127.0.0.1:8787/api/v1/policy/rejections
```

The current `maxConcurrentRuns` policy may be too low for your workload. Update it (Admin only):

```bash
curl -X PUT http://127.0.0.1:8787/api/v1/policy \
  -H "content-type: application/json" \
  -d '{"maxConcurrentRuns": 8}'
```

---

## Stalled Workflow Run

If a workflow run is stuck in `running` after an API restart, use the failed work recovery path:

```bash
curl http://127.0.0.1:8787/api/v1/failed-work
```

Or see [Workflow Queue Recovery](../developer/product-dev-guides/workflow-queue-recovery.md) for the full procedure.

---

## Manifest Validation Errors

Always validate before restarting:

```bash
npm --workspace @athena/core run validate:manifests
```

Common causes:

- Missing required fields (`id`, `version`, `name`).
- Agent `id` in the plugin manifest does not match the agent manifest's `agent.id`.
- Duplicate id/version combinations across plugins.
- Invalid `implementation.type` value.
- Input schema mismatch between task creation and agent manifest.

---

## Next Steps

- [Operations and Admin](08-operations-and-admin.md) — failed work recovery, policy management
- [Running Work](05-running-work.md) — first-run demo as a baseline check
- [Install and Deploy](02-install-and-deploy.md) — environment variable reference

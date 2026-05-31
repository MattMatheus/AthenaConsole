<!-- AUDIENCE: Internal/Technical -->

# CLI Reference

This document provides a reference for the various commands available in the `athena` CLI.

## General Usage

```bash
npm run athena -- <command> [options]
```

## Running a Session

```bash
npm run athena -- run --session <session_id> --input "<your_input>"
```

## Agent Scaffolding

Create a local plugin-backed agent in the default `.athena/plugins/` search path:

```bash
npm run athena -- agent scaffold --name "Research Planner"
```

Use explicit ids or a different plugin directory when needed:

```bash
npm run athena -- agent scaffold --name "Research Planner" --plugins-dir plugins --plugin-id local.research-planner --agent-id local.research-planner.agent
```

The command generates `plugin.yaml`, an agent manifest, a local runner, and plugin README, then validates the generated plugin package before exiting.

## Agent Samples

Current agent examples are plugin-backed and run through tasks. For a local code-review example, create a task assigned to `code.review.local` from `sample-plugins/code-review` and run it through the API or console.

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{"id":"task-code-review","title":"Review current branch","status":"ready","capabilityRequirements":["code.review"],"assignedAgentId":"code.review.local","assignedAgentVersion":"0.1.0","inputs":{"repo":{"path":"."},"baseRef":"main","headRef":"HEAD"}}'

curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-code-review/run \
  -H "content-type: application/json" \
  -d '{}'
```

## Advanced Runtime Diagnostics

Work queue commands are retained as advanced diagnostics for session-backed compatibility runs. Current operator work should use plugin agents, tasks, missions, and workflow templates.

```bash
npm run athena -- work enqueue --session <session_id> --input "<task_description>" --mode <mode>
npm run athena -- work status --session <session_id>
npm run athena -- work drain --session <session_id>
```

Memory commands are retained for local context debugging when memory indexing is enabled:

```bash
npm run athena -- memory search --query "<text>"
npm run athena -- memory get --path MEMORY.md --from 1 --lines 20
```

## Schedule Management

### Add a Schedule
```bash
npm run athena -- schedule add --id <id> --session <session_id> --input "<input>" --every-minutes <minutes> --start-now <true|false>
```

### List Schedules
```bash
npm run athena -- schedule list
```

### Run a Schedule Immediately
```bash
npm run athena -- schedule run --id <id>
```

### Trigger Due Schedules
```bash
npm run athena -- schedule tick
```

### Inspect Schedule Logs
```bash
npm run athena -- schedule logs --id <id> --limit <limit>
```

## Provider Configuration

Configuration can be set via environment variables:

```bash
# choose primary provider
export ATHENA_DEFAULT_PROVIDER=local-exec
export ATHENA_DEFAULT_MODEL=local-model

# local provider command + args
export ATHENA_LOCAL_PROVIDER_CMD=/bin/echo
export ATHENA_LOCAL_PROVIDER_ARGS=prefix

# fallback order (comma-separated provider IDs)
export ATHENA_PROVIDER_FALLBACK_ORDER=mock
```

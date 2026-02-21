<!-- AUDIENCE: Internal/Technical -->

# General Usage Guides

This document covers common Athena workflows and how state/artifacts are persisted.

## Core Concepts

### Workspace And State Directory

- Athena runs relative to the workspace root and persists state under `.athena/` by default.
- Override the state directory with `ATHENA_STATE_DIR`.

Key locations (default):

- Sessions: `.athena/sessions/<session>.json`
- Transcripts: `.athena/transcripts/<session>.jsonl`
- Work queues: `.athena/work/queues/<session>.json`
- Schedules: `.athena/schedule/tasks.json` and `.athena/schedule/logs/<id>.jsonl`
- Persona runs: `.athena/persona-runs/<runId>/result.json` and `.athena/persona-runs/<runId>/report.md`
- Runtime cancellation state: `.athena/runtime/active/<session>.json` and `.athena/runtime/cancel/<session>.json`

### Sessions

Sessions are the durable unit of conversational state.

- Create/update via `athena run --session <id> --input <text>`.
- Use stable session ids per workflow or project area.
- Cancel an active run: `athena cancel --session <id> [--reason <text>]`.

### Providers And Models

Providers are the execution backends for the runtime.

- Select per run with `--provider` and `--model`.
- Configure defaults and fallbacks with environment variables.

Common env vars:

- `ATHENA_DEFAULT_PROVIDER`
- `ATHENA_DEFAULT_MODEL`
- `ATHENA_PROVIDER_FALLBACK_ORDER`

### Personas

Personas are repo-local agent definitions under `personas/` and are executed through the same runtime.

- Run: `athena persona run --name <persona> --repo <path> --head <branch> ...`
- Artifacts: always persisted to `.athena/persona-runs/<runId>/`

### Work Queues

Work queues persist follow-up tasks per session and can be drained through the runtime.

- Enqueue: `athena work enqueue --session <id> --input <text> --mode followup|collect`
- Drain: `athena work drain --session <id>`
- Inspect: `athena work status --session <id>`

### Scheduling

Schedules persist task definitions and execute through the same runtime pipeline as manual runs.

- Add: `athena schedule add --id <id> --session <id> --input <text> --every-minutes <n>`
- Run: `athena schedule run --id <id>`
- Tick due: `athena schedule tick`
- Logs: `athena schedule logs --id <id>`

### API Server

Athena now includes a local admin API bootstrap path for control-plane integration work.

- Start server: `athena api serve [--host 127.0.0.1] [--port 8787]`
- Write machine-readable API contract artifact: `athena api contracts [--out <path>]`
  - artifact format: OpenAPI-style JSON (`schemaVersion: 2`, `openapi: 3.1.0`)
- API prefix: `/api/v1`
- Response envelope conventions:
  - success: `{ "ok": true, "data": ... }`
  - error: `{ "ok": false, "error": { "code": "...", "message": "...", "retryable": false, "traceId": "..." } }`
- API response validation:
  - server validates response payload schemas for all non-stream v1 routes before writing response bodies
  - SSE event payloads are schema-validated before emission
- Correlation id:
  - each API response includes `x-trace-id` header
- Event stream:
  - `GET /api/v1/events`
  - `GET /api/v1/events/stream`
  - supports `Last-Event-ID` header resume behavior in local mode
  - optional event query filters:
    - `cursor`, `limit`, `sessionId`, `types`, `createdAfter`, `createdBefore`
- A2A DLQ endpoints (local-mode foundation):
  - `GET /api/v1/a2a/dlq`
  - `POST /api/v1/a2a/dlq/:id/requeue`
  - `POST /api/v1/a2a/dlq/:id/discard`
- Memory endpoints:
  - `GET /api/v1/memory/search`
  - `POST /api/v1/memory/get`
- Persona endpoint:
  - `POST /api/v1/personas/run`
- Request/response examples for all v1 routes:
  - `docs/getting-started/api-v1-examples.md`

### Memory

When enabled, the runtime can inject bounded memory snippets into context.

- Search: `athena memory search --query <text>`
- Get: `athena memory get --path <workspace-relative-path>`
- API transport: add `--transport api --api-base-url <url>` to route through `/api/v1`.

Memory configuration is controlled via env vars and the config loader.

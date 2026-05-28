# The Athena API Server

Project Athena uses an API-first control plane. The REST API (`/api/v1`) is the canonical surface for orchestration, and the CLI can call the same services.

## Running the API Server

```bash
npm run athena -- api serve
```

By default, Athena listens on `127.0.0.1:8787`.

## CLI Transport Modes

- `api`: always call a running HTTP API server.
- `local`: run control-plane services in-process.
- `auto`: try API first, fall back to local.

## API Security Modes

For local-only development, keep the API bound to `127.0.0.1`. If you intentionally bind the API to `0.0.0.0`
without auth, set `ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true`; this is a local development escape hatch only.

For production-like or LAN-accessible runs, enable server-side token auth:

- `ATHENA_AUTH_ENABLED=true`
- `ATHENA_AUTH_API_TOKEN=<secret value with at least 16 characters>`
- `ATHENA_AUTHZ_MODE=enforce`
- `ATHENA_AUTHZ_DEFAULT_DECISION=deny`
- `ATHENA_AUTH_IDENTITY_ROLE_MAP=console:Admin,*:Viewer`

When the API is bound externally, startup is refused unless token auth is configured or the explicit local-dev
override is set.

Clients must send:

- `Authorization: Bearer <ATHENA_AUTH_API_TOKEN>`
- the configured identity header, defaulting to `x-athena-identity`

## Authentication and RBAC (Trusted Header Mode)

Athena supports trusted-header identity extraction for API requests. In production-like modes, pair this with
`ATHENA_AUTH_API_TOKEN`; identity headers alone are only appropriate behind a trusted proxy or on loopback.

Required configuration:

- `ATHENA_AUTH_ENABLED=true`
- `ATHENA_AUTH_API_TOKEN` for production-like or externally reachable modes
- `ATHENA_AUTH_IDENTITY_HEADER` (default: `x-athena-identity`)
- `ATHENA_AUTH_DEFAULT_ROLE` (`Viewer`, `Operator`, `Admin`)
- `ATHENA_AUTH_IDENTITY_ROLE_MAP` (for example: `alice:Admin,bob:Operator,*:Viewer`)

Behavior:

- If auth is enabled and the configured identity header is missing, Athena returns `AUTH_IDENTITY_MISSING`.
- If `ATHENA_AUTH_API_TOKEN` is configured and the bearer token is missing or invalid, Athena returns `AUTH_TOKEN_MISSING` or `AUTH_TOKEN_INVALID`.
- Service-layer authorization returns `AUTHZ_DENIED` on forbidden operations.
- Current enforced write controls are on policy update, run cancellation, and schedule mutations.

## API Endpoint Groups

### Core and Health

- `GET /api/v1/capabilities`
- `GET /api/v1/admin/health`

### Runs and Sessions

- `POST /api/v1/runs`
- `GET /api/v1/runs/active`
- `GET /api/v1/runs/cancel-requests`
- `POST /api/v1/run-control/by-run/:runId/cancel` (preferred)
- `POST /api/v1/runs/:sessionId/cancel` (deprecated compatibility path)
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId/transcript`
- `GET /api/v1/sessions/:sessionId/work-queue`

### Directives and Harness Profiles

- `GET /api/v1/directives`
- `POST /api/v1/directives`
- `GET /api/v1/harness-profiles`
- `POST /api/v1/harness-profiles`

These endpoints support the decoupled execution model:

- A **Directive** describes task input and optional context references.
- A **Harness Profile** defines provider/model/tools/policies and optional verification policies.
- `POST /api/v1/runs` can reference one or both with `directiveId` and `harnessProfileId`.

### Run Templates

- `GET /api/v1/run-templates`
- `POST /api/v1/run-templates`
- `POST /api/v1/templates/:id/run`

### Workflows (DAG)

- `GET /api/v1/workflows`
- `POST /api/v1/workflows`
- `GET /api/v1/workflows/run/:id`
- `POST /api/v1/workflows/run/:id/resume`

### Work and Memory

- `POST /api/v1/work/enqueue`
- `POST /api/v1/work/:sessionId/drain`
- `GET /api/v1/memory/search`
- `POST /api/v1/memory/get`

### Scheduling

- `GET /api/v1/schedules`
- `POST /api/v1/schedules`
- `PUT /api/v1/schedules/:id`
- `DELETE /api/v1/schedules/:id`
- `POST /api/v1/schedules/:id/run`
- `POST /api/v1/schedules/:id/enable`
- `POST /api/v1/schedules/:id/disable`
- `GET /api/v1/schedules/:id/logs`
- `POST /api/v1/schedules/tick`

### Policy, Fleet, and Events

- `GET /api/v1/policy`
- `PUT /api/v1/policy`
- `GET /api/v1/policy/rejections`
- `GET /api/v1/fleet/summary`
- `GET /api/v1/events`
- `GET /api/v1/events/stream`

### Persona and A2A DLQ

- `POST /api/v1/personas/run`
- `GET /api/v1/a2a/dlq`
- `POST /api/v1/a2a/dlq/:id/requeue`
- `POST /api/v1/a2a/dlq/:id/discard`

## Run Response Notes (v1)

`POST /api/v1/runs` responses can include:

- `runId`
- `directiveId`
- `harnessProfileId`
- `harnessProfileSnapshot`
- `evidenceCount`
- `verificationStatus` (`passed` or `verification-failed`)
- `verificationFailures` when verification fails

## Pagination Convention

Cursor-page routes use:

- `cursor` (optional, opaque)
- `limit` (optional, default `50`, clamped to `1..500`)

Paginated responses return `data.items` and optional `data.nextCursor`.

## Example

```bash
curl http://127.0.0.1:8787/api/v1/capabilities
```

With token auth enabled:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: console" \
  http://127.0.0.1:8787/api/v1/capabilities
```

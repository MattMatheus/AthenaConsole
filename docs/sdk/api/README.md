<!-- AUDIENCE: Engineer/SDK -->

# HTTP Control-Plane API Reference

Team Orchestrator exposes a REST API for operators and integrators to create and manage work primitives,
inspect run history, configure providers and repositories, manage workspaces, and query cost and audit records.

**Base path**: `/api/v1`  
**Default listen address**: `http://127.0.0.1:8787`

---

## Authentication

The API supports three auth configurations — choose based on your deployment profile.

### No auth (local development only)

No headers required. The server must be bound to `127.0.0.1`.

### Token + identity (recommended for externally reachable deployments)

Send two headers on every request:

```
Authorization: Bearer $ATHENA_AUTH_API_TOKEN
x-athena-identity: <subject-name>
```

The identity header name is configurable via `ATHENA_AUTH_IDENTITY_HEADER` (default: `x-athena-identity`).
The token must match the `ATHENA_AUTH_API_TOKEN` server-side value.

Relevant error codes when auth is misconfigured:

| Code | Meaning |
| --- | --- |
| `AUTH_TOKEN_MISSING` | `Authorization: Bearer` header is absent |
| `AUTH_TOKEN_INVALID` | Token does not match the server's configured value |
| `AUTH_IDENTITY_MISSING` | Identity header is absent |
| `AUTHZ_DENIED` | Caller's role does not meet the required role for the operation |

### Scope headers (client-asserted)

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

The following optional request headers allow a client token to narrow its own scope.
These are not security boundaries — they are self-imposed restrictions used by
embedded clients (e.g. CLI harnesses, agent runners) to limit which resources they can touch.

| Header | Purpose |
| --- | --- |
| `x-athena-scope-workspaces` | Comma-separated workspace IDs to restrict to |
| `x-athena-scope-agents` | Comma-separated agent names to restrict to |
| `x-athena-scope-sessions` | Comma-separated session IDs to restrict to |
| `x-athena-scope-runs` | Comma-separated run IDs to restrict to |
| `x-athena-scope-global` | `true` to assert global (unrestricted) scope |

**Reference**: `packages/core/src/api/middleware/auth.ts:77`

---

## RBAC Roles

Three roles are defined. Each endpoint in this reference lists the minimum role required.

| Role | Description |
| --- | --- |
| `Viewer` | Read-only access to work primitives, run history, sessions, events, memory |
| `Operator` | All Viewer permissions + create/update/cancel work, manage schedules, directives |
| `Admin` | All Operator permissions + workspace CRUD, provider config, RBAC assignments, policy mutations, governance audit |

Role assignment is configured via `ATHENA_AUTH_IDENTITY_ROLE_MAP` (e.g. `alice:Admin,bob:Operator,*:Viewer`).

**Reference**: `packages/core/src/control-plane/identity-store.ts:19` (`VALID_ROLES`)

---

## Pagination

Paginated list endpoints accept these query parameters:

| Parameter | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `cursor` | string | — | — | Opaque cursor from a previous response's `data.nextCursor` |
| `limit` | integer | 50 | 500 | Page size |

Paginated responses have this shape inside the `data` envelope:

```json
{
  "items": [...],
  "nextCursor": "<opaque-string>"
}
```

`nextCursor` is absent when there are no further pages.

Tail/transcript endpoints accept `after` (opaque cursor) instead of `cursor`.

**Reference**: `packages/core/src/control-plane/api-contracts.ts:245`

---

## Response Envelope

All endpoints return JSON. Successful responses:

```json
{
  "ok": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "ok": false,
  "error": {
    "code": "AUTHZ_DENIED",
    "message": "Forbidden: taskWorkbench.create requires role Operator or Admin.",
    "retryable": false,
    "traceId": "optional-trace-id"
  }
}
```

**Reference**: `packages/core/src/api/route-helpers.ts:26`

Common error codes:

| Code | HTTP status | Cause |
| --- | --- | --- |
| `AUTH_TOKEN_MISSING` | 401 | Bearer token absent |
| `AUTH_TOKEN_INVALID` | 401 | Bearer token invalid |
| `AUTH_IDENTITY_MISSING` | 401 | Identity header absent |
| `AUTHZ_DENIED` | 403 | Insufficient role |
| `CONFIG_ERROR` | 400 | Request body or params invalid |
| `PAYLOAD_TOO_LARGE` | 413 | Request body > 1 MB |
| `UNKNOWN_ERROR` | varies | Unexpected server error |

---

## Health Endpoints

These endpoints require no authentication.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Liveness probe |
| `GET` | `/api/v1/readiness` | Readiness probe |
| `GET` | `/api/v1/admin/health` | Health with state-store diagnostics |
| `GET` | `/api/v1/capabilities` | Server capability flags |

See [core-health.md](core-health.md) for details.

---

## API Family Index

| Family | Page | Endpoint count |
| --- | --- | --- |
| Core / Health | [core-health.md](core-health.md) | 4 |
| Agent Catalog | [agent-catalog.md](agent-catalog.md) | 3 |
| Tasks and Runs | [tasks-and-runs.md](tasks-and-runs.md) | 11 |
| Missions | [missions.md](missions.md) | 10 |
| Workflows and Templates | [workflows-and-templates.md](workflows-and-templates.md) | 5 |
| Sessions | [sessions.md](sessions.md) | 7 |
| Run Templates, Harness Profiles, and Directives | [run-templates-harness-directives.md](run-templates-harness-directives.md) | 7 |
| Runs (low-level) | [runs.md](runs.md) | 5 |
| Work Queue and Memory | [work-and-memory.md](work-and-memory.md) | 8 |
| Failed Work | [failed-work.md](failed-work.md) | 3 |
| Schedules and Policy | [schedules-and-policy.md](schedules-and-policy.md) | 14 |
| Operations and Events | [operations-events.md](operations-events.md) | 11 |
| Model Providers | [model-providers.md](model-providers.md) | 6 |
| Repositories | [repositories.md](repositories.md) | 6 |
| Durable Memory | [durable-memory.md](durable-memory.md) | 15 |
| Identity and RBAC | [identity-rbac.md](identity-rbac.md) | 9 |
| Workspaces | [workspaces.md](workspaces.md) | 5 |

---

## Quick Start

```bash
# Health check (no auth)
curl http://127.0.0.1:8787/api/v1/health

# With token auth
BASE=http://127.0.0.1:8787
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  $BASE/api/v1/capabilities
```

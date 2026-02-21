<!-- AUDIENCE: Internal/Technical -->

# RBAC Foundation and Permission Model (Implemented Stage 8 State)

## Status

- Stage: 8 (operational maturity and controls)
- Scope: API identity extraction and service-layer authorization enforcement

## Implemented Identity Model

Athena currently uses a trusted-header identity mode.

Request identity context shape (`src/control-plane/auth.ts`):

```ts
interface RequestAuthContext {
  subject: string;
  role: "Viewer" | "Operator" | "Admin";
}
```

Identity extraction (`src/api/middleware/auth.ts`):

- Enabled by `ATHENA_AUTH_ENABLED=true`
- Header name configured by `ATHENA_AUTH_IDENTITY_HEADER` (default `x-athena-identity`)
- Missing/empty header produces `AUTH_IDENTITY_MISSING`

Role resolution:

- `ATHENA_AUTH_IDENTITY_ROLE_MAP` maps identities to roles
- wildcard `*` role mapping is supported
- fallback role uses `ATHENA_AUTH_DEFAULT_ROLE` (default `Viewer`)

## Enforcement Location

Authorization is enforced in control-plane service wrappers in `src/control-plane/services.ts`:

- `AuthorizedRunService`
- `AuthorizedScheduleService`
- `AuthorizedPolicyService`

Route handlers stay transport-only and do not encode business auth rules.

## Current Enforced Operation Map

| Operation | Required role(s) |
| --- | --- |
| `runs.cancel` | `Operator` or `Admin` |
| `runs.cancelByRunId` | `Operator` or `Admin` |
| `schedules.upsert` | `Operator` or `Admin` |
| `schedules.remove` | `Operator` or `Admin` |
| `policy.put` | `Admin` |

Read paths and non-listed write paths are currently pass-through in this phase.

## Error and Audit Semantics

On deny:

- Athena throws `AUTHZ_DENIED`
- API returns standard error envelope with request `traceId`
- Best-effort audit event `authz.denied` is emitted with subject, role, operation, and required roles

On missing request auth context when auth is enabled:

- Athena throws `AUTH_IDENTITY_MISSING`

## Design Intent (Carried Forward)

The implemented model preserves future expansion space for:

- finer-grained resource/action permissions
- scope-constrained decisions (`sessionId`, `runId`, persona)
- additional identity providers beyond trusted headers

The current layering already supports these extensions without moving authorization into API routes.

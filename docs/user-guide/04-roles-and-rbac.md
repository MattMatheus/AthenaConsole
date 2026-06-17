<!-- AUDIENCE: Admin/Enterprise -->

# Roles and RBAC

Team Orchestrator enforces role-based access control (RBAC) on all control-plane operations. Every API request is evaluated against the caller's assigned role before the operation proceeds.

---

## Roles

Three roles are defined:

| Role | Description |
|------|-------------|
| **Viewer** | Read-only access to sessions, runs, artifacts, and events. Cannot create, cancel, or modify work. |
| **Operator** | Everything a Viewer can do, plus creating and running tasks, missions, workflows, schedules, and directives. Can cancel runs. |
| **Admin** | Everything an Operator can do, plus workspace management, provider configuration, policy changes, and identity management. |

---

## Operation Permission Matrix

| Operation | Viewer | Operator | Admin |
|-----------|--------|----------|-------|
| List/get sessions, runs, artifacts | Yes | Yes | Yes |
| Create and run tasks | No | Yes | Yes |
| Cancel runs | No | Yes | Yes |
| Create/run missions and workflows | No | Yes | Yes |
| Create/update schedules | No | Yes | Yes |
| Create directives and harness profiles | No | Yes | Yes |
| Update runtime policy | No | No | Yes |
| Manage model providers | No | No | Yes |
| Manage workspaces (CRUD) | No | No | Yes |
| Manage identity/role assignments | No | No | Yes |

This matrix is derived from `packages/core/src/control-plane/services/authorization.ts`.

---

## Per-Workspace RBAC

Workspace membership records assign `Viewer`, `Operator`, or `Admin` roles per workspace. A user can be an Operator in one workspace and a Viewer in another. The `x-athena-scope-workspaces` header can narrow a request to specific workspaces, and the server rejects workspace IDs outside the caller's membership scope.

---

## How Role Assignment Works Today

Role assignment is handled through the identity/role management API, which requires an existing Admin caller. Use the `/api/v1/identity` and `/api/v1/identity/roles` endpoints (Admin only). For endpoint details, see the [SDK and Integration Guide](../sdk/README.md).

In the trusted-proxy deployment, the proxy forwards the caller's identity via request headers. Team Orchestrator reads the identity and resolves the assigned role. See [Trusted Proxy Auth](../developer/product-dev-guides/trusted-proxy-auth.md) for proxy header configuration.

---

## Workspace Operations and Admin Gate

All workspace management operations require the Admin role:

- `workspaces.list`
- `workspaces.get`
- `workspaces.create`
- `workspaces.update`
- `workspaces.delete`

Similarly, model provider configuration requires Admin:

- `modelProviders.list`
- `modelProviders.get`
- `modelProviders.create`
- `modelProviders.update`
- `modelProviders.delete`
- `modelProviders.test`

This ensures that infrastructure configuration and workspace lifecycle are gated to platform administrators.

---

## Next Steps

- [Workspaces and Multiplayer](03-workspaces-and-multiplayer.md) — workspace CRUD and preview status
- [Operations and Admin](08-operations-and-admin.md) — admin surfaces and policy management

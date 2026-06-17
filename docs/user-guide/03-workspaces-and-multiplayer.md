<!-- AUDIENCE: Admin/Enterprise -->

# Workspaces and Multiplayer

> **Status**: Partially production-ready. Workspace CRUD, workspace membership,
> Admin RBAC, and membership-backed workspace scope narrowing are implemented.
> Remaining trusted-server gates include cost-governance enforcement,
> Postgres/server persistence readiness, and operational hardening for your
> deployment profile.

---

## Available Today

The following workspace capabilities are built and committed:

### Workspace CRUD

Create, read, update, and delete workspaces through the API:

```bash
# List workspaces
curl http://127.0.0.1:8787/api/v1/workspaces

# Create a workspace
curl -X POST http://127.0.0.1:8787/api/v1/workspaces \
  -H "content-type: application/json" \
  -d '{"name":"team-alpha","description":"Alpha team workspace"}'

# Get a workspace
curl http://127.0.0.1:8787/api/v1/workspaces/<workspace-id>

# Update a workspace
curl -X PUT http://127.0.0.1:8787/api/v1/workspaces/<workspace-id> \
  -H "content-type: application/json" \
  -d '{"name":"team-alpha-updated"}'

# Delete a workspace
curl -X DELETE http://127.0.0.1:8787/api/v1/workspaces/<workspace-id>
```

For endpoint details and request/response schemas, see the [SDK and Integration Guide](../sdk/README.md).

### Admin RBAC

Workspace operations require an Admin role. Operators and Viewers cannot create or delete workspaces. See [Roles and RBAC](04-roles-and-rbac.md) for the full role matrix.

### Workspace Membership

Admins can list, add, and remove members for a workspace through the workspace member API. Each member has a workspace-local role: `Viewer`, `Operator`, or `Admin`.

```bash
curl http://127.0.0.1:8787/api/v1/workspaces/<workspace-id>/members

curl -X PUT http://127.0.0.1:8787/api/v1/workspaces/<workspace-id>/members/<subject> \
  -H "content-type: application/json" \
  -d '{"role":"Operator"}'
```

### Workspace Scope Header

Requests can narrow access to one or more workspaces by passing the `x-athena-scope-workspaces` header:

```bash
curl http://127.0.0.1:8787/api/v1/tasks \
  -H "x-athena-scope-workspaces: workspace-id-1,workspace-id-2"
```

For non-admin users, the server checks the requested workspaces against the authenticated subject's membership rows and rejects workspaces outside that set with `AUTHZ_DENIED`. Global Admin users can administer workspaces and memberships.

---

## Remaining Production Gates

### Cost Governance Enforcement

Usage and cost records exist, but policy-level budget enforcement is tracked separately in epic 2026.45.

### Server Persistence Readiness

SQLite remains the default local app-state store. Postgres/server persistence readiness is tracked under the active Postgres-readiness work.

---

## Deployment Guidance

For trusted-server deployments, create workspaces, assign members, and verify role behavior before adding mixed-trust users. Treat cost caps and server persistence as additional readiness gates until their implementation epics are complete.

Safe configurations today:

- single-operator local workbench (no shared access)
- trusted-server deployment where workspace members and Admin operators are configured intentionally

---

## Next Steps

- [Roles and RBAC](04-roles-and-rbac.md) — role matrix and permission boundaries
- [Install and Deploy](02-install-and-deploy.md) — trusted-server profile

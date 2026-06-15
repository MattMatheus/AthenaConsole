<!-- AUDIENCE: Admin/Enterprise -->

# Workspaces and Multiplayer

> **Status**: Partially implemented. See the preview banner below for unbuilt isolation controls.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

---

## Available Today

The following workspace capabilities are built and committed (epic 2026.44.01):

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

### Workspace Scope Header

Requests can be scoped to one or more workspaces by passing the `x-athena-scope-workspaces` header:

```bash
curl http://127.0.0.1:8787/api/v1/tasks \
  -H "x-athena-scope-workspaces: workspace-id-1,workspace-id-2"
```

**Important**: As noted in the preview banner above, this scope is client-asserted — the server reads it from the header and does not verify that the caller is a member of the named workspaces. Cross-workspace isolation at the data layer is not yet enforced.

---

## Target Behavior (In Preview)

The following capabilities are designed but not yet built (epic 2026.44, stories .02–.04):

### Membership Model

Target: a `workspace_members` table that records which users belong to which workspaces. As of this build, no such table exists. Workspace CRUD does not create membership records.

### Server-Derived Scope

Target: the server determines which workspaces a request is authorized to access based on the caller's identity and membership records — not based on a client-asserted header. As of this build, the `x-athena-scope-workspaces` header is the only scope signal.

### Cross-Workspace Confinement

Target: reads and writes are blocked at the data layer when a request is scoped to workspace A and tries to access records belonging to workspace B. As of this build, no such blocking is implemented.

### Referential Integrity

Target: workspace foreign keys enforced across tasks, runs, missions, and artifacts. As of this build, workspace ids are stored as fields but FKs are not enforced.

---

## Deployment Guidance

Because workspace isolation is not yet enforced, treat all data in a shared Team Orchestrator deployment as visible to all authenticated users regardless of workspace assignment.

Safe configurations today:

- single-operator local workbench (no shared access)
- trusted-server deployment where all users are already trusted with full data access

Do not deploy to untrusted or mixed-trust user populations until epic 2026.44 stories .02–.04 land.

---

## Next Steps

- [Roles and RBAC](04-roles-and-rbac.md) — role matrix and permission boundaries
- [Install and Deploy](02-install-and-deploy.md) — trusted-server profile
